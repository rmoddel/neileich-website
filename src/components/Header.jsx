import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Header.css'

const programGroups = [
  { title: "Boys' Programs", programs: ['Binareinu (Night Seder)', "Rav's Boys' Programs — Shabbos Afternoon", "Motzei Shabbos Farhers & Mishnayos Ba'al Peh", '4th Grade Program', 'Leil Shavuos Programming', 'Binareinu Mesivta', 'Erev Shabbos Learning', "Masechtos Ba'al Peh", 'Bochurim Chaburas Shabbos', 'Parsha Chaburos', 'Marbeh Chaim', "Rabbi Fendel's Programs (Zichron Zechariah)", 'Greater Adventure South', 'Chanukah, Purim & Midwinter Programs', "Avos U'bonim"] },
  { title: "Girls' Programs", programs: ['Hearts & Palms', 'Homework Clubs', 'Camp Kolos', "Girls' Production", 'Bnos', 'Hoops'] },
  { title: 'Family & Community', programs: ['Neileich Comic Library', 'Reading Library', 'Family Library', "Children's USB Audio Library", 'Chol Hamoed Trips', "Chanoch L'naar", 'Commons Comments'] }
]

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
          <div className="nav-menu programs-nav">
            <button type="button" className="nav-menu-button" aria-expanded={openMenu === 'programs'} aria-controls="programs-menu" onClick={() => toggleMenu('programs')}>
              Our Programs
            </button>
            {openMenu === 'programs' && (
              <div id="programs-menu" className="programs-menu" role="region" aria-label="Neileich programs">
                {programGroups.map((group) => (
                  <section className="program-group" key={group.title}>
                    <h2>{group.title}</h2>
                    <ul>{group.programs.map((program) => <li key={program}>{program}</li>)}</ul>
                  </section>
                ))}
              </div>
            )}
          </div>
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
