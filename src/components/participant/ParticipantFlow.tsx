import { ArrowLeft, ArrowUpRight, Camera, Check, CalendarDays, LoaderCircle, LockKeyhole, Plus, ReceiptText, UserRound, UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { BillingUnit, Expense, Event, Language, Member, Settings } from "../../domain/models";
import { translate } from "../../i18n";
import { createId } from "../../utils/id";
import { prepareReceiptImage } from "../../utils/image";
import { recognizeReceiptAmount } from "../../utils/receiptOcr";
import { LanguageToggle } from "../ui/LanguageToggle";

interface ParticipantHomeProps {
  events: Event[];
  families: BillingUnit[];
  joined: boolean;
  canManage: boolean;
  language: Language;
  statusMessage?: string;
  onLanguageChange(language: Language): void;
  onChooseEvent(eventId: string): void;
  onManage(): void;
}

interface ParticipantJoinStateProps {
  language: Language;
  status: "joining" | "error";
  onLanguageChange(language: Language): void;
}

export function ParticipantJoinState({ language, status, onLanguageChange }: ParticipantJoinStateProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const joining = status === "joining";
  return <div className="participant-shell">
    <header className="participant-topbar"><div className="participant-brand"><span>Split</span><i /></div><LanguageToggle language={language} onChange={onLanguageChange} dark /></header>
    <main className="participant-main">
      <section className="participant-hero"><p className="eyebrow">{t("participantHomeEyebrow")}</p><h1>{joining ? t("joiningEvent") : t("joinFailed")}</h1><p>{joining ? t("joiningEventCopy") : t("joinFailedCopy")}</p></section>
      <section className="participant-empty compact"><div>{joining ? <LoaderCircle className="spin" size={30} /> : <X size={30} />}</div><h2>{joining ? t("connecting") : t("invalidLink")}</h2></section>
    </main>
  </div>;
}

export function ParticipantHome({ events, families, joined, canManage, language, statusMessage, onLanguageChange, onChooseEvent, onManage }: ParticipantHomeProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return <div className="participant-shell">
    <header className="participant-topbar"><div className="participant-brand"><span>Split</span><i /></div><div><LanguageToggle language={language} onChange={onLanguageChange} dark />{canManage && <button className="manager-entry" onClick={onManage}><LockKeyhole size={16} /> {t("managerArea")}</button>}</div></header>
    <main className="participant-main">
      <section className="participant-hero"><p className="eyebrow">{t("participantHomeEyebrow")}</p><h1>{t("participantHomeTitle")}</h1><p>{t("participantHomeCopy")}</p></section>
      {statusMessage && <div className="participant-notice">{statusMessage}</div>}
      {!joined ? <section className="participant-empty"><div><ReceiptText size={32} /></div><h2>{t("noSharedAccess")}</h2><p>{t("noSharedAccessCopy")}</p></section> : <section className="participant-events"><div className="participant-section-title"><span>{String(events.length).padStart(2, "0")}</span><div><p className="eyebrow">{t("chooseEvent")}</p><h2>{t("eventsLabel")}</h2></div></div>{events.length === 0 ? <div className="participant-empty compact"><CalendarDays size={28} /><h3>{t("noOpenEvents")}</h3><p>{t("noOpenEventsCopy")}</p></div> : <div className="participant-event-grid">{events.map((event, index) => { const familyNames = event.familyIds.map((id) => families.find((family) => family.id === id)?.name).filter(Boolean); return <button className={`participant-event tone-${index % 3}`} key={event.id} onClick={() => onChooseEvent(event.id)}><span className="event-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{event.name}</strong><small>{event.date}</small><p>{familyNames.join(" · ")}</p></div><ArrowUpRight size={25} /></button>; })}</div>}</section>}
    </main>
  </div>;
}

interface ParticipantExpenseProps {
  event: Event;
  families: BillingUnit[];
  members: Member[];
  settings: Settings;
  language: Language;
  onLanguageChange(language: Language): void;
  onBack(): void;
  onManage(): void;
  onSubmit(expense: Expense): Promise<void>;
}

type ScanState = { status: "idle" | "scanning" | "found" | "missing" | "failed"; progress: number };

export function ParticipantExpense({ event, families, members, settings, language, onLanguageChange, onBack, onManage, onSubmit }: ParticipantExpenseProps) {
  const availableFamilies = families.filter((family) => event.familyIds.includes(family.id) && members.some((member) => member.billingUnitId === family.id && member.active));
  const [familyId, setFamilyId] = useState("");
  const availableMembers = useMemo(() => members.filter((member) => member.billingUnitId === familyId && member.active).sort((a, b) => a.order - b.order), [familyId, members]);
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string>();
  const [scanState, setScanState] = useState<ScanState>({ status: "idle", progress: 0 });
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "saved" | "error">("idle");
  const [savedExpense, setSavedExpense] = useState<{ amount: number; family: string; reporter: string }>();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const selectedFamily = availableFamilies.find((family) => family.id === familyId);
  const selectedMember = availableMembers.find((member) => member.id === memberId);
  const numericAmount = Number(amount);
  const valid = Boolean(selectedFamily && selectedMember && Number.isFinite(numericAmount) && numericAmount > 0);
  const money = (value: number) => new Intl.NumberFormat(language === "he" ? "he-IL" : "en", { style: "currency", currency: settings.currency, maximumFractionDigits: 2 }).format(value);

  const chooseFamily = (id: string) => { setFamilyId(id); setMemberId(""); setSubmitState("idle"); };
  const scanReceipt = async (file?: File) => {
    if (!file) return;
    try {
      setScanState({ status: "scanning", progress: 0 });
      const imageUrl = await prepareReceiptImage(file);
      setReceiptUrl(imageUrl);
      const detected = await recognizeReceiptAmount(file, (progress) => setScanState({ status: "scanning", progress }));
      if (detected !== undefined) { setAmount(detected.toFixed(2)); setScanState({ status: "found", progress: 100 }); }
      else setScanState({ status: "missing", progress: 100 });
    } catch { setScanState({ status: "failed", progress: 0 }); }
  };
  const submit = async () => {
    if (!valid) return;
    setSubmitState("submitting");
    try {
      await onSubmit({ id: createId(), billingUnitId: familyId, reportedByMemberId: memberId, amount: numericAmount, description: description.trim() || undefined, receiptUrl });
      setSavedExpense({ amount: numericAmount, family: selectedFamily!.name, reporter: selectedMember!.name });
      setSubmitState("saved"); setAmount(""); setDescription(""); setReceiptUrl(undefined); setScanState({ status: "idle", progress: 0 });
    } catch { setSubmitState("error"); }
  };

  return <div className="participant-shell">
    <header className="participant-topbar"><button className="participant-back" onClick={onBack}><ArrowLeft size={18} /> {t("chooseEvent")}</button><div><LanguageToggle language={language} onChange={onLanguageChange} dark /><button className="manager-entry" onClick={onManage}><LockKeyhole size={16} /> {t("managerArea")}</button></div></header>
    <main className="participant-main report-flow">
      <section className="report-event-title"><div><p className="eyebrow">{t("expenseForEvent")}</p><h1>{event.name}</h1><span><CalendarDays size={15} /> {event.date}</span></div><div className="report-step">1–2–3</div></section>

      <section className="identity-card"><header><div><p className="eyebrow">01</p><h2>{t("chooseYourFamily")}</h2></div><UsersRound size={27} /></header><div className="identity-options">{availableFamilies.map((family) => <button className={family.id === familyId ? "selected" : ""} key={family.id} onClick={() => chooseFamily(family.id)}><span>{family.id === familyId && <Check size={15} />}</span>{family.name}</button>)}</div></section>

      {familyId && <section className="identity-card member-choice"><header><div><p className="eyebrow">02</p><h2>{t("chooseYourName")}</h2></div><UserRound size={27} /></header><div className="identity-options">{availableMembers.map((member) => <button className={member.id === memberId ? "selected" : ""} key={member.id} onClick={() => { setMemberId(member.id); setSubmitState("idle"); }}><span>{member.id === memberId && <Check size={15} />}</span>{member.name}</button>)}</div></section>}

      {selectedMember && <section className="participant-expense-card"><header><div><p className="eyebrow">03</p><h2>{t("reportExpense")}</h2><p>{selectedMember.name} · {selectedFamily?.name}</p></div><ReceiptText size={30} /></header>
        {submitState === "saved" ? <div className="participant-success"><div><Check size={28} /></div><h3>{t("expenseSaved")}</h3><p>{t("expenseSavedCopy")}</p>{savedExpense && <dl className="participant-confirmation"><div><dt>{t("amount")}</dt><dd>{money(savedExpense.amount)}</dd></div><div><dt>{t("billingUnit")}</dt><dd>{savedExpense.family}</dd></div><div><dt>{t("reportedBy")}</dt><dd>{savedExpense.reporter}</dd></div></dl>}<button onClick={() => setSubmitState("idle")}><Plus size={18} /> {t("reportAnother")}</button></div> : <div className="participant-expense-form">
          <label><span>{t("amount")}</span><input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setSubmitState("idle"); }} placeholder="0.00" /></label>
          <label><span>{t("description")} <i>{t("optional")}</i></span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descPlaceholder")} /></label>
          <div className="participant-receipt"><input className="sr-only" id="participant-receipt" type="file" accept="image/*" capture="environment" onChange={(e) => { void scanReceipt(e.target.files?.[0]); e.target.value = ""; }} />{receiptUrl ? <img src={receiptUrl} alt={t("receipt")} /> : <div><Camera size={25} /></div>}<label htmlFor="participant-receipt"><Camera size={18} /> {receiptUrl ? t("changeReceipt") : t("takeReceipt")}</label><small>{scanState.status === "scanning" ? `${t("scanningReceipt")} ${scanState.progress}%` : scanState.status === "found" ? t("receiptAmountFound") : scanState.status === "missing" ? t("receiptAmountMissing") : scanState.status === "failed" ? t("receiptScanFailed") : t("receiptOptional")}</small>{receiptUrl && <button aria-label={t("removeReceipt")} onClick={() => { setReceiptUrl(undefined); setScanState({ status: "idle", progress: 0 }); }}><X size={16} /></button>}</div>
          {submitState === "error" && <p className="submit-error">{t("expenseSaveFailed")}</p>}
          <button className="participant-submit" disabled={!valid || submitState === "submitting" || scanState.status === "scanning"} onClick={() => { void submit(); }}>{submitState === "submitting" ? <LoaderCircle className="spin" size={20} /> : <Check size={20} />} {submitState === "submitting" ? t("submittingExpense") : `${t("submitExpense")}${valid ? ` · ${money(numericAmount)}` : ""}`}</button>
        </div>}
      </section>}
    </main>
  </div>;
}
