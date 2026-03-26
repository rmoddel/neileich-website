import './Testimonials.css'

function Testimonials() {
  const testimonials = [
    {
      quote: "My academically weak son is finally enjoying his learning.",
      author: "Parent"
    },
    {
      quote: "My son starts checking the clock fifteen minutes early – he doesn't want to miss a minute.",
      author: "Parent"
    },
    {
      quote: "My kids finally have a healthy and productive outlet in the evenings.",
      author: "Parent"
    },
    {
      quote: "The program is structured beautifully throughout the night, fostering a healthy environment and uplifting matzav ruach.",
      author: "Rabbi Nachman Rothenberg",
      title: "Father"
    },
    {
      quote: "Attendance has grown exponentially – because this means so much to the boys that they avoid missing it even for family Simchos.",
      author: "Rabbi Yaakov Mincer"
    }
  ]

  return (
    <section className="testimonials section">
      <div className="container">
        <h2>How many times have we heard these sentiments expressed by thrilled parents?</h2>

        <div className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-card">
              <div className="quote-mark">"</div>
              <p className="testimonial-quote">{testimonial.quote}</p>
              <div className="testimonial-author">
                <span className="author-name">{testimonial.author}</span>
                {testimonial.title && <span className="author-title">{testimonial.title}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="respect-box">
          <p>Children respect adults.</p>
          <p>Adults support children.</p>
          <p className="respect-conclusion">Just the way it's meant to be.</p>
        </div>

        <div className="movement">
          <p className="movement-text">It's a movement that moves us all.</p>
          <p className="movement-brand">NEILEICH</p>
        </div>
      </div>
    </section>
  )
}

export default Testimonials
