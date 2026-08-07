const parseAmount = (value: string): number | undefined => {
  const compact = value.replace(/\s/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  const normalized = decimalAt >= 0 && compact.length - decimalAt <= 3
    ? `${compact.slice(0, decimalAt).replace(/[.,]/g, "")}.${compact.slice(decimalAt + 1)}`
    : compact.replace(/[.,]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount < 1_000_000 ? amount : undefined;
};

export const findLikelyReceiptAmount = (text: string): number | undefined => {
  const amountPattern = /(?:₪|\$|€)?\s*(\d{1,3}(?:[ ,.']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
  const totalPattern = /total|amount\s*due|grand\s*total|לתשלום|סה[״"']?כ|סך\s*הכל/i;
  const candidates: { amount: number; priority: number }[] = [];

  for (const line of text.split(/\r?\n/)) {
    const priority = totalPattern.test(line) ? 2 : 1;
    for (const match of line.matchAll(amountPattern)) {
      const amount = parseAmount(match[1]);
      if (amount !== undefined) candidates.push({ amount, priority });
    }
  }

  const preferred = candidates.filter((candidate) => candidate.priority === 2);
  const pool = preferred.length ? preferred : candidates;
  return pool.sort((a, b) => b.amount - a.amount)[0]?.amount;
};

export async function recognizeReceiptAmount(imageUrl: string, onProgress: (progress: number) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress(Math.round((message.progress ?? 0) * 100));
    },
  });
  try {
    const result = await worker.recognize(imageUrl);
    return findLikelyReceiptAmount(result.data.text);
  } finally {
    await worker.terminate();
  }
}
