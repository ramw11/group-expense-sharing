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

const colors = ["#c7f36a", "#8060e8", "#ff765d", "#f5b8d0", "#58b9a8", "#f4c451", "#79a8e8"];

export function ExpenseDashboard({ units, members, expenses, calculation, currency, language, eventName, eventDate, settlements }: ExpenseDashboardProps) {
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const he = language === "he";
  const locale = he ? "he-IL" : "en";
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? id;
  const familyData = calculation.unitSummaries.filter((item) => item.paid > 0 || item.share > 0);
  const totalPaid = calculation.totalPaid || 1;
  const circumference = 2 * Math.PI * 45;
  const familySegments = familyData.map((item, index) => ({
    ...item,
    color: colors[index % colors.length],
    length: item.paid / totalPaid * circumference,
    offset: familyData.slice(0, index).reduce((sum, family) => sum + family.paid / totalPaid * circumference, 0),
  }));
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
    if (!dashboardRef.current || !chartsRef.current || !summaryRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const captureOptions = { backgroundColor: "#182a20", scale: Math.min(window.devicePixelRatio || 1, 1.5), logging: false, windowWidth: 1280, onclone: (clone: Document) => { clone.querySelectorAll<HTMLElement>("[data-export-hide]").forEach((element) => { element.style.display = "none"; }); const dashboard = clone.querySelector<HTMLElement>(".expense-dashboard"); if (dashboard) { dashboard.style.width = "1120px"; dashboard.style.maxWidth = "none"; } } };
      const canvases = await Promise.all([html2canvas(chartsRef.current, captureOptions), html2canvas(summaryRef.current, captureOptions)]);
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
    } finally { setExporting(false); }
  };

  return <section className="expense-dashboard" aria-label={he ? "לוח מחוונים" : "Dashboard"} ref={dashboardRef}>
    <div className="dashboard-pdf-page" ref={chartsRef}><header><div><p>{he ? "מפת הכסף" : "Money map"} · {eventDate}</p><h3>{he ? "איך האירוע התחלק?" : "How was the event split?"}</h3></div><div className="dashboard-header-actions"><button data-export-hide disabled={exporting} onClick={() => { void exportPdf(); }}>{exporting ? <LoaderCircle className="spin" size={18} /> : <FileDown size={18} />}{he ? "שמירת Dashboard ל-PDF" : "Save dashboard PDF"}</button><div className="dashboard-stamp"><CircleDollarSign size={24} /><span>{he ? "סה״כ הוצאות" : "Total expenses"}</span><strong>{money(calculation.totalPaid)}</strong></div></div></header>
    <div className="dashboard-primary">
      <article className="donut-card">
        <div className="expense-donut"><svg viewBox="0 0 120 120" role="img" aria-label={he ? "חלוקת הוצאות לפי משפחה" : "Expenses by family"}><circle className="donut-track" cx="60" cy="60" r="45" />{familySegments.map((segment) => <circle key={segment.billingUnitId} cx="60" cy="60" r="45" fill="none" stroke={segment.color} strokeWidth="19" strokeDasharray={`${segment.length} ${circumference - segment.length}`} strokeDashoffset={-segment.offset} transform="rotate(-90 60 60)" />)}</svg><div><strong>{expenses.length}</strong><span>{he ? "דיווחים" : "reports"}</span></div></div>
        <div className="donut-legend">{familyData.map((item, index) => <div key={item.billingUnitId}><i style={{ background: colors[index % colors.length] }} /><span>{unitName(item.billingUnitId)}</span><strong>{money(item.paid)}</strong><small>{(item.paid / totalPaid * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%</small></div>)}</div>
      </article>
      <article className="family-comparison"><header><div><UsersRound size={20} /><div><strong>{he ? "שולם מול החלק היחסי" : "Paid vs. share"}</strong><span>{he ? "הפער הוא היתרה להתחשבנות" : "The gap becomes the settlement balance"}</span></div></div></header>{familyData.map((item) => { const max = Math.max(item.paid, item.share, 1); return <div className="comparison-row" key={item.billingUnitId}><div><strong>{unitName(item.billingUnitId)}</strong><span className={item.balance >= 0 ? "credit" : "debt"}>{item.balance >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}{item.balance >= 0 ? "+" : ""}{money(item.balance)}</span></div><div className="comparison-bars"><span style={{ width: `${item.paid / max * 100}%` }}><i>{he ? "שולם" : "Paid"} {money(item.paid)}</i></span><span style={{ width: `${item.share / max * 100}%` }}><i>{he ? "חלק" : "Share"} {money(item.share)}</i></span></div></div>; })}</article>
    </div></div>
    <div className="dashboard-pdf-page dashboard-summary-page" ref={summaryRef}>
    <div className="dashboard-secondary">
      <article className="reporter-chart"><header><ReceiptText size={20} /><div><strong>{he ? "טבלת דיווחים לפי מדווח" : "Reports by reporter"}</strong><span>{he ? "מי דיווח, כמה דיווחים ובאיזה סכום" : "Reporter, report count, and amount"}</span></div></header><div className="reporter-table"><div className="reporter-table-head"><span>{he ? "מדווח" : "Reporter"}</span><span>{he ? "דיווחים" : "Reports"}</span><span>{he ? "סכום" : "Amount"}</span></div>{reporters.map((reporter) => <div className="reporter-row" key={reporter.name}><strong>{reporter.name}</strong><span>{reporter.count}</span><b>{money(reporter.amount)}</b></div>)}</div></article>
      <article className="largest-expenses"><header><strong>{he ? "חמש ההוצאות הגדולות" : "Five largest expenses"}</strong><span>{he ? "איפה מרוכז רוב הכסף" : "Where most money went"}</span></header><ol>{largestExpenses.map((expense) => <li key={expense.id}><span><b>{expense.description || (he ? "הוצאה" : "Expense")}</b><small>{unitName(expense.billingUnitId)}</small></span><strong>{money(expense.amount)}</strong></li>)}</ol></article>
    </div>
    <article className="dashboard-settlement-summary"><header><strong>{he ? "סיכום לתשלום" : "Payment summary"}</strong><span>{he ? "זה כל מה שצריך לבצע כדי לסגור את האירוע" : "Everything needed to close the event"}</span></header><div>{settlements.length ? settlements.map((settlement, index) => <div key={`${settlement.fromBillingUnitId}-${settlement.toBillingUnitId}`}><span>{index + 1}</span><p><strong>{unitName(settlement.fromBillingUnitId)}</strong> {he ? "משלמת ל-" : "pays"} <strong>{unitName(settlement.toBillingUnitId)}</strong></p><b>{money(settlement.amount)}</b></div>) : <p>{he ? "הכול מאוזן - אין צורך בהעברות" : "Everything is balanced - no transfers needed"}</p>}</div></article>
    <article className="dashboard-balance-summary"><header><strong>{he ? "מאזן מלא לפי משפחה" : "Full family balance"}</strong><span>{he ? "כל הנתונים שמהם נגזר סיכום התשלומים" : "All values behind the payment summary"}</span></header><div className="dashboard-balance-head"><span>{he ? "משפחה" : "Family"}</span><span>{he ? "שולם" : "Paid"}</span><span>{he ? "חלק יחסי" : "Share"}</span><span>{he ? "יתרה" : "Balance"}</span></div>{familyData.map((item) => <div className="dashboard-balance-row" key={item.billingUnitId}><strong>{unitName(item.billingUnitId)}</strong><span>{money(item.paid)}</span><span>{money(item.share)}</span><b className={item.balance >= 0 ? "credit" : "debt"}>{item.balance >= 0 ? "+" : ""}{money(item.balance)}</b></div>)}</article></div>
  </section>;
}
