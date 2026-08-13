import { useEffect, useMemo, useState } from "react";
import { HDate } from "@hebcal/core";
import "./ParnasHayom.css";
import "./ParnasHayomPreview.css";

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
  const [paying, setPaying] = useState(false);
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
          Object.fromEntries(days.map((d) => [d.date, d.available])),
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
  const usePreviewAvailability = selectedType?.id.startsWith("unconfigured");
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
  const checkout = async (event) => {
    event.preventDefault();
    if (!selectedDate || !selectedType)
      return setCheckoutError("Please choose an available date.");
    setPaying(true);
    setCheckoutError("");
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
      if (!payload.checkoutUrl) {
        throw new Error("We could not create a secure checkout session. Please try again.");
      }
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error.message || "We could not begin checkout. Please try again.",
      );
      setPaying(false);
    }
  };
  const h = selectedDate && hebrew(selectedDate);
  const canRecurring = selectedType?.recurring_enabled;
  const previewLeadIn = dedicationLeadIn(selectedType?.name);
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
          <div className="ph-preview">
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
              ? "Opening secure checkout…"
              : `Continue to secure payment${selectedType ? ` · $${(selectedType.price_cents / 100).toLocaleString()}` : ""}`}
          </button>
          <p className="ph-secure">
            Secure payment by Stripe. Your card information is never stored by
            Neileich.
          </p>
        </form>
      </div>
    </div>
  );
}
