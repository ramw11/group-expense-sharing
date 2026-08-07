import { ArrowLeft, Camera, Check, CheckCircle2, Copy, Pencil, Plus, ReceiptText, RotateCcw, Save, Trash2, UsersRound, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Attendance, BillingUnit, Expense, GatheringDraft, Group, Language, Member, Settings } from "../../domain/models";
import { createId } from "../../utils/id";
import { calculateGathering, createSettlements } from "../../business/calculations";
import { translate } from "../../i18n";
import { prepareReceiptImage } from "../../utils/image";
import { recognizeReceiptAmount } from "../../utils/receiptOcr";
import { LanguageToggle } from "../ui/LanguageToggle";

interface GatheringScreenProps {
  group: Group;
  units: BillingUnit[];
  members: Member[];
  settings: Settings;
  language: Language;
  draft?: GatheringDraft;
  onLanguageChange(language: Language): void;
  onSave(draft: GatheringDraft): void;
  onClear(): void;
  onBack(): void;
  onEditGroup(): void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function GatheringScreen({ group, units, members, settings, language, draft, onLanguageChange, onSave, onClear, onBack, onEditGroup }: GatheringScreenProps) {
  const activeMembers = useMemo(() => members.filter((member) => member.active).sort((a, b) => a.order - b.order), [members]);
  const [eventName, setEventName] = useState(() => draft?.name ?? "");
  const [date, setDate] = useState(() => draft?.date ?? today());
  const [attendance, setAttendance] = useState<Attendance[]>(() => activeMembers.map((member) => draft?.attendance.find((item) => item.memberId === member.id) ?? { memberId: member.id, present: true }));
  const [expenses, setExpenses] = useState<Expense[]>(() => draft?.expenses ?? []);
  const [expenseUnitId, setExpenseUnitId] = useState(units[0]?.id ?? "");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string>();
  const [scanState, setScanState] = useState<{ status: "idle" | "scanning" | "found" | "missing" | "failed"; progress: number }>({ status: "idle", progress: 0 });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const presentIds = new Set(attendance.filter((item) => item.present).map((item) => item.memberId));
  const presentCount = presentIds.size;

  const toggle = (memberId: string) => setAttendance((current) => current.map((item) => item.memberId === memberId ? { ...item, present: !item.present } : item));
  const addExpense = () => {
    const amount = Number(expenseAmount);
    if (!expenseUnitId || !Number.isFinite(amount) || amount <= 0) return;
    setExpenses((current) => [...current, { id: createId(), billingUnitId: expenseUnitId, amount, description: expenseDescription.trim() || undefined, receiptUrl }]);
    setExpenseAmount(""); setExpenseDescription(""); setReceiptUrl(undefined); setScanState({ status: "idle", progress: 0 });
  };
  const scanReceipt = async (file?: File) => {
    if (!file) return;
    try {
      setScanState({ status: "scanning", progress: 0 });
      const imageUrl = await prepareReceiptImage(file);
      setReceiptUrl(imageUrl);
      const amount = await recognizeReceiptAmount(file, (progress) => setScanState({ status: "scanning", progress }));
      if (amount !== undefined) { setExpenseAmount(amount.toFixed(2)); setScanState({ status: "found", progress: 100 }); }
      else setScanState({ status: "missing", progress: 100 });
    } catch { setScanState({ status: "failed", progress: 0 }); }
  };
  const totalPaid = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const calculation = calculateGathering({ date, units, members, attendance, expenses, settings });
  const settlements = createSettlements(calculation.unitSummaries);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const currentDraft = (): GatheringDraft => ({ groupId: group.id, name: eventName.trim() || undefined, date, attendance, expenses, updatedAt: new Date().toISOString() });
  const save = () => { onSave(currentDraft()); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const saveAndBack = () => { onSave(currentDraft()); onBack(); };
  const saveAndEdit = () => { onSave(currentDraft()); onEditGroup(); };
  const money = (value: number) => new Intl.NumberFormat(language === "he" ? "he-IL" : "en", { style: "currency", currency: settings.currency, maximumFractionDigits: 2 }).format(value);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? t("unknownUnit");
  const report = [
    `${eventName.trim() || group.name} — ${date}`,
    `${t("total")}: ${money(calculation.totalPaid)} | ${t("weightedParticipants")}: ${calculation.totalWeight}`,
    "",
    ...calculation.unitSummaries.filter((item) => item.paid || item.share).map((item) => `${unitName(item.billingUnitId)}: ${t("paid")} ${money(item.paid)}, ${t("share")} ${money(item.share)}, ${t("balance")} ${item.balance >= 0 ? "+" : ""}${money(item.balance)}`),
    "",
    `${t("settlement")}:`,
    ...(settlements.length ? settlements.map((item) => `${unitName(item.fromBillingUnitId)} ${t("pays")} ${unitName(item.toBillingUnitId)} ${money(item.amount)}`) : [t("everyoneSettled")]),
    settings.reportFooter,
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
  const copyReport = async () => { await navigator.clipboard.writeText(report); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const reset = () => { setEventName(""); setDate(today()); setAttendance(activeMembers.map((member) => ({ memberId: member.id, present: true }))); setExpenses([]); setExpenseAmount(""); setExpenseDescription(""); setReceiptUrl(undefined); setScanState({ status: "idle", progress: 0 }); onClear(); };

  return (
    <div className="gathering-shell">
      <header className="gathering-topbar">
        <div className="gathering-nav"><button className="back-button light" onClick={saveAndBack}><ArrowLeft size={19} /> {t("backToEvents")}</button><button className="edit-group-button" onClick={saveAndEdit}><Pencil size={17} /> {t("editGroup")}</button></div>
        <div className="gathering-brand"><span>Split</span><i /></div>
        <div className="gathering-controls"><button className={`draft-save-button ${saved ? "saved" : ""}`} onClick={save}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? t("draftSaved") : t("saveDraft")}</button><LanguageToggle language={language} onChange={onLanguageChange} dark /><label className="gathering-date"><span>{t("gatheringDate")}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      </header>

      <main className="gathering-main">
        <section className="gathering-intro">
          <div><p className="eyebrow">{group.name}</p><h1>{t("whoIsHere")}</h1><label className="event-name-field"><span>{t("eventName")}</span><input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder={t("eventNamePlaceholder")} /></label></div>
          <div className="attendance-score"><strong>{presentCount}</strong><span>{t("of")} {activeMembers.length}<br />{t("attending")}</span></div>
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
            <div className="rail-step active"><span>01</span><div><strong>{t("attendance")}</strong><small>{t("chooseJoined")}</small></div></div>
            <div className="rail-step"><span>02</span><div><strong>{t("expenses")}</strong><small>{t("addPaid")}</small></div></div>
            <div className="rail-step"><span>03</span><div><strong>{t("settle")}</strong><small>{t("finalSplit")}</small></div></div>
            <div className="rail-note"><ReceiptText size={24} /><p>{t("temporaryNote")}</p></div>
          </aside>
        </div>

        <section className="expense-section">
          <header><div><p className="eyebrow">{t("moneyIn")}</p><h2>{t("whatPaid")}</h2></div><div className="expense-total"><span>{t("total")}</span><strong>{money(totalPaid)}</strong></div></header>
          <div className="expense-grid">
            <div className="expense-entry">
              <label><span>{t("paidBy")}</span><select value={expenseUnitId} onChange={(event) => setExpenseUnitId(event.target.value)}>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label>
              <label><span>{t("amount")}</span><input type="number" min="0" step="0.01" inputMode="decimal" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="0.00" /></label>
              <div className="receipt-capture">
                <input className="sr-only" id="receipt-photo" type="file" accept="image/*" capture="environment" onChange={(event) => { void scanReceipt(event.target.files?.[0]); event.target.value = ""; }} />
                {receiptUrl ? <img src={receiptUrl} alt={t("receipt")} /> : <div className="receipt-placeholder"><ReceiptText size={26} /></div>}
                <div><label className="receipt-button" htmlFor="receipt-photo"><Camera size={18} /> {receiptUrl ? t("changeReceipt") : t("takeReceipt")}</label><small>{scanState.status === "scanning" ? `${t("scanningReceipt")} ${scanState.progress}%` : scanState.status === "found" ? t("receiptAmountFound") : scanState.status === "missing" ? t("receiptAmountMissing") : scanState.status === "failed" ? t("receiptScanFailed") : `${t("cameraHint")} ${t("ocrFirstUse")}`}</small></div>
                {receiptUrl && <button className="receipt-remove" aria-label={t("removeReceipt")} onClick={() => { setReceiptUrl(undefined); setScanState({ status: "idle", progress: 0 }); }}><X size={17} /></button>}
                {scanState.status === "scanning" && <div className="ocr-progress" style={{ width: `${scanState.progress}%` }} />}
              </div>
              <label className="expense-description"><span>{t("description")} <i>{t("optional")}</i></span><input value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addExpense()} placeholder={t("descPlaceholder")} /></label>
              <button className="expense-add" onClick={addExpense} disabled={scanState.status === "scanning"}><Plus size={19} /> {t("addExpense")}</button>
            </div>
            <div className="expense-list">
              {expenses.length === 0 ? <div className="expense-empty"><WalletCards size={30} /><strong>{t("noExpenses")}</strong><span>{t("noExpensesCopy")}</span></div> : expenses.map((expense) => {
                const unit = units.find((item) => item.id === expense.billingUnitId);
                return <article key={expense.id}>{expense.receiptUrl ? <img className="expense-receipt-thumb" src={expense.receiptUrl} alt={t("receipt")} /> : <div className="expense-symbol">₪</div>}<div><strong>{expense.description ?? t("expense")}</strong><span>{unit?.name ?? t("unknownUnit")}</span></div><b>{money(expense.amount)}</b><button aria-label={t("deleteExpense")} onClick={() => setExpenses((current) => current.filter((item) => item.id !== expense.id))}><Trash2 size={17} /></button></article>;
              })}
            </div>
          </div>
        </section>

        <section className="settlement-section">
          <header><div><p className="eyebrow">{t("finishLine")}</p><h2>{t("settledSimply")}</h2></div><div className="settlement-actions"><button className="copy-button" onClick={copyReport}>{copied ? <CheckCircle2 size={19} /> : <Copy size={19} />}{copied ? t("copied") : t("copyReport")}</button><button className="reset-button" onClick={reset}><RotateCcw size={18} /> {t("reset")}</button></div></header>
          {calculation.totalWeight === 0 ? <div className="calculation-empty">{t("chooseAttendee")}</div> : calculation.totalPaid === 0 ? <div className="calculation-empty">{t("addExpensePrompt")}</div> : <>
            <div className="summary-metrics"><article><span>{t("totalSpent")}</span><strong>{money(calculation.totalPaid)}</strong></article><article><span>{t("totalWeight")}</span><strong>{calculation.totalWeight.toLocaleString()}</strong></article><article><span>{t("perShare")}</span><strong>{money(calculation.costPerWeight)}</strong></article></div>
            <div className="settlement-grid"><div className="balance-table"><div className="balance-head"><span>{t("billingUnit")}</span><span>{t("paid")}</span><span>{t("share")}</span><span>{t("balance")}</span></div>{calculation.unitSummaries.filter((item) => item.paid || item.share).map((item) => <div className="balance-row" key={item.billingUnitId}><strong>{unitName(item.billingUnitId)}</strong><span>{money(item.paid)}</span><span>{money(item.share)}</span><b className={item.balance >= 0 ? "positive" : "negative"}>{item.balance >= 0 ? "+" : ""}{money(item.balance)}</b></div>)}</div>
              <aside className="payments-card"><p className="section-kicker">{t("whoPaysWhom")}</p>{settlements.length === 0 ? <div className="all-set"><Check size={25} /><strong>{t("allSettled")}</strong></div> : settlements.map((item, index) => <div className="payment-line" key={`${item.fromBillingUnitId}-${item.toBillingUnitId}`}><span>{index + 1}</span><p><strong>{unitName(item.fromBillingUnitId)}</strong> {t("pays")} <strong>{unitName(item.toBillingUnitId)}</strong></p><b>{money(item.amount)}</b></div>)}</aside>
            </div>
          </>}
        </section>
      </main>
    </div>
  );
}
