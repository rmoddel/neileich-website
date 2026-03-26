import './Mission.css'

function Mission() {
  return (
    <section id="mission" className="mission section">
      <div className="container">
        <h2>Welcome to Neileich</h2>
        <div className="mission-content">
          <p className="mission-lead">
            Following the guidance of <strong>Hagaon Harav Reuvain Feinstein Shlit"a</strong>,
            and under the leadership of <strong>Rav Aryeh Sherwinter Shlit"a</strong>, Neileich
            places the Shul, the Mikdash Me'at, at the very center of a child's life.
          </p>
          <p>
            Every evening, every weekend, every vacation – children are welcomed into
            age-tailored learning programs, captivating shiurim, and meaningful activities.
          </p>
          <p className="mission-highlight">
            Yes, talented Rabbeim greet each child by name, keeping them learning,
            accomplishing, and growing.
          </p>
        </div>

        <div className="ecosystem">
          <h3>But Neileich is more than a learning program.</h3>
          <p className="ecosystem-subtitle">It's a full ecosystem for the children:</p>

          <div className="ecosystem-grid">
            <div className="ecosystem-item">
              <span className="ecosystem-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </span>
              <div>
                <strong>Chesed opportunities</strong>
                <p>So the values we preach are within reach.</p>
              </div>
            </div>
            <div className="ecosystem-item">
              <span className="ecosystem-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </span>
              <div>
                <strong>Fully stocked libraries</strong>
                <p>So boredom gives way to enrichment.</p>
              </div>
            </div>
            <div className="ecosystem-item">
              <span className="ecosystem-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
              <div>
                <strong>Yom Tov. Chol Hamoed. Lazy end-of-summer days.</strong>
                <p>Once landmines of idleness – now strategically planned to capitalize on a child's energy and potential.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Mission
