#!/usr/bin/env node
/**
 * Copy Tauri build artifacts + setup scripts into local-apps/mac and local-apps/windows.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const desktopBundle = path.join(root, "desktop", "src-tauri", "target", "release", "bundle");

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  copied ${path.basename(src)} → ${path.relative(root, dest)}`);
  return true;
}

function copyDirFiles(srcDir, destDir, filter) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir)) {
    if (filter && !filter(f)) continue;
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
    console.log(`  copied ${f}`);
  }
}

console.log("=== Packaging local-apps ===");

const macDir = path.join(root, "local-apps", "mac");
const winDir = path.join(root, "local-apps", "windows");

// Static assets (always refresh from templates)
for (const [src, dest] of [
  ["local-apps/mac/setup-postgres-mac.sh", "local-apps/mac/setup-postgres-mac.sh"],
  ["local-apps/mac/fleet.local.env.example", "local-apps/mac/fleet.local.env.example"],
  ["local-apps/mac/README-INSTALL.md", "local-apps/mac/README-INSTALL.md"],
  ["local-apps/mac/start-actinium-dd.command", "local-apps/mac/start-actinium-dd.command"],
  ["local-apps/windows/setup-postgres-windows.ps1", "local-apps/windows/setup-postgres-windows.ps1"],
  ["local-apps/windows/fleet.local.env.example", "local-apps/windows/fleet.local.env.example"],
  ["local-apps/windows/README-INSTALL.md", "local-apps/windows/README-INSTALL.md"],
  ["local-apps/windows/start-actinium-dd.bat", "local-apps/windows/start-actinium-dd.bat"],
]) {
  // templates live in place — skip self-copy
}

// Mac .dmg
const dmgDir = path.join(desktopBundle, "dmg");
if (fs.existsSync(dmgDir)) {
  const dmg = fs.readdirSync(dmgDir).find((f) => f.endsWith(".dmg"));
  if (dmg) copyFile(path.join(dmgDir, dmg), path.join(macDir, dmg));
}

// Mac .app
const macosDir = path.join(desktopBundle, "macos");
if (fs.existsSync(macosDir)) {
  copyDirFiles(macosDir, macDir, (f) => f.endsWith(".app"));
}

// Windows MSI / NSIS
const msiDir = path.join(desktopBundle, "msi");
if (fs.existsSync(msiDir)) {
  copyDirFiles(msiDir, winDir, (f) => f.endsWith(".msi"));
}
const nsisDir = path.join(desktopBundle, "nsis");
if (fs.existsSync(nsisDir)) {
  copyDirFiles(nsisDir, winDir, (f) => f.endsWith(".exe"));
}

console.log("Done. Distribute local-apps/mac/ or local-apps/windows/ to users.");
