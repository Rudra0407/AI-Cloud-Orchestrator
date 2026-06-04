import { useState, useEffect } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, GitBranch, RefreshCw, Info } from 'lucide-react'
import { routesApi, modelsApi } from '../api/client'

const STRATEGIES = [
    {
        value: 'round_robin',
        label: 'Round Robin',
        desc: 'Distribute requests evenly across all models in sequence.',
    },
    {
        value: 'weighted',
        label: 'Weighted',
        desc: 'Send more traffic to higher-weight models. Good for A/B testing.',
    },
    {
        value: 'least_latency',
        label: 'Least Latency',
        desc: 'Always route to the model with the lowest recent response time.',
    },
]

const STRATEGY_COLORS = {
    round_robin: 'bg-blue-900/40 text-blue-400 border-blue-700/30',
    weighted: 'bg-purple-900/40 text-purple-400 border-purple-700/30',
    least_latency: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/30',
}

export default function Routes() {
    const [routes, setRoutes] = useState([])
    const [models, setModels] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState({})
    const [form, setForm] = useState({
        name: '',
        path_prefix: '',
        strategy: 'round_robin',
        targets: [],   // [{model_id, weight}]
    })

    const load = async () => {
        setLoading(true)
        const [r, m] = await Promise.all([
            routesApi.list().catch(() => []),
            modelsApi.list().catch(() => []),
        ])
        setRoutes(r)
        setModels(m.filter(m => m.status === 'running'))
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    // Add/remove model targets in the form
    const toggleTarget = (modelId) => {
        setForm(prev => {
            const exists = prev.targets.find(t => t.model_id === modelId)
            if (exists) {
                return { ...prev, targets: prev.targets.filter(t => t.model_id !== modelId) }
            }
            return { ...prev, targets: [...prev.targets, { model_id: modelId, weight: 1 }] }
        })
    }

    const setWeight = (modelId, weight) => {
        setForm(prev => ({
            ...prev,
            targets: prev.targets.map(t =>
                t.model_id === modelId ? { ...t, weight: Number(weight) } : t
            ),
        }))
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (form.targets.length === 0) {
            alert('Add at least one model target')
            return
        }
        try {
            await routesApi.create({
                name: form.name,
                path_prefix: form.path_prefix || `/${form.name}`,
                strategy: form.strategy,
                targets: form.targets,
            })
            setShowForm(false)
            setForm({ name: '', path_prefix: '', strategy: 'round_robin', targets: [] })
            load()
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to create route')
        }
    }

    const handleToggle = async (id) => {
        setActionLoading(p => ({ ...p, [id]: 'toggle' }))
        try {
            await routesApi.toggle(id)
            load()
        } finally {
            setActionLoading(p => ({ ...p, [id]: null }))
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this route?')) return
        setActionLoading(p => ({ ...p, [id]: 'delete' }))
        try {
            await routesApi.delete(id)
            load()
        } finally {
            setActionLoading(p => ({ ...p, [id]: null }))
        }
    }

    const getModelName = (modelId) => {
        const m = models.find(m => m.id === modelId)
        return m ? m.name : modelId?.slice(0, 8) + '...'
    }

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Routes</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Load balance traffic across multiple models
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="btn-ghost"><RefreshCw size={14} /></button>
                    <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
                        <Plus size={14} /> Create Route
                    </button>
                </div>
            </div>

            {/* Strategy explainer */}
            <div className="grid grid-cols-3 gap-3">
                {STRATEGIES.map(s => (
                    <div key={s.value} className="card p-3 flex gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono border self-start ${STRATEGY_COLORS[s.value]}`}>
                            {s.label}
                        </span>
                        <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                    </div>
                ))}
            </div>

            {/* Create form */}
            {showForm && (
                <div className="card border-brand-700/40 space-y-4">
                    <h3 className="text-sm font-semibold text-white">Create New Route</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block">Route Name</label>
                                <input
                                    className="input w-full"
                                    placeholder="e.g. production"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block">Path Prefix</label>
                                <input
                                    className="input w-full"
                                    placeholder="e.g. /production (auto-filled)"
                                    value={form.path_prefix}
                                    onChange={e => setForm(p => ({ ...p, path_prefix: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Strategy selector */}
                        <div>
                            <label className="text-xs text-gray-500 mb-1.5 block">Load Balancing Strategy</label>
                            <div className="grid grid-cols-3 gap-2">
                                {STRATEGIES.map(s => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setForm(p => ({ ...p, strategy: s.value }))}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${form.strategy === s.value
                                                ? 'bg-brand-900/50 border-brand-600/50 text-brand-300'
                                                : 'bg-surface-700 border-surface-600 text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        <p className="font-semibold mb-0.5">{s.label}</p>
                                        <p className="text-gray-500 font-normal leading-tight">{s.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Model targets */}
                        <div>
                            <label className="text-xs text-gray-500 mb-1.5 block">
                                Target Models
                                {form.targets.length > 0 && (
                                    <span className="ml-2 text-brand-400">{form.targets.length} selected</span>
                                )}
                            </label>
                            {models.length === 0 ? (
                                <p className="text-sm text-gray-600 bg-surface-700 rounded-lg p-3">
                                    No running models. Start a model from the Models page first.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {models.map(model => {
                                        const target = form.targets.find(t => t.model_id === model.id)
                                        const selected = !!target
                                        return (
                                            <div
                                                key={model.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${selected
                                                        ? 'bg-brand-900/20 border-brand-700/40'
                                                        : 'bg-surface-700 border-surface-600'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleTarget(model.id)}
                                                    className="w-4 h-4 accent-green-500"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-200">{model.display_name || model.name}</p>
                                                    <p className="text-xs font-mono text-brand-400">{model.model_tag}</p>
                                                </div>
                                                {/* Weight input — only for weighted strategy */}
                                                {selected && form.strategy === 'weighted' && (
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-xs text-gray-500">Weight</label>
                                                        <input
                                                            type="number"
                                                            min={1} max={100}
                                                            value={target.weight}
                                                            onChange={e => setWeight(model.id, e.target.value)}
                                                            className="input w-16 text-center text-xs py-1"
                                                        />
                                                    </div>
                                                )}
                                                {selected && form.strategy !== 'weighted' && (
                                                    <span className="text-xs text-gray-600 font-mono">equal share</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Weighted visual */}
                        {form.strategy === 'weighted' && form.targets.length > 0 && (
                            <div className="bg-surface-700 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-2">Traffic distribution preview</p>
                                <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                                    {(() => {
                                        const total = form.targets.reduce((s, t) => s + t.weight, 0)
                                        const colors = ['bg-brand-500', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500']
                                        return form.targets.map((t, i) => (
                                            <div
                                                key={t.model_id}
                                                className={`${colors[i % colors.length]} transition-all`}
                                                style={{ width: `${(t.weight / total) * 100}%` }}
                                                title={`${getModelName(t.model_id)}: ${Math.round((t.weight / total) * 100)}%`}
                                            />
                                        ))
                                    })()}
                                </div>
                                <div className="flex gap-3 mt-2 flex-wrap">
                                    {(() => {
                                        const total = form.targets.reduce((s, t) => s + t.weight, 0)
                                        const colors = ['text-brand-400', 'text-blue-400', 'text-purple-400', 'text-yellow-400']
                                        return form.targets.map((t, i) => (
                                            <span key={t.model_id} className={`text-xs font-mono ${colors[i % colors.length]}`}>
                                                {getModelName(t.model_id)}: {Math.round((t.weight / total) * 100)}%
                                            </span>
                                        ))
                                    })()}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button type="submit" className="btn-primary">Create Route</button>
                            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Routes list */}
            {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
            ) : routes.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-12 text-center">
                    <GitBranch size={32} className="text-gray-700 mb-3" />
                    <p className="text-gray-500 font-medium">No routes configured</p>
                    <p className="text-gray-600 text-sm mt-1 max-w-sm">
                        Routes let you send traffic to multiple models with load balancing.
                        Create one to get started.
                    </p>
                    <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
                        Create your first route
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {routes.map(route => (
                        <div key={route.id} className={`card transition-all ${!route.is_active ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full mt-1 ${route.is_active ? 'bg-brand-400 pulse-dot' : 'bg-gray-600'}`} />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-white">{route.name}</h3>
                                            <span className={`px-2 py-0.5 rounded text-xs font-mono border ${STRATEGY_COLORS[route.strategy] || 'bg-surface-700 text-gray-400 border-surface-600'}`}>
                                                {STRATEGIES.find(s => s.value === route.strategy)?.label || route.strategy}
                                            </span>
                                            {!route.is_active && (
                                                <span className="px-2 py-0.5 rounded text-xs font-mono bg-surface-700 text-gray-500 border border-surface-600">
                                                    disabled
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-mono text-gray-500 mt-0.5">{route.path_prefix}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(route.id)}
                                        disabled={actionLoading[route.id]}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 hover:bg-surface-600 border border-surface-600 text-gray-400 hover:text-gray-200 transition-colors"
                                    >
                                        {route.is_active
                                            ? <><ToggleRight size={14} className="text-brand-400" /> Disable</>
                                            : <><ToggleLeft size={14} /> Enable</>
                                        }
                                    </button>
                                    <button
                                        onClick={() => handleDelete(route.id)}
                                        disabled={actionLoading[route.id]}
                                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Targets */}
                            {route.targets?.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-surface-700">
                                    <p className="text-xs text-gray-600 font-mono mb-2">
                                        {route.targets.length} target{route.targets.length > 1 ? 's' : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {route.targets.map(t => {
                                            const model = models.find(m => m.id === t.model_id)
                                            const totalWeight = route.targets.reduce((s, x) => s + x.weight, 0)
                                            const pct = Math.round((t.weight / totalWeight) * 100)
                                            return (
                                                <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 rounded-lg border border-surface-600">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                                                    <span className="text-xs text-gray-300 font-medium">
                                                        {model?.name || t.model_id?.slice(0, 8)}
                                                    </span>
                                                    <span className="text-xs font-mono text-gray-600">
                                                        {model?.model_tag}
                                                    </span>
                                                    {route.strategy === 'weighted' && (
                                                        <span className="text-xs font-mono text-purple-400">{pct}%</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Traffic bar for weighted routes */}
                                    {route.strategy === 'weighted' && route.targets.length > 1 && (
                                        <div className="mt-3">
                                            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                                                {(() => {
                                                    const total = route.targets.reduce((s, t) => s + t.weight, 0)
                                                    const colors = ['bg-brand-500', 'bg-blue-500', 'bg-purple-500', 'bg-yellow-500']
                                                    return route.targets.map((t, i) => (
                                                        <div
                                                            key={t.id}
                                                            className={`${colors[i % colors.length]}`}
                                                            style={{ width: `${(t.weight / total) * 100}%` }}
                                                        />
                                                    ))
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* How to use */}
                            <div className="mt-3 pt-3 border-t border-surface-700 flex items-start gap-2">
                                <Info size={11} className="text-gray-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-gray-600 font-mono">
                                    Use in Playground or API: model = "<span className="text-brand-400">{route.name}</span>"
                                    → POST /api/v1/inference/chat
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}