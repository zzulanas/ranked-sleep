// Terra webhook payload types
// Based on Terra API v2 documentation: https://docs.tryterra.co/reference/data-models

export interface TerraUser {
  user_id: string;
  provider: string;
  last_webhook_update: string;
}

export interface TerraSleepDurationsData {
  sleep_efficiency?: number; // 0.0 - 1.0
  asleep?: {
    duration_asleep_state_seconds?: number;
    num_REM_events?: number;
    duration_REM_sleep_state_seconds?: number;
    duration_light_sleep_state_seconds?: number;
    duration_deep_sleep_state_seconds?: number;
    duration_unmeasurable_sleep_seconds?: number;
  };
  awake?: {
    duration_awake_state_seconds?: number;
    duration_short_interruption_seconds?: number;
    duration_long_interruption_seconds?: number;
    num_wakeup_events?: number;
    wake_up_latency_seconds?: number;
    num_out_of_bed_events?: number;
    sleep_latency_seconds?: number;
  };
  hypnogram_samples?: Array<{
    level: number;
    timestamp: string;
  }>;
}

export interface TerraHeartRateData {
  summary?: {
    avg_hr_bpm?: number;
    min_hr_bpm?: number;
    max_hr_bpm?: number;
    avg_hrv_rmssd?: number;  // HRV - root mean square of successive differences
    avg_hrv_sdnn?: number;   // HRV - standard deviation of NN intervals
  };
  hr_samples?: Array<{
    bpm: number;
    timestamp: string;
  }>;
  hrv?: {
    summary?: {
      avg_sdnn?: number;
      avg_rmssd?: number;
    };
    rmssd_samples?: Array<{
      hrv: number;
      timestamp: string;
    }>;
    sdnn_samples?: Array<{
      hrv: number;
      timestamp: string;
    }>;
  };
}

export interface TerraSleepMetadata {
  start_time: string;      // bedtime (ISO 8601)
  end_time: string;        // wake time (ISO 8601)
  upload_type?: number;
  is_nap?: boolean;
}

export interface TerraSleepData {
  metadata: TerraSleepMetadata;
  sleep_durations_data?: TerraSleepDurationsData;
  heart_rate_data?: TerraHeartRateData;
  temperature_data?: unknown;
  readiness_data?: unknown;
  respiration_data?: unknown;
}

export interface TerraWebhookPayload {
  op: number;
  type: 'SLEEP' | 'DAILY' | 'BODY' | 'ACTIVITY' | 'NUTRITION' | 'MENSTRUATION' | 'USER_AUTH' | 'AUTH' | 'DEAUTH' | 'CONNECTION_ERROR' | 'GOOGLE_NO_DATASOURCE' | 'REQUEST_COMPLETED';
  user: TerraUser;
  data?: TerraSleepData[];
  reference_id?: string;
  message?: string;
  old_user?: TerraUser;
  new_user?: TerraUser;
}

// Extracted flat sleep fields for scoring
export interface ExtractedSleepFields {
  durationSeconds: number | null;
  efficiency: number | null;         // 0.0 - 1.0
  deepSleepSeconds: number | null;
  remSleepSeconds: number | null;
  totalSleepSeconds: number | null;  // for calculating percentages
  hrvAvg: number | null;             // milliseconds
  bedtime: string | null;            // ISO 8601
  wakeTime: string | null;           // ISO 8601
}
