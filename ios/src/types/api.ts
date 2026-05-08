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
