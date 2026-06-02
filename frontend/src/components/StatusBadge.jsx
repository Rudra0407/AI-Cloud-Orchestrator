export default function StatusBadge({ status }) {
    const classes = {
        running: 'badge-running',
        stopped: 'badge-stopped',
        error: 'badge-error',
        pulling: 'badge-pulling',
    }

    const dots = {
        running: 'bg-brand-400',
        stopped: 'bg-gray-500',
        error: 'bg-red-400',
        pulling: 'bg-yellow-400',
    }

    return (
        <span className={classes[status] || 'badge-stopped'}>
            <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${dots[status] || 'bg-gray-500'}`} />
            {status}
        </span>
    )
}