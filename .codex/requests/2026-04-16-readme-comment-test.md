# Change request: README comment test

## Objective
Create a minimal test change so we can verify the Codex request workflow end to end.

## Scope
- Update `README.md` only.
- Add a short comment line near the top of the file stating that the change was generated via the Codex request workflow test.

## Constraints
- Do not change any existing wording other than inserting the new comment line.
- Do not modify any other files.
- Keep the change minimal and reviewable.

## Acceptance criteria
- `README.md` contains a single added comment line near the top.
- The comment clearly indicates it was added by the Codex request workflow test.
- A pull request is opened back into `exp` from a new branch.

## Validation
- Confirm only `README.md` is changed.
- Summarise the exact inserted comment in the PR body.
