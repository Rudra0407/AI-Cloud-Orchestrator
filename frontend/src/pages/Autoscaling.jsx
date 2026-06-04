import { useState, useEffect } from 'react'
import { Scale, Plus, Trash2, RefreshCw, Activity, TrendingUp, TrendingDown, Info } from 'lucide-react'
import { scalingApi, modelsApi } from '../api/client'

export default function Autoscaling() {
    const [policies, setPolicies] = useState([])
    const [models, setModels] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [actionLoading, setActionLoading] = useState({})
    const [form, setForm] = useState({
        model_id: '',
        min_replicas: 1,
        max_replicas: 3,
        scale_up_cpu_threshold: 80,
        scale_down_cpu_threshold: 20,
        scale_up_latency_ms: 2000,
        cooldown_seconds: 60,
    })

    const load = async () => {
        setLoading(true)
        const [p, m] = await Promise.all([
            scalingApi.list().catch(() => []),
            modelsApi.list().catch(() => []),
        ])
        setPolicies(p)
        setModels(m)
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const modelsWithoutPolicy = models.filter(
        m => !policies.find(p => p.model_id === m.id)
    )

    const resetForm = () => {
        setForm({
            model_id: modelsWithoutPolicy[0]?.id || '',
            min_replicas: 1,
            max_replicas: 3,
            scale_up_cpu_threshold: 80,
            scale_down_cpu_threshold: 20,
            scale_up_latency_ms: 2000,
            cooldown_seconds: 60,
        })
        setEditingId(null)
    }

    const openCreate = () => {
        resetForm()
        setShowForm(true)
    }

    const openEdit = (policy) => {
        setForm({
            model_id: policy.model_id,
            min_replicas: policy.min_replicas,
            max_replicas: policy.max_replicas,
            scale_up_cpu_threshold: policy.scale_up_cpu_threshold,
            scale_down_cpu_threshold: policy.scale_down_cpu_threshold,
            scale_up_latency_ms: policy.scale_up_latency_ms,
            cooldown_seconds: policy.cooldown_seconds,
        })
        setEditingId(policy.id)
        setShowForm(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingId) {
                await scalingApi.update(editingId, form)
            } else {
                await scalingApi.create(form)
            }
            setShowForm(false)
            resetForm()
            load()
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to save policy')
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this scaling policy?')) return
        setActionLoading(p => ({ ...p, [id]: true }))
        try {
            await scalingApi.delete(id)
            load()
        } finally {
            setActionLoading(p => ({ ...p, [id]: false }))
        }
    }

    const getModelName = (modelId) => {
        const m = models.find(m => m.id === modelId)
        return m ? `${m.name} (${m.model_tag})` : modelId?.slice(0, 8)
    }

    const getModelStatus = (modelId) => {
        return models.find(m => m.id === modelId)?.status || 'unknown'
    }

    // Slider component
    const Slider = ({ label, value, min, max, step = 1, unit = '', onChange, color = 'brand' }) => {
        const pct = ((value - min) / (max - min)) * 100
        const colorMap = {
            brand: 'accent-green-500',
            red: 'accent-red-500',
            yellow: 'accent-yellow-500',
            blue: 'accent-blue-500',
        }
        return (
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-500">{label}</label>
                    <span className={`text-sm font-bold font-mono ${color === 'brand' ? 'text-brand-400' :
                            color === 'red' ? 'text-red-400' :
                                color === 'yellow' ? 'text-yellow-400' : 'text-blue-400'
                        }`}>
                        {value}{unit}
                    </span>
                </div>
                <input
                    type="range"
                    min={min} max={max} step={step}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className={`w-full h-1.5 rounded-full appearance-none bg-surface-600 cursor-pointer ${colorMap[color]}`}
                />
                <div className="flex justify-between text-xs text-gray-700 font-mono">
                    <span>{min}{unit}</span>
                    <span>{max}{unit}</span>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Autoscaling</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Configure scale-up and scale-down policies per model
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="btn-ghost"><RefreshCw size={14} /></button>
                    <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                        <Plus size={14} /> Add Policy
                    </button>
                </div>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    {
                        icon: TrendingUp,
                        color: 'text-brand-400',
                        bg: 'bg-brand-900/30 border-brand-700/30',
                        title: 'Scale Up',
                        desc: 'Adds a replica when CPU exceeds the threshold or avg latency is too high. Subject to cooldown period.',
                    },
                    {
                        icon: TrendingDown,
                        color: 'text-blue-400',
                        bg: 'bg-blue-900/30 border-blue-700/30',
                        title: 'Scale Down',
                        desc: 'Removes a replica when CPU is below threshold and no requests for 5 minutes. Always keeps min replicas.',
                    },
                    {
                        icon: Activity,
                        color: 'text-yellow-400',
                        bg: 'bg-yellow-900/30 border-yellow-700/30',
                        title: 'Cooldown',
                        desc: 'Minimum wait between scaling actions. Prevents thrashing. Evaluated every 30 seconds by the autoscaler.',
                    },
                ].map(({ icon: Icon, color, bg, title, desc }) => (
                    <div key={title} className={`card p-3 border ${bg} flex gap-3`}>
                        <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
                        <div>
                            <p className={`text-xs font-semibold ${color} mb-0.5`}>{title}</p>
                            <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create / Edit form */}
            {showForm && (
                <div className="card border-brand-700/40 space-y-5">
                    <h3 className="text-sm font-semibold text-white">
                        {editingId ? 'Edit Policy' : 'New Scaling Policy'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Model selector */}
                        {!editingId && (
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block">Model</label>
                                <select
                                    className="select w-full"
                                    value={form.model_id}
                                    onChange={e => setForm(p => ({ ...p, model_id: e.target.value }))}
                                    required
                                >
                                    <option value="">Select a model...</option>
                                    {modelsWithoutPolicy.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.model_tag}) — {m.status}
                                        </option>
                                    ))}
                                </select>
                                {modelsWithoutPolicy.length === 0 && (
                                    <p className="text-xs text-yellow-400 mt-1">
                                        All models already have policies. Delete one to add a new policy.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Replica range */}
                        <div>
                            <label className="text-xs text-gray-500 mb-3 block font-medium">Replica Range</label>
                            <div className="grid grid-cols-2 gap-4">
                                <Slider
                                    label="Min Replicas"
                                    value={form.min_replicas}
                                    min={1} max={form.max_replicas}
                                    onChange={v => setForm(p => ({ ...p, min_replicas: v }))}
                                    color="blue"
                                    unit=""
                                />
                                <Slider
                                    label="Max Replicas"
                                    value={form.max_replicas}
                                    min={form.min_replicas} max={10}
                                    onChange={v => setForm(p => ({ ...p, max_replicas: v }))}
                                    color="brand"
                                    unit=""
                                />
                            </div>
                        </div>

                        {/* Scale up thresholds */}
                        <div>
                            <label className="text-xs text-gray-500 mb-3 block font-medium">
                                Scale Up Triggers <span className="text-gray-600">(add replica when exceeded)</span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <Slider
                                    label="CPU Threshold"
                                    value={form.scale_up_cpu_threshold}
                                    min={10} max={100}
                                    onChange={v => setForm(p => ({ ...p, scale_up_cpu_threshold: v }))}
                                    color="red"
                                    unit="%"
                                />
                                <Slider
                                    label="Latency Threshold"
                                    value={form.scale_up_latency_ms}
                                    min={100} max={30000} step={100}
                                    onChange={v => setForm(p => ({ ...p, scale_up_latency_ms: v }))}
                                    color="red"
                                    unit="ms"
                                />
                            </div>
                        </div>

                        {/* Scale down threshold */}
                        <div>
                            <label className="text-xs text-gray-500 mb-3 block font-medium">
                                Scale Down Trigger <span className="text-gray-600">(remove replica when below + idle)</span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <Slider
                                    label="CPU Threshold"
                                    value={form.scale_down_cpu_threshold}
                                    min={1} max={50}
                                    onChange={v => setForm(p => ({ ...p, scale_down_cpu_threshold: v }))}
                                    color="blue"
                                    unit="%"
                                />
                                <Slider
                                    label="Cooldown Period"
                                    value={form.cooldown_seconds}
                                    min={10} max={300} step={10}
                                    onChange={v => setForm(p => ({ ...p, cooldown_seconds: v }))}
                                    color="yellow"
                                    unit="s"
                                />
                            </div>
                        </div>

                        {/* Policy summary */}
                        <div className="bg-surface-700 rounded-lg p-3 border border-surface-600 text-xs font-mono text-gray-400 space-y-1">
                            <p className="text-gray-300 font-sans font-medium text-xs mb-2">Policy Summary</p>
                            <p>↑ Scale up: CPU &gt; <span className="text-red-400">{form.scale_up_cpu_threshold}%</span> or latency &gt; <span className="text-red-400">{form.scale_up_latency_ms}ms</span></p>
                            <p>↓ Scale down: CPU &lt; <span className="text-blue-400">{form.scale_down_cpu_threshold}%</span> + idle 5min</p>
                            <p>⟳ Replicas: <span className="text-brand-400">{form.min_replicas}</span> → <span className="text-brand-400">{form.max_replicas}</span> · Cooldown: <span className="text-yellow-400">{form.cooldown_seconds}s</span></p>
                        </div>

                        <div className="flex gap-2">
                            <button type="submit" className="btn-primary">
                                {editingId ? 'Update Policy' : 'Create Policy'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); resetForm() }}
                                className="btn-ghost"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Policies list */}
            {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
            ) : policies.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-12 text-center">
                    <Scale size={32} className="text-gray-700 mb-3" />
                    <p className="text-gray-500 font-medium">No scaling policies configured</p>
                    <p className="text-gray-600 text-sm mt-1 max-w-sm">
                        Add a policy to automatically scale model replicas based on CPU usage and request latency.
                    </p>
                    <button onClick={openCreate} className="btn-primary mt-4">
                        Add your first policy
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {policies.map(policy => {
                        const status = getModelStatus(policy.model_id)
                        return (
                            <div key={policy.id} className="card space-y-4">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full mt-1 ${policy.is_active ? 'bg-brand-400 pulse-dot' : 'bg-gray-600'
                                            }`} />
                                        <div>
                                            <p className="text-sm font-semibold text-white">
                                                {getModelName(policy.model_id)}
                                            </p>
                                            <span className={`text-xs px-2 py-0.5 rounded font-mono ${status === 'running'
                                                    ? 'text-brand-400 bg-brand-900/30'
                                                    : 'text-gray-500 bg-surface-700'
                                                }`}>
                                                {status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEdit(policy)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 hover:bg-surface-600 border border-surface-600 text-gray-400 hover:text-gray-200 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(policy.id)}
                                            disabled={actionLoading[policy.id]}
                                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Metrics grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Replica range */}
                                    <div className="bg-surface-700 rounded-lg p-3 border border-surface-600">
                                        <p className="text-xs text-gray-500 mb-2 font-mono">Replicas</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold font-mono text-blue-400">{policy.min_replicas}</span>
                                            <span className="text-gray-600">→</span>
                                            <span className="text-lg font-bold font-mono text-brand-400">{policy.max_replicas}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">min → max</p>
                                    </div>

                                    {/* Scale up */}
                                    <div className="bg-surface-700 rounded-lg p-3 border border-surface-600">
                                        <p className="text-xs text-gray-500 mb-2 font-mono flex items-center gap-1">
                                            <TrendingUp size={11} className="text-red-400" /> Scale Up When
                                        </p>
                                        <p className="text-xs font-mono text-gray-300">
                                            CPU &gt; <span className="text-red-400">{policy.scale_up_cpu_threshold}%</span>
                                        </p>
                                        <p className="text-xs font-mono text-gray-300 mt-0.5">
                                            Latency &gt; <span className="text-red-400">{policy.scale_up_latency_ms}ms</span>
                                        </p>
                                    </div>

                                    {/* Scale down + cooldown */}
                                    <div className="bg-surface-700 rounded-lg p-3 border border-surface-600">
                                        <p className="text-xs text-gray-500 mb-2 font-mono flex items-center gap-1">
                                            <TrendingDown size={11} className="text-blue-400" /> Scale Down When
                                        </p>
                                        <p className="text-xs font-mono text-gray-300">
                                            CPU &lt; <span className="text-blue-400">{policy.scale_down_cpu_threshold}%</span> + idle
                                        </p>
                                        <p className="text-xs font-mono text-gray-300 mt-0.5">
                                            Cooldown: <span className="text-yellow-400">{policy.cooldown_seconds}s</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Visual threshold bars */}
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-600 font-mono">CPU Thresholds</p>
                                    <div className="relative h-3 bg-surface-600 rounded-full overflow-hidden">
                                        {/* Scale down zone */}
                                        <div
                                            className="absolute left-0 top-0 h-full bg-blue-900/60 border-r border-blue-600"
                                            style={{ width: `${policy.scale_down_cpu_threshold}%` }}
                                        />
                                        {/* Normal zone */}
                                        <div
                                            className="absolute top-0 h-full bg-brand-900/30"
                                            style={{
                                                left: `${policy.scale_down_cpu_threshold}%`,
                                                width: `${policy.scale_up_cpu_threshold - policy.scale_down_cpu_threshold}%`
                                            }}
                                        />
                                        {/* Scale up zone */}
                                        <div
                                            className="absolute top-0 right-0 h-full bg-red-900/60 border-l border-red-700"
                                            style={{ width: `${100 - policy.scale_up_cpu_threshold}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs font-mono text-gray-600">
                                        <span className="text-blue-400">↓ {policy.scale_down_cpu_threshold}%</span>
                                        <span className="text-gray-500">normal zone</span>
                                        <span className="text-red-400">↑ {policy.scale_up_cpu_threshold}%</span>
                                    </div>
                                </div>

                                {/* Info note */}
                                <div className="flex items-start gap-2 text-xs text-gray-600">
                                    <Info size={11} className="shrink-0 mt-0.5" />
                                    <p>Autoscaler evaluates every 30s. In local dev, replicas are tracked in the model config — in production K8s, this triggers actual pod scaling.</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}