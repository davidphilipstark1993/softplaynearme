'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function ResendVerificationButton({ token }: { token: string }) {
  const [sending, setSending] = useState(false)

  async function handleClick() {
    setSending(true)
    try {
      const res = await fetch(`/api/dashboard/${token}/resend-verification`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not resend email — please try again')
        return
      }
      toast.success('Verification email sent — check your inbox')
    } catch {
      toast.error('Could not resend email — please try again')
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sending}
      className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap disabled:opacity-50"
    >
      {sending ? 'Sending…' : 'Resend email'}
    </button>
  )
}
