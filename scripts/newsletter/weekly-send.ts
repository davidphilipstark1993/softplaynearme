// Sunday send job for the weekly newsletter — run directly by GitHub Actions via
// `npx tsx scripts/newsletter/weekly-send.ts` (see .github/workflows/weekly-newsletter-send.yml),
// the same architecture the proven Listen True Crime newsletter system uses: the Action talks
// straight to Postgres + SendGrid rather than calling back into the deployed site over HTTP.
//
// All the actual safety logic — approval required, not already sent, duplicate-send protection —
// lives in runNewsletterSend() (lib/newsletter/send.ts), shared with the admin "Send now"
// button, so this script is just plumbing: run it, log what happened, exit non-zero on a crash
// so the Action shows red.
import { runNewsletterSend } from '@/lib/newsletter/send'

async function main() {
  console.log('=== Weekly newsletter send — targeting the weekly list ===')
  const result = await runNewsletterSend('weekly', 'cron')

  if (result.skipped) {
    console.log(`Skipped: ${result.reason}`)
    return
  }

  console.log(`Sent to ${result.sent}/${result.total} subscribers (${result.failed} failed). Newsletter #${result.newsletterId}.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Weekly newsletter send failed:', err)
    process.exit(1)
  })
