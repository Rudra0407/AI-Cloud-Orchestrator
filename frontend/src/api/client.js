import axios from 'axios';

// We use the relative path so Vite's proxy (configured in vite.config.js) 
// automatically intercepts and forwards these requests to your Python backend!
export const apiClient = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' },
});

// Models
export const modelsApi = {
    list: () => apiClient.get('/models/').then(r => r.data),
    create: (data) => apiClient.post('/models/', data).then(r => r.data),
    start: (id) => apiClient.post(`/models/${id}/start`).then(r => r.data),
    stop: (id) => apiClient.post(`/models/${id}/stop`).then(r => r.data),
    delete: (id) => apiClient.delete(`/models/${id}`),
    stats: (id) => apiClient.get(`/models/${id}/stats`).then(r => r.data),
};

// Routes
export const routesApi = {
    list: () => apiClient.get('/routes/').then(r => r.data),
    create: (data) => apiClient.post('/routes/', data).then(r => r.data),
    delete: (id) => apiClient.delete(`/routes/${id}`),
    toggle: (id) => apiClient.patch(`/routes/${id}/toggle`).then(r => r.data),
};

// Metrics
export const metricsApi = {
    system: () => apiClient.get('/metrics/system').then(r => r.data),
    models: () => apiClient.get('/metrics/models').then(r => r.data),
    history: (modelId, hours = 24) =>
        apiClient.get('/metrics/history', { params: { model_id: modelId, hours } }).then(r => r.data),
};

// Inference
export const inferenceApi = {
    chat: (data) => apiClient.post('/inference/chat', data).then(r => r.data),
};

// Benchmark
export const benchmarkApi = {
    run: (data) => apiClient.post('/benchmark/run', data).then(r => r.data),
};

// Scaling
export const scalingApi = {
    list: () => apiClient.get('/scaling/').then(r => r.data),
    create: (data) => apiClient.post('/scaling/', data).then(r => r.data),
    update: (id, data) => apiClient.patch(`/scaling/${id}`, data).then(r => r.data),
    delete: (id) => apiClient.delete(`/scaling/${id}`),
};

// WebSocket for real-time metrics
export const createMetricsWebSocket = (onMessage) => {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/metrics/ws`);
        ws.onmessage = (e) => onMessage(JSON.parse(e.data));
        ws.onerror = (e) => console.warn('WS unavailable - metrics disabled');
        return ws;
    } catch (e) {
        console.warn('WS unavailable');
        return { close: () => { } };
    }
};