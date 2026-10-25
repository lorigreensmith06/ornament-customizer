import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-col">
          <p className="footer-brand">Ornament Creator</p>
          <p>© 2026 Smith Harbor LLC</p>
          <p>Created by Smith Harbor Digital</p>
        </div>
        <div className="footer-col">
          <p className="footer-heading">Contact</p>
          <p>
            <a href="mailto:support@ornamentcreator.com">
              support@ornamentcreator.com
            </a>
          </p>
          <p>
            <a href="tel:+19729946540">(972) 994-6540</a>
          </p>
        </div>
        <div className="footer-col">
          <p className="footer-heading">Policies</p>
          <p>
            <Link to="/refunds">Returns &amp; Refunds</Link>
          </p>
          <p>
            <Link to="/privacy">Privacy Policy</Link>
          </p>
          <p>
            <Link to="/terms">Terms of Service</Link>
          </p>
          <p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                window.dispatchEvent(new Event('cookie-preferences'))
              }}
            >
              Cookie preferences
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
