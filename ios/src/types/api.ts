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
