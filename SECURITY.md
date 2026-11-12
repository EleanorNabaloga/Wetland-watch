# Security Policy

## 1. Supported Versions

Security updates are actively maintained on the latest code on the default branch:

| Version | Supported |
| :--- | :--- |
| main (latest) | Yes |
| older commits | No |

---

## 2. Reporting Security Issues

Kuuma Obutonde citizen reporting directly involves whistleblower safety and environmental protection.

If you discover a vulnerability:
1. Do not file public GitHub issues for security flaws.
2. Submit details privately to project maintainers including step-by-step reproduction.
3. Allow the team reasonable time to validate and release a patch before disclosing details publicly.

---

## 3. Whistleblower Protection and Abuse Prevention

### 3.1 Anonymous Evidence Architecture
- Citizens do not create accounts or sign in.
- Reports are signed directly on device via non-extractable Web Crypto keys (ECDSA P-256).
- The server recalculates and verifies the signature over image bytes and capture metadata to prevent tampering in transit.
- Report status and rewards are accessed strictly via private random tokens stored on device; the server stores only the SHA-256 hash of the token.

### 3.2 Anti-Abuse Defenses
- Rate limiting enforces a strict threshold (30 reports per hour per IP) tracked in the database.
- Perceptual difference hashing (`sharp` dHash) rejects identical photos, flags duplicate uploads from different locations, and groups nearby photos into a shared case.
- Payout numbers are encrypted with AES-256-GCM in `identity_vault` completely separated from report rows.

### 3.3 Security Rules for Self-Hosters and Cloners
- Never commit `.env.local` to source control.
- Protect `PHONE_ENCRYPTION_KEY` (64 hex characters). Losing this key makes stored payout numbers permanently unrecoverable.
- Run migrations in strict date order as documented in the README.
