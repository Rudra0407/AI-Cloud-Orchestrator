import { useEffect, useState } from 'react'
import { Cpu, GitBranch, Activity, Zap } from 'lucide-react'
import { modelsApi, routesApi } from '../api/client'
import { useMetrics } from '../hooks/useMetrics'
import MetricGauge from '../components/MetricGauge'
import StatusBadge from '../components/StatusBadge'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

export default function Dashboard() {
    const { systemMetrics, modelMetrics, connected } = useMetrics()
    const [models, setModels] = useState([])
    const [routes, setRoutes] = useState([])

    useEffect(() => {
        modelsApi.list().then(setModels).catch(() => { })
        routesApi.list().then(setRoutes).catch(() => { })
    }, [])

    const running = models.filter(m => m.status === 'running').length
    const totalReqPm = modelMetrics.reduce((s, m) => s + m.requests_per_minute, 0)
    const avgLatency = modelMetrics.length
        ? modelMetrics.reduce((s, m) => s + m.avg_latency_ms, 0) / modelMetrics.length
        : 0

    // Fake sparkline data if no history
    const sparkData = Array.from({ length: 12 }, (_, i) => ({
        t: i,
        rpm: Math.random() * 20 + totalReqPm * 0.8,
    }))

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">AI infrastructure overview</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-400 pulse-dot' : 'bg-gray-600'}`} />
                    <span className="text-xs font-mono text-gray-500">
                        {connected ? 'Live' : 'Connecting...'}
                    </span>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { icon: Cpu, label: 'Running Models', value: running, sub: `of ${models.length} total`, color: 'text-brand-400' },
                    { icon: GitBranch, label: 'Active Routes', value: routes.filter(r => r.is_active).length, sub: `of ${routes.length} total`, color: 'text-blue-400' },
                    { icon: Activity, label: 'Req / min', value: totalReqPm.toFixed(1), sub: 'across all models', color: 'text-purple-400' },
                    { icon: Zap, label: 'Avg Latency', value: `${avgLatency.toFixed(0)}ms`, sub: 'last 5 minutes', color: 'text-yellow-400' },
                ].map(({ icon: Icon, label, value, sub, color }) => (
                    <div key={label} className="card">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</span>
                            <Icon size={14} className={color} />
                        </div>
                        <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                        <p className="text-xs text-gray-600 mt-1">{sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* System Metrics */}
                <div className="card space-y-4">
                    <h3 className="text-sm font-semibold text-gray-300">System Resources</h3>
                    {systemMetrics ? (
                        <>
                            <MetricGauge label="CPU Usage" value={systemMetrics.cpu_percent} />
                            <MetricGauge
                                label="Memory"
                                value={systemMetrics.memory_percent}
                                color={systemMetrics.memory_percent > 85 ? 'red' : 'brand'}
                            />
                            <MetricGauge label="Disk" value={systemMetrics.disk_percent} color="yellow" />
                            <div className="pt-2 border-t border-surface-600 text-xs font-mono text-gray-500">
                                {systemMetrics.memory_used_gb} / {systemMetrics.memory_total_gb} GB RAM
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-gray-600">Loading...</p>
                    )}
                </div>

                {/* Models Status */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Model Status</h3>
                    <div className="space-y-2">
                        {models.length === 0 ? (
                            <p className="text-sm text-gray-600">No models deployed yet.</p>
                        ) : (
                            models.slice(0, 6).map(m => (
                                <div key={m.id} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300 font-mono truncate max-w-[120px]">{m.name}</span>
                                    <StatusBadge status={m.status} />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Request Rate Sparkline */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Request Rate</h3>
                    <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={sparkData}>
                            <defs>
                                <linearGradient id="rpmGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                            <XAxis dataKey="t" hide />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{ background: '#0f1a14', border: '1px solid #263326', borderRadius: 8 }}
                                labelStyle={{ display: 'none' }}
                                itemStyle={{ color: '#4ade80', fontSize: 12 }}
                            />
                            <Area
                                type="monotone" dataKey="rpm"
                                stroke="#22c55e" fill="url(#rpmGrad)"
                                strokeWidth={2} dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-600 font-mono mt-1">req/min</p>
                </div>
            </div>

            {/* Per-model metrics table */}
            {modelMetrics.length > 0 && (
                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Model Performance</h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs font-mono text-gray-600 border-b border-surface-700">
                                {['Model', 'Req/min', 'Avg Latency', 'p95', 'p99', 'Tokens/min', 'Error Rate'].map(h => (
                                    <th key={h} className="text-left pb-2 pr-4">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                            {modelMetrics.map(m => (
                                <tr key={m.model_id} className="text-gray-400 font-mono text-xs">
                                    <td className="py-2 pr-4 text-gray-200">{m.model_name}</td>
                                    <td className="py-2 pr-4 text-brand-400">{m.requests_per_minute}</td>
                                    <td className="py-2 pr-4">{m.avg_latency_ms}ms</td>
                                    <td className="py-2 pr-4">{m.p95_latency_ms}ms</td>
                                    <td className="py-2 pr-4">{m.p99_latency_ms}ms</td>
                                    <td className="py-2 pr-4">{m.total_tokens_per_minute}</td>
                                    <td className={`py-2 ${m.error_rate > 0.05 ? 'text-red-400' : 'text-gray-500'}`}>
                                        {(m.error_rate * 100).toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}