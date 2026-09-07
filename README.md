# HiroMetrics v2.0

> Trusted professional identity & credential verification platform

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| State | Zustand + React Query |
| Backend | FastAPI (Python 3.12) |
| Auth | JWT (access + refresh tokens) |
| Database | PostgreSQL 16 + SQLAlchemy 2 (async) |
| Migrations | Alembic |
| Cache | Redis 7 |
| File Storage | AWS S3 |
| Containers | Docker + Docker Compose |

## Quick Start (Docker)

```bash
# 1. Clone and enter project
cd hirometrics

# 2. Copy and fill environment variables
cp backend/.env.example backend/.env

# 3. Start everything
docker compose up --build

# Frontend → http://localhost:5173
# Backend API → http://localhost:8000
# API Docs → http://localhost:8000/docs
```

## Local Development (without Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in your values

# Run migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # → http://localhost:5173
```

## Project Structure

```
hirometrics/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/     # FastAPI routers
│   │   │   ├── auth.py        # register, login, refresh, activate
│   │   │   ├── applicants.py  # profile, work, education, certs, refs
│   │   │   ├── employers.py   # dashboard, search, verification requests
│   │   │   ├── verifications.py # process templates + instances
│   │   │   ├── share.py       # verified link/QR generation + public view
│   │   │   └── users.py       # user management
│   │   ├── core/
│   │   │   ├── config.py      # settings (pydantic-settings)
│   │   │   └── security.py    # JWT, password hashing, share tokens
│   │   ├── db/session.py      # async SQLAlchemy engine + session
│   │   ├── models/models.py   # all SQLAlchemy ORM models
│   │   └── main.py            # FastAPI app entrypoint
│   ├── alembic/               # database migrations
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── components/
│       │   └── layout/AppLayout.tsx   # sidebar nav
│       ├── pages/
│       │   ├── auth/          # Login, RegisterApplicant, RegisterEmployer
│       │   ├── applicant/     # Dashboard, Profile, ShareLinks
│       │   ├── employer/      # Dashboard, Search
│       │   └── shared/        # VerifiedProfileView (public)
│       ├── services/api.ts    # Axios client + all API calls
│       ├── store/authStore.ts # Zustand auth state (persisted)
│       ├── App.tsx            # React Router setup
│       └── index.css          # Tailwind + component classes
│
└── docker-compose.yml
```

## Key Flows

### Applicant flow
1. Register → activate email → login
2. Build profile (work, education, certs, references)
3. Generate a verified share link or QR code
4. Share link with employer — no employer account needed

### Employer flow
1. Register company → activate → login
2. Search verified candidates OR request verification by email
3. Open applicant's share link to view verified credentials

## Database Models

- `users` — applicants and employer users
- `organizations` — employer companies
- `applicant_profiles` — extended profile + trust score
- `work_history` — with verification status
- `education` — with verification status
- `certifications` — with verification status
- `references` — with referee token for email verification
- `metrics` — trust score breakdown by category
- `verification_processes` — workflow templates
- `verification_steps` — steps within a process
- `verification_instances` — per-applicant workflow runs
- `step_instances` — individual step progress
- `share_tokens` — time-limited verified profile links
- `verification_requests` — employer-initiated checks
- `subscriptions` — credit-based billing

## API Docs

FastAPI auto-generates interactive docs at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Next Steps

- [ ] Email service (activation, referee verification, employer invite)
- [ ] Identity verification webhook (Persona/Onfido)
- [ ] Trust score computation service
- [ ] File upload to S3 (resume, ID documents)
- [ ] Admin panel
- [ ] Subscription/billing (Stripe)
- [ ] Mobile-responsive polish

---

## Pitch Reminder — Submission Chain Transparency (add to investor/client pitch)

**Remind owner before pitch preparation:**

One of HiroMetrics' unique value propositions — not yet in the pitch deck — is
**submission chain transparency**. Today, end clients (and even intermediate
vendors/contractors) have zero visibility into:

- How many tiers of intermediaries were involved in submitting a candidate
- Who those intermediaries are
- Whether the same candidate was submitted by multiple vendors simultaneously
  (duplicate submissions — a major billing and legal headache in consulting)

HiroMetrics solves this structurally. Because every submission is a traceable
HM link passing through a closed ecosystem, the platform records the full
genealogy of every application:

  Candidate → Vendor A → Tier-2 Contractor → End Client

This gives end clients:
1. Full passthrough visibility — know exactly how many middlemen are involved
2. Duplicate submission detection — same candidate, two vendors, caught instantly
3. Margin transparency leverage — know the chain length before negotiating rates
4. Audit trail for disputes — who submitted first, when, through which path

This is particularly compelling for the consulting/staffing market where
multi-tier vendor chains are the norm and opacity is an accepted (but resented)
cost of doing business.

**Data already captured in the schema:** `parent_application_id` chain on the
`Application` model, with `submitted_by_org_id` and `timestamp` at each hop.
The genealogy report is a query, not a rebuild.

---

## Email System — Transactional Templates Required

All emails from: no-reply@hirometrics.com
All emails close with: "Thanks, HiroMetrics Team"
All emails include footer: "Replies to this message are undeliverable. Please do not reply."

### 1. Email Verification (on registration)
- Trigger: User completes registration form
- To: Registered email address
- Subject: "Please verify your email address"
- Salutation adapts to role: "Hi Consultant [Name]" / "Hi [Name]"
- CTA: Single "Verify" button linking to /auth/activate/{code}
- Body: "Please verify your email address so we know that it's really you!"

### 2. Welcome Email (on successful email verification)
- Trigger: User clicks verification link and activates account successfully
- To: Registered email address
- Salutation adapts to role
- Body: Welcome to HiroMetrics, next steps to complete profile
- CTA: "Go to my dashboard"

### 3. Password Reset (on forgot password request)
- Trigger: User requests password reset
- To: Registered email address
- Method: Temporary password sent (not a reset link)
- Body: Includes temporary password, instruction to log in and change it
- Note: Temp password stored as hashed on User model (temp_password field exists)

### 4. Enrollment Invitation (any user invites someone new to HM)
- Trigger: Any existing HM user sends an invite to a non-member
- To: Invitee email (provided by inviter)
- Salutation: "Hi [Invitee Name]"
- Body: "[Inviter Name/Entity] has invited you to join the HiroMetrics community
  and discover a great way to showcase, manage and submit your job credentials!"
- CTA: "HiroMetrics" link to sign-up page with referral token pre-filled
- Tracked by: EnrollmentInvitation record (invited_by, recipient email/name, token, status)

### 5. Invitation to Apply (hiring manager invites candidate to apply for position)
- Trigger: Hiring manager sends invitation from a job folder
- To: Candidate's registered email
- Body: Invitation to apply for a specific position
- CTA: Links to candidate dashboard notification (Accept / Reject)
- Tracked by: Invitation record tied to folder + candidate

### 6. Application Received (hiring manager notification)
- Trigger: A candidate profile link lands in a hiring manager's inbox
  (via any of the 3 flows: direct share, invitation accept, job link)
- To: Hiring manager email
- Body: "[Candidate Name] has submitted their HiroMetrics profile"
- CTA: "View in inbox"

### 7. Status Change Notification (candidate notification)
- Trigger: Hiring manager updates application status
- To: Candidate email
- Body: Status update for their application (shortlisted, not proceeding, etc.)

### 8. Password Changed Confirmation
- Trigger: User successfully changes their password
- To: Registered email
- Body: Security notice that password was changed, contact HM if not initiated by them

---

## Feature Backlog — Captured Requirements

### Terms & Conditions
- A dedicated Terms & Conditions page must exist in the application
- The T&C acceptance is a mandatory gate BEFORE candidate registration completes
- Flow: Registration form → T&C page (must scroll/read) → Accept checkbox → Account created
- T&C covers: accuracy accountability, immutable baseline commitment, HM authorization
  to authenticate credentials, data usage, candidate obligations
- Must be versioned — when T&C changes, existing users must re-accept on next login
- T&C also applies to employers/vendors but candidate version is the priority
- Need separate page at /terms that is publicly accessible (for reference)
- Acceptance event stored: user_id, tc_version, accepted_at, ip_address

### Notification System

#### HM Superadmin — Create notifications
- Superadmin can compose and send notifications to:
  - All users (broadcast)
  - Specific role (candidates / client users / HM users)
  - Specific individual user
- Notification types: system alert, platform update, action required, informational
- Fields: title, body, type, target audience, scheduled send (optional)
- Notifications visible in app AND optionally sent via email

#### All Users (Candidates, Client/Employer Users, HM Users) — View notifications
- Notification bell icon in top nav showing unread count badge
- Notifications page / dropdown showing:
  - Title, body, timestamp, read/unread status
  - Type badge (alert, update, info, action required)
- Mark as read (individual + mark all as read)
- Delete notification (individual) — soft delete, only removes from user's view
- Filter by: unread only, type, date range
- Notifications persist until deleted by the user

#### Notification triggers (system-generated, not just superadmin):
- Application received (hiring manager)
- Invitation to apply received (candidate)
- Status change on application (candidate)
- Enrollment invitation received (any user)
- Profile submission to next tier (vendor confirmation)
- Account activated successfully
- Password changed
- T&C updated — re-acceptance required


---

## Scoring Model — Baseline Design (Full MVP, not in Light version)

### Metrics Summary — Categories, Scores, Scales

| Category                  | Example Score | Scale             | Notes                          |
|---------------------------|---------------|-------------------|--------------------------------|
| Academics                 | 200           | 250 (Maximum)     | Education verification         |
| Experience                | 250           | 350 (Maximum)     | Work history verification      |
| References                | 150           | 150 (Maximum)     | Reference check results        |
| Resume To Profile Mismatch| -50           | -200 <= Score <= 0| PENALTY — deduction only       |
| Certifications & Awards   | 50            | 50  (Maximum)     | Verified certs                 |

### Key design rules extracted from this table:
1. Maximum possible total score = 250 + 350 + 150 + 50 = 800 points
2. Resume To Profile Mismatch is a PENALTY category — score is always 0 or negative
   Range: -200 to 0. A perfect match = 0 (no deduction). Severe mismatch = -200.
3. Each category has a defined maximum (scale) — scores cannot exceed the scale maximum
4. Overall score = sum of all category scores (including penalties)
5. Score model is applied uniformly to all candidates
6. If scoring model changes in future → retroactively applied to all existing profiles

### Scoring model data structure (for Full MVP):
- ScoreCategory    — name, max_points, min_points (0 for positive, -200 for mismatch)
                     weight, description, is_penalty (bool)
- ScoreCriterion   — category_id, name, points, description, verification_method
- CandidateScore   — profile_id, category_id, raw_score, weighted_score,
                     computed_at, model_version, notes, is_neutral (bool)
                     (neutral = not verifiable, assigned 0 with explanation note)
- ScoreModelVersion — version, effective_date, is_current, change_description

### Reminder from Summary doc:
- Neutral point assignment: where HM cannot verify a criterion, assign 0 points
  with a note explaining why — do not penalize, do not reward
- Score empowers RELATIVE benchmarking between candidates in same folder
- Dashboard analytics: sort/filter by score, score distribution charts (bar + pie)
  as seen in the Advanced Profile Search screenshot


---

## Legal Texts — Two Distinct Consent Documents

### Document 1: Candidate Authorization (consent to HM processing)
- Shown to candidate when they accept an invitation to apply / consent to evaluation
- Gate before HM Supervisor can process their profile

### Document 2: HM Supervisor Approval (internal QA sign-off)
- Shown to HM Supervisor before they finalize and publish a candidate's evaluation
- Internal document — not shown to candidates or employers

Both texts need to be versioned alongside the T&C versioning system.

---

## Design Notes — From Handwritten Client Screen Shot Notes (Feb 2016)

### Page 1 — Client Manager Dashboard annotations:
- Top nav bell icon shows TWO counts: # of unread mail AND # of active items
- Dashboard stat tiles: Admins | Managers | Candidates | Notifications | Requests | Reviewed
- HM Status section shows: "HM Review In Progress" and "HM QA Rejections" with counts
- Notifications section labeled "HM NOTIFICATIONS & ALERTS" with examples:
    "Welcome to HM", "Downtime", "Upgrades..." — confirms these are broadcast/system notifications
- Notifications have Read AND Delete options (annotated "Read & Delete options")
- Folders tile is visible in the top nav/dashboard area (annotated "FOLDERS")
- "REVIEW NOTIFICATIONS" label with count badge — separate from regular notifications

### Page 2 — Invite Candidate + Folder Management + Process Flow:

#### Invite Candidate flow (annotated process):
1. Manager obtains candidate's email address
2. Manager initiates HM Review:
   - 2.1: If candidate IS already an HM user → OK, proceed directly
   - 2.2: If candidate is NOT an HM user:
     - 2.2.1: Manager "invites" candidate to HM (enrollment invitation)
     - 2.2.2: When candidate creates HM login → Manager gets notified
- Manager can search by email address — action initiated based on search result
- "Invite Candidate" form: Email Address field + "Send Invitation" button
- On click → popup to confirm email address → OK | Cancel
- "Initiate HM Review" is a separate action from inviting

#### Candidate search in manager view:
- Search shows 3 fields: Full Name | Email Address | Status
- Name split into 3 fields: FN (First Name), MN (Middle Name), LN (Last Name)
- Columns: Full Name | Email Address | Status → action can be initiated

#### Folder Management (Manage Folders screen):
- Table columns: S.No | Folder Name | Owner | Created By | View | Edit | Delete | SHARE (?)
- Folder has an OWNER field (may differ from creator — "H/other Mgr's")
- "OPEN" status visible on folder — folders can be open or closed
- Can set status to Inactive OR Rename OR Delete — but ONLY empty folders (annotated "only empty folders?")
- SHARE column — open question whether folders can be shared with other managers

#### Reviewed Profiles screen:
- Has "Check All" checkbox for bulk selection
- Columns: Select | [group dropdown] | [choose dropdown] | Move button
- Columns: Select | Qualification | Experience (Yrs)
- "Move" button to assign reviewed profiles to a folder ("Assign to Folder")
- Global search across all candidate profiles

### Page 3 — Global Search + Reviewed Profiles:

#### Global Search / Candidate Profiles table:
- Columns: Name | Candidate Email ID | Requested By | Requested Date | Status | Comments
- Comments column — managers can add free-text comments per candidate
- Status values visible: "Completed", "Not Started", "In Progress" (circled)
- "Assign to Folder" action annotated at top right

#### Reviewed Profiles:
- Has bulk select (Check All)
- Filter dropdowns: group selector + qualification/type selector
- "Move" button for bulk folder assignment
- Columns include Qualification and Experience (Yrs) — filterable criteria
- Question mark on additional column — to be determined


---

## Full MVP — Internal Verification Workflow (HM Staff)

### 1. Candidate Verification Process — Supervisor Role

**Assignment model (updated from original 2-step):**
- Supervisor assigns ONE verification request to BOTH an Analyst AND a QA member simultaneously
  (previously was sequential — analyst first, then QA assignment separately)
- Only ACTIVE verifications maintained — no version history for analyst/QA iterations

**Workflow state machine:**
```
Supervisor assigns (Analyst + QA simultaneously)
    → Analyst performs verification
    → QA reviews Analyst's work
        → QA ACCEPTS → Manager approval requested
            → Manager APPROVES → Score report sent to Vendor (CLOSED)
        → QA REJECTS → Loop restarts from Supervisor assignment
            (same process repeats — Supervisor re-assigns)
```

**Key rules:**
- When QA rejects → entire flow resets to Supervisor assignment stage
- Analyst can view QA rejection report if verification was rejected at least once
- When all iterations complete and QA accepts → Manager is asked to approve
- Manager approval = closing event → score report sent to requesting Vendor
- Only active verification records kept — no version history of iterations

### 2. Analyst Verification — Detail

**Fields and UI:**
- Can view QA report for previously rejected verifications
- Upload verification documents (evidence gathered during verification)
- New field per credential item — three options:
    a) "Matches with resume"
    b) "Does not match with resume" → triggers mandatory comments field
    c) "Not applicable"
- Source field — opens as a popup
- Reason field — opens as a popup
- Resume-to-Profile mismatch scoring driven by analyst selections above

### 3. QA Verification — Detail

- One QA verification covers one section at a time (not the whole profile at once)
- QA answer per item: Yes / No
- When QA selects "No" → mandatory comments field required
- QA rejection triggers full workflow reset to Supervisor assignment

### 4. Payment Cycle — Triggers (Full MVP)

Three distinct payment trigger scenarios:
1. Vendor signs up for PREMIUM plan → payment on signup
2. Vendor signs up for FREE plan → payment triggered after free credits exhausted
   (free credits = N candidate verifications included at no charge)
3. Candidate self-requests verification → candidate pays directly

### 5. Candidate-to-Vendor Request (New Process)

**Defined as a new flow — candidate-initiated outbound to vendor:**
- Candidate wants to send their HM report/profile to a specific Vendor
- System prompts candidate for Vendor's email address
- HM sends email to that Vendor email address with the profile link
- Vendor can Accept or Reject the candidate's request
- If Vendor ACCEPTS → candidate's report appears in Vendor's "Reviewed Profiles" list
- If Vendor REJECTS → candidate is notified, nothing added to Vendor's list

**This is distinct from the job-link flow and invitation flow:**
- Flow A (candidate direct share): candidate shares link freely, no accept/reject
- Flow B (employer invitation): employer initiates, candidate accepts/rejects
- Flow C (job folder link): candidate applies via public link, auto-routed to folder
- Flow D (candidate-to-vendor request): candidate targets specific vendor,
  vendor must accept before it appears in their reviewed profiles

---

## Updated Data Models Required for Full MVP Verification Workflow

### VerificationAssignment
- id, verification_instance_id
- analyst_id (FK → users)
- qa_id (FK → users)
- assigned_by (supervisor, FK → users)
- assigned_at
- iteration_number (increments on each QA rejection + reassignment)
- status: active | analyst_complete | qa_accepted | qa_rejected

### AnalystVerification (per section)
- id, assignment_id, section (education | experience | identity | reference | certification)
- resume_match_status: matches | does_not_match | not_applicable
- comments (mandatory if does_not_match)
- source (popup selection)
- reason (popup selection)
- documents_uploaded (JSONB array of S3 urls)
- completed_at

### QAVerification (per section)
- id, assignment_id, section
- approved: boolean
- comments (mandatory if approved = false)
- completed_at

### CandidateVendorRequest (Flow D)
- id, candidate_id (FK → users)
- vendor_email (target vendor, may or may not be HM user)
- vendor_id (FK → users, null if not yet HM user)
- status: pending | accepted | rejected
- requested_at, responded_at

### PaymentTrigger (audit log)
- id, org_id / user_id
- trigger_type: premium_signup | free_credits_exhausted | candidate_self_pay
- amount, currency, payment_id, status
- created_at


---

## Scoring Model — Full Algorithm Detail (from Excel Draft V1.0)

### Overall Score Structure
- Total maximum: 800 points (Academics 250 + Experience 350 + References 150 + 
  Certifications/Awards 50)
- Note: Certifications and Awards appear to be separate categories in full model
  (CRT base=25, AWD base=25) combined = 50 in summary table
- Additional category: Attendance & Memberships (ATM) — base score TBD

### Scoring Mechanics
- Base Score per category × Data Point Weight% × Auth Criteria Sub-Weight = points
- Ding Factor (penalty) = Base × Weight% × Factor% when negative condition applies
- Multiple education levels scored independently (ACD #1 BS, ACD #2 MS, ACD #3 PhD)
- Experience scored by tenure band: 0-5 years / 6-10 years / 11-15 years
- Each criterion has an Auth Code (e.g. DTV, DTX-SNR, DTI-DDMI) for tracking

---

### CATEGORY 1: ACADEMICS (ACD) — Base Score: 250

Sub-categories: High School (HS), Bachelor's (BD), Diploma (DP), 
PG Degree (PG), Doctorate (DR), Research (RS)

#### Data Point: Dates (Weight: 30%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| DTV         | Dates Verified                           | +full  |
| DTX-SNR     | School Not Reachable                     | -10%   |
| DTX-SLNF    | School Listing Not Found                 | -40%   |
| DTX-NSR     | No School Response                       | -10%   |
| DTI-DDMS    | Dates Don't Match School Records         | -40%   |
| DTI-DDMI    | Dates Don't Match I-94                   | -80%   |
| DTI-OVLP    | Overlap with Work Dates                  | -25%   |

#### Data Point: Degree (Weight: 50%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| DGV         | Degree Verified                          | +full  |
| DGX-SNR     | School Not Reachable                     | 0      |
| DGX-SLNF    | School Listing Not Found                 | 0      |
| DGX-NSR     | No School Response                       | 0      |
| DGX-NDG     | School Does Not Offer This Degree        | -50%   |
| DGX-DNM     | Degree Name Different Than Entered       | -30%   |
| DGX-NDR     | No Degree Record                         | -80%   |
| DGX-DNC     | Degree Not Completed                     | -75%   |
| DGX-DNM     | Degree Claimed ≠ Degree Obtained         | -75%   |

#### Data Point: Speciality/Major (Weight: 20%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| MGV         | Major Verified                           | +full  |
| MGX-SNR     | School Not Reachable                     | 0      |
| MGX-SLNF    | School Listing Not Found                 | 0      |
| MGX-NSR     | No School Response                       | 0      |
| MGX-MLNF    | Major Listing Not Found                  | -75%   |
| MGX-DNM     | Major Name Different Than Entered        | -50%   |
| MGX-MNM     | Major Claimed ≠ Major Actually Attended  | -75%   |

---

### CATEGORY 2: EXPERIENCE (EXP) — Base Score: 350

Sub-categories: Full-Time (FTE), Consulting (CON), Part-Time (PTE), 
Intern (INT), Training (TRN), Other (OTH)

Scored by tenure band: 0-5 yrs / 6-10 yrs / 11-15 yrs

#### Data Point: Dates (Weight: 35%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| DTV         | Dates Verified                           | +full  |
| DTX-NP      | Dates Not Provided                       | -80%   |
| DTX-NCI     | No Contact Info for Verification         | -25%   |
| DTX-NRE     | No Response from Employer                | -50%   |
| DTI-DDMR    | Dates Don't Match Employer Records       | -75%   |
| DTI-DMPI    | Dates Don't Match Previous Version       | -50%   |
| DTI-DIWI    | Dates Inconsistent With I-94             | -90%   |
| DTI-OVLP    | Dates Overlap with Other Fulltime        | -40%   |

#### Data Point: Title/Role (Weight: 35%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| TRV         | Title/Role Verified                      | +full  |
| TRX-ENR     | Employer Not Reachable                   | -25%   |
| TRX-NER     | No Employer Response                     | -10%   |
| TRX-ENL     | Employer Not Listed                      | -50%   |
| TRX-NTR     | No Such Title/Role Held                  | -60%   |
| TRX-DNM     | Title/Role Does Not Match                | -20%   |
| TRX-DNE     | Title/Role Does Not Exist                | -60%   |
| TRI-VMM     | T/R Version Mismatch                     | -40%   |
| TRI-SCM     | Sub-Category Code Mismatch               | -40%   |
| TRI-DSP     | Disproportionate Elevation (Red Flag)    | -20%   |

#### Data Point: End Employer (Weight: 30%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| EEV         | End Employer Verified                    | +full  |
| EEX-NR      | EE Not Reachable                         | -50%   |
| EEX-NRCE    | No Record of Candidate Employment        | -80%   |
| EEX-NEI     | EE Does Not Provide Employment Info      | -50%   |
| EEI-VMM     | EE Version Mismatch                      | -80%   |
| EEI-HSTX    | EE Activities Inconsistent with Claims   | -60%   |

---

### CATEGORY 3: REFERENCES (REF) — Base Score: 150

Sub-categories: Professional (FTE), Personal (CON), Other (OTH)

IMPORTANT NOTES from spreadsheet:
- When contacting references: state Title/Role/Employer/Project as provided by candidate 
  first, have reference formally acknowledge it, verify reference's full legal name
- Store reference info on file — do NOT create HM profile for reference (only REF 
  can create their own). T&C must include HM release to tie-back historic reference data

#### Data Point: Dates (Weight: 25%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| RFV         | Dates of Association Verified            | +full  |
| RFX-NP      | Dates Not Provided                       | -50%   |
| RFX-NCI     | Reference Cannot Confirm Dates           | -30%   |
| RFX-RTP     | Reference Refused to Provide Dates       | -30%   |
| RFI-NSR     | Reference Not Sure of Dates              | -20%   |
| RFI-DDM     | Dates Don't Match Reference Confirmation | -60%   |
| RFI-NOVR    | Reference Employment Dates Don't Match   | -75%   |

#### Data Point: REF Feedback Relationship (Weight: 20%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| RFB-CTV     | Candidate T/R/Relationship Verified      | +full  |
| RFB-RNR     | REF Not Reachable                        | -50%   |
| RFB-NRR     | No REF Response                          | -50%   |
| RFB-DNM     | T/R/Relationship Does Not Match          | -40%   |
| RFB-CTN     | T/R/Relationship Not Verified            | -40%   |

Note: If REF not reachable → grey out Dates & Employment sections, assign % accordingly

#### Data Point: Employment Confirmation (Weight: 80%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| RFB-CEV     | Candidate Employment Verified by REF     | +full  |
| RFB-CEN     | Candidate Not Employed (REF confirmed)   | -100%  |

#### Data Point: Reference Identity (Weight: 40%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| RIV         | Reference Identity Verified              | +full  |
| RIX-EML     | Email Invalid/Inactive                   | -30%   |
| RIX-PHN     | Work Phone Invalid/Incorrect             | -30%   |
| RIX-NREC    | REF's Employer Has No Record of REF      | -60%   |
| RII-VMM     | RI Version Mismatch                      | -30%   |
| RII-HSTX    | RI History Mismatch                      | -60%   |

---

### CATEGORY 4: AWARDS (AWD) — Base Score: 25

Sub-categories: Merit Scholarships (MS), Grants (GT), Top Rank (TR), 
Achievement (AC), Recognition (RC), Social (SC), Philanthropic (PT), Other (OT)

#### Data Point: Awardee (Weight: 40%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| AWV         | Awardee Verified                         | +full  |
| AWX-ANR     | Awardee Not Reachable                    | -20%   |
| AWX-AWNF    | Awardee Not Found                        | -30%   |
| AWX-NAR     | No Response                              | -20%   |
| AWD-NM      | Award Doesn't Match Awardee Offering     | -40%   |
| AWD-NREC    | Awardee Has No Record of Award           | -40%   |
| AWD-NMD     | Award Description Doesn't Match          | -20%   |

#### Data Point: Dates (Weight: 20%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| AWDV        | Award Date Verified                      | +full  |
| AWDX-NP     | Dates Not Provided                       | -30%   |
| AWDX-CNFLT  | Dates Conflict with Other Timelines      | -25%   |
| AWDX-NM     | Award Dates Don't Match Awardee Info     | -25%   |

---

### CATEGORY 5: CERTIFICATIONS (CRT) — Base Score: 25

Sub-categories: Technical (TC), Leadership (LC), Process (PC), 
Functional (FC), Social (SC), Other (OC)

#### Data Point: Certifying Authority (Weight: 40%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| CRTV        | CA Verified                              | +full  |
| CRTX-CANR   | CA Not Reachable                         | -10%   |
| CRTX-CANF   | CA Not Found                             | -25%   |
| CRTD-NM     | Cert Doesn't Match CA Offering           | -50%   |
| CRTD-NREC   | CA Has No Record of Cert Issued          | -80%   |
| CRT-EXP     | Cert Expired                             | -50%   |
| CRT-RVK     | Cert Revoked                             | -60%   |
| CRT-NMD     | Cert Description Doesn't Match           | -25%   |

#### Data Point: Dates (Weight: 20%)
| Auth Code   | Description                              | Factor |
|-------------|------------------------------------------|--------|
| CRTDV       | Cert Date Verified                       | +full  |
| CRTDX-NP    | Dates Not Provided                       | -30%   |
| AWDX-CNFLT  | Dates Conflict with Other Timelines      | -25%   |
| AWDX-NM     | Cert Dates Don't Match CA Info           | -30%   |

---

### CATEGORY 6: ATTENDANCE & MEMBERSHIPS (ATM) — Base Score: TBD

Sub-categories: Conference (CNF), Workshop (WKS), Seminar (SMNR), 
Event (EVNT), Club (CLB), Forum (FRM), Organization (ORG), Other (OT)
Criteria: TBD (structure similar to Awards/Certifications)

---

### Key Algorithmic Notes for Implementation
1. Score formula per criterion: Base × DataPointWeight% × AuthCriteriaSubWeight × Factor
2. Neutral (0) assigned where verification not possible — not a penalty
3. Education scored per level instance (BS=ACD#1, MS=ACD#2, PhD=ACD#3)
4. Experience scored by tenure band — more years = lower base (diminishing returns)
   0-5 yrs: 350pts, 6-10 yrs: 100pts, 11-15 yrs: 50pts (indicates weighting)
5. TRI-DSP (Disproportionate Elevation) = Red Flag comment only — score impact TBD
6. DTI penalties removable upon substantiating verifiable evidence from candidate
7. RFB-CEN (Candidate Not Employed) = -100% of Employment Confirmation points
8. All auth codes stored per AnalystVerification record for audit trail
9. Score model versioned — retroactively applied when model version changes
10. Resume-to-Profile mismatch: -200 to 0, driven by analyst match/no-match selections


---

## HM Workbook — Complete Role & Responsibility Matrix (Roles_2 — most current version)

### HM Domain Roles (Internal HiroMetrics Staff)

| Role           | Permissions |
|----------------|-------------|
| HM Super Admin | Create/view Super Admins, Manage Admins, Create/view Admins, Manage Managers, Create/view Managers, Manage Supervisors, Create/view Supervisors, Manage Analysts, Create/view Analysts, Manage QA Users, Create/view QA, Assign Analyst, Assign QA User, Manage Candidate Review, View Candidate Review, Pass/Fail Candidate Review, Manage Customer Admins, Create/view Customer Admins, Manage Customer Managers, Create/view Customer Managers, Invite Candidates, Archival/Retrieval**, Manage Profile**, View History** |
| HM Admin       | Manage Admins, Create/view Admins, Manage Managers, Create/view Managers, Manage Supervisors, Create/view Supervisors, Manage Analysts, Create/view Analysts, Manage QA Users, Create/view QA, Assign Analyst, Assign QA User, Manage Candidate Review, View Candidate Review |
| HM Manager     | Manage Supervisors, Create/view Supervisors, Manage Analysts, Create/view Analysts, Manage QA Users, Create/view QA, Assign Analyst, Assign QA User, Manage Candidate Review, View Candidate Review, Pass/Fail Candidate Review |
| HM Supervisor  | Manage Analysts, Create/view Analysts, Manage QA Users, Create/view QA, Assign Analyst, Assign QA User, Manage Candidate Review, View Candidate Review, Pass/Fail Candidate Review |
| HM Analyst     | Manage Candidate Review, View Candidate Review |
| HM QA User     | ^ (conditional), Manage Candidate Review, View Candidate Review |

### Customer Domain Roles (Employer/Vendor/Contractor)

| Role             | Permissions |
|------------------|-------------|
| Customer Admin   | Manage Admins, Create/view Admins, Manage Managers, Create/view Managers, Invite Candidates, Archival/Retrieval**, Manage Profile** |
| Customer Manager | ^ (conditional), Invite Candidates, Archival/Retrieval** |
| Candidate        | Manage Profile |

**Notes:**
- ** = limited/conditional access
- ^ = conditional permission (not always granted)
- HM Super Admin has all permissions across all domains

---

## Candidate Profile — Complete Field Specification (Data Points Sheet)

### Step 1: DEMOGRAPHICS

#### 1-a Personal Information
- Salutation (Dropdown: Mr., Mrs.)
- Legal First Name (text, mandatory)
- Nick Name (text, optional)
- Legal Middle Name (text)
- Legal Last Name (text, mandatory)
- Gender (Dropdown: Male, Female)

#### 1-b SSN Information
- SSN (text, mandatory, encrypted)
- Date of Birth (date, mandatory)
- Country of Birth (Dropdown: USA, Canada, ...)

#### 2-a Contact Information
- Email (text, mandatory)
- Primary Phone Number (mandatory)
- Secondary Phone Number (optional)

#### 2-b Current Address
- Street, City, State (Dropdown), Country (Dropdown)
- Current Address Copy (Upload: Image/PDF)

#### 3 Legal Status
- Legal Status (Radio: US Citizen / Permanent Resident / Others)

#### 3-a Immigration Category
- Immigration Category (Dropdown: all categories)

#### 3-b Driving License / State ID (Current)
- DL Number, Issued State (Dropdown), Issued Date, Expiry Date
- DL/State ID Copy (Upload: Image/PDF)
- Analyst: EDIT mode | QA: Read-Only
- Source: SOURCE_DL | Reason: REASON_DL

#### 3-c Passport (Current)
- Passport Number, Issued Country (Dropdown: all), Issued Date, Expiry Date, Date of Entry
- Passport Copy (Upload: Image/PDF)
- Source: SOURCE_PP | Reason: REASON_PP

#### 3-d Work Authorization (Current)
- Work Authorization type, Visa Type, Start Date, End Date
- Work Authorization Copy (Upload: Image/PDF)
- Source: SOURCE_WA | Reason: REASON_WA

### Step 2: EDUCATION (repeating, +/- sections)
- Education Level (Dropdown: ACD sub-categories)
- Degree/Diploma Name
- Specialization
- Start Date, End Date, Graduation Date
- Marks Obtained (%), Grade Obtained
- Institution: Name, Country, State/Province, City, Street
- Education Certificate Copy (Upload: Image/PDF)
- Source/Reason codes per section

### Step 3: EXPERIENCE (repeating, +/- sections)
- Employment Type (Dropdown: EMP sub-categories)
- Role/Title, Area of Industry
- From Date, To Date
- Company Name, Street, City, State, Country
- Experience Certificate Copy (Upload: Image/PDF)
- Employment Reference: Full Name, Designation, Email, Phone Number
- Source/Reason codes per section

### Step 4: CERTIFICATION (repeating)
- Certification Authority, Certification Name, Number, Version
- Issued Date
- Certification Copy (Upload: Image/PDF)
- Source/Reason codes per section

### Step 5: RESUME
- Upload Resume (Upload: .doc, .docx)

---

## Analyst Verification — Source & Reason Code System

Every verification field has:
- SOURCE_* code: where the analyst obtained verification data
- REASON_* code: specific reason when verification fails/is negative

### Reason Codes by Section (from Codes sheet):

**Demographics - Name (REASON_NAME):**
First/Middle/Last Name mismatch against DL, Passport, or Work Authorization

**Demographics - SSN (REASON_SSN):**
SSN doesn't match DL / SSN card / other docs / not provided

**Demographics - Address (REASON_CA):**
Proof not provided / Address mismatch / No proof provided

**Demographics - DL (REASON_DL):**
DL name/DOB mismatch passport / DL expired / Not provided / Not legible

**Demographics - Passport (REASON_PP):**
No info provided / Not legible

**Education - Level (REASON_ACD_LE):**
School not reachable / School not found / No school response

**Education - Specialization (REASON_ACD_SP):**
School issues + Major listing not found / Name mismatch / Major mismatch

**Education - Duration (REASON_ACD_DT):**
School issues + Dates mismatch school records / I-94 / Full-time overlap

**Education - Degree (REASON_ACD_D):**
School issues + School doesn't offer degree / Name mismatch / No record / 
Not completed / Claimed ≠ obtained

**Experience - Role (REASON_EXP_R):**
Employer not reachable / No response / Not listed / No such role / 
Role mismatch / Role doesn't exist / Version mismatch / Sub-cat mismatch / 
Disproportionate elevation

**Experience - Dates (REASON_EXP_DT):**
Not provided / No contact info / No employer response / Mismatch records /
Mismatch prior version / Overlap fulltime

**Experience - Employer (REASON_EXP_EM):**
EE not reachable / No employment record / No info provided / 
Version mismatch / Activity inconsistency

**Experience - Reference (REASON_EXP_RE):**
REF not reachable / No response / Dates issues / Title mismatch /
Not verified / Candidate not employed / Email/phone invalid / 
No REF record / Version/history mismatch

**Certification - Authority (REASON_CRT_CA):**
CA not reachable/found / No response / Cert mismatch / No record /
Expired / Revoked / Description mismatch

**Certification - Dates (REASON_CRT_DT):**
Not provided / CA issues / Timeline conflicts / Date mismatch

---

## Email Templates — Exact Specifications (Emails Sheet)

All emails CC: cc.hm.[domain]@gmail.com (HM monitoring address)

| # | Scenario | To | Subject | Key Content |
|---|----------|-----|---------|-------------|
| 1 | Vendor/User Signup | User email | "Please verify your email address" | Verify link |
| 2 | Email Verified Successfully | User email | "Welcome To HiroMetrics" | Login URL + Username shown |
| 3 | Admin Creates Manager User | Manager email | "Welcome To HiroMetrics" | Username shown, password in separate email |
| 4 | Admin Creates Manager (Password) | Manager email | "Your HiroMetrics Password" | Temporary password shown |
| 5 | Admin/Manager Invites Candidate | Candidate email | "HiroMetrics Invitation" | Invitation from [org name] + signup link |
| 6 | Any User - Forgot Password | User email | "Your HiroMetrics Password" | Temporary password shown |

**Important details from email specs:**
- Welcome email includes Login URL and Username (email address) explicitly
- Password is sent in a SEPARATE email from the welcome email (two separate sends)
- Manager creation = two emails: welcome first, then password second
- Invitation email says "This is an invitation from [ORG NAME] to HiroMetrics"
- All emails CC'd to HM monitoring address for audit purposes
- Forgot password = same template as initial password email

---

## Revised Scoring Base Scores (from Scoring_Metrics sheet)

| Category                  | Base Score | Notes |
|---------------------------|------------|-------|
| Academics (ACD)           | 200        | Down from 250 in earlier draft |
| Experience (EXP)          | 200        | Down from 350 in earlier draft |
| References (REF)          | 200        | Up from 150 in earlier draft |
| Awards (AWD)              | 50         | Unchanged |
| Certifications (CRT)      | 100        | Up from 25, separate from AWD |
| Attendance & Memberships  | 50         | Unchanged |
| **TOTAL MAXIMUM**         | **800**    | Same total, different distribution |

Note: Base scores are REVISED from the V1 Excel draft. 
These workbook values (ACD=200, EXP=200, REF=200, CRT=100, AWD=50, ATM=50) 
should be treated as the current working version.


---

## Gap Resolutions — All 10 Confirmed

1. SCORING BASE SCORES: Use workbook values (ACD=200, EXP=200, REF=200, CRT=100, AWD=50, ATM=50).
   CRITICAL: No hardcoded values. All weights, base scores, and factors must be
   configurable via UI (HM Admin scoring model editor) or spreadsheet import.
   Implement as database-driven ScoreModelConfig table.

2. ATM CATEGORY: Renamed "Awards & Memberships" (not Attendance). Keep as
   placeholder — data model only, no activation, no auth codes yet.

3. RESUME MISMATCH: Analyst starts at 0 (no mismatch baseline). Points
   subtracted per mismatch finding up to -200 max. Penalty values TBD —
   Full MVP only. Stub the category, implement computation later.

4. CANDIDATE SELF-PAY: Candidate can request and pay for their own evaluation.
   Pre-validates them proactively. They receive a full shareable verified report.
   Full MVP only — stub payment trigger type in data model.

5. FOLDER VISIBILITY & REASSIGNMENT:
   - Folder visible to: the owning manager + Customer Admin for that org
   - Customer Admin can reassign any folder to another manager
   - Manager can reassign their own folders to another manager
   - Archive closes the folder to new applications

6. CONDITIONAL ^ PERMISSIONS (Customer Manager):
   Manager must be a registered HM user AND have accepted T&C before
   being granted Manager-level portal access. Registration + T&C = unlock.

7. CONDITIONAL ^ PERMISSIONS (HM QA User):
   Same rule — must be registered and T&C-accepted before QA access granted.

8. ARCHIVAL/RETRIEVAL:
   - Folders can be Archived when a position closes
   - Archived folders: no new applications accepted, read-only
   - Only Super Admin, Customer Admin, Customer Manager can retrieve archived data
   - Active vs Archived is a folder status toggle

9. I-94 VERIFICATION: In scope for Full MVP. DTI-DIWI and DTI-DDMI codes
   remain in the scoring model. Revisit implementation during Full MVP build.

10. SHARE LINK BEHAVIOR: SNAPSHOT model confirmed.
    - Profile version is frozen at time of sharing
    - Employer always sees the version that was submitted, not live profile
    - Link expiry timeframe TBD (3/6/9 months options) — implement expiry
      mechanism now, leave duration configurable
    - Each share link stores: profile_snapshot (JSONB), shared_at, expires_at,
      profile_version_id for audit trail


---

## Customer Onboarding & Domain Security Model

### How HM onboards a new customer organization

1. HM establishes formal relationship with customer (written communication)
2. HM identifies the Customer HM Admin (a named person with company email)
3. HM Super Admin creates the Customer Admin account in the system
4. System sends credentials email to Customer Admin (email #3 from email spec)
   — Welcome email with username, separate email with temp password
5. Customer Admin logs in, accepts T&C, changes password
6. Customer Admin can then invite their internal managers
7. All invited managers must register with their company domain email

### Domain Enforcement Rule (CRITICAL SECURITY & INTEGRITY MECHANISM)

ALL accounts within a customer organization must use the company's
registered domain. If the organization is registered as "acme.com",
then every user in that org must have an email ending in @acme.com.

**Implementation rules:**
- When HM creates the Customer Admin account, the org domain is extracted
  from their email and stored on the Organization record (org_domain field)
- When Customer Admin invites a manager, the invited email is validated
  against org_domain before the invitation is sent
- When an invited user registers, their registration email must match org_domain
- If email domain does not match → registration is rejected with clear error
- HM staff accounts are validated against hirometrics.com domain
- Candidates are exempt from domain restriction (they use personal emails)

**This enforces:**
- No rogue accounts created under a customer's organization
- Every user is verifiably tied to their employer via corporate email
- HM can trust that org_id + email = verified organizational identity
- Prevents a vendor from adding external/personal emails to their org

### New fields required:

ORGANIZATIONS:
+ org_domain (string, extracted from admin email, e.g. "acme.com")
+ onboarded_by (FK → users, the HM staff who created the account)
+ onboarded_at (timestamp)
+ formal_agreement_ref (string, reference to written agreement)

USERS:
+ email_domain (string, extracted on registration, indexed)
+ invited_by (FK → users, who sent the invitation)
+ invitation_id (FK → enrollment_invitations)

### Email domain validation logic:

def validate_org_email(email: str, org_domain: str) -> bool:
    return email.lower().endswith(f"@{org_domain.lower()}")

Applied at:
1. Manager invitation creation (before email is sent)
2. Manager registration (before account is created)
3. Any user added to an organization (admin action)

Candidates bypass this check — they register independently
with personal emails and are not tied to any org domain.

### HM Staff onboarding (separate flow):
- Only HM Super Admin can create HM staff accounts
- All HM staff must use @hirometrics.com email
- Same domain validation applies: org_domain = "hirometrics.com" for HM org

