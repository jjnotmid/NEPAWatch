# Complimentary Starter access

Admins can upgrade a free API key to Starter without a Flutterwave payment.
The grant has no expiry, keeps the existing secret key and request counters,
and records the granting admin, timestamp and partnership reason on the key.
Starter defaults to 1,000 requests/day; `NW_LIMIT_STARTER`, when configured,
sets the limit just as it does for paid Starter subscriptions.

## Deploy

1. Select the NEPAWatch Supabase project (`djurokbkkqrmpafcxlez`). Run
   `api-partner-grants.sql` in its SQL Editor. Existing API security/billing
   migrations and `admin-security.sql` must already be installed.
   Do not rerun older cleanup migrations. Installing this feature adds columns
   and a function; it does not update any existing key rows. Only an explicit
   admin grant changes a selected key.
2. Deploy `supabase/functions/admin-action/index.ts` and
   `supabase/functions/developer-portal/index.ts`. Keep JWT verification on
   for both. No change to the payment provider or public API function is needed.
3. Publish `ops-7e11366b.html` and `developer.html` through the existing site
   deployment process.

## Grant access

Sign in to the admin dashboard and open **API Keys**. Identify the partner by
email and masked key, click **Grant Starter**, enter the partnership reason,
and confirm the recipient. Free keys in active or pending status are eligible.
The key becomes active Starter immediately; there is no checkout, charge,
subscription or renewal. The developer dashboard shows **Starter · Partnership**
with the daily allowance and **No expiry**.

Revoked keys and keys with any billing records are refused. For an unpaid
Starter checkout, abandon that checkout through the developer dashboard and
use a separate free key for the grant. Existing paid subscriptions retain their
normal payment flow. Admins can use **Revoke** to stop a partner key's access;
developers can also revoke or rotate their key normally.

## Verify

Use a test free key before granting the partner's key. Check the admin and
developer dashboards show Starter, complimentary access and the configured
daily limit. A read-only database check can confirm the saved attribution
without revealing the secret:

```sql
SELECT id, email, tier, status, daily_limit,
       partner_granted_at, partner_granted_by, partner_grant_reason
FROM public.api_keys
WHERE partner_granted_at IS NOT NULL
ORDER BY partner_granted_at DESC;
```

Retrying the same grant preserves its original attribution and request usage.
The database RPC is executable only by the service role and independently
checks that the supplied actor is in `admins`; the Edge Function gets that
actor from the verified session, never from the request body.
