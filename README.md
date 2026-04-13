# FPJC

Fleming Park Judo Club sign-in and payment application built on Google Apps Script, backed by Google Sheets and Square.

## Working model

- **GitHub is the engineering source of truth**
- **Google Apps Script is the runtime and deployment layer**
- **Google Sheets is the operational data store**
- **Square is the payment platform**
- **DEV** is the active integration branch for ongoing work
- **main** should stay release-oriented

## Important constraint

This repository is currently being synchronised with Apps Script via a GitHub sync extension rather than `clasp`.
Because of that, executable Apps Script files are intentionally kept **flat at repo root** unless the sync tool is proven to support nested runtime files safely.

## Current runtime files

- `appsscript.json` - Apps Script manifest
- `Index.html` - current web app UI
- `SignInApp.gs` - current sign-in, basket, cache and payment-resolution logic
- `Square.gs` - Square API client, catalogue sync and payment link logic
- `NotesSync.gs` - notes synchronisation behaviour
- `Code.gs` - spreadsheet menu / admin entry points and shared spreadsheet helpers
- `90_AdminSettings.gs` - admin settings UI actions and configuration helpers

## Repo structure

```text
.
├─ .github/
│  └─ pull_request_template.md
├─ docs/
│  ├─ architecture.md
│  ├─ admin-settings.md
│  ├─ change-workflow.md
│  ├─ refactor-backlog.md
│  └─ script-properties.md
├─ AGENTS.md
├─ README.md
├─ appsscript.json
├─ Code.gs
├─ Index.html
├─ NotesSync.gs
├─ AdminSettings.html
├─ 90_AdminSettings.gs
├─ SignInApp.gs
└─ Square.gs
```

## Target direction for runtime code

New runtime code should gradually move toward **small, purpose-specific root files** using numeric prefixes so Apps Script load order stays obvious and Codex can make narrow changes safely.

Suggested pattern:

- `00_*` shared config and bootstrap
- `10_*` app entry points and orchestration
- `20_*` sheet access and repositories
- `30_*` member / attendance / basket services
- `40_*` payment and Square services
- `90_*` admin, cache reset and test helpers

## Delivery rule of thumb

Do not do large-scale renames or moves in one pass. Prefer controlled extraction from the current larger files into new, clearly named files, keeping the live behaviour stable while the structure improves.
