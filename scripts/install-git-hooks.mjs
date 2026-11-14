import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const hookPath = path.join(rootDir, ".githooks", "pre-push");

try {
  if (fs.existsSync(hookPath)) {
    fs.chmodSync(hookPath, 0o755);
  }

  execSync("git config core.hooksPath .githooks", {
    cwd: rootDir,
    stdio: "pipe",
  });
  console.log("Local git repository safeguards configured (.githooks).");
} catch (error) {
  // If not in a git working tree (such as in Docker or CI), ignore silently
  if (!error.message.includes("not a git repository")) {
    console.warn("Notice: Git hook configuration skipped (non-git environment).");
  }
}
