import { Link } from 'react-router-dom'
import './LegalPage.css'

function PrivacyPolicy() {
  return (
    <div className="legal-page section">
      <div className="container">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last Updated: April 2026</p>

        <div className="legal-content">
          <section>
            <h2>Introduction</h2>
            <p>
              Neileich ("we," "our," or "us") is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you visit our website or interact with our services.
              Neileich is a project of Bais Medrash of Lakewood Commons, a 501(c)(3)
              organization.
            </p>
          </section>

          <section>
            <h2>Information We Collect</h2>
            <p>We may collect information about you in a variety of ways, including:</p>
            <ul>
              <li>
                <strong>Personal Data:</strong> Name, email address, phone number, and
                other contact information you voluntarily provide when filling out forms
                on our website.
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you access and use our
                website, including your IP address, browser type, and pages visited.
              </li>
            </ul>
          </section>

          <section>
            <h2>How We Use Your Information</h2>
            <p>We may use the information we collect to:</p>
            <ul>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Send you updates about our programs and community events</li>
              <li>Communicate with you via text message if you have opted in</li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="highlight-section">
            <h2>Mobile Information and Data Privacy</h2>
            <p>
              <strong>No mobile information will be shared with third parties.</strong>
            </p>
            <p>
              Mobile information will not be shared with third parties or affiliates for
              marketing or promotional purposes. All the above categories exclude text
              messaging originator opt-in data and consent; this information will not be
              shared with any third parties.
            </p>
          </section>

          <section className="highlight-section">
            <h2>Opting Out of Communications</h2>
            <p>
              If you wish to be removed from receiving future communications from Neileich,
              you can opt out by texting <strong>STOP</strong> to any text message you
              receive from us.
            </p>
            <p>
              You may also contact us directly at info@neileich.org to request removal
              from our communication lists.
            </p>
          </section>

          <section>
            <h2>Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures
              to protect your personal information. However, no method of transmission
              over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2>Third-Party Services</h2>
            <p>
              Our website may contain links to third-party websites. We are not responsible
              for the privacy practices or content of these third-party sites. We encourage
              you to review the privacy policies of any third-party sites you visit.
            </p>
          </section>

          <section>
            <h2>Children's Privacy</h2>
            <p>
              Our services are designed to support youth programming within our community.
              We do not knowingly collect personal information directly from children under
              13 without parental consent. Parents or guardians who believe their child has
              provided us with personal information should contact us.
            </p>
          </section>

          <section>
            <h2>Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              any changes by posting the new Privacy Policy on this page and updating the
              "Last Updated" date.
            </p>
          </section>

          <section>
            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <ul>
              <li>Email: info@neileich.org</li>
              <li>Address: 44 Coles Way, Lakewood, NJ 08701</li>
              <li>Website: <Link to="/contact">Contact Form</Link></li>
            </ul>
          </section>
        </div>

        <div className="legal-footer">
          <Link to="/" className="btn btn-secondary">Return Home</Link>
          <Link to="/terms" className="btn btn-primary">View Terms & Conditions</Link>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
