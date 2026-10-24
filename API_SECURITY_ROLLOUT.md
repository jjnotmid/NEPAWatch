# NEPAWatch API security rollout

This documents an earlier security rollout. For the current complimentary
Starter feature, follow [PARTNER_STARTER_ROLLOUT.md](PARTNER_STARTER_ROLLOUT.md).
Do not run the historical key-cleanup migration for the partnership feature.

## 1. Preserve existing keys

There is no basis for the previous claim that keys were pasted into chat.
Do not revoke, rotate, replace, cancel, or upgrade any existing key as part
of deployment. A partnership upgrade happens only when an admin deliberately
selects that key and confirms **Grant Starter**.

## 2. Historical database migration

Do not run [`api-security-hotfix.sql`](api-security-hotfix.sql) unchanged under
the current request. It contains updates to existing rows, including pending
checkout cleanup and duplicate-free-key revocation. If security schema changes
are still needed, prepare a separate migration that preserves existing keys.

The migration also:

- adds all API tiers, so the older tier fix does not need to be run separately;
- blocks direct client writes to API keys and client reads of subscriptions;
- cancels pending checkouts older than one hour;
- enforces one active free key per account;
- keeps the most recently used free key if an account currently has several;
- installs the atomic daily quota function used by the public API.

If the SQL editor reports an error, stop before deploying `nepawatch-api` and send the complete error text.

## 3. Deploy the Edge Functions

In Supabase Dashboard, open **Edge Functions**, select each function, open its code editor, replace `index.ts` with the matching local file, and deploy a new version.

Deploy in this order:

1. `admin-action` from [`supabase/functions/admin-action/index.ts`](supabase/functions/admin-action/index.ts)
2. `developer-portal` from [`supabase/functions/developer-portal/index.ts`](supabase/functions/developer-portal/index.ts)
3. `api-billing` from [`supabase/functions/api-billing/index.ts`](supabase/functions/api-billing/index.ts)
4. `flw-webhook-router` from [`supabase/functions/flw-webhook-router/index.ts`](supabase/functions/flw-webhook-router/index.ts)
5. `training-data` from [`supabase/functions/training-data/index.ts`](supabase/functions/training-data/index.ts)
6. `nepawatch-api` from [`supabase/functions/nepawatch-api/index.ts`](supabase/functions/nepawatch-api/index.ts)

Use these JWT settings:

| Function | Verify JWT |
| --- | --- |
| `admin-action` | On |
| `developer-portal` | On |
| `training-data` | On |
| `api-billing` | Off |
| `flw-webhook-router` | Off |
| `nepawatch-api` | Off |

The three functions with JWT off perform their own authentication. Billing and the webhook router verify Flutterwave events with the webhook hash. The public data API validates `X-API-Key` through the atomic database function.

## 4. Check Edge Function secrets

Open **Project Settings**, then **Edge Functions**, then **Secrets**. Confirm these names exist. Do not copy their values into chat.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FLW_SECRET_KEY`
- `FLW_WEBHOOK_HASH`

Add this if it does not exist:

```text
NW_PUBLIC_ORIGIN=https://nepawatch.app
```

## 5. Check the Flutterwave webhook

The Flutterwave webhook URL should be:

```text
https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/flw-webhook-router
```

Its secret hash must match the Supabase `FLW_WEBHOOK_HASH` secret. Do not make electricity payment public. The router keeps electricity and API billing as separate consumers.

## 6. Verify before publishing the dashboard

The following checks belong in a staging environment with a dedicated test
account and disposable test key. Do not apply them to existing production keys.

1. Sign in to the test Developer Dashboard and confirm unconfirmed checkouts are not shown as active plans.
2. Create one free key and copy it immediately.
3. Refresh the page and confirm only the final four characters are shown.
4. Try creating another free key and confirm it is refused.
5. Call the public API once and confirm `requests_today` increases by one.
6. Rotate the free key and confirm the old key returns `403`.
7. Start a paid checkout, cancel it, and confirm no paid plan or usable key is activated.
8. Do not complete a real paid checkout until the cancelled checkout test passes.

After these checks pass, publish `developer.html` and `ops-7e11366b.html`.

## If `api-billing` returns 500

Repeated `500` responses after a checkout return usually mean the dashboard is
polling payment status while the billing database migration is incomplete.

In Supabase SQL Editor, run this read-only check:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'api_subscriptions'
  AND column_name IN ('checkout_url', 'checkout_expires_at')
ORDER BY column_name;
```

Both column names must be returned. If either is missing, prepare a schema-only
migration; do not run the historical key-cleanup migration. Also confirm the Edge Function secret
is exactly `NW_PUBLIC_ORIGIN=https://nepawatch.app`, with no trailing slash.

If both columns and the origin are correct, open **Edge Functions → api-billing
→ Logs**, retry once, and inspect the newest line beginning with `api-billing:`.
Do not copy access tokens, API keys, or secret values into support messages.
