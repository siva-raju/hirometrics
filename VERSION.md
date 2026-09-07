# HiroMetrics — v1.1 (Phase 1: Candidate Inbox/Sent)
**Date:** 2026-04-26
**Tag:** v1.1-candidate-inbox-sent
**Base:** v1.0-pre-spec-reconciliation
**Status:** Phase 1 complete

## Spec source
- HM_Candidate_Dashboard_Spec_v2.docx (Doc 1)

## Changes from v1.0

### Candidate nav restructure
- REMOVED: Share Links, Invitations, Responses
- ADDED: Inbox, Sent

### New pages (frontend)
- `CandidateInbox.tsx` → `src/pages/applicant/CandidateInbox.tsx` (NEW FILE)
- `CandidateSent.tsx`  → `src/pages/applicant/CandidateSent.tsx` (NEW FILE)

### Modified files
- `AppLayout.tsx` — candidate nav updated (Share Links/Invitations/Responses → Inbox/Sent)
- `App.tsx` — new routes added (/applicant/inbox, /applicant/sent); legacy routes kept
- `api.ts` — added getMyJobLinks(), removeJobLink() stubs
- `invitations.py` — added /my-job-links and /job-links/{id} stub endpoints

## Rollback to v1.0
Copy all files from v1.0-pre-spec-reconciliation/ back to the project.

## Inbox Features
- Unified table: Type (Invite/Link) | Job Title | Source | Date | Actions
- Invite actions: View, Apply, Decline
- Link actions: View, Apply, Generate Link, Remove
- View modal: job details + Apply/Close
- Apply modal: cover message + T&C consent
- Generate Link modal: secure submission link with copy button

## Sent Features
- Table: Job Title | Submitted To | Date | Actions
- View Submission modal with profile link
- No status column (MVP per spec)

## Notes
- Job Links (type=Link) are stubbed — backend returns empty list until Phase 2
- Legacy /applicant/invitations and /applicant/responses routes kept for deep links
