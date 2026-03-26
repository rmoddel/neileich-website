import './Results.css'

function Results() {
  return (
    <section className="results section">
      <div className="container">
        <div className="results-header">
          <h2>And the results?</h2>
          <p className="results-subtitle">They speak for themselves.</p>
        </div>

        <div className="results-grid">
          <div className="result-card">
            <div className="result-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9,22 9,12 15,12 15,22"/>
              </svg>
            </div>
            <p>A neighborhood with a Neileich program is <strong>safe, positive, and thriving</strong>.</p>
          </div>

          <div className="result-card">
            <div className="result-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <p>Boys – even average learners – <strong>shteig in Torah</strong>, many finishing complete Masechtos.</p>
          </div>

          <div className="result-card">
            <div className="result-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <p>Girls grow into <strong>altruistic, caring members</strong> of the community.</p>
          </div>

          <div className="result-card">
            <div className="result-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
            </div>
            <p>Struggling children <strong>blossom</strong> – driven by something greater than themselves.</p>
          </div>

          <div className="result-card">
            <div className="result-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p>Parents gain <strong>invaluable guidance</strong> on chinuch – both individually and collectively.</p>
          </div>
        </div>

        <div className="success-rate">
          <div className="success-badge">
            <span className="rate">~100%</span>
            <span className="label">Success Rate</span>
          </div>
          <p>
            We've seen it: Bli Ayin Hara, a nearly 100% success rate in precluding
            all-too-common neighborhood issues, thanks to a proactive approach.
          </p>
        </div>

        <div className="results-conclusion">
          <p>Because Neileich doesn't just shape our children.</p>
          <p className="conclusion-highlight">
            It puts them at the heart of the Kehila, recognizing their strengths
            and believing in their ability to be great.
          </p>
        </div>

        <div className="expansion">
          <p>
            And now, we stand poised to bring Neileich to other communities,
            so they can follow the prototype that has been blessed with incredible results.
          </p>
        </div>
      </div>
    </section>
  )
}

export default Results
