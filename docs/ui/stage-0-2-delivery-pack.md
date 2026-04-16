# MD3 UI Migration: Stage 0–2 Delivery Pack

## Purpose
This pack defines the first delivery tranche for migrating the FPJC UI to a Material Design 3 (MD3) aligned design system. It is intended to be used as the working baseline for:

- architecture review in ChatGPT
- implementation in Codex against the GitHub codebase
- staged delivery control through GitHub issues, pull requests and ADRs

This pack covers:

- Stage 0 — Mobilise and baseline
- Stage 1 — Target UI architecture
- Stage 2 — Design tokens and theme foundation

It does **not** authorise page-by-page visual restyling ahead of the token and component foundations.

---

## Delivery intent
The objective is to move the UI from a set of bespoke screens and CSS decisions to a controlled UI system with:

- semantic design tokens
- standard layout rules
- reusable UI components
- clear state handling
- a structure that supports later productisation and theming

The first three stages are deliberately architecture-heavy. They exist to prevent Codex from producing attractive but inconsistent screen-level changes.

---

## Operating model

### Roles
**ChatGPT**
- reviews architecture and design choices at each stage
- challenges drift from MD3 principles
- helps define acceptance criteria, ADRs and backlog items
- acts as the stage-gate reviewer before merge

**Codex**
- implements approved changes in GitHub
- refactors UI code, styles and structure
- updates repo documentation and creates pull requests

**GitHub**
- holds the single source of truth for code and artefacts
- provides the issue, ADR and PR control points

### Working rule
No UI implementation starts for a stage until:
1. the stage artefacts exist,
2. the stage decisions are recorded, and
3. the stage acceptance criteria are explicit.

---

# Delivery principles
These principles apply to all stages.

## 1. System before screens
Do not redesign individual screens until the token, component and layout model is defined.

## 2. Semantic over ad hoc
No new raw colours, arbitrary spacing values or one-off radii should be introduced once the token stage begins.

## 3. Reuse over reinvention
UI behaviour should be encoded in reusable patterns and components rather than copied between pages.

## 4. Operational speed matters
This is a task-oriented club operations app. UI decisions must support fast sign-in, payment handling and desk operation.

## 5. Accessibility is part of design quality
Contrast, tap targets, focus states, labels and validation states must be designed in from the start.

## 6. Productisation readiness is a design concern
The migration should leave the codebase in a state where later theming and white-labelling are possible without a major rewrite.

## 7. Refactor while migrating
Legacy CSS and duplicated UI patterns should be removed or marked for retirement as part of each delivery stage.

---

# Recommended repo structure
This structure should be treated as the target document layout for the UI migration work.

```text
/docs
  /ui
    stage-0-2-delivery-pack.md
    current-state-inventory.md
    target-ui-architecture.md
    design-tokens.md
    component-catalogue.md
    layout-and-navigation.md
    ui-review-checklist.md
  /adr
    ADR-000-template.md
    ADR-001-md3-adoption-model.md
    ADR-002-ui-folder-structure.md
    ADR-003-design-token-approach.md
```

This pack only creates the first anchor document. The remaining files should be created as part of Stage 0–2 implementation.

---

# Stage 0 — Mobilise and baseline

## Objective
Create control, visibility and delivery discipline before any MD3 migration work begins.

## Stage principles
- No restyling without evidence of the current state
- No code changes without a scoped migration target
- Keep governance lean, but explicit
- Make the current UI debt visible before fixing it

## Required artefacts
1. **Migration charter**
2. **Current state inventory**
3. **Screen map**
4. **Component inventory**
5. **CSS/style inventory**
6. **Known issues and inconsistency log**
7. **Definition of done for UI work**
8. **PR checklist for UI changes**
9. **ADR template**

## Decisions to make
1. **Migration scope**
   - whole app now
   - core journeys first
   - front-desk only first
2. **Migration mode**
   - MD3-inspired visual update only
   - MD3 component and interaction alignment
   - deeper system migration
3. **Framework approach**
   - stay with current Apps Script HTML/CSS/JS structure
   - add a lightweight UI structure layer
   - introduce a larger component framework
4. **Change boundary**
   - where legacy UI stops and the new UI starts
5. **Documentation location**
   - docs-only in repo
   - docs plus issue/ADR enforcement

## Backlog items
- Create `/docs/ui` and `/docs/adr` structure
- Create migration charter
- Create current-state inventory template and complete first pass
- Catalogue all user-visible screens
- Catalogue all shared and duplicated UI patterns
- Catalogue all hardcoded colour, spacing, radius and elevation values
- Record current pain points in sign-in, payment and admin flows
- Define UI delivery definition of done
- Define PR checklist for UI migration work

## Deliverables expected from Codex
- docs folder structure
- migration charter file
- current-state inventory file
- ADR template file
- PR checklist file
- any lightweight repo housekeeping needed to support the work

## ChatGPT architecture review gate
Review the following before Stage 0 closes:
- Is the migration scope realistic for the codebase?
- Is the current-state inventory complete enough to make structural decisions?
- Has the team avoided jumping into restyling before baseline analysis?
- Is the working model with ChatGPT and Codex clear enough to prevent drift?

## Exit criteria
- Current screens and UI patterns are catalogued
- Migration scope is recorded
- Delivery rules are documented in the repo
- Stage 1 can start without ambiguity

---

# Stage 1 — Target UI architecture

## Objective
Define the UI architecture that the MD3 migration will move toward.

## Stage principles
- Separate design system concerns from feature screen concerns
- Keep the architecture simple enough for Apps Script delivery
- Optimise for maintainability and consistency, not theoretical purity
- Solve structure first, then style and then screen content

## Required artefacts
1. **Target UI architecture document**
2. **MD3 adoption model**
3. **UI folder structure decision**
4. **Layout shell model**
5. **Navigation model**
6. **State handling model**
7. **Responsive support matrix**
8. **Decision log / ADRs**

## Decisions to make
1. **How pure the MD3 implementation should be**
   - MD3-inspired visual language only
   - MD3-aligned custom component layer
   - deeper MD3 interaction and state alignment
2. **How the UI is structured in code**
   - location of tokens
   - location of components
   - location of layouts
   - location of feature screens
3. **Theme strategy**
   - dark only initially
   - light and dark
   - branded theme with future override model
4. **Navigation model**
   - single linear flow for core journeys
   - shared shell with contextual navigation
5. **State model**
   - loading, success, warning, error, disabled, selected, focused
6. **Supported device classes**
   - mobile only
   - mobile plus tablet
   - desktop admin support

## Backlog items
- Draft target UI architecture
- Draft MD3 adoption statement for this app
- Define target file/folder pattern for UI code
- Define layout shell responsibilities
- Define shared navigation rules
- Define page template structure
- Define UI states and how they render
- Define responsive breakpoints and support intent
- Raise ADRs for adoption model, folder structure and theme approach

## Deliverables expected from Codex
- repo documents for target architecture
- any agreed folder/file scaffolding
- lightweight shell placeholders only where needed
- no full screen rebuilds in this stage

## ChatGPT architecture review gate
Review the following before Stage 1 closes:
- Is the target architecture proportionate to the size and maturity of the app?
- Has the design system layer been cleanly separated from feature pages?
- Is the navigation model appropriate for front-desk use?
- Does the architecture support later white-labelling without a second rewrite?

## Exit criteria
- There is a documented target UI structure
- Key architectural decisions are in ADR form
- There is a clear place for token, layout and component code to live
- Stage 2 can begin without structural uncertainty

---

# Stage 2 — Design tokens and theme foundation

## Objective
Create the semantic token layer that future components and screens must consume.

## Stage principles
- Tokens before components
- Semantic roles, not raw values
- Visual consistency should be encoded, not remembered
- Theme foundations must support future branding flexibility

## Required artefacts
1. **Design token specification**
2. **Theme foundation document**
3. **Colour role mapping**
4. **Typography scale**
5. **Spacing scale**
6. **Shape/radius scale**
7. **Elevation model**
8. **State overlay rules**
9. **Status colour usage rules**
10. **Contrast and accessibility review note**

## Decisions to make
1. **Colour role model**
   - primary, secondary, tertiary if needed
   - surface, background, surface-container variants
   - on-colour and on-surface text roles
2. **Typography scale**
   - heading hierarchy
   - form labels and helper text
   - dense operational text sizes
3. **Spacing scale**
   - standard increments
   - container padding rules
   - gap rules between controls and sections
4. **Shape and elevation usage**
   - small/medium/large radii
   - when elevation is used and when it is not
5. **Interaction states**
   - hover
   - pressed
   - focused
   - disabled
   - selected
   - error
6. **Brand retention strategy**
   - which current colours survive
   - what becomes tokenised as theme rather than hardcoded branding

## Backlog items
- Define token naming convention
- Map current hardcoded values to semantic token targets
- Create first token set for colour, typography, spacing, shape and elevation
- Define state styles for controls and interactive surfaces
- Define status treatment for success, warning, error and informational patterns
- Check contrast and readability for likely dark-surface usage
- Record any deliberate deviations from default MD3 behaviour in an ADR

## Deliverables expected from Codex
- token files or token variables in agreed structure
- theme documentation in repo
- base styling aligned to token usage
- no new raw styling values in new work

## ChatGPT architecture review gate
Review the following before Stage 2 closes:
- Are token names semantic and scalable?
- Has the team avoided baking screen-specific assumptions into the token model?
- Do the selected colour roles and text roles remain readable in real usage conditions?
- Is the token model suitable for future club branding overrides?

## Exit criteria
- Design tokens exist in code and documentation
- New UI work can be built without raw visual constants
- The repo is ready for layout shell and component work

---

# Required ADR backlog for Stage 0–2
The following ADRs should be raised during this pack.

## ADR-001 — MD3 adoption model
Record:
- why MD3 is being adopted
- how strictly it will be followed
- what is intentionally outside scope

## ADR-002 — UI folder structure
Record:
- where tokens, layouts, components and screens live
- how shared CSS and utility logic are organised

## ADR-003 — Token implementation approach
Record:
- CSS variables, JS theme object, or hybrid
- naming convention and ownership rules

## ADR-004 — Theme strategy
Record:
- dark/light approach
- branding boundaries
- future override intent

## ADR-005 — Supported device classes
Record:
- primary target devices
- admin-only wider view support if applicable

---

# GitHub issue breakdown for Stage 0–2
Create these as individual issues or sub-issues under one migration epic.

## Epic
**Title:** MD3 UI Migration — Stage 0–2 Foundations

**Body:**
Establish the governance, architecture and token foundations for migrating FPJC to an MD3-aligned UI system. This epic excludes screen-level restyling beyond what is required to validate structure and token use.

### Stage 0 issues
1. Create UI migration charter
2. Create current-state UI inventory
3. Catalogue screens, components and CSS inconsistencies
4. Create ADR template and decision log
5. Create UI PR checklist and definition of done

### Stage 1 issues
6. Define target UI architecture
7. Define MD3 adoption model
8. Decide UI folder structure and theme strategy
9. Define navigation, layout shell and state model
10. Define device support matrix

### Stage 2 issues
11. Define design token naming convention
12. Implement colour, typography, spacing, shape and elevation tokens
13. Define interaction and validation state rules
14. Document status colour usage and accessibility constraints
15. Remove or prevent new hardcoded visual constants in new work

---

# Pull request checklist for Stage 0–2 and later reuse
Use this checklist in UI-related PRs.

- [ ] Scope aligns to the current stage and does not skip the agreed sequence
- [ ] Required artefacts have been updated in `/docs/ui` and `/docs/adr`
- [ ] New UI decisions are recorded in ADR form where required
- [ ] No new ad hoc colours, spacing values, radii or elevations have been introduced
- [ ] New or updated UI logic is consistent with the target architecture
- [ ] Accessibility implications have been considered for labels, contrast, focus and touch targets
- [ ] Legacy patterns removed in scope have been deleted or explicitly marked for retirement
- [ ] The change is suitable for ChatGPT design/architecture review before merge

---

# Stage-gate review template for ChatGPT
Use the following prompt structure when bringing a stage or PR back for review.

## Prompt template
> Review the attached repo changes against the MD3 UI migration pack.
> Stage: [0 / 1 / 2 / later]
> Scope: [describe]
> Please assess:
> 1. alignment to the pack principles,
> 2. whether any architectural drift has been introduced,
> 3. whether the artefacts and ADRs are sufficient,
> 4. whether the implementation is ready to merge,
> 5. what technical debt remains.

---

# Templates
The following templates should be copied into separate repo documents as Stage 0–2 implementation proceeds.

## Template A — Migration charter
```md
# UI Migration Charter

## Objective
[Define the business and technical purpose of the migration]

## Scope
[What is in scope]

## Out of scope
[What is not being changed yet]

## Delivery principles
- [principle]
- [principle]

## Delivery model
- ChatGPT review role
- Codex implementation role
- GitHub control points

## Risks
- [risk]
- [risk]

## Success measures
- [measure]
- [measure]
```

## Template B — Current state inventory
```md
# Current State UI Inventory

## Screens
| Screen | Purpose | Primary users | Current issues | Notes |
|---|---|---|---|---|

## Shared components / patterns
| Pattern | Where used | Variants | Issues |
|---|---|---|---|

## Hardcoded style values
| Type | Value | Where used | Proposed token |
|---|---|---|---|

## UX pain points
| Journey | Pain point | Severity | Notes |
|---|---|---|---|
```

## Template C — Target UI architecture
```md
# Target UI Architecture

## Goals
[What this architecture must achieve]

## Structure
- tokens
- components
- layouts
- screens
- utilities

## Responsibilities by layer
### Tokens
[role]

### Components
[role]

### Layouts
[role]

### Screens
[role]

## Navigation model
[description]

## State model
[description]

## Device support
[description]
```

## Template D — Design token specification
```md
# Design Token Specification

## Colour tokens
| Token | Purpose | Value | Notes |
|---|---|---|---|

## Typography tokens
| Token | Purpose | Size/weight | Notes |
|---|---|---|---|

## Spacing tokens
| Token | Value | Usage |
|---|---|---|

## Shape tokens
| Token | Value | Usage |
|---|---|---|

## Elevation tokens
| Token | Usage |
|---|---|

## State tokens
| State | Treatment | Notes |
|---|---|---|
```

## Template E — ADR
```md
# ADR-XXX — [Title]

## Status
Proposed

## Context
[Why the decision is needed]

## Decision
[What has been decided]

## Consequences
### Positive
- [item]

### Negative
- [item]

## Follow-up actions
- [item]
```

---

# Recommended next action
After this pack is committed, the next working step should be to create the Stage 0 artefacts in repo form and complete the current-state inventory before asking Codex to touch live UI code.
