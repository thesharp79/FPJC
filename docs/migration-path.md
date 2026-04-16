# Migration path

## Objective

Define the migration path from the current Apps Script-based club solution to a product-ready model with:
- one central runtime
- one local sheet per club
- central tenant routing
- a clean path to stronger hosting later

## Starting point

Current strengths:
- runtime code is now split into sensible config, repository, service, and helper files
- Google Sheets remains a workable local operational store
- Square is integrated as the current payment provider

Current limitations:
- club setup still leans too heavily on project-level assumptions
- Script Properties are not user-friendly in a copied-per-project model
- onboarding a new club is still too manual
- the current hosting model is not yet a true central shared runtime

## Migration design rule

The migration should change the runtime and control plane in stages.
It should not force a redesign of club-owned operational data.

## Target end state

### Stage 4 target
- central hosted runtime
- central tenant registry
- club sheet remains the local operational store
- club config lives in the sheet
- platform secrets live centrally
- payment provider accessed through an internal provider boundary

## Recommended stages

## Stage 0 - Current refactored baseline

Status:
- code separation largely complete
- still effectively shaped around a single-club or manually copied deployment model

Action outcome:
- stop major structural refactoring
- move to product architecture hardening

## Stage 1 - Standardise the club sheet contract

Goal:
Make every club sheet structurally predictable.

Actions:
- introduce `Club_Config` tab
- document required tabs and headers
- add `schema_version`
- define supported config keys
- define validation rules for tabs/headers/config

Success criteria:
- a new club sheet can be provisioned from a standard template
- club-specific values no longer depend on project-level properties

## Stage 2 - Introduce central tenant registry

Goal:
Create a control plane for clubs.

Actions:
- create central registry store
- define `club_id`
- map `club_id` to spreadsheet ID
- add tenant status / environment / payment provider fields
- update runtime to resolve a tenant context from `club_id`

Success criteria:
- runtime can serve different clubs based on a tenant identifier
- club spreadsheet IDs are no longer hardcoded or manually embedded per deployment

## Stage 3 - Remove club-specific dependency on Script Properties

Goal:
Make runtime deployable once per environment rather than once per club.

Actions:
- restrict Script Properties to platform-wide values and secret references only
- move class names, banner, club config, and safe feature flags into `Club_Config`
- update runtime config-loading logic to use tenant context + sheet config

Success criteria:
- a new club can be onboarded without opening Apps Script project settings
- a single runtime deployment can serve multiple clubs in principle

## Stage 4 - Add provider boundary around Square

Goal:
Avoid hard-coding the product to one long-term payment implementation.

Actions:
- define internal payment provider interface
- wrap current Square functions behind that interface
- move provider selection to tenant context / registry
- keep Square as the only active implementation for now

Success criteria:
- runtime business logic calls provider abstraction rather than Square-specific flows directly
- future payment providers can be added with less disruption

## Stage 5 - Build provisioning and validation tooling

Goal:
Make onboarding operationally repeatable.

Actions:
- create club provisioning checklist and tooling
- add sheet schema validator
- add tenant registry validator
- add payment-provider connection test
- add admin diagnostics / support tools

Success criteria:
- onboarding a new club becomes a defined repeatable process
- support operations do not require code edits

## Stage 6 - Move runtime to stronger hosting when uptake justifies it

Goal:
Change runtime host without changing the tenant model.

Actions:
- build equivalent runtime on external platform
- keep tenant registry contract stable
- keep club sheet schema contract stable
- replace Apps Script host with external runtime gradually
- keep Google Sheets integration in place during transition

Success criteria:
- existing clubs keep their local sheets
- the control plane remains stable
- migration mainly affects hosting, not tenant data ownership

## What should not change during migration

These should stay stable across stages wherever possible:
- `club_id`
- club sheet schema contract
- meaning of core basket/attendance/payment states
- tenant registry field semantics
- payment provider abstraction boundary

## What should change during migration

These are expected to evolve:
- runtime host technology
- secret storage approach
- tenant registry storage technology
- admin tooling sophistication
- provisioning automation depth

## Immediate next tranche

Recommended next work after structural refactor:

1. define and implement `Club_Config`
2. define and implement central tenant registry
3. remove club-specific dependency on Script Properties
4. add tenant context loading
5. harden Square behind provider boundary
6. build provisioning and validation tools

## Decision checkpoint for moving off Apps Script

Move runtime hosting off Apps Script only when one or more of these become true:
- operational complexity across clubs starts to grow materially
- support expectations exceed Apps Script convenience
- payment/provider integration demands stronger control
- background processing, observability, or resilience needs outgrow Apps Script

Until then, Apps Script can remain the runtime if the architecture is shaped like a shared product rather than a copied script.

## Productisation conclusion

The main refactor has put the codebase in a good place.
The next migration work is architectural and operational, not another round of file splitting.
