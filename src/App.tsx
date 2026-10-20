import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Overview } from './pages/Overview'
import { Players } from './pages/Players'
import { PlayerDetail } from './pages/PlayerDetail'
import { Alerts } from './pages/Alerts'
import { Cases } from './pages/Cases'
import { Compliance } from './pages/Compliance'
import { Assistant } from './pages/Assistant'
import { Governance } from './pages/Governance'
import { Foresight } from './pages/Foresight'
import { Efficacy } from './pages/Efficacy'
import { Fairness } from './pages/Fairness'
import { Lab } from './pages/Lab'
import { ModelStudio } from './pages/ModelStudio'
import { GameRisk } from './pages/GameRisk'
import { DataImport } from './pages/DataImport'
import { useStore } from './store/useStore'

export default function App() {
  const theme = useStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/:id" element={<PlayerDetail />} />
        <Route path="/data" element={<DataImport />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/foresight" element={<Foresight />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/efficacy" element={<Efficacy />} />
        <Route path="/fairness" element={<Fairness />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/model" element={<ModelStudio />} />
        <Route path="/games" element={<GameRisk />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
