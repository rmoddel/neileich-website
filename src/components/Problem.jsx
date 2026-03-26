import './Problem.css'

function Problem() {
  return (
    <section className="problem section">
      <div className="container">
        <div className="problem-content">
          <h2>What's the alternative?</h2>
          <p className="problem-lead">
            When there's nothing to do and nowhere to go –
          </p>
          <p className="problem-text">
            The nights, the Shabbos afternoons, the lazy mornings… They fill themselves.
          </p>
          <p className="problem-text">
            The void grows – and invites behaviors that strain families and communities.
          </p>

          <div className="problem-solution">
            <p className="solution-intro">But in one kehilla, something different happened.</p>
            <p className="solution-highlight">The story was rewritten.</p>
          </div>
        </div>

        <div className="realization">
          <div className="realization-badge">
            <span>They weren't bad.</span>
            <span className="highlight">They were bored.</span>
          </div>
          <p>
            It began as an answer to a growing concern — not with "bad kids," but with bored ones.
            Children who had no outlet, no belonging, no framework. What started as a small
            neighborhood initiative has grown into a model of what a kehilla can become when
            it places its children at the center.
          </p>
          <p>
            It's a movement, an experience that builds belonging, responsibility, and pride.
            It's an environment where children and teens feel included, guided, and connected.
          </p>
          <p className="realization-emphasis">
            Not just to Torah, but to themselves – and something bigger than themselves.
          </p>
        </div>
      </div>
    </section>
  )
}

export default Problem
