import { ArrowLeft, Download, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { PersistentData } from "../../domain/models";
import type { DataRepository, ReceiptFileStore } from "../../application/ports";
import { createPortableBackup, dataWithEmbeddedReceipts, parsePortableBackup } from "../../application/portableBackup";
import { exportBlob } from "../exportFile";

export function AndroidDataManagement({ data, repository, receipts, onBack, onRestored }: { data: PersistentData; repository: DataRepository; receipts: ReceiptFileStore; onBack(): void; onRestored(data: PersistentData): void }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportBackup = async () => {
    setBusy(true); setStatus("מכין גיבוי…");
    try {
      const backup = await createPortableBackup(data, async (expense) => expense.receiptPath ? receipts.read(expense.receiptPath) : expense.receiptUrl);
      const date = new Date().toISOString().slice(0, 10);
      await exportBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), `mitchalkim-backup-${date}.gesbackup`, "שיתוף גיבוי מתחלקים");
      setStatus("הגיבוי מוכן ונמסר לחלון השיתוף");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "יצירת הגיבוי נכשלה"); }
    finally { setBusy(false); }
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    setBusy(true); setStatus("בודק את הגיבוי…");
    try {
      const backup = await parsePortableBackup(await file.text());
      const events = backup.data.events.length;
      const expenses = backup.data.events.reduce((sum, event) => sum + event.expenses.length, 0);
      if (!window.confirm(`הגיבוי כולל ${events} אירועים ו-${expenses} הוצאות. להחליף את הנתונים המקומיים?`)) return;
      const safety = await createPortableBackup(data, async (expense) => expense.receiptPath ? receipts.read(expense.receiptPath) : expense.receiptUrl);
      localStorage.setItem("android-pre-restore-safety-backup", JSON.stringify(safety));
      const restored = await repository.replace(dataWithEmbeddedReceipts(backup));
      onRestored(restored); setStatus("השחזור הושלם בהצלחה");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "שחזור הגיבוי נכשל"); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  return <main className="android-data-page" dir="rtl"><button className="back-button" onClick={onBack}><ArrowLeft size={18} /> חזרה להגדרות</button><header><ShieldCheck size={42} /><p>הנתונים נשארים אצלך</p><h1>גיבוי ושחזור</h1><span>קובץ אחד כולל משפחות, אירועים, הוצאות וקבלות. אפשר לשמור אותו ב‑Drive, ב‑WhatsApp או במחשב.</span></header><section><article><Download /><div><h2>יצירת גיבוי מלא</h2><p>אינו מוחק או משנה דבר באפליקציה.</p></div><button disabled={busy} onClick={() => void exportBackup()}>יצירת גיבוי</button></article><article><Upload /><div><h2>שחזור או ייבוא מהאתר</h2><p>הקובץ נבדק במלואו לפני החלפת הנתונים.</p></div><input ref={inputRef} hidden id="backup-import" type="file" accept=".gesbackup,application/json" onChange={(event) => void importBackup(event.target.files?.[0])} /><label className={busy ? "disabled" : ""} htmlFor="backup-import">בחירת קובץ</label></article></section>{status && <p className="data-status" aria-live="polite">{status}</p>}</main>;
}
