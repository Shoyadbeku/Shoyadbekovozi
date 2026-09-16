export type VoiceMood = 'Neutral' | 'Cheerful' | 'Happy' | 'Sad';

export interface TTSRequest {
  text: string;
  mood: VoiceMood;
  speed: number;
  applyRvc?: boolean;
  rvcUrl?: string;
}

export interface TTSResponse {
  success?: boolean;
  id?: string;
  audioUrl?: string;
  audioBase64?: string;
  cdnUrl?: string;
  sizeBytes?: number;
  rvcApplied?: boolean;
  aishaAudioId?: string;
  error?: string;
  code?: string;
}

export interface ServerConfig {
  hasAishaKey: boolean;
  model: string;
  rvcModel: string;
  rvcIndex: string;
  hasIndexFile: boolean;
  rvcServerUrl: string;
  driveFileId: string;
  supportedMoods: VoiceMood[];
}

export interface RvcStatus {
  online: boolean;
  url: string;
  info?: {
    status?: string;
    service?: string;
    model?: string;
    has_model_file?: boolean;
    has_index_file?: boolean;
  };
  error?: string;
}

