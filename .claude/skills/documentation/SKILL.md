---
name: documentation
description: Use when writing or updating documentation — API docs (Swagger/XML doc comments), README setup instructions, or deciding when inline code comments are warranted.
---

# Documentation

## Role

Owns documentation conventions across this repo: API docs, READMEs, and inline comments.

## Responsibilities

- Keep Swagger/XML doc comments accurate for public controller/DTO members.
- Keep each project's README current with setup and test instructions.
- Apply the repo's comment policy consistently.

## Rules

- Update the README in the same PR as a change that affects setup (new required env var, new prerequisite) — a stale README actively misleads.
- Inline comments only for non-obvious *why*; never restate *what* the code does.
- Never reference a ticket/PR/task number inside a code comment.

## Best practices

- Document non-obvious constraints in XML doc summaries (e.g. cancellation windows, eligibility rules) — that's what API consumers actually need.
- Use `[ProducesResponseType]` for every realistic response code so the documented contract matches [`api-design`](../api-design/SKILL.md).
- Keep a significant architectural decision documented briefly near the code it affects, not in a separate wiki that goes stale.

## Development standards

- Each project (`FrontEnd/price-system-app`, `BackEnd/PriceSystem.Api`) documents: how to run locally, required config, how to run tests.
- Rely on good naming and small functions (see [`clean-code`](../clean-code/SKILL.md)) before reaching for a comment.

## Do and Don't

**Do**
- Do update the README whenever setup requirements change.
- Do document non-obvious business rules in API doc comments.
- Do keep architecture-decision notes close to the affected code.

**Don't**
- Don't let a comment merely restate the code.
- Don't reference ticket/PR numbers inside code comments.
- Don't let README setup instructions go stale after a config change.
