import { describe, expect, it, vi } from "vitest";
import type { PickedFile } from "@capawesome/capacitor-file-picker";
import { isFilePickerCancellation, selectedBackupText } from "./backupFilePicker";

const file = (overrides: Partial<PickedFile>): PickedFile => ({
  mimeType: "application/octet-stream",
  name: "family.gesbackup",
  size: 12,
  ...overrides,
});

describe("Android backup file picker", () => {
  it("reads a browser-selected backup blob", async () => {
    await expect(selectedBackupText(file({ blob: new Blob(["backup-data"]) }))).resolves.toBe("backup-data");
  });

  it("reads an Android document-provider URI through its web path", async () => {
    const fetchFile = vi.fn().mockResolvedValue(new Response("drive-backup"));
    await expect(selectedBackupText(file({ webPath: "https://localhost/_capacitor_file_/drive-backup" }), fetchFile)).resolves.toBe("drive-backup");
    expect(fetchFile).toHaveBeenCalledWith("https://localhost/_capacitor_file_/drive-backup");
  });

  it("reports unreadable picker results and recognizes cancellation", async () => {
    await expect(selectedBackupText(file({}))).rejects.toThrow("לא ניתן לקרוא");
    expect(isFilePickerCancellation(new Error("User cancelled picking files"))).toBe(true);
    expect(isFilePickerCancellation(new Error("Read failed"))).toBe(false);
  });
});
