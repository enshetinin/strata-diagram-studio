// Minimal typing for the troika API used directly (drei wraps the rest).
declare module 'troika-three-text' {
  export function preloadFont(options: { font?: string; characters?: string | string[] }, callback: () => void): void;
}
