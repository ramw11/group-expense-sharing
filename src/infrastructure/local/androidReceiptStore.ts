import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { ReceiptFileStore } from "../../application/ports";

const parseDataUrl = (dataUrl: string) => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("פורמט הקבלה אינו נתמך");
  const extension = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
  return { base64: match[2], extension };
};

export class AndroidReceiptStore implements ReceiptFileStore {
  async persist(dataUrl: string, expenseId: string) {
    const { base64, extension } = parseDataUrl(dataUrl);
    const path = `receipts/${expenseId}.${extension}`;
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Data, recursive: true });
    return path;
  }

  async publicUrl(path: string) {
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri);
  }

  async read(path: string) {
    const result = await Filesystem.readFile({ path, directory: Directory.Data });
    if (typeof result.data !== "string") throw new Error("לא ניתן לקרוא את הקבלה");
    const extension = path.split(".").pop()?.toLowerCase();
    const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${result.data}`;
  }

  async remove(path: string) {
    await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => undefined);
  }
}
