import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Components
import Layout from './components/Layout/Layout'
import Dashboard from './components/Dashboard/Dashboard'
import CameraView from './components/Camera/CameraView'
import CameraManagement from './components/Camera/CameraManagement'
import CameraDetail from './components/Camera/CameraDetail'
import LiveStreamPage from './components/Camera/LiveStreamPage'
import AlertsList from './components/Alerts/AlertsList'
import Settings from './components/Settings/Settings'
import ReportsPage from './components/Reports/ReportsPage'
import { DetectionTestPage, VideoTestPage } from './components/Detection'

const App: React.FC = () => {
  return (
    <>
      <Toaster
        position="top-left"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#16213e',
            color: '#e8e8e8',
            border: '1px solid #0f3460',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="live" element={<LiveStreamPage />} />
          <Route path="cameras" element={<CameraManagement />} />
          <Route path="cameras/:id" element={<CameraDetail />} />
          <Route path="cameras/:id/view" element={<CameraView />} />
          <Route path="alerts" element={<AlertsList />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="detection" element={<DetectionTestPage />} />
          <Route path="detection/video" element={<VideoTestPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
