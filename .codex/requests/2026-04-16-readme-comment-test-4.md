# Change request: README comment test 4

## Objective
Run another end-to-end packaging and Codex trigger test using a minimal documentation-only change.

## Scope
- Update `README.md` only.
- Add one short HTML comment line directly under the `# FPJC` heading.

## Constraints
- Do not change any other wording in `README.md`.
- Do not modify any other files.
- Keep the change minimal and reviewable.

## Acceptance criteria
- The packaging workflow creates the standard prompt output files under `.codex/outbox/`.
- A draft PR is opened back into `exp` from a `codex-request/` branch.
- The PR body starts with `@codex action this request`.
- If Codex treats the PR body mention as a trigger, it should add exactly one short HTML comment line directly under the heading in `README.md`.
- No other file changes are made by Codex.

## Validation
- Confirm the packaging PR contains only the generated prompt output files before any Codex edits.
- Confirm whether the PR body mention alone triggers Codex without a separate top-level comment.
- If Codex runs, confirm only `README.md` changed in addition to the packaged prompt files.
- Summarise the exact inserted comment in the PR thread.
