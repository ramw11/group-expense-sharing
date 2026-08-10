import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, ReceiptText, UsersRound } from "lucide-react";
import type { EventCalculation } from "../../business/calculations";
import type { BillingUnit, Expense, Language, Member } from "../../domain/models";

interface ExpenseDashboardProps {
  units: BillingUnit[];
  members: Member[];
  expenses: Expense[];
  calculation: EventCalculation;
  currency: string;
  language: Language;
}

const colors = ["#c7f36a", "#8060e8", "#ff765d", "#f5b8d0", "#58b9a8", "#f4c451", "#79a8e8"];

export function ExpenseDashboard({ units, members, expenses, calculation, currency, language }: ExpenseDashboardProps) {
  const he = language === "he";
  const locale = he ? "he-IL" : "en";
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? id;
  const familyData = calculation.unitSummaries.filter((item) => item.paid > 0 || item.share > 0);
  const totalPaid = calculation.totalPaid || 1;
  const slices = familyData.map((item, index) => {
    const start = familyData.slice(0, index).reduce((sum, family) => sum + family.paid / totalPaid * 360, 0);
    const end = start + item.paid / totalPaid * 360;
    return `${colors[index % colors.length]} ${start}deg ${end}deg`;
  });
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
  const maxReporter = Math.max(...reporters.map((item) => item.amount), 1);
  const largestExpenses = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return <section className="expense-dashboard" aria-label={he ? "לוח מחוונים" : "Dashboard"}>
    <header><div><p>{he ? "מפת הכסף" : "Money map"}</p><h3>{he ? "איך האירוע התחלק?" : "How was the event split?"}</h3></div><div className="dashboard-stamp"><CircleDollarSign size={24} /><span>{he ? "סה״כ הוצאות" : "Total expenses"}</span><strong>{money(calculation.totalPaid)}</strong></div></header>
    <div className="dashboard-primary">
      <article className="donut-card">
        <div className="expense-donut" style={{ background: `conic-gradient(${slices.join(",")})` }}><div><strong>{expenses.length}</strong><span>{he ? "דיווחים" : "reports"}</span></div></div>
        <div className="donut-legend">{familyData.map((item, index) => <div key={item.billingUnitId}><i style={{ background: colors[index % colors.length] }} /><span>{unitName(item.billingUnitId)}</span><strong>{money(item.paid)}</strong><small>{(item.paid / totalPaid * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%</small></div>)}</div>
      </article>
      <article className="family-comparison"><header><div><UsersRound size={20} /><div><strong>{he ? "שולם מול החלק היחסי" : "Paid vs. share"}</strong><span>{he ? "הפער הוא היתרה להתחשבנות" : "The gap becomes the settlement balance"}</span></div></div></header>{familyData.map((item) => { const max = Math.max(item.paid, item.share, 1); return <div className="comparison-row" key={item.billingUnitId}><div><strong>{unitName(item.billingUnitId)}</strong><span className={item.balance >= 0 ? "credit" : "debt"}>{item.balance >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}{item.balance >= 0 ? "+" : ""}{money(item.balance)}</span></div><div className="comparison-bars"><span style={{ width: `${item.paid / max * 100}%` }}><i>{he ? "שולם" : "Paid"} {money(item.paid)}</i></span><span style={{ width: `${item.share / max * 100}%` }}><i>{he ? "חלק" : "Share"} {money(item.share)}</i></span></div></div>; })}</article>
    </div>
    <div className="dashboard-secondary">
      <article className="reporter-chart"><header><ReceiptText size={20} /><div><strong>{he ? "דיווחים לפי מדווח" : "Reports by reporter"}</strong><span>{he ? "כמה כסף הוזן על ידי כל אחד" : "Amount entered by each person"}</span></div></header><div>{reporters.map((reporter) => <div className="reporter-row" key={reporter.name}><span>{reporter.name}<small>{reporter.count} {he ? "דיווחים" : "reports"}</small></span><i><b style={{ width: `${reporter.amount / maxReporter * 100}%` }} /></i><strong>{money(reporter.amount)}</strong></div>)}</div></article>
      <article className="largest-expenses"><header><strong>{he ? "חמש ההוצאות הגדולות" : "Five largest expenses"}</strong><span>{he ? "איפה מרוכז רוב הכסף" : "Where most money went"}</span></header><ol>{largestExpenses.map((expense) => <li key={expense.id}><span><b>{expense.description || (he ? "הוצאה" : "Expense")}</b><small>{unitName(expense.billingUnitId)}</small></span><strong>{money(expense.amount)}</strong></li>)}</ol></article>
    </div>
  </section>;
}
