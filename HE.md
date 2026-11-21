# HE — Person 1 Progress

**Project:** PC Pet
**Owner:** HE (Person 1)
**Branch:** `feature/accounts`
**Updated:** 21 November 2026

## My feature area

Person 1 owns accounts, settings, data management, sign-ups and logins, the privacy/data page, and account data export/deletion.

## Progress so far

| Area | Status | Details |
|---|---|---|
| Accounts | Have not started | The existing account page is groundwork; the dedicated Accounts task has not started. |
| Settings | Have not started | The existing page has basic profile and reminder controls; the dedicated Settings task has not started. |
| Data management | Have not started | Export and deletion actions exist; the dedicated data-management task has not started. |
| Logins and sign-ups | Implemented | Added email/password registration, sign-in, sign-out, duplicate-email handling, password hashing, and session-based authentication. |
| Privacy/data page | Have not started | The account page has links to export and delete; a dedicated privacy/data page has not started. |
| Data export/deletion | Implemented | Signed-in users can download profile/settings as JSON or permanently delete their account after typing `DELETE`. |

## Implementation

- Flask routes and sessions: `app.py`
- SQLite account and settings storage: `account_store.py`
- Jinja pages: `templates/auth.html`, `templates/account.html`, and `templates/delete_account.html`
- Styling: `static/style.css`
- Flask dependency: `requirements.txt`

Passwords are stored as Werkzeug password hashes, not as plain text. Forms include CSRF tokens. Account settings are stored in SQLite under the ignored `instance/` directory.

## Next steps

1. Split profile details and reminder preferences into distinct Accounts and Settings pages.
2. Add dedicated Data Management and Privacy/Data pages, linked from the account navigation.
3. Review the export contents and deletion behavior after tasks and pet data are connected to the same user account.
4. Connect the Flask account flows to the team's Flask dashboard and remove the remaining React scaffold when the team is ready to integrate.
5. Run the app locally, verify the flows, then commit and push `feature/accounts` for the team.

## Current integration note

The account flow is implemented in Flask, but the repository still contains the original React scaffold for the pet and task features. Those features need to be migrated or integrated before the complete project runs as one Flask app. This progress file documents the current state of Person 1's work; it does not claim the full app is finished.
