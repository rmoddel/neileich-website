import { neon } from '@neondatabase/serverless'
import { HDate, yahrzeit } from '@hebcal/hdate'
import { jsPDF } from 'jspdf'
import { readFileSync } from 'node:fs'

export const TIMEZONE = 'America/New_York'

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured')
  return neon(process.env.DATABASE_URL)
}

export function appUrl(req) {
  return process.env.APP_URL || `https://${req.headers.host}`
}

export function badRequest(res, message, status = 400) {
  return res.status(status).json({ error: message })
}

export function validCheckout(body) {
  const required = ['sponsorshipTypeId', 'date', 'donorName', 'donorEmail', 'dedicationType', 'dedicationText', 'hebrewYear', 'hebrewMonth', 'hebrewDay']
  if (!body || required.some((field) => !body[field])) return 'Please complete all required fields.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return 'Please select a valid date.'
  if (!/^\S+@\S+\.\S+$/.test(body.donorEmail) || body.donorEmail.length > 254) return 'Please enter a valid email address.'
  if (body.donorName.length > 120 || body.dedicationText.length > 500) return 'Please shorten the information entered.'
  return null
}

const DONATION_EIN = '26-4527675'
export const DEFAULT_EMAIL_FROM = 'Neileich <receipts@neileich.org>'
export const VERIFIED_EMAIL_DOMAIN = 'neileich.org'
const PDF_FONT_NAME = 'NotoSansHebrew'
const HEBREW_RE = /[\u0590-\u05ff]/
let pdfFonts = null
let logoDataUri = undefined

export function senderDomain(value) {
  const text = String(value || '').trim()
  const email = text.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] || text
  return email.match(/^[^@\s<>]+@([^@\s<>]+)$/)?.[1]?.toLowerCase() || null
}

export function resolveEmailFrom() {
  const configured = String(process.env.EMAIL_FROM || '').trim()
  if (!configured) return DEFAULT_EMAIL_FROM
  const domain = senderDomain(configured)
  if (domain === VERIFIED_EMAIL_DOMAIN) return configured
  console.warn('EMAIL_FROM is not using the verified neileich.org sender domain; falling back to the default receipt sender.', { configuredDomain: domain || 'invalid' })
  return DEFAULT_EMAIL_FROM
}

function donationMoney(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

function donationDate(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: TIMEZONE }).format(value ? new Date(value) : new Date())
}

function escapeMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function clippedText(value, maxLength) {
  const text = String(value || '').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function pdfAttachment(filename, pdf) {
  return {
    filename,
    content: Buffer.from(pdf.output('arraybuffer')).toString('base64'),
    contentType: 'application/pdf',
  }
}

function loadPdfFonts() {
  if (!pdfFonts) {
    pdfFonts = {
      regular: readFileSync(new URL('../../server-assets/fonts/NotoSansHebrew-Regular.ttf', import.meta.url)).toString('base64'),
      bold: readFileSync(new URL('../../server-assets/fonts/NotoSansHebrew-Bold.ttf', import.meta.url)).toString('base64'),
    }
  }
  return pdfFonts
}

function registerPdfFonts(pdf) {
  const fonts = loadPdfFonts()
  pdf.addFileToVFS('NotoSansHebrew-Regular.ttf', fonts.regular)
  pdf.addFont('NotoSansHebrew-Regular.ttf', PDF_FONT_NAME, 'normal')
  pdf.addFileToVFS('NotoSansHebrew-Bold.ttf', fonts.bold)
  pdf.addFont('NotoSansHebrew-Bold.ttf', PDF_FONT_NAME, 'bold')
  pdf.setFont(PDF_FONT_NAME, 'normal')
}

function loadLogoDataUri() {
  if (logoDataUri !== undefined) return logoDataUri
  try {
    logoDataUri = `data:image/png;base64,${readFileSync(new URL('../../public/logo-english.png', import.meta.url)).toString('base64')}`
  } catch (error) {
    console.error('Plaque PDF logo unavailable', error)
    logoDataUri = null
  }
  return logoDataUri
}

function drawLogoBox(pdf, x, y, width, height) {
  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(235, 238, 238)
  pdf.setLineWidth(1)
  pdf.roundedRect(x, y, width, height, 8, 8, 'FD')
  const logo = loadLogoDataUri()
  if (logo) {
    const imageRatio = 2170 / 1009
    const maxWidth = width - 42
    const maxHeight = height - 24
    let imageWidth = maxWidth
    let imageHeight = imageWidth / imageRatio
    if (imageHeight > maxHeight) {
      imageHeight = maxHeight
      imageWidth = imageHeight * imageRatio
    }
    pdf.addImage(logo, 'PNG', x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight)
    return
  }
  pdf.setTextColor(36, 83, 92)
  pdf.setFont('times', 'bold')
  pdf.setFontSize(30)
  pdf.text('Neileich', x + width / 2, y + height / 2 + 10, { align: 'center' })
}

function pdfUsesRtl(value) {
  const text = String(value || '')
  const hebrew = (text.match(/[\u0590-\u05ff]/g) || []).length
  const latin = (text.match(/[A-Za-z]/g) || []).length
  return hebrew > latin
}

function setPdfFontForText(pdf, text, style = 'normal', latinFont = 'helvetica') {
  pdf.setFont(HEBREW_RE.test(String(text || '')) ? PDF_FONT_NAME : latinFont, style)
}

function addWrappedText(pdf, text, x, y, maxWidth, lineHeight, options = {}) {
  const { rtl, ...textOptions } = options
  pdf.setR2L(Boolean(rtl))
  const lines = pdf.splitTextToSize(String(text || ''), maxWidth)
  pdf.text(lines, x, y, textOptions)
  pdf.setR2L(false)
  return y + (Array.isArray(lines) ? lines.length : 1) * lineHeight
}

function addReceiptLine(pdf, line, y) {
  const mixed = String(line || '').match(/^([^:]+:\s*)(.+)$/)
  if (mixed && HEBREW_RE.test(mixed[2])) {
    pdf.setFont('helvetica', 'normal')
    y = addWrappedText(pdf, mixed[1].trim(), 72, y, 468, 16)
    dedicationTypeParts(mixed[2]).forEach((part) => {
      setPdfFontForText(pdf, part)
      y = addWrappedText(pdf, part, 88, y, 452, 16, { rtl: pdfUsesRtl(part) })
    })
    return y
  }
  setPdfFontForText(pdf, line)
  return addWrappedText(pdf, line, 72, y, 468, 16, { rtl: pdfUsesRtl(line) })
}

function buildReceiptPdf(title, body) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  registerPdfFonts(pdf)
  pdf.setProperties({ title })
  pdf.setFillColor(16, 45, 54)
  pdf.rect(0, 0, 612, 86, 'F')
  pdf.setTextColor(231, 199, 126)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(title, 72, 54)
  pdf.setTextColor(28, 61, 70)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  let y = 124
  body.split('\n').slice(2).forEach((line) => {
    if (!line) {
      y += 10
      return
    }
    if (y > 725) {
      pdf.addPage()
      y = 72
    }
    y = addReceiptLine(pdf, line, y)
  })
  return pdf
}

function fitLines(pdf, text, maxWidth, maxHeight, initialSize, minSize = 15) {
  let size = initialSize
  let lines = []
  do {
    pdf.setFontSize(size)
    lines = pdf.splitTextToSize(String(text || ''), maxWidth)
    if (lines.length * size * 1.18 <= maxHeight || size <= minSize) break
    size -= 2
  } while (size > minSize)
  return { size, lines, lineHeight: size * 1.18 }
}

function drawPlaqueFrame(pdf, width, height) {
  pdf.setFillColor(16, 45, 54)
  pdf.rect(0, 0, width, height, 'F')
  pdf.setDrawColor(231, 199, 126)
  pdf.setLineWidth(1.5)
  pdf.roundedRect(24, 24, width - 48, height - 48, 14, 14, 'S')
  pdf.setDrawColor(217, 230, 226)
  pdf.setLineWidth(1)
  pdf.rect(48, 48, width - 96, height - 96, 'S')
}

function drawCenteredText(pdf, text, x, y, maxWidth, maxHeight, size, options = {}) {
  pdf.setR2L(Boolean(options.rtl))
  const fitted = fitLines(pdf, text, maxWidth, maxHeight, size, options.minSize)
  pdf.setFontSize(fitted.size)
  const top = y - ((fitted.lines.length - 1) * fitted.lineHeight) / 2
  pdf.text(fitted.lines, x, top, { align: 'center' })
  pdf.setR2L(false)
}

function dedicationTypeParts(value) {
  return String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
}

function sponsorshipLeadIn(sponsorshipName) {
  const name = String(sponsorshipName || '').toLowerCase()
  if (name.includes('night seder')) return "Tonight's Night Seder is dedicated"
  if (name.includes('shabbos')) return 'This Shabbos program is dedicated'
  if (name.includes('month')) return 'This month of Neileich programs is dedicated'
  if (name.includes('day')) return "Today's Neileich learning is dedicated"
  return `This ${sponsorshipName || 'Neileich program'} is dedicated`
}

export function notificationRecipients() {
  const recipients = String(process.env.NOTIFICATION_EMAIL || 'info@neileich.org')
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean)
  return recipients.length > 1 ? recipients : recipients[0] || 'info@neileich.org'
}

export function buildDonationReceiptText(donation, reference = donation.payment_reference) {
  const amount = donationMoney(donation.amount_cents, donation.currency)
  const date = donationDate(donation.created_at)
  return [
    'Neileich Donation Receipt',
    '',
    'Thank you for your donation to Neileich.',
    '',
    `Receipt ID: ${donation.id}`,
    `Date: ${date}`,
    `Donor: ${donation.donor_name}`,
    `Email: ${donation.donor_email}`,
    donation.donor_phone ? `Phone: ${donation.donor_phone}` : null,
    `Amount: ${amount}`,
    `Payment reference: ${reference || 'Unavailable'}`,
    '',
    'Neileich is a project of Bais Medrash of Lakewood Commons, a registered 501(c)(3) organization.',
    `EIN: ${DONATION_EIN}`,
  ].filter(Boolean).join('\n')
}

export function buildDonationPlaqueSvg(donation) {
  const donorName = escapeMarkup(clippedText(donation.donor_name, 42))
  const amount = escapeMarkup(donationMoney(donation.amount_cents, donation.currency))
  const date = escapeMarkup(donationDate(donation.created_at))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#102d36"/>
  <rect x="64" y="64" width="1072" height="672" rx="28" fill="none" stroke="#e7c77e" stroke-width="6"/>
  <rect x="95" y="95" width="1010" height="610" rx="18" fill="none" stroke="#d9e6e2" stroke-opacity=".28" stroke-width="2"/>
  <text x="600" y="166" text-anchor="middle" fill="#e7c77e" font-family="Georgia, serif" font-size="74">Neileich</text>
  <text x="600" y="234" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="26" letter-spacing="4">BUILDING BELONGING</text>
  <line x1="250" y1="304" x2="950" y2="304" stroke="#d9e6e2" stroke-opacity=".35" stroke-width="2"/>
  <text x="600" y="388" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="40">Thank you for your donation</text>
  <text x="600" y="474" text-anchor="middle" fill="#fff7e3" font-family="Georgia, serif" font-size="62">${donorName}</text>
  <text x="600" y="558" text-anchor="middle" fill="#e7c77e" font-family="Arial, sans-serif" font-size="34">${amount}</text>
  <text x="600" y="620" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="26">${date}</text>
  <text x="600" y="680" text-anchor="middle" fill="#d9e6e2" fill-opacity=".86" font-family="Arial, sans-serif" font-size="24">Your support helps children and families thrive.</text>
</svg>`
}

export function buildDonationReceiptPdf(donation, reference = donation.payment_reference) {
  return buildReceiptPdf('Neileich Donation Receipt', buildDonationReceiptText(donation, reference))
}

export function buildDonationPlaquePdf(donation) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  registerPdfFonts(pdf)
  const width = 792
  const height = 612
  drawPlaqueFrame(pdf, width, height)
  pdf.setProperties({ title: 'Neileich Donation Plaque' })
  drawLogoBox(pdf, width / 2 - 142, 74, 284, 110)
  pdf.setTextColor(231, 199, 126)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text('Building Belonging. Thriving children. Strong Kehila.', width / 2, 222, { align: 'center' })
  pdf.setDrawColor(217, 230, 226)
  pdf.line(160, 262, width - 160, 262)
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(26)
  pdf.text('Thank you for your donation', width / 2, 315, { align: 'center' })
  pdf.setTextColor(255, 247, 227)
  setPdfFontForText(pdf, donation.donor_name, 'normal', 'times')
  drawCenteredText(pdf, clippedText(donation.donor_name, 60), width / 2, 390, 520, 82, 44, { rtl: pdfUsesRtl(donation.donor_name) })
  pdf.setTextColor(231, 199, 126)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(26)
  pdf.text(donationMoney(donation.amount_cents, donation.currency), width / 2, 468, { align: 'center' })
  pdf.setTextColor(217, 230, 226)
  pdf.setFontSize(17)
  pdf.text(donationDate(donation.created_at), width / 2, 510, { align: 'center' })
  pdf.setFontSize(15)
  pdf.text('Your support helps children and families thrive.', width / 2, 548, { align: 'center' })
  return pdf
}

export function buildDonationConfirmationEmail(donation, reference = donation.payment_reference) {
  const amount = donationMoney(donation.amount_cents, donation.currency)
  const date = donationDate(donation.created_at)
  const shortId = String(donation.id).slice(0, 8)
  const receiptPdf = buildDonationReceiptPdf(donation, reference)
  const plaquePdf = buildDonationPlaquePdf(donation)
  const text = `Thank you, ${donation.donor_name}.\n\nYour donation to Neileich has been received.\n\nAmount: ${amount}\nDate: ${date}\nPayment reference: ${reference || 'Unavailable'}\n\nYour PDF receipt and donation plaque are attached.`
  const html = `<p>Thank you, ${escapeMarkup(donation.donor_name)}.</p><p>Your donation to Neileich has been received.</p><p><strong>Amount:</strong> ${escapeMarkup(amount)}<br><strong>Date:</strong> ${escapeMarkup(date)}<br><strong>Payment reference:</strong> ${escapeMarkup(reference || 'Unavailable')}</p><p>Your PDF receipt and donation plaque are attached.</p>`
  return {
    subject: 'Thank you for your Neileich donation',
    text,
    html,
    attachments: [
      pdfAttachment(`neileich-donation-receipt-${shortId}.pdf`, receiptPdf),
      pdfAttachment(`neileich-donation-plaque-${shortId}.pdf`, plaquePdf),
    ],
  }
}

export function buildDonationStaffNotificationEmail(donation, reference = donation.payment_reference) {
  const facts = `Amount paid: ${donationMoney(donation.amount_cents, donation.currency)}\nPayment reference: ${reference || 'Unavailable'}`
  return {
    subject: 'New Neileich donation',
    text: `A new paid donation was received.\n\nDonor: ${donation.donor_name}\nEmail: ${donation.donor_email}\nPhone: ${donation.donor_phone || '-'}\n${facts}`,
  }
}

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value || '').slice(0, 10)
}

function sponsorshipDate(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: TIMEZONE }).format(new Date(`${dateOnly(value)}T12:00:00.000Z`))
}

function sponsorshipHebrewDate(sponsorship) {
  return new HDate(new Date(`${dateOnly(sponsorship.gregorian_date)}T12:00:00.000Z`)).renderGematriya(true)
}

function sponsorshipPublicName(sponsorship) {
  return sponsorship.anonymous ? 'Anonymous' : sponsorship.donor_name
}

function buildSponsorshipFacts(sponsorship, reference = sponsorship.payment_reference) {
  return `Sponsorship: ${sponsorship.sponsorship_name}\nAmount paid: ${donationMoney(sponsorship.amount_cents, sponsorship.currency)}\nGregorian date: ${sponsorshipDate(sponsorship.gregorian_date)}\nHebrew date: ${sponsorshipHebrewDate(sponsorship)}\nDedication: ${sponsorship.dedication_type}\n${sponsorship.dedication_text}\nPublic acknowledgment: ${sponsorshipPublicName(sponsorship)}\nAnnual sponsorship: ${sponsorship.recurring ? 'Yes — annual Hebrew-date reminder requested.' : 'No'}\nPayment reference: ${reference || 'Unavailable'}`
}

export function buildSponsorshipReceiptText(sponsorship, reference = sponsorship.payment_reference) {
  return [
    'Neileich Sponsorship Receipt',
    '',
    'Thank you for your sponsorship of Neileich.',
    '',
    `Receipt ID: ${sponsorship.id}`,
    `Donor: ${sponsorship.donor_name}`,
    `Email: ${sponsorship.donor_email}`,
    sponsorship.donor_phone ? `Phone: ${sponsorship.donor_phone}` : null,
    buildSponsorshipFacts(sponsorship, reference),
    '',
    'Neileich is a project of Bais Medrash of Lakewood Commons, a registered 501(c)(3) organization.',
    `EIN: ${DONATION_EIN}`,
  ].filter(Boolean).join('\n')
}

export function buildSponsorshipPlaqueSvg(sponsorship, reference = sponsorship.payment_reference) {
  const dedicationType = escapeMarkup(clippedText(sponsorship.dedication_type, 52))
  const dedicationText = escapeMarkup(clippedText(sponsorship.dedication_text, 92))
  const donorName = escapeMarkup(clippedText(sponsorshipPublicName(sponsorship), 48))
  const gregorianDate = escapeMarkup(sponsorshipDate(sponsorship.gregorian_date))
  const hebrewDate = escapeMarkup(sponsorshipHebrewDate(sponsorship))
  const sponsorshipName = escapeMarkup(clippedText(sponsorship.sponsorship_name, 44))
  const amount = escapeMarkup(donationMoney(sponsorship.amount_cents, sponsorship.currency))
  const paymentReference = escapeMarkup(reference || 'Unavailable')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1275" height="1650" viewBox="0 0 1275 1650">
  <rect width="1275" height="1650" fill="#102d36"/>
  <rect x="52" y="52" width="1171" height="1546" rx="28" fill="none" stroke="#e7c77e" stroke-width="3"/>
  <rect x="92" y="92" width="1091" height="1466" fill="none" stroke="#d9e6e2" stroke-opacity=".26" stroke-width="2"/>
  <text x="637.5" y="162" text-anchor="middle" fill="#e7c77e" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="8">PARNAS HAYOM</text>
  <text x="637.5" y="318" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="26" font-weight="700">Building Belonging. Thriving children. Strong Kehila.</text>
  <line x1="145" y1="408" x2="1130" y2="408" stroke="#d9e6e2" stroke-opacity=".35" stroke-width="2"/>
  <line x1="578" y1="408" x2="697" y2="408" stroke="#e7c77e" stroke-width="5"/>
  <text x="637.5" y="704" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="31" font-weight="700" letter-spacing="3">${sponsorshipName}</text>
  <text x="637.5" y="792" text-anchor="middle" fill="#e7c77e" font-family="Arial, sans-serif" font-size="40" font-weight="700">${dedicationType}</text>
  <text x="637.5" y="916" text-anchor="middle" fill="#fff7e3" font-family="Georgia, serif" font-size="76" direction="rtl" unicode-bidi="plaintext">${dedicationText}</text>
  <line x1="145" y1="1220" x2="1130" y2="1220" stroke="#d9e6e2" stroke-opacity=".35" stroke-width="2"/>
  <line x1="578" y1="1220" x2="697" y2="1220" stroke="#e7c77e" stroke-width="5"/>
  <rect x="340" y="1272" width="595" height="70" rx="35" fill="#e7c77e"/>
  <text x="637.5" y="1318" text-anchor="middle" fill="#102d36" font-family="Arial, sans-serif" font-size="30" font-weight="700">${gregorianDate} · ${hebrewDate}</text>
  <text x="637.5" y="1402" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="32" font-weight="700">Sponsored by ${donorName}</text>
  <text x="637.5" y="1472" text-anchor="middle" fill="#d9e6e2" fill-opacity=".82" font-family="Arial, sans-serif" font-size="22">Amount: ${amount} · Payment reference: ${paymentReference}</text>
</svg>`
}

export function buildSponsorshipReceiptPdf(sponsorship, reference = sponsorship.payment_reference) {
  return buildReceiptPdf('Neileich Sponsorship Receipt', buildSponsorshipReceiptText(sponsorship, reference))
}

export function buildSponsorshipPlaquePdf(sponsorship) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  registerPdfFonts(pdf)
  drawPlaqueFrame(pdf, 612, 792)
  pdf.setProperties({ title: 'Neileich Sponsorship Plaque' })
  pdf.setTextColor(231, 199, 126)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('PARNAS HAYOM', 306, 88, { align: 'center' })
  drawLogoBox(pdf, 191, 112, 230, 92)
  pdf.setTextColor(217, 230, 226)
  pdf.setFontSize(15)
  pdf.text('Building Belonging. Thriving children. Strong Kehila.', 306, 232, { align: 'center' })
  pdf.setDrawColor(217, 230, 226)
  pdf.line(84, 284, 528, 284)
  pdf.setDrawColor(231, 199, 126)
  pdf.setLineWidth(2.5)
  pdf.line(280, 284, 332, 284)
  pdf.setTextColor(217, 230, 226)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'normal')
  drawCenteredText(pdf, sponsorshipLeadIn(sponsorship.sponsorship_name), 306, 348, 440, 52, 18)
  pdf.setTextColor(231, 199, 126)
  pdf.setFontSize(24)
  dedicationTypeParts(sponsorship.dedication_type).forEach((part, index, parts) => {
    const y = parts.length > 1 ? 392 + index * 26 : 404
    setPdfFontForText(pdf, part, 'bold')
    drawCenteredText(pdf, clippedText(part, 68), 306, y, 460, 28, 22, { minSize: 15, rtl: HEBREW_RE.test(part) })
  })
  pdf.setTextColor(255, 247, 227)
  setPdfFontForText(pdf, sponsorship.dedication_text, 'normal', 'times')
  drawCenteredText(pdf, clippedText(sponsorship.dedication_text, 130), 306, 500, 470, 120, 46, { minSize: 18, rtl: pdfUsesRtl(sponsorship.dedication_text) })
  pdf.setFont('helvetica', 'bold')
  pdf.setDrawColor(217, 230, 226)
  pdf.setLineWidth(1)
  pdf.line(84, 610, 528, 610)
  pdf.setDrawColor(231, 199, 126)
  pdf.setLineWidth(2.5)
  pdf.line(280, 610, 332, 610)
  pdf.setFillColor(231, 199, 126)
  pdf.roundedRect(136, 638, 340, 44, 22, 22, 'F')
  pdf.setTextColor(16, 45, 54)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  drawCenteredText(pdf, sponsorshipDate(sponsorship.gregorian_date), 306, 656, 310, 18, 13, { minSize: 9 })
  pdf.setFont(PDF_FONT_NAME, 'bold')
  drawCenteredText(pdf, sponsorshipHebrewDate(sponsorship), 306, 672, 310, 18, 13, { minSize: 9, rtl: true })
  pdf.setTextColor(217, 230, 226)
  pdf.setFontSize(18)
  if (pdfUsesRtl(sponsorshipPublicName(sponsorship))) {
    pdf.setFont('helvetica', 'bold')
    drawCenteredText(pdf, 'Sponsored by', 306, 712, 440, 24, 15, { minSize: 12 })
    pdf.setFont(PDF_FONT_NAME, 'bold')
    drawCenteredText(pdf, sponsorshipPublicName(sponsorship), 306, 734, 440, 32, 18, { minSize: 12, rtl: true })
  } else {
    pdf.setFont('helvetica', 'bold')
    drawCenteredText(pdf, `Sponsored by ${sponsorshipPublicName(sponsorship)}`, 306, 724, 440, 38, 18, { minSize: 12 })
  }
  return pdf
}

export function buildSponsorshipConfirmationEmail(sponsorship, reference = sponsorship.payment_reference) {
  const shortId = String(sponsorship.id).slice(0, 8)
  const receiptPdf = buildSponsorshipReceiptPdf(sponsorship, reference)
  const plaquePdf = buildSponsorshipPlaquePdf(sponsorship)
  const facts = buildSponsorshipFacts(sponsorship, reference)
  const text = `Thank you, ${sponsorship.donor_name}.\n\nYour Neileich sponsorship is confirmed.\n\n${facts}\n\nYour PDF receipt and dedication plaque are attached.`
  const html = `<p>Thank you, ${escapeMarkup(sponsorship.donor_name)}.</p><p>Your Neileich sponsorship is confirmed.</p><p><strong>Sponsorship:</strong> ${escapeMarkup(sponsorship.sponsorship_name)}<br><strong>Amount:</strong> ${escapeMarkup(donationMoney(sponsorship.amount_cents, sponsorship.currency))}<br><strong>Date:</strong> ${escapeMarkup(sponsorshipDate(sponsorship.gregorian_date))}<br><strong>Hebrew date:</strong> ${escapeMarkup(sponsorshipHebrewDate(sponsorship))}<br><strong>Payment reference:</strong> ${escapeMarkup(reference || 'Unavailable')}</p><p>Your PDF receipt and dedication plaque are attached.</p>`
  return {
    subject: 'Your Neileich sponsorship is confirmed',
    text,
    html,
    attachments: [
      pdfAttachment(`neileich-sponsorship-receipt-${shortId}.pdf`, receiptPdf),
      pdfAttachment(`neileich-sponsorship-plaque-${shortId}.pdf`, plaquePdf),
    ],
  }
}

export function buildSponsorshipStaffNotificationEmail(sponsorship, reference = sponsorship.payment_reference) {
  return {
    subject: `New Neileich sponsorship: ${sponsorship.sponsorship_name}`,
    text: `A new paid sponsorship was received.\n\nDonor: ${sponsorship.donor_name}\nEmail: ${sponsorship.donor_email}\nPhone: ${sponsorship.donor_phone || '—'}\n\n${buildSponsorshipFacts(sponsorship, reference)}`,
  }
}

async function recordEmailEvent(sql, { to, template, sponsorshipId, donationId, status, providerMessageId, error }) {
  if (!sql) return
  try {
    if (status === 'sent') {
      if (donationId) {
        await sql`insert into email_events (sponsorship_id, donation_id, recipient, template, status, provider_message_id, sent_at) values (${sponsorshipId || null}, ${donationId}, ${to}, ${template}, 'sent', ${providerMessageId || null}, now())`
      } else {
        await sql`insert into email_events (sponsorship_id, recipient, template, status, provider_message_id, sent_at) values (${sponsorshipId || null}, ${to}, ${template}, 'sent', ${providerMessageId || null}, now())`
      }
      return
    }
    if (donationId) {
      await sql`insert into email_events (sponsorship_id, donation_id, recipient, template, status, error) values (${sponsorshipId || null}, ${donationId}, ${to}, ${template}, 'failed', ${String(error?.message || error).slice(0, 500)})`
    } else {
      await sql`insert into email_events (sponsorship_id, recipient, template, status, error) values (${sponsorshipId || null}, ${to}, ${template}, 'failed', ${String(error?.message || error).slice(0, 500)})`
    }
  } catch (eventError) {
    console.error('Email event logging failed', eventError)
  }
}

export async function sendEmail({ to, subject, text, html, attachments, sponsorshipId, donationId, template }) {
  let sql = null
  const from = resolveEmailFrom()
  try {
    sql = db()
  } catch (error) {
    console.error('Email event database unavailable', error)
  }
  try {
    if (!process.env.RESEND_API_KEY) throw new Error('Email provider is not configured')
    const { Resend } = await import('resend')
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, subject, text, html, attachments })
    if (result.error) throw new Error(result.error.message || 'Email provider rejected the message')
    await recordEmailEvent(sql, { to, template, sponsorshipId, donationId, status: 'sent', providerMessageId: result.data?.id || null })
    return { ok: true, providerMessageId: result.data?.id || null }
  } catch (error) {
    await recordEmailEvent(sql, { to, template, sponsorshipId, donationId, status: 'failed', error })
    console.error('Parnas Hayom email failed', { error, template, senderDomain: senderDomain(from) })
    return { ok: false, error: error.message || 'Email failed' }
  }
}

async function sentDonationEmailTemplates(sql, donationId) {
  try {
    const rows = await sql`select template from email_events where donation_id = ${donationId}::uuid and status = 'sent' and template in ('donor_donation_confirmation', 'staff_donation_notification')`
    return new Set(rows.map((row) => row.template))
  } catch (error) {
    console.error('Donation email status lookup failed', error)
    return new Set()
  }
}

async function sentSponsorshipEmailTemplates(sql, sponsorshipId) {
  try {
    const rows = await sql`select template from email_events where sponsorship_id = ${sponsorshipId}::uuid and status = 'sent' and template in ('donor_confirmation_with_attachments', 'staff_notification')`
    return new Set(rows.map((row) => row.template))
  } catch (error) {
    console.error('Sponsorship email status lookup failed', error)
    return new Set()
  }
}

async function sendDonationConfirmationMessages({ donation, reference, sql, sendEmailFn, checkExisting = false }) {
  const existingTemplates = checkExisting ? await sentDonationEmailTemplates(sql, donation.id) : new Set()
  const shouldSendDonor = !existingTemplates.has('donor_donation_confirmation')
  const shouldSendStaff = !existingTemplates.has('staff_donation_notification')
  if (!shouldSendDonor && !shouldSendStaff) return false
  const donorEmail = buildDonationConfirmationEmail(donation, reference)
  const staffEmail = buildDonationStaffNotificationEmail(donation, reference)
  const results = await Promise.all([
    shouldSendDonor
      ? sendEmailFn({ to: donation.donor_email, ...donorEmail, donationId: donation.id, template: 'donor_donation_confirmation' })
      : null,
    shouldSendStaff
      ? sendEmailFn({ to: notificationRecipients(), ...staffEmail, donationId: donation.id, template: 'staff_donation_notification' })
      : null,
  ].filter(Boolean))
  return results.every((result) => result?.ok !== false)
}

async function sendSponsorshipConfirmationMessages({ sponsorship, reference, sql, sendEmailFn, checkExisting = false }) {
  const existingTemplates = checkExisting ? await sentSponsorshipEmailTemplates(sql, sponsorship.id) : new Set()
  const shouldSendDonor = !existingTemplates.has('donor_confirmation_with_attachments')
  const shouldSendStaff = !existingTemplates.has('staff_notification')
  if (!shouldSendDonor && !shouldSendStaff) return false
  const donorEmail = buildSponsorshipConfirmationEmail(sponsorship, reference)
  const staffEmail = buildSponsorshipStaffNotificationEmail(sponsorship, reference)
  const results = await Promise.all([
    shouldSendDonor
      ? sendEmailFn({ to: sponsorship.donor_email, ...donorEmail, sponsorshipId: sponsorship.id, template: 'donor_confirmation_with_attachments' })
      : null,
    shouldSendStaff
      ? sendEmailFn({ to: notificationRecipients(), ...staffEmail, sponsorshipId: sponsorship.id, template: 'staff_notification' })
      : null,
  ].filter(Boolean))
  return results.every((result) => result?.ok !== false)
}

export async function finalizeDonationPayment({ donationId, reference, sql = db(), sendEmailFn = sendEmail }) {
  const rows = await sql`select * from donations where id = ${donationId}::uuid limit 1`
  const donation = rows[0]
  if (!donation) throw new Error(`No donation found for Sola reference ${reference}`)
  if (donation.status === 'confirmed' && donation.payment_status === 'paid') {
    if (donation.payment_reference && reference && donation.payment_reference !== reference) {
      console.error('Approved Sola reference does not match already paid donation', { donationId: donation.id, existingReference: donation.payment_reference, receivedReference: reference })
      return { finalized: false, emailed: false, donation }
    }
    const emailed = await sendDonationConfirmationMessages({ donation, reference: donation.payment_reference || reference, sql, sendEmailFn, checkExisting: true })
    return { finalized: false, emailed, donation }
  }

  const updated = await sql`update donations set payment_provider = 'sola', payment_status = 'paid', payment_reference = ${reference}, status = 'confirmed', updated_at = now() where id = ${donation.id}::uuid and status = 'pending_payment' returning *`
  const finalizedDonation = updated[0]
  if (!finalizedDonation) return { finalized: false, emailed: false, donation }

  try {
    await sql`insert into payment_events(provider_event_id, donation_id, event_type) values (${`sola:${reference}`}, ${finalizedDonation.id}::uuid, 'sola.donation.approved') on conflict (provider_event_id) do nothing`
  } catch (error) {
    console.error('Donation payment event logging failed', error)
  }
  const emailed = await sendDonationConfirmationMessages({ donation: finalizedDonation, reference, sql, sendEmailFn })
  return { finalized: true, emailed, donation: finalizedDonation }
}

export async function finalizeSponsorshipPayment({ sponsorshipId, reference, sql = db(), sendEmailFn = sendEmail }) {
  let rows = await sql`select s.*, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorshipId}::uuid limit 1`
  let sponsorship = rows[0]
  if (!sponsorship) throw new Error(`No sponsorship found for Sola reference ${reference}`)
  if (sponsorship.payment_status === 'paid' && sponsorship.payment_reference && reference && sponsorship.payment_reference !== reference) {
    console.error('Approved Sola reference does not match already paid sponsorship', { sponsorshipId: sponsorship.id, existingReference: sponsorship.payment_reference, receivedReference: reference })
    return { finalized: false, emailed: false, sponsorship }
  }

  if (sponsorship.status !== 'confirmed' || sponsorship.payment_status !== 'paid' || sponsorship.payment_reference !== reference) {
    await sql`update sponsorships set payment_provider = 'sola', payment_status = 'paid', payment_reference = ${reference}, status = 'confirmed', reservation_expires_at = null, updated_at = now() where id = ${sponsorship.id}::uuid and (payment_reference is null or payment_reference = ${reference}) and (status <> 'confirmed' or payment_status <> 'paid' or payment_reference is distinct from ${reference}) returning id`
    try {
      await sql`insert into audit_events(sponsorship_id, actor, action) values (${sponsorship.id}::uuid, 'payment_gateway', 'payment_confirmed')`
    } catch (error) {
      console.error('Sponsorship audit logging failed', error)
    }
    rows = await sql`select s.*, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorship.id}::uuid limit 1`
    sponsorship = rows[0] || sponsorship
  }

  let shouldCheckExistingEmail = true
  try {
    const event = await sql`insert into payment_events(provider_event_id, sponsorship_id, event_type) values (${`sola:${reference}`}, ${sponsorship.id}::uuid, 'sola.sale.approved') on conflict (provider_event_id) do nothing returning id`
    shouldCheckExistingEmail = !event.length
  } catch (error) {
    console.error('Sponsorship payment event logging failed', error)
  }

  if (sponsorship.recurring) {
    try {
      const original = new Date(`${dateOnly(sponsorship.gregorian_date)}T12:00:00.000Z`)
      let year = new HDate().getFullYear() + 1
      let next = yahrzeit(year, original)
      while (next && next.greg() <= new Date()) next = yahrzeit(++year, original)
      if (next) await sql`insert into recurrence_rules (sponsorship_id, hebrew_month, hebrew_day, next_occurrence) values (${sponsorship.id}::uuid, ${sponsorship.hebrew_month}, ${sponsorship.hebrew_day}, ${next.greg().toISOString().slice(0, 10)}::date) on conflict (sponsorship_id) do nothing`
    } catch (error) {
      console.error('Sponsorship recurrence setup failed', error)
    }
  }

  const emailed = await sendSponsorshipConfirmationMessages({ sponsorship, reference, sql, sendEmailFn, checkExisting: shouldCheckExistingEmail })
  return { finalized: true, emailed, sponsorship }
}
