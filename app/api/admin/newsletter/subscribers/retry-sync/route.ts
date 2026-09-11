import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { listUnsyncedSubscribers, markSubscriberSynced } from '@/lib/newsletter/db'
import { pushSendGridContact } from '@/lib/newsletter/sendgrid-contacts'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const unsynced = await listUnsyncedSubscribers()
  let synced = 0

  for (const sub of unsynced) {
    try {
      const jobId = await pushSendGridContact(sub.email)
      await markSubscriberSynced(sub.email, jobId)
      synced += 1
    } catch (err) {
      console.error(`[retry-sync] failed for ${sub.email}:`, err)
      // continue with remaining subscribers
    }
  }

  return NextResponse.json({ ok: true, synced, attempted: unsynced.length })
}
