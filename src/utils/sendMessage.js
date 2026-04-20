export async function sendMessage({ name, email, phone, message, optIn }) {
  const apiUrl = import.meta.env.VITE_EMAIL_API_URL
  const apiSecret = import.meta.env.VITE_API_SECRET
  const from = import.meta.env.VITE_FROM_EMAIL
  const to = import.meta.env.VITE_TO_EMAIL

  // Validate configuration
  if (!apiUrl || !apiSecret || !from || !to) {
    return {
      ok: false,
      error: 'Email service is not configured. Please contact the administrator.'
    }
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Contact Form Submission from ${name}`,
        name,
        email,
        phone,
        message,
        optIn: optIn === 'yes'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        ok: false,
        error: errorData.message || 'Failed to send message. Please try again.'
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
