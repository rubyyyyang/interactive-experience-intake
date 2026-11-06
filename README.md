# Interactive Experience Intake

The Interactive Experience Intake is the creator-facing Google Apps Script application for submitting and tracking Interactive Experience content.

It works together with the [Interactive Experience Hub](https://github.com/rubyyyyyang/interactive-experience-hub), which handles downstream lifecycle management, notifications, search and discovery, and supporting data workflows.

## What the Intake app owns

The Intake app currently supports:

- creator submissions
- Interactive Demo and Video Demo intake routing
- AI-assisted metadata drafting and classification (Primary Topic + Topic for Interactive Demo, excluded for Video Demo)
- creator and admin review experiences
- Action Status processing
- creator-facing Status Tracker
- initial repository writes and downstream handoff to the Hub

Interactive Experience is the overall content program. Interactive Demo and Video Demo are individual content types supported by the workflow.

## Development

Install dependencies:

```bash
npm install
```

Run local deterministic tests:

```bash
npm test
```

Authenticated browser smoke tests use each developer's own Red Hat account.

One-time authentication setup:

```bash
npm run test:auth-setup
```

Run smoke tests:

```bash
npm run test:smoke
```

Local authentication state is excluded from Git.

## Deployment

**GitHub `main` is the source of truth.** All code changes go through reviewed PRs before merging to `main`.

Google Apps Script is the runtime and deployment environment. After changes are merged to `main`, approved commits are deployed to Apps Script using `clasp push`, and production releases are performed by updating the existing Team Testing and Production deployments to new immutable Apps Script versions.

See [Deployment Runbook](docs/deployment-runbook.md) for the complete release process, including:

- Development workflow and testing
- Apps Script version creation
- Team Testing validation (shares production data)
- Production deployment approval and rollback procedures

`.clasp.json` is kept local and maps the repository to the corresponding Apps Script project.

## Documentation

Intake-specific documentation:

- [User Guide](docs/user-guide.md) — Creator-facing Intake workflow, submission, review, and status tracking
- [Guide Extraction JSON](docs/guide-extraction-json-usage.md) — Technical reference for guide extraction JSON structure and behavior
- [Status Tracker Lifecycle](docs/status-tracker-lifecycle.md) — Internal workflow documentation for Status Tracker lifecycle response system

Broader system documentation is maintained in the Interactive Experience Hub repository:

- [Architecture](https://github.com/rubyyyyang/interactive-experience-hub/blob/main/docs/architecture.md) — How Intake and Hub connect, data flows, and major workflows
- [Runbook](https://github.com/rubyyyyang/interactive-experience-hub/blob/main/docs/runbook.md) — Testing, deployment, triggers, and troubleshooting
- 
## Internal Resources

- [Google Apps Script project](https://script.google.com/home/projects/13DEk6NBZ-BPZ9MFPoKH_V-4is6EWKKSgJnoQf3JoIZZR0Epulo4UihCE/edit)
- [Production Intake app](https://script.google.com/a/macros/redhat.com/s/AKfycby41BSoZbpLqdkdRG5B5hvdr7-c1KT-TaCw9_WV3_Q0ag13oe_CjHt-JUIDeHzdSTAg/exec)
- [Interactive Experience Status Tracker](https://script.google.com/a/redhat.com/macros/s/AKfycby41BSoZbpLqdkdRG5B5hvdr7-c1KT-TaCw9_WV3_Q0ag13oe_CjHt-JUIDeHzdSTAg/exec?page=status)
- [Tracking Analytics spreadsheet](https://docs.google.com/spreadsheets/d/1Krzrseza6KaejdsD3bFD7lVcNuLUSm3FCe-oOJLUhI4/edit?gid=1424090944#gid=1424090944)



