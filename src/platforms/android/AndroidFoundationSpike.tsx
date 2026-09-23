import { useState } from "react";
import { runDatabaseSpike, runReceiptStorageSpike } from "./foundationSpike";

type Status = { kind: "idle" | "running" | "success" | "error"; message: string };

const initialStatus: Status = { kind: "idle", message: "טרם הורצה בדיקה" };

export function AndroidFoundationSpike() {
  const [database, setDatabase] = useState<Status>(initialStatus);
  const [receipt, setReceipt] = useState<Status>(initialStatus);

  const verifyDatabase = async () => {
    setDatabase({ kind: "running", message: "כותב וקורא מ־SQLite…" });
    try {
      const result = await runDatabaseSpike();
      setDatabase({ kind: "success", message: `הצלחה: רשומה ${result.id} נשמרה ונקראה` });
    } catch (error) {
      setDatabase({ kind: "error", message: error instanceof Error ? error.message : "בדיקת SQLite נכשלה" });
    }
  };

  const verifyReceipt = async () => {
    setReceipt({ kind: "running", message: "ממתין לבחירת תמונה…" });
    try {
      const result = await runReceiptStorageSpike();
      setReceipt({ kind: "success", message: `הצלחה: ${result.bytes.toLocaleString()} בתים נשמרו ב־${result.path}` });
    } catch (error) {
      setReceipt({ kind: "error", message: error instanceof Error ? error.message : "שמירת התמונה נכשלה" });
    }
  };

  return (
    <main dir="rtl" style={{ minHeight: "100vh", padding: "32px 20px", background: "#f6f2e8", color: "#182a20", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "min(680px, 100%)", margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <p style={{ margin: 0, color: "#6556df", fontWeight: 800 }}>Sprint A0</p>
          <h1 style={{ margin: "8px 0" }}>בדיקת יסודות Android</h1>
          <p style={{ lineHeight: 1.6 }}>המסך הזה זמני ומופיע רק באפליקציה. הוא מאמת אחסון מקומי ללא חיבור ל־Supabase.</p>
        </header>
        <SpikeCard title="מסד נתונים מקומי" status={database} button="בדיקת SQLite" onRun={verifyDatabase} />
        <SpikeCard title="קבלה באחסון פרטי" status={receipt} button="בחירת תמונה ושמירה" onRun={verifyReceipt} />
      </section>
    </main>
  );
}

function SpikeCard({ title, status, button, onRun }: { title: string; status: Status; button: string; onRun: () => Promise<void> }) {
  const statusColor = status.kind === "success" ? "#147a42" : status.kind === "error" ? "#b93724" : "#516056";
  return (
    <article style={{ padding: 24, border: "2px solid #182a20", borderRadius: 24, background: "#fffdf7", boxShadow: "6px 6px 0 #182a20" }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p aria-live="polite" style={{ minHeight: 24, color: statusColor }}>{status.message}</p>
      <button type="button" disabled={status.kind === "running"} onClick={() => void onRun()} style={{ border: 0, borderRadius: 14, padding: "14px 18px", background: "#bdf65b", color: "#182a20", fontWeight: 800, fontSize: 16 }}>
        {button}
      </button>
    </article>
  );
}
