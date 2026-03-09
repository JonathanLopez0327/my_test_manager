import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORED_PATH_PARTS = ["/src/generated/", "\\src\\generated\\", ".test.", ".spec."];

const spanishCharPattern = /[áéíóúñ¿¡]/i;
const spanishWordPattern =
  /\b(organizacion|organizaci[oó]n|usuario|usuarios|miembro|miembros|proyecto|proyectos|guardar|cancelar|eliminar|editar|crear|actualizar|invalido|inv[aá]lido|cargando|error al|no se pudo|no tienes|selecciona|debe ser)\b/i;

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
    const normalized = fullPath.replaceAll("\\", "/");
    if (IGNORED_PATH_PARTS.some((part) => normalized.includes(part))) continue;
    files.push(fullPath);
  }
  return files;
}

const offenders = [];
for (const file of collectFiles(ROOT)) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (spanishCharPattern.test(line) || spanishWordPattern.test(line)) {
      offenders.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (offenders.length > 0) {
  console.error("Found potential non-English UI/API strings:");
  offenders.slice(0, 120).forEach((entry) => console.error(`- ${entry}`));
  if (offenders.length > 120) {
    console.error(`...and ${offenders.length - 120} more`);
  }
  process.exit(1);
}

console.log("English string check passed.");
