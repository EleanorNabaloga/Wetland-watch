import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function collectMarkdownFiles(dir) {
  const files = [];
  for (const item of fs.readdirSync(dir)) {
    if (item === "node_modules" || item === ".next" || item === ".git") continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (item.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

test("documentation links integrity: all internal markdown links must resolve to existing files", () => {
  const mdFiles = collectMarkdownFiles(REPO_ROOT);
  assert.ok(mdFiles.length > 5, "Expected to find markdown files in repository");

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const brokenLinks = [];

  for (const file of mdFiles) {
    const relativeFilePath = path.relative(REPO_ROOT, file);
    const content = fs.readFileSync(file, "utf8");
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[2].trim();
      if (
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("mailto:") ||
        target.startsWith("#")
      ) {
        continue;
      }

      const cleanTarget = target.split("#")[0];
      if (!cleanTarget) continue;

      const resolved = path.resolve(path.dirname(file), cleanTarget);
      if (!fs.existsSync(resolved)) {
        brokenLinks.push({
          source: relativeFilePath,
          linkText: match[1],
          target,
          resolvedTarget: path.relative(REPO_ROOT, resolved)
        });
      }
    }
  }

  assert.deepEqual(
    brokenLinks,
    [],
    `Found broken internal documentation links:\n${JSON.stringify(brokenLinks, null, 2)}`
  );
});

test("environment variable parity: core deployment variables must be declared in .env.example and documented", () => {
  const envExamplePath = path.join(REPO_ROOT, ".env.example");
  assert.ok(fs.existsSync(envExamplePath), ".env.example file must exist");

  const envExampleContent = fs.readFileSync(envExamplePath, "utf8");
  const envKeysInExample = new Set();
  for (const line of envExampleContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const key = trimmed.split("=")[0].trim();
    if (key) envKeysInExample.add(key);
  }

  const requiredProductionKeys = ["DATABASE_URL", "PHONE_ENCRYPTION_KEY"];
  for (const key of requiredProductionKeys) {
    assert.ok(
      envKeysInExample.has(key),
      `Core production environment variable ${key} must be declared in .env.example`
    );
  }

  // Check documentation coverage in README.md or docs/HANDOFF.md
  const readmeContent = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
  const handoffContent = fs.existsSync(path.join(REPO_ROOT, "docs", "HANDOFF.md"))
    ? fs.readFileSync(path.join(REPO_ROOT, "docs", "HANDOFF.md"), "utf8")
    : "";
  const combinedDocs = `${readmeContent}\n${handoffContent}`;

  const undocumentedKeys = [];
  for (const key of envKeysInExample) {
    if (!combinedDocs.includes(key)) {
      undocumentedKeys.push(key);
    }
  }

  assert.deepEqual(
    undocumentedKeys,
    [],
    `.env.example declares variables not documented in README.md or docs/HANDOFF.md: ${undocumentedKeys.join(", ")}`
  );
});

test("npm scripts synchronization: docs must only reference valid scripts defined in package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const validScripts = new Set(Object.keys(pkg.scripts || {}));
  validScripts.add("test"); // standard npm test

  const docsToCheck = [
    path.join(REPO_ROOT, "README.md"),
    path.join(REPO_ROOT, "CONTRIBUTING.md")
  ];

  const npmRunRegex = /npm run ([a-zA-Z0-9:_-]+)/g;
  const invalidReferences = [];

  for (const docPath of docsToCheck) {
    if (!fs.existsSync(docPath)) continue;
    const content = fs.readFileSync(docPath, "utf8");
    let match;
    while ((match = npmRunRegex.exec(content)) !== null) {
      const scriptName = match[1];
      if (!validScripts.has(scriptName)) {
        invalidReferences.push({
          doc: path.relative(REPO_ROOT, docPath),
          referencedScript: scriptName
        });
      }
    }
  }

  assert.deepEqual(
    invalidReferences,
    [],
    `Documentation references npm scripts not defined in package.json: ${JSON.stringify(invalidReferences, null, 2)}`
  );
});

test("issue and pull request templates synchronization: required templates must exist and be valid", () => {
  const templateDir = path.join(REPO_ROOT, ".github", "ISSUE_TEMPLATE");
  assert.ok(fs.existsSync(templateDir), ".github/ISSUE_TEMPLATE directory must exist");

  const requiredTemplates = [
    "bug_report.md",
    "feature_request.md",
    "docs_improvement.md",
    "config.yml"
  ];

  for (const template of requiredTemplates) {
    const full = path.join(templateDir, template);
    assert.ok(fs.existsSync(full), `Required template .github/ISSUE_TEMPLATE/${template} must exist`);
    const content = fs.readFileSync(full, "utf8");
    assert.ok(content.length > 20, `Template ${template} must not be empty`);
  }

  const prTemplatePath = path.join(REPO_ROOT, ".github", "PULL_REQUEST_TEMPLATE.md");
  assert.ok(fs.existsSync(prTemplatePath), ".github/PULL_REQUEST_TEMPLATE.md must exist");
  const prTemplateContent = fs.readFileSync(prTemplatePath, "utf8");
  assert.ok(
    prTemplateContent.includes("## Verification and Testing") &&
      prTemplateContent.includes("## Documentation Synchronization Checklist"),
    "PR template must include verification and documentation checklists"
  );
});
