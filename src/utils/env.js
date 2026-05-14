const REQUIRED_EMAIL_ENV_KEYS = [
  'VITE_EMAIL_API_URL',
  'VITE_API_SECRET',
  'VITE_FROM_EMAIL',
  'VITE_TO_EMAIL'
]

let hasLoggedEnvDebug = false

function maskValue(value) {
  if (!value) {
    return '(missing)'
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}...`
  }

  return `${value.slice(0, 4)}...${value.slice(-2)}`
}

function getMissingKeys(values) {
  return REQUIRED_EMAIL_ENV_KEYS.filter((key) => !values[key])
}

export function getEmailEnvConfig() {
  const values = {
    VITE_EMAIL_API_URL: import.meta.env.VITE_EMAIL_API_URL,
    VITE_API_SECRET: import.meta.env.VITE_API_SECRET,
    VITE_FROM_EMAIL: import.meta.env.VITE_FROM_EMAIL,
    VITE_TO_EMAIL: import.meta.env.VITE_TO_EMAIL
  }

  const missingKeys = getMissingKeys(values)

  if (import.meta.env.DEV && !hasLoggedEnvDebug) {
    hasLoggedEnvDebug = true

    console.groupCollapsed('[env-debug] Email env configuration')
    console.info('mode:', import.meta.env.MODE)
    console.info('dev server restart required after env changes:', true)

    REQUIRED_EMAIL_ENV_KEYS.forEach((key) => {
      console.info(`${key}:`, values[key] ? maskValue(values[key]) : '(missing)')
    })

    if (missingKeys.length > 0) {
      console.warn('Missing keys:', missingKeys.join(', '))
      console.warn('Expected these values in .env.local or another Vite env file.')
    }

    console.groupEnd()
  }

  return {
    apiUrl: values.VITE_EMAIL_API_URL,
    apiSecret: values.VITE_API_SECRET,
    from: values.VITE_FROM_EMAIL,
    to: values.VITE_TO_EMAIL,
    missingKeys
  }
}

export function getEmailEnvDebugSummary() {
  const { missingKeys } = getEmailEnvConfig()

  return {
    mode: import.meta.env.MODE,
    missingKeys,
    keys: REQUIRED_EMAIL_ENV_KEYS.map((key) => ({
      key,
      present: Boolean(import.meta.env[key])
    }))
  }
}
