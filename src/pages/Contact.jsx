import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Contact.css'

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    optIn: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Handle form submission here
    console.log('Form submitted:', formData)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="contact-page section">
        <div className="container">
          <div className="success-message">
            <h2>Thank You!</h2>
            <p>Your message has been received. We will get back to you shortly.</p>
            {formData.optIn === 'yes' && (
              <p className="opt-in-confirmation">
                You have opted in to receive text messages from Neileich.
              </p>
            )}
            <Link to="/" className="btn btn-primary">Return Home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="contact-page section">
      <div className="container">
        <div className="contact-header">
          <h1>Contact Us</h1>
          <p>We'd love to hear from you. Fill out the form below to get in touch.</p>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="(555) 555-5555"
            />
          </div>

          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows="4"
              placeholder="How can we help you?"
            />
          </div>

          <div className="form-group opt-in-section">
            <label className="opt-in-label">Text Message Opt-In (Optional)</label>
            <div className="opt-in-disclosure">
              <p>
                Would you like to opt-in to receive text messages from Neileich? Opt-in is optional.
                By opting in, you agree to receive recurring messages from Neileich regarding
                program updates, event notifications, and community announcements. Message frequency
                varies. Message and data rates may apply.
              </p>
              <p>
                If you need support you can call or text HELP to our support line,
                visit our website at <Link to="/">neileich.org</Link>, or email us at
                info@neileich.org. Reply STOP to any text message you receive from Neileich to opt-out.
              </p>
              <p>
                For more information, visit our <Link to="/privacy-policy">privacy policy</Link> or
                our <Link to="/terms">terms and conditions</Link>.
              </p>
            </div>

            <div className="opt-in-choices">
              <label className="radio-label">
                <input
                  type="radio"
                  name="optIn"
                  value="yes"
                  checked={formData.optIn === 'yes'}
                  onChange={handleChange}
                />
                <span>Yes, opt-in to receive text messages</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="optIn"
                  value="no"
                  checked={formData.optIn === 'no'}
                  onChange={handleChange}
                />
                <span>No, I do not wish to receive text messages</span>
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary submit-btn">
            Submit
          </button>
        </form>

        <div className="contact-info">
          <h3>Other Ways to Reach Us</h3>
          <div className="contact-methods">
            <div className="contact-method">
              <strong>Email</strong>
              <p>info@neileich.org</p>
            </div>
            <div className="contact-method">
              <strong>Location</strong>
              <p>Lakewood, NJ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Contact
