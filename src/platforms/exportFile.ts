import { Capacitor } from "@capacitor/core";

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error("File conversion failed"));
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.readAsDataURL(blob);
});

export const exportBlob = async (blob: Blob, fileName: string, title: string) => {
  if (Capacitor.isNativePlatform()) {
    const [{ Directory, Filesystem }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const result = await Filesystem.writeFile({ path: `exports/${fileName}`, data: await blobToBase64(blob), directory: Directory.Cache, recursive: true });
    await Share.share({ title, files: [result.uri], dialogTitle: title });
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportDataUrl = async (dataUrl: string, fileName: string, title: string) => {
  const response = await fetch(dataUrl);
  await exportBlob(await response.blob(), fileName, title);
};
