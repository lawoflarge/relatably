import XCTest
@testable import Relatably

/// Fixtures ported verbatim from ios/src/lib/{clusterSizeBucket,stickerRotation,wordcloudLayout}.ts
/// (+ their Jest suites) via docs/superpowers/plans/rn-extraction/wordcloud.md §4 + §8.
///
/// Every expected hash / rotation / x / y below was computed by EXECUTING the actual JS
/// (Node, same semantics as Hermes) — not re-derived by hand. The Swift port must be
/// numerically identical; visual parity of the wordcloud depends on it.
final class WordcloudMathTests: XCTestCase {

    // MARK: - sizeBucket (§8 table)

    func testSizeBucketVectors() {
        XCTAssertEqual(sizeBucket(count: 3204, maxCount: 3204), .xl) // r = 1.0
        XCTAssertEqual(sizeBucket(count: 2723, maxCount: 3204), .xl) // r ≈ 0.8499 ≥ 0.84 (code says 0.84, not the test title's 0.85)
        XCTAssertEqual(sizeBucket(count: 1892, maxCount: 3204), .l)  // r ≈ 0.590
        XCTAssertEqual(sizeBucket(count: 987, maxCount: 3204), .m)   // r ≈ 0.308
        XCTAssertEqual(sizeBucket(count: 389, maxCount: 3204), .s)   // r ≈ 0.121
        XCTAssertEqual(sizeBucket(count: 18, maxCount: 3204), .xs)   // r ≈ 0.0056
        XCTAssertEqual(sizeBucket(count: 0, maxCount: 0), .xs)       // degenerate guard
    }

    func testSizeBucketThresholdEdges() {
        // Exactly AT each threshold → the ≥ comparison includes it (upper bucket).
        XCTAssertEqual(sizeBucket(count: 84, maxCount: 100), .xl) // r == 0.84
        XCTAssertEqual(sizeBucket(count: 40, maxCount: 100), .l)  // r == 0.40
        XCTAssertEqual(sizeBucket(count: 20, maxCount: 100), .m)  // r == 0.20
        XCTAssertEqual(sizeBucket(count: 8, maxCount: 100), .s)   // r == 0.08
        // Just BELOW each threshold → lower bucket.
        XCTAssertEqual(sizeBucket(count: 839, maxCount: 1000), .l) // r = 0.839 < 0.84
        XCTAssertEqual(sizeBucket(count: 399, maxCount: 1000), .m) // r = 0.399 < 0.40
        XCTAssertEqual(sizeBucket(count: 199, maxCount: 1000), .s) // r = 0.199 < 0.20
        XCTAssertEqual(sizeBucket(count: 79, maxCount: 1000), .xs) // r = 0.079 < 0.08
    }

    func testSizeBucketDegenerateGuards() {
        XCTAssertEqual(sizeBucket(count: 5, maxCount: -3), .xs) // maxCount <= 0
        XCTAssertEqual(sizeBucket(count: 0, maxCount: 10), .xs) // r = 0
    }

    func testFontPx() {
        // clusterSizePx: xl→44, l→30, m→22, s→16, xs→13.
        XCTAssertEqual(SizeBucket.xl.fontPx, 44)
        XCTAssertEqual(SizeBucket.l.fontPx, 30)
        XCTAssertEqual(SizeBucket.m.fontPx, 22)
        XCTAssertEqual(SizeBucket.s.fontPx, 16)
        XCTAssertEqual(SizeBucket.xs.fontPx, 13)
    }

    // MARK: - FNV-1a hash (§8 hash column)

    func testHashVectors() {
        let vectors: [(id: String, hash: UInt32)] = [
            ("c_ai", 1673859815),
            ("c_tiktok", 277938010),
            ("c_x", 35367296),
            ("c_y", 18589676),
            ("c_z", 68922532),
            ("abc", 440920332),
            ("long-id-with-stuff", 3590953712),
            ("demo-cl-1", 2263043099),
            ("demo-cl-2", 2279820718),
            ("demo-cl-3", 2296598337),
        ]
        for v in vectors {
            XCTAssertEqual(fnv1aHashJS(v.id), v.hash, "hash of \(v.id)")
        }
    }

    func testHashUsesJSFloat64MultiplyNotWrappingMultiply() {
        // JS multiplies in Float64 (low bits lost above 2^53) before `>>> 0`; a UInt32
        // `&*` port diverges on essentially EVERY id. Canary: "abc" — exact 32-bit
        // wrapping FNV-1a gives 440920331, the shipped JS gives 440920332.
        XCTAssertEqual(fnv1aHashJS("abc"), 440920332)
        XCTAssertNotEqual(fnv1aHashJS("abc"), 440920331)
    }

    func testHashUsesUTF16CodeUnits() {
        // JS charCodeAt = UTF-16 code unit (surrogate pairs count as 2 units).
        // Values computed by executing the JS hash on these ids.
        XCTAssertEqual(fnv1aHashJS("café"), 818999275)
        XCTAssertEqual(fnv1aHashJS("café🙂"), 815979744)
        XCTAssertEqual(fnv1aHashJS("über-id"), 137782036)
    }

    // MARK: - stickerRotation (§8 rotation column)

    func testRotationVectors() {
        let vectors: [(id: String, rotation: Double)] = [
            ("c_ai", -2.04),
            ("c_tiktok", -3.82),
            ("c_x", -0.99),
            ("c_y", 2.25),
            ("c_z", 0.51),
            ("abc", 1.0),
            ("long-id-with-stuff", -0.28),
            ("demo-cl-1", 1.45),
            ("demo-cl-2", -1.79),
            ("demo-cl-3", 2.96),
        ]
        for v in vectors {
            XCTAssertEqual(stickerRotation(id: v.id), v.rotation, accuracy: 1e-12, "rotation of \(v.id)")
        }
    }

    func testRotationCustomRange() {
        // §8: c_ai with range 1.5 → −0.77.
        XCTAssertEqual(stickerRotation(id: "c_ai", range: 1.5), -0.77, accuracy: 1e-12)
    }

    func testRotationNonASCIIVectors() {
        // JS-computed, exercises the UTF-16 path end to end.
        XCTAssertEqual(stickerRotation(id: "café"), 1.91, accuracy: 1e-12)
        XCTAssertEqual(stickerRotation(id: "café🙂"), 2.52, accuracy: 1e-12)
        XCTAssertEqual(stickerRotation(id: "über-id"), 2.61, accuracy: 1e-12)
    }

    func testRotationDeterministicForSameId() {
        XCTAssertEqual(stickerRotation(id: "c_ai"), stickerRotation(id: "c_ai"))
    }

    func testRotationDiffersForDifferentIds() {
        XCTAssertNotEqual(stickerRotation(id: "c_ai"), stickerRotation(id: "c_tiktok"))
    }

    func testRotationStaysInsideSpecRange() {
        for id in ["c_ai", "c_tiktok", "c_x", "c_y", "c_z", "abc", "long-id-with-stuff"] {
            let r = stickerRotation(id: id)
            XCTAssertGreaterThanOrEqual(r, -4, "rotation of \(id)")
            XCTAssertLessThanOrEqual(r, 4, "rotation of \(id)")
        }
        let custom = stickerRotation(id: "c_ai", range: 1.5)
        XCTAssertGreaterThanOrEqual(custom, -1.5)
        XCTAssertLessThanOrEqual(custom, 1.5)
    }

    func testRotationHasTwoDecimalPrecision() {
        // Math.round(angle * 100) / 100 → value×100 is integral.
        for id in ["c_ai", "c_tiktok", "demo-cl-1", "demo-cl-2", "demo-cl-3"] {
            let scaled = stickerRotation(id: id) * 100
            XCTAssertEqual(scaled, scaled.rounded(), accuracy: 1e-9, "rotation of \(id) not 2-decimal")
        }
    }

    // MARK: - wordcloudLayout (§8 fixture: canvas 350×600, step = 350·0.08 = 28)

    private let fixture: [WordcloudCluster] = [
        WordcloudCluster(id: "c_ai", text: "AI", count: 3204),
        WordcloudCluster(id: "c_tiktok", text: "tiktok", count: 1892),
        WordcloudCluster(id: "c_x", text: "x", count: 100),
    ]

    func testLayoutFixtureExact() {
        let out = wordcloudLayout(clusters: fixture, width: 350, height: 600)
        XCTAssertEqual(out.count, 3)
        // Output is in count-desc order; x/y are Math.round'ed (exact JS values).
        XCTAssertEqual(out[0], PlacedCluster(id: "c_ai", x: 175, y: 300, bucket: .xl))
        XCTAssertEqual(out[1], PlacedCluster(id: "c_tiktok", x: 154, y: 319, bucket: .l))
        XCTAssertEqual(out[2], PlacedCluster(id: "c_x", x: 178, y: 261, bucket: .xs)) // 100/3204 ≈ 0.031 → xs
    }

    func testLayoutReturnsOnePlacementPerCluster() {
        let out = wordcloudLayout(clusters: fixture, width: 350, height: 600)
        XCTAssertEqual(out.count, 3)
        XCTAssertEqual(out.map(\.id).sorted(), ["c_ai", "c_tiktok", "c_x"])
    }

    func testLayoutPlacesHighestCountNearCenter() {
        let out = wordcloudLayout(clusters: fixture, width: 350, height: 600)
        guard let top = out.first(where: { $0.id == "c_ai" }) else {
            return XCTFail("c_ai missing from layout")
        }
        XCTAssertLessThan(abs(top.x - 175), 60)
        XCTAssertLessThan(abs(top.y - 300), 120)
    }

    func testLayoutEmitsBucketAlongsidePlacement() {
        let out = wordcloudLayout(clusters: fixture, width: 350, height: 600)
        XCTAssertEqual(out.first(where: { $0.id == "c_ai" })?.bucket, .xl)
    }

    func testLayoutIsDeterministicAcrossRuns() {
        let a = wordcloudLayout(clusters: fixture, width: 350, height: 600)
        let b = wordcloudLayout(clusters: fixture, width: 350, height: 600)
        XCTAssertEqual(a, b)
    }

    func testLayoutSortIsStableOnCountTies() {
        // JS Array.prototype.sort is stable: equal counts keep input order.
        // JS-computed fixture (canvas 400×400, step 32): t_c first (count 9), then
        // t_a, t_b, t_d in ORIGINAL order despite equal counts.
        let ties: [WordcloudCluster] = [
            WordcloudCluster(id: "t_a", text: "a", count: 5),
            WordcloudCluster(id: "t_b", text: "b", count: 5),
            WordcloudCluster(id: "t_c", text: "c", count: 9),
            WordcloudCluster(id: "t_d", text: "d", count: 5),
        ]
        let out = wordcloudLayout(clusters: ties, width: 400, height: 400)
        XCTAssertEqual(out.count, 4)
        XCTAssertEqual(out[0], PlacedCluster(id: "t_c", x: 200, y: 200, bucket: .xl))
        XCTAssertEqual(out[1], PlacedCluster(id: "t_a", x: 176, y: 222, bucket: .l))
        XCTAssertEqual(out[2], PlacedCluster(id: "t_b", x: 204, y: 155, bucket: .l))
        XCTAssertEqual(out[3], PlacedCluster(id: "t_d", x: 234, y: 244, bucket: .l))
    }

    func testLayoutHonorsCustomStep() {
        // JS-computed: FIXTURE on 200×200 with explicit step 10.
        let out = wordcloudLayout(clusters: fixture, width: 200, height: 200, step: 10)
        XCTAssertEqual(out.count, 3)
        XCTAssertEqual(out[0], PlacedCluster(id: "c_ai", x: 100, y: 100, bucket: .xl))
        XCTAssertEqual(out[1], PlacedCluster(id: "c_tiktok", x: 93, y: 107, bucket: .l))
        XCTAssertEqual(out[2], PlacedCluster(id: "c_x", x: 101, y: 86, bucket: .xs))
    }

    func testLayoutEmptyInput() {
        XCTAssertEqual(wordcloudLayout(clusters: [], width: 350, height: 600), [])
    }

    func testLayoutAcceptsDemoClustersTrivially() {
        // DemoCluster {id, canonicalText, submissionCount} must map 1:1 into the input type.
        let clusters = DEMO_CLUSTERS.map {
            WordcloudCluster(id: $0.id, text: $0.canonicalText, count: $0.submissionCount)
        }
        let out = wordcloudLayout(clusters: clusters, width: 350, height: 560)
        XCTAssertEqual(out.count, 10)
        XCTAssertEqual(out.map(\.id).sorted(), DEMO_CLUSTERS.map(\.id).sorted())
        // Highest count (demo-cl-1, 47) sits exactly at the canvas center (i = 0 → r = 0).
        XCTAssertEqual(out[0], PlacedCluster(id: "demo-cl-1", x: 175, y: 280, bucket: .xl))
    }
}
