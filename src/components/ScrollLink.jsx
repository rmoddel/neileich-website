import { useNavigate, useLocation } from 'react-router-dom'

function ScrollLink({ to, children, className }) {
  const navigate = useNavigate()
  const location = useLocation()

  const scrollToElement = (targetId) => {
    const element = document.getElementById(targetId)
    if (element) {
      const headerOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
    }
  }

  const handleClick = (e) => {
    e.preventDefault()

    const targetId = to.replace('/#', '').replace('#', '')

    // If we're not on the home page, navigate there first
    if (location.pathname !== '/') {
      navigate('/#' + targetId)
    } else {
      // Already on home page, just scroll
      scrollToElement(targetId)
    }
  }

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}

export default ScrollLink
