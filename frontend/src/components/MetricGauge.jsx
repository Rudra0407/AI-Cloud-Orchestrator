export default function MetricGauge({ label, value, unit = '%', max = 100, color = 'brand' }) {
    const pct = Math.min((value / max) * 100, 100)
    const colorMap = {
        brand: { bar: 'bg-brand-500', text: 'text-brand-400' },
        red: { bar: 'bg-red-500', text: 'text-red-400' },
        yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400' },
    }
    const c = colorMap[color] || colorMap.brand

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono">{label}</span>
                <span className={`text-sm font-bold font-mono ${c.text}`}>
                    {typeof value === 'number' ? value.toFixed(1) : value}{unit}
                </span>
            </div>
            <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}