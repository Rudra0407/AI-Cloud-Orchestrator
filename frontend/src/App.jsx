import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Models from './pages/Models'
import Playground from './pages/Playground'
import Metrics from './pages/Metrics'
import Benchmark from './pages/Benchmark'
import RoutesPage from './pages/Routes'
import Autoscaling from './pages/Autoscaling'

const Placeholder = ({ name }) => (
    <div className="p-6">
        <h1 className="text-xl font-semibold text-white">{name}</h1>
        <p className="text-gray-500 mt-2 text-sm">Coming soon.</p>
    </div>
)

export default function App() {
    return (
        <BrowserRouter>
            <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 overflow-auto">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/models" element={<Models />} />
                        <Route path="/routes" element={<RoutesPage />} />
                        <Route path="/metrics" element={<Metrics />} />
                        <Route path="/inference" element={<Playground />} />
                        <Route path="/benchmark" element={<Benchmark />} />
                        <Route path="/scaling" element={<Autoscaling />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    )
}