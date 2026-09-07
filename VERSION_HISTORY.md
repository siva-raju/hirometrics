# HiroMetrics — Version History

## How to Roll Back
1. Identify the version you want in the table below
2. Navigate to that version's folder
3. Copy files back to the appropriate locations in your project
4. Restart backend if any `.py` files changed: `docker compose restart backend`

---

## Version Index

| Version | Date | Description | Key Changes |
|---|---|---|---|
| v1.0 | 2026-04-26 | Pre-spec reconciliation baseline | Full wizard, Invitations/Responses, Job Folders |
| v1.1 | 2026-04-26 | Phase 1 — Candidate Inbox/Sent restructure | Remove Invitations/Responses, Add Inbox/Sent |
| v1.2 | TBD | Phase 2 — Employer Folder enhancements | Archive menu, Consistency column, Discrepancy view, Additional Info fields |
| v1.3 | TBD | Phase 3 — Job ID chain & routing | Parent-child Job IDs, Submission lifecycle states |

---

## Folder Structure
```
versions/
├── VERSION_HISTORY.md          ← this file
├── v1.0-pre-spec-reconciliation/
│   ├── VERSION.md              ← notes for this version
│   └── [all 37 source files]
├── v1.1-inbox-sent/
│   ├── VERSION.md
│   └── [changed files only]
└── ...
```

## File Path Reference

### Frontend files → project location
| File | Project Path |
|---|---|
| `AppLayout.tsx` | `hirometrics\frontend\src\components\layout\AppLayout.tsx` |
| `App.tsx` | `hirometrics\frontend\src\App.tsx` |
| `api.ts` | `hirometrics\frontend\src\services\api.ts` |
| `Wizard.tsx` | `hirometrics\frontend\src\pages\applicant\Wizard.tsx` |
| `Profile.tsx` | `hirometrics\frontend\src\pages\applicant\Profile.tsx` |
| `Invitations.tsx` | `hirometrics\frontend\src\pages\applicant\Invitations.tsx` |
| `Responses.tsx` | `hirometrics\frontend\src\pages\applicant\Responses.tsx` |
| `FolderDetail.tsx` | `hirometrics\frontend\src\pages\employer\FolderDetail.tsx` |
| `Folders.tsx` | `hirometrics\frontend\src\pages\employer\Folders.tsx` |
| `geo.ts` | `hirometrics\frontend\src\data\geo.ts` |

### Backend files → project location
| File | Project Path |
|---|---|
| `models.py` | `hirometrics\backend\app\models\models.py` |
| `ensure_schema.py` | `hirometrics\backend\app\db\ensure_schema.py` |
| `applicants.py` | `hirometrics\backend\app\api\v1\routes\applicants.py` |
| `applications.py` | `hirometrics\backend\app\api\v1\routes\applications.py` |
| `folders.py` | `hirometrics\backend\app\api\v1\routes\folders.py` |
| `invitations.py` | `hirometrics\backend\app\api\v1\routes\invitations.py` |
| `employers.py` | `hirometrics\backend\app\api\v1\routes\employers.py` |
| `auth.py` | `hirometrics\backend\app\api\v1\routes\auth.py` |
| `admin.py` | `hirometrics\backend\app\api\v1\routes\admin.py` |
| `main.py` | `hirometrics\backend\app\main.py` |
