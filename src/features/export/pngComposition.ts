/**
 * Composes the exported image: the 3D frame plus the editorial overlays the
 * live view draws in the DOM (style eyebrow, title, description, legend).
 *
 * Wide formats get an asymmetric grid — a text column on the left, a hairline
 * rule, the scene on the right. Square and portrait formats stack title,
 * scene and legend. Every measure derives from one unit `u` (1 at 1080 px),
 * so a 4K export or a small preview keeps the same proportions.
 */
import { KIND_INFO, RELATION_INFO } from '../../domain/catalog';
import type { DiagramDocument, NodeKind, RelationKind } from '../../domain/types';
import { KIND_GLYPH, RELATION_STROKE } from '../editor2d/visual';
import { resolveTheme } from '../viewer3d/themes';
import { PNG_FORMATS, type PngComposeOptions } from './pngOptions';
import type { PngExportOptions } from './pngRegistry';

/** Mirrors the `--o-*` overlay tokens in viewer.css. */
const PALETTE = {
  light: { fg: '#0a0a0b', muted: '#5f5f66', rule: 'rgb(10 10 11 / 0.14)', signal: '#1d5bd8' },
  dark: { fg: '#f2f2f3', muted: '#a3a3aa', rule: 'rgb(242 242 243 / 0.2)', signal: '#7fa8ff' },
} as const;

type Palette = (typeof PALETTE)[keyof typeof PALETTE];

const FONT = "'Figtree', 'Helvetica Neue', Arial, sans-serif";

export type SceneRenderer = (options: PngExportOptions) => Promise<HTMLCanvasElement>;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`;
}

async function loadFonts(u: number): Promise<void> {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(font(400, 20 * u)),
    document.fonts.load(font(500, 72 * u)),
    document.fonts.load(font(600, 16 * u)),
  ]);
}

/** Greedy word wrap; the last allowed line ends with an ellipsis when text remains. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let index = 0; index < words.length; index += 1) {
    const candidate = line ? `${line} ${words[index]}` : words[index]!;
    if (ctx.measureText(candidate).width <= width || !line) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = words[index]!;
    if (lines.length === maxLines) {
      line = '';
      break;
    }
  }
  if (line) lines.push(line);
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (lines.length > 0 && consumed < words.length) {
    let last = lines[lines.length - 1]!;
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.slice(0, maxLines);
}

/** Spaced caps: canvas letterSpacing where available. */
function setTracking(ctx: CanvasRenderingContext2D, em: number, size: number) {
  if ('letterSpacing' in ctx)
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${em * size}px`;
}

function eyebrow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, u: number, color: string): number {
  const size = 15 * u;
  ctx.font = font(600, size);
  setTracking(ctx, 0.14, size);
  ctx.fillStyle = color;
  ctx.fillText(text.toUpperCase(), x, y + size);
  setTracking(ctx, 0, size);
  return size * 1.3;
}

interface TitleLayout {
  draw(ctx: CanvasRenderingContext2D, x: number, y: number): void;
  height: number;
}

/** Eyebrow, oversized caps title with the signal cursor, optional description. */
function layoutTitle(
  ctx: CanvasRenderingContext2D,
  doc: DiagramDocument,
  styleName: string,
  width: number,
  u: number,
  palette: Palette,
  limits: { titleLines: number; titleSize: number; descriptionLines: number },
): TitleLayout {
  // Shrink the title until no single word overflows the measure.
  let size = limits.titleSize * u;
  const name = doc.name.toUpperCase();
  ctx.font = font(500, size);
  const longest = Math.max(...name.split(/\s+/).map((word) => ctx.measureText(`${word}_`).width));
  if (longest > width) size = Math.max(36 * u, (size * width) / longest);
  ctx.font = font(500, size);
  setTracking(ctx, 0.005, size);
  const titleLines = wrap(ctx, name, width, limits.titleLines);
  setTracking(ctx, 0, size);

  const descriptionSize = 20 * u;
  ctx.font = font(400, descriptionSize);
  const description =
    limits.descriptionLines > 0 && doc.description.trim()
      ? wrap(ctx, doc.description.trim(), width, limits.descriptionLines)
      : [];

  const eyebrowHeight = 15 * u * 1.3;
  const titleTop = eyebrowHeight + 20 * u;
  const titleHeight = titleLines.length * size;
  const descriptionTop = titleTop + titleHeight + 28 * u;
  const height =
    description.length > 0 ? descriptionTop + description.length * descriptionSize * 1.45 : titleTop + titleHeight;

  return {
    height,
    draw(context, x, y) {
      eyebrow(context, styleName, x, y, u, palette.muted);
      context.font = font(500, size);
      setTracking(context, 0.005, size);
      context.fillStyle = palette.fg;
      titleLines.forEach((line, index) => context.fillText(line, x, y + titleTop + (index + 1) * size * 0.86));
      const last = titleLines[titleLines.length - 1] ?? '';
      const cursorX = x + context.measureText(last).width + size * 0.06;
      context.fillStyle = palette.signal;
      context.fillText('_', cursorX, y + titleTop + titleLines.length * size * 0.86);
      setTracking(context, 0, size);
      context.font = font(400, descriptionSize);
      context.fillStyle = palette.muted;
      description.forEach((line, index) =>
        context.fillText(line, x, y + descriptionTop + descriptionSize + index * descriptionSize * 1.45),
      );
    },
  };
}

interface LegendItem {
  label: string;
  drawIcon(ctx: CanvasRenderingContext2D, x: number, centerY: number): void;
  iconWidth: number;
}

function legendItems(
  doc: DiagramDocument,
  u: number,
  palette: Palette,
): { kinds: LegendItem[]; relations: LegendItem[] } {
  const kinds = [...new Set(doc.nodes.map((node) => node.kind))] as NodeKind[];
  const relations = [...new Set(doc.edges.map((edge) => edge.relation))] as RelationKind[];
  const glyph = 22 * u;
  return {
    kinds: kinds.map((kind) => ({
      label: KIND_INFO[kind].label,
      iconWidth: glyph,
      drawIcon(ctx, x, centerY) {
        ctx.save();
        ctx.translate(x, centerY - glyph / 2);
        ctx.scale(glyph / 20, glyph / 20);
        ctx.strokeStyle = palette.fg;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(new Path2D(KIND_GLYPH[kind]));
        ctx.restore();
      },
    })),
    relations: relations.map((relation) => ({
      label: RELATION_INFO[relation].label,
      iconWidth: 34 * u,
      drawIcon(ctx, x, centerY) {
        const k = (34 * u) / 28;
        ctx.save();
        ctx.translate(x, centerY - 4 * k);
        ctx.scale(k, k);
        ctx.strokeStyle = palette.fg;
        ctx.fillStyle = palette.fg;
        ctx.lineWidth = 1.5;
        const dash = RELATION_STROKE[relation].dash;
        ctx.setLineDash(dash ? dash.split(/\s+/).map(Number) : []);
        ctx.beginPath();
        ctx.moveTo(1, 4);
        ctx.lineTo(21, 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fill(new Path2D('M20 1 27 4 20 7Z'));
        ctx.restore();
      },
    })),
  };
}

interface LegendLayout {
  draw(ctx: CanvasRenderingContext2D, x: number, y: number): void;
  height: number;
}

/**
 * Legend under a hairline rule. `columns` > 0 sets a fixed grid (side
 * column); 0 flows items in rows across the width (stacked layouts).
 */
function layoutLegend(
  ctx: CanvasRenderingContext2D,
  doc: DiagramDocument,
  width: number,
  u: number,
  palette: Palette,
  columns: number,
): LegendLayout {
  const { kinds, relations } = legendItems(doc, u, palette);
  const size = 17 * u;
  const row = 32 * u;
  const gapX = 28 * u;
  const iconGap = 10 * u;
  ctx.font = font(400, size);

  const place = (items: LegendItem[]) => {
    const positions: { item: LegendItem; x: number; row: number }[] = [];
    if (columns > 0) {
      const columnWidth = width / columns;
      items.forEach((item, index) =>
        positions.push({ item, x: (index % columns) * columnWidth, row: Math.floor(index / columns) }),
      );
    } else {
      let x = 0;
      let line = 0;
      for (const item of items) {
        const itemWidth = item.iconWidth + iconGap + ctx.measureText(item.label).width;
        if (x > 0 && x + itemWidth > width) {
          x = 0;
          line += 1;
        }
        positions.push({ item, x, row: line });
        x += itemWidth + gapX;
      }
    }
    const rows = positions.length > 0 ? positions[positions.length - 1]!.row + 1 : 0;
    return { positions, rows };
  };

  const kindGrid = place(kinds);
  const relationGrid = place(relations);
  const header = 24 * u + 15 * u * 1.3 + 16 * u;
  const between = relationGrid.rows > 0 && kindGrid.rows > 0 ? 14 * u : 0;
  const height = header + (kindGrid.rows + relationGrid.rows) * row + between;

  return {
    height,
    draw(context, x, y) {
      context.fillStyle = palette.rule;
      context.fillRect(x, y, width, Math.max(1, u));
      eyebrow(context, 'Leyenda', x, y + 24 * u, u, palette.muted);
      context.font = font(400, size);
      context.textBaseline = 'middle';
      const drawGrid = (grid: ReturnType<typeof place>, top: number) => {
        for (const { item, x: itemX, row: line } of grid.positions) {
          const centerY = top + line * row + row / 2;
          item.drawIcon(context, x + itemX, centerY);
          context.fillStyle = palette.fg;
          context.fillText(item.label, x + itemX + item.iconWidth + iconGap, centerY);
        }
      };
      drawGrid(kindGrid, y + header);
      drawGrid(relationGrid, y + header + kindGrid.rows * row + between);
      context.textBaseline = 'alphabetic';
    },
  };
}

/** Builds the final PNG for `doc` using `renderScene` for the 3D frame. */
export async function composePng(
  doc: DiagramDocument,
  options: PngComposeOptions,
  renderScene: SceneRenderer,
  size: { width: number; height: number } = PNG_FORMATS[options.format],
): Promise<HTMLCanvasElement> {
  const { width, height } = size;
  const u = Math.min(width, height) / 1080;
  const theme = resolveTheme(doc.presentation);
  const palette = PALETTE[theme.overlay];
  const hasLegend = options.legend && doc.nodes.length > 0;
  const hasPanel = options.title || hasLegend;
  const wide = width / height >= 1.3;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite componer la imagen.');
  if (!options.transparent) {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
  }
  if (hasPanel) await loadFonts(u);

  const margin = 72 * u;
  let scene: Rect = { x: 0, y: 0, width, height };
  const overlays: (() => void)[] = [];

  if (hasPanel && wide) {
    const column = Math.round(width * 0.27);
    const legend = hasLegend ? layoutLegend(ctx, doc, column, u, palette, 2) : null;
    const available = height - 2 * margin - (legend ? legend.height + 48 * u : 0);
    const descriptionLines = Math.max(
      0,
      Math.min(8, Math.floor((available - 15 * u * 1.3 - 20 * u - 3 * 72 * u - 28 * u) / (20 * u * 1.45))),
    );
    const title = options.title
      ? layoutTitle(ctx, doc, theme.name, column, u, palette, { titleLines: 3, titleSize: 72, descriptionLines })
      : null;
    if (title) overlays.push(() => title.draw(ctx, margin, margin));
    if (legend) overlays.push(() => legend.draw(ctx, margin, height - margin - legend.height));
    const ruleX = margin + column + 48 * u;
    overlays.push(() => {
      ctx.fillStyle = palette.rule;
      ctx.fillRect(ruleX, margin, Math.max(1, u), height - 2 * margin);
    });
    // Side insets keep labels at the scene's edges off the rule and the border.
    const sceneX = ruleX + 24 * u;
    scene = { x: sceneX, y: 0, width: width - sceneX - margin / 2, height };
  } else if (hasPanel) {
    const inner = width - 2 * margin;
    const title = options.title
      ? layoutTitle(ctx, doc, theme.name, inner, u, palette, { titleLines: 2, titleSize: 64, descriptionLines: 2 })
      : null;
    const legend = hasLegend ? layoutLegend(ctx, doc, inner, u, palette, 0) : null;
    const top = title ? margin + title.height + 24 * u : 0;
    const bottom = legend ? height - margin - legend.height - 24 * u : height;
    if (title) overlays.push(() => title.draw(ctx, margin, margin));
    if (legend) overlays.push(() => legend.draw(ctx, margin, height - margin - legend.height));
    scene = { x: margin / 2, y: top, width: width - margin, height: Math.max(height * 0.35, bottom - top) };
  }

  const frame = await renderScene({
    width: Math.round(scene.width),
    height: Math.round(scene.height),
    transparent: true,
    scale: u,
  });
  ctx.drawImage(frame, Math.round(scene.x), Math.round(scene.y));
  overlays.forEach((draw) => draw());
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('El navegador no generó el PNG.'))), 'image/png'),
  );
}
