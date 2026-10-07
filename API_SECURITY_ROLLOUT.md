# NEPAWatch API security rollout

Follow this order. The updated public API depends on the new database function, so `nepawatch-api` must be deployed last.

## 1. Protect the exposed keys

Both keys pasted into chat must be treated as exposed.

1. In the current Developer Dashboard, revoke the active free key.
2. Do not retry the unpaid Business checkout.
3. The SQL migration below will cancel and revoke old pending checkout records.
4. Create or rotate to a replacement free key after the new functions and dashboard are live. Save the replacement when it is shown because the dashboard will only show it once.

## 2. Run the database migration

1. Open Supabase Dashboard.
2. Select the NEPAWatch project.
3. Open **SQL Editor** and choose **New query**.
4. Copy the full contents of [`api-security-hotfix.sql`](api-security-hotfix.sql) into the editor.
5. Click **Run** once.

The final query must return `false` for all four privilege checks.

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

Run these checks in order:

1. Sign in to the Developer Dashboard and confirm the unpaid Business attempt is not shown as an active plan.
2. Create one free key and copy it immediately.
3. Refresh the page and confirm only the final four characters are shown.
4. Try creating another free key and confirm it is refused.
5. Call the public API once and confirm `requests_today` increases by one.
6. Rotate the free key and confirm the old key returns `403`.
7. Start a paid checkout, cancel it, and confirm no paid plan or usable key is activated.
8. Do not complete a real paid checkout until the cancelled checkout test passes.

After these checks pass, publish `developer.html` and `ops-7e11366b.html`.

