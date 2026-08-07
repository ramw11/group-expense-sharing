import { ArrowLeft, Check, CheckCircle2, Copy, Plus, ReceiptText, RotateCcw, Trash2, UsersRound, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import type { Attendance, BillingUnit, Expense, Group, Member, Settings } from "../../domain/models";
import { createId } from "../../utils/id";
import { calculateGathering, createSettlements } from "../../business/calculations";

interface GatheringScreenProps {
  group: Group;
  units: BillingUnit[];
  members: Member[];
  settings: Settings;
  onBack(): void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function GatheringScreen({ group, units, members, settings, onBack }: GatheringScreenProps) {
  const activeMembers = useMemo(() => members.filter((member) => member.active).sort((a, b) => a.order - b.order), [members]);
  const [date, setDate] = useState(today);
  const [attendance, setAttendance] = useState<Attendance[]>(() => activeMembers.map((member) => ({ memberId: member.id, present: true })));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseUnitId, setExpenseUnitId] = useState(units[0]?.id ?? "");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [copied, setCopied] = useState(false);
  const presentIds = new Set(attendance.filter((item) => item.present).map((item) => item.memberId));
  const presentCount = presentIds.size;

  const toggle = (memberId: string) => setAttendance((current) => current.map((item) => item.memberId === memberId ? { ...item, present: !item.present } : item));
  const addExpense = () => {
    const amount = Number(expenseAmount);
    if (!expenseUnitId || !Number.isFinite(amount) || amount <= 0) return;
    setExpenses((current) => [...current, { id: createId(), billingUnitId: expenseUnitId, amount, description: expenseDescription.trim() || undefined }]);
    setExpenseAmount(""); setExpenseDescription("");
  };
  const totalPaid = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const calculation = calculateGathering({ date, units, members, attendance, expenses, settings });
  const settlements = createSettlements(calculation.unitSummaries);
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: settings.currency, maximumFractionDigits: 2 }).format(value);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? "Unknown";
  const report = [
    `${group.name} — ${date}`,
    `Total: ${money(calculation.totalPaid)} | Weighted participants: ${calculation.totalWeight}`,
    "",
    ...calculation.unitSummaries.filter((item) => item.paid || item.share).map((item) => `${unitName(item.billingUnitId)}: paid ${money(item.paid)}, share ${money(item.share)}, balance ${item.balance >= 0 ? "+" : ""}${money(item.balance)}`),
    "",
    "Settlement:",
    ...(settlements.length ? settlements.map((item) => `${unitName(item.fromBillingUnitId)} pays ${unitName(item.toBillingUnitId)} ${money(item.amount)}`) : ["Everyone is settled." ]),
    settings.reportFooter,
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
  const copyReport = async () => { await navigator.clipboard.writeText(report); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const reset = () => { setDate(today()); setAttendance(activeMembers.map((member) => ({ memberId: member.id, present: true }))); setExpenses([]); setExpenseAmount(""); setExpenseDescription(""); };

  return (
    <div className="gathering-shell">
      <header className="gathering-topbar">
        <button className="back-button light" onClick={onBack}><ArrowLeft size={19} /> Group setup</button>
        <div className="gathering-brand"><span>Split</span><i /></div>
        <label className="gathering-date"><span>Gathering date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </header>

      <main className="gathering-main">
        <section className="gathering-intro">
          <div><p className="eyebrow">{group.name}</p><h1>Who’s at<br />the table?</h1></div>
          <div className="attendance-score"><strong>{presentCount}</strong><span>of {activeMembers.length}<br />attending</span></div>
        </section>

        <div className="gathering-layout">
          <section className="attendance-board">
            {units.map((unit) => {
              const unitMembers = activeMembers.filter((member) => member.billingUnitId === unit.id);
              if (!unitMembers.length) return null;
              const unitPresent = unitMembers.filter((member) => presentIds.has(member.id)).length;
              return <article className="attendance-unit" key={unit.id}>
                <header><div><UsersRound size={19} /><strong>{unit.name}</strong></div><span>{unitPresent}/{unitMembers.length}</span></header>
                <div className="attendance-members">{unitMembers.map((member) => {
                  const present = presentIds.has(member.id);
                  return <button key={member.id} className={present ? "present" : ""} onClick={() => toggle(member.id)}><span className="attendance-check">{present && <Check size={15} />}</span><span>{member.name}</span></button>;
                })}</div>
              </article>;
            })}
          </section>

          <aside className="gathering-rail">
            <div className="rail-step active"><span>01</span><div><strong>Attendance</strong><small>Choose who joined</small></div></div>
            <div className="rail-step"><span>02</span><div><strong>Expenses</strong><small>Add what was paid</small></div></div>
            <div className="rail-step"><span>03</span><div><strong>Settle</strong><small>See the final split</small></div></div>
            <div className="rail-note"><ReceiptText size={24} /><p>Everything in this gathering stays temporary until you reset it.</p></div>
          </aside>
        </div>

        <section className="expense-section">
          <header><div><p className="eyebrow">Money in</p><h2>What was paid?</h2></div><div className="expense-total"><span>Total</span><strong>₪{totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div></header>
          <div className="expense-grid">
            <div className="expense-entry">
              <label><span>Paid by</span><select value={expenseUnitId} onChange={(event) => setExpenseUnitId(event.target.value)}>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label>
              <label><span>Amount</span><input type="number" min="0" step="0.01" inputMode="decimal" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="0.00" /></label>
              <label className="expense-description"><span>Description <i>optional</i></span><input value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addExpense()} placeholder="Groceries, dinner, tickets…" /></label>
              <button className="expense-add" onClick={addExpense}><Plus size={19} /> Add expense</button>
            </div>
            <div className="expense-list">
              {expenses.length === 0 ? <div className="expense-empty"><WalletCards size={30} /><strong>No expenses yet</strong><span>Add the first payment to start the live total.</span></div> : expenses.map((expense) => {
                const unit = units.find((item) => item.id === expense.billingUnitId);
                return <article key={expense.id}><div className="expense-symbol">₪</div><div><strong>{expense.description ?? "Expense"}</strong><span>{unit?.name ?? "Unknown unit"}</span></div><b>₪{expense.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b><button aria-label="Delete expense" onClick={() => setExpenses((current) => current.filter((item) => item.id !== expense.id))}><Trash2 size={17} /></button></article>;
              })}
            </div>
          </div>
        </section>

        <section className="settlement-section">
          <header><div><p className="eyebrow">The finish line</p><h2>Settled, simply.</h2></div><div className="settlement-actions"><button className="copy-button" onClick={copyReport}>{copied ? <CheckCircle2 size={19} /> : <Copy size={19} />}{copied ? "Copied" : "Copy report"}</button><button className="reset-button" onClick={reset}><RotateCcw size={18} /> Reset</button></div></header>
          {calculation.totalWeight === 0 ? <div className="calculation-empty">Choose at least one attendee to calculate shares.</div> : calculation.totalPaid === 0 ? <div className="calculation-empty">Add an expense and the settlement will appear here instantly.</div> : <>
            <div className="summary-metrics"><article><span>Total spent</span><strong>{money(calculation.totalPaid)}</strong></article><article><span>Total weight</span><strong>{calculation.totalWeight.toLocaleString()}</strong></article><article><span>Per full share</span><strong>{money(calculation.costPerWeight)}</strong></article></div>
            <div className="settlement-grid"><div className="balance-table"><div className="balance-head"><span>Billing unit</span><span>Paid</span><span>Share</span><span>Balance</span></div>{calculation.unitSummaries.filter((item) => item.paid || item.share).map((item) => <div className="balance-row" key={item.billingUnitId}><strong>{unitName(item.billingUnitId)}</strong><span>{money(item.paid)}</span><span>{money(item.share)}</span><b className={item.balance >= 0 ? "positive" : "negative"}>{item.balance >= 0 ? "+" : ""}{money(item.balance)}</b></div>)}</div>
              <aside className="payments-card"><p className="section-kicker">Who pays whom</p>{settlements.length === 0 ? <div className="all-set"><Check size={25} /><strong>All settled</strong></div> : settlements.map((item, index) => <div className="payment-line" key={`${item.fromBillingUnitId}-${item.toBillingUnitId}`}><span>{index + 1}</span><p><strong>{unitName(item.fromBillingUnitId)}</strong> pays <strong>{unitName(item.toBillingUnitId)}</strong></p><b>{money(item.amount)}</b></div>)}</aside>
            </div>
          </>}
        </section>
      </main>
    </div>
  );
}
