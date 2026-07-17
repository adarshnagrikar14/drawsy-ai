# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include exploit details in a pull request.

Use [GitHub's private vulnerability reporting](https://github.com/adarshnagrikar14/drawsy-ai/security/advisories/new) and include:

- the affected route, component, or workflow;
- reproduction steps and impact;
- the environment where it was observed; and
- a suggested mitigation, if available.

Reports will be acknowledged as soon as possible, triaged privately, and disclosed only after a fix or mitigation is ready.

## Scope

This repository contains the Drawsy browser client. Reports may involve authentication boundaries, collaboration, remote assets, connector handoffs, canvas context, live-preview isolation, or accidental data exposure. Supporting services are maintained in separate repositories; a report may be transferred privately to the relevant service owner.

## Safe configuration

- Treat every `VITE_*` value as public: Vite embeds it into browser assets.
- Never place OAuth client secrets, refresh tokens, signing keys, private keys, cloud credentials, or service-account JSON in frontend environment files.
- Keep secret-bearing overrides in ignored local files or the deployment secret store.
- Do not commit real user canvas data, connector payloads, generated workspace files, or screenshots containing tokens.
- Allow live-preview origins deliberately; do not weaken origin checks to work around an integration failure.

## Supported version

Security fixes target the current `master` branch and the hosted version of Drawsy. Historical commits and unsupported personal deployments may not receive fixes.
