# Change request: packaging test README comment

## Objective
Verify the zero-cost Codex request packaging workflow end to end.

## Scope
- Update `README.md` only.
- Add one short comment line near the top of the file.

## Constraints
- Do not change any existing wording other than inserting the new comment line.
- Do not modify any other files.
- Keep the change minimal and reviewable.

## Acceptance criteria
- The workflow packages this request into a generated prompt file under `.codex/outbox/`.
- The workflow updates `.codex/outbox/LATEST.prompt.md`.
- A draft PR is opened back into `exp` from a `codex-request/` branch.
- No OpenAI API call is made by GitHub Actions.

## Validation
- Confirm the PR contains only the packaged prompt output files.
- Confirm the PR body references this request file.
- Confirm no code changes to `README.md` were made by the workflow itself.
