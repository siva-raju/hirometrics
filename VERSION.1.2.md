# HiroMetrics — v1.2 (Phase 2: Employer Enhancements)
**Date:** 2026-04-26
**Tag:** v1.2-phase2-employer-enhancements
**Base:** v1.1-candidate-inbox-sent

## Spec sources
- HM_Job_Lifecycle_and_ID_Model.docx §10, §11
- HM_Unified_Lifecycle_Spec_v1_0.docx §9

## Changes from v1.1

### New pages
- `EmployerArchive.tsx` → `src/pages/employer/Archive.tsx` (NEW)

### Modified frontend
- `Folders.tsx` — Additional Information section (collapsed by default): Skill Set, Location, Work Mode, Duration, Start Date, Work Authorization
- `FolderDetail.tsx` — Consistency column (🟢🟡🔴), ⓘ tooltip, View Discrepancies action, Disclaimer text
- `AppLayout.tsx` — Archive nav item added for employer
- `App.tsx` — /employer/archive route added

### Modified backend
- `folders.py` — FolderCreate schema + folder_to_dict updated with 6 new fields
- `applications.py` — consistency_score and discrepancies returned in folder apps response
- `ensure_schema.py` — 8 new DB columns added

## Rollback to v1.1
Copy all files from v1.1-candidate-inbox-sent/ back, plus restore folders.py, applications.py, ensure_schema.py from v1.0.
