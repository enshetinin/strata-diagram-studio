# Strata Frontend Audit and Correction Workflow

## Contents

- Goal
- Phase 0: protect the worktree
- Phase 1: architecture map
- Phase 2: correctness scan
- Phase 3: React and state scan
- Phase 4: 2D/3D performance scan
- Phase 5: TypeScript and boundaries
- Phase 6: accessibility and UX resilience
- Phase 7: tests and quality gates
- Fix strategy
- Review output template
- High-risk change matrix

## Goal

Find real defects and costly design drift, then correct them with the smallest coherent change. A review is not a style contest. Prefer evidence from behavior, project contracts, tests, library semantics, and profiling over personal taste.

## Phase 0: protect the worktree

Run:

```bash
git status --short
git diff --stat
```

Do not overwrite or revert unrelated user changes. If the worktree is already modified, understand the overlap before editing.

Run a baseline appropriate to the requested scope. For a full audit:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Record pre-existing failures separately from failures caused by your edits.

## Phase 1: architecture map

Identify:

- Canonical domain types and Zod schemas.
- Pure command entry points and invariant validation.
- `documentStore`, `uiStore`, `preferencesStore`, and action layer responsibilities.
- React Flow conversion/adaptation functions.
- Scene model/world transform/camera/routing boundaries.
- Persistence/import/share/export boundaries.
- Tests that define behavior.

Check dependency direction. Search imports from `src/domain` into React, Zustand, React Flow, Three/R3F, app, or feature modules. Such imports are usually architectural defects.

Look for duplicate semantic representations of nodes, groups, edges, layout, or narrative. A local transient adapter cache is acceptable; a second persistent editable model is not.

## Phase 2: correctness scan

Prioritize these failure classes:

### Document invariants

- Dangling node/group/port/edge references.
- Group parent cycles.
- Narrative step / edge order divergence.
- Commands that mutate input documents in place.
- Operations that bypass invariant validation.
- Undo/redo entries created for transient UI motion.
- Read-only mode bypass through a secondary mutation path.

### Coordinates and geometry

- Mixing local and absolute coordinates.
- Adding parent offsets twice.
- Reimplementing port offsets differently in 2D/SVG/3D.
- Applying visual `layerHeight` to semantic membership/layout.
- 3D transforms that do not use the canonical transform.

### Async work

- ELK/generation/export results applied after the source document changed.
- Race conditions between multiple requests.
- Missing abort/ignore semantics when a component unmounts or a newer request supersedes an older one.

### Persistence/import/share

- `JSON.parse(...) as DiagramDocument` without runtime validation.
- Missing decompressed-size/count/reference limits.
- Invalid imports partially replacing current state.
- Secrets or API keys exposed via `VITE_*`, client bundle, URL, or localStorage.

## Phase 3: React and state scan

### Rendering purity

Look for:

- `Math.random`, `Date.now`, UUID generation, mutation of imported/global values, storage writes, or store writes during render.
- Component functions called directly instead of rendered as JSX.
- Conditional/looped hook calls.

### Effects

For each `useEffect`, ask:

1. What external system is being synchronized?
2. Could this be derived during render?
3. Could this happen in the event handler that caused it?
4. Is cleanup complete and symmetric?
5. Are dependencies complete, or is the code hiding a stale closure?

Effects that only copy props/state into another state field are strong refactor candidates.

### State ownership

Flag:

- Duplicate state that can disagree.
- Server/persistent/domain facts mirrored into local state without an explicit editing-buffer reason.
- Local modal/input/hover state promoted to a global store unnecessarily.
- Broad Zustand subscriptions.
- Zustand 5 selectors returning new object/array references without shallow/stable handling.

### Components

Inspect large files/functions for mixed reasons to change:

- domain algorithm + UI rendering
- persistence + rendering
- editor adapter + toolbar orchestration + modal state
- camera control + scene construction + export lifecycle

Size alone is not a violation. Treat roughly >250 LOC modules or >60 LOC functions as prompts to inspect cohesion, not automatic refactor targets.

## Phase 4: 2D/3D performance scan

### React Flow

Look for:

- Inline `nodeTypes`, `edgeTypes`, option objects, and expensive callback identities recreated on hot renders.
- Panels that subscribe to the complete React Flow `nodes`/`edges` arrays just to calculate small UI facts.
- Document-store writes on every pointer/drag event.
- Expensive filtering/mapping repeated across many node components.
- Heavy CSS animation/shadows/filters on large node counts.

### R3F / Three.js

Look for:

- `setState` / Zustand actions called in `useFrame`.
- Permanent `frameloop="always"` introduced without continuous animation need.
- Repeated geometry/material allocation per object/render.
- Excessive draw calls where instancing fits.
- Temporary renderers, render targets, materials, textures, geometries, controls, or event listeners not disposed/removed.
- DPR or quality decisions that ignore project performance controls.
- Camera/control mutation without invalidation under demand rendering.

When touching the 3D hot path, preserve or re-run the existing performance measurement workflow if feasible.

## Phase 5: TypeScript and boundaries

Search for:

```text
:any
as any
as unknown as
!
@ts-ignore
@ts-expect-error
```

Do not blindly remove every match. For each one, determine why the type system lost information.

Preferred corrections:

- parse `unknown` with Zod/type guards at boundaries;
- model closed variants with discriminated unions;
- use explicit nullable/optional handling;
- share canonical domain types instead of re-declaring lookalikes;
- use exhaustive maps/switches for intentionally closed domain sets;
- keep type-only imports explicit.

Do not fix type errors by loosening `strict`, `noUncheckedIndexedAccess`, or ESLint rules.

## Phase 6: accessibility and UX resilience

For changed UI verify:

- interactive elements are semantic buttons/inputs where possible;
- keyboard access exists for equivalent editing actions;
- focus remains visible and sensible after dialogs/menus;
- labels/accessible names are present;
- reduced-motion preference is respected for camera/particles/animation;
- the graph remains operable via accessible structure/2D paths when WebGL is unavailable;
- error states explain recovery instead of only logging to console.

## Phase 7: tests and quality gates

Choose the lowest-cost test that proves the change:

- Domain command/invariant: Vitest pure unit test.
- Geometry/layout/route: deterministic unit test with representative nested groups/ports.
- Store behavior/history/read-only: store-level unit test.
- React adapter integration: component/unit test when practical.
- Critical cross-surface workflow: Playwright.
- Visual/export/WebGL behavior: existing QA screenshots/manual/performance workflow as appropriate.

After edits, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Then run targeted E2E/QA/perf commands for surfaces you materially changed.

## Fix strategy

Use this order:

1. Stop corruption/security/data-loss risk.
2. Restore architectural source-of-truth boundaries.
3. Fix stale async and state ownership bugs.
4. Fix high-frequency rendering/performance problems.
5. Improve types to encode the corrected invariant.
6. Add tests.
7. Perform local readability cleanup only where it helps the changed code.

Avoid repository-wide renames, folder reshuffles, abstraction frameworks, or formatting churn unless explicitly requested.

## Review output template

Use a compact finding format:

```text
[P1] Stale ELK result can overwrite a newer document
File: src/features/layout/...
Evidence: request starts from revision N but applies result without checking current revision.
Impact: user edits made while layout runs can be lost/repositioned.
Fix: capture revision + request id and ignore stale completion; add a race test.
```

After findings, include:

- fixes applied (if requested),
- commands/tests actually run and results,
- residual risk / tests not run.

## High-risk change matrix

| Changed area | Must inspect | Usually validate |
| --- | --- | --- |
| domain commands | invariants, immutability, history | unit tests + typecheck |
| editor2d | transient vs committed state, selectors, stable RF props | unit + E2E relevant flow |
| layout/geometry | local/absolute coords, ports, stale ELK | layout tests + templates |
| viewer3d | demand loop, allocations, disposal, fallback | unit + QA/perf/WebGL path |
| persistence/share | validation, size limits, read-only | unit + E2E import/share |
| export | deterministic document mapping, fonts/resources cleanup | unit + QA artifact |
| stores | ownership, selectors, history/read-only | store tests + React consumers |
