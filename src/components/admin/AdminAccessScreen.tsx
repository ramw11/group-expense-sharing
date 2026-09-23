import { KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { Language } from "../../domain/models";
import { LanguageToggle } from "../ui/LanguageToggle";

interface Props {
  language: Language;
  bootstrap: boolean;
  onLanguageChange(language: Language): void;
  onSubmit(code: string): Promise<void>;
  onBack(): void;
}

export function AdminAccessScreen({ language, bootstrap, onLanguageChange, onSubmit, onBack }: Props) {
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const he = language === "he";
  const valid = code.length >= 8 && (!bootstrap || code === confirm);
  const submit = async () => {
    if (!valid) return;
    setStatus("working");
    try { await onSubmit(code); } catch { setStatus("error"); }
  };
  return <div className="participant-shell admin-access-shell">
    <header className="participant-topbar"><button className="participant-back" onClick={onBack}>{he ? "חזרה לדיווח" : "Back to reporting"}</button><LanguageToggle language={language} onChange={onLanguageChange} dark /></header>
    <main className="admin-access-main">
      <section className="admin-access-card">
        <div className="admin-access-mark">{bootstrap ? <KeyRound size={30} /> : <LockKeyhole size={30} />}</div>
        <p className="eyebrow">{he ? "אזור ניהול" : "Manager area"}</p>
        <h1>{bootstrap ? (he ? "הגדירו קוד ניהול" : "Create the manager code") : (he ? "כניסה לניהול" : "Manager sign in")}</h1>
        <p>{bootstrap ? (he ? "הקוד יאפשר למנהלים מורשים להיכנס מכל מכשיר. בחרו לפחות 8 תווים." : "This code lets authorized managers sign in from any device. Use at least 8 characters.") : (he ? "הזינו את קוד הניהול המשותף." : "Enter the shared manager code.")}</p>
        <label><span>{he ? "קוד ניהול" : "Manager code"}</span><input type="password" autoComplete="current-password" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void submit()} /></label>
        {bootstrap && <label><span>{he ? "אימות הקוד" : "Confirm code"}</span><input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void submit()} /></label>}
        {status === "error" && <p className="submit-error">{he ? "הקוד לא התקבל. בדקו ונסו שוב." : "The code was not accepted. Check it and try again."}</p>}
        <button className="participant-submit" disabled={!valid || status === "working"} onClick={() => void submit()}>{status === "working" ? <LoaderCircle className="spin" size={20} /> : <LockKeyhole size={20} />} {bootstrap ? (he ? "שמירת הקוד וכניסה" : "Save code and enter") : (he ? "כניסה" : "Sign in")}</button>
      </section>
    </main>
  </div>;
}
