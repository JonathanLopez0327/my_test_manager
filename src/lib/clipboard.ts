export function renameClipboardFile(file: File): File {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .slice(0, 19);
  const ext = file.type.split("/")[1] || "png";
  return new File([file], `clipboard-${timestamp}.${ext}`, { type: file.type });
}
