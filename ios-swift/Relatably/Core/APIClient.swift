import Foundation

// Single network layer, ported 1:1 from docs/superpowers/plans/rn-extraction/core-libs.md §1
// (src/lib/api.ts) with the spec's 2.1(a) hardening: 10 s request / 15 s resource timeouts
// so the app can never hang on a request.

/// - `http(Int)`: non-2xx status (404 stays distinguishable for the yesterday-vs-archive split).
/// - `server(String)`: submitAnswer's server-provided `error` string (or its `submit: <status>` fallback).
/// - `invalidResponse`: non-HTTP response or unbuildable URL.
enum APIError: Error, Equatable {
    case http(Int)
    case server(String)
    case invalidResponse
}

final class APIClient {

    /// Compiled-in production default — NEVER localhost (the build-25 killer).
    static let productionBaseURL = "https://relatably.vercel.app"

    /// Launch argument `-apiBaseURL <url>` lands in `UserDefaults.standard` automatically
    /// (NSArgumentDomain), so it overrides the compiled-in production default for testing.
    static func resolveBaseURL(defaults: UserDefaults = .standard) -> String {
        defaults.string(forKey: "apiBaseURL") ?? productionBaseURL
    }

    /// Production session configuration: hard 10 s per-request / 15 s per-resource timeouts (2.1a).
    static func makeDefaultConfiguration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 15
        return configuration
    }

    let session: URLSession
    let baseURLString: String
    private let tokenProvider: () async -> String?

    init(
        baseURL: String = APIClient.resolveBaseURL(),
        configuration: URLSessionConfiguration = APIClient.makeDefaultConfiguration(),
        tokenProvider: @escaping () async -> String? = { nil }
    ) {
        self.baseURLString = baseURL
        self.session = URLSession(configuration: configuration)
        self.tokenProvider = tokenProvider
    }

    // MARK: - Endpoints (core-libs.md §1.2 table, numbered #1–#17)

    /// #1 GET /api/questions/today (no auth)
    func fetchTodayQuestion() async throws -> TodayQuestion {
        let (data, http) = try await send(method: "GET", path: "/api/questions/today", authenticated: false)
        try ensureOK(http)
        return try decode(data)
    }

    /// #2 POST /api/submit (auth). On !ok prefers the server's `error` string verbatim,
    /// falling back to `submit: <status>` (§1.3).
    func submitAnswer(_ request: SubmitRequest) async throws -> SubmitResponse {
        let body = try JSONEncoder().encode(request)
        let (data, http) = try await send(method: "POST", path: "/api/submit", body: body, authenticated: true)
        guard (200...299).contains(http.statusCode) else {
            if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = object["error"] as? String {
                throw APIError.server(message)
            }
            throw APIError.server("submit: \(http.statusCode)")
        }
        return try decode(data)
    }

    /// #3 POST /api/devices/register (NO auth — even when a token exists)
    func registerDevice(_ payload: DeviceRegisterPayload) async throws {
        let body = try JSONEncoder().encode(payload)
        let (_, http) = try await send(method: "POST", path: "/api/devices/register", body: body, authenticated: false)
        try ensureOK(http)
    }

    /// #4 GET /api/yesterday (no auth), query `device_token` only if provided.
    /// Returns `nil` on HTTP 404 (not an error); other non-2xx throw.
    func fetchYesterday(deviceToken: String? = nil) async throws -> Yesterday? {
        var query: [(name: String, value: String)] = []
        if let deviceToken {
            query.append((name: "device_token", value: deviceToken))
        }
        let (data, http) = try await send(method: "GET", path: "/api/yesterday", query: query, authenticated: false)
        if http.statusCode == 404 { return nil }
        try ensureOK(http)
        return try decode(data) as Yesterday
    }

    /// #5 POST /api/auth/me (auth, NO body)
    func fetchAuthMe() async throws -> AuthMeResponse {
        let (data, http) = try await send(method: "POST", path: "/api/auth/me", authenticated: true)
        try ensureOK(http)
        return try decode(data)
    }

    /// #6 POST /api/friends/request (auth), body `{"target_user_id": …}`
    func requestFriend(targetUserId: String) async throws -> FriendMutationResponse {
        let body = try JSONEncoder().encode(["target_user_id": targetUserId])
        let (data, http) = try await send(method: "POST", path: "/api/friends/request", body: body, authenticated: true)
        try ensureOK(http)
        return try decode(data)
    }

    /// #7 POST /api/friends/accept (auth), body `{"friendship_id": …}`
    func acceptFriend(friendshipId: String) async throws -> FriendMutationResponse {
        let body = try JSONEncoder().encode(["friendship_id": friendshipId])
        let (data, http) = try await send(method: "POST", path: "/api/friends/accept", body: body, authenticated: true)
        try ensureOK(http)
        return try decode(data)
    }

    /// #8 DELETE /api/friends/{friendshipId} (auth, URL-encoded path param)
    func removeFriend(friendshipId: String) async throws {
        let path = "/api/friends/\(Self.percentEncode(friendshipId))"
        let (_, http) = try await send(method: "DELETE", path: path, authenticated: true)
        try ensureOK(http)
    }

    /// #9 GET /api/friends (auth)
    func fetchFriends() async throws -> FriendsResponse {
        let (data, http) = try await send(method: "GET", path: "/api/friends", authenticated: true)
        try ensureOK(http)
        return try decode(data)
    }

    /// #10 GET /api/leaderboard — auth header ONLY for scope == friends;
    /// `limit` query only when provided.
    func fetchLeaderboard(
        period: LeaderboardPeriod,
        scope: LeaderboardScope,
        limit: Int? = nil
    ) async throws -> LeaderboardResponse {
        var query: [(name: String, value: String)] = [
            (name: "period", value: period.rawValue),
            (name: "scope", value: scope.rawValue),
        ]
        if let limit {
            query.append((name: "limit", value: String(limit)))
        }
        let (data, http) = try await send(
            method: "GET",
            path: "/api/leaderboard",
            query: query,
            authenticated: scope == .friends
        )
        try ensureOK(http)
        return try decode(data)
    }

    /// #11 POST /api/share/track (auth)
    func trackShare(_ request: ShareTrackRequest) async throws -> ShareTrackResponse {
        let body = try JSONEncoder().encode(request)
        let (data, http) = try await send(method: "POST", path: "/api/share/track", body: body, authenticated: true)
        try ensureOK(http)
        return try decode(data)
    }

    /// #12 GET /api/archive (no auth), `cursor` percent-encoded and only when provided
    func fetchArchive(cursor: String? = nil) async throws -> ArchivePage {
        var query: [(name: String, value: String)] = []
        if let cursor {
            query.append((name: "cursor", value: cursor))
        }
        let (data, http) = try await send(method: "GET", path: "/api/archive", query: query, authenticated: false)
        try ensureOK(http)
        return try decode(data)
    }

    /// #13 GET /api/archive/{questionId} (no auth) — 404 THROWS, unlike fetchYesterday
    func fetchArchiveDetail(questionId: String) async throws -> ArchiveDetail {
        let path = "/api/archive/\(Self.percentEncode(questionId))"
        let (data, http) = try await send(method: "GET", path: path, authenticated: false)
        try ensureOK(http)
        return try decode(data)
    }

    /// #14 POST /api/report (auth)
    func reportContent(_ payload: ReportPayload) async throws {
        let body = try JSONEncoder().encode(payload)
        let (_, http) = try await send(method: "POST", path: "/api/report", body: body, authenticated: true)
        try ensureOK(http)
    }

    /// #15 DELETE /api/submissions/{submissionId} (auth) — DELETE with JSON body
    func deleteOwnSubmission(submissionId: String, deviceToken: String) async throws {
        let body = try JSONEncoder().encode(["device_token": deviceToken])
        let path = "/api/submissions/\(Self.percentEncode(submissionId))"
        let (_, http) = try await send(method: "DELETE", path: path, body: body, authenticated: true)
        try ensureOK(http)
    }

    /// #16 POST /api/users/{targetUserId}/block (auth, no body)
    func blockUser(targetUserId: String) async throws {
        let path = "/api/users/\(Self.percentEncode(targetUserId))/block"
        let (_, http) = try await send(method: "POST", path: path, authenticated: true)
        try ensureOK(http)
    }

    /// #17 POST /api/account/delete (auth, no body)
    func deleteAccount() async throws {
        let (_, http) = try await send(method: "POST", path: "/api/account/delete", authenticated: true)
        try ensureOK(http)
    }

    // MARK: - Core request machinery

    private func send(
        method: String,
        path: String,
        query: [(name: String, value: String)] = [],
        body: Data? = nil,
        authenticated: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        guard var components = URLComponents(string: baseURLString) else {
            throw APIError.invalidResponse
        }
        let basePath = components.percentEncodedPath
        let trimmedBasePath = basePath.hasSuffix("/") ? String(basePath.dropLast()) : basePath
        components.percentEncodedPath = trimmedBasePath + path
        if !query.isEmpty {
            // encodeURIComponent-equivalent encoding (":" → %3A etc.), applied up front
            // and installed via percentEncodedQueryItems so URLComponents keeps it verbatim.
            components.percentEncodedQueryItems = query.map {
                URLQueryItem(name: Self.percentEncode($0.name), value: Self.percentEncode($0.value))
            }
        }
        guard let url = components.url else {
            throw APIError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = body
        }
        if authenticated, let token = await tokenProvider() {
            // Lowercase header name on purpose (core-libs.md §1.1 / red flag 10).
            // When the token is nil the request is STILL sent, just without the header.
            request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        return (data, http)
    }

    private func ensureOK(_ http: HTTPURLResponse) throws {
        guard (200...299).contains(http.statusCode) else {
            throw APIError.http(http.statusCode)
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Percent encoding (encodeURIComponent semantics)

    /// RFC 3986 unreserved characters — everything else (incl. ":" and "/") is escaped,
    /// matching the JS client's encodeURIComponent behavior for path params and cursors.
    private static let unreservedCharacters = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
    )

    static func percentEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: unreservedCharacters) ?? value
    }
}
