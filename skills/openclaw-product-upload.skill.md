# OpenClaw Product Upload Skill (Turtle Album)

## Goal

Provide a strict, repeatable upload workflow for OpenClaw agents:

- ask complete product data
- explicitly confirm sire/dam lineage before upload
- upload through project script (not ad-hoc API calls)
- verify by readback after write

## Required References (read first)

Before collecting data, the agent must align with:

1. `docs/turtle-album/FIELD_NAMING_AND_BUSINESS_RULES.md`
2. `README.md` (project run/deploy conventions)

## Non-Negotiable Rules

1. **Write keys must be snake_case only**
   - use `sire_code` / `dam_code`
   - do not send camelCase write fields (`sireCode`, `damCode`, etc.)

2. **Lineage is mandatory in the questioning phase**
   - the agent must ask both sire and dam explicitly
   - each lineage field must end in one of:
     - concrete code value
     - explicit unknown confirmation (`null`)

3. **No fuzzy-first update targeting**
   - do not update by "first search hit"
   - rely on script safeguards for duplicate code handling

4. **Use script for upload**
   - always upload via:
     - `scripts/openclaw_upload_product.py`
   - avoid direct manual API write calls from ad-hoc flow

5. **Readback verification is required**
   - success response must include:
     - product id
     - code
     - sireCode
     - damCode

## Standard Workflow

### Phase 1: Environment confirmation

Ask target environment:

- `dev` (default)
- `staging`
- `prod` (requires explicit confirmation)

If `prod`, require explicit acknowledgment before running script.

### Phase 2: Mandatory data collection

Collect at least:

- `code`
- `name`
- `stage` (default `hatchling`)
- `status` (default `active`)
- `sire_code` (required question; value or null confirmation)
- `dam_code` (required question; value or null confirmation)

Optional (if provided):

- `description`
- `series_id`
- `sex`
- `price`
- `in_stock`

### Phase 3: Explicit lineage confirmation

The agent must ask exactly this intent for both fields:

- "Please provide sire_code; if unknown, confirm write as null."
- "Please provide dam_code; if unknown, confirm write as null."

Do not continue until both are resolved.

### Phase 4: Build payload and run script

Preferred command:

```bash
python3 scripts/openclaw_upload_product.py \
  --env <dev|staging|prod> \
  --username <admin_username> \
  --password '<admin_password>' \
  --payload-file <payload.json> \
  [--confirm-prod]
```

Payload template can start from `scripts/openclaw_payload.example.json`.

Fallback (interactive mode):

```bash
python3 scripts/openclaw_upload_product.py \
  --env <dev|staging|prod> \
  --username <admin_username> \
  --password '<admin_password>' \
  [--confirm-prod]
```

### Phase 5: Readback and report

Report upload result only after script readback passes:

- product id
- code
- sireCode
- damCode

If duplicate code blocks update, request explicit target id and rerun.

## Response Template (for OpenClaw agent)

1. **Collected fields summary**
2. **Lineage confirmation summary**
   - sire_code: `<value|null>`
   - dam_code: `<value|null>`
3. **Script command executed**
4. **Readback verification result**
5. **Next action if failed** (duplicate code / auth error / validation error)

## Forbidden Patterns

- writing lineage only inside description text
- mixing `sireCode` and `sire_code` in write payload
- claiming success without readback verification
- skipping sire/dam questions in upload flow
