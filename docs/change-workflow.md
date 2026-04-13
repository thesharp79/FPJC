# Change workflow

## Branch model

### `main`
- Release-oriented branch
- Should reflect the version you are prepared to treat as stable
- Do not use for day-to-day experimental changes

### `DEV`
- Integration branch for active development
- Default branch for ongoing FPJC engineering work
- Target branch for Codex-assisted pull requests

### `feature/*`
- Task-specific branches created from `DEV`
- Preferred branch type for Codex work on individual changes
- Merge back into `DEV` after review and validation

## Recommended working sequence

1. Create or update a task branch from `DEV`
2. Let Codex work against that branch
3. Review the diff in GitHub
4. Merge into `DEV`
5. Sync `DEV` to Apps Script
6. Test in the DEV deployment / DEV spreadsheet
7. Promote from `DEV` to `main` only when validated

## Apps Script sync rule

Because the project is using a GitHub sync extension rather than `clasp`:

- avoid bulk renames unless necessary
- avoid moving runtime files into nested folders unless proven safe
- prefer additive refactors
- treat sync behaviour as an operational dependency

## Pull request expectations

Every PR into `DEV` should state:

- what changed
- whether sheet schema changed
- whether script properties changed
- whether payment flow changed
- how it was manually tested
- what operational risk exists

## Release discipline

Before promoting `DEV` to `main`:

- confirm Apps Script sync completed cleanly
- confirm script properties are correct for the target environment
- validate key user journeys:
  - member lookup
  - basket creation
  - extra charge add/remove
  - complete sign-in
  - payment link generation
  - Square reconciliation
  - desk payment fallback

## Do not

- commit secrets
- make direct production changes in parallel with GitHub changes
- mix structural refactor and behavioural change in a single large PR unless there is no practical alternative
