import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export const api = axios.create({
    baseURL: `${API_BASE}/api/v1`,
    headers: { 'Content-Type': 'application/json' },
})

// Models
export const modelsApi = {
    list: () => api.get('/models/').then(r => r.data),
    create: (data) => api.post('/models/', data).then(r => r.data),
    start: (id) => api.post(`/models/${id}/start`).then(r => r.data),
    stop: (id) => api.post(`/models/${id}/stop`).then(r => r.data),
    delete: (id) => api.delete(`/models/${id}`),
    stats: (id) => api.get(`/models/${id}/stats`).then(r => r.data),
}

// Routes
export const routesApi = {
    list: () => api.get('/routes/').then(r => r.data),
    create: (data) => api.post('/routes/', data).then(r => r.data),
    delete: (id) => api.delete(`/routes/${id}`),
    toggle: (id) => api.patch(`/routes/${id}/toggle`).then(r => r.data),
}

// Metrics
export const metricsApi = {
    system: () => api.get('/metrics/system').then(r => r.data),
    models: () => api.get('/metrics/models').then(r => r.data),
    history: (modelId, hours = 24) =>
        api.get('/metrics/history', { params: { model_id: modelId, hours } }).then(r => r.data),
}

// Inference
export const inferenceApi = {
    chat: (data) => api.post('/inference/chat', data).then(r => r.data),
}

// Benchmark
export const benchmarkApi = {
    run: (data) => api.post('/benchmark/run', data).then(r => r.data),
}

// Scaling
export const scalingApi = {
    list: () => api.get('/scaling/').then(r => r.data),
    create: (data) => api.post('/scaling/', data).then(r => r.data),
    update: (id, data) => api.patch(`/scaling/${id}`, data).then(r => r.data),
    delete: (id) => api.delete(`/scaling/${id}`),
}

// WebSocket for real-time metrics
export const createMetricsWebSocket = (onMessage) => {
    try {
        const ws = new WebSocket(`${WS_BASE}/api/v1/metrics/ws`)
        ws.onmessage = (e) => onMessage(JSON.parse(e.data))
        ws.onerror = (e) => console.warn('WS unavailable - metrics disabled')
        return ws
    } catch (e) {
        console.warn('WS unavailable')
        return { close: () => { } }
    }
}