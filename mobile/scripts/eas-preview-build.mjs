import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const homeDir = path.join(projectRoot, ".tmp-home");
const expoHome = path.join(projectRoot, ".expo-home");
const xdgConfigHome = path.join(homeDir, ".config");
const xdgCacheHome = path.join(homeDir, ".cache");

for (const dir of [homeDir, expoHome, xdgConfigHome, xdgCacheHome]) {
  fs.mkdirSync(dir, { recursive: true });
}

const env = {
  ...process.env,
  HOME: homeDir,
  EXPO_HOME: expoHome,
  XDG_CONFIG_HOME: xdgConfigHome,
  XDG_CACHE_HOME: xdgCacheHome,
};

const child = spawn("eas", ["build", "-p", "android", "--profile", "preview"], {
  cwd: projectRoot,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

child.on("error", (error) => {
  console.error(`Failed to launch eas CLI: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
