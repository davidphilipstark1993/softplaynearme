'use client'

import { useEffect, useState } from 'react'
import { placementLabel } from '@/lib/ads/placements'

interface Row { impressions: number; clicks: number }
interface Analytics {
  days: number
  totals: Row
  byAd: (Row & { id: number; title: string; status: string })[]
  byPlacement: (Row & { placement: string })[]
  byDay: (Row & { day: string })[]
}

const ctr = (r: Row) => (r.impressions ? `${((r.clicks / r.impressions) * 100).toFixed(2)}%` : '–')
const fmt = (n: number) => n.toLocaleString('en-GB')

function Chart({ data }: { data: Analytics['byDay'] }) {
  const W = 720, H = 180, P = { l: 36, r: 8, t: 10, b: 22 }
  const maxI = Math.max(1, ...data.map((d) => d.impressions))
  const maxC = Math.max(1, ...data.map((d) => d.clicks))
  const bw = (W - P.l - P.r) / Math.max(1, data.length)
  const x = (i: number) => P.l + i * bw + bw / 2
  const yI = (v: number) => H - P.b - (v / maxI) * (H - P.t - P.b)
  const yC = (v: number) => H - P.b - (v / maxC) * (H - P.t - P.b)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yC(d.clicks).toFixed(1)}`).join(' ')
  const step = Math.ceil(data.length / 7)
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Impressions per day as bars and clicks per day as a line" className="w-full">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={yI(maxI * t)} y2={yI(maxI * t)} stroke="#e2e8f0" />
            <text x={P.l - 6} y={yI(maxI * t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(maxI * t)}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <rect key={d.day} x={x(i) - bw * 0.35} width={bw * 0.7} y={yI(d.impressions)} height={H - P.b - yI(d.impressions)} fill="#c4b5fd" rx="2">
            <title>{`${d.day}: ${d.impressions} impressions, ${d.clicks} clicks`}</title>
          </rect>
        ))}
        <path d={line} fill="none" stroke="#db2777" strokeWidth="2" />
        {data.map((d, i) => i % step === 0 && (
          <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.day.slice(5)}</text>
        ))}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-slate-500">
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-violet-300" />Impressions</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 bg-pink-600 align-middle" />Clicks (own scale)</span>
      </figcaption>
    </figure>
  )
}

function Table({ title, rows, first }: { title: string; rows: (Row & { key: string; label: string; muted?: boolean })[]; first: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">{title}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr><th className="px-4 py-2 font-medium">{first}</th><th className="px-4 py-2 text-right font-medium">Impressions</th><th className="px-4 py-2 text-right font-medium">Clicks</th><th className="px-4 py-2 text-right font-medium">CTR</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No data yet</td></tr>}
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-100">
              <td className={`px-4 py-2 ${r.muted ? 'text-slate-400' : 'text-slate-900'}`}>{r.label}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(r.impressions)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmt(r.clicks)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{ctr(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AnalyticsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setError('')
    fetch(`/api/admin/ads/analytics?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load analytics'))))
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [days])

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Your own visits and bots are not counted. Impressions = at least half the advert visible for 1 second.</p>
        <select aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Impressions', fmt(data.totals.impressions)], ['Clicks', fmt(data.totals.clicks)], ['CTR', ctr(data.totals)]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Performance over time</h3>
        <Chart data={data.byDay} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Table title="By advert" first="Advert" rows={data.byAd.map((a) => ({ ...a, key: String(a.id), label: a.title, muted: a.status !== 'active' }))} />
        <Table title="By placement" first="Placement" rows={data.byPlacement.map((p) => ({ ...p, key: p.placement, label: placementLabel(p.placement) }))} />
      </div>
    </div>
  )
}
