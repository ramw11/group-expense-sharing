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

export const findLikelyReceiptAmount = (text: string, totalLabelOnly = false): number | undefined => {
  const normalizedText = text.replace(/(\d)[.,]{2,}(?=\d)/g, "$1.");
  const amountPattern = /(?:₪|\$|€)?\s*(\d{1,3}(?:[ ,.']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
  const totalPattern = /total|amount\s*due|grand\s*total|לתשלום|סה[״"']?כ|סך\s*הכל/i;
  const lines = normalizedText.split(/\r?\n/);
  const totalLines = lines.map((line, index) => totalPattern.test(line) ? index : -1).filter((index) => index >= 0);
  const candidates: { amount: number; decimal: boolean; index: number; lineIndex: number }[] = [];

  for (const [lineIndex, line] of lines.entries()) {
    for (const match of line.matchAll(amountPattern)) {
      const amount = parseAmount(match[1]);
      const compact = match[1].replace(/\s/g, "");
      if (amount !== undefined) candidates.push({ amount, decimal: /[.,]\d{1,2}$/.test(compact), index: candidates.length, lineIndex });
    }
  }

  for (const totalLine of totalLines) {
    const sameLine = candidates.filter((candidate) => candidate.lineIndex === totalLine);
    if (sameLine.length) return sameLine.filter((candidate) => candidate.decimal).at(-1)?.amount ?? sameLine.at(-1)?.amount;
    const adjacent = candidates.filter((candidate) => Math.abs(candidate.lineIndex - totalLine) === 1 && candidate.decimal);
    if (adjacent.length) return adjacent.sort((a, b) => Number(b.lineIndex >= totalLine) - Number(a.lineIndex >= totalLine) || b.amount - a.amount)[0]?.amount;
  }
  if (totalLabelOnly) return undefined;

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
  let pass = 0;
  const worker = await createWorker("heb+eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress(Math.round(pass === 0 ? (message.progress ?? 0) * 55 : 55 + (message.progress ?? 0) * 45));
    },
  });
  try {
    const result = await worker.recognize(image);
    const labeledTotal = findLikelyReceiptAmount(result.data.text, true);
    if (labeledTotal !== undefined) return labeledTotal;

    pass = 1;
    await worker.setParameters({ tessedit_char_whitelist: "0123456789.,₪$€" });
    const numericResult = await worker.recognize(image);
    return findLikelyReceiptAmount(numericResult.data.text);
  } finally {
    await worker.terminate();
  }
}
