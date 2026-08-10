import { Check, Copy, Download, X } from "lucide-react";
import { useState } from "react";
import type { EventCalculation, Settlement } from "../../business/calculations";
import type { BillingUnit, CalculationSettings, Expense, Language, Member } from "../../domain/models";

interface CalculationAuditReportProps {
  eventName: string;
  eventDate: string;
  units: BillingUnit[];
  members: Member[];
  expenses: Expense[];
  calculation: EventCalculation;
  settlements: Settlement[];
  settings: CalculationSettings;
  currency: string;
  language: Language;
  onClose(): void;
}

const labels = {
  he: { title: "דוח ביקורת חישוב", subtitle: "כל המספרים, הנוסחאות וההעברות במקום אחד", copy: "העתקת הדוח", copied: "הועתק", download: "הורדת דוח", close: "סגירה", checks: "בדיקות איזון", expensesMatch: "סך ההוצאות תואם", sharesMatch: "החלוקה נסגרת", balancesMatch: "היתרות מאוזנות", settings: "כללי החישוב באירוע", automatic: "משקל אוטומטי", manual: "משקל ידני", childRule: "ילד מתחת לגיל", childWeight: "משקל ילד", rounding: "עיגול", noRounding: "אגורות", halfRounding: "חצי שקל", wholeRounding: "שקל שלם", formula: "הנוסחה המרכזית", formulaCopy: "עלות ליחידת משקל = סך ההוצאות ÷ סך המשקל", attendees: "1. משתתפים ומשקלים", person: "משתתף", family: "משפחה", weight: "משקל", rawShare: "עלות לפני עיגול", families: "2. חישוב לכל משפחה", paid: "שולם בפועל", familyWeight: "משקל משפחתי", calculatedShare: "חלק מחושב", balance: "יתרה", expenses: "פירוט הוצאות", noExpenses: "לא דווחו הוצאות", familyEquation: "חלק המשפחה = משקל המשפחה × עלות ליחידת משקל", balanceEquation: "יתרה = שולם בפועל − חלק מחושב", creditor: "זכאית לקבל", debtor: "חייבת לשלם", even: "מאוזנת", transfers: "3. מי חייב למי", transferRule: "המערכת מתאימה בכל צעד בין משפחה חייבת למשפחה זכאית ומעבירה את הנמוך מבין החוב והזכות, עד שכל היתרות נסגרות.", pays: "משלמת ל־", allSettled: "אין צורך בהעברות", totalExpenses: "סך הוצאות", totalWeight: "סך משקל", costPerWeight: "עלות ליחידת משקל", statusOk: "תקין", statusError: "לא מאוזן" },
  en: { title: "Calculation audit report", subtitle: "Every number, formula, and transfer in one place", copy: "Copy report", copied: "Copied", download: "Download report", close: "Close", checks: "Reconciliation checks", expensesMatch: "Expense total matches", sharesMatch: "Shares reconcile", balancesMatch: "Balances reconcile", settings: "Event calculation rules", automatic: "Automatic weight", manual: "Manual weight", childRule: "Child younger than", childWeight: "Child weight", rounding: "Rounding", noRounding: "Cents", halfRounding: "Nearest 0.50", wholeRounding: "Nearest whole", formula: "Core formula", formulaCopy: "Cost per weight = total expenses ÷ total weight", attendees: "1. Attendees and weights", person: "Person", family: "Family", weight: "Weight", rawShare: "Share before rounding", families: "2. Calculation by family", paid: "Actually paid", familyWeight: "Family weight", calculatedShare: "Calculated share", balance: "Balance", expenses: "Expense detail", noExpenses: "No expenses reported", familyEquation: "Family share = family weight × cost per weight", balanceEquation: "Balance = actually paid − calculated share", creditor: "Receives", debtor: "Pays", even: "Balanced", transfers: "3. Who pays whom", transferRule: "At each step the system matches a debtor family with a creditor family and transfers the smaller of the debt and credit until all balances close.", pays: "pays", allSettled: "No transfers required", totalExpenses: "Total expenses", totalWeight: "Total weight", costPerWeight: "Cost per weight", statusOk: "OK", statusError: "Out of balance" },
} as const;

export function CalculationAuditReport({ eventName, eventDate, units, members, expenses, calculation, settlements, settings, currency, language, onClose }: CalculationAuditReportProps) {
  const [copied, setCopied] = useState(false);
  const l = labels[language];
  const locale = language === "he" ? "he-IL" : "en";
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 4 });
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? id;
  const memberName = (id: string) => members.find((member) => member.id === id)?.name ?? id;
  const allocated = calculation.unitSummaries.reduce((sum, item) => sum + item.share, 0);
  const balances = calculation.unitSummaries.reduce((sum, item) => sum + item.balance, 0);
  const expenseRows = expenses.reduce((sum, item) => sum + item.amount, 0);
  const checks = [
    { label: l.expensesMatch, ok: Math.abs(expenseRows - calculation.totalPaid) < 0.01 },
    { label: l.sharesMatch, ok: Math.abs(allocated - calculation.totalPaid) < 0.01 },
    { label: l.balancesMatch, ok: Math.abs(balances) < 0.01 },
  ];
  const roundingLabel = settings.roundingMode === "nearest-1" ? l.wholeRounding : settings.roundingMode === "nearest-0.5" ? l.halfRounding : l.noRounding;
  const reportText = [
    `${l.title}: ${eventName} (${eventDate})`,
    `${l.totalExpenses}: ${money(calculation.totalPaid)}`,
    `${l.totalWeight}: ${number(calculation.totalWeight)}`,
    `${l.costPerWeight}: ${money(calculation.costPerWeight)}`,
    `${l.formulaCopy}: ${money(calculation.totalPaid)} ÷ ${number(calculation.totalWeight)} = ${money(calculation.costPerWeight)}`,
    "",
    l.attendees,
    ...calculation.memberShares.map((item) => `${memberName(item.memberId)} | ${unitName(item.billingUnitId)} | ${l.weight}: ${number(item.weight)} | ${l.rawShare}: ${money(item.share)}`),
    "",
    l.families,
    ...calculation.unitSummaries.map((item) => `${unitName(item.billingUnitId)} | ${l.paid}: ${money(item.paid)} | ${l.familyWeight}: ${number(item.weight)} | ${l.calculatedShare}: ${money(item.share)} | ${l.balance}: ${item.balance >= 0 ? "+" : ""}${money(item.balance)}`),
    "",
    l.transfers,
    ...(settlements.length ? settlements.map((item) => `${unitName(item.fromBillingUnitId)} ${l.pays} ${unitName(item.toBillingUnitId)}: ${money(item.amount)}`) : [l.allSettled]),
    "",
    `${l.checks}: ${checks.map((item) => `${item.label}=${item.ok ? l.statusOk : l.statusError}`).join("; ")}`,
  ].join("\n");
  const copyReport = async () => { await navigator.clipboard.writeText(reportText); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([reportText], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${eventName || "calculation"}-audit.txt`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <section className="audit-report" aria-label={l.title}>
    <header><div><p>{eventDate}</p><h3>{l.title}</h3><span>{l.subtitle}</span></div><div><button onClick={() => { void copyReport(); }}><Copy size={17} /> {copied ? l.copied : l.copy}</button><button onClick={downloadReport}><Download size={17} /> {l.download}</button><button aria-label={l.close} onClick={onClose}><X size={18} /></button></div></header>
    <div className="audit-checks"><strong>{l.checks}</strong>{checks.map((item) => <span className={item.ok ? "ok" : "error"} key={item.label}><Check size={15} /> {item.label}: {item.ok ? l.statusOk : l.statusError}</span>)}</div>
    <div className="audit-rules"><div><span>{l.settings}</span><strong>{settings.weightMode === "automatic" ? l.automatic : l.manual}</strong></div>{settings.weightMode === "automatic" && <><div><span>{l.childRule}</span><strong>{settings.childAgeThreshold}</strong></div><div><span>{l.childWeight}</span><strong>{number(settings.childWeight)}</strong></div></>}<div><span>{l.rounding}</span><strong>{roundingLabel}</strong></div></div>
    <div className="audit-formula"><span>{l.formula}</span><strong>{money(calculation.totalPaid)} ÷ {number(calculation.totalWeight)} = {money(calculation.costPerWeight)}</strong><p>{l.formulaCopy}</p></div>
    <section className="audit-block"><h4>{l.attendees}</h4><div className="audit-table audit-members"><div className="audit-table-head"><span>{l.person}</span><span>{l.family}</span><span>{l.weight}</span><span>{l.rawShare}</span></div>{calculation.memberShares.map((item) => <div className="audit-table-row" key={item.memberId}><strong>{memberName(item.memberId)}</strong><span>{unitName(item.billingUnitId)}</span><span>{number(item.weight)}</span><b>{money(item.share)}</b></div>)}</div></section>
    <section className="audit-block"><h4>{l.families}</h4><div className="audit-family-grid">{calculation.unitSummaries.map((item) => { const familyExpenses = expenses.filter((expense) => expense.billingUnitId === item.billingUnitId); const rawShare = item.weight * calculation.costPerWeight; return <article key={item.billingUnitId}><header><h5>{unitName(item.billingUnitId)}</h5><span className={item.balance > .004 ? "credit" : item.balance < -.004 ? "debt" : "even"}>{item.balance > .004 ? l.creditor : item.balance < -.004 ? l.debtor : l.even}</span></header><div className="audit-family-metrics"><div><span>{l.paid}</span><strong>{money(item.paid)}</strong></div><div><span>{l.familyWeight}</span><strong>{number(item.weight)}</strong></div><div><span>{l.calculatedShare}</span><strong>{money(item.share)}</strong></div><div><span>{l.balance}</span><strong>{item.balance >= 0 ? "+" : ""}{money(item.balance)}</strong></div></div><p>{l.familyEquation}: {number(item.weight)} × {money(calculation.costPerWeight)} = {money(rawShare)} → {money(item.share)}</p><p>{l.balanceEquation}: {money(item.paid)} − {money(item.share)} = {item.balance >= 0 ? "+" : ""}{money(item.balance)}</p><details><summary>{l.expenses} ({familyExpenses.length})</summary>{familyExpenses.length ? <ul>{familyExpenses.map((expense) => <li key={expense.id}><span>{expense.description ?? l.noExpenses}</span><strong>{money(expense.amount)}</strong></li>)}</ul> : <p>{l.noExpenses}</p>}</details></article>; })}</div></section>
    <section className="audit-block"><h4>{l.transfers}</h4><p className="audit-transfer-rule">{l.transferRule}</p><div className="audit-transfers">{settlements.length ? settlements.map((item, index) => <div key={`${item.fromBillingUnitId}-${item.toBillingUnitId}`}><span>{index + 1}</span><p><strong>{unitName(item.fromBillingUnitId)}</strong> {l.pays} <strong>{unitName(item.toBillingUnitId)}</strong></p><b>{money(item.amount)}</b></div>) : <p>{l.allSettled}</p>}</div></section>
  </section>;
}
