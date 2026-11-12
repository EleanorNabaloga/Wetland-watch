# Repository Safeguards and Branch Protection Guide

This guide details the repository blockers and branch protection settings that guarantee only authorized internal contributors and their designated environments can merge pull requests.

## 1. Automated Repository Safeguards in Code

The codebase enforces multi-layered automated blockers:

1. Code Owners Policy (.github/CODEOWNERS):
   All files and directories require explicit review and approval from internal maintainers: @EleanorNabaloga or @MarkDanielsMCraft. External reviews cannot satisfy this policy.

2. Merge Guard Workflow (.github/workflows/merge-guard.yml):
   Runs on pull request creation, update, and review submission:
   - External Fork Blocker: Pull requests from external forks cannot target staging or main.
   - Branch Promotion Hierarchy: Only staging can merge into main, and only dev can merge into staging. Feature branches must target dev.
   - Contributor Authorization Gate: Pull requests authored by external contributors or automated systems are automatically blocked until an authorized internal maintainer (@EleanorNabaloga or @MarkDanielsMCraft) submits an approved review.
   - Environment Authorization Gate: Pull requests targeting dev, staging, or main require passing the corresponding GitHub environment gate (development, staging, production).

3. Local Git Safeguards (.githooks/pre-push):
   Configured automatically upon dependency installation (npm run prepare). Rejects any direct push attempt from local environments to main or staging.

4. Continuous Integration and Security Scanning (.github/workflows/ci.yml):
   Requires all test suites, linters, and CodeQL security scans to pass with zero errors.

## 2. GitHub Web Settings for Repository Owners

Repository administrators (EleanorNabaloga) must configure the following repository settings on GitHub to enforce these blockers at the platform level:

### A. Branch Protection Rules (Settings > Branches)

Create protection rules for main, staging, and dev:

#### For main (Production):
1. Require a pull request before merging:
   - Require approvals: minimum 1.
   - Require review from Code Owners: enabled.
   - Dismiss stale pull request approvals when new commits are pushed: enabled.
2. Require status checks to pass before merging:
   - Require branches to be up to date before merging: enabled.
   - Required status checks:
     - Verify Contributor and Branch Promotion (verify-authorization)
     - Verify Environment Authorization Gate (verify-environment-authorization)
     - validate
     - sast
3. Restrict who can push to matching branches:
   - Only authorized internal contributors: EleanorNabaloga and MarkDanielsMCraft.
4. Enforce restrictions for administrators:
   - Do not allow bypassing the above settings: enabled.

#### For staging (Pre-production):
- Apply identical rules as main, with target branch hierarchy restricted to dev.

#### For dev (Integration):
- Require pull request review from Code Owners before any merge.
- Require all status checks to pass.

### B. Environment Protection Rules (Settings > Environments)

Create the following environments:
1. production (linked to branch: main)
2. staging (linked to branch: staging)
3. development (linked to branch: dev)

For each environment:
- Check: Required reviewers.
- Add reviewers: @EleanorNabaloga and @MarkDanielsMCraft.
- Only when an authorized reviewer approves the environment execution can the environment gate pass, ensuring external contributors and unapproved environments cannot trigger a merge.

---

## 3. Strict Promotion Invariant (All Green to Promote)

From `dev` to `staging`, all status checks must show green / pass, or else moving to `staging` is strictly blocked. The identical requirement applies from `staging` to `main`: all status checks must show green / pass, or else merging into `main` is strictly blocked.

### Mandatory Status Checks Required to Merge:
1. `validate` (Lint, Test and Build): Automated unit tests must pass 100 percent and production Turbopack build must compile with zero errors.
2. `sast` (CodeQL Security Scan): Static analysis must confirm zero high or critical security vulnerabilities.
3. `verify-authorization` (Merge Guard): Validates branch promotion hierarchy, fork isolation, and verifies zero failing check runs on the commit.
4. `verify-environment-authorization` (Environment Authorization Gate): Requires manual approval from designated internal maintainers for the target environment.
5. `lint-pr-title` (Pull Request Title Linter): Validates conventional commit title formatting.

If any check is failing, timed out, or pending, GitHub branch protection rules and the automated Merge Guard immediately lock the pull request and block the merge.

