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
            <button type="button" className="header-donate-button" aria-expanded={openMenu === 'donate'} aria-controls="donate-menu" onClick={() => toggleMenu('donate')}>
              Donate Now
            </button>
            {openMenu === 'donate' && (
              <div id="donate-menu" className="header-donate-options" role="region" aria-label="Donation options">
                <a className="header-donate-option" href="https://secure.cardknox.com/neileich" target="_blank" rel="noreferrer">
                  <span className="header-donate-mark header-donate-mark-sola" aria-hidden="true">
                    <img src="/sola.svg" alt="" />
                  </span>
                  <span className="header-donate-copy">
                    <span className="header-donate-title">Donate by Credit Card</span>
                  </span>
                </a>

                <section className="header-daf-section" aria-labelledby="header-daf-heading">
                  <p id="header-daf-heading" className="header-daf-heading">Donate with the links below:</p>
                  <div className="header-daf-icons">
                    <a className="header-daf-icon header-daf-icon-donors-fund" href="https://thedonorsfund.org/donate/NEILECH-p7711855057422424/264527675" target="_blank" rel="noreferrer" aria-label="Donate through The Donors Fund">
                      <img src="/thedonorsfund.svg" alt="" />
                    </a>

                    <a className="header-daf-icon header-daf-icon-ojc" href="https://secure.ojccardpaymentsite.org/MQAAADYAAAAxAAAANAAAADgAAAA=" target="_blank" rel="noreferrer" aria-label="Donate through OJC">
                      <img src="https://secure.ojccardpaymentsite.org/images/logo.svg" alt="" />
                    </a>
                  </div>
                </section>

                <p className="header-donate-note">
                  Or by searching for Tax ID <strong>26-4527675</strong> and selecting <strong>Neileich</strong>.
                </p>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}

export default Header
