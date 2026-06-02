import { useState, useEffect } from 'react'
import { Plus, Play, Square, Trash2, RefreshCw } from 'lucide-react'
import { modelsApi } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const POPULAR_MODELS = [
    'llama3:8b', 'llama3:70b', 'mistral:7b', 'codellama:7b',
    'gemma:7b', 'phi3:mini', 'qwen2:7b', 'deepseek-coder:6.7b',
]

export default function Models() {
    const [models, setModels] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', model_tag: '', display_name: '' })
    const [actionLoading, setActionLoading] = useState({})

    const load = () => modelsApi.list().then(setModels).finally(() => setLoading(false))

    useEffect(() => { load() }, [])

    const handleCreate = async (e) => {
        e.preventDefault()
        try {
            await modelsApi.create(form)
            setShowForm(false)
            setForm({ name: '', model_tag: '', display_name: '' })
            load()
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to create model')
        }
    }

    const handleAction = async (id, action) => {
        setActionLoading(p => ({ ...p, [id]: action }))
        try {
            if (action === 'start') await modelsApi.start(id)
            else if (action === 'stop') await modelsApi.stop(id)
            else if (action === 'delete') {
                if (!confirm('Delete this model?')) return
                await modelsApi.delete(id)
            }
            load()
        } catch (err) {
            alert(err.response?.data?.detail || `Failed to ${action}`)
        } finally {
            setActionLoading(p => ({ ...p, [id]: null }))
        }
    }

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Models</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Deploy and manage LLM inference containers</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="btn-ghost">
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
                        <Plus size={14} /> Deploy Model
                    </button>
                </div>
            </div>

            {/* Deploy Form */}
            {showForm && (
                <div className="card border-brand-700/40">
                    <h3 className="text-sm font-semibold text-white mb-4">Deploy New Model</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block">Model Name (unique ID)</label>
                                <input
                                    className="input w-full"
                                    placeholder="e.g. my-llama"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1.5 block">Display Name</label>
                                <input
                                    className="input w-full"
                                    placeholder="e.g. LLaMA 3 8B"
                                    value={form.display_name}
                                    onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 mb-1.5 block">Ollama Model Tag</label>
                            <div className="flex gap-2">
                                <input
                                    className="input flex-1"
                                    placeholder="e.g. llama3:8b"
                                    value={form.model_tag}
                                    onChange={e => setForm(p => ({ ...p, model_tag: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {POPULAR_MODELS.map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setForm(p => ({ ...p, model_tag: tag, name: tag.replace(':', '-') }))}
                                        className="px-2 py-0.5 rounded text-xs font-mono bg-surface-700 hover:bg-surface-600 text-gray-400 hover:text-brand-400 transition-colors border border-surface-600"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button type="submit" className="btn-primary">Deploy</button>
                            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Models Table */}
            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <p className="p-5 text-sm text-gray-500">Loading...</p>
                ) : models.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-gray-500 text-sm">No models deployed yet.</p>
                        <button onClick={() => setShowForm(true)} className="btn-primary mt-3">
                            Deploy your first model
                        </button>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-surface-900">
                            <tr className="text-xs font-mono text-gray-600 border-b border-surface-700">
                                {['Name', 'Model Tag', 'Status', 'Port', 'Created', 'Actions'].map(h => (
                                    <th key={h} className="text-left px-4 py-3">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                            {models.map(model => (
                                <tr key={model.id} className="hover:bg-surface-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-medium text-white">{model.display_name || model.name}</p>
                                        <p className="text-xs text-gray-600 font-mono">{model.id.slice(0, 8)}...</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-mono text-brand-400 bg-brand-900/30 px-2 py-0.5 rounded">
                                            {model.model_tag}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge status={model.status} /></td>
                                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                                        {model.port || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">
                                        {new Date(model.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            {model.status === 'running' ? (
                                                <button
                                                    onClick={() => handleAction(model.id, 'stop')}
                                                    disabled={actionLoading[model.id]}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-950/30 transition-colors"
                                                    title="Stop"
                                                >
                                                    <Square size={14} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleAction(model.id, 'start')}
                                                    disabled={actionLoading[model.id] || model.status === 'pulling'}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-900/30 transition-colors"
                                                    title="Start"
                                                >
                                                    <Play size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleAction(model.id, 'delete')}
                                                disabled={actionLoading[model.id]}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}