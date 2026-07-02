import XCTest
@testable import Relatably

// MARK: - URLProtocol stub

/// Intercepts every request on sessions whose configuration registers it.
/// Static state is reset per-test in `setUp`; each test performs one request.
final class StubURLProtocol: URLProtocol {
    static var statusCode = 200
    static var responseData = Data()
    /// When true, never calls back on the client — exercises the timeout path.
    static var neverComplete = false
    private(set) static var requests: [URLRequest] = []
    private(set) static var lastBody: Data?

    static var lastRequest: URLRequest? { requests.last }

    static func reset() {
        statusCode = 200
        responseData = Data()
        neverComplete = false
        requests = []
        lastBody = nil
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        StubURLProtocol.requests.append(request)
        StubURLProtocol.lastBody = Self.readBody(of: request)
        if StubURLProtocol.neverComplete { return }
        guard let url = request.url,
              let response = HTTPURLResponse(
                url: url,
                statusCode: StubURLProtocol.statusCode,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
              )
        else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: StubURLProtocol.responseData)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    /// URLSession converts `httpBody` into `httpBodyStream` before the protocol sees it.
    private static func readBody(of request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let count = stream.read(buffer, maxLength: bufferSize)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}

// MARK: - API client tests (fixtures: rn-extraction/core-libs.md §1 + §9.1)

final class APIClientTests: XCTestCase {

    override func setUp() {
        super.setUp()
        StubURLProtocol.reset()
    }

    // MARK: Helpers

    private func makeClient(
        token: String? = nil,
        requestTimeout: TimeInterval = 10,
        resourceTimeout: TimeInterval = 15
    ) -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        config.timeoutIntervalForRequest = requestTimeout
        config.timeoutIntervalForResource = resourceTimeout
        return APIClient(
            baseURL: "https://api.test",
            configuration: config,
            tokenProvider: { token }
        )
    }

    private func stub(_ status: Int, _ body: String = "") {
        StubURLProtocol.statusCode = status
        StubURLProtocol.responseData = Data(body.utf8)
    }

    private var lastRequest: URLRequest? { StubURLProtocol.lastRequest }
    private var lastURL: String { lastRequest?.url?.absoluteString ?? "" }
    private var lastBodyString: String? {
        StubURLProtocol.lastBody.map { String(decoding: $0, as: UTF8.self) }
    }
    private var authHeader: String? { lastRequest?.value(forHTTPHeaderField: "authorization") }
    private var contentTypeHeader: String? { lastRequest?.value(forHTTPHeaderField: "content-type") }

    private func lastBodyJSON(file: StaticString = #filePath, line: UInt = #line) throws -> [String: Any] {
        let data = try XCTUnwrap(StubURLProtocol.lastBody, "expected a request body", file: file, line: line)
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any],
            "body is not a JSON object", file: file, line: line
        )
    }

    private func expectAPIError<T>(
        _ expected: APIError,
        file: StaticString = #filePath,
        line: UInt = #line,
        _ op: () async throws -> T
    ) async {
        do {
            _ = try await op()
            XCTFail("expected \(expected), got success", file: file, line: line)
        } catch let error as APIError {
            XCTAssertEqual(error, expected, file: file, line: line)
        } catch {
            XCTFail("expected APIError, got \(error)", file: file, line: line)
        }
    }

    // MARK: Configuration contract (2.1a hardening)

    func testProductionDefaultConfigurationTimeouts() {
        let config = APIClient.makeDefaultConfiguration()
        XCTAssertEqual(config.timeoutIntervalForRequest, 10)
        XCTAssertEqual(config.timeoutIntervalForResource, 15)

        let client = APIClient()
        XCTAssertEqual(client.session.configuration.timeoutIntervalForRequest, 10)
        XCTAssertEqual(client.session.configuration.timeoutIntervalForResource, 15)
    }

    func testDefaultBaseURLIsProductionNeverLocalhost() {
        UserDefaults.standard.removeObject(forKey: "apiBaseURL")
        let base = APIClient.resolveBaseURL()
        XCTAssertEqual(base, "https://relatably.vercel.app")
        XCTAssertFalse(base.contains("localhost"))
        XCTAssertFalse(base.contains("127.0.0.1"))
    }

    func testUserDefaultsOverridesBaseURL() {
        // `-apiBaseURL <url>` launch arguments land in UserDefaults.standard automatically.
        UserDefaults.standard.set("http://127.0.0.1:9", forKey: "apiBaseURL")
        defer { UserDefaults.standard.removeObject(forKey: "apiBaseURL") }
        XCTAssertEqual(APIClient.resolveBaseURL(), "http://127.0.0.1:9")
    }

    // MARK: fetchTodayQuestion (#1)

    func testFetchTodayQuestion() async throws {
        stub(200, #"{"id":"q1","text":"what's the best excuse?"}"#)
        let question = try await makeClient(token: "id-token-1").fetchTodayQuestion()
        XCTAssertEqual(lastRequest?.httpMethod, "GET")
        XCTAssertTrue(lastURL.hasSuffix("/api/questions/today"), lastURL)
        XCTAssertNil(authHeader, "fetchTodayQuestion must not send auth")
        XCTAssertEqual(question, TodayQuestion(id: "q1", text: "what's the best excuse?"))
    }

    // MARK: fetchAuthMe (#5) — §9.1 rows 1–2

    func testFetchAuthMeSendsPOSTWithAuthHeaderAndNoBody() async throws {
        stub(200, #"{"uid":"u1","handle":null,"is_public":true,"locale":"en","shadowbanned":false}"#)
        let me = try await makeClient(token: "id-token-1").fetchAuthMe()

        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/auth/me"), lastURL)
        XCTAssertEqual(authHeader, "Bearer id-token-1")
        XCTAssertNil(StubURLProtocol.lastBody, "fetchAuthMe is POST with NO body")
        XCTAssertNil(contentTypeHeader, "no JSON body → no content-type header")
        XCTAssertEqual(me.uid, "u1")
        XCTAssertNil(me.handle)
        XCTAssertTrue(me.isPublic)
        XCTAssertEqual(me.locale, "en")
        XCTAssertFalse(me.shadowbanned)
    }

    func testAuthorizationHeaderResolvableViaLowercaseName() async throws {
        // The client sets the header with the lowercase name "authorization"
        // (core-libs.md red flag 10). Foundation canonicalizes known header keys
        // ("authorization" → "Authorization") inside URLRequest.setValue itself, so the
        // literal key casing is unobservable at any URLSession layer — for the RN app
        // (fetch → NSURLSession) exactly as for this port. Over HTTP/2 (Vercel) the
        // name is lowercased on the wire by protocol mandate, so server-visible
        // semantics are identical. Strongest observable contract: exactly one
        // authorization header, exact value, resolvable via the lowercase name.
        stub(200, #"{"uid":"u1","handle":null,"is_public":true,"locale":"en","shadowbanned":false}"#)
        _ = try await makeClient(token: "id-token-1").fetchAuthMe()
        XCTAssertEqual(lastRequest?.value(forHTTPHeaderField: "authorization"), "Bearer id-token-1")
        let authKeys = (lastRequest?.allHTTPHeaderFields ?? [:]).keys
            .filter { $0.caseInsensitiveCompare("authorization") == .orderedSame }
        XCTAssertEqual(authKeys.count, 1, "exactly one authorization header, got \(Array(authKeys))")
    }

    func testFetchAuthMeWithoutTokenStillSendsRequestAndThrows() async {
        stub(401, #"{"error":"unauthorized"}"#)
        await expectAPIError(.http(401)) {
            try await self.makeClient(token: nil).fetchAuthMe()
        }
        XCTAssertEqual(StubURLProtocol.requests.count, 1, "request must still be sent without a token")
        XCTAssertNil(authHeader, "no token → no authorization header")
    }

    // MARK: friends (#6–#9) — §9.1 rows 3–6

    func testRequestFriendBodyAndResult() async throws {
        stub(200, #"{"id":"fid","status":"pending"}"#)
        let result = try await makeClient(token: "id-token-1").requestFriend(targetUserId: "u2")

        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/friends/request"), lastURL)
        XCTAssertEqual(lastBodyString, #"{"target_user_id":"u2"}"#)
        XCTAssertEqual(contentTypeHeader, "application/json")
        XCTAssertEqual(authHeader, "Bearer id-token-1")
        XCTAssertEqual(result, FriendMutationResponse(id: "fid", status: "pending"))
    }

    func testAcceptFriendBody() async throws {
        stub(200, #"{"id":"fid","status":"accepted"}"#)
        let result = try await makeClient(token: "id-token-1").acceptFriend(friendshipId: "fid")

        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/friends/accept"), lastURL)
        XCTAssertEqual(lastBodyString, #"{"friendship_id":"fid"}"#)
        XCTAssertEqual(result.status, "accepted")
    }

    func testRemoveFriendUsesDELETE() async throws {
        stub(200)
        try await makeClient(token: "id-token-1").removeFriend(friendshipId: "fid")
        XCTAssertEqual(lastRequest?.httpMethod, "DELETE")
        XCTAssertTrue(lastURL.hasSuffix("/api/friends/fid"), lastURL)
        XCTAssertEqual(authHeader, "Bearer id-token-1")
    }

    func testFetchFriendsReturnsFriendships() async throws {
        stub(200, #"{"friendships":[{"id":"f1","friend_user_id":"u9","handle":null,"locale":"en","status":"pending","direction":"incoming"}]}"#)
        let response = try await makeClient(token: "id-token-1").fetchFriends()

        XCTAssertEqual(lastRequest?.httpMethod, "GET")
        XCTAssertTrue(lastURL.hasSuffix("/api/friends"), lastURL)
        XCTAssertEqual(authHeader, "Bearer id-token-1")
        XCTAssertEqual(response.friendships.count, 1)
        XCTAssertEqual(response.friendships[0].id, "f1")
        XCTAssertEqual(response.friendships[0].friendUserId, "u9")
        XCTAssertNil(response.friendships[0].handle)
        XCTAssertEqual(response.friendships[0].status, .pending)
        XCTAssertEqual(response.friendships[0].direction, .incoming)
    }

    // MARK: fetchLeaderboard (#10) — §9.1 rows 7–8

    func testLeaderboardGlobalQueryAndNoAuth() async throws {
        stub(200, #"{"entries":[]}"#)
        let response = try await makeClient(token: "id-token-1")
            .fetchLeaderboard(period: .daily, scope: .global)

        XCTAssertTrue(lastURL.contains("period=daily"), lastURL)
        XCTAssertTrue(lastURL.contains("scope=global"), lastURL)
        XCTAssertFalse(lastURL.contains("limit="), "limit only when provided: \(lastURL)")
        XCTAssertNil(authHeader, "global scope must NOT send auth")
        XCTAssertTrue(response.entries.isEmpty)
    }

    func testLeaderboardFriendsSendsAuth() async throws {
        stub(200, #"{"entries":[]}"#)
        _ = try await makeClient(token: "id-token-1")
            .fetchLeaderboard(period: .weekly, scope: .friends)

        XCTAssertTrue(lastURL.contains("period=weekly"), lastURL)
        XCTAssertTrue(lastURL.contains("scope=friends"), lastURL)
        XCTAssertEqual(authHeader, "Bearer id-token-1", "friends scope must send auth")
    }

    func testLeaderboardLimitParamOnlyWhenProvided() async throws {
        stub(200, #"{"entries":[]}"#)
        _ = try await makeClient().fetchLeaderboard(period: .alltime, scope: .global, limit: 25)
        XCTAssertTrue(lastURL.contains("period=alltime"), lastURL)
        XCTAssertTrue(lastURL.contains("limit=25"), lastURL)
    }

    // MARK: fetchArchive (#12) — §9.1 rows 9–11

    func testFetchArchiveNoCursor() async throws {
        stub(200, #"{"tiles":[],"next_cursor":null}"#)
        let page = try await makeClient().fetchArchive()

        XCTAssertTrue(lastURL.hasSuffix("/api/archive"), lastURL)
        XCTAssertFalse(lastURL.contains("?"), "no cursor → no query string: \(lastURL)")
        XCTAssertNil(authHeader)
        XCTAssertTrue(page.tiles.isEmpty)
        XCTAssertNil(page.nextCursor)
    }

    func testFetchArchiveCursorEncoding() async throws {
        stub(200, #"{"tiles":[],"next_cursor":null}"#)
        _ = try await makeClient().fetchArchive(cursor: "2026-05-08T00:00:00.000Z")
        XCTAssertTrue(
            lastURL.contains("cursor=2026-05-08T00%3A00%3A00.000Z"),
            "cursor must be percent-encoded like encodeURIComponent: \(lastURL)"
        )
    }

    func testFetchArchive500Throws() async {
        stub(500, "oops")
        await expectAPIError(.http(500)) { try await self.makeClient().fetchArchive() }
    }

    // MARK: fetchArchiveDetail (#13) — §9.1 rows 12–13

    func testFetchArchiveDetail() async throws {
        stub(200, #"{"id":"q1","text":"?","created_at":"x","top_clusters":[]}"#)
        let detail = try await makeClient().fetchArchiveDetail(questionId: "q1")
        XCTAssertTrue(lastURL.hasSuffix("/api/archive/q1"), lastURL)
        XCTAssertNil(authHeader)
        XCTAssertEqual(detail.id, "q1")
    }

    func testFetchArchiveDetail404Throws() async {
        stub(404, #"{"error":"not found"}"#)
        await expectAPIError(.http(404)) {
            try await self.makeClient().fetchArchiveDetail(questionId: "missing")
        }
    }

    // MARK: fetchYesterday (#4) — 404 → nil semantics

    func testFetchYesterday404ReturnsNil() async throws {
        stub(404, #"{"error":"not found"}"#)
        let result = try await makeClient().fetchYesterday()
        XCTAssertNil(result, "fetchYesterday must return nil on 404, not throw")
    }

    func testFetchYesterdayDecodesAndSendsDeviceTokenQuery() async throws {
        stub(200, #"{"id":"q9","text":"coffee?","top_clusters":[{"id":"c1","canonical_text":"latte","submission_count":42,"final_rank":1,"final_pct_of_total":0.31}],"self_cluster_id":"c1"}"#)
        let yesterday = try await makeClient().fetchYesterday(deviceToken: "dt-1")

        XCTAssertEqual(lastRequest?.httpMethod, "GET")
        XCTAssertTrue(lastURL.contains("/api/yesterday"), lastURL)
        XCTAssertTrue(lastURL.contains("device_token=dt-1"), lastURL)
        let unwrapped = try XCTUnwrap(yesterday)
        XCTAssertEqual(unwrapped.id, "q9")
        XCTAssertEqual(unwrapped.selfClusterId, "c1")
        XCTAssertEqual(unwrapped.topClusters.count, 1)
        XCTAssertEqual(unwrapped.topClusters[0].canonicalText, "latte")
        XCTAssertEqual(unwrapped.topClusters[0].finalPctOfTotal, 0.31, accuracy: 1e-9)
    }

    func testFetchYesterdayOmitsQueryWithoutDeviceToken() async throws {
        stub(200, #"{"id":"q9","text":"coffee?","top_clusters":[],"self_cluster_id":null}"#)
        let yesterday = try await makeClient().fetchYesterday()
        XCTAssertTrue(lastURL.hasSuffix("/api/yesterday"), lastURL)
        XCTAssertFalse(lastURL.contains("?"), "device_token only if provided: \(lastURL)")
        XCTAssertNil(yesterday?.selfClusterId ?? nil)
        XCTAssertNotNil(yesterday)
    }

    func testFetchYesterdayOtherErrorThrows() async {
        stub(500, "")
        await expectAPIError(.http(500)) { try await self.makeClient().fetchYesterday() }
    }

    // MARK: submitAnswer (#2) — §1.3 error path

    func testSubmitAnswerRequestShapeAndDecode() async throws {
        stub(200, #"{"cluster_id":"c1","submission_count":7,"normalized_text":"flowers","submission_id":"s1"}"#)
        let request = SubmitRequest(questionId: "q1", deviceToken: "d1", rawText: "  flowers ", dwellMs: 3200)
        let response = try await makeClient(token: "id-token-1").submitAnswer(request)

        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/submit"), lastURL)
        XCTAssertEqual(contentTypeHeader, "application/json")
        XCTAssertEqual(authHeader, "Bearer id-token-1")
        let body = try lastBodyJSON()
        XCTAssertEqual(body["question_id"] as? String, "q1")
        XCTAssertEqual(body["device_token"] as? String, "d1")
        XCTAssertEqual(body["raw_text"] as? String, "  flowers ", "raw_text must be sent untrimmed")
        XCTAssertEqual(body["dwell_ms"] as? Int, 3200)
        XCTAssertEqual(body.count, 4)
        XCTAssertEqual(response, SubmitResponse(
            clusterId: "c1", submissionCount: 7, normalizedText: "flowers", submissionId: "s1"
        ))
    }

    func testSubmitAnswerPrefersServerErrorString() async {
        stub(429, #"{"error":"slow down, one drop per day"}"#)
        await expectAPIError(.server("slow down, one drop per day")) {
            try await self.makeClient().submitAnswer(
                SubmitRequest(questionId: "q1", deviceToken: "d1", rawText: "x", dwellMs: 3000)
            )
        }
    }

    func testSubmitAnswerFallsBackToStatusMessage() async {
        stub(500, "<html>gateway error</html>")
        await expectAPIError(.server("submit: 500")) {
            try await self.makeClient().submitAnswer(
                SubmitRequest(questionId: "q1", deviceToken: "d1", rawText: "x", dwellMs: 3000)
            )
        }
    }

    // MARK: registerDevice (#3) — never authenticated

    func testRegisterDeviceNoAuthEvenWithToken() async throws {
        stub(200)
        try await makeClient(token: "id-token-1").registerDevice(
            DeviceRegisterPayload(deviceToken: "d1", fcmToken: "f1")
        )
        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/devices/register"), lastURL)
        XCTAssertNil(authHeader, "registerDevice is unauthenticated even when a token exists")
        XCTAssertEqual(contentTypeHeader, "application/json")
        let body = try lastBodyJSON()
        XCTAssertEqual(body["device_token"] as? String, "d1")
        XCTAssertEqual(body["fcm_token"] as? String, "f1")
    }

    // MARK: deleteOwnSubmission (#15) — DELETE with JSON body

    func testDeleteOwnSubmissionDELETEWithJSONBody() async throws {
        stub(200)
        try await makeClient(token: "id-token-1").deleteOwnSubmission(submissionId: "s1", deviceToken: "d1")

        XCTAssertEqual(lastRequest?.httpMethod, "DELETE")
        XCTAssertTrue(lastURL.hasSuffix("/api/submissions/s1"), lastURL)
        XCTAssertEqual(lastBodyString, #"{"device_token":"d1"}"#)
        XCTAssertEqual(contentTypeHeader, "application/json")
        XCTAssertEqual(authHeader, "Bearer id-token-1")
    }

    // MARK: blockUser (#16) / deleteAccount (#17)

    func testBlockUserPathAndNoBody() async throws {
        stub(200)
        try await makeClient(token: "id-token-1").blockUser(targetUserId: "u2")
        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/users/u2/block"), lastURL)
        XCTAssertNil(StubURLProtocol.lastBody)
        XCTAssertEqual(authHeader, "Bearer id-token-1")
    }

    func testDeleteAccountPOSTAuth() async throws {
        stub(200)
        try await makeClient(token: "id-token-1").deleteAccount()
        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/account/delete"), lastURL)
        XCTAssertNil(StubURLProtocol.lastBody)
        XCTAssertEqual(authHeader, "Bearer id-token-1")
    }

    // MARK: trackShare (#11) / reportContent (#14)

    func testTrackShare() async throws {
        stub(200, #"{"referral_code":"r123"}"#)
        let response = try await makeClient(token: "id-token-1").trackShare(
            ShareTrackRequest(bannerType: .calledIt, questionId: "q1", shareTarget: .igStory)
        )
        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/share/track"), lastURL)
        XCTAssertEqual(authHeader, "Bearer id-token-1")
        let body = try lastBodyJSON()
        XCTAssertEqual(body["banner_type"] as? String, "called_it")
        XCTAssertEqual(body["question_id"] as? String, "q1")
        XCTAssertEqual(body["share_target"] as? String, "ig_story")
        XCTAssertEqual(response.referralCode, "r123")
    }

    func testReportContentOmitsNilFields() async throws {
        stub(200)
        try await makeClient(token: "id-token-1").reportContent(
            ReportPayload(targetType: .cluster, targetId: "c1", reason: nil, deviceToken: "dt")
        )
        XCTAssertEqual(lastRequest?.httpMethod, "POST")
        XCTAssertTrue(lastURL.hasSuffix("/api/report"), lastURL)
        let body = try lastBodyJSON()
        XCTAssertEqual(body["target_type"] as? String, "cluster")
        XCTAssertEqual(body["target_id"] as? String, "c1")
        XCTAssertEqual(body["device_token"] as? String, "dt")
        XCTAssertNil(body["reason"], "nil optional fields must be omitted from the JSON body")
        XCTAssertEqual(body.count, 3)
    }

    func testReportContentFullPayload() async throws {
        stub(200)
        try await makeClient(token: "id-token-1").reportContent(
            ReportPayload(targetType: .cluster, targetId: "c1", reason: "blocked contributor", deviceToken: "dt")
        )
        let body = try lastBodyJSON()
        XCTAssertEqual(body["reason"] as? String, "blocked contributor")
        XCTAssertEqual(body.count, 4)
    }

    // MARK: path param percent-encoding

    func testPathParamsPercentEncoded() async throws {
        stub(200, #"{"id":"q 1/x","text":"?","created_at":"x","top_clusters":[]}"#)
        _ = try await makeClient().fetchArchiveDetail(questionId: "q 1/x")
        XCTAssertTrue(
            lastURL.hasSuffix("/api/archive/q%201%2Fx"),
            "path params must be percent-encoded incl. '/': \(lastURL)"
        )

        stub(200)
        try await makeClient(token: "t").blockUser(targetUserId: "u 2")
        XCTAssertTrue(lastURL.hasSuffix("/api/users/u%202/block"), lastURL)
    }

    // MARK: timeout (2.1a — the app must never hang)

    func testTimeoutWhenServerNeverReplies() async {
        StubURLProtocol.neverComplete = true
        // 2 s request timeout via the injectable configuration keeps the suite fast;
        // testProductionDefaultConfigurationTimeouts pins the production 10/15 values.
        let client = makeClient(requestTimeout: 2, resourceTimeout: 3)
        let start = Date()
        do {
            _ = try await client.fetchTodayQuestion()
            XCTFail("expected a timeout error")
        } catch {
            let elapsed = Date().timeIntervalSince(start)
            XCTAssertGreaterThanOrEqual(elapsed, 1.0, "should not fail instantly")
            XCTAssertLessThan(elapsed, 8.0, "must time out promptly, took \(elapsed)s")
            XCTAssertEqual((error as? URLError)?.code, .timedOut, "got \(error)")
        }
    }
}

// MARK: - Model decode/encode fixtures (core-libs.md §2 verbatim)

final class ModelsCodableTests: XCTestCase {

    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    private func encodeSorted<T: Encodable>(_ value: T) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return String(decoding: try encoder.encode(value), as: UTF8.self)
    }

    func testDecodeTodayQuestion() throws {
        let q = try decode(TodayQuestion.self, #"{"id":"q1","text":"hi"}"#)
        XCTAssertEqual(q, TodayQuestion(id: "q1", text: "hi"))
    }

    func testDecodeSubmitResponse() throws {
        let r = try decode(SubmitResponse.self, #"{"cluster_id":"c1","submission_count":7,"normalized_text":"ai","submission_id":"s1"}"#)
        XCTAssertEqual(r, SubmitResponse(clusterId: "c1", submissionCount: 7, normalizedText: "ai", submissionId: "s1"))
    }

    func testDecodeYesterdayNullSelfClusterId() throws {
        let y = try decode(Yesterday.self, #"{"id":"q9","text":"t","top_clusters":[{"id":"c1","canonical_text":"latte","submission_count":42,"final_rank":1,"final_pct_of_total":0.31}],"self_cluster_id":null}"#)
        XCTAssertNil(y.selfClusterId)
        XCTAssertEqual(y.topClusters[0].finalRank, 1)
        XCTAssertEqual(y.topClusters[0].submissionCount, 42)
    }

    func testDecodeAuthMeNullHandle() throws {
        let me = try decode(AuthMeResponse.self, #"{"uid":"u1","handle":null,"is_public":false,"locale":"de","shadowbanned":true}"#)
        XCTAssertEqual(me.uid, "u1")
        XCTAssertNil(me.handle)
        XCTAssertFalse(me.isPublic)
        XCTAssertTrue(me.shadowbanned)
    }

    func testDecodeFriendship() throws {
        let f = try decode(Friendship.self, #"{"id":"f1","friend_user_id":"u9","handle":"leo","locale":"en","status":"accepted","direction":"outgoing"}"#)
        XCTAssertEqual(f.handle, "leo")
        XCTAssertEqual(f.status, .accepted)
        XCTAssertEqual(f.direction, .outgoing)
    }

    func testDecodeLeaderboardEntryOptionalDailyRank() throws {
        let withRank = try decode(LeaderboardEntry.self, #"{"user_id":"u1","handle":"maya","score":1840,"daily_rank":1,"locale":"en-US"}"#)
        XCTAssertEqual(withRank.dailyRank, 1)
        XCTAssertEqual(withRank.score, 1840)

        let withoutRank = try decode(LeaderboardEntry.self, #"{"user_id":"u2","handle":null,"score":10,"locale":"de"}"#)
        XCTAssertNil(withoutRank.dailyRank)
        XCTAssertNil(withoutRank.handle)
    }

    func testDecodeArchivePage() throws {
        let page = try decode(ArchivePage.self, #"{"tiles":[{"question_id":"q1","question_text":"?","verdict_text":"the world said — X","top_clusters":["a","b"],"created_at":"2026-05-08T00:00:00.000Z"}],"next_cursor":"2026-05-07T00:00:00.000Z"}"#)
        XCTAssertEqual(page.nextCursor, "2026-05-07T00:00:00.000Z")
        XCTAssertEqual(page.tiles.count, 1)
        XCTAssertEqual(page.tiles[0].questionId, "q1")
        XCTAssertEqual(page.tiles[0].topClusters, ["a", "b"])
        XCTAssertEqual(page.tiles[0].createdAt, "2026-05-08T00:00:00.000Z")

        let empty = try decode(ArchivePage.self, #"{"tiles":[],"next_cursor":null}"#)
        XCTAssertNil(empty.nextCursor)
    }

    func testDecodeArchiveDetail() throws {
        let detail = try decode(ArchiveDetail.self, #"{"id":"q1","text":"?","created_at":"x","top_clusters":[{"id":"c1","canonical_text":"AI","submission_count":10,"final_rank":1,"final_pct_of_total":0.5}]}"#)
        XCTAssertEqual(detail.id, "q1")
        XCTAssertEqual(detail.createdAt, "x")
        XCTAssertEqual(detail.topClusters[0].canonicalText, "AI")
        XCTAssertEqual(detail.topClusters[0].finalPctOfTotal, 0.5, accuracy: 1e-9)
    }

    func testDecodeShareTrackResponse() throws {
        let r = try decode(ShareTrackResponse.self, #"{"referral_code":"r1"}"#)
        XCTAssertEqual(r.referralCode, "r1")
    }

    func testDecodeFriendMutationResponse() throws {
        let r = try decode(FriendMutationResponse.self, #"{"id":"fid","status":"pending"}"#)
        XCTAssertEqual(r, FriendMutationResponse(id: "fid", status: "pending"))
    }

    func testEncodeSubmitRequestSnakeCase() throws {
        let json = try encodeSorted(SubmitRequest(questionId: "q1", deviceToken: "d1", rawText: " hi ", dwellMs: 3200))
        XCTAssertEqual(json, #"{"device_token":"d1","dwell_ms":3200,"question_id":"q1","raw_text":" hi "}"#)
    }

    func testEncodeDeviceRegisterPayload() throws {
        let json = try encodeSorted(DeviceRegisterPayload(deviceToken: "d1", fcmToken: "f1"))
        XCTAssertEqual(json, #"{"device_token":"d1","fcm_token":"f1"}"#)
    }

    func testEncodeShareTrackRequest() throws {
        let json = try encodeSorted(ShareTrackRequest(bannerType: .todaysTake, questionId: "q1", shareTarget: .system))
        XCTAssertEqual(json, #"{"banner_type":"todays_take","question_id":"q1","share_target":"system"}"#)
    }

    func testEncodeReportPayloadOmitsNils() throws {
        let json = try encodeSorted(ReportPayload(targetType: .user, targetId: "u1", reason: nil, deviceToken: nil))
        XCTAssertEqual(json, #"{"target_id":"u1","target_type":"user"}"#)
    }

    func testEnumRawValues() {
        XCTAssertEqual(LeaderboardPeriod.daily.rawValue, "daily")
        XCTAssertEqual(LeaderboardPeriod.weekly.rawValue, "weekly")
        XCTAssertEqual(LeaderboardPeriod.alltime.rawValue, "alltime")
        XCTAssertEqual(LeaderboardScope.global.rawValue, "global")
        XCTAssertEqual(LeaderboardScope.friends.rawValue, "friends")
        XCTAssertEqual(BannerType.todaysTake.rawValue, "todays_take")
        XCTAssertEqual(BannerType.verdict.rawValue, "verdict")
        XCTAssertEqual(BannerType.calledIt.rawValue, "called_it")
        XCTAssertEqual(ShareTarget.igStory.rawValue, "ig_story")
        XCTAssertEqual(ShareTarget.tiktok.rawValue, "tiktok")
        XCTAssertEqual(ShareTarget.snap.rawValue, "snap")
        XCTAssertEqual(ShareTarget.imessage.rawValue, "imessage")
        XCTAssertEqual(ShareTarget.system.rawValue, "system")
    }
}
