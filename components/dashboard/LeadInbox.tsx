import Link from 'next/link'
import { Mail, Phone, Sparkles } from 'lucide-react'

interface Enquiry {
  id: number
  name: string
  email: string
  phone?: string | null
  message: string
  notified: boolean
  created_at: string
}

export function LeadInbox({ enquiries, isPaidActive }: { enquiries: Enquiry[]; isPaidActive: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-900">Leads</h2>
        <span className="text-xs text-slate-400">{enquiries.length}</span>
      </div>

      {!isPaidActive && (
        <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 mt-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-purple-800">
            You&apos;re only notified by email on Premium — on Free, check back here for new enquiries.
          </p>
        </div>
      )}

      {enquiries.length === 0 ? (
        <p className="text-sm text-slate-500 mt-2">
          No enquiries yet. When a parent sends a message from your listing, it&apos;ll show up here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 mt-3">
          {enquiries.map((e) => (
            <li key={e.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-medium text-sm text-slate-900">{e.name}</p>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-1.5">{e.message}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <Link href={`mailto:${e.email}`} className="inline-flex items-center gap-1 hover:text-purple-600">
                  <Mail className="w-3 h-3" /> {e.email}
                </Link>
                {e.phone && (
                  <Link href={`tel:${e.phone}`} className="inline-flex items-center gap-1 hover:text-purple-600">
                    <Phone className="w-3 h-3" /> {e.phone}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
