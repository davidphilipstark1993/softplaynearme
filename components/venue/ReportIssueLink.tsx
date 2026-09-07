'use client'

import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { toast } from 'sonner'

const REPORT_TYPES = [
  { value: 'incorrect_info', label: 'Information is wrong' },
  { value: 'permanently_closed', label: 'This venue has closed' },
  { value: 'other', label: 'Something else' },
] as const

export function ReportIssueLink({ venueId }: { venueId: number }) {
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]['value']>('incorrect_info')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch(`/api/venues/${venueId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, message, email: email || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not send your report — please try again')
        return
      }
      setSent(true)
    } catch {
      toast.error('Could not send your report — please try again')
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Flag className="w-3 h-3" />
        Report an issue with this listing
      </button>
    )
  }

  if (sent) {
    return (
      <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        Thanks — we&apos;ll take a look and update this listing if needed.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">Report an issue with this listing</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel">
          <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
        </button>
      </div>
      <select
        value={reportType}
        onChange={(e) => setReportType(e.target.value as typeof reportType)}
        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white"
      >
        {REPORT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <textarea
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's wrong? (e.g. wrong opening hours, closed down, wrong address)"
        rows={2}
        maxLength={2000}
        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white resize-none"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email (optional, if you'd like a reply)"
        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white"
      />
      <button
        type="submit"
        disabled={sending}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium py-1.5 rounded-md disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Send report'}
      </button>
    </form>
  )
}
