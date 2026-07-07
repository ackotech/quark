<!--
  Licensed under the MIT License. See LICENSE for details.
-->

# Security Policy

The Quark project takes security seriously. This document describes how to
report vulnerabilities, what is in scope, and the security model that governs
the codebase.

## Supported Versions

Security fixes are applied to the latest release on the `main` branch. Older
tags and forks are not actively supported unless explicitly noted in a release
announcement.

| Version | Supported |
| ------- | --------- |
| latest on `main` | yes |
| older tags | no |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately. **Do not
open a public GitHub issue** for security-sensitive findings.

### Preferred: GitHub Private Security Advisory

1. Go to [Security Advisories](https://github.com/ackotech/quark/security/advisories) for this repository.
2. Click **Report a vulnerability**.
3. Include a clear description, reproduction steps, affected components, and
   any proof-of-concept you can share safely.

### Alternative: Email

If you cannot use GitHub advisories, contact the maintainers at
**security@acko.tech** with the subject line `Quark Security Report`.

### Submission Standards

- Reports must be in **plain text** (Markdown is fine). Do not send PDFs,
  Word documents, or password-protected archives.
- Include a **human-verified proof of concept** that demonstrates the issue
  on a supported release.
- **AI/LLM disclosure**: if you used AI or LLM tools in discovering or
  writing the report, you must disclose this. Reports generated entirely by
  automated tools without human verification will not be accepted.

### What to Include

- Affected package or file path (e.g., `@quark-hq/quark`, `@quark-hq/quark-scripts`)
- Version or commit hash
- Steps to reproduce
- Impact assessment (confidentiality, integrity, availability)
- Environment details (OS, Node.js version, pnpm version)
- Suggested remediation, if available

### Response Timeline

| Stage | Target |
| ----- | ------ |
| Initial acknowledgment | 3 business days |
| Triage and severity assessment | 10 business days |
| Fix or mitigation plan | depends on severity |

We will coordinate disclosure with you and publish a security advisory once a
fix is available.

## Security Model

### Trust Boundaries

The Quark toolset operates within three trust boundaries:

1. **Developer machine (full trust)**: the CLI runs with the permissions of
   the invoking user. Commands like `quark create` and `quark publish`
   scaffold files and execute child processes on the developer's machine.
   The developer is responsible for reviewing generated output.

2. **Registry and CI/CD (operator trust)**: registry credentials, CI
   workflow templates, and environment variables are configured by the
   operator (the team that sets up the monorepo). These are outside the
   scope of Quark's runtime enforcement but Quark must never leak or
   mishandle them.

3. **Quark codebase (enforced boundaries)**: `@quark-hq/quark-security`
   enforces path confinement and safe process spawning. All filesystem and
   subprocess operations in CLI code must go through these helpers.

### Roles and Capabilities

| Principal | Scaffold | Publish (Yalc) | Release (registry) | Atlas UI |
| --------- | -------- | --------------- | ------------------- | -------- |
| Developer (CLI user) | yes | yes | via scripts only | read |
| CI/CD pipeline | no | no | yes (with credentials) | n/a |
| Atlas end user | no | no | no | read |

### Vulnerability Scope

**In scope** — reports demonstrating any of the following are welcome:

- Path traversal or escape from workspace confinement in CLI commands
- Command injection via package names, template variables, or user input
- Credential leakage in logs, generated files, or error output
- Unsafe deserialization or prototype pollution in config parsing
- Cross-site scripting (XSS) or server-side request forgery (SSRF) in Atlas
- Authentication or authorization bypass in Atlas API routes
- Bypass of `@quark-hq/quark-security` validation or spawn safety checks

**Out of scope**:

- Vulnerabilities in third-party dependencies already fixed upstream (report
  to the upstream project; we bump dependencies separately)
- Issues that require physical access to a developer machine
- Social engineering or phishing against maintainers
- Denial-of-service attacks against local CLI tools
- Reports without a proof of concept or reproduction steps
- Findings produced entirely by automated scanners without human verification
- Security issues in downstream projects created with `quark create` that
  arise from the consumer's own code, not from Quark-generated templates

## Secure Development

This repository uses static analysis (Bearer) and path/spawn safety checks in
`@quark-hq/quark-security`. Security-related changes should include tests and
must not weaken existing validation without explicit review.

Contributors should:

- Never bypass `@quark-hq/quark-security` helpers for filesystem or process
  operations in CLI code
- Never commit registry tokens, `.npmrc` credentials, or `.env` secrets
- Use parameterized inputs for shell commands — never interpolate user input
  directly into command strings
- Sanitize all user-provided values (package names, paths, template
  variables) before use in file operations or process spawning
