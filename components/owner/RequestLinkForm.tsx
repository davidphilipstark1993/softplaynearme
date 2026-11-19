'use client'

import { useState } from 'react'

export function RequestLinkForm() {
  const [sent, setSent] = useState(false)
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = new FormData(e.currentTarget).get('email')
    await fetch('/api/owner/request-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null)
    setSent(true)
  }
  if (sent) return <p className="text-slate-700">If that address has claimed a listing, a new sign-in link is on its way. It works once and expires in 24 hours.</p>
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">The email you claimed with</span>
        <input name="email" type="email" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
      </label>
      <button className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white hover:bg-purple-700">Email me a sign-in link</button>
    </form>
  )
}
