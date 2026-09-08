import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const siteUrl = 'https://neileich.org'
const defaultMeta = {
  title: 'Neileich Lakewood Commons | Youth Programs and Community Support',
  description: 'Neileich strengthens the Lakewood Commons community with youth Torah learning, wholesome recreation, family support, chessed programs, and community connection.',
}

const routeMeta = {
  '/': defaultMeta,
  '/about': {
    title: 'Our Mission | Neileich Lakewood Commons',
    description: 'Learn how Neileich nurtures youth, strengthens families, and builds belonging in the Lakewood Commons community.',
  },
  '/programs': {
    title: 'Programs | Neileich Lakewood Commons',
    description: 'Explore Neileich programs for Torah learning, Shabbos, Yom Tov, recreation, chessed, libraries, trips, and family connection.',
  },
  '/parnas-hayom': {
    title: 'Parnas Hayom | Neileich Lakewood Commons',
    description: 'Sponsor a meaningful day of Neileich programming and share a dedication in support of the community.',
  },
  '/donate': {
    title: 'Donate | Neileich Lakewood Commons',
    description: 'Support Neileich with a secure donation to help children and families thrive in the Lakewood Commons community.',
  },
  '/contact': {
    title: 'Contact | Neileich Lakewood Commons',
    description: 'Contact Neileich Lakewood Commons for program questions, registration, donations, and community support.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Neileich Lakewood Commons',
    description: 'Read the Neileich Lakewood Commons privacy policy.',
  },
  '/terms': {
    title: 'Terms and Conditions | Neileich Lakewood Commons',
    description: 'Read the Neileich Lakewood Commons terms and conditions.',
  },
}

function setMetaAttribute(selector, attribute, value) {
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute(attribute, value)
}

export default function RouteMeta() {
  const { pathname } = useLocation()
  const normalizedPathname = pathname === '/' ? '/' : pathname.replace(/\/$/, '')
  const meta = routeMeta[normalizedPathname] || defaultMeta
  const canonicalUrl = `${siteUrl}${normalizedPathname === '/' ? '/' : normalizedPathname}`

  useEffect(() => {
    document.title = meta.title
    setMetaAttribute('meta[name="description"]', 'content', meta.description)
    setMetaAttribute('link[rel="canonical"]', 'href', canonicalUrl)
    setMetaAttribute('meta[property="og:title"]', 'content', meta.title)
    setMetaAttribute('meta[property="og:description"]', 'content', meta.description)
    setMetaAttribute('meta[property="og:url"]', 'content', canonicalUrl)
    setMetaAttribute('meta[name="twitter:title"]', 'content', meta.title)
    setMetaAttribute('meta[name="twitter:description"]', 'content', meta.description)
  }, [canonicalUrl, meta.description, meta.title])

  return null
}
