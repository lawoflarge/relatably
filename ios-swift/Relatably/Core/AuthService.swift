import AuthenticationServices
import CryptoKit
import FirebaseAuth
import Foundation
import os
import UIKit

// Sign in with Apple → Firebase Auth — port of ios/src/lib/auth.ts per
// docs/superpowers/plans/rn-extraction/friends-auth.md §4.4.
//
// RN parity notes:
// - Scopes requested: fullName + email (RN FULL_NAME + EMAIL). Nothing is done
//   with the returned name/email — auth.ts never updates displayName; neither do we.
// - Return value to callers is ONLY the Firebase uid.
// - "Apple Sign-in returned no identity token" thrown verbatim when Apple gives no token.
// - getIdToken()/idToken() NEVER throws: nil when signed out or on refresh failure
//   (the API layer silently omits the auth header on nil — friends-auth.md §5).
// - Nonce: the RN app passed rawNonce "" (expo requested without a nonce). The native
//   Firebase SDK REQUIRES a real nonce (friends-auth.md §7.8), so per Apple's SIWA
//   sample we generate a random nonce, send its SHA-256 to Apple, and the raw value
//   to Firebase. Behavioral outcome identical; mechanism necessarily differs.
// - User cancel: ASAuthorizationError.canceled propagates as-is; the Friends screen
//   (Task 12) suppresses the alert on cancel, mirroring the RN /canceled/i check.

// MARK: - Token provider protocol (APIClient dependency, wired in Task 8/9)

protocol TokenProviding {
    func idToken() async -> String?
}

// MARK: - Nonce + hashing (pure logic, unit-tested — no Firebase)

/// Secure random nonce, charset per Apple's SIWA + Firebase sample.
func randomNonceString(length: Int = 32) -> String {
    precondition(length > 0)
    var randomBytes = [UInt8](repeating: 0, count: length)
    let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
    if errorCode != errSecSuccess {
        fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
    }
    let charset: [Character] =
        Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
    return String(randomBytes.map { byte in charset[Int(byte) % charset.count] })
}

/// Lowercase hex SHA-256 (the hashed nonce Apple expects on the request).
func sha256(_ input: String) -> String {
    SHA256.hash(data: Data(input.utf8))
        .map { String(format: "%02x", $0) }
        .joined()
}

// MARK: - Errors

enum AuthError: LocalizedError {
    /// Verbatim RN error string (friends-auth.md §1).
    case noIdentityToken
    /// Native-only: Firebase never configured (missing plist) — sign-in cannot proceed.
    case firebaseUnavailable

    var errorDescription: String? {
        switch self {
        case .noIdentityToken: return "Apple Sign-in returned no identity token"
        case .firebaseUnavailable: return "Sign-in is unavailable right now."
        }
    }
}

// MARK: - AuthService

final class AuthService: TokenProviding {

    static let shared = AuthService()

    struct SignedInUser {
        let uid: String
    }

    private let logger = Logger(subsystem: "co.relatably.app", category: "AuthService")

    var isSignedIn: Bool {
        guard FirebaseBootstrap.isConfigured else { return false }
        return Auth.auth().currentUser != nil
    }

    /// Full SIWA → Firebase flow. Throws on failure (incl. ASAuthorizationError.canceled
    /// when the user dismisses the sheet — callers decide whether that is silent).
    @MainActor
    func signInWithApple() async throws -> SignedInUser {
        guard FirebaseBootstrap.isConfigured else { throw AuthError.firebaseUnavailable }

        let rawNonce = randomNonceString()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(rawNonce)

        let coordinator = AppleSignInCoordinator()
        let credential = try await coordinator.perform(request: request)

        guard let tokenData = credential.identityToken,
              let idToken = String(data: tokenData, encoding: .utf8) else {
            throw AuthError.noIdentityToken
        }

        let firebaseCredential = OAuthProvider.credential(
            providerID: .apple,
            idToken: idToken,
            rawNonce: rawNonce
        )
        let result = try await Auth.auth().signIn(with: firebaseCredential)
        return SignedInUser(uid: result.user.uid)
    }

    /// Current user's Firebase ID token. NEVER throws into the API path:
    /// nil when signed out, Firebase unconfigured, or token refresh fails.
    func idToken() async -> String? {
        guard FirebaseBootstrap.isConfigured, let user = Auth.auth().currentUser else {
            return nil
        }
        do {
            return try await user.getIDToken()
        } catch {
            logger.warning("idToken refresh failed: \(error.localizedDescription)")
            return nil
        }
    }

    func signOut() throws {
        guard FirebaseBootstrap.isConfigured else { return }
        try Auth.auth().signOut()
    }
}

// MARK: - Auth-state observation (for ViewModels / the Friends tab wrapper)

/// Publishes `isSignedIn` via Firebase's auth-state listener — the SwiftUI
/// equivalent of the RN parent tab wrapper observing Firebase auth state.
final class AuthState: ObservableObject {

    @Published private(set) var isSignedIn: Bool

    private var listenerHandle: AuthStateDidChangeListenerHandle?

    init() {
        guard FirebaseBootstrap.isConfigured else {
            isSignedIn = false
            return
        }
        isSignedIn = Auth.auth().currentUser != nil
        // Firebase invokes this listener on the main thread.
        listenerHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.isSignedIn = user != nil
        }
    }

    deinit {
        if let listenerHandle, FirebaseBootstrap.isConfigured {
            Auth.auth().removeStateDidChangeListener(listenerHandle)
        }
    }
}

// MARK: - ASAuthorizationController async bridge

private final class AppleSignInCoordinator: NSObject,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    private var continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>?
    private var controller: ASAuthorizationController?

    func perform(request: ASAuthorizationAppleIDRequest) async throws -> ASAuthorizationAppleIDCredential {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
            continuation?.resume(returning: credential)
        } else {
            continuation?.resume(throwing: ASAuthorizationError(.failed))
        }
        continuation = nil
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
