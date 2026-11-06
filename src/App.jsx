import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import RouteMeta from './components/RouteMeta'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import ParnasHayom from './pages/ParnasHayom'
import ProgramsPage from './pages/ProgramsPage'
import Donate from './pages/Donate'
import AroundTheCommons from './pages/AroundTheCommons'
import AroundTheCommonsLogin from './pages/AroundTheCommonsLogin'
import AtcZmanim from './pages/AtcZmanim'
import AtcSpreadsheet from './pages/AtcSpreadsheet.jsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <RouteMeta />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/parnas-hayom" element={<ParnasHayom />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/around-the-commons/login" element={<AroundTheCommonsLogin />} />
          <Route path="/around-the-commons" element={<AroundTheCommons />} />
          <Route path="/around-the-commons/import" element={<AtcSpreadsheet />} />
          <Route path="/around-the-commons/zmanim" element={<AtcZmanim />} />
          <Route path="/atc" element={<Navigate to="/around-the-commons" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
