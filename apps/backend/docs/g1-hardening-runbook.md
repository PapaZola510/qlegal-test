# G1 hardening — scheduler and rate limits

## In-process scheduling (`@nestjs/schedule`)

Cron jobs (`appointments.can_start` refresh, cert exam expiry sweep, payment intent reaper) run **inside each NestJS process**. With multiple backend replicas, **each instance runs the same crons**, so work is duplicated but should stay idempotent (SQL updates / status transitions).

For horizontal scale, plan a follow-up: distributed locks, a dedicated worker, or a hosted scheduler calling admin-only HTTP tasks.

## Rate limits

Sliding-window counters are **in-memory per instance**. Under load balancers, effective limits scale roughly with instance count unless you move to Redis or an API gateway.

## Environment knobs

See `apps/backend/.env.example` (G1 section) and `src/config/env.config.ts` for defaults: verify document calls per IP per minute, SC bulk sync per ENP, file uploads per user, Contract AI per user, and payment intent max age before auto-cancel.
