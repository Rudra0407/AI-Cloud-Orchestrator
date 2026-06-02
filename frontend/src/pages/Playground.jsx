import { useState, useEffect, useRef } from 'react'
import { Send, Trash2, Zap, Clock, Hash } from 'lucide-react'
import { modelsApi, inferenceApi } from '../api/client'

export default function Playground() {
    const [models, setModels] = useState([])
    const [selectedModel, setSelectedModel] = useState('')
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [lastStats, setLastStats] = useState(null)
    const bottomRef = useRef(null)

    useEffect(() => {
        modelsApi.list().then(all => {
            const running = all.filter(m => m.status === 'running')
            setModels(running)
            if (running.length > 0) setSelectedModel(running[0].name)
        })
    }, [])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const send = async () => {
        if (!input.trim() || !selectedModel || loading) return

        const userMsg = { role: 'user', content: input.trim() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setLoading(true)

        try {
            const res = await inferenceApi.chat({
                model: selectedModel,
                messages: [...messages, userMsg],
                max_tokens: 512,
                temperature: 0.7,
            })
            setMessages(prev => [...prev, res.message])
            setLastStats({
                latency_ms: res.latency_ms,
                prompt_tokens: res.prompt_tokens,
                completion_tokens: res.completion_tokens,
                total_tokens: res.total_tokens,
            })
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'error',
                content: err.response?.data?.detail || 'Request failed',
            }])
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
        }
    }

    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-xl font-semibold text-white">Playground</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Chat with your deployed models</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Model selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">Model</span>
                        <select
                            className="select text-sm"
                            value={selectedModel}
                            onChange={e => setSelectedModel(e.target.value)}
                        >
                            {models.length === 0
                                ? <option>No running models</option>
                                : models.map(m => (
                                    <option key={m.id} value={m.name}>{m.display_name || m.name} ({m.model_tag})</option>
                                ))
                            }
                        </select>
                    </div>
                    {/* Stats bar */}
                    {lastStats && (
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-surface-700 rounded-lg border border-surface-600">
                            <span className="flex items-center gap-1 text-xs font-mono text-yellow-400">
                                <Clock size={11} />{(lastStats.latency_ms / 1000).toFixed(1)}s
                            </span>
                            <span className="flex items-center gap-1 text-xs font-mono text-brand-400">
                                <Hash size={11} />{lastStats.total_tokens} tokens
                            </span>
                            <span className="flex items-center gap-1 text-xs font-mono text-purple-400">
                                <Zap size={11} />{(lastStats.completion_tokens / (lastStats.latency_ms / 1000)).toFixed(1)} tok/s
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => { setMessages([]); setLastStats(null) }}
                        className="btn-ghost flex items-center gap-1.5 text-xs"
                    >
                        <Trash2 size={13} /> Clear
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 rounded-xl bg-brand-900/40 border border-brand-700/30 flex items-center justify-center mb-3">
                            <span className="text-brand-400 text-xl font-bold font-mono">AI</span>
                        </div>
                        <p className="text-gray-400 font-medium">Start a conversation</p>
                        <p className="text-gray-600 text-sm mt-1">
                            {selectedModel ? `Talking to ${selectedModel}` : 'Select a running model above'}
                        </p>
                        {/* Quick prompts */}
                        <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-lg">
                            {[
                                'Explain what you are in one sentence.',
                                'Write a Python function to reverse a string.',
                                'What is the difference between TCP and UDP?',
                                'Give me 3 ideas for a side project.',
                            ].map(prompt => (
                                <button
                                    key={prompt}
                                    onClick={() => setInput(prompt)}
                                    className="px-3 py-1.5 rounded-lg text-xs text-gray-400 bg-surface-700 hover:bg-surface-600 hover:text-gray-200 border border-surface-600 transition-colors text-left"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-brand-600 text-white rounded-br-sm'
                                : msg.role === 'error'
                                    ? 'bg-red-950 text-red-300 border border-red-800/30 rounded-bl-sm'
                                    : 'bg-surface-700 text-gray-200 border border-surface-600 rounded-bl-sm'
                            }`}>
                            {msg.role !== 'user' && msg.role !== 'error' && (
                                <p className="text-xs font-mono text-brand-400 mb-1.5">
                                    {selectedModel}
                                </p>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-surface-700 border border-surface-600 rounded-2xl rounded-bl-sm px-4 py-3">
                            <p className="text-xs font-mono text-brand-400 mb-1.5">{selectedModel}</p>
                            <div className="flex gap-1.5 items-center h-4">
                                {[0, 1, 2].map(i => (
                                    <span
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full bg-brand-400"
                                        style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-surface-700 shrink-0">
                <div className="flex gap-3 items-end">
                    <textarea
                        className="input flex-1 resize-none min-h-[44px] max-h-32 py-2.5"
                        placeholder={selectedModel ? `Message ${selectedModel}...` : 'Select a model first'}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!selectedModel || loading}
                        rows={1}
                    />
                    <button
                        onClick={send}
                        disabled={!input.trim() || !selectedModel || loading}
                        className="btn-primary h-[44px] w-[44px] flex items-center justify-center p-0 shrink-0"
                    >
                        <Send size={16} />
                    </button>
                </div>
                <p className="text-xs text-gray-600 mt-1.5">Enter to send · Shift+Enter for new line</p>
            </div>
        </div>
    )
}