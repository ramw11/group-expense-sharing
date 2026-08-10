import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, FileDown, LoaderCircle, ReceiptText, UsersRound } from "lucide-react";
import { useRef, useState } from "react";
import type { EventCalculation, Settlement } from "../../business/calculations";
import type { BillingUnit, Expense, Language, Member } from "../../domain/models";

interface ExpenseDashboardProps {
  units: BillingUnit[];
  members: Member[];
  expenses: Expense[];
  calculation: EventCalculation;
  currency: string;
  language: Language;
  eventName: string;
  eventDate: string;
  settlements: Settlement[];
}

export function ExpenseDashboard({ units, members, expenses, calculation, currency, language, eventName, eventDate, settlements }: ExpenseDashboardProps) {
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const insightsRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const he = language === "he";
  const locale = he ? "he-IL" : "en";
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? id;
  const familyData = calculation.unitSummaries.filter((item) => item.paid > 0 || item.share > 0);
  const reporterMap = new Map<string, { name: string; amount: number; count: number }>();
  expenses.forEach((expense) => {
    const member = members.find((item) => item.id === expense.reportedByMemberId);
    const key = member?.id ?? "unknown";
    const current = reporterMap.get(key) ?? { name: member?.name ?? (he ? "ללא שם מדווח" : "Unknown reporter"), amount: 0, count: 0 };
    current.amount += expense.amount;
    current.count += 1;
    reporterMap.set(key, current);
  });
  const reporters = [...reporterMap.values()].sort((a, b) => b.amount - a.amount);
  const largestExpenses = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const exportPdf = async () => {
    if (!dashboardRef.current || !chartsRef.current || !insightsRef.current || !summaryRef.current) return;
    setExporting(true);
    let exportRoot: HTMLElement | null = null;
    try {
      await document.fonts.ready;
      const { toCanvas } = await import("html-to-image");
      exportRoot = dashboardRef.current.cloneNode(true) as HTMLElement;
      exportRoot.classList.add("pdf-export-mode");
      Object.assign(exportRoot.style, { position: "fixed", inset: "0 auto auto -100000px", width: "1120px", maxWidth: "none", margin: "0" });
      exportRoot.querySelectorAll<HTMLElement>("[data-export-hide]").forEach((element) => { element.style.display = "none"; });
      document.body.append(exportRoot);
      await new Promise<void>((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(() => resolve()); }); });
      const pages = [...exportRoot.querySelectorAll<HTMLElement>(".dashboard-pdf-page")];
      if (pages.length !== 3) throw new Error("Dashboard export pages are missing");
      const captureOptions = { backgroundColor: "#182a20", pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), cacheBust: true, width: 1120, style: { width: "1120px", maxWidth: "none", overflow: "visible" } };
      const canvases = [];
      for (const page of pages) canvases.push(await toCanvas(page, captureOptions));
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 7;
      canvases.forEach((canvas, index) => {
        if (index > 0) pdf.addPage();
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const imageWidth = canvas.width * scale;
        const imageHeight = canvas.height * scale;
        pdf.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", (pageWidth - imageWidth) / 2, margin, imageWidth, imageHeight, undefined, "FAST");
      });
      pdf.save(`${(eventName || "dashboard").replace(/[\\/:*?"<>|]/g, "-")}-dashboard.pdf`);
    } finally { exportRoot?.remove(); setExporting(false); }
  };

  return <section className="expense-dashboard" aria-label={he ? "לוח מחוונים" : "Dashboard"} ref={dashboardRef}>
    <div className="dashboard-pdf-page" ref={chartsRef}><header><div><p>{he ? "מפת הכסף" : "Money map"} · {eventDate}</p><h3>{he ? "איך האירוע התחלק?" : "How was the event split?"}</h3></div><div className="dashboard-header-actions"><button data-export-hide disabled={exporting} onClick={() => { void exportPdf(); }}>{exporting ? <LoaderCircle className="spin" size={18} /> : <FileDown size={18} />}{he ? "שמירת Dashboard ל-PDF" : "Save dashboard PDF"}</button><div className="dashboard-stamp"><CircleDollarSign size={24} /><span>{he ? "סה״כ הוצאות" : "Total expenses"}</span><strong>{money(calculation.totalPaid)}</strong></div></div></header>
    <div className="dashboard-primary">
      <article className="family-comparison family-pies-panel"><header><div><UsersRound size={20} /><div><strong>{he ? "פאי לכל משפחה" : "A pie for every family"}</strong><span>{he ? "שולם בפועל מול החלק היחסי" : "Actually paid versus calculated share"}</span></div></div></header><div className="family-pies-grid">{familyData.map((item) => { const pieTotal = Math.max(item.paid + item.share, 1); const paidFraction = item.paid / pieTotal; const angle = paidFraction * Math.PI * 2 - Math.PI / 2; const endX = 45 + 34 * Math.cos(angle); const endY = 45 + 34 * Math.sin(angle); const paidSlice = paidFraction <= 0 ? null : paidFraction >= 1 ? <circle cx="45" cy="45" r="34" fill="#c7f36a" /> : <path d={`M 45 45 L 45 11 A 34 34 0 ${paidFraction > .5 ? 1 : 0} 1 ${endX} ${endY} Z`} fill="#c7f36a" />; return <section className="family-pie-card" key={item.billingUnitId}><header><strong>{unitName(item.billingUnitId)}</strong><span className={item.balance >= 0 ? "credit" : "debt"}>{item.balance >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}{item.balance >= 0 ? "+" : ""}{money(item.balance)}</span></header><div><div className="family-pie"><svg viewBox="0 0 90 90" aria-label={`${unitName(item.billingUnitId)}: ${money(item.paid)}, ${money(item.share)}`}><circle cx="45" cy="45" r="34" fill="#8060e8" />{paidSlice}</svg></div><div className="family-pie-legend"><span><i className="paid" />{he ? "שולם" : "Paid"}<b>{money(item.paid)}</b></span><span><i className="share" />{he ? "חלק יחסי" : "Share"}<b>{money(item.share)}</b></span></div></div></section>; })}</div></article>
    </div></div>
    <div className="dashboard-pdf-page dashboard-insights-page" ref={insightsRef}>
    <div className="dashboard-secondary">
      <article className="reporter-chart"><header><ReceiptText size={20} /><div><strong>{he ? "טבלת דיווחים לפי מדווח" : "Reports by reporter"}</strong><span>{he ? "מי דיווח, כמה דיווחים ובאיזה סכום" : "Reporter, report count, and amount"}</span></div></header><div className="reporter-table"><div className="reporter-table-head"><span>{he ? "מדווח" : "Reporter"}</span><span>{he ? "דיווחים" : "Reports"}</span><span>{he ? "סכום" : "Amount"}</span></div>{reporters.map((reporter) => <div className="reporter-row" key={reporter.name}><strong>{reporter.name}</strong><span>{reporter.count}</span><b>{money(reporter.amount)}</b></div>)}</div></article>
      <article className="largest-expenses"><header><strong>{he ? "חמש ההוצאות הגדולות" : "Five largest expenses"}</strong><span>{he ? "איפה מרוכז רוב הכסף" : "Where most money went"}</span></header><ol>{largestExpenses.map((expense) => <li key={expense.id}><span><b>{expense.description || (he ? "הוצאה" : "Expense")}</b><small>{unitName(expense.billingUnitId)}</small></span><strong>{money(expense.amount)}</strong></li>)}</ol></article>
    </div></div>
    <div className="dashboard-pdf-page dashboard-summary-page" ref={summaryRef}>
    <article className="dashboard-settlement-summary"><header><strong>{he ? "סיכום לתשלום" : "Payment summary"}</strong><span>{he ? "זה כל מה שצריך לבצע כדי לסגור את האירוע" : "Everything needed to close the event"}</span></header><div>{settlements.length ? settlements.map((settlement, index) => <div key={`${settlement.fromBillingUnitId}-${settlement.toBillingUnitId}`}><span>{index + 1}</span><p><strong>{unitName(settlement.fromBillingUnitId)}</strong> {he ? "משלמת ל-" : "pays"} <strong>{unitName(settlement.toBillingUnitId)}</strong></p><b>{money(settlement.amount)}</b></div>) : <p>{he ? "הכול מאוזן - אין צורך בהעברות" : "Everything is balanced - no transfers needed"}</p>}</div></article>
    <article className="dashboard-balance-summary"><header><strong>{he ? "מאזן מלא לפי משפחה" : "Full family balance"}</strong><span>{he ? "כל הנתונים שמהם נגזר סיכום התשלומים" : "All values behind the payment summary"}</span></header><div className="dashboard-balance-head"><span>{he ? "משפחה" : "Family"}</span><span>{he ? "שולם" : "Paid"}</span><span>{he ? "חלק יחסי" : "Share"}</span><span>{he ? "יתרה" : "Balance"}</span></div>{familyData.map((item) => <div className="dashboard-balance-row" key={item.billingUnitId}><strong>{unitName(item.billingUnitId)}</strong><span>{money(item.paid)}</span><span>{money(item.share)}</span><b className={item.balance >= 0 ? "credit" : "debt"}>{item.balance >= 0 ? "+" : ""}{money(item.balance)}</b></div>)}</article></div>
  </section>;
}
