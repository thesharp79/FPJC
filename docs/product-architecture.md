# Product architecture

## Objective

Define the target product model for FPJC so the application can be sold to multiple clubs without creating a separate long-term code fork or support model for each one.

## Target operating model

The target model is:

- **one centrally hosted application/runtime**
- **one local spreadsheet per club**
- **club-owned operational data and club settings in the local spreadsheet**
- **platform-owned tenant routing and secrets managed centrally**
- **payment provider integration behind an internal provider boundary**

This model allows the current Google Apps Script implementation to remain viable in the short term while keeping a clean migration path to a more robust hosting platform later.

## Core design principles

### 1. Shared runtime, not copied runtime
The product should not depend on copying a full Apps Script project per club.
The runtime should be treated as a centrally managed product service.

### 2. Club sheet as tenant data store
Each club keeps its own Google Sheet for operational control and local visibility.
The sheet is a tenant data store, not the product host.

### 3. Separate club configuration from platform secrets
Club-maintainable configuration should live in the club sheet.
Secrets and platform-owned settings should live centrally.

### 4. Treat Google Apps Script as the current runtime, not the permanent runtime
The architecture should support migration from Apps Script to another host later without forcing a redesign of tenants, configuration, or the local sheet model.

## Target runtime model

### Current phase
- **Runtime**: central standalone Google Apps Script web app
- **Club operational store**: Google Sheets
- **Tenant registry**: central admin sheet or central metadata store
- **Payments**: Square only

### Future phase
- **Runtime**: Cloud Run, Node.js, or another centrally hosted platform
- **Club operational store**: still Google Sheets initially
- **Tenant registry**: Firestore, Postgres, or another central store
- **Payments**: Square plus optional later providers behind an adapter boundary

## Target logical components

### 1. Central runtime
Responsibilities:
- serve the sign-in user experience
- resolve tenant context from a club identifier
- apply business rules
- read/write club data from the linked sheet
- call the configured payment provider
- expose admin and support operations

### 2. Club sheet
Responsibilities:
- members
- attendance
- baskets and basket lines
- payment options
- local branding / class names / operational settings
- local audit and reporting visibility for the club

### 3. Tenant registry
Responsibilities:
- map `clubId` to spreadsheet ID
- hold tenant lifecycle status
- hold payment provider type and credential reference
- hold deployment state and migration state
- support provisioning and support operations

### 4. Payment provider adapter
Responsibilities:
- create checkout / payment link
- resolve payment
- sync catalogue / chargeable items where needed
- test connection

Square is the only current implementation, but the application should call an internal provider interface rather than hard-coding product logic directly to Square assumptions.

## Recommended request flow

1. User opens the application using a club-specific URL or link containing a stable tenant identifier.
2. Runtime resolves `clubId` from the request.
3. Runtime looks up tenant metadata in the central tenant registry.
4. Runtime loads the linked club spreadsheet ID.
5. Runtime reads club configuration from the club sheet.
6. Runtime executes business logic using club config + tenant context.
7. Runtime writes operational data back to the club sheet.
8. Runtime uses the configured payment provider for payment operations.

## Tenant context

Every runtime request should build a single tenant context object.

Suggested contents:
- `clubId`
- `spreadsheetId`
- `tenantStatus`
- `clubConfig`
- `paymentProviderType`
- `paymentProviderCredentialRef`
- `branding`
- `environment`
- `schemaVersion`

The rest of the application should operate against this context rather than pulling tenant assumptions from scattered properties.

## Configuration split

### Club-owned configuration
Store in the club sheet.
Examples:
- club name
- class/session names
- banner URL
- display wording
- support contact text
- enabled features that are safe for the club to control
- local branding values

### Platform-owned configuration
Store centrally.
Examples:
- central runtime settings
- platform secrets
- payment provider credential references
- tenant registry entries
- deployment/environment settings

## Script Properties policy

Script Properties should no longer be used for club-specific setup in a copied-project model.

Use Script Properties only for:
- platform-wide settings
- central runtime configuration
- secret references
- central registry pointers

Do not use Script Properties for:
- club class names
- club sheet IDs in a per-club deployment model
- values that a club admin may need to maintain

## Environments

The platform should support at least:
- `DEV`
- `TEST` or `UAT`
- `PROD`

Environment separation should exist for:
- runtime deployment
- tenant registry entries
- linked spreadsheets
- payment provider credentials

## Product boundary assumptions

### Fixed by the product
- overall sheet schema contract
- basket and attendance flow
- payment lifecycle model
- central runtime behaviour
- tenant registry model

### Configurable by a club
- club name
- class names
- banner / branding content
- payment option values supported by the defined schema
- operational wording where safe

### Deferred for later
- multiple payment providers in production
- full removal of Google Sheets as the local operational store
- true multi-region or enterprise-grade hosting patterns

## Why this architecture is the right next step

This model gives:
- easier onboarding of new clubs
- fewer manual setup steps
- cleaner upgrade path
- less risk of configuration drift between clubs
- smoother migration from Apps Script to a stronger hosting platform later

## Productisation implication

From a code-structure perspective, the application is already largely ready.
The remaining productisation work is now about:
- central tenant routing
- club config contract
- provisioning process
- operational hardening
- migration-friendly runtime boundaries
