# Refactor backlog (status update)

This file is retained as a lightweight status marker.

## Current status

The major runtime split work described in older backlog notes has largely been completed in the live codebase (config/bootstrap, repositories, services, and admin/settings extraction).

## What this means

- `SignInApp.gs` is no longer the sole monolith and now acts mainly as a compatibility surface for remaining legacy paths.
- The immediate priority is no longer broad extraction for its own sake.

## Active focus instead of old backlog items

1. Operational hardening of admin/settings and configuration validation.
2. Keeping club-facing values in `Club_Config` and runtime/secrets in Script Properties.
3. Stabilising menu and support-tool behaviour.
4. Preparing for product architecture steps (central runtime + per-club sheets + future host migration path).

For the canonical current summary, use:
- `docs/current-state-and-direction.md`
