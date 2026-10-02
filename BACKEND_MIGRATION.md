# NEPAWatch backend migration

Status: investigation, 2026-10-02. No provider has been purchased or deployed.

## What is confirmed

- The public `model-status` endpoint returned HTTP 402 with `exceed_egress_quota`. Supabase says the project is restricted.
- The previous client fetched up to 1,000 reports every five seconds per open browser. A candidate `app.js` change reduces this to incremental polling every minute, with a bounded reconciliation every ten minutes. Its production effect has not been measured.
- Every open browser subscribes to nationwide `reports` INSERT and UPDATE events. Supabase bills Realtime egress for messages delivered to each subscriber, so this can grow with concurrent users.
- On INSERT, each receiving browser can call `send-alert`. The reporter also calls it. The `send-alert` server implementation is absent from this repo, so server-side deduplication is unknown. Move alert dispatch to one server-side handler per saved report before removing those browser calls.
- The AI engine recalculates probabilities from at most 2,000 recent human reports and calibrates area weights from scored outcomes. It does not train a standalone model on all collected reports.

## Decision

Do not move the current browser traffic pattern unchanged to another free host. It could exhaust that host's request or database limits too.

The first target to evaluate is a first-party API on Cloudflare Workers Paid with D1 and a static frontend on Pages. This has a $5/month base price and no transfer-egress charge, but request, CPU, database, and storage usage still need a budget. Workers Free has a hard 100,000 requests/day limit; D1 Free has hard daily row limits. Use those free tiers only if measured traffic fits with room for growth. HarmonWeb shared hosting has process and resource limits and terms against persistent background daemons, so it needs written confirmation before using it for live subscriptions or AI jobs.

## Sequence

1. Restore Supabase service through the account owner, then capture Usage → Egress by service, daily request counts, database size, active users, and cron logs. Changing spend caps or buying a plan needs Joshua's approval.
2. Make alert delivery idempotent on the server, keyed by report ID. Stop browsers from calling the shared alert endpoint for reports they merely receive.
3. Put a small, cacheable public feed and area-status API in front of the database. Keep login, reporting, confirmations, alerts, and AI jobs on Supabase while validating response parity and request volume.
4. Build and test replacement auth, reports, votes, subscriptions, payments, push, email, and AI jobs. Export and verify data, then dual-run and cut over with rollback available.
5. Retire Supabase only after the new backend handles actual peak traffic and its usage dashboard shows enough capacity.

## Sources

- Supabase Realtime egress: https://supabase.com/docs/guides/troubleshooting/realtime-egress-faq
- Cloudflare Workers pricing and limits: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/pricing/
- HarmonWeb shared hosting terms: https://harmonweb.com/terms/
