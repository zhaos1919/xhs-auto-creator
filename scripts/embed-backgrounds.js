"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ASSET_DIR = path.join(ROOT, "assets");
const OUTPUT_FILE = path.join(ROOT, "embedded-backgrounds.js");
const SUPPORTED = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

if (!fs.existsSync(ASSET_DIR)) {
  console.error("未找到 assets 目录：", ASSET_DIR);
  process.exit(1);
}

function walk(dir) {
  const list = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function fileToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const bytes = fs.readFileSync(filePath);
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : "image/svg+xml";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function parseName(baseName) {
  const normalized = baseName.toLowerCase().replace(/\s+/g, "-");
  const match = normalized.match(/^([a-z0-9]+)[-_.]([a-z0-9_-]+)$/);
  if (!match) {
    return null;
  }
  return { style: match[1], slot: match[2] };
}

const files = walk(ASSET_DIR).filter((filePath) => SUPPORTED.has(path.extname(filePath).toLowerCase()));

if (files.length === 0) {
  console.error("assets 目录中没有可处理的图片文件。");
  process.exit(1);
}

const payload = {};
let accepted = 0;

for (const filePath of files) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const parsed = parseName(baseName);
  if (!parsed) {
    console.warn("跳过文件（命名不符合 <style>-<slot>.*）：", path.relative(ROOT, filePath));
    continue;
  }

  if (!payload[parsed.style]) {
    payload[parsed.style] = { pages: {} };
  }

  const dataUri = fileToDataUri(filePath);
  if (parsed.slot === "cover") {
    payload[parsed.style].cover = dataUri;
  } else {
    payload[parsed.style].pages[parsed.slot] = dataUri;
  }
  accepted += 1;
}

const output =
  "(function initEmbeddedBackgrounds(globalScope) {\n" +
  "  \"use strict\";\n" +
  "  globalScope.XHS_EMBEDDED_BACKGROUNDS = " +
  JSON.stringify(payload, null, 2) +
  ";\n" +
  "})(typeof window !== \"undefined\" ? window : globalThis);\n";

fs.writeFileSync(OUTPUT_FILE, output, "utf8");
console.log(`已写入 ${OUTPUT_FILE}，共处理 ${accepted} 个底图。`);
