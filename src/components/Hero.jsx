import { Link } from 'react-router-dom'
import ScrollLink from './ScrollLink'
import './Hero.css'

function Hero() {
  return (
    <section className="hero">
      <div className="container hero-content">
        <p className="hero-tagline">NEILEICH</p>
        <h1>Building Belonging</h1>
        <p className="hero-subtitle">Thriving children. Strong Kehila.</p>
        <div className="hero-truth">
          <p className="truth-label">One simple truth:</p>
          <p className="truth-text">
            Structure, engagement, and connection to Torah and Chessed
            are the bedrock for growth.
          </p>
        </div>
        <div className="hero-actions">
          <ScrollLink to="#mission" className="btn btn-primary">Learn More</ScrollLink>
          <ScrollLink to="#programs" className="btn btn-secondary">Our Programs</ScrollLink>
        </div>
      </div>
    </section>
  )
}

export default Hero
