import XCTest
@testable import Relatably

/// Pure-logic tests for the SIWA auth service + cluster live source.
/// NO network, NO Firebase calls here — nonce/sha256 are free functions and
/// StaticClusterSource never touches Firestore.
///
/// SHA-256 vectors are the canonical NIST/FIPS-180 test vectors.
final class AuthServiceTests: XCTestCase {

    // The exact charset from Apple's SIWA + Firebase sample.
    private let allowedNonceCharacters = Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")

    // MARK: - randomNonceString

    func testNonceDefaultLengthIs32() {
        XCTAssertEqual(randomNonceString().count, 32)
    }

    func testNonceRespectsExplicitLength() {
        XCTAssertEqual(randomNonceString(length: 32).count, 32)
        XCTAssertEqual(randomNonceString(length: 16).count, 16)
        XCTAssertEqual(randomNonceString(length: 1).count, 1)
    }

    func testNonceUsesOnlyAllowedCharset_1000Samples() {
        for _ in 0..<1000 {
            let nonce = randomNonceString(length: 32)
            for ch in nonce {
                XCTAssertTrue(
                    allowedNonceCharacters.contains(ch),
                    "unexpected character '\(ch)' in nonce \(nonce)"
                )
            }
        }
    }

    func testNonceUniqueness_1000Samples() {
        var seen = Set<String>()
        for _ in 0..<1000 {
            seen.insert(randomNonceString(length: 32))
        }
        // 65^32 possibilities — any collision in 1000 draws means broken randomness.
        XCTAssertEqual(seen.count, 1000)
    }

    // MARK: - sha256 (hex)

    func testSha256EmptyString() {
        XCTAssertEqual(
            sha256(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )
    }

    func testSha256Abc() {
        XCTAssertEqual(
            sha256("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        )
    }

    func testSha256OfNonceIsLowercaseHex64() {
        let digest = sha256(randomNonceString())
        XCTAssertEqual(digest.count, 64)
        let hexChars = Set("0123456789abcdef")
        XCTAssertTrue(digest.allSatisfy { hexChars.contains($0) })
    }

    // MARK: - StaticClusterSource

    func testStaticClusterSourceDeliversFixedClustersOnce() {
        let clusters = [
            WordcloudCluster(id: "c1", text: "pizza", count: 12),
            WordcloudCluster(id: "c2", text: "sushi", count: 5),
        ]
        let source = StaticClusterSource(clusters: clusters)

        let delivered = expectation(description: "clusters delivered")
        var received: [[WordcloudCluster]] = []
        let handle = source.listen(questionId: "q-1") { next in
            received.append(next)
            delivered.fulfill()
        }
        wait(for: [delivered], timeout: 2)

        XCTAssertEqual(received, [clusters])

        // stop() must be safe and idempotent (Task 9/10 view models hold the handle).
        handle.stop()
        handle.stop()
    }

    func testStaticClusterSourceEmpty() {
        let source = StaticClusterSource(clusters: [])
        let delivered = expectation(description: "empty delivery")
        var received: [WordcloudCluster]?
        let handle = source.listen(questionId: "q-2") { next in
            received = next
            delivered.fulfill()
        }
        wait(for: [delivered], timeout: 2)
        XCTAssertEqual(received, [])
        handle.stop()
    }
}
