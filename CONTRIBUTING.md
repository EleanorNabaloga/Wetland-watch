# Contributing to Kuuma Obutonde: Citizen Reporting App

Thank you for contributing to Kuuma Obutonde. This project is open source and supports environmental monitoring and regulatory compliance in Uganda.

---

## 1. Code of Conduct
All participants, contributors, and deployers must adhere to professional, respectful, and ethical standards. Any attempt to abuse the platform, harass whistleblowers, evade environmental laws, or tamper with evidence records is strictly prohibited.

---

## 2. Branch Workflow, Safeguards, and Pull Requests
To maintain production stability and data integrity, direct commits or pushes to `main` and `staging` are strictly prohibited and blocked by repository safeguards.

### Contributor and Merge Safeguards
- Only designated internal maintainers (@EleanorNabaloga and @MarkDanielsMCraft) and their authorized environments have permission to merge pull requests.
- All contributions must originate on a feature or fix branch and target `dev` through a Pull Request.
- External contributions and unverified environments are automatically blocked by the automated Merge Guard until reviewed, verified, and approved by an authorized internal maintainer.
- Changes promote through the strict branch hierarchy: feature branch to `dev` to `staging` to `main`. Direct pull requests to `staging` or `main` from external forks are automatically rejected.

### Local Development Flow
1. Create a feature or fix branch from `dev`:
   `git checkout -b feat/your-feature-name` or `git checkout -b fix/your-bug-fix`
2. Install dependencies (which automatically configures local pre-push safeguards):
   `npm ci`
3. Implement focused, minimal changes with comprehensive tests.
4. Verify local tests and builds before opening a Pull Request:
   `npm test`
   `npm run build`
5. Open a Pull Request targeting `dev` for review and verification.

---

## 3. Local Development and Verification
Prerequisites: Node.js 20 or newer.

```bash
# 1. Install locked dependencies and configure git safeguards
npm ci

# 2. Run the test suite (100 percent pass required)
npm test

# 3. Verify production build
npm run build
```

---

## 4. Engineering and Quality Standards
- **Whistleblower Privacy**: Citizen reports must redact contact details and truncate coordinate precision before sending to storage or logs.
- **Multilingual Support**: Citizen facing strings must maintain clean English and Luganda localizations without machine translation artifacts.
- **Structured Error Handling**: Unexpected errors report structured messages without logging user personally identifiable information.
