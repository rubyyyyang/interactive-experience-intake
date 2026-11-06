# Deployment Runbook

This runbook documents the approved release process for the Interactive Experience Intake Apps Script application.

## Design Decisions

- **GitHub `main` is the authoritative source of truth.** All code changes originate from local Git branches and go through reviewed PRs.
- **Apps Script is the runtime, not a separate source of truth.** Deployment happens by pushing approved code from `main` to Apps Script.
- **Team Testing and Production share the same Apps Script project and production data.** This is an accepted design decision. Writes to spreadsheets during Team Testing are real and permanent.
- **Human approval is required before updating Production.** The same tested version is promoted from Team Testing to Production after approval.
- **Existing deployment URLs are preserved.** Updates change the Apps Script version used by existing deployments, not the deployment URLs themselves.

## Release Process

### 1. Development

Start from current `origin/main` and create a feature branch:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Implement the smallest necessary change and run relevant tests:

```bash
npm test
```

For changes requiring runtime validation, push to the Apps Script development environment:

```bash
clasp push
```

Validate at the `/dev` deployment URL where appropriate.

### 2. Code Review and Merge

Review the diff locally:

```bash
git diff main
```

Open a PR against `main` and address review feedback.

After approval, merge the PR into `main`.

### 3. Pre-Deployment Verification

Synchronize local `main` with `origin/main`:

```bash
git checkout main
git pull origin main
```

Verify the working tree is clean:

```bash
git status
```

Check `.clasp.json` targets the intended Apps Script project:

```bash
cat .clasp.json
```

The `scriptId` should match the production Apps Script project: `13DEk6NBZ-BPZ9MFPoKH_V-4is6EWKKSgJnoQf3JoIZZR0Epulo4UihCE`

Ensure no other Claude session or developer is concurrently pushing to the same Apps Script project. Coordinate with the team if unsure.

### 4. Push to Apps Script

Run `clasp push` from the approved main commit:

```bash
clasp push
```

Verify success. The command should complete without errors and report the files pushed.

Validate HEAD at the `/dev` deployment URL where appropriate.

Record the Git commit SHA for the release:

```bash
git rev-parse HEAD
```

### 5. Create Immutable Apps Script Version

In the Apps Script editor:

1. Navigate to **Deployments** > **Manage deployments**
2. Click **Create deployment**
3. Select deployment type: **Web app**
4. Add a description with the Git commit SHA and a brief summary of changes
5. Set **Execute as**: Me
6. Set **Who has access**: Anyone within Red Hat
7. Click **Deploy**
8. Record the new version number

### 6. Update Team Testing Deployment

In the Apps Script editor:

1. Navigate to **Deployments** > **Manage deployments**
2. Find the existing **Team Testing** deployment
3. Click the edit icon (pencil)
4. Update **Version** to the newly created version
5. Click **Deploy**

Perform relevant smoke tests against the Team Testing deployment URL.

**IMPORTANT:** Team Testing shares production data. Any spreadsheet writes during testing are real and permanent. This is not a sandbox environment.

Test carefully and verify:

- Application loads without errors
- Core submission flow works as expected
- Status Tracker displays correctly
- No regressions in critical user paths

### 7. Update Production Deployment (After Human Approval)

After successful Team Testing validation and explicit human approval, update the Production deployment to the SAME tested version.

In the Apps Script editor:

1. Navigate to **Deployments** > **Manage deployments**
2. Find the existing **Production** deployment
3. Record the current production version number for rollback reference
4. Click the edit icon (pencil)
5. Update **Version** to the SAME version tested in Team Testing
6. Click **Deploy**

Perform a production smoke test to confirm the deployment succeeded.

### 8. Release Record

Document the release in a safe location (team wiki, release notes, or internal tracker):

- Git commit SHA
- Apps Script version number
- Team Testing deployment identifier
- Production deployment identifier
- Test results summary
- Previous production version (for rollback)
- Date and time of production update
- Human approver

## Rollback

If a production issue is discovered after deployment, rollback by editing the existing Production deployment to point to the previous working version.

In the Apps Script editor:

1. Navigate to **Deployments** > **Manage deployments**
2. Find the Production deployment
3. Click the edit icon (pencil)
4. Change **Version** back to the previous working version (from release record)
5. Click **Deploy**

**IMPORTANT:** Reverting the Apps Script code does NOT undo spreadsheet writes. If the issue caused data corruption, manual data reconciliation may be required.

After rollback:

- Notify the team
- Investigate the root cause
- Fix the issue in a new branch
- Follow the full release process for the fix

## Important Notes

### Concurrent Changes

`clasp push` updates the entire Apps Script project. Never include unmerged changes from other sessions or developers.

Before pushing:

- Verify your local `main` is synchronized with `origin/main`
- Confirm the working tree is clean
- Coordinate with other developers if multiple people are working on the project

### Deployment URL Preservation

Team Testing and Production deployments have stable URLs. Updating a deployment changes the version of code served at that URL, but the URL itself remains unchanged.

Do not create new deployments for routine releases. Update existing deployments.

### Data Safety

Team Testing and Production share the same spreadsheet data sources:

- `Request_Master`
- `Creator_Form_Raw`
- `YouTube_Responses`
- Analytics sheets
- Script Properties

Any writes during Team Testing testing are real and permanent.

Test carefully. Use read-only operations where possible during validation.

## Release Checklist

Use this checklist when performing a release:

- [ ] Local `main` synchronized with `origin/main`
- [ ] Working tree clean (`git status`)
- [ ] `.clasp.json` points to correct Apps Script project
- [ ] No concurrent `clasp push` from other sessions
- [ ] Git commit SHA recorded
- [ ] `clasp push` completed successfully
- [ ] New Apps Script version created with descriptive label
- [ ] Team Testing deployment updated to new version
- [ ] Team Testing smoke tests passed
- [ ] Previous production version recorded for rollback
- [ ] Human approval obtained
- [ ] Production deployment updated to SAME tested version
- [ ] Production smoke test passed
- [ ] Release documented with all identifiers and test results
