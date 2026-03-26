import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Hero from '../components/Hero'
import Mission from '../components/Mission'
import Problem from '../components/Problem'
import Solution from '../components/Solution'
import Programs from '../components/Programs'
import Results from '../components/Results'
import Testimonials from '../components/Testimonials'
import Vision from '../components/Vision'

function Home() {
  const location = useLocation()

  useEffect(() => {
    // Handle hash scrolling on page load
    if (location.hash) {
      const targetId = location.hash.replace('#', '')
      setTimeout(() => {
        const element = document.getElementById(targetId)
        if (element) {
          const headerOffset = 80
          const elementPosition = element.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
        }
      }, 100)
    } else {
      // Scroll to top when navigating to home without hash
      window.scrollTo(0, 0)
    }
  }, [location])

  return (
    <>
      <Hero />
      <Mission />
      <Problem />
      <Solution />
      <Programs />
      <Results />
      <Testimonials />
      <Vision />
    </>
  )
}

export default Home
