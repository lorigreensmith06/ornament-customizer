import { Link } from 'react-router-dom'

export default function AboutPage() {
  return (
    <div className="page">
      <h1 className="page-title">About Us</h1>
      <p className="page-sub">
        A little creativity. A little technology. A lot of personalization.
      </p>

      <div className="card">
        <p>
          Ornament Creator is brought to you by <strong>Smith Harbor
          Digital</strong>, the business behind Smith Harbor, our 5-star
          Etsy shop specializing in personalized embroidered gifts.
        </p>
        <p>
          Our team brings decades of experience in computer graphics,
          animation, and visual effects for major Hollywood films. Now
          we're combining that creative and technical expertise to make
          something a little more personal.
        </p>
        <p>
          We created Ornament Creator to make it easy and fun for anyone
          to design a unique, personalized Christmas ornament.
        </p>
        <Link className="btn" to="/create">
          Create Your Ornament
        </Link>
        <p className="about-note">
          <a
            className="about-link"
            href="https://smithharbor.etsy.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            See our customer reviews on Etsy ↗
          </a>
        </p>
      </div>
    </div>
  )
}
