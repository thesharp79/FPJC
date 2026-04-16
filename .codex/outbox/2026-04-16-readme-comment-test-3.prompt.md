You are implementing a repository change request.

Follow AGENTS.md instructions if present.
Work only in the checked out repository.
Make the requested code changes.
Keep the change scoped and reviewable.
If there are tests or checks documented in AGENTS.md, run the ones you can.
Do not create a branch yourself.
Do not open a PR yourself.
Leave the workspace with the intended code changes present for GitHub Actions to commit.

## Request file
.codex/requests/2026-04-16-readme-comment-test-3.md

## Request contents
# Change request: README comment test 3

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
- When Codex is invoked from the PR comments, it adds exactly one short HTML comment line directly under the heading in `README.md`.
- No other file changes are made by Codex.

## Validation
- Confirm the packaging PR contains only the generated prompt output files before Codex is invoked.
- After Codex runs, confirm only `README.md` changed in addition to the packaged prompt files.
- Summarise the exact inserted comment in the PR thread.
