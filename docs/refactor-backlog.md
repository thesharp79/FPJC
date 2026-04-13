# Refactor backlog

## What I observed in the current codebase

### `SignInApp.gs`
- carries too many responsibilities for safe targeted change
- combines configuration, repositories, orchestration, domain logic, caching and admin operations
- should be treated as the main extraction candidate

### `Index.html`
- contains markup, styling and client-side logic together
- acceptable for now, but large front-end changes will become harder over time

### `Square.gs`
- combines low-level API calls with business flow logic
- should eventually be split into config, client, checkout and catalogue sync areas

## Immediate next refactor candidates

### 1. Shared config extraction
Create a new root file such as `00_ProjectConfig.gs` and move only:
- script property access
- common environment helpers
- shared constant objects that are broadly reused

### 2. Sheet repository extraction
Create focused files for reading and writing:
- members
- attendance
- baskets
- basket lines
- payment options
- other payments

### 3. Basket service extraction
Move basket lifecycle logic into a focused basket service area:
- create basket
- add member
- add extra
- remove member
- remove charge
- basket totals
- cancel basket

### 4. Payment resolution extraction
Move these into a dedicated payment resolution file:
- finalise sign-in
- payment pending handling
- mark as desk payment
- payment resolved transitions
- attendance payment updates
- other payment resolution updates

### 5. Square boundary hardening
Separate:
- raw `UrlFetchApp` interaction
- Square payload shaping
- FPJC business rules for checkout and reconciliation

## How to refactor safely

- extract one responsibility at a time
- keep function names stable where possible
- add thin wrappers in old files during migration
- validate basket and payment flows after each extraction

## Suggested first engineering task

Create `00_ProjectConfig.gs` and move only shared script property readers and environment-level config into it. That gives Codex a clean place to add new configuration without continuing to bloat `SignInApp.gs`.
