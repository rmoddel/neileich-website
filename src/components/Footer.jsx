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
          <p className="footer-legal-identity">
            Neileich is a project of Bais Medrash of Lakewood Commons, a registered 501(c)(3) organization. EIN: 26-4527675. Contact: info@neileich.org
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <h4>Navigation</h4>
            <Link to="/">Home</Link>
            <Link to="/about">Our Mission</Link>
            <Link to="/programs">Programs</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/parnas-hayom">Parnas Hayom</Link>
          </div>
          <div className="footer-column">
            <h4>Legal</h4>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms">Terms & Conditions</Link>
          </div>
          <div className="footer-column">
            <h4>Contact</h4>
            <p><a href="mailto:info@neileich.org">info@neileich.org</a></p>
            <p>Bais Medrash of Lakewood Commons</p>
            <p>44 Coles Way</p>
            <p>Lakewood, NJ 08701</p>
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
