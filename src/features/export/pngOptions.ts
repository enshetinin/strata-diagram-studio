/** PNG export formats and options; dependency-free so preferences can store them. */
export const PNG_FORMATS = {
  hd: { label: '16:9 · Full HD', width: 1920, height: 1080 },
  '4k': { label: '16:9 · 4K', width: 3840, height: 2160 },
  square: { label: '1:1 · Cuadrado', width: 1080, height: 1080 },
  portrait: { label: '4:5 · Vertical', width: 1080, height: 1350 },
} as const;

export type PngFormat = keyof typeof PNG_FORMATS;
export const PNG_FORMAT_IDS = Object.keys(PNG_FORMATS) as PngFormat[];

export interface PngComposeOptions {
  format: PngFormat;
  title: boolean;
  legend: boolean;
  transparent: boolean;
}

export const DEFAULT_PNG_OPTIONS: PngComposeOptions = { format: 'hd', title: true, legend: true, transparent: false };
