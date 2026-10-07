# Engineering Basis

This skill intentionally combines official framework guidance with pragmatic architecture/refactoring principles. Project documentation remains authoritative when it is more specific than a generic guideline.

## Contents

- React
- Zustand
- React Flow
- React Three Fiber
- Frontend architecture and refactoring
- Skill design
- How to resolve conflicts

## React

### Components and Hooks must be pure

https://react.dev/reference/rules/components-and-hooks-must-be-pure

Applied here as:

- no side effects during render;
- props/state are immutable snapshots;
- side effects run in event handlers or true synchronization Effects.

### Choosing the State Structure

https://react.dev/learn/choosing-the-state-structure

Applied here as:

- avoid contradictory, redundant, duplicated, or unnecessarily deep state;
- compute derivable values instead of synchronizing copies.

### Sharing State Between Components

https://react.dev/learn/sharing-state-between-components

Applied here as:

- each piece of state has one owner/source of truth;
- lift state only to the closest owner that needs to coordinate it.

### You Might Not Need an Effect

https://react.dev/learn/you-might-not-need-an-effect

Applied here as:

- no Effects for render-time transformations;
- no Effects for user events that can be handled directly.

### `memo`, `useMemo`, `useCallback`

https://react.dev/reference/react/memo
https://react.dev/reference/react/useMemo
https://react.dev/reference/react/useCallback

Applied here as:

- memoization is a performance optimization, not a correctness dependency;
- use it where identity or expensive work matters, particularly integration boundaries such as React Flow.

## Zustand

### Beginner TypeScript / selectors

https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript

### `useShallow`

https://zustand.docs.pmnd.rs/reference/hooks/use-shallow

### Migration to v5 / stable selector outputs

https://zustand.docs.pmnd.rs/reference/migrations/migrating-to-v5

Applied here as:

- narrow selectors over whole-store subscriptions;
- stable selector results in Zustand 5;
- `useShallow` when grouping selected fields into a new object/array.

## React Flow

### Performance

https://reactflow.dev/learn/advanced-use/performance

Applied here as:

- stabilize custom node/edge components and callback/option identities;
- avoid broad subscriptions to frequently changing node/edge arrays;
- simplify hot rendering paths for large graphs.

## React Three Fiber

### Scaling performance

https://r3f.docs.pmnd.rs/advanced/scaling-performance

Applied here as:

- `frameloop="demand"` when the scene can idle;
- `invalidate()` for imperative mutations;
- reuse geometry/material resources;
- reduce draw calls with instancing;
- adapt quality based on performance.

## Frontend architecture and refactoring

### Martin Fowler — Presentation Domain Data Layering

https://martinfowler.com/bliki/PresentationDomainDataLayering.html

Applied here as separation between UI/adapters and domain logic, improving local reasoning and testability. For Strata this aligns directly with its existing `domain`, `state`, `features`, and `app` boundaries.

### Martin Fowler — Modularizing React Applications with Established UI Patterns

https://martinfowler.com/articles/modularizing-react-apps.html

Applied here as moving cohesive pure business/domain logic out of view components rather than concentrating behavior in hooks/components.

### Kent C. Dodds — State Colocation

https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster

Applied here as keeping rapidly changing state close to consumers and reserving global state for genuinely shared/application concerns.

### Kent C. Dodds — AHA Programming

https://kentcdodds.com/blog/aha-programming

Applied here as avoiding premature abstractions. A small amount of duplication is often cheaper than a generic abstraction with unclear variation points.

## Skill design

### Agent Skills overview

https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

### Skill authoring best practices

https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

The skill uses progressive disclosure: the main `SKILL.md` contains activation/workflow rules, while examples and deep audit guidance live in directly referenced files.

## How to resolve conflicts

Use this priority:

1. Explicit task requirement.
2. Correctness/security/data integrity.
3. Strata's documented architecture and invariants.
4. Official library semantics for the installed versions.
5. Evidence from tests/profiling.
6. General engineering guidance in this file.
7. Stylistic preference.

Never override a project-specific design merely because a generic blog pattern looks cleaner.
