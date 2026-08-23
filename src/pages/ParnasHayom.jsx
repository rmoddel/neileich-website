import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HDate } from "@hebcal/core";
import "./ParnasHayom.css";
import "./ParnasHayomPreview.css";
import "./ParnasHayomPayment.css";
import "./ParnasHayomSuccess.css";

const fallbackTypes = [
  {
    id: "unconfigured-day",
    name: "Sponsor a Day",
    description: "Support Neileich programs for a full day.",
    price_cents: 18000,
    recurring_enabled: true,
  },
  {
    id: "unconfigured-seder",
    name: "Sponsor Night Seder",
    description: "Help make an evening of learning possible.",
    price_cents: 7200,
    recurring_enabled: true,
  },
];
const dedicationTypes = [
  "לעילוי נשמת / In memory of",
  "לכבוד / In honor of",
  "לרפואה שלמה",
  "לזכות",
  "Custom",
];
const orgTimeZone = "America/New_York";
const dateKey = (date) =>
  date.toLocaleDateString("en-CA", { timeZone: orgTimeZone });
const hebrew = (date) => new HDate(date);
const prettyDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: orgTimeZone,
  }).format(date);
const calendarDays = (month) => {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const leading = start.getDay();
  const total = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  return Array.from({ length: leading + total }, (_, i) =>
    i < leading
      ? null
      : new Date(month.getFullYear(), month.getMonth(), i - leading + 1, 12),
  );
};

function dedicationLeadIn(sponsorshipName) {
  const name = sponsorshipName?.toLowerCase() || "";
  if (name.includes("night seder")) return "Tonight’s Night Seder is dedicated";
  if (name.includes("shabbos")) return "This Shabbos program is dedicated";
  if (name.includes("month")) return "This month of Neileich programs is dedicated";
  if (name.includes("day")) return "Today’s Neileich learning is dedicated";
  return `This ${sponsorshipName || "Neileich program"} is dedicated`;
}

export default function ParnasHayom() {
  const today = useMemo(() => new Date(), []);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [availability, setAvailability] = useState({});
  const [calendarError, setCalendarError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({
    dedicationType: dedicationTypes[0],
    dedicationText: "",
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    anonymous: false,
    recurring: false,
  });
  const [checkoutError, setCheckoutError] = useState("");
  const [flyerDownloadError, setFlyerDownloadError] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cardExpiry, setCardExpiry] = useState("");
  const tokenInputs = useRef(null);
  const [ifieldsReady, setIfieldsReady] = useState(false);
  const initialPaymentParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const confirmationPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview-confirmation") === "1";
  const [paymentStatus, setPaymentStatus] = useState(
    confirmationPreview
      ? "confirmed"
      : initialPaymentParams.get("payment") === "processing"
        ? "processing"
        : "idle",
  );
  const [pendingSponsorshipId, setPendingSponsorshipId] = useState(
    initialPaymentParams.get("sponsorship"),
  );
  const [receiptToken, setReceiptToken] = useState(
    initialPaymentParams.get("receipt"),
  );
  const [receipt, setReceipt] = useState(null);
  const previewRef = useRef(null);
  const flyerLibraries = useRef(null);
  const paymentState = new URLSearchParams(window.location.search).get(
    "payment",
  );

  useEffect(() => {
    fetch("/api/parnas-hayom/types")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ types: next }) => {
        setTypes(next);
        setSelectedType(next[0] || null);
      })
      .catch(() => {
        setTypes(fallbackTypes);
        setSelectedType(fallbackTypes[0]);
      });
  }, []);
  useEffect(() => {
    const initialize = () => {
      if (window.setAccount && import.meta.env.VITE_SOLA_IFIELDS_KEY) {
        window.setAccount(import.meta.env.VITE_SOLA_IFIELDS_KEY, "Neileich", "1.0.0");
        if (window.setIfieldStyle) {
          const fieldStyle = { width: "100%", height: "42px", border: "0", outline: "none", "font-size": "16px", "font-family": "Inter, Arial, sans-serif" };
          window.setIfieldStyle("card-number", fieldStyle);
          window.setIfieldStyle("cvv", fieldStyle);
        }
        setIfieldsReady(true);
      }
    };
    const existing = document.getElementById("sola-ifields-script");
    if (existing) {
      existing.addEventListener("load", initialize);
      initialize();
      return () => existing.removeEventListener("load", initialize);
    }
    const script = document.createElement("script");
    script.id = "sola-ifields-script";
    script.src = "https://cdn.cardknox.com/ifields/2.15.2309.2601/ifields.min.js";
    script.async = true;
    script.addEventListener("load", initialize);
    script.addEventListener("error", () => setCheckoutError("Secure card fields could not load. Please refresh and try again."));
    document.head.appendChild(script);
    return () => script.removeEventListener("load", initialize);
  }, []);
  useEffect(() => {
    if (!selectedType) return;
    if (selectedType.id.startsWith("unconfigured")) {
      setCalendarError("");
      setAvailability(
        Object.fromEntries(
          calendarDays(month).map((day) => [day && dateKey(day), Boolean(day)]),
        ),
      );
      return;
    }
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    setCalendarError("");
    setAvailability({});
    fetch(
      `/api/parnas-hayom/availability?sponsorshipTypeId=${encodeURIComponent(selectedType.id)}&start=${dateKey(start)}&end=${dateKey(end)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ days }) =>
        setAvailability(
          Object.fromEntries(days.map((d) => [d.date.slice(0, 10), d.available])),
        ),
      )
      .catch(() =>
        setCalendarError(
          "The calendar is temporarily unavailable. Please try again.",
        ),
      );
  }, [month, selectedType]);
  // Preview types are used only when the backend is unavailable locally. The server
  // still makes the authoritative availability decision before payment.
  const usePreviewAvailability =
    selectedType?.id.startsWith("unconfigured") || Boolean(calendarError);
  const availableDays = calendarDays(month).filter(
    (day) =>
      day &&
      day >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) &&
      (usePreviewAvailability || availability[dateKey(day)]),
  );
  const selectFirst = () => setSelectedDate(availableDays[0] || null);
  const selectRandom = () =>
    setSelectedDate(
      availableDays[Math.floor(Math.random() * availableDays.length)] || null,
    );
  const change = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  const printFlyer = () => window.print();
  const loadFlyerLibraries = useCallback(() => {
    if (!flyerLibraries.current) {
      flyerLibraries.current = Promise.all([import("html2canvas"), import("jspdf")]);
    }
    return flyerLibraries.current;
  }, []);
  const downloadFlyer = useCallback(async () => {
    if (!previewRef.current) return;
    const [{ default: html2canvas }, { jsPDF }] = await loadFlyerLibraries();
    const canvas = await html2canvas(previewRef.current, { backgroundColor: null, scale: 2, useCORS: true });
    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 8.5, 11);
    pdf.save(`neileich-dedication-${selectedDate ? dateKey(selectedDate) : "flyer"}.pdf`);
  }, [loadFlyerLibraries, selectedDate]);
  useEffect(() => {
    if (!pendingSponsorshipId || !receiptToken || paymentStatus !== "processing") return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/parnas-hayom/status?sponsorshipId=${encodeURIComponent(pendingSponsorshipId)}&receiptToken=${encodeURIComponent(receiptToken)}`);
        const result = await response.json();
        if (cancelled) return;
        if (result.status === "confirmed" && result.paymentStatus === "paid") {
          setReceipt(result.receipt);
          try {
            await downloadFlyer();
          } catch {
            if (!cancelled) setFlyerDownloadError(true);
          } finally {
            if (!cancelled) setPaymentStatus("confirmed");
          }
          return;
        }
        if (["failed", "cancelled", "expired"].includes(result.status)) {
          setPaymentStatus("failed");
          setPaying(false);
          return;
        }
        window.setTimeout(checkStatus, 1000);
      } catch { window.setTimeout(checkStatus, 1500); }
    };
    checkStatus();
    return () => { cancelled = true; };
  }, [downloadFlyer, pendingSponsorshipId, paymentStatus, receiptToken]);
  const processPayment = async (cardToken, cvvToken) => {
    if (!selectedDate || !selectedType)
      return setCheckoutError("Please choose an available date.");
    const h = hebrew(selectedDate);
    try {
      const response = await fetch("/api/parnas-hayom/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sponsorshipTypeId: selectedType.id,
          sponsorshipName: selectedType.name,
          date: dateKey(selectedDate),
          hebrewYear: h.getFullYear(),
          hebrewMonth: h.getMonth(),
          hebrewDay: h.getDate(),
          cardToken,
          cvvToken,
          cardExpiry,
        }),
      });
      const rawPayload = await response.text();
      let payload = {};
      try {
        payload = rawPayload ? JSON.parse(rawPayload) : {};
      } catch {
        // Proxies and local runtimes can return an empty or HTML error response.
      }
      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Checkout is temporarily unavailable. Please try again or contact Neileich.",
        );
      }
      if (!payload.pending) throw new Error("We could not process your payment. Please try again.");
      setPendingSponsorshipId(payload.sponsorshipId);
      setReceiptToken(payload.receiptToken);
      setPaymentStatus("processing");
      window.history.replaceState({}, "", `/parnas-hayom?payment=processing&sponsorship=${payload.sponsorshipId}&receipt=${payload.receiptToken}`);
    } catch (error) {
      setCheckoutError(
        error.message || "We could not begin checkout. Please try again.",
      );
      setPaying(false);
    }
  };
  const checkout = (event) => {
    event.preventDefault();
    if (!selectedDate || !selectedType) return setCheckoutError("Please choose an available date.");
    if (!/^\d{4}$/.test(cardExpiry)) return setCheckoutError("Enter your card expiration as MMYY.");
    if (!ifieldsReady || !tokenInputs.current || !window.getTokens) return setCheckoutError("Secure card fields are still loading. Please try again.");
    setPaying(true);
    setCheckoutError("");
    void loadFlyerLibraries();
    window.getTokens(() => {
      const cardToken = tokenInputs.current.querySelector('[data-ifields-id="card-number-token"]')?.value;
      const cvvToken = tokenInputs.current.querySelector('[data-ifields-id="cvv-token"]')?.value;
      if (!cardToken || !cvvToken) {
        setPaying(false);
        return setCheckoutError("Please complete your card number and CVV.");
      }
      processPayment(cardToken, cvvToken);
    });
  };
  const h = selectedDate && hebrew(selectedDate);
  const canRecurring = selectedType?.recurring_enabled;
  const previewLeadIn = dedicationLeadIn(selectedType?.name);
  const receiptHebrewDate = receipt?.gregorianDate
    ? hebrew(new Date(`${receipt.gregorianDate}T12:00:00`)).renderGematriya(true)
    : "";
  if (paymentStatus === "confirmed") return (
    <div className="ph-success-page">
      <div className="ph-success-card">
        <img src="/logo-english.png" alt="Neileich" />
        <p className="ph-success-kicker">SPONSORSHIP CONFIRMED</p>
        <h1>Thank you for supporting Neileich.</h1>
        <p>{confirmationPreview ? "This is a local preview of the confirmed-payment screen. No payment was made." : flyerDownloadError ? "Your payment is confirmed and a receipt is on its way by email. Your flyer could not download automatically; please use the Print flyer button before leaving this page next time." : "Your payment is confirmed. Your dedication flyer has been downloaded and a receipt is on its way by email."}</p>
        {receipt && (
          <section className="ph-receipt" aria-label="Sponsorship receipt">
            <h2>Your sponsorship receipt</h2>
            <dl>
              <div><dt>Sponsorship</dt><dd>{receipt.sponsorshipName}</dd></div>
              <div><dt>Amount paid</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: receipt.currency?.toUpperCase() || "USD" }).format(receipt.amountCents / 100)}</dd></div>
              <div><dt>Gregorian date</dt><dd>{prettyDate(new Date(`${receipt.gregorianDate}T12:00:00`))}</dd></div>
              <div><dt>Hebrew date</dt><dd lang="he">{receiptHebrewDate}</dd></div>
              <div><dt>Dedication</dt><dd>{receipt.dedicationType}<br /><span lang="he" dir="auto">{receipt.dedicationText}</span></dd></div>
              <div><dt>Sponsored by</dt><dd>{receipt.donorName}<br />{receipt.donorEmail}{receipt.donorPhone ? <><br />{receipt.donorPhone}</> : null}</dd></div>
              <div><dt>Public acknowledgment</dt><dd>{receipt.anonymous ? "Anonymous" : receipt.donorName}</dd></div>
              <div><dt>Annual sponsorship</dt><dd>{receipt.recurring ? "Yes — annual Hebrew-date reminder" : "No"}</dd></div>
              {receipt.paymentReference && <div><dt>Payment reference</dt><dd>{receipt.paymentReference}</dd></div>}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
  return (
    <div className="ph-page">
      <section className="ph-hero">
        <div className="container">
          <p className="ph-kicker">PARnas Hayom</p>
          <h1>Sponsor a day of belonging.</h1>
          <p>
            Choose a meaningful date, share a dedication, and make Neileich’s
            programs possible.
          </p>
        </div>
      </section>
      <div className="container ph-shell">
        {paymentState === "processing" && (
          <div className="ph-notice success">
            Thank you. Your payment is being confirmed; a receipt will arrive by
            email shortly.
          </div>
        )}
        {paymentState === "cancelled" && (
          <div className="ph-notice">
            Checkout was canceled. Your date will be released shortly.
          </div>
        )}
        <ul className="ph-steps">
          <li className={selectedType ? "done" : ""}>1. Choose</li>
          <li className={selectedDate ? "done" : ""}>2. Date</li>
          <li>3. Dedication</li>
          <li>4. Payment</li>
        </ul>
        <section className="ph-card">
          <div className="ph-heading">
            <span>1</span>
            <div>
              <h2>Choose a sponsorship</h2>
              <p>Each gift directly supports Neileich’s daily work.</p>
            </div>
          </div>
          <div className="ph-types">
            {types.map((type) => (
              <button
                type="button"
                className={`ph-type ${selectedType?.id === type.id ? "selected" : ""}`}
                onClick={() => {
                  setSelectedType(type);
                  setSelectedDate(null);
                  setForm((current) => ({ ...current, recurring: false }));
                }}
                key={type.id}
              >
                <strong>{type.name}</strong>
                <small>{type.description}</small>
                <b>${(type.price_cents / 100).toLocaleString()}</b>
              </button>
            ))}
          </div>
        </section>
        <section className="ph-card">
          <div className="ph-heading">
            <span>2</span>
            <div>
              <h2>Choose your date</h2>
              <p>Dates are held for 20 minutes once you continue to payment.</p>
            </div>
          </div>
          <div className="ph-calendar-tools">
            <button
              type="button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ←
            </button>
            <strong>
              {month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              →
            </button>
            <div />
            <button
              type="button"
              className="ph-text-button"
              onClick={selectFirst}
            >
              First available
            </button>
            <button
              type="button"
              className="ph-text-button"
              onClick={selectRandom}
            >
              Random date
            </button>
          </div>
          {calendarError ? (
            <p className="ph-error">{calendarError}</p>
          ) : (
            <>
              <div className="ph-weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className="ph-grid">
                {calendarDays(month).map((day, index) => {
                  if (!day) return <i key={index} />;
                  const key = dateKey(day);
                  const past =
                    day <
                    new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate(),
                    );
                  const available = !past && availability[key];
                  return (
                    <button
                      type="button"
                      aria-label={prettyDate(day)}
                      key={key}
                      disabled={!available}
                      onClick={() => setSelectedDate(day)}
                      className={`${selectedDate && dateKey(selectedDate) === key ? "selected" : ""} ${!available ? "unavailable" : ""}`}
                    >
                      <b>{day.getDate()}</b>
                      <small>{hebrew(day).renderGematriya(true, true)}</small>
                    </button>
                  );
                })}
              </div>
              <p className="ph-calendar-note">
                {selectedDate ? (
                  <>
                    <strong>{prettyDate(selectedDate)}</strong> ·{" "}
                    <span lang="he">{h.renderGematriya(true)}</span>
                  </>
                ) : (
                  "Select an available date. Hebrew and Gregorian dates are shown together."
                )}
              </p>
            </>
          )}
        </section>
        <form className="ph-card ph-form" onSubmit={checkout}>
          <div className="ph-heading">
            <span>3</span>
            <div>
              <h2>Share your dedication</h2>
              <p>We’ll include this in your sponsorship acknowledgment.</p>
            </div>
          </div>
          <div className="ph-form-grid">
            <label>
              Dedication type
              <select
                name="dedicationType"
                value={form.dedicationType}
                onChange={change}
              >
                {dedicationTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="full">
              Dedication wording
              <textarea
                required
                name="dedicationText"
                value={form.dedicationText}
                onChange={change}
                placeholder="e.g. ר׳ אברהם בן ר׳ משה ז״ל"
                rows="3"
                maxLength="500"
              />
            </label>
            <label>
              Full name
              <input
                required
                name="donorName"
                value={form.donorName}
                onChange={change}
                autoComplete="name"
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                name="donorEmail"
                value={form.donorEmail}
                onChange={change}
                autoComplete="email"
              />
            </label>
            <label>
              Phone <em>(optional)</em>
              <input
                name="donorPhone"
                value={form.donorPhone}
                onChange={change}
                autoComplete="tel"
              />
            </label>
            <label className="ph-check">
              <input
                type="checkbox"
                name="anonymous"
                checked={form.anonymous}
                onChange={change}
              />{" "}
              Keep my name anonymous publicly
            </label>
            {canRecurring && (
              <label className="full ph-check recurring">
                <input
                  type="checkbox"
                  name="recurring"
                  checked={form.recurring}
                  onChange={change}
                />{" "}
                Make this an annual sponsorship on this Hebrew date. We’ll email
                you a secure renewal link each year.
              </label>
            )}
          </div>
          <section className="ph-payment-fields" aria-label="Secure payment details">
            <h3>Secure payment</h3>
            <p>Your card details are securely handled by Sola Payments.</p>
            <label>Card number
              <iframe title="Secure card number" data-ifields-id="card-number" data-ifields-placeholder="Card number" src="https://cdn.cardknox.com/ifields/2.15.2309.2601/ifield.htm" />
            </label>
            <div className="ph-payment-grid">
              <label>Expiration (MMYY)<input value={cardExpiry} onChange={(event) => setCardExpiry(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="cc-exp" placeholder="MMYY" required /></label>
              <label>CVV
                <iframe title="Secure card CVV" data-ifields-id="cvv" data-ifields-placeholder="CVV" src="https://cdn.cardknox.com/ifields/2.15.2309.2601/ifield.htm" />
              </label>
            </div>
            <div ref={tokenInputs}>
              <input name="xCardNum" data-ifields-id="card-number-token" type="hidden" />
              <input name="xCVV" data-ifields-id="cvv-token" type="hidden" />
            </div>
          </section>
          <div className="ph-preview" ref={previewRef}>
            <div className="ph-preview-brand">
              <img src="/logo-english.png" alt="Neileich" />
              <span>Building Belonging. Thriving children. Strong Kehila.</span>
            </div>
            <div className="ph-preview-dedication">
              <p>{previewLeadIn}</p>
              <strong>{form.dedicationType}</strong>
              <b
                className={`ph-preview-hebrew ph-preview-hebrew-${Math.min(
                  Math.ceil((form.dedicationText || "Your dedication will appear here").length / 18),
                  4,
                )}`}
                lang="he"
              >
                {form.dedicationText || "Your dedication will appear here"}
              </b>
            </div>
            <div className="ph-preview-details">
              <small className="ph-preview-date">
                {selectedDate
                  ? `${prettyDate(selectedDate)} · ${h.renderGematriya(true)}`
                  : "Select a date to add it here"}
              </small>
              <small className="ph-preview-donor">
                Sponsored by{" "}
                {form.anonymous ? "Anonymous" : form.donorName || "Your name"}
              </small>
            </div>
          </div>
          <button type="button" className="ph-print" onClick={printFlyer}>
            Print flyer / Save as PDF
          </button>
          {checkoutError && <p className="ph-error">{checkoutError}</p>}
          <button className="ph-pay" disabled={paying}>
            {paying
              ? paymentStatus === "processing"
                ? "Confirming your payment…"
                : "Securely authorizing your card…"
              : `Continue to secure payment${selectedType ? ` · $${(selectedType.price_cents / 100).toLocaleString()}` : ""}`}
          </button>
          <p className="ph-secure">
            Secure payment by Sola Payments. Your card information is never stored by
            Neileich.
          </p>
        </form>
      </div>
    </div>
  );
}
