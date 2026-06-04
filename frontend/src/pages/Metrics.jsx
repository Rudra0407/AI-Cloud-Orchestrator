import { useState, useEffect, useRef } from 'react'
import { Activity, Clock, Hash, AlertTriangle, RefreshCw } from 'lucide-react'
import { metricsApi, modelsApi } from '../api/client'
import { useMetrics } from '../hooks/useMetrics'
import MetricGauge from '../components/MetricGauge'
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

const CHART_COLORS = ['#22c55e', '#818cf8', '#f59e0b', '#f43f5e', '#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
            {label && <p className="text-gray-500 mb-1">{label}</p>}
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>
            ))}
        </div>
    )
}

export default function Metrics() {
    const { systemMetrics, modelMetrics, connected } = useMetrics()
    const [history, setHistory] = useState([])
    const [models, setModels] = useState([])
    const [selectedModel, setSelectedModel] = useState('all')
    const [hours, setHours] = useState(24)
    const [loading, setLoading] = useState(true)
    // Rolling window of live metrics (last 20 ticks = ~60s)
    const [liveData, setLiveData] = useState([])
    const tickRef = useRef(0)

    // Load models list
    useEffect(() => {
        modelsApi.list().then(setModels).catch(() => { })
    }, [])

    // Load historical data
    const loadHistory = () => {
        setLoading(true)
        metricsApi.history(selectedModel === 'all' ? null : selectedModel, hours)
            .then(data => {
                setHistory(data.map(d => ({
                    ...d,
                    bucket: new Date(d.bucket).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                    }),
                })))
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadHistory() }, [selectedModel, hours])

    // Build rolling live data from WS metrics
    useEffect(() => {
        if (!modelMetrics.length) return
        tickRef.current += 1
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const totalRpm = modelMetrics.reduce((s, m) => s + m.requests_per_minute, 0)
        const avgLatency = modelMetrics.reduce((s, m) => s + m.avg_latency_ms, 0) / modelMetrics.length
        const totalTokens = modelMetrics.reduce((s, m) => s + m.total_tokens_per_minute, 0)

        setLiveData(prev => {
            const next = [...prev, { time: now, rpm: +totalRpm.toFixed(2), latency: +avgLatency.toFixed(0), tokens: totalTokens }]
            return next.slice(-20) // keep last 20 ticks
        })
    }, [modelMetrics])

    const runningModels = models.filter(m => m.status === 'running')
    const totalRequests = history.reduce((s, d) => s + d.count, 0)
    const avgLatencyAll = history.length
        ? history.reduce((s, d) => s + d.avg_latency_ms, 0) / history.length : 0
    const totalTokensAll = history.reduce((s, d) => s + d.total_tokens, 0)

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Metrics</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Live and historical inference analytics</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">Model</span>
                        <select className="select text-sm" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                            <option value="all">All models</option>
                            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">Window</span>
                        <select className="select text-sm" value={hours} onChange={e => setHours(+e.target.value)}>
                            <option value={1}>1h</option>
                            <option value={6}>6h</option>
                            <option value={24}>24h</option>
                            <option value={168}>7d</option>
                        </select>
                    </div>
                    <button onClick={loadHistory} className="btn-ghost flex items-center gap-1.5 text-xs">
                        <RefreshCw size={13} /> Refresh
                    </button>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand-400 pulse-dot' : 'bg-gray-600'}`} />
                        <span className="text-xs font-mono text-gray-500">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { icon: Activity, label: 'Total Requests', value: totalRequests, sub: `last ${hours}h`, color: 'text-brand-400' },
                    { icon: Clock, label: 'Avg Latency', value: `${avgLatencyAll.toFixed(0)}ms`, sub: 'across all requests', color: 'text-yellow-400' },
                    { icon: Hash, label: 'Total Tokens', value: totalTokensAll.toLocaleString(), sub: `last ${hours}h`, color: 'text-purple-400' },
                    { icon: AlertTriangle, label: 'Running Models', value: runningModels.length, sub: `of ${models.length} deployed`, color: 'text-blue-400' },
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

            {/* System Resources */}
            {systemMetrics && (
                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">System Resources — Live</h3>
                    <div className="grid grid-cols-3 gap-6">
                        <MetricGauge label="CPU Usage" value={systemMetrics.cpu_percent} />
                        <MetricGauge label="Memory" value={systemMetrics.memory_percent}
                            color={systemMetrics.memory_percent > 85 ? 'red' : 'brand'} />
                        <MetricGauge label="Disk" value={systemMetrics.disk_percent} color="yellow" />
                    </div>
                    {systemMetrics.gpu_metrics?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-surface-600 grid grid-cols-2 gap-6">
                            {systemMetrics.gpu_metrics.map(gpu => (
                                <div key={gpu.index} className="space-y-3">
                                    <p className="text-xs font-mono text-gray-400">{gpu.name}</p>
                                    <MetricGauge label="GPU Util" value={gpu.utilization_percent} />
                                    <MetricGauge label="VRAM" value={(gpu.memory_used_mb / gpu.memory_total_mb) * 100}
                                        color="yellow" />
                                    <p className="text-xs font-mono text-gray-600">
                                        {gpu.memory_used_mb.toFixed(0)} / {gpu.memory_total_mb.toFixed(0)} MB · {gpu.temperature_c}°C
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Live rolling charts */}
            {liveData.length > 1 && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="card">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">Requests / min — Live</h3>
                        <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={liveData}>
                                <defs>
                                    <linearGradient id="rpmG" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                                <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="rpm" name="req/min"
                                    stroke="#22c55e" fill="url(#rpmG)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="card">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">Avg Latency (ms) — Live</h3>
                        <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={liveData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                                <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="latency" name="ms"
                                    stroke="#f59e0b" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Historical charts */}
            <div className="grid grid-cols-2 gap-4">
                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Request Volume — Historical</h3>
                    {loading ? (
                        <p className="text-sm text-gray-600 py-8 text-center">Loading...</p>
                    ) : history.length === 0 ? (
                        <p className="text-sm text-gray-600 py-8 text-center">No data yet — send some requests first</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                                <XAxis dataKey="bucket" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="requests" fill="#22c55e" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Avg Latency (ms) — Historical</h3>
                    {loading ? (
                        <p className="text-sm text-gray-600 py-8 text-center">Loading...</p>
                    ) : history.length === 0 ? (
                        <p className="text-sm text-gray-600 py-8 text-center">No data yet — send some requests first</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="latG" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                                <XAxis dataKey="bucket" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="avg_latency_ms" name="ms"
                                    stroke="#f59e0b" fill="url(#latG)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Token Usage — Historical</h3>
                {loading ? (
                    <p className="text-sm text-gray-600 py-4 text-center">Loading...</p>
                ) : history.length === 0 ? (
                    <p className="text-sm text-gray-600 py-4 text-center">No data yet — send some requests first</p>
                ) : (
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={history}>
                            <defs>
                                <linearGradient id="tokG" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                            <XAxis dataKey="bucket" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="total_tokens" name="tokens"
                                stroke="#818cf8" fill="url(#tokG)" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Per-model live table */}
            {modelMetrics.length > 0 && (
                <div className="card">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Per-Model Live Stats</h3>
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
                                <tr key={m.model_id} className="font-mono text-xs text-gray-400">
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