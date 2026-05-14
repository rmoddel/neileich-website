import { getEmailEnvConfig } from './env'

export async function sendMessage({ name, email, phone, message, optIn }) {
  const {
    apiUrl,
    apiSecret,
    from,
    to,
    missingKeys
  } = getEmailEnvConfig()

  // Validate configuration
  if (missingKeys.length > 0) {
    return {
      ok: false,
      error: import.meta.env.DEV
        ? `Email service is not configured. Missing: ${missingKeys.join(', ')}. Check .env.local and restart Vite.`
        : 'Email service is not configured. Please contact the administrator.'
    }
  }

  try {
    const subject = `Contact Form Submission from ${name}`
    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Text message opt-in: ${optIn === 'yes' ? 'Yes' : 'No'}`,
      '',
      'Message:',
      message || '(No message provided)'
    ].join('\n')

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        ok: false,
        error: errorData.message || errorData.error || 'Failed to send message. Please try again.'
      }
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'Network error. Please check your connection and try again.'
    }
  }
}
