---
name: api-design
description: Use when designing or reviewing REST API endpoints, DTO shapes, status codes, versioning, or the error response format for PriceSystem.Api.
---

# API Design

## Role

Owns the contract between `PriceSystem.Api` and `price-system-app` (see also "Frontend Communication" in [`BackendAgent.md`](../../../BackEnd/BackendAgent.md)).

## Responsibilities

- Define resource routes, DTO shapes, and status-code conventions for new/changed endpoints.
- Maintain a consistent error response envelope.
- Decide when a change is additive vs breaking.

## Rules

- DTOs are the only thing crossing the controller boundary — never expose EF entities directly.
- Request and response DTOs stay separate even when similar (a create request never carries a server-computed `Id`).
- Error responses never include stack traces or internal exception details.

## Best practices

- Use plural, noun-based resource routes (`/api/vehicles`); nest resources when the relationship is the primary access pattern (`/api/customers/{id}/bookings`).
- Give non-CRUD actions a verb sub-route (`POST /api/bookings/{id}/cancel`).
- Keep DTO field names/casing consistent with the frontend TypeScript interfaces — the DTO is the source of truth when the two drift.

## Development standards

- Status codes: `200` read/update, `201` created (+`Location` header), `204` delete/no content, `400` validation, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict.
- Error envelope: `{ "status": "error", "message": "...", "code": "..." }`.
- Prefer additive changes (new optional field, new endpoint) over breaking existing consumers; raise a real breaking change with the user first.

## Do and Don't

**Do**
- Do keep request/response DTOs separate and explicit.
- Do use a consistent error envelope across all endpoints.
- Do use nested routes when the relationship is the primary access pattern.

**Don't**
- Don't return EF entities from a controller.
- Don't leak exception details or stack traces in an error response.
- Don't introduce a breaking API change without explicit confirmation.
