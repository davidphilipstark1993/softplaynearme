import { Eye, MousePointerClick, Mail, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface InsightsCardProps {
  views30d: number
  clicks30d: number
  leads30d: number
  viewsPrev30d: number
  clicksPrev30d: number
  leadsPrev30d: number
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return null
    return <span className="inline-flex items-center gap-0.5 text-xs text-slate-400"><Minus className="w-3 h-3" /> new</span>
  }
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-slate-400"><Minus className="w-3 h-3" /> flat</span>
  const isUp = change > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? '+' : ''}{change}%
    </span>
  )
}

export function InsightsCard({ views30d, clicks30d, leads30d, viewsPrev30d, clicksPrev30d, leadsPrev30d }: InsightsCardProps) {
  const stats = [
    { icon: Eye, label: 'Page views', value: views30d, prev: viewsPrev30d },
    { icon: MousePointerClick, label: 'Call/directions/website clicks', value: clicks30d, prev: clicksPrev30d },
    { icon: Mail, label: 'Enquiries', value: leads30d, prev: leadsPrev30d },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-900">Insights</h2>
        <span className="text-xs text-slate-400">Last 30 days</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-3">
            <s.icon className="w-4 h-4 text-purple-500 mb-1.5" />
            <p className="text-xl font-bold text-slate-900">{s.value.toLocaleString('en-GB')}</p>
            <p className="text-xs text-slate-500 leading-tight mb-1">{s.label}</p>
            <Trend current={s.value} previous={s.prev} />
          </div>
        ))}
      </div>
    </div>
  )
}
