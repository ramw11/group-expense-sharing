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
  const normalizedText = text.replace(/(\d)[.,]{2,}(?=\d)/g, "$1.");
  const amountPattern = /(?:₪|\$|€)?\s*(\d{1,3}(?:[ ,.']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
  const totalPattern = /total|amount\s*due|grand\s*total|לתשלום|סה[״"']?כ|סך\s*הכל/i;
  const candidates: { amount: number; priority: number; decimal: boolean; index: number }[] = [];

  for (const line of normalizedText.split(/\r?\n/)) {
    const priority = totalPattern.test(line) ? 2 : 1;
    for (const match of line.matchAll(amountPattern)) {
      const amount = parseAmount(match[1]);
      const compact = match[1].replace(/\s/g, "");
      if (amount !== undefined) candidates.push({ amount, priority, decimal: /[.,]\d{1,2}$/.test(compact), index: candidates.length });
    }
  }

  const preferred = candidates.filter((candidate) => candidate.priority === 2);
  if (preferred.length) return preferred.filter((candidate) => candidate.decimal).at(-1)?.amount ?? preferred.at(-1)?.amount;

  const decimalCandidates = candidates.filter((candidate) => candidate.decimal);
  if (!decimalCandidates.length) return undefined;
  const support = new Map<number, number>();
  for (const candidate of candidates) support.set(candidate.amount, (support.get(candidate.amount) ?? 0) + 1);
  return decimalCandidates.sort((a, b) => {
    const supportDifference = (support.get(b.amount) ?? 0) - (support.get(a.amount) ?? 0);
    return supportDifference || b.amount - a.amount || b.index - a.index;
  })[0]?.amount;
};

export async function recognizeReceiptAmount(image: string | File, onProgress: (progress: number) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress(Math.round((message.progress ?? 0) * 100));
    },
  });
  try {
    await worker.setParameters({ tessedit_char_whitelist: "0123456789.,₪$€" });
    const result = await worker.recognize(image);
    return findLikelyReceiptAmount(result.data.text);
  } finally {
    await worker.terminate();
  }
}
