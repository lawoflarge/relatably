export interface TodayQuestion {
  id: string;
  text: string;
}

export interface SubmitRequest {
  question_id: string;
  device_token: string;
  raw_text: string;
  dwell_ms: number;
}

export interface SubmitResponse {
  cluster_id: string;
  submission_count: number;
  normalized_text: string;
}

export interface DeviceRegisterPayload {
  device_token: string;
  fcm_token: string;
}

export interface YesterdayCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;
}

export interface Yesterday {
  id: string;
  text: string;
  top_clusters: YesterdayCluster[];
  self_cluster_id: string | null;
}

export interface AuthMeResponse {
  uid: string;
  handle: string | null;
  is_public: boolean;
  locale: string;
  shadowbanned: boolean;
}

export interface Friendship {
  id: string;
  friend_user_id: string;
  handle: string | null;
  locale: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
}

export interface LeaderboardEntry {
  user_id: string;
  handle: string | null;
  score: number;
  daily_rank?: number;
  locale: string;
}

export type LeaderboardPeriod = "daily" | "weekly" | "alltime";
export type LeaderboardScope = "global" | "friends";

export type BannerType = "todays_take" | "verdict" | "called_it";
export type ShareTarget = "ig_story" | "tiktok" | "snap" | "imessage" | "system";

export interface ShareTrackRequest {
  banner_type: BannerType;
  question_id: string;
  share_target: ShareTarget;
}

export interface ShareTrackResponse {
  referral_code: string;
}

export interface ArchiveTile {
  question_id: string;
  question_text: string;
  verdict_text: string;
  top_clusters: string[];
  created_at: string;
}

export interface ArchivePage {
  tiles: ArchiveTile[];
  next_cursor: string | null;
}

export interface ArchiveDetailCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;
}

export interface ArchiveDetail {
  id: string;
  text: string;
  created_at: string;
  top_clusters: ArchiveDetailCluster[];
}
