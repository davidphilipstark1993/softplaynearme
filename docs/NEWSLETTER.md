# Newsletter system

Weekly newsletter + events & offers emails, built on this project's own stack (Neon Postgres via
`pg`, the existing `admin_session` cookie auth, the existing `lib/email.ts` SendGrid pattern) —
not copied from Listen True Crime, which turned out to have no working send/approval/SendGrid
system to copy (see PR description / commit message for what was actually found there).

## Setup checklist (manual steps)

1. **Run the schema migration once** against the database:
   ```
   node scripts/setup-newsletter-schema.mjs
   ```
   Idempotent — safe to re-run. Creates `newsletter_subscribers`, `newsletters`,
   `newsletter_items`, `newsletter_sends`.

2. **Vercel project env vars** (Production + Preview):
   | Variable | Required | Notes |
   |---|---|---|
   | `SENDGRID_API_KEY` | yes | Already used by `lib/email.ts` — same key. |
   | `SENDGRID_FROM_EMAIL` | no | Defaults to `david@softplaynearme.co.uk` (the only currently-verified SendGrid sender). Set once a domain/sender is properly authenticated for bulk mail. |
   | `SENDGRID_FROM_NAME` | no | Defaults to `Soft Play Near Me`. |
   | `SENDGRID_UNSUBSCRIBE_GROUP_ID_WEEKLY` | no | SendGrid ASM group id for the weekly list, if you set one up in SendGrid's suppression groups. Our own unsubscribe/preferences flow is authoritative either way — this only adds SendGrid's own list-unsubscribe footer/suppression. |
   | `SENDGRID_UNSUBSCRIBE_GROUP_ID_EVENTS` | no | Same, for the events & offers list. |
   | `CRON_SECRET` | yes | Bearer token the Sunday GitHub Action uses to call `/api/cron/send-newsletter`. Generate any long random string. |
   | `ADMIN_SECRET` | already set | Reused — same password gates `/admin/newsletter`. |
   | `DATABASE_URL` | already set | Reused. |

3. **GitHub repo secret**: add `CRON_SECRET` under Settings → Secrets and variables → Actions,
   with the **exact same value** as the Vercel `CRON_SECRET`. Optionally add a repo **variable**
   `SITE_URL` if the production URL is ever not `https://www.softplaynearme.co.uk`.

4. **SendGrid**: bulk sending from `david@softplaynearme.co.uk` works today (it's the verified
   single sender already used for transactional mail), but for real newsletter volume you'll
   want full domain authentication for `softplaynearme.co.uk` in SendGrid (better deliverability,
   proper `List-Unsubscribe` headers) and optionally a dedicated `newsletter@` or `hello@` sender.
   Nothing in the code needs to change for that — just update `SENDGRID_FROM_EMAIL`.

## How it works

- **Subscribers** (`newsletter_subscribers`): one row per email, `weekly_newsletter` and
  `events_activities` booleans so one person can be on either/both lists without duplicate rows.
  Public endpoints: `POST /api/newsletter/subscribe`, `GET /api/newsletter/unsubscribe`,
  `GET`/`POST /api/newsletter/preferences`.
- **Content** (`newsletters` + `newsletter_items`): admin-authored at `/admin/newsletter`.
  Status flow is `draft → ready_for_review → approved → sent` (or `failed`), enforced server-side
  in `lib/newsletter/db.ts` (`ALLOWED_TRANSITIONS`) — content can't be edited or sent outside
  that flow, and only `approved` newsletters are ever eligible to send.
- **Sending** (`lib/newsletter/send.ts`): the single `runNewsletterSend()` entry point is used by
  both the Sunday cron and the admin "Send now" button. It takes a DB-level lock
  (`newsletter_sends` partial unique index on `newsletter_id` for `running`/`completed` rows)
  before calling SendGrid, so a duplicate trigger — retried Action, double click, concurrent
  request — fails the lock instead of sending twice.
- **Schedule**: `.github/workflows/send-newsletter.yml`, Sundays 08:00 UTC by default. Edit the
  one `cron:` line to change the time (GitHub Actions requires a literal cron expression there).
  Also runnable manually via the Actions tab (`workflow_dispatch`) for the events list or a retry.

## Testing this locally

Add `ADMIN_SECRET` and `CRON_SECRET` to `.env.local` (any value), run `npm run dev`, then:
- Subscribe/unsubscribe: `POST /api/newsletter/subscribe`, `GET /api/newsletter/unsubscribe?token=...&scope=weekly|events|all`
- Admin: log in at `/admin/newsletter` with your local `ADMIN_SECRET`
- Trigger a send manually: `curl -X POST "http://localhost:3000/api/cron/send-newsletter?type=weekly" -H "Authorization: Bearer $CRON_SECRET"`
