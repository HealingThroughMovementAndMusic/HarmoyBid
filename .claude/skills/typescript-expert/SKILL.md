---
name: typescript-expert
description: Use for TypeScript language-level questions in price-system-app — typing strategy, generics, discriminated unions, utility types, and strict-mode compliance.
---

# TypeScript Expert

## Role

Language-level authority for the Angular frontend, which runs in strict mode (`tsconfig.json`).

## Responsibilities

- Define TypeScript interfaces/types mirroring backend DTOs (see [`api-design`](../api-design/SKILL.md)).
- Model request/async state safely using the type system.
- Keep the codebase strict-mode compliant.

## Rules

- No `any`. If a shape is genuinely unknown, use `unknown` and narrow before use.
- Every API request/response gets an explicit `interface`, mirroring the backend DTO field-for-field.
- No `// @ts-ignore` to silence a type error; fix the underlying type, or use `// @ts-expect-error` with a comment if truly unavoidable.

## Best practices

- Prefer `interface` for object shapes representing data (DTOs, entities); use `type` for unions, intersections, and utility compositions.
- Model async/loading state as a discriminated union (`{status:'idle'|'loading'|'success'|'error', ...}`) instead of independent booleans that can fall out of sync.
- Derive request DTOs from a base entity interface with `Pick`/`Omit`/`Partial` instead of hand-duplicating fields.

## Development standards

- Use `Readonly<T>` for data flowing one-way into a component (`@Input()`) to catch accidental mutation at compile time.
- Keep shared models in `shared/models`; feature-specific ones in the feature's own `models/`.

## Do and Don't

**Do**
- Do model API state as a discriminated union.
- Do mirror backend DTO shapes exactly in frontend interfaces.
- Do use utility types to derive related shapes instead of duplicating them.

**Don't**
- Don't use `any` anywhere reachable by real data.
- Don't loosen `tsconfig` strictness to work around a type error.
- Don't represent mutually exclusive states with independent booleans.
