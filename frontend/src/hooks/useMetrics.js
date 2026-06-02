import { useState, useEffect, useRef } from 'react'
import { createMetricsWebSocket } from '../api/client'

export function useMetrics() {
    const [systemMetrics, setSystemMetrics] = useState(null)
    const [modelMetrics, setModelMetrics] = useState([])
    const [connected, setConnected] = useState(false)
    const wsRef = useRef(null)

    useEffect(() => {
        const connect = () => {
            const ws = createMetricsWebSocket((data) => {
                if (data.type === 'metrics') {
                    setSystemMetrics(data.system)
                    setModelMetrics(data.models || [])
                    setConnected(true)
                }
            })
            ws.onopen = () => setConnected(true)
            ws.onclose = () => {
                setConnected(false)
                // Reconnect after 5s
                setTimeout(connect, 5000)
            }
            wsRef.current = ws
        }
        connect()
        return () => wsRef.current?.close()
    }, [])

    return { systemMetrics, modelMetrics, connected }
}