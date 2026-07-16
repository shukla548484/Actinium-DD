import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const androidDir = path.join(projectRoot, "android");
const localPropertiesPath = path.join(androidDir, "local.properties");

function readLocalPropertiesSdkDir() {
  if (!fs.existsSync(localPropertiesPath)) return null;
  const contents = fs.readFileSync(localPropertiesPath, "utf8");
  const match = contents.match(/^\s*sdk\.dir\s*=\s*(.+)\s*$/m);
  return match?.[1]?.trim() ?? null;
}

const configuredSdkDir =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  readLocalPropertiesSdkDir();

if (!configuredSdkDir) {
  console.error(
    [
      "Android SDK not configured.",
      "Set ANDROID_HOME or ANDROID_SDK_ROOT,",
      "or create mobile/android/local.properties with:",
      "sdk.dir=/Users/your-user/Library/Android/sdk",
    ].join("\n"),
  );
  process.exit(1);
}

const expandedSdkDir = configuredSdkDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || "");

if (!fs.existsSync(expandedSdkDir)) {
  console.error(
    [
      `Android SDK directory does not exist: ${expandedSdkDir}`,
      "Update ANDROID_HOME / ANDROID_SDK_ROOT,",
      "or fix mobile/android/local.properties so sdk.dir points to an installed Android SDK.",
      "On macOS the usual path is: ~/Library/Android/sdk",
      "If Android Studio is not installed yet, install it first and add the SDK components.",
    ].join("\n"),
  );
  process.exit(1);
}

const env = {
  ...process.env,
  ANDROID_HOME: process.env.ANDROID_HOME || expandedSdkDir,
  ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || expandedSdkDir,
  GRADLE_USER_HOME: path.join(projectRoot, ".gradle-home"),
  JAVA_TOOL_OPTIONS: [
    process.env.JAVA_TOOL_OPTIONS,
    `-Dkotlin.user.home=${path.join(projectRoot, ".kotlin")}`,
  ]
    .filter(Boolean)
    .join(" "),
};

const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const child = spawn(gradlew, ["assembleDebug"], {
  cwd: androidDir,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
