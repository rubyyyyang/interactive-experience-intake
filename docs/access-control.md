# Access Control and Revalidation Plan

**Application:** Arcade Intake Assistant  
**Deployment:** Google Apps Script Web App  
**Last Updated:** 2026-08-31

---

## Current Access Control Mechanism

### Application-Level Access

The Arcade Intake Assistant is deployed as a Google Apps Script web app with the following access configuration:

**Apps Script Deployment Settings:**
- **Execute as:** User accessing the web app
- **Who has access:** Anyone within Red Hat (redhat.com domain only)

**Code-Level Access Control:**

The application uses `Session.getActiveUser().getEmail()` (Code.js, line 33) to identify the authenticated user. This method:

- Returns the email address of the Google user currently accessing the web app
- Only works for users signed into a Google account within the configured domain
- Returns empty string if the user is not authenticated or outside the allowed domain

```javascript
function getUserEmail() {
  try {
    const email = Session.getActiveUser().getEmail();
    return { success: true, email: email || '' };
  } catch (e) {
    return { success: true, email: '' };
  }
}
```

**Domain Restriction:**

Access is implicitly restricted to Red Hat associates through:
1. **Apps Script deployment settings** — "Anyone within Red Hat" (not "Anyone with the link")
2. **Google Workspace domain policy** — Only `@redhat.com` accounts can access apps deployed to the Red Hat Workspace

**Business Purpose Scope:**

The application is accessible to **any Red Hat associate** (all employees with a `@redhat.com` email). This is appropriate because:

- **Tool purpose:** Internal productivity tool for submitting Arcade demos to the Interactive Experience library
- **Legitimate business use:** Any Red Hat employee creating or reviewing Arcade demos has a legitimate business purpose
- **Target users:** Marketing teams, product demos teams, field engineers, technical writers, and anyone creating customer-facing demo content
- **Access pattern:** Self-service (users discover the tool via Slack #forum-arcade-creators or internal documentation)

**Interpretation of "legitimate business purpose":**
- ✅ All Red Hat associates creating/reviewing Arcade demos = legitimate business purpose
- ✅ The app is an internal productivity tool, not a restricted-access system
- ✅ No need for explicit group membership (LDAP/Rover/Slack Channel) at this time

**If narrower access is required by AIA:**
- Implement group-based restriction (e.g., Slack #forum-arcade-creators membership check)
- Add code-level allowlist of approved creator emails
- Use Google Groups API to verify membership in "arcade-creators@redhat.com"

**Current decision:** "Anyone within Red Hat" is appropriate for this tool's business purpose. If AIA reviewer requires narrower access, this will be escalated and addressed.

**No Public Access:**
- The application is NOT accessible to external users
- No anonymous access is permitted
- No service account or programmatic access outside Red Hat's domain

### Spreadsheet-Level Access

The application writes to the Master Spreadsheet (shared across Intake, Finder, and Lifecycle):

**Spreadsheet ID:** `1t7TJtTL...` (set in Script Properties as `MASTER_SPREADSHEET_ID`)

**Access control:**
- Managed through Google Sheets sharing permissions
- Typically restricted to: Intake app service account, Finder app service account, Lifecycle app service account, and admin team editors
- Creators do NOT have direct spreadsheet access — they interact only through the web app UI

### Apps Script Editor Access

Access to edit the Apps Script project is controlled via Google Drive sharing:

**Current editors:**
- Product owner (Ruby Yang)
- Admin team members (as needed)

**Script project permissions:**
- View-only access is not granted (to prevent leaking API keys or workflow logic)
- Only trusted editors can modify code

### Repository Access

GitHub repository: `/Users/rubyyang/arcade-intake-app/` (local development)

**Access control:**
- Local repository on product owner's machine
- Not currently connected to a remote GitHub repository
- Future: If pushing to GitHub, use private repository with access limited to authorized developers and admin team

---

## Data Sensitivity Assessment

**Data handled by the application:**

| Data Type | Sensitivity Level | Access Restrictions |
|-----------|-------------------|---------------------|
| Creator email addresses | Low (internal Red Hat emails) | Red Hat domain only |
| Demo titles and descriptions | Low (public-facing content) | Red Hat domain only |
| Arcade share URLs | Low (internal demos) | Red Hat domain only |
| AI-generated metadata | Low (suggestions, not decisions) | Red Hat domain only |
| Analytics session IDs | Low (anonymized tracking) | Red Hat domain only |
| Gemini API key | High (service credential) | Script Properties (not in code) |

**Sensitive data NOT handled:**
- Customer PII
- Financial data
- Credentials or secrets (other than the Gemini API key, which is stored securely in Script Properties)

---

## Access Revalidation Plan

### Annual Access Review

**Frequency:** Annually (recommended: January, aligned with fiscal year)

**Scope:** Review and revalidate access for:

1. **Application users** (Who can access the web app?)
2. **Apps Script editors** (Who can modify the code?)
3. **Repository access** (Who can edit local files or push to remote repo?)
4. **Spreadsheet access** (Who can read/write the Master Spreadsheet?)

**Review Process:**

#### 1. Application User Access
**Responsibility:** Product owner  
**Method:** Verify Apps Script deployment settings

- Log into Google Apps Script editor
- Open the Arcade Intake project
- Navigate to **Deploy → Manage Deployments**
- Confirm "Who has access" is still set to **"Anyone within Red Hat"**
- Verify no accidental change to "Anyone with the link" (which would allow external access)

**Action if misconfigured:**
- Update deployment to restrict to Red Hat domain only
- Notify admin team and check recent submission logs for unexpected external entries

#### 2. Apps Script Editor Access
**Responsibility:** Product owner  
**Method:** Review Google Drive sharing permissions

- Open the Apps Script project in Google Drive
- Click **Share** button
- Review list of editors
- Remove any former employees or users who no longer require edit access
- Confirm only current admin team members and product owner have access

**Criteria for editor access:**
- Active Red Hat employee
- Requires code modification or troubleshooting capability
- Has completed required security training (if applicable)

#### 3. Repository Access
**Responsibility:** Product owner  
**Method:** Review local file permissions (current) or GitHub collaborators (future)

**Current (local repository):**
- Verify only the product owner has file system access to `/Users/rubyyang/arcade-intake-app/`
- Ensure no accidental commits of secrets (run: `git log --all --full-history -- "*API*KEY*" "*SECRET*"`)

**Future (if remote repository created):**
- Review GitHub collaborators list
- Remove former employees or users without active development role
- Ensure repository is set to **Private** (not Public or Internal)

#### 4. Spreadsheet Access
**Responsibility:** Product owner + Finder/Lifecycle teams  
**Method:** Review Master Spreadsheet sharing permissions

- Open Master Spreadsheet (ID: `1t7TJtTL...`)
- Click **Share** button
- Review list of editors and viewers
- Remove any former employees or service accounts no longer in use
- Confirm Intake, Finder, and Lifecycle apps still have write access via their service accounts

---

## Access Removal Process

**When an employee leaves or changes roles:**

1. **Immediately revoke** Apps Script editor access (via Google Drive sharing)
2. **Within 1 business day:** Remove from Master Spreadsheet editors list (if applicable)
3. **Within 1 week:** Review Analytics Spreadsheet and any other linked resources for orphaned permissions
4. **Log the removal:** Document in access review log (see below)

**Escalation:**
- If a former employee had access to Script Properties (where the Gemini API key is stored), **rotate the API key immediately**
- Notify admin team via #forum-arcade-creators

---

## Security Gaps and Mitigations

**Known Limitation:**
- **No code-level domain check** — The application relies on Apps Script deployment settings to enforce domain restrictions. There is no explicit `if (email.endsWith('@redhat.com'))` check in the code.

**Mitigation:**
- Apps Script deployment configuration is the authoritative enforcement mechanism
- Add a code-level domain check only if the deployment settings are ever changed to "Anyone with the link" (not currently necessary)

**Future Enhancement (if needed):**
```javascript
function getUserEmail() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email || !email.endsWith('@redhat.com')) {
      throw new Error('Access restricted to Red Hat associates');
    }
    return { success: true, email: email };
  } catch (e) {
    return { success: false, error: 'Unauthorized access' };
  }
}
```

---

## Access Review Log

Maintain a lightweight access review log at `docs/access-review-log.md`:

```markdown
# Access Review Log

## 2027-01-15 — Annual Review
- **Application access:** Verified deployment set to "Anyone within Red Hat" ✓
- **Apps Script editors:** 2 editors (Ruby Yang, Admin Lead) — both current employees ✓
- **Repository access:** Local only, no remote repo ✓
- **Spreadsheet access:** 3 service accounts (Intake, Finder, Lifecycle) + 2 human editors ✓
- **Removed:** None
- **Next review:** 2028-01-15

## 2028-01-15 — Annual Review
- TBD
```

---

## Responsible Parties

- **Access review owner:** Product owner (current: Ruby Yang)
- **Backup reviewer:** Admin team lead
- **Escalation contact:** IT Security (if API key rotation or breach suspected)

---

## Compliance Notes

**Red Hat Internal Tool Classification:**
- This tool is classified as an **internal productivity tool** with **low data sensitivity**
- No customer data, PII, or financial information is processed
- AI-generated content is reviewed by humans before publication

**Gemini API Key Security:**
- API key stored in Script Properties (encrypted by Google Apps Script)
- Not committed to repository or visible in code
- Access requires Apps Script editor permissions (restricted)
- Key rotation: Annually or upon suspected compromise

---

*Plan established: 2026-08-31*  
*Next access review due: 2027-01-15*
