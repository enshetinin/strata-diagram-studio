---
name: reviewing-strata-frontend
description: Reviews, designs, implements, and refactors React/TypeScript frontend code for Strata Diagram Studio. Use when changing .ts/.tsx code, reviewing architecture, scanning for code smells, fixing maintainability or performance issues, working with Zustand, React Flow, React Three Fiber/Three.js, diagram domain commands, layout, persistence, exports, or tests. Preserves Strata's documented single-document/two-adapter architecture and validates changes with the project's quality gates.
---

# Reviewing Strata Frontend

Act as a senior frontend architect and code reviewer. Optimize for correctness, readability, changeability, performance, and preservation of the project's explicit architectural decisions. Do not refactor merely to make code look different.

## First: load project contracts

Before significant implementation or review, read the relevant project files that exist:

1. `CLAUDE.md`
2. `docs/architecture.md`
3. `docs/coordinates.md` when layout, geometry, ports, routing, camera, 2D, SVG, or 3D is involved
4. `package.json`, `tsconfig.app.json`, and `biome.json`
5. Relevant source files and their nearest tests
6. `docs/qa.md` when performance, browser behavior, exports, WebGL, or E2E behavior is involved

Treat documented architectural decisions as contracts. If implementation and documentation disagree, identify the mismatch explicitly; do not silently invent a third architecture.

For deeper guidance, read these files only as needed:

- [PATTERNS.md](PATTERNS.md) — good/bad TypeScript and React patterns for this project.
- [AUDIT.md](AUDIT.md) — systematic review and correction workflow.
- [RESEARCH.md](RESEARCH.md) — engineering basis and external references.

For a first-pass hotspot scan, run:

```bash
node .claude/skills/reviewing-strata-frontend/scripts/audit-frontend.mjs
```

The script is heuristic. Treat findings as leads to inspect, never as proof of a defect.

## Architectural invariants

Preserve these unless the task explicitly changes the architecture and the change is justified with tests and documentation:

- `DiagramDocument` is the single editable semantic source of truth.
- React Flow and Three/R3F are adapters/derived views, not competing editable models.
- `domain/` contains framework-independent data, validation, invariants, geometry, parsing/migration, and pure commands.
- User intent flows through actions/commands; UI components should not contain domain mutation algorithms.
- Pure commands return a new valid document or a domain error. Do not partially mutate shared document objects.
- `state/` separates document/history, transient UI state, and local preferences. Do not put every UI value in the document store.
- Transient drag/camera/hover/frame state is not document history. Commit semantic changes at meaningful boundaries such as drag stop or field commit.
- Canonical geometry/port/routing math must be shared across 2D, SVG, and 3D rather than reimplemented independently.
- Async layout/generation results must be guarded against staleness when document revision/request identity has changed.
- R3F remains demand-rendered. Never introduce React/Zustand state updates every frame.
- Reuse and dispose Three.js resources deliberately. Prefer shared geometry/materials and instancing for repeated objects.
- Persistence/import/share boundaries validate untrusted data before it can replace the current document.
- Read-only behavior belongs at the mutation boundary, not duplicated across every view.
- Export behavior should derive from the semantic document/model, not scrape presentation DOM when a deterministic model path exists.

## Dependency direction

Prefer this direction:

```text
app -> features -> state -> domain
app -> state -> domain
features -> domain
state -> domain
domain -> no React, Zustand, React Flow, Three/R3F, app, or feature modules
```

Feature-to-feature imports are allowed only when they represent a stable explicit contract and do not create cycles. Prefer extracting shared domain/layout logic downward rather than creating a generic `utils` dumping ground.

## React rules

- Components and hooks must be pure during render. Side effects belong in user event handlers or Effects that synchronize with an external system.
- Do not use `useEffect` to mirror props/state into redundant state when the value can be derived during render.
- Keep state minimal. Every independent fact should have one owner.
- Colocate rapidly changing UI state as close to its consumers as possible. Promote it to Zustand only when it truly crosses component boundaries or belongs to application state.
- Prefer composition and explicit props before introducing new global context/store state.
- Do not call components as plain functions. Follow the Rules of Hooks without exceptions.
- Memoization is an optimization, not a correctness mechanism. For React Flow boundaries, stabilize custom node/edge component maps, callback props, and repeated option objects where identity changes cause costly rerenders.
- Do not add `useMemo`/`useCallback` mechanically. Add them when identity matters or profiling/known library behavior justifies them.
- Extract components/functions by responsibility and change boundary, not by arbitrary line count. Duplication is preferable to a premature wrong abstraction.

## Zustand 5 rules

- Subscribe to the smallest state needed: `useStore(s => s.selection)` rather than `useStore()`.
- Prefer separate primitive selectors when practical.
- If a selector returns a new object/array containing several selected values, use `useShallow` or otherwise provide a stable result.
- Derived values should usually be selectors/functions, not duplicated store fields, unless they are intentionally cached and invalidated by a clear contract.
- Store actions express state transitions; components should not know store-internal mutation mechanics.
- Avoid one monolithic store when document, UI, and preferences have different ownership/lifecycles.

## TypeScript rules

- Keep `strict` assumptions. Do not weaken compiler flags to make a change pass.
- No explicit `any`, `as any`, or `as unknown as` shortcuts. Parse/narrow `unknown` at boundaries.
- Prefer discriminated unions and exhaustive switches for closed variants.
- Prefer `import type` for type-only imports; the project uses `verbatimModuleSyntax`.
- Treat `noUncheckedIndexedAccess` seriously: handle missing indexed values rather than asserting them away.
- Non-null assertions (`!`) need a locally obvious invariant; otherwise narrow explicitly.
- Do not duplicate domain types in UI adapters. Map from canonical domain types.
- Preserve semantic naming: data/types are nouns; commands/actions are verbs; booleans read as predicates (`is`, `has`, `can`, `should`).

## Readability rules

- A function should do one coherent job at one abstraction level.
- Prefer guard clauses to deep nesting.
- Name intermediate values when they encode domain meaning.
- Comments explain *why*, invariants, non-obvious tradeoffs, browser/library constraints, or intentional performance choices. Do not narrate obvious syntax.
- Avoid generic names such as `data`, `item`, `handler`, `manager`, `helper`, `utils` when a domain term exists.
- Keep module public surfaces small. Do not export implementation details merely to make tests easy.
- Do not create abstractions until the repeated concept and its variation points are understood.

## Performance rules specific to Strata

### React Flow / 2D

- Avoid subscribing UI panels to full `nodes`/`edges` collections when only selection/count/metadata is needed.
- Keep custom node/edge component identities stable.
- During drag, keep high-frequency transient state local to the adapter and commit one semantic command at the documented boundary.
- Do not duplicate canonical coordinates in a second persistent React Flow model.

### Three.js / R3F / 3D

- Keep `frameloop="demand"` semantics.
- Use `invalidate()` for imperative camera/control mutations when necessary rather than switching to a permanent render loop.
- Never call React/Zustand setters on every `useFrame` tick.
- Reuse geometry/materials and use `InstancedMesh` for repeated primitives when appropriate.
- Dispose temporary renderer/material/geometry/texture resources on teardown or replacement.
- Do not allocate expensive Three.js objects repeatedly during render without a lifecycle reason.
- Preserve graceful 2D fallback and reduced-motion behavior.

## Review / fix protocol

When asked to scan, review, or correct code:

1. Establish baseline with `git status` and inspect existing user changes. Never overwrite unrelated work.
2. Run the heuristic audit script if available.
3. Review architecture and correctness before style.
4. Classify findings:
   - **P0**: data loss, corruption, security boundary failure, crash, broken invariant.
   - **P1**: likely functional bug, stale async write, major rendering/performance regression, architecture violation that creates dual sources of truth.
   - **P2**: maintainability, unnecessary rerenders, unsafe typing, fragile coupling, missing tests for meaningful behavior.
   - **P3**: naming/readability/local cleanup with low behavior risk.
5. For each finding, state evidence: file, symbol/line, why it matters, and the smallest safe fix.
6. Fix root causes before cosmetic cleanup. Keep diffs narrow.
7. Add/update tests that prove the behavior or invariant being changed.
8. Validate with the smallest relevant checks first, then the project gates when feasible:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

Run relevant Playwright/performance checks when the changed surface warrants them.

## Output contract

For reviews, lead with findings, ordered P0 -> P3. Do not bury bugs beneath a general summary. If no concrete defect is found, say so and mention residual risks or untested areas.

For implementation/refactoring, briefly state the architectural choice, make the change, then report validation performed. Never claim a command/test passed unless it actually ran successfully.
