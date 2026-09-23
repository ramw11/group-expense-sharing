import { ArrowLeft, Download, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";
import type { PersistentData } from "../../domain/models";
import type { DataRepository, ReceiptFileStore } from "../../application/ports";
import { createPortableBackup, dataWithEmbeddedReceipts, parsePortableBackup } from "../../application/portableBackup";
import { exportBlob } from "../exportFile";
import { isFilePickerCancellation, pickBackupText } from "./backupFilePicker";

export function AndroidDataManagement({ data, repository, receipts, onBack, onRestored }: { data: PersistentData; repository: DataRepository; receipts: ReceiptFileStore; onBack(): void; onRestored(data: PersistentData): void }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
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
  const importBackup = async () => {
    setBusy(true); setStatus("בודק את הגיבוי…");
    try {
      const raw = await pickBackupText();
      if (!raw) { setStatus(""); return; }
      const backup = await parsePortableBackup(raw);
      const events = backup.data.events.length;
      const expenses = backup.data.events.reduce((sum, event) => sum + event.expenses.length, 0);
      if (!window.confirm(`הגיבוי כולל ${events} אירועים ו-${expenses} הוצאות. להחליף את הנתונים המקומיים?`)) return;
      const safety = await createPortableBackup(data, async (expense) => expense.receiptPath ? receipts.read(expense.receiptPath) : expense.receiptUrl);
      const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem");
      await Filesystem.writeFile({ path: "backups/pre-restore-safety.gesbackup", data: JSON.stringify(safety), directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
      const restored = await repository.replace(dataWithEmbeddedReceipts(backup));
      onRestored(restored); setStatus("השחזור הושלם בהצלחה");
    } catch (reason) {
      if (isFilePickerCancellation(reason)) setStatus("");
      else setStatus(reason instanceof Error ? reason.message : "שחזור הגיבוי נכשל");
    }
    finally { setBusy(false); }
  };
  return <main className="android-data-page" dir="rtl"><button className="back-button" onClick={onBack}><ArrowLeft size={18} /> חזרה להגדרות</button><header><ShieldCheck size={42} /><p>הנתונים נשארים אצלך</p><h1>גיבוי ושחזור</h1><span>קובץ אחד כולל משפחות, אירועים, הוצאות וקבלות. אפשר לשמור אותו ב‑Drive, ב‑WhatsApp או במחשב.</span></header><section><article><Download /><div><h2>יצירת גיבוי מלא</h2><p>אינו מוחק או משנה דבר באפליקציה.</p></div><button disabled={busy} onClick={() => void exportBackup()}>יצירת גיבוי</button></article><article><Upload /><div><h2>שחזור או ייבוא מהאתר</h2><p>הקובץ נבדק במלואו לפני החלפת הנתונים.</p></div><button disabled={busy} onClick={() => void importBackup()}>בחירת קובץ מ‑Drive או מהמכשיר</button></article></section>{status && <p className="data-status" aria-live="polite">{status}</p>}</main>;
}
