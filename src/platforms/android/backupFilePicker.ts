import { FilePicker, type PickedFile } from "@capawesome/capacitor-file-picker";

type FetchFile = (input: RequestInfo | URL) => Promise<Response>;

export const selectedBackupText = async (file: PickedFile, fetchFile: FetchFile = fetch): Promise<string> => {
  if (file.blob) return file.blob.text();
  if (!file.webPath) throw new Error("לא ניתן לקרוא את קובץ הגיבוי שנבחר");
  const response = await fetchFile(file.webPath);
  if (!response.ok) throw new Error("קריאת קובץ הגיבוי נכשלה");
  return response.text();
};

export const pickBackupText = async (): Promise<string | undefined> => {
  const { files } = await FilePicker.pickFiles({
    types: ["application/json", "application/octet-stream"],
    limit: 1,
  });
  const file = files[0];
  return file ? selectedBackupText(file) : undefined;
};

export const isFilePickerCancellation = (reason: unknown): boolean => {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return /cancel|dismiss|user cancelled/i.test(message);
};
