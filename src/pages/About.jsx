import { Link } from 'react-router-dom'
import './About.css'

function About() {
  return (
    <div className="about-page section">
      <div className="container">
        <h1>Our Mission</h1>

        <div className="about-content">
          <p className="about-tagline">
            Building belonging. Thriving children. Strong Kehila.
          </p>

          <p className="about-hebrew">נלך (Neileich)</p>

          <div className="mission-statement">
            <p>
              Neileich is dedicated to nurturing the youth and strengthening the families
              of the Lakewood Commons community. Our mission is to maintain a supportive
              community ecosystem through structured nightly Torah learning programs,
              wholesome youth recreation, and essential family chessed initiatives.
            </p>
            <p>
              We are committed to fostering personal growth, communal connection, and
              critical family support to ensure a vibrant, resilient future where every
              child can thrive.
            </p>
          </div>

          <div className="nonprofit-info">
            <p>
              Neileich is a proud project of Bais Medrash of Lakewood Commons, a registered
              501(c)(3) organization. EIN: 26-4527675.
            </p>
          </div>
        </div>

        <div className="about-footer">
          <Link to="/" className="btn btn-secondary">Return Home</Link>
          <Link to="/contact" className="btn btn-primary">Contact Us</Link>
        </div>
      </div>
    </div>
  )
}

export default About
