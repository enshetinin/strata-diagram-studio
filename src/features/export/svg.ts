/**
 * Vector export of the 2D view, generated from the document (not a DOM
 * snapshot): groups, typed node shapes, labels and connectors with the same
 * routing function React Flow uses.
 */
import { Position } from '@xyflow/system';
import { strataEdgePath } from '../editor2d/edgePath';
import { GROUP_KIND_LABEL, KIND_INFO } from '../../domain/catalog';
import { documentBounds, portOffset, resolveAbsoluteLayout } from '../../domain/geometry';
import type { DiagramDocument, PortSide } from '../../domain/types';
import { groupDepths, topLevelAccents } from '../editor2d/adapter';
import { accent2d, KIND_GLYPH, RELATION_STROKE } from '../editor2d/visual';

const POSITION: Record<PortSide, Position> = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };
const MARGIN = 48;
const FONT_STACK = "'Figtree', 'Helvetica Neue', Arial, sans-serif";

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
}

/** Truncates to fit roughly `maxChars`; SVG has no automatic text wrapping. */
function fit(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
}

/** Greedy word wrap into at most `maxLines` lines (the last one truncated). */
export function wrapText(text: string, maxChars: number, maxLines = 2): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.map((line) => fit(line, maxChars));
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(lines.slice(maxLines - 1).join(' '), maxChars);
  return kept;
}

export interface SvgOptions {
  /** Base64 WOFF data to embed so the file renders the same everywhere. */
  fontData?: { regular: string; bold: string } | null;
}

export function documentToSvg(doc: DiagramDocument, options: SvgOptions = {}): string {
  const abs = resolveAbsoluteLayout(doc);
  const bounds = documentBounds(doc, abs);
  const width = Math.ceil(bounds.width + MARGIN * 2);
  const height = Math.ceil(bounds.height + MARGIN * 2 + 56);
  const ox = MARGIN - bounds.x;
  const oy = MARGIN + 56 - bounds.y;
  const depths = groupDepths(doc);
  const accentOf = topLevelAccents(doc);
  const out: string[] = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`);
  out.push(`<title id="title">${escapeXml(doc.name)}</title><desc id="desc">${escapeXml(doc.description)}</desc>`);
  out.push('<defs><style>');
  if (options.fontData) {
    out.push(`@font-face{font-family:'Figtree';font-weight:500;src:url(data:font/woff;base64,${options.fontData.regular}) format('woff');}`);
    out.push(`@font-face{font-family:'Figtree';font-weight:700;src:url(data:font/woff;base64,${options.fontData.bold}) format('woff');}`);
  }
  out.push(`text{font-family:${FONT_STACK};fill:#0D1B2E}.kind{font-size:10px;letter-spacing:.06em;fill:#5C6675}.label{font-size:14px;font-weight:700}.meta{font-size:11px;fill:#5C6675}.group{font-size:12px;font-weight:700;letter-spacing:.04em}.edge-label{font-size:11px}.title{font-size:20px;font-weight:700}`);
  out.push('</style>');
  for (const [relation, stroke] of Object.entries(RELATION_STROKE)) {
    out.push(`<marker id="arrow-${relation}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="${stroke.color}"/></marker>`);
  }
  out.push('</defs>');
  out.push(`<rect width="100%" height="100%" fill="#F4F5F8"/>`);
  out.push(`<text class="title" x="${MARGIN}" y="${MARGIN + 6}">${escapeXml(doc.name)}</text>`);

  const groups = [...doc.groups].sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0));
  for (const group of groups) {
    const rect = abs.groups.get(group.id);
    if (!rect) continue;
    const accent = accent2d(accentOf(group.id));
    const x = rect.x + ox;
    const y = rect.y + oy;
    out.push(`<g data-group="${escapeXml(group.id)}">`);
    const frame =
      group.kind === 'boundary'
        ? 'fill="none" stroke="#0D1B2E" stroke-width="1.5" stroke-dasharray="6 4"'
        : `fill="${accent}" fill-opacity="${0.05 + (depths.get(group.id) ?? 0) * 0.03}" stroke="#8A93A3" stroke-width="1"`;
    out.push(`<rect x="${x}" y="${y}" width="${rect.width}" height="${rect.height}" rx="0" ${frame}/>`);
    out.push(`<rect x="${x}" y="${y}" width="${rect.width}" height="3" fill="${accent}"/>`);
    out.push(`<text class="kind" x="${x + 16}" y="${y + 22}">${escapeXml(GROUP_KIND_LABEL[group.kind].toUpperCase())}</text>`);
    out.push(`<text class="group" x="${x + 16}" y="${y + 39}">${escapeXml(fit(group.label, Math.floor(rect.width / 8)))}</text>`);
    out.push('</g>');
  }

  for (const edge of doc.edges) {
    const sourceNode = doc.nodes.find((node) => node.id === edge.source.nodeId);
    const targetNode = doc.nodes.find((node) => node.id === edge.target.nodeId);
    const sourceRect = abs.nodes.get(edge.source.nodeId);
    const targetRect = abs.nodes.get(edge.target.nodeId);
    const sourcePort = sourceNode?.ports.find((port) => port.id === edge.source.portId);
    const targetPort = targetNode?.ports.find((port) => port.id === edge.target.portId);
    if (!sourceNode || !targetNode || !sourceRect || !targetRect || !sourcePort || !targetPort) continue;
    const s = portOffset(sourceRect, sourcePort, sourceNode.ports);
    const t = portOffset(targetRect, targetPort, targetNode.ports);
    const [path, labelX, labelY] = strataEdgePath(
      {
        sourceX: sourceRect.x + s.x + ox,
        sourceY: sourceRect.y + s.y + oy,
        sourcePosition: POSITION[sourcePort.side],
        targetX: targetRect.x + t.x + ox,
        targetY: targetRect.y + t.y + oy,
        targetPosition: POSITION[targetPort.side],
      },
      edge.bend,
    );
    const stroke = RELATION_STROKE[edge.relation];
    const marker = `url(#arrow-${edge.relation})`;
    out.push(
      `<path data-edge="${escapeXml(edge.id)}" d="${path}" fill="none" stroke="${stroke.color}" stroke-width="1.5"${stroke.dash ? ` stroke-dasharray="${stroke.dash}"` : ''} marker-end="${marker}"${edge.direction === 'bidirectional' ? ` marker-start="${marker}"` : ''}/>`,
    );
    const text = [edge.order !== undefined ? String(edge.order) : null, edge.label].filter(Boolean).join(' · ');
    if (text) {
      const w = text.length * 6.2 + 12;
      out.push(`<rect x="${labelX - w / 2}" y="${labelY - 9}" width="${w}" height="18" rx="0" fill="#F4F5F8" stroke="#C9D0DA" stroke-width="0.75"/>`);
      out.push(`<text class="edge-label" x="${labelX}" y="${labelY + 4}" text-anchor="middle">${escapeXml(text)}</text>`);
    }
  }

  for (const node of doc.nodes) {
    const rect = abs.nodes.get(node.id);
    if (!rect) continue;
    const x = rect.x + ox;
    const y = rect.y + oy;
    const accent = accent2d(accentOf(node.groupId));
    const maxChars = Math.floor((rect.width - 52) / 7.4);
    out.push(`<g data-node="${escapeXml(node.id)}">`);
    out.push(`<rect x="${x}" y="${y}" width="${rect.width}" height="${rect.height}" rx="0" fill="#FFFFFF" stroke="#0D1B2E" stroke-width="1"/>`);
    out.push(`<rect x="${x}" y="${y}" width="4" height="${rect.height}" fill="${accent}"/>`);
    out.push(`<path d="${KIND_GLYPH[node.kind]}" transform="translate(${x + 14} ${y + 14})" fill="none" stroke="#0D1B2E" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`);
    const lines = wrapText(node.label, maxChars);
    out.push(`<text class="kind" x="${x + 44}" y="${y + 22}">${escapeXml(KIND_INFO[node.kind].label.toUpperCase())}</text>`);
    lines.forEach((line, index) => out.push(`<text class="label" x="${x + 44}" y="${y + 40 + index * 16}">${escapeXml(line)}</text>`));
    if (node.provider && lines.length === 1) out.push(`<text class="meta" x="${x + 44}" y="${y + 60}">${escapeXml(fit(node.provider, maxChars + 4))}</text>`);
    out.push('</g>');
  }

  out.push('</svg>');
  return out.join('\n');
}

async function fontBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/** Embeds the local fonts when available; falls back to system fonts otherwise. */
export async function exportSvg(doc: DiagramDocument): Promise<Blob> {
  let fontData: SvgOptions['fontData'] = null;
  try {
    const base = `${import.meta.env.BASE_URL}assets/fonts/`;
    const [regular, bold] = await Promise.all([fontBase64(`${base}figtree-latin-500-normal.woff`), fontBase64(`${base}figtree-latin-700-normal.woff`)]);
    fontData = { regular, bold };
  } catch {
    // Fonts are optional: the SVG then uses the system fallback stack.
  }
  return new Blob([documentToSvg(doc, { fontData })], { type: 'image/svg+xml' });
}
