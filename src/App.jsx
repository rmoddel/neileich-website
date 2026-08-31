import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import ParnasHayom from './pages/ParnasHayom'
import ProgramsPage from './pages/ProgramsPage'
import './App.css'

function App() {
  return (
    <div className="app">
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
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
