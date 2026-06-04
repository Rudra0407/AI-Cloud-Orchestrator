import { useState, useEffect } from 'react'
import { Zap, Play, Clock, Hash, CheckCircle, XCircle, BarChart2 } from 'lucide-react'
import { modelsApi, benchmarkApi } from '../api/client'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'

const CHART_TOOLTIP_STYLE = {
    contentStyle: { background: '#0f1a14', border: '1px solid #263326', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#4ade80', fontSize: 11 },
    itemStyle: { color: '#9ca3af' },
}

const PRESET_PROMPTS = [
    { label: 'Short — greeting', prompt: 'Hello! How are you?' },
    { label: 'Medium — explanation', prompt: 'Explain what a transformer neural network is in 2 sentences.' },
    { label: 'Long — code generation', prompt: 'Write a Python function that implements binary search with full docstring and type hints.' },
    { label: 'Reasoning', prompt: 'If a train travels 60mph for 2.5 hours then 80mph for 1.5 hours, what is the total distance?' },
]

export default function Benchmark() {
    const [models, setModels] = useState([])
    const [form, setForm] = useState({
        model_name: '',
        prompt: PRESET_PROMPTS[1].prompt,
        num_requests: 10,
        concurrency: 2,
    })
    const [running, setRunning] = useState(false)
    const [progress, setProgress] = useState(0)
    const [results, setResults] = useState([])   // history of runs
    const [error, setError] = useState(null)

    useEffect(() => {
        modelsApi.list().then(all => {
            const running = all.filter(m => m.status === 'running')
            setModels(running)
            if (running.length > 0) setForm(p => ({ ...p, model_name: running[0].name }))
        })
    }, [])

    const runBenchmark = async () => {
        if (!form.model_name || running) return
        setRunning(true)
        setError(null)
        setProgress(0)

        // Fake progress bar while waiting
        const interval = setInterval(() => {
            setProgress(p => Math.min(p + 100 / (form.num_requests * 3), 92))
        }, 600)

        try {
            const result = await benchmarkApi.run({
                model_name: form.model_name,
                prompt: form.prompt,
                num_requests: form.num_requests,
                concurrency: form.concurrency,
            })
            setResults(prev => [{ ...result, run_at: new Date().toLocaleTimeString() }, ...prev])
            setProgress(100)
        } catch (err) {
            setError(err.response?.data?.detail || 'Benchmark failed')
        } finally {
            clearInterval(interval)
            setRunning(false)
        }
    }

    const latest = results[0] || null

    // Bar chart data for latency percentiles
    const latencyData = latest ? [
        { name: 'Avg', ms: latest.avg_latency_ms },
        { name: 'p50', ms: latest.p50_latency_ms },
        { name: 'p95', ms: latest.p95_latency_ms },
        { name: 'p99', ms: latest.p99_latency_ms },
    ] : []

    // Compare runs for history chart
    const historyData = [...results].reverse().map((r, i) => ({
        run: `#${i + 1}`,
        tps: r.tokens_per_second,
        avg_latency: r.avg_latency_ms,
        p95: r.p95_latency_ms,
    }))

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-semibold text-white">Benchmark</h1>
                <p className="text-sm text-gray-500 mt-0.5">Load test your models — measure throughput, latency, and reliability</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* Config panel */}
                <div className="card space-y-4">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <BarChart2 size={14} className="text-brand-400" /> Test Configuration
                    </h3>

                    {/* Model */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">Model</label>
                        <select
                            className="select w-full"
                            value={form.model_name}
                            onChange={e => setForm(p => ({ ...p, model_name: e.target.value }))}
                        >
                            {models.length === 0
                                ? <option>No running models</option>
                                : models.map(m => <option key={m.id} value={m.name}>{m.name} ({m.model_tag})</option>)
                            }
                        </select>
                    </div>

                    {/* Preset prompts */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">Prompt Preset</label>
                        <div className="space-y-1.5">
                            {PRESET_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => setForm(prev => ({ ...prev, prompt: p.prompt }))}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors ${form.prompt === p.prompt
                                        ? 'bg-brand-900/50 border-brand-700/40 text-brand-300'
                                        : 'bg-surface-700 border-surface-600 text-gray-400 hover:text-gray-200'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom prompt */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">Prompt</label>
                        <textarea
                            className="input w-full resize-none text-xs"
                            rows={3}
                            value={form.prompt}
                            onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))}
                        />
                    </div>

                    {/* Num requests + concurrency */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1.5 block">Requests</label>
                            <input
                                type="number"
                                className="input w-full"
                                min={1} max={100}
                                value={form.num_requests}
                                onChange={e => setForm(p => ({ ...p, num_requests: Number(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1.5 block">Concurrency</label>
                            <input
                                type="number"
                                className="input w-full"
                                min={1} max={10}
                                value={form.concurrency}
                                onChange={e => setForm(p => ({ ...p, concurrency: Number(e.target.value) }))}
                            />
                        </div>
                    </div>

                    {/* Run button */}
                    <button
                        onClick={runBenchmark}
                        disabled={!form.model_name || running || models.length === 0}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {running ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Running...
                            </>
                        ) : (
                            <>
                                <Play size={14} /> Run Benchmark
                            </>
                        )}
                    </button>

                    {/* Progress bar */}
                    {running && (
                        <div className="space-y-1">
                            <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-600 font-mono text-center">
                                {form.num_requests} requests · {form.concurrency} concurrent
                            </p>
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                </div>

                {/* Results panel */}
                <div className="col-span-2 space-y-4">
                    {!latest ? (
                        <div className="card flex flex-col items-center justify-center h-64 text-center">
                            <Zap size={32} className="text-gray-700 mb-3" />
                            <p className="text-gray-500 font-medium">No results yet</p>
                            <p className="text-gray-600 text-sm mt-1">Configure and run a benchmark to see results</p>
                        </div>
                    ) : (
                        <>
                            {/* KPI cards */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    {
                                        icon: Zap,
                                        label: 'Tokens / sec',
                                        value: latest.tokens_per_second.toFixed(1),
                                        color: 'text-brand-400',
                                        sub: 'throughput'
                                    },
                                    {
                                        icon: Clock,
                                        label: 'Avg Latency',
                                        value: `${latest.avg_latency_ms.toFixed(0)}ms`,
                                        color: 'text-yellow-400',
                                        sub: `p99: ${latest.p99_latency_ms.toFixed(0)}ms`
                                    },
                                    {
                                        icon: CheckCircle,
                                        label: 'Successful',
                                        value: latest.successful_requests,
                                        color: 'text-green-400',
                                        sub: `of ${latest.num_requests} total`
                                    },
                                    {
                                        icon: XCircle,
                                        label: 'Failed',
                                        value: latest.failed_requests,
                                        color: latest.failed_requests > 0 ? 'text-red-400' : 'text-gray-500',
                                        sub: `${((latest.failed_requests / latest.num_requests) * 100).toFixed(1)}% error rate`
                                    },
                                ].map(({ icon: Icon, label, value, color, sub }) => (
                                    <div key={label} className="card p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-500 font-mono">{label}</span>
                                            <Icon size={13} className={color} />
                                        </div>
                                        <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                                        <p className="text-xs text-gray-600 mt-1">{sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Extra stats row */}
                            <div className="card">
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    {[
                                        { label: 'Total Time', value: `${latest.total_time_s.toFixed(2)}s` },
                                        { label: 'Concurrency', value: `${latest.concurrency}x` },
                                        { label: 'p50 Latency', value: `${latest.p50_latency_ms.toFixed(0)}ms` },
                                        { label: 'p95 Latency', value: `${latest.p95_latency_ms.toFixed(0)}ms` },
                                    ].map(({ label, value }) => (
                                        <div key={label}>
                                            <p className="text-xs text-gray-500 font-mono mb-1">{label}</p>
                                            <p className="text-lg font-bold font-mono text-gray-200">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Latency distribution chart */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="card">
                                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Latency Percentiles</h3>
                                    <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={latencyData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#4b5563' }} unit="ms" />
                                            <Tooltip {...CHART_TOOLTIP_STYLE} />
                                            <Bar dataKey="ms" name="Latency" radius={[4, 4, 0, 0]}
                                                fill="#22c55e"
                                                label={{ position: 'top', fontSize: 10, fill: '#4ade80', formatter: v => `${v.toFixed(0)}ms` }}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Run history comparison */}
                                <div className="card">
                                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Run History — Tokens/sec</h3>
                                    {historyData.length < 2 ? (
                                        <div className="flex items-center justify-center h-32 text-gray-600 text-xs">
                                            Run more benchmarks to compare
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={160}>
                                            <BarChart data={historyData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#263326" />
                                                <XAxis dataKey="run" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                                <YAxis tick={{ fontSize: 11, fill: '#4b5563' }} />
                                                <Tooltip {...CHART_TOOLTIP_STYLE} />
                                                <Bar dataKey="tps" name="Tokens/sec" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Results history table */}
            {results.length > 0 && (
                <div className="card p-0 overflow-hidden">
                    <div className="px-5 py-3 border-b border-surface-700">
                        <h3 className="text-sm font-semibold text-gray-300">Run History</h3>
                    </div>
                    <table className="w-full">
                        <thead className="bg-surface-900">
                            <tr className="text-xs font-mono text-gray-600 border-b border-surface-700">
                                {['Run', 'Model', 'Requests', 'Concurrency', 'Tokens/sec', 'Avg Latency', 'p95', 'p99', 'Success Rate', 'Time'].map(h => (
                                    <th key={h} className="text-left px-4 py-2.5">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                            {results.map((r, i) => (
                                <tr key={i} className={`text-xs font-mono text-gray-400 hover:bg-surface-700/30 ${i === 0 ? 'bg-brand-900/10' : ''}`}>
                                    <td className="px-4 py-2.5 text-gray-500">#{results.length - i}</td>
                                    <td className="px-4 py-2.5 text-gray-200 font-sans font-medium">{r.model_name}</td>
                                    <td className="px-4 py-2.5">{r.num_requests}</td>
                                    <td className="px-4 py-2.5">{r.concurrency}x</td>
                                    <td className="px-4 py-2.5 text-brand-400">{r.tokens_per_second.toFixed(1)}</td>
                                    <td className="px-4 py-2.5 text-yellow-400">{r.avg_latency_ms.toFixed(0)}ms</td>
                                    <td className="px-4 py-2.5">{r.p95_latency_ms.toFixed(0)}ms</td>
                                    <td className="px-4 py-2.5">{r.p99_latency_ms.toFixed(0)}ms</td>
                                    <td className="px-4 py-2.5">
                                        <span className={r.failed_requests > 0 ? 'text-red-400' : 'text-green-400'}>
                                            {(r.successful_requests / r.num_requests * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-500">{r.run_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}