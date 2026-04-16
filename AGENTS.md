# FPJC agent guidance

## Core rules

- Treat **GitHub as the source of truth** for code and documentation.
- Assume **Apps Script editor changes are not canonical** unless they are synced back into this repository.
- Keep executable Apps Script files **flat at repository root** unless the GitHub sync extension is confirmed to support nested runtime files safely.
- Do not hardcode spreadsheet IDs, deployment URLs, Square IDs, access tokens, or environment-specific values in source.
- Use **Script Properties** for environment-specific settings.
- Prefer **small, additive refactors** over large rewrites.
- Do not rename or remove live files unless the task explicitly requires it.

## File placement rules

- New documentation goes under `docs/`.
- Pull request process assets go under `.github/`.
- New Apps Script runtime files should stay at repo root and use purpose-based names with numeric prefixes, for example:
  - `00_ProjectConfig.gs`
  - `10_SignInApi.gs`
  - `20_MembersRepository.gs`
  - `31_BasketService.gs`
  - `45_SquareCheckout.gs`
  - `91_AdminCacheTools.gs`

## Change approach

When working in current large files such as `SignInApp.gs`:

1. Identify the narrow responsibility being changed.
2. Prefer extracting that responsibility into a new focused file.
3. Leave a thin compatibility wrapper in the original file if needed.
4. Avoid mixing UI, sheet persistence, payment logic, and cache management in the same change unless unavoidable.

## Quality bar

- Preserve current behaviour unless the task explicitly changes behaviour.
- Keep user-facing text in clear UK English.
- Add or update docs when introducing:
  - new script properties
  - new sheets or columns
  - new payment states
  - new admin operations
- Call out any schema or operational impact clearly in the PR.

## Known risks to watch

- `SignInApp.gs` currently carries too many responsibilities.
- Payment flow and basket resolution logic are tightly coupled.
- Sheet header names are operational contracts and must be treated carefully.
- Cache invalidation and payment reconciliation changes can create subtle production defects.

## Preferred branch flow

- Create task branches from `DEV` for Codex work.
- Raise pull requests back into `DEV`.
- Promote from `DEV` to `main` only after manual validation.
