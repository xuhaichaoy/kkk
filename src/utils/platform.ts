const detectPlatform = (): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.TAURI_PLATFORM;
  }
  return undefined;
};

export const TAURI_PLATFORM = detectPlatform();
export const IS_WINDOWS = TAURI_PLATFORM === 'windows';
export const SPEECH_SUPPORTED = !IS_WINDOWS;
