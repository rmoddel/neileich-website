import { Link } from 'react-router-dom'
import ScrollLink from './ScrollLink'
import './Header.css'

function Header() {
  return (
    <header className="header">
      <div className="container header-content">
        <Link to="/" className="logo">
          <img src="/logo-english.png" alt="Neileich Lakewood Commons" className="logo-image" />
        </Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/about">Our Mission</Link>
          <Link to="/parnas-hayom">Parnas Hayom</Link>
          {/* <ScrollLink to="#programs">Programs</ScrollLink> */}
          <Link to="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
