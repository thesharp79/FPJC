# Tenant registry contract

## Objective

Define the central tenant registry required to operate FPJC as a multi-club product with a shared runtime and per-club local spreadsheets.

The tenant registry is the control plane.
It is the authoritative place that tells the runtime which club exists, whether it is active, where its sheet lives, and how it should be routed.

## Why it is needed

Without a tenant registry, the product depends on:
- copied Apps Script projects
- manually set Script Properties
- ad hoc knowledge of which sheet belongs to which club

That is not supportable at scale.

## Current implementation guidance

In the Apps Script phase, the tenant registry can be implemented as:
- a central admin spreadsheet, or
- a central config sheet owned by the platform

Later it can move to:
- Firestore
- Postgres
- another durable central metadata store

The contract should remain stable even if the storage technology changes.

## Registry ownership

The tenant registry is platform-owned.
Club admins should not edit it directly unless there is a deliberate support/admin UI later.

## Core fields

Recommended minimum fields:

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `club_id` | text | Yes | Stable tenant identifier used in routing |
| `club_name` | text | Yes | Display/admin name |
| `status` | text | Yes | Lifecycle state |
| `spreadsheet_id` | text | Yes | Linked club sheet |
| `sheet_schema_version` | text | Yes | Expected club sheet schema version |
| `runtime_environment` | text | Yes | `DEV`, `TEST`, `PROD` |
| `payment_provider_type` | text | Yes | Current provider, e.g. `square` |
| `payment_provider_credential_ref` | text | Yes | Reference to centrally managed credentials |
| `payments_enabled` | boolean | Yes | Whether digital payments are enabled |
| `web_app_route_key` | text | Yes | Stable routing key or slug if separate from `club_id` |
| `club_config_mode` | text | Yes | Source of club config, initially `sheet` |
| `created_at` | datetime | Yes | Provisioning timestamp |
| `updated_at` | datetime | Yes | Last registry update |
| `notes` | text | No | Internal admin notes |

## Recommended additional fields

| Field | Type | Purpose |
|---|---|---|
| `migration_state` | text | Track migration phase |
| `owner_contact_name` | text | Internal commercial/admin reference |
| `owner_contact_email` | text | Internal commercial/admin reference |
| `square_location_id_ref` | text | Optional separate provider mapping reference |
| `last_validation_at` | datetime | Last successful tenant validation |
| `validation_status` | text | `valid`, `warning`, `error` |
| `onboarding_status` | text | Provisioning progress |
| `product_plan` | text | Optional commercial classification |
| `suspended_reason` | text | Optional support/compliance reason |

## Status values

Recommended `status` values:
- `provisioning`
- `active`
- `suspended`
- `archived`

The runtime should not serve tenant traffic for unsupported statuses.

## Migration state values

Recommended `migration_state` values:
- `single_tenant_legacy`
- `shared_runtime_sheet_config`
- `shared_runtime_hardened`
- `external_runtime_sheet_config`

This allows you to track where each club sits during the evolution from Apps Script hosting to a stronger external platform.

## Routing model

A tenant should be addressable through a stable identifier.

Recommended options:
- `club_id` in query string, e.g. `?club=abc123`
- route key or slug resolved by registry, e.g. `?club=fleming-park`

The runtime should never hardcode tenant spreadsheet IDs in code.

## Registry validation rules

Before serving a tenant, the runtime should validate:
- tenant exists
- tenant status allows runtime access
- spreadsheet ID is present
- schema version is supported
- payment provider type is supported
- credential reference is present when required

If validation fails, the runtime should stop and return an operator-safe error.

## Example registry row

| club_id | club_name | status | spreadsheet_id | sheet_schema_version | runtime_environment | payment_provider_type | payment_provider_credential_ref | payments_enabled | web_app_route_key | club_config_mode |
|---|---|---|---|---|---|---|---|---:|---|---|
| `fpjc-001` | Fleming Park Judo Club | `active` | `1abcDEF...` | `v1` | `PROD` | `square` | `square-prod-fpjc-001` | true | `fleming-park` | `sheet` |

## Security rules

The registry should store references to secrets, not the secrets themselves, wherever practical.

Do not store in the tenant registry:
- raw Square access tokens
- central admin secrets
- signing secrets

## Operational use cases

The registry should support:
- new club provisioning
- tenant lookup by club ID
- environment separation
- suspension of a tenant
- validation of a tenant before go-live
- future migration tracking

## Productisation implication

The tenant registry is the key step that removes dependence on copied runtime deployments and manual per-project property setup.
