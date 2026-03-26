import { Link } from 'react-router-dom'
import './LegalPage.css'

function Terms() {
  return (
    <div className="legal-page section">
      <div className="container">
        <h1>Terms and Conditions</h1>
        <p className="last-updated">Last Updated: March 2025</p>

        <div className="legal-content">
          <section>
            <h2>Agreement to Terms</h2>
            <p>
              By accessing or using the Neileich website and services, you agree to be
              bound by these Terms and Conditions. If you do not agree with any part of
              these terms, you may not use our services.
            </p>
          </section>

          <section>
            <h2>About Neileich</h2>
            <p>
              Neileich is a community organization dedicated to youth engagement, Torah
              learning programs, and building strong kehilla connections. Our services
              include educational programming, community events, and family support resources.
            </p>
          </section>

          <section className="highlight-section">
            <h2>Messaging Terms and Conditions</h2>
            <p>
              By opting in to receive text messages from Neileich, you agree to receive
              text messages regarding:
            </p>
            <ul>
              <li>Program updates and announcements</li>
              <li>Event notifications and reminders</li>
              <li>Community news and information</li>
              <li>Scheduling and coordination messages</li>
            </ul>

            <div className="terms-box">
              <p><strong>Message Frequency:</strong> Message frequency varies based on program activities and events.</p>
              <p><strong>Rates:</strong> Message and data rates may apply.</p>
              <p><strong>Support:</strong> For support, reply HELP or email us at info@neileich.org</p>
              <p><strong>Opt-Out:</strong> You can opt out at any time by replying STOP.</p>
              <p>For more information, visit our <Link to="/privacy-policy">Privacy Policy</Link>.</p>
            </div>
          </section>

          <section>
            <h2>Use of Website</h2>
            <p>
              You agree to use our website only for lawful purposes and in a manner that
              does not infringe upon the rights of others or restrict their use of the website.
            </p>
          </section>

          <section>
            <h2>Intellectual Property</h2>
            <p>
              All content on this website, including text, graphics, logos, and images,
              is the property of Neileich and is protected by applicable copyright and
              trademark laws.
            </p>
          </section>

          <section>
            <h2>User Submissions</h2>
            <p>
              When you submit information through our contact forms or opt-in to our
              communications, you grant us permission to use this information for the
              purposes described in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2>Disclaimer of Warranties</h2>
            <p>
              Our website and services are provided "as is" without warranties of any kind,
              either express or implied. We do not guarantee that our services will be
              uninterrupted or error-free.
            </p>
          </section>

          <section>
            <h2>Limitation of Liability</h2>
            <p>
              Neileich shall not be liable for any indirect, incidental, special, or
              consequential damages arising from your use of our website or services.
            </p>
          </section>

          <section>
            <h2>Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms and Conditions at any time.
              Changes will be effective immediately upon posting to this page. Your
              continued use of our services constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2>Contact Information</h2>
            <p>
              If you have questions about these Terms and Conditions, please contact us:
            </p>
            <ul>
              <li>Email: info@neileich.org</li>
              <li>Website: <Link to="/contact">Contact Form</Link></li>
            </ul>
          </section>
        </div>

        <div className="legal-footer">
          <Link to="/" className="btn btn-secondary">Return Home</Link>
          <Link to="/privacy-policy" className="btn btn-primary">View Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}

export default Terms
