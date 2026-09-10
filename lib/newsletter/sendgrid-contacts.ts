// Pushes a subscriber into SendGrid Marketing Contacts — separate from actually sending mail
// (lib/newsletter/sendgrid.ts uses plain /mail/send, not the Marketing Contacts list). This sync
// exists for SendGrid-side visibility/suppression-list management, mirroring the proven Listen
// True Crime newsletter system. A failed push never blocks subscribing — the subscriber row in
// Postgres is always the source of truth (see subscribeEmail in lib/newsletter/db.ts) — it's
// just retried later from the admin "Retry SendGrid sync" button.

/** SendGrid's contact upsert is processed asynchronously; job_id is what we get back synchronously. */
export async function pushSendGridContact(email: string): Promise<string> {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) throw new Error('SENDGRID_API_KEY is not configured')

  const res = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      list_ids: process.env.SENDGRID_LIST_ID ? [process.env.SENDGRID_LIST_ID] : undefined,
      contacts: [{ email }],
    }),
  })
  if (!res.ok) throw new Error(`SendGrid contacts API error ${res.status}: ${await res.text()}`)
  const { job_id } = await res.json()
  return job_id as string
}
