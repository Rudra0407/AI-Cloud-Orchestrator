import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard, Cpu, GitBranch, Activity,
    Zap, Scale, Terminal, Settings
} from 'lucide-react'

const NAV_ITEMS = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/models', icon: Cpu, label: 'Models' },
    { to: '/routes', icon: GitBranch, label: 'Routes' },
    { to: '/metrics', icon: Activity, label: 'Metrics' },
    { to: '/inference', icon: Terminal, label: 'Playground' },
    { to: '/benchmark', icon: Zap, label: 'Benchmark' },
    { to: '/scaling', icon: Scale, label: 'Autoscaling' },
]

export default function Sidebar() {
    return (
        <aside className="w-56 min-h-screen bg-surface-900 border-r border-surface-700 flex flex-col">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-surface-700">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold font-mono">AI</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white leading-none">rAIn Orch.</p>
                        <p className="text-[10px] text-brand-400 font-mono mt-0.5">v1.0.0</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100 ${isActive
                                ? 'bg-brand-900/60 text-brand-400 border border-brand-700/30'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700'
                            }`
                        }
                    >
                        <Icon size={15} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-surface-700">
                <p className="text-[10px] text-gray-600 font-mono">Local LLM Infrastructure</p>
            </div>
        </aside>
    )
}