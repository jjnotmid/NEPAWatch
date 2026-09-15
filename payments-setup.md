# NEPAWatch — Electricity Bill Payment Setup

**Flutterwave collects · Pairgate fulfils · Webhooks keep both in sync**

Status: **pre-launch**. The company is not CAC-registered yet, so we run on a
Flutterwave **Starter account** (personal BVN/NIN) for payments, and
**Pairgate** for everything the payment buys — meter verification and
electricity token vending. Flutterwave's Bills API is blocked for unregistered
accounts, which is exactly why fulfilment lives on Pairgate.

## The flow

```
Customer (topup.html)
   │  paste meter → auto-detect DISCO (Pairgate /electricity/verify × providers)
   │  pick amount (from ₦1,000) → transparent fee (3%, capped ₦500)
   ▼
Flutterwave checkout (collect) ── paid ──▶ FLW webhook (verif-hash) or redirect poll
   ▼
Pairgate /electricity/purchase (fulfil, dedupe by our reference)
   ▼
Pairgate webhook (HMAC-SHA256) delivers the token (`pin`) — or we poll
GET /transaction/status?reference_code=… as the backup
   ▼
Success screen shows the token · postpaid shows "bill paid"
```

Every hand-off is idempotent (the `electricity_transactions` row is the
ledger), and every webhook is signature-verified — fake events are discarded.

## 1. Accounts & keys you need

| Where | What | Notes |
|---|---|---|
| Flutterwave dashboard | Live secret key (`FLWSECK-…`) | Settings → API Keys. Starter account = collection + withdrawal to your bank (settles to the FLW MFB account). Bills API **not** available — Pairgate replaces it. |
| Flutterwave dashboard | Webhook secret hash | Settings → Webhooks → URL below + a secret hash you invent. |
| Pairgate dashboard | API key | Settings → API Keys → becomes `PAIRGATE_SECRET_KEY`. |
| Pairgate dashboard | Fund the wallet | Vending deducts from this balance — keep float in it. |
| Pairgate dashboard | Webhook URL + secret | Set URL below; enable **Webhook Verification** and copy the shown-once secret → `PAIRGATE_WEBHOOK_SECRET`. |

**Webhook URL (both providers point at the same function):**

```
https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/buy-electricity
```

⚠️ Not `supabase.com/dashboard/...` — that's the dashboard page. The
`/functions/v1/<name>` form is correct: `<project-ref>.supabase.co/functions/v1/buy-electricity`.

## 2. Pricing, limits, minimums

- **Service fee**: 3% of the units, capped at ₦500 (env `NW_FEE_PCT` / `NW_FEE_CAP` / `NW_FEE_MIN`). Shown line-by-line before payment.
- **Minimum purchase**: ₦1,000 — Pairgate's floor for electricity.
- **FLW Starter collection limits**: ₦500,000 per transaction and ₦500,000 per day. The function enforces both up front with friendly messages (`NW_MAX_SINGLE_TX` / `NW_DAILY_LIMIT`).
- **Pairgate wallet**: must hold enough float; failed vends auto-refund the Pairgate wallet, the customer refund stays manual (FLW dashboard) for now.

## 3. Wire secrets into Supabase

Dashboard → project `djurokbkkqrmpafcxlez` → **Settings → Edge Functions → Secrets**, or CLI:

```bash
supabase secrets set \
  FLW_SECRET_KEY=FLWSECK-xxx \
  FLW_WEBHOOK_HASH='<your-invented-hash>' \
  PAIRGATE_SECRET_KEY='<pairgate-key>' \
  PAIRGATE_WEBHOOK_SECRET='<pairgate-webhook-secret>' \
  NW_FEE_PCT=3 NW_FEE_CAP=500 NW_FEE_MIN=0
```

## 4. Database + deploy

1. Run `electricity-tables.sql` (transactions table, `vw_electricity_totals`
   for the admin dashboard, `meter_disco_cache` for auto-detect).
2. Deploy: `supabase functions deploy buy-electricity --project-ref djurokbkkqrmpafcxlez`
3. Register webhooks (see §1) — FLW with your secret hash, Pairgate with
   verification ON.
4. Pairgate **IP whitelisting**: if their dashboard enforces it, confirm with
   support that Supabase's shared egress IPs are OK (same caveat FLW had).

## 5. Test before going live

0. **Providers check** — POST `{action:"billers"}` → live Pairgate electricity
   providers with `usingFallback:false` (also proves the key + IP whitelist).
1. **Auto-detect** — POST `{action:"detect", number:"<meter>"}` → DISCO +
   meter type without picking one.
2. **Meter verify** — POST `{action:"verify", provider:"ikeja-electric",
   number:"<meter>", type:"prepaid"}` → customer name, minimum ₦1,000,
   fee params.
3. **Buy** — `initiate` → FLW checkout → pay → token appears (Pairgate
   webhook or status poll) and `electricity_transactions` shows `success`.
4. **Closed-tab test** — pay then close the tab: the FLW webhook must still
   trigger the vend and the Pairgate webhook must still deliver the token.
   A bad/missing `verif-hash` → 401; a bad Pairgate HMAC → 401.
5. **Postpaid** — one small postpaid payment credits the meter (no token).
6. Admin dashboard shows Delivered / Total Processed / Fees Earned.

## 6. Go-live checklist

- [ ] Pairgate wallet funded; webhook URL + verification secret set
- [ ] Secrets set (both FLW and Pairgate keys) · SQL run · function deployed
- [ ] `billers` check green · detect works · ₦1,000 smoke test delivered a token
- [ ] FLW webhook + Pairgate webhook both verified end-to-end
- [ ] Google provider enabled in Supabase Auth (post-purchase "reports" sign-up
      button) with `https://nepawatch.app/topup.html` allowed as redirect
- [ ] Token-by-email: currently on-screen only — TODO wire a mail provider
      (e.g. Resend) to also email the token to the customer's address
- [ ] Watch the ₦500k/day FLW cap; raise only after CAC registration

## How this maps to the official docs

| Concern | Reference |
|---|---|
| FLW checkout + verify + webhook best practices (`verif-hash`, idempotency, re-verify amount/currency) | developer.flutterwave.com → Standard, Transaction Verification, Webhooks |
| Pairgate providers / verify / purchase / status / webhook HMAC | pairgate.com/developers → electricity-providers, electricity-verify, electricity-purchase, transaction-status, webhooks |
| Signature check | HMAC-SHA256(`secret`, `timestamp + "." + raw_body`) — implemented in `buy-electricity` |
| `liquidslr/system-design-notes` | contains no payment-provider material — generic system-design notes; not used |

KYC: the only KYC in this system is the merchant onboarding (Flutterwave
Starter BVN/NIN and Pairgate sign-up). Customer-side KYC was removed from the
app entirely — neither provider requires it for bill payments.

## After CAC registration (later)

- Optional: re-enable FLW Bills API and compare rates against Pairgate — the
  Pairgate calls in `buy-electricity` are isolated in `pgVerifyMeter` /
  `pgVend` / `pgStatus`, so swapping vendors touches only those three
  functions.
- Raise FLW collection limits (`NW_MAX_SINGLE_TX` / `NW_DAILY_LIMIT`).

## Fallback plan

If Pairgate has an outage or the account is suspended: point `pgVend` /
`pgVerifyMeter` / `pgStatus` at another VTU vendor (or FLW Bills once
registered). Collection (Flutterwave) is untouched — the flow is built so
fulfilment vendors are swappable without touching the payment path.
