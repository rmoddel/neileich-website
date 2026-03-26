import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-main">
          <div className="footer-brand">
            <span className="footer-logo">נלך</span>
            <span className="footer-name">Neileich Lakewood Commons</span>
          </div>
          <p className="footer-tagline">Building belonging. Thriving children. Strong Kehila.</p>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <h4>Navigation</h4>
            <Link to="/">Home</Link>
            <a href="/#mission">About</a>
            <a href="/#programs">Programs</a>
            <Link to="/contact">Contact</Link>
          </div>
          <div className="footer-column">
            <h4>Legal</h4>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms">Terms & Conditions</Link>
          </div>
          <div className="footer-column">
            <h4>Contact</h4>
            <p>info@neileich.org</p>
            <p>Lakewood, NJ</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {currentYear} Neileich. All rights reserved.
          </p>
          <p className="footer-sms-terms">
            Text STOP to opt-out. Text HELP for help. Msg & data rates may apply.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
