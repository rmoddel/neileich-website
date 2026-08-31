import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Header.css'

function Header() {
  const [openMenu, setOpenMenu] = useState(null)
  const toggleMenu = (menu) => setOpenMenu((currentMenu) => (currentMenu === menu ? null : menu))

  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="logo" onClick={() => setOpenMenu(null)}>
          <img src="/logo-english.png" alt="Neileich Lakewood Commons" className="logo-image" />
        </Link>
        <nav className="nav" aria-label="Main navigation">
          <Link to="/" onClick={() => setOpenMenu(null)}>Home</Link>
          <Link to="/about" onClick={() => setOpenMenu(null)}>Our Mission</Link>
          <Link to="/programs" onClick={() => setOpenMenu(null)}>Our Programs</Link>
          <Link to="/parnas-hayom" onClick={() => setOpenMenu(null)}>Parnas Hayom</Link>
          <Link to="/contact" onClick={() => setOpenMenu(null)}>Contact</Link>
          <div className="nav-menu donate-menu">
            <button type="button" className="donate-button" aria-expanded={openMenu === 'donate'} aria-controls="donate-menu" onClick={() => toggleMenu('donate')}>
              Donate Now
            </button>
            {openMenu === 'donate' && (
              <div id="donate-menu" className="donate-options" role="region" aria-label="Donation options">
                <a href="https://secure.cardknox.com/neileich" target="_blank" rel="noreferrer">Donate with CardKnox</a>
                <a href="https://thedonorsfund.org/donate/NEILECH-p7711855057422424/264527675" target="_blank" rel="noreferrer">Donate with Donors Fund</a>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}

export default Header
