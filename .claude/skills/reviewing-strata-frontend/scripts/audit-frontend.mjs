#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const jsonMode = process.argv.includes('--json');

if (!fs.existsSync(srcRoot)) {
  console.error('Expected to run from a project root containing ./src');
  process.exitCode = 2;
  process.exit();
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const findings = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [fullPath];
  });
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function add(severity, file, rule, message, line = undefined) {
  findings.push({ severity, file: relative(file), line, rule, message });
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function matchAll(text, regex) {
  return [...text.matchAll(regex)];
}

function inspectArchitecture(file, text) {
  const rel = relative(file);

  if (rel.startsWith('src/domain/')) {
    const forbidden = [
      ['react', /from\s+['"]react(?:\/[^'"]*)?['"]/g],
      ['zustand', /from\s+['"]zustand(?:\/[^'"]*)?['"]/g],
      ['react-flow', /from\s+['"]@xyflow\//g],
      ['three/r3f', /from\s+['"](?:three|@react-three\/)/g],
      ['state', /from\s+['"][^'"]*\bstate\//g],
      ['feature', /from\s+['"][^'"]*\bfeatures\//g],
      ['app', /from\s+['"][^'"]*\bapp\//g],
    ];

    for (const [name, regex] of forbidden) {
      for (const match of matchAll(text, regex)) {
        add(
          'ERROR',
          file,
          'domain-boundary',
          `domain/ imports ${name}; keep domain framework-independent`,
          lineOf(text, match.index),
        );
      }
    }
  }

  if (rel.endsWith('.tsx') && /src\/domain\//.test(rel)) {
    add(
      'ERROR',
      file,
      'domain-jsx',
      'JSX file inside domain/; inspect whether presentation leaked into the domain layer',
    );
  }
}

function inspectTypes(file, text) {
  const checks = [
    [
      'WARN',
      'explicit-any',
      /\bas\s+any\b|:\s*any\b/g,
      'explicit any weakens the strict boundary; narrow or model the type',
    ],
    [
      'WARN',
      'double-assertion',
      /\bas\s+unknown\s+as\b/g,
      'double assertion bypasses type safety; validate/narrow the value instead',
    ],
    [
      'WARN',
      'ts-ignore',
      /@ts-ignore\b/g,
      '@ts-ignore hides a type error; fix or use a narrowly justified @ts-expect-error',
    ],
  ];

  for (const [severity, rule, regex, message] of checks) {
    for (const match of matchAll(text, regex)) {
      add(severity, file, rule, message, lineOf(text, match.index));
    }
  }
}

function inspectReact(file, text) {
  if (!file.endsWith('.tsx')) return;

  const loc = text.split('\n').length;
  if (loc > 300) {
    add(
      'INFO',
      file,
      'large-module',
      `${loc} lines; inspect cohesion and mixed reasons to change (size alone is not a defect)`,
    );
  }

  const effectCount = matchAll(text, /\buseEffect\s*\(/g).length;
  if (effectCount >= 4) {
    add(
      'INFO',
      file,
      'effect-density',
      `${effectCount} useEffect calls; inspect for derived state, event logic, and mixed responsibilities`,
    );
  }

  for (const match of matchAll(text, /\buse[A-Z][A-Za-z0-9]*Store\s*\(\s*\)/g)) {
    add(
      'WARN',
      file,
      'zustand-whole-store',
      'whole-store subscription can cause broad rerenders; select only required state',
      lineOf(text, match.index),
    );
  }

  const objectSelector = /use[A-Z][A-Za-z0-9]*Store\s*\(\s*\(?\s*(?:state|s)\s*\)?\s*=>\s*\(\s*\{/g;
  for (const match of matchAll(text, objectSelector)) {
    const nearby = text.slice(Math.max(0, match.index - 120), Math.min(text.length, match.index + 500));
    if (!/useShallow/.test(nearby)) {
      add(
        'WARN',
        file,
        'zustand-unstable-selector',
        'selector returns a new object; in Zustand 5 prefer separate selectors or useShallow',
        lineOf(text, match.index),
      );
    }
  }

  for (const match of matchAll(text, /\b(?:Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID\(\))/g)) {
    add(
      'INFO',
      file,
      'render-impurity-candidate',
      'non-deterministic call in TSX; verify it is not executed during render',
      lineOf(text, match.index),
    );
  }

  if (/\buseFrame\s*\(/.test(text)) {
    const setterMatches = matchAll(text, /\bset[A-Z][A-Za-z0-9_]*\s*\(/g);
    for (const match of setterMatches) {
      add(
        'INFO',
        file,
        'frame-setter-candidate',
        'file uses useFrame and a setter; verify React/Zustand state is not updated every frame',
        lineOf(text, match.index),
      );
    }
  }

  for (const match of matchAll(
    text,
    /new\s+THREE\.(?:[A-Za-z]+Geometry|[A-Za-z]+Material|WebGLRenderer|WebGLRenderTarget)\s*\(/g,
  )) {
    add(
      'INFO',
      file,
      'three-allocation',
      'Three.js resource allocation in TSX; verify it is shared/memoized/lifecycle-managed and disposed when appropriate',
      lineOf(text, match.index),
    );
  }
}

function inspectRandomness(file, text) {
  const rel = relative(file);
  if (!rel.startsWith('src/domain/') && !rel.startsWith('src/features/templates/')) return;

  for (const match of matchAll(text, /\bMath\.random\s*\(/g)) {
    add(
      'WARN',
      file,
      'uncontrolled-randomness',
      'use the project seeded RNG contract instead of Math.random()',
      lineOf(text, match.index),
    );
  }
}

function inspectPersistence(file, text) {
  const rel = relative(file);
  for (const match of matchAll(text, /\blocalStorage\b/g)) {
    if (!/persistence|preferences|share|storage/i.test(rel)) {
      add(
        'INFO',
        file,
        'storage-boundary',
        'direct localStorage access outside an obvious storage/persistence boundary; inspect ownership',
        lineOf(text, match.index),
      );
    }
  }

  for (const match of matchAll(text, /JSON\.parse\([^\n;]*\)\s+as\s+[A-Z][A-Za-z0-9_]*/g)) {
    add(
      'WARN',
      file,
      'unsafe-runtime-cast',
      'JSON parse followed by a TypeScript assertion is not runtime validation; parse unknown and validate',
      lineOf(text, match.index),
    );
  }
}

for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, 'utf8');
  inspectArchitecture(file, text);
  inspectTypes(file, text);
  inspectReact(file, text);
  inspectRandomness(file, text);
  inspectPersistence(file, text);
}

const rank = { ERROR: 0, WARN: 1, INFO: 2 };
findings.sort(
  (a, b) => rank[a.severity] - rank[b.severity] || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0),
);

if (jsonMode) {
  process.stdout.write(`${JSON.stringify({ findings }, null, 2)}\n`);
} else if (findings.length === 0) {
  console.log('No heuristic findings. This does not replace semantic review, tests, or profiling.');
} else {
  for (const finding of findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    console.log(`[${finding.severity}] ${location} ${finding.rule} — ${finding.message}`);
  }
  console.log(`\n${findings.length} heuristic finding(s). Inspect before changing code.`);
}

if (findings.some((finding) => finding.severity === 'ERROR')) {
  process.exitCode = 1;
}
