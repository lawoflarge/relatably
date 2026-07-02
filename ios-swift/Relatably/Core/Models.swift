import Foundation

// Wire types ported verbatim from docs/superpowers/plans/rn-extraction/core-libs.md §2
// (src/types/api.ts) + §1.4 (ReportPayload). Wire format is snake_case; explicit
// CodingKeys everywhere. Optionality exactly as speced: `daily_rank` optional;
// `handle`, `self_cluster_id`, `next_cursor` nullable.

// MARK: - Questions

struct TodayQuestion: Codable, Equatable {
    let id: String
    let text: String

    enum CodingKeys: String, CodingKey {
        case id
        case text
    }
}

struct SubmitRequest: Codable, Equatable {
    let questionId: String
    let deviceToken: String
    let rawText: String
    let dwellMs: Int

    enum CodingKeys: String, CodingKey {
        case questionId = "question_id"
        case deviceToken = "device_token"
        case rawText = "raw_text"
        case dwellMs = "dwell_ms"
    }
}

struct SubmitResponse: Codable, Equatable {
    let clusterId: String
    let submissionCount: Int
    let normalizedText: String
    let submissionId: String

    enum CodingKeys: String, CodingKey {
        case clusterId = "cluster_id"
        case submissionCount = "submission_count"
        case normalizedText = "normalized_text"
        case submissionId = "submission_id"
    }
}

// MARK: - Devices

struct DeviceRegisterPayload: Codable, Equatable {
    let deviceToken: String
    let fcmToken: String

    enum CodingKeys: String, CodingKey {
        case deviceToken = "device_token"
        case fcmToken = "fcm_token"
    }
}

// MARK: - Yesterday

struct YesterdayCluster: Codable, Equatable {
    let id: String
    let canonicalText: String
    let submissionCount: Int
    let finalRank: Int
    let finalPctOfTotal: Double

    enum CodingKeys: String, CodingKey {
        case id
        case canonicalText = "canonical_text"
        case submissionCount = "submission_count"
        case finalRank = "final_rank"
        case finalPctOfTotal = "final_pct_of_total"
    }
}

struct Yesterday: Codable, Equatable {
    let id: String
    let text: String
    let topClusters: [YesterdayCluster]
    let selfClusterId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case topClusters = "top_clusters"
        case selfClusterId = "self_cluster_id"
    }
}

// MARK: - Auth

struct AuthMeResponse: Codable, Equatable {
    let uid: String
    let handle: String?
    let isPublic: Bool
    let locale: String
    let shadowbanned: Bool

    enum CodingKeys: String, CodingKey {
        case uid
        case handle
        case isPublic = "is_public"
        case locale
        case shadowbanned
    }
}

// MARK: - Friends

struct Friendship: Codable, Equatable {
    enum Status: String, Codable, Equatable {
        case pending
        case accepted
    }

    enum Direction: String, Codable, Equatable {
        case incoming
        case outgoing
    }

    let id: String
    let friendUserId: String
    let handle: String?
    let locale: String
    let status: Status
    let direction: Direction

    enum CodingKeys: String, CodingKey {
        case id
        case friendUserId = "friend_user_id"
        case handle
        case locale
        case status
        case direction
    }
}

/// Response of `requestFriend` / `acceptFriend` (`{ id, status }` inline in api.ts).
struct FriendMutationResponse: Codable, Equatable {
    let id: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case status
    }
}

/// Response of `fetchFriends` (`{ friendships }` inline in api.ts).
struct FriendsResponse: Codable, Equatable {
    let friendships: [Friendship]

    enum CodingKeys: String, CodingKey {
        case friendships
    }
}

// MARK: - Leaderboard

struct LeaderboardEntry: Codable, Equatable {
    let userId: String
    let handle: String?
    let score: Int
    let dailyRank: Int?
    let locale: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case handle
        case score
        case dailyRank = "daily_rank"
        case locale
    }
}

/// Response of `fetchLeaderboard` (`{ entries }` inline in api.ts).
struct LeaderboardResponse: Codable, Equatable {
    let entries: [LeaderboardEntry]

    enum CodingKeys: String, CodingKey {
        case entries
    }
}

enum LeaderboardPeriod: String, Codable, Equatable {
    case daily
    case weekly
    case alltime
}

enum LeaderboardScope: String, Codable, Equatable {
    case global
    case friends
}

// MARK: - Share

enum BannerType: String, Codable, Equatable {
    case todaysTake = "todays_take"
    case verdict
    case calledIt = "called_it"
}

enum ShareTarget: String, Codable, Equatable {
    case igStory = "ig_story"
    case tiktok
    case snap
    case imessage
    case system
}

struct ShareTrackRequest: Codable, Equatable {
    let bannerType: BannerType
    let questionId: String
    let shareTarget: ShareTarget

    enum CodingKeys: String, CodingKey {
        case bannerType = "banner_type"
        case questionId = "question_id"
        case shareTarget = "share_target"
    }
}

struct ShareTrackResponse: Codable, Equatable {
    let referralCode: String

    enum CodingKeys: String, CodingKey {
        case referralCode = "referral_code"
    }
}

// MARK: - Archive

struct ArchiveTile: Codable, Equatable {
    let questionId: String
    let questionText: String
    let verdictText: String
    let topClusters: [String]
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case questionId = "question_id"
        case questionText = "question_text"
        case verdictText = "verdict_text"
        case topClusters = "top_clusters"
        case createdAt = "created_at"
    }
}

struct ArchivePage: Codable, Equatable {
    let tiles: [ArchiveTile]
    let nextCursor: String?

    enum CodingKeys: String, CodingKey {
        case tiles
        case nextCursor = "next_cursor"
    }
}

struct ArchiveDetailCluster: Codable, Equatable {
    let id: String
    let canonicalText: String
    let submissionCount: Int
    let finalRank: Int
    let finalPctOfTotal: Double

    enum CodingKeys: String, CodingKey {
        case id
        case canonicalText = "canonical_text"
        case submissionCount = "submission_count"
        case finalRank = "final_rank"
        case finalPctOfTotal = "final_pct_of_total"
    }
}

struct ArchiveDetail: Codable, Equatable {
    let id: String
    let text: String
    let createdAt: String
    let topClusters: [ArchiveDetailCluster]

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case createdAt = "created_at"
        case topClusters = "top_clusters"
    }
}

// MARK: - Report (core-libs.md §1.4 — defined in api.ts, not types/api.ts)

struct ReportPayload: Codable, Equatable {
    enum TargetType: String, Codable, Equatable {
        case cluster
        case submission
        case user
    }

    let targetType: TargetType
    let targetId: String
    let reason: String?
    let deviceToken: String?

    enum CodingKeys: String, CodingKey {
        case targetType = "target_type"
        case targetId = "target_id"
        case reason
        case deviceToken = "device_token"
    }
}
