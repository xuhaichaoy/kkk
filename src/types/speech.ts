export type SpeechLanguage = 'en' | 'zh';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface SpeechSession {
  id: string;
  title: string;
  language: SpeechLanguage;
  transcript: string;
  segments: TranscriptSegment[];
  audio_path: string;
  created_at: string;
}

export interface ModelStatusResponse {
  ready: boolean;
  downloaded: boolean;
  model_path?: string | null;
}

export interface ModelDownloadProgress {
  downloaded_bytes: number;
  total_bytes: number | null;
}

export interface ModelStatusEvent {
  status: 'exists' | 'downloading' | 'finished' | 'failed';
  model_path?: string | null;
  message?: string | null;
}

export interface TranscribeAudioResponse {
  session: SpeechSession;
}
