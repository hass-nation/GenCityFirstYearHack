# HE - Person 1 Progress

**Project:** PC Pet
**Owner:** HE (Person 1)
**Branch:** `feature/accounts`
**Updated:** 21 November 2026

## Feature status

| Area | Status | Details |
|---|---|---|
| Accounts | Implemented and checked | Signed-in users can edit their display name and email, and change their password after confirming the current password. |
| Settings | Implemented and checked | The daily-reminders preference is saved. The page clearly says reminders are not sent yet. |
| Data management | Implemented and checked | `/data` displays the saved account and settings fields except password credentials. |
| Logins and sign-ups | Implemented and tested | Sign-up, sign-in, sign-out, password hashing, duplicate-email handling, sessions, and CSRF protection are covered. |
| Privacy page | Implemented and checked | Public `/privacy` explains collected data, purpose, storage, retention, and user controls. It is linked from the footer. |
| Data export/deletion | Implemented and tested | `/account/export` downloads account data without a password hash. `/account/delete` requires the exact text `DELETE`. |

## Verification

- `python -m unittest discover -s tests`: 10 tests passed.
- Started the Flask app with `python app.py` and checked `/account`, `/settings`, `/data`, `/privacy`, export, and deletion over `http://127.0.0.1:5000`.
- The temporary account created for the HTTP checks was deleted.

## Main files

- `app.py` - Flask account routes, sessions, CSRF checks, profile updates, password changes, data export, and deletion.
- `account_store.py` - SQLite account and settings schema.
- `templates/` - Account, settings, data, privacy, authentication, and deletion pages.
- `static/style.css` - Dark and green styles, including mobile navigation and layouts.
- `tests/test_accounts.py` - Standard-library `unittest` coverage for account flows.

## Not done yet

- Reminder sending; only the user's preference is saved.
- Password reset.
- Login rate limiting.
- Per-user pet and task data. Until those features are connected to user accounts, export and deletion cover account data only.
- Email verification.

## Integration note

This account feature uses Flask, Jinja, vanilla CSS, and SQLite. The pet and task parts of the repository still need to be integrated with the Flask app and account IDs before their data can be included in account export and deletion.
