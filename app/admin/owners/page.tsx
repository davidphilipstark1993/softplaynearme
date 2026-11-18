'use client'

import { useCallback, useEffect, useState } from 'react'

interface Pending { id: number; name: string; email: string; role: string; method: string; email_verified: boolean; created_at: string; venue_name: string; city_slug: string; slug: string; website: string | null; has_owner: boolean }
interface Edit { id: number; venue_name: string; city_slug: string; slug: string; field: string; old_value: unknown; new_value: unknown; edited_by: string; edited_at: string; reverted_at: string | null }
interface Claimed { venue_id: number; name: string; city_slug: string; slug: string; owner_completeness: number | null; email: string; verified_at: string | null }

const short = (v: unknown) => {
  const s = v == null ? '—' : typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 140 ? `${s.slice(0, 140)}…` : s
}

export default function AdminOwnersPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [data, setData] = useState<{ pending: Pending[]; edits: Edit[]; claimed: Claimed[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/owners')
    if (res.status === 401) return setAuthed(false)
    setAuthed(true)
    const json = await res.json()
    if (!res.ok) return setError(json.error)
    setData(json)
  }, [])
  useEffect(() => { load() }, [load])

  async function act(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/owners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) setError(json.error || 'Failed')
    await load()
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const password = new FormData(e.currentTarget).get('password')
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: password }) })
    if (res.ok) load()
    else setError('Wrong password')
  }

  if (authed === false)
    return (
      <form onSubmit={login} className="max-w-sm mx-auto p-8 space-y-3">
        <h1 className="text-xl font-bold">Admin</h1>
        <input name="password" type="password" className="w-full border rounded px-3 py-2" placeholder="Admin password" />
        <button className="bg-purple-600 text-white rounded px-4 py-2">Sign in</button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    )
  if (!data) return <p className="p-8">{error ?? 'Loading…'}</p>

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-bold">Venue owners</h1>
      {error && <p className="text-red-600">{error}</p>}

      <section>
        <h2 className="text-lg font-semibold mb-3">Manual review ({data.pending.length})</h2>
        {data.pending.length === 0 ? <p className="text-slate-500">Nothing waiting.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th>Venue</th><th>Claimant</th><th>Why manual</th><th>Email confirmed</th><th></th></tr></thead>
            <tbody>
              {data.pending.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="py-2"><a className="underline" href={`/soft-play/${c.city_slug}/${c.slug}`} target="_blank">{c.venue_name}</a><div className="text-slate-500">{c.website ?? 'no website'}</div></td>
                  <td>{c.name} ({c.role})<div className="text-slate-500">{c.email}</div><div className="text-slate-400">{new Date(c.created_at).toLocaleString('en-GB')}</div></td>
                  <td>{c.has_owner ? 'Venue already has an owner' : c.method === 'manual_review' ? 'Email not on venue domain' : c.method}</td>
                  <td>{c.email_verified ? 'Yes' : 'Not yet'}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button onClick={() => act({ action: 'approve', claimId: c.id })} className="bg-green-600 text-white rounded px-3 py-1">Approve</button>
                    <button onClick={() => act({ action: 'reject', claimId: c.id })} className="bg-slate-200 rounded px-3 py-1">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent edits</h2>
        {data.edits.length === 0 ? <p className="text-slate-500">No edits yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th>When</th><th>Venue</th><th>Field</th><th>Was</th><th>Now</th><th>By</th><th></th></tr></thead>
            <tbody>
              {data.edits.map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="py-2 whitespace-nowrap">{new Date(e.edited_at).toLocaleString('en-GB')}</td>
                  <td><a className="underline" href={`/soft-play/${e.city_slug}/${e.slug}`} target="_blank">{e.venue_name}</a></td>
                  <td>{e.field}</td>
                  <td className="text-slate-500 max-w-xs break-words">{short(e.old_value)}</td>
                  <td className="max-w-xs break-words">{short(e.new_value)}</td>
                  <td>{e.edited_by}</td>
                  <td>{e.reverted_at ? <span className="text-slate-400">reverted</span> : <button onClick={() => act({ action: 'revert', editId: e.id })} className="underline">Revert</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Claimed venues ({data.claimed.length})</h2>
        <ul className="text-sm space-y-1">
          {data.claimed.map((c) => (
            <li key={c.venue_id}><a className="underline" href={`/soft-play/${c.city_slug}/${c.slug}`} target="_blank">{c.name}</a> · {c.email} · {c.owner_completeness ?? 0}% complete</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
