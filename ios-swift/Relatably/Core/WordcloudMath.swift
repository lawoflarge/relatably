import Foundation

// Wordcloud math — port of ios/src/lib/{clusterSizeBucket,stickerRotation,wordcloudLayout}.ts
// per docs/superpowers/plans/rn-extraction/wordcloud.md §4.
//
// Every function here must stay NUMERICALLY IDENTICAL to the shipped JS — these values
// drive the position, size and tilt of every bubble in the wordcloud, and the SwiftUI
// rebuild must be 1:1 with the RN app. Verified against §8 fixtures computed by
// executing the actual JS.

// MARK: - clusterSizeBucket.ts

/// Font-size bucket for a cluster bubble (`ClusterSize` in the TS).
enum SizeBucket: String, Equatable {
    case xs, s, m, l, xl

    /// clusterSizePx — bubble font size in points (`FONT_PX` in the TS).
    var fontPx: Double {
        switch self {
        case .xl: return 44
        case .l: return 30
        case .m: return 22
        case .s: return 16
        case .xs: return 13
        }
    }
}

func sizeBucket(count: Int, maxCount: Int) -> SizeBucket {
    if maxCount <= 0 { return .xs }
    let r = Double(count) / Double(maxCount)
    if r >= 0.84 { return .xl }
    if r >= 0.40 { return .l }
    if r >= 0.20 { return .m }
    if r >= 0.08 { return .s }
    return .xs
}

// MARK: - stickerRotation.ts

/// JS `Math.round`: nearest integer, exact halves toward +∞
/// (Swift's `.toNearestOrAwayFromZero` differs at negative .5 — e.g. −2.5 → JS −2, Swift −3).
private func jsMathRound(_ x: Double) -> Double {
    let f = x.rounded(.down)
    return (x - f) >= 0.5 ? f + 1 : f
}

/// The RN `hashStr` — FNV-1a-ish, but with EXACT JS number semantics:
/// - iterates UTF-16 code units (`charCodeAt`; surrogate pairs = 2 units)
/// - `h ^= c` coerces via ToInt32 (low 32 bits, signed)
/// - `h * 16777619` is a Float64 multiply — products exceed 2^53, so low bits are
///   ROUNDED AWAY. A wrapping-integer port (`&*` on UInt32) diverges on essentially
///   every id (canary: "abc" → 440920332 JS vs 440920331 exact-u32). Do not "fix" this.
/// - `>>> 0` is ToUint32 (mathematical mod 2^32 into [0, 2^32))
func fnv1aHashJS(_ s: String) -> UInt32 {
    var h: UInt32 = 2166136261
    for unit in s.utf16 {
        let i32 = Int32(bitPattern: h) ^ Int32(unit)           // h ^= s.charCodeAt(i)  (ToInt32)
        let product = Double(i32) * 16777619.0                 // Float64 multiply, may round
        let mod = product.truncatingRemainder(dividingBy: 4294967296.0)
        h = UInt32(mod < 0 ? mod + 4294967296.0 : mod)         // >>> 0  (ToUint32)
    }
    return h
}

/// Deterministic sticker tilt in degrees for an id; default range 4 → [−4, +4],
/// rounded to 2 decimals exactly like `Math.round(angle * 100) / 100`.
func stickerRotation(id: String, range: Double = 4) -> Double {
    let h = fnv1aHashJS(id)
    let t = Double(h % 10001) / 10000  // 0..1
    let angle = (t * 2 - 1) * range    // -range..+range
    return jsMathRound(angle * 100) / 100
}

// MARK: - wordcloudLayout.ts

/// Layout input (`Cluster` in the TS): id / text / count.
/// DemoCluster and Firestore clusters map in 1:1
/// (`id`, `canonical_text` → text, `submission_count` → count).
struct WordcloudCluster: Equatable {
    let id: String
    let text: String
    let count: Int
}

/// Layout output (`Placement` in the TS): Math.round'ed canvas coords + bucket.
struct PlacedCluster: Equatable {
    let id: String
    let x: Double
    let y: Double
    let bucket: SizeBucket
}

/// Golden angle: `Math.PI * (3 - Math.sqrt(5))` ≈ 2.399963229728653 rad.
private let PHI = Double.pi * (3 - 5.0.squareRoot())

/// Phyllotaxis (sunflower) layout: highest count at the exact canvas center (i = 0 → r = 0),
/// spiraling outward by `r = step·√i`, `θ = i·PHI`. No collision avoidance — overlap is
/// the shipped look. Output is in count-desc order.
func wordcloudLayout(clusters: [WordcloudCluster], width: Double, height: Double, step: Double? = nil) -> [PlacedCluster] {
    let step = step ?? min(width, height) * 0.08
    let cx = width / 2
    let cy = height / 2
    let maxCount = clusters.reduce(0) { Swift.max($0, $1.count) }

    // Sort by count desc — JS Array.prototype.sort is STABLE: ties keep input order.
    // Tie-break on the original index explicitly so we don't rely on stdlib sort stability.
    let sorted = clusters.enumerated()
        .sorted { a, b in
            if a.element.count != b.element.count { return a.element.count > b.element.count }
            return a.offset < b.offset
        }
        .map(\.element)

    return sorted.enumerated().map { i, c in
        let r = step * Double(i).squareRoot()
        let theta = Double(i) * PHI
        let x = cx + r * cos(theta)
        let y = cy + r * sin(theta)
        return PlacedCluster(
            id: c.id,
            x: jsMathRound(x),
            y: jsMathRound(y),
            bucket: sizeBucket(count: c.count, maxCount: maxCount)
        )
    }
}
