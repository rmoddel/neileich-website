import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HDate } from "@hebcal/core";
import "./ParnasHayom.css";
import "./ParnasHayomPreview.css";
import "./ParnasHayomPayment.css";
import "./ParnasHayomSuccess.css";
import "./ParnasHayomOverride.css";
import "./ParnasHayomFlow.css";

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
const briefDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: orgTimeZone,
  }).format(date);
const money = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
const compactText = (value, fallback, max = 26) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const flowSteps = [
  { id: "type", number: 1, label: "Sponsorship" },
  { id: "date", number: 2, label: "Date" },
  { id: "dedication", number: 3, label: "Dedication" },
  { id: "payment", number: 4, label: "Payment" },
];
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

function dedicationSizeClass(text) {
  const length = (text || "Your dedication will appear here")
    .replace(/\s+/g, " ")
    .trim().length;
  if (length <= 18) return 1;
  if (length <= 36) return 2;
  if (length <= 60) return 3;
  if (length <= 90) return 4;
  if (length <= 140) return 5;
  if (length <= 220) return 6;
  if (length <= 330) return 7;
  return 8;
}

function fitFlyerPreview(preview) {
  if (!preview) return 1;

  const measureOverflow = () => {
    const previewBox = preview.getBoundingClientRect();
    const sections = [
      ".ph-preview-brand",
      ".ph-preview-dedication",
      ".ph-preview-details",
    ]
      .map((selector) => preview.querySelector(selector))
      .filter(Boolean);
    let overflowRatio = Math.max(
      preview.scrollWidth / Math.max(preview.clientWidth, 1),
      preview.scrollHeight / Math.max(preview.clientHeight, 1),
    );
    let previousBottom = previewBox.top;

    sections.forEach((section) => {
      const sectionBox = section.getBoundingClientRect();
      const childBoxes = Array.from(section.children)
        .map((child) => child.getBoundingClientRect())
        .filter((box) => box.width || box.height);

      if (!childBoxes.length) return;

      const contentBox = childBoxes.reduce(
        (box, childBox) => ({
          top: Math.min(box.top, childBox.top),
          right: Math.max(box.right, childBox.right),
          bottom: Math.max(box.bottom, childBox.bottom),
          left: Math.min(box.left, childBox.left),
        }),
        childBoxes[0],
      );
      const verticalOverflow =
        Math.max(0, sectionBox.top - contentBox.top) +
        Math.max(0, contentBox.bottom - sectionBox.bottom) +
        Math.max(0, previousBottom - contentBox.top);
      const horizontalOverflow =
        Math.max(0, sectionBox.left - contentBox.left) +
        Math.max(0, contentBox.right - sectionBox.right);

      overflowRatio = Math.max(
        overflowRatio,
        1 + verticalOverflow / Math.max(sectionBox.height, 1),
        1 + horizontalOverflow / Math.max(sectionBox.width, 1),
      );
      previousBottom = Math.max(previousBottom, contentBox.bottom);
    });

    return Math.max(
      overflowRatio,
      1 +
        Math.max(0, previousBottom - previewBox.bottom) /
          Math.max(previewBox.height, 1),
    );
  };

  let contentScale = 1;
  preview.style.setProperty("--flyer-content-scale", "1");

  for (let i = 0; i < 10; i += 1) {
    const overflowRatio = measureOverflow();

    if (overflowRatio <= 1.01) break;
    contentScale = Math.max(0.08, contentScale / overflowRatio);
    preview.style.setProperty("--flyer-content-scale", contentScale.toFixed(3));
  }

  return contentScale;
}

export default function ParnasHayom() {
  const today = useMemo(() => new Date(), []);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [activeStep, setActiveStep] = useState("type");
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [availability, setAvailability] = useState({});
  const [calendarError, setCalendarError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({
    dedicationType: dedicationTypes[0],
    customDedicationType: "",
    dedicationText: "",
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    anonymous: false,
    recurring: false,
  });
  const [checkoutError, setCheckoutError] = useState("");
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideCode, setOverrideCode] = useState("");
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [overrideVerifying, setOverrideVerifying] = useState(false);
  const [overrideError, setOverrideError] = useState("");
  const [flyerDownloadError, setFlyerDownloadError] = useState(false);
  const [flyerActionError, setFlyerActionError] = useState("");
  const [flyerDownloading, setFlyerDownloading] = useState(false);
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
  const flowRef = useRef(null);
  const flyerLibraries = useRef(null);
  const paymentState = new URLSearchParams(window.location.search).get(
    "payment",
  );

  useEffect(() => {
    fetch("/api/parnas-hayom/types")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ types: next }) => {
        setTypes(next);
      })
      .catch(() => {
        setTypes(fallbackTypes);
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
  const selectedAmount =
    selectedType &&
    (overrideApproved && overrideAmount && Number(overrideAmount) > 0
      ? Number(overrideAmount)
      : selectedType.price_cents / 100);
  const selectedAmountLabel = selectedAmount ? money(selectedAmount) : "";
  const isCustomDedicationType = form.dedicationType === "Custom";
  const effectiveDedicationType = isCustomDedicationType
    ? form.customDedicationType.trim()
    : form.dedicationType;
  const hasDedicationRequired = Boolean(
    effectiveDedicationType &&
      form.dedicationText.trim() &&
      form.donorName.trim() &&
      form.donorEmail.trim(),
  );
  const hasValidDonorEmail = looksLikeEmail(form.donorEmail);
  const dedicationComplete = hasDedicationRequired && hasValidDonorEmail;
  const paymentStepReady = Boolean(selectedType && selectedDate && dedicationComplete);
  const goToStep = (step) => {
    setActiveStep(step);
    window.setTimeout(() => {
      flowRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }, 80);
  };
  const chooseType = (type) => {
    const typeChanged = selectedType?.id !== type.id;
    setSelectedType(type);
    if (typeChanged) setSelectedDate(null);
    setCheckoutError("");
    if (typeChanged) setOverrideAmount("");
    setForm((current) => ({
      ...current,
      recurring: typeChanged ? false : current.recurring,
    }));
    goToStep("date");
  };
  const chooseDate = (day) => {
    setSelectedDate(day);
    setCheckoutError("");
    goToStep("dedication");
  };
  const selectFirst = () => {
    const nextDate = availableDays[0] || null;
    if (nextDate) chooseDate(nextDate);
  };
  const selectRandom = () => {
    const nextDate =
      availableDays[Math.floor(Math.random() * availableDays.length)] || null;
    if (nextDate) chooseDate(nextDate);
  };
  const change = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  const verifyOverrideCode = async () => {
    if (!overrideCode.trim()) return;
    setOverrideVerifying(true);
    setOverrideError("");
    try {
      const response = await fetch("/api/parnas-hayom/verify-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideCode }),
      });
      if (!response.ok) throw new Error("The authorization code is not valid.");
      setOverrideApproved(true);
    } catch (error) {
      setOverrideApproved(false);
      setOverrideAmount("");
      setOverrideError(error.message);
    } finally {
      setOverrideVerifying(false);
    }
  };
  const loadFlyerLibraries = useCallback(() => {
    if (!flyerLibraries.current) {
      flyerLibraries.current = Promise.all([import("html2canvas"), import("jspdf")]);
    }
    return flyerLibraries.current;
  }, []);
  const continueToPayment = () => {
    if (!paymentStepReady) {
      setCheckoutError(
        isCustomDedicationType && !effectiveDedicationType
          ? "Please name the custom dedication type."
          : hasDedicationRequired
          ? "Enter a valid email address."
          : "Please complete the dedication and donor details.",
      );
      return;
    }
    setCheckoutError("");
    goToStep("payment");
    void loadFlyerLibraries();
  };
  const downloadFlyer = useCallback(async () => {
    if (!previewRef.current) return;
    fitFlyerPreview(previewRef.current);
    const [{ default: html2canvas }, { jsPDF }] = await loadFlyerLibraries();
    const canvas = await html2canvas(previewRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      windowHeight: 1600,
      windowWidth: 1200,
      onclone: (documentClone) => {
        documentClone.documentElement.classList.add("ph-exporting");
        fitFlyerPreview(documentClone.querySelector(".ph-preview"));
      },
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 8.5, 11);
    pdf.save(`neileich-dedication-${selectedDate ? dateKey(selectedDate) : "flyer"}.pdf`);
  }, [loadFlyerLibraries, selectedDate]);
  const handleDownloadFlyer = async () => {
    setFlyerActionError("");
    setFlyerDownloading(true);
    try {
      await downloadFlyer();
    } catch (error) {
      console.error("Flyer PDF generation failed", error);
      setFlyerActionError("The dedication PDF could not be generated. Please try again.");
    } finally {
      setFlyerDownloading(false);
    }
  };
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
          dedicationType: effectiveDedicationType,
          sponsorshipTypeId: selectedType.id,
          sponsorshipName: selectedType.name,
          adjustedAmount: overrideApproved && overrideAmount ? overrideAmount : undefined,
          overrideCode: overrideApproved && overrideAmount ? overrideCode : undefined,
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
      const message = error.message || "We could not confirm your payment status.";
      setCheckoutError(
        message.includes("approved") ||
          message.includes("card") ||
          message.includes("available") ||
          message.includes("reserved")
          ? message
          : `${message} If your card account shows a charge, do not submit again; please contact Neileich so we can reconcile it.`,
      );
      setPaying(false);
    }
  };
  const checkout = (event) => {
    event.preventDefault();
    if (!selectedDate || !selectedType) {
      goToStep(selectedType ? "date" : "type");
      return setCheckoutError("Please choose an available date.");
    }
    if (!dedicationComplete) {
      goToStep("dedication");
      return setCheckoutError(
        isCustomDedicationType && !effectiveDedicationType
          ? "Please name the custom dedication type."
          : hasDedicationRequired
          ? "Enter a valid email address."
          : "Please complete the dedication and donor details.",
      );
    }
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
  const stepSummaries = {
    type: selectedType
      ? `${compactText(selectedType.name, "Selected", 18)} · ${selectedAmountLabel}`
      : "Choose one",
    date: selectedDate ? briefDate(selectedDate) : "Pick a day",
    dedication: effectiveDedicationType && form.dedicationText.trim()
      ? `${compactText(effectiveDedicationType, "Type", 13)} · ${compactText(form.dedicationText, "Wording", 18)}`
      : isCustomDedicationType && !effectiveDedicationType
        ? "Name custom type"
        : form.dedicationText.trim()
          ? compactText(form.dedicationText, "Written", 22)
      : form.donorName.trim()
        ? `By ${compactText(form.donorName, "donor", 18)}`
        : "Add wording",
    payment: selectedAmountLabel || "Card details",
  };
  const reachableSteps = {
    type: true,
    date: Boolean(selectedType),
    dedication: Boolean(selectedType && selectedDate),
    payment: paymentStepReady,
  };
  const completedSteps = {
    type: Boolean(selectedType),
    date: Boolean(selectedDate),
    dedication: dedicationComplete,
    payment: paymentStatus === "processing",
  };
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return undefined;

    let frame = 0;
    const fitPreview = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        fitFlyerPreview(preview);
      });
    };

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(fitPreview);
    observer?.observe(preview);
    window.addEventListener("resize", fitPreview);
    fitPreview();

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", fitPreview);
    };
  }, [
    activeStep,
    form.anonymous,
    form.customDedicationType,
    form.dedicationText,
    form.dedicationType,
    form.donorName,
    previewLeadIn,
    selectedDate,
  ]);
  const receiptHebrewDate = receipt?.gregorianDate
    ? hebrew(new Date(`${receipt.gregorianDate}T12:00:00`)).renderGematriya(true)
    : "";
  const receiptEmailFailed = receipt?.emailStatus === "failed";
  if (paymentStatus === "confirmed") return (
    <div className="ph-success-page">
      <div className="ph-success-card">
        <img src="/logo-english.png" alt="Neileich" />
        <p className="ph-success-kicker">SPONSORSHIP CONFIRMED</p>
        <h1>Thank you for supporting Neileich.</h1>
        <p>{confirmationPreview ? "This is a local preview of the confirmed-payment screen. No payment was made." : receiptEmailFailed ? "Your payment is confirmed, but the receipt and plaque email could not be sent automatically. Please contact Neileich so we can resend it." : flyerDownloadError ? "Your payment is confirmed and a receipt is on its way by email. Your flyer could not download automatically; please use the Download dedication PDF button before leaving this page next time." : "Your payment is confirmed. Your dedication flyer has been downloaded and a receipt is on its way by email."}</p>
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
        <nav className="ph-flowbar" aria-label="Sponsorship progress" ref={flowRef}>
          {flowSteps.map((step) => (
            <button
              type="button"
              key={step.id}
              className={[
                "ph-flow-crumb",
                activeStep === step.id ? "active" : "",
                completedSteps[step.id] ? "complete" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!reachableSteps[step.id]}
              aria-current={activeStep === step.id ? "step" : undefined}
              onClick={() => {
                if (reachableSteps[step.id]) goToStep(step.id);
              }}
            >
              <span className="ph-flow-number">{step.number}</span>
              <span className="ph-flow-copy">
                <strong>{step.label}</strong>
                <small>{stepSummaries[step.id]}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="ph-flow-stage">
          {activeStep === "type" && (
            <section className="ph-card ph-flow-panel" key="type">
              <div className="ph-heading">
                <span>1</span>
                <div>
                  <h2>Choose a sponsorship</h2>
                  <p>Each gift directly supports Neileich’s daily work.</p>
                </div>
              </div>
              {types.length ? (
                <div className="ph-types">
                  {types.map((type) => (
                    <button
                      type="button"
                      className={`ph-type ${selectedType?.id === type.id ? "selected" : ""}`}
                      onClick={() => chooseType(type)}
                      key={type.id}
                    >
                      <strong>{type.name}</strong>
                      <small>{type.description}</small>
                      <b>{money(type.price_cents / 100)}</b>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ph-calendar-note">Loading sponsorship options…</p>
              )}
              {selectedType && (
                <section className="ph-amount-override" aria-labelledby="parnas-amount-override-heading">
                  <strong id="parnas-amount-override-heading">Staff adjustment</strong>
                  <div className="ph-override-code">
                    <label>Code<input type="password" value={overrideCode} onChange={(event) => { setOverrideCode(event.target.value); setOverrideApproved(false); setOverrideAmount(""); setOverrideError(""); }} autoComplete="off" /></label>
                    <button type="button" onClick={verifyOverrideCode} disabled={!overrideCode.trim() || overrideVerifying}>{overrideVerifying ? "Checking…" : "Unlock"}</button>
                  </div>
                  {overrideError && <p className="ph-override-error">{overrideError}</p>}
                  {overrideApproved && <div className="ph-adjustment-amount">
                    <label>Adjusted amount<input type="number" min="1" step="0.01" inputMode="decimal" value={overrideAmount} onChange={(event) => setOverrideAmount(event.target.value)} placeholder={(selectedType.price_cents / 100).toFixed(2)} /></label>
                  </div>}
                </section>
              )}
            </section>
          )}
          {activeStep === "date" && selectedType && (
            <section className="ph-card ph-flow-panel" key="date">
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
                          onClick={() => chooseDate(day)}
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
          )}
          {activeStep === "dedication" && selectedType && selectedDate && (
            <section className="ph-card ph-form ph-flow-panel" key="dedication">
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
                {isCustomDedicationType && (
                  <label className="full ph-custom-dedication-type">
                    Custom dedication type
                    <input
                      required
                      name="customDedicationType"
                      value={form.customDedicationType}
                      onChange={change}
                      maxLength="120"
                      placeholder="e.g. In gratitude for"
                    />
                  </label>
                )}
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
              {checkoutError && <p className="ph-error">{checkoutError}</p>}
              <button type="button" className="ph-pay ph-next" onClick={continueToPayment} disabled={!hasDedicationRequired}>
                Continue to payment
              </button>
            </section>
          )}
          {activeStep === "payment" && paymentStepReady && (
            <form className="ph-card ph-form ph-flow-panel" onSubmit={checkout} key="payment">
              <div className="ph-heading">
                <span>4</span>
                <div>
                  <h2>Secure payment</h2>
                  <p>Your card details are securely handled by Sola Payments.</p>
                </div>
              </div>
              <section className="ph-payment-fields" aria-label="Secure payment details">
                <h3>Card details</h3>
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
                  <span className="ph-preview-kicker">Parnas Hayom</span>
                  <img src="/logo-english.png" alt="Neileich" />
                  <span className="ph-preview-tagline">Building Belonging. Thriving children. Strong Kehila.</span>
                </div>
                <div className="ph-preview-dedication">
                  <p>{previewLeadIn}</p>
                  <strong>{effectiveDedicationType}</strong>
                  <b
                    className={`ph-preview-hebrew ph-preview-hebrew-${dedicationSizeClass(
                      form.dedicationText,
                    )}`}
                    lang="he"
                    dir="auto"
                  >
                    {form.dedicationText || "Your dedication will appear here"}
                  </b>
                </div>
                <div className="ph-preview-details">
                  <small className="ph-preview-date">
                    {`${prettyDate(selectedDate)} · ${h.renderGematriya(true)}`}
                  </small>
                  <small className="ph-preview-donor">
                    Sponsored by{" "}
                    {form.anonymous ? "Anonymous" : form.donorName || "Your name"}
                  </small>
                </div>
              </div>
              <button type="button" className="ph-print" onClick={handleDownloadFlyer} disabled={flyerDownloading}>
                {flyerDownloading ? "Preparing PDF…" : "Download dedication PDF"}
              </button>
              {flyerActionError && <p className="ph-error">{flyerActionError}</p>}
              {checkoutError && <p className="ph-error">{checkoutError}</p>}
              <button className="ph-pay" disabled={paying}>
                {paying
                  ? paymentStatus === "processing"
                    ? "Confirming your payment…"
                    : "Securely authorizing your card…"
                  : `Submit secure payment · ${selectedAmountLabel}`}
              </button>
              <p className="ph-secure">
                Secure payment by Sola Payments. Your card information is never stored by
                Neileich.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
