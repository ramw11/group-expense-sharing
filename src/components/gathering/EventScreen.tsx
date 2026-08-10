import { ArrowLeft, Camera, Check, CheckCircle2, ChevronDown, CloudAlert, Copy, FolderPlus, Link2, LoaderCircle, Pencil, Plus, ReceiptText, RotateCcw, Save, Trash2, UsersRound, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Attendance, BillingUnit, Expense, Event, Group, Language, Member, Settings } from "../../domain/models";
import { createId } from "../../utils/id";
import { calculateEvent, createSettlements } from "../../business/calculations";
import { translate } from "../../i18n";
import { prepareReceiptImage } from "../../utils/image";
import { recognizeReceiptAmount } from "../../utils/receiptOcr";
import { LanguageToggle } from "../ui/LanguageToggle";
import { ShareLinkPanel } from "../ui/ShareLinkPanel";
import { calculationSettingsFrom } from "../../domain/defaults";

interface EventScreenProps {
  group: Group;
  repositoryFamilies: BillingUnit[];
  repositoryMembers: Member[];
  settings: Settings;
  language: Language;
  draft?: Event;
  cloudStatus: "idle" | "syncing" | "synced" | "error";
  cloudMessage: string;
  onLanguageChange(language: Language): void;
  onSave(draft: Event): void;
  onShare(draft: Event): Promise<string>;
  onCreateFamily(family: BillingUnit, members: Member[]): void;
  onBack(): void;
  onEditGroup(): void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function EventScreen({ group, repositoryFamilies, repositoryMembers, settings, language, draft, cloudStatus, cloudMessage, onLanguageChange, onSave, onShare, onCreateFamily, onBack, onEditGroup }: EventScreenProps) {
  const [familyIds, setFamilyIds] = useState<string[]>(() => draft?.familyIds ?? []);
  const units = useMemo(() => repositoryFamilies.filter((family) => familyIds.includes(family.id)), [familyIds, repositoryFamilies]);
  const members = useMemo(() => repositoryMembers.filter((member) => familyIds.includes(member.billingUnitId)), [familyIds, repositoryMembers]);
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
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string>();
  const [eventShareUrl, setEventShareUrl] = useState("");
  const [eventShareLoading, setEventShareLoading] = useState(false);
  const [eventShareFailed, setEventShareFailed] = useState(false);
  const [manualFamilyName, setManualFamilyName] = useState("");
  const [manualMemberNames, setManualMemberNames] = useState("");
  const [familyPickerOpen, setFamilyPickerOpen] = useState(false);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<string[]>([]);
  const calculationSettings = draft?.calculationSettings ?? calculationSettingsFrom(settings);
  const presentIds = new Set(attendance.filter((item) => item.present).map((item) => item.memberId));
  const presentCount = presentIds.size;

  const addRepositoryFamily = (familyId: string) => {
    if (familyIds.includes(familyId)) return;
    const family = repositoryFamilies.find((item) => item.id === familyId);
    if (!family) return;
    const familyMembers = repositoryMembers.filter((member) => member.billingUnitId === familyId);
    setFamilyIds((current) => [...current, familyId]);
    setAttendance((current) => [...current, ...familyMembers.filter((member) => member.active && !current.some((item) => item.memberId === member.id)).map((member) => ({ memberId: member.id, present: true }))]);
    if (!expenseUnitId) setExpenseUnitId(family.id);
  };
  const addManualFamily = () => {
    const familyName = manualFamilyName.trim();
    const names = manualMemberNames.split(/[,\n]/).map((name) => name.trim()).filter(Boolean);
    if (!familyName || !names.length) return;
    const familyId = createId();
    const family: BillingUnit = { id: familyId, groupId: group.id, name: familyName, order: repositoryFamilies.length };
    const familyMembers: Member[] = names.map((name, order) => ({ id: createId(), billingUnitId: familyId, name, active: true, order }));
    onCreateFamily(family, familyMembers);
    setFamilyIds((current) => [...current, familyId]);
    setAttendance((current) => [...current, ...familyMembers.map((member) => ({ memberId: member.id, present: true }))]);
    if (!expenseUnitId) setExpenseUnitId(familyId);
    setManualFamilyName(""); setManualMemberNames("");
  };
  const removeEventFamily = (familyId: string) => {
    const memberIds = new Set(repositoryMembers.filter((member) => member.billingUnitId === familyId).map((member) => member.id));
    const remaining = familyIds.filter((id) => id !== familyId);
    setFamilyIds(remaining);
    setAttendance((current) => current.filter((item) => !memberIds.has(item.memberId)));
    setExpenses((current) => current.filter((expense) => expense.billingUnitId !== familyId));
    if (expenseUnitId === familyId) setExpenseUnitId(remaining[0] ?? "");
  };
  const toggleFamilyDetails = (familyId: string) => setExpandedFamilyIds((current) => current.includes(familyId) ? current.filter((id) => id !== familyId) : [...current, familyId]);

  const toggle = (memberId: string) => setAttendance((current) => current.map((item) => item.memberId === memberId ? { ...item, present: !item.present } : item));
  const addExpense = () => {
    const amount = Number(expenseAmount);
    if (!expenseUnitId || !Number.isFinite(amount) || amount <= 0) return;
    setExpenses((current) => [...current, { id: createId(), billingUnitId: expenseUnitId, amount, description: expenseDescription.trim() || undefined, receiptUrl }]);
    setExpenseAmount(""); setExpenseDescription(""); setReceiptUrl(undefined); setScanState({ status: "idle", progress: 0 });
    setExpenseFormOpen(false);
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
  const calculation = calculateEvent({ date, units, members, attendance, expenses, settings: calculationSettings });
  const settlements = createSettlements(calculation.unitSummaries);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const currentDraft = (): Event => ({ id: draft?.id ?? createId(), groupId: group.id, name: eventName.trim() || t("unnamedEvent"), date, familyIds, attendance, expenses, calculationSettings, updatedAt: new Date().toISOString() });
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
  const createEventLink = async () => {
    setEventShareLoading(true);
    setEventShareFailed(false);
    try { setEventShareUrl(await onShare(currentDraft())); }
    catch { setEventShareFailed(true); }
    finally { setEventShareLoading(false); }
  };
  const reset = () => {
    const nextAttendance = activeMembers.map((member) => ({ memberId: member.id, present: true }));
    const nextDate = today();
    setDate(nextDate); setAttendance(nextAttendance); setExpenses([]); setExpenseAmount(""); setExpenseDescription(""); setReceiptUrl(undefined); setScanState({ status: "idle", progress: 0 });
    onSave({ id: draft?.id ?? createId(), groupId: group.id, name: eventName.trim() || t("unnamedEvent"), date: nextDate, familyIds, attendance: nextAttendance, expenses: [], calculationSettings, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="gathering-shell">
      <header className="gathering-topbar">
        <div className="gathering-nav"><button className="back-button light" onClick={saveAndBack}><ArrowLeft size={19} /> {t("backToEvents")}</button><button className="edit-group-button" onClick={saveAndEdit}><Pencil size={17} /> {t("editGroup")}</button></div>
        <div className="gathering-brand"><span>Split</span><i /></div>
        <div className="gathering-controls"><button className={`draft-save-button ${saved ? "saved" : ""}`} onClick={save}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? t("draftSaved") : t("saveDraft")}</button><LanguageToggle language={language} onChange={onLanguageChange} dark /><label className="gathering-date"><span>{t("gatheringDate")}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      </header>

      {cloudStatus === "error" && <div className={`event-cloud-banner ${cloudStatus}`}><CloudAlert size={17} /><span>{cloudMessage}</span></div>}

      <main className="gathering-main">
        <section className="gathering-intro">
          <div><p className="eyebrow">{t("eventDetails")}</p><h1>{t("whoIsHere")}</h1><label className="event-name-field"><span>{t("eventName")}</span><input value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder={t("eventNamePlaceholder")} /></label><button className="event-inline-share" disabled={eventShareLoading || cloudStatus === "syncing"} onClick={() => { void createEventLink(); }}>{eventShareLoading ? <LoaderCircle className="spin" size={20} /> : <Link2 size={20} />}<span><strong>{t("shareThisEvent")}</strong><small>{t("shareThisEventCopy")}</small></span></button>{eventShareFailed && <p className="share-link-error">{t("linkCreationFailed")}</p>}{eventShareUrl && <ShareLinkPanel url={eventShareUrl} title={eventName.trim() || t("unnamedEvent")} language={language} onClose={() => setEventShareUrl("")} />}</div>
          <div className="attendance-score"><strong>{presentCount}</strong><span>{t("of")} {activeMembers.length}<br />{t("attending")}</span></div>
        </section>

        <section className={`event-family-picker ${familyPickerOpen ? "expanded" : "collapsed"}`}>
          <button className="family-picker-toggle" aria-expanded={familyPickerOpen} onClick={() => setFamilyPickerOpen((open) => !open)}><div><p className="eyebrow">{t("chooseParticipants")}</p><h2>{t("familiesInEvent")}</h2><p>{t("familyPickerCopy")}</p></div><span className="selected-family-count">{familyIds.length}</span><ChevronDown className="accordion-chevron" size={22} /></button>
          {familyPickerOpen && <div className="family-picker-content"><div className="family-picker-grid">{repositoryFamilies.map((family) => { const selected = familyIds.includes(family.id); return <button className={selected ? "selected" : ""} key={family.id} onClick={() => selected ? removeEventFamily(family.id) : addRepositoryFamily(family.id)}><span className="attendance-check">{selected && <Check size={15} />}</span><strong>{family.name}</strong><small>{repositoryMembers.filter((member) => member.billingUnitId === family.id).length} {t("members")}</small></button>; })}</div>
          <div className="manual-family-row"><div><FolderPlus size={22} /><strong>{t("manualAddition")}</strong><small>{t("manualAdditionCopy")}</small></div><input value={manualFamilyName} onChange={(event) => setManualFamilyName(event.target.value)} placeholder={t("manualFamilyName")} /><input value={manualMemberNames} onChange={(event) => setManualMemberNames(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addManualFamily()} placeholder={t("manualMemberNames")} /><button onClick={addManualFamily}><Plus size={18} /> {t("addToEvent")}</button></div></div>}
        </section>

        <div className="gathering-layout">
          <section className="attendance-board">
            {units.map((unit) => {
              const unitMembers = activeMembers.filter((member) => member.billingUnitId === unit.id);
              if (!unitMembers.length) return null;
              const unitPresent = unitMembers.filter((member) => presentIds.has(member.id)).length;
              const expanded = expandedFamilyIds.includes(unit.id);
              return <article className={`attendance-unit ${expanded ? "expanded" : "collapsed"}`} key={unit.id}>
                <button className="attendance-unit-toggle" aria-expanded={expanded} onClick={() => toggleFamilyDetails(unit.id)}><div><UsersRound size={19} /><strong>{unit.name}</strong></div><span>{unitPresent}/{unitMembers.length}</span><ChevronDown className="accordion-chevron" size={20} /></button>
                {expanded && <div className="attendance-members">{unitMembers.map((member) => {
                  const present = presentIds.has(member.id);
                  return <button key={member.id} className={present ? "present" : ""} onClick={() => toggle(member.id)}><span className="attendance-check">{present && <Check size={15} />}</span><span>{member.name}</span></button>;
                })}</div>}
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
          <header><div><p className="eyebrow">{t("moneyIn")}</p><h2>{t("whatPaid")}</h2></div><div className="expense-header-actions"><div className="expense-total"><span>{t("total")}</span><strong>{money(totalPaid)}</strong></div><button className="expense-form-toggle" onClick={() => setExpenseFormOpen((open) => !open)}>{expenseFormOpen ? <X size={18} /> : <Plus size={18} />}{expenseFormOpen ? t("closeExpenseForm") : t("newExpense")}</button></div></header>
          <div className="family-paid-summary" aria-label={t("paidByFamilies")}>{calculation.unitSummaries.map((summary) => <article key={summary.billingUnitId}><span>{unitName(summary.billingUnitId)}</span><strong>{money(summary.paid)}</strong></article>)}</div>
          <div className={`expense-grid ${expenseFormOpen ? "" : "form-closed"}`}>
            {expenseFormOpen && <div className="expense-entry">
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
            </div>}
            <div className="expense-list">
              {expenses.length === 0 ? <div className="expense-empty"><WalletCards size={30} /><strong>{t("noExpenses")}</strong><span>{t("noExpensesCopy")}</span></div> : expenses.map((expense) => {
                const unit = units.find((item) => item.id === expense.billingUnitId);
                const reporter = repositoryMembers.find((member) => member.id === expense.reportedByMemberId);
                const expanded = expandedExpenseId === expense.id;
                return <article className={`expense-log-card ${expanded ? "expanded" : ""}`} key={expense.id}><button className="expense-log-summary" aria-expanded={expanded} onClick={() => setExpandedExpenseId(expanded ? undefined : expense.id)}>{expense.receiptUrl ? <img className="expense-receipt-thumb" src={expense.receiptUrl} alt={t("receipt")} /> : <div className="expense-symbol">₪</div>}<div><strong>{expense.description ?? t("expense")}</strong><span>{unit?.name ?? t("unknownUnit")}{reporter ? ` · ${t("reportedBy")} ${reporter.name}` : ""}</span></div><b>{money(expense.amount)}</b><ChevronDown className="expense-chevron" size={19} /></button>{expanded && <div className="expense-log-details"><dl><div><dt>{t("editAmount")}</dt><dd><input className="expense-amount-edit" type="number" min="0.01" step="0.01" inputMode="decimal" value={expense.amount} onChange={(event) => { const amount = Number(event.target.value); if (Number.isFinite(amount) && amount > 0) setExpenses((current) => current.map((item) => item.id === expense.id ? { ...item, amount } : item)); }} /></dd></div><div><dt>{t("paidBy")}</dt><dd>{unit?.name ?? t("unknownUnit")}</dd></div>{reporter && <div><dt>{t("reportedBy")}</dt><dd>{reporter.name}</dd></div>}</dl>{expense.receiptUrl ? <a className="receipt-preview" href={expense.receiptUrl} target="_blank" rel="noreferrer"><img src={expense.receiptUrl} alt={t("receipt")} /><span>{t("viewReceipt")}</span></a> : <div className="no-receipt"><ReceiptText size={20} /> {t("noReceiptAttached")}</div>}<button className="expense-delete" onClick={() => { setExpenses((current) => current.filter((item) => item.id !== expense.id)); setExpandedExpenseId(undefined); }}><Trash2 size={17} /> {t("deleteExpense")}</button></div>}</article>;
              })}
            </div>
          </div>
        </section>

        <section className="settlement-section">
          <header><div><p className="eyebrow">{t("finishLine")}</p><h2>{t("settledSimply")}</h2></div><div className="settlement-actions"><button className="copy-button" onClick={copyReport}>{copied ? <CheckCircle2 size={19} /> : <Copy size={19} />}{copied ? t("copied") : t("copyReport")}</button><button className="reset-button" onClick={reset}><RotateCcw size={18} /> {t("reset")}</button></div></header>
          {calculation.totalWeight === 0 ? <div className="calculation-empty">{t("chooseAttendee")}</div> : calculation.totalPaid === 0 ? <div className="calculation-empty">{t("addExpensePrompt")}</div> : <>
            <div className="summary-metrics"><article><span>{t("totalSpent")}</span><strong>{money(calculation.totalPaid)}</strong></article><article><span>{t("totalWeight")}</span><strong>{calculation.totalWeight.toLocaleString()}</strong></article><article><span>{t("perShare")}</span><strong>{money(calculation.costPerWeight)}</strong></article></div>
            <div className="settlement-grid"><div className="balance-table"><div className="balance-head"><span>{t("billingUnit")}</span><span>{t("paid")}</span><span>{t("share")}</span><span>{t("balance")}</span></div>{calculation.unitSummaries.filter((item) => item.paid || item.share).map((item) => <div className="balance-row" key={item.billingUnitId}><strong>{unitName(item.billingUnitId)}</strong><span data-label={t("paid")}>{money(item.paid)}</span><span data-label={t("share")}>{money(item.share)}</span><b data-label={t("balance")} className={item.balance >= 0 ? "positive" : "negative"}>{item.balance >= 0 ? "+" : ""}{money(item.balance)}</b></div>)}</div>
              <aside className="payments-card"><p className="section-kicker">{t("whoPaysWhom")}</p>{settlements.length === 0 ? <div className="all-set"><Check size={25} /><strong>{t("allSettled")}</strong></div> : settlements.map((item, index) => <div className="payment-line" key={`${item.fromBillingUnitId}-${item.toBillingUnitId}`}><span>{index + 1}</span><p><strong>{unitName(item.fromBillingUnitId)}</strong> {t("pays")} <strong>{unitName(item.toBillingUnitId)}</strong></p><b>{money(item.amount)}</b></div>)}</aside>
            </div>
          </>}
        </section>
      </main>
    </div>
  );
}
