// Copies the locally installed OFL fonts used by WebGL labels (troika needs a
// file URL, not a CSS @font-face) into public/assets/fonts.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'assets', 'fonts');
mkdirSync(target, { recursive: true });

const fonts = [
  ['@fontsource/figtree', 'figtree-latin-500-normal.woff'],
  ['@fontsource/figtree', 'figtree-latin-600-normal.woff'],
  ['@fontsource/figtree', 'figtree-latin-700-normal.woff'],
  ['@fontsource/jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'],
];

for (const [pkg, file] of fonts) {
  const source = join(root, 'node_modules', pkg, 'files', file);
  if (!existsSync(source)) {
    console.warn(`[fonts] missing ${source}; run pnpm install first`);
    continue;
  }
  copyFileSync(source, join(target, file));
}
