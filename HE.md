# HE - Person 1 Progress

**Project:** PC Pet
**Owner:** HE (Person 1)
**Branch:** `feature/accounts`
**Updated:** 21 November 2026

## Feature status

| Area | Status | Details |
|---|---|---|
| Accounts and settings | Implemented and tested | Profile name/email editing, current-password-confirmed password changes, and the daily-reminders preference. The UI says reminders are not sent yet. |
| Sign-up and sign-in | Implemented and tested | Password hashes, session sign-in/out, CSRF protection, email verification, login throttling, and generic reset/resend responses. |
| Password recovery | Implemented and tested | Single-use reset links expire after one hour. Verification links expire after 24 hours. Repeated verification/reset email requests are limited. |
| Privacy and data management | Implemented and tested | Public privacy page; `/data` lists account, settings, task, and pet fields without password hashes or token secrets. |
| Export and deletion | Implemented and tested | JSON export contains account/settings/task/pet rows. Exact `DELETE` confirmation deletes the account; linked records cascade through SQLite foreign keys. |

## Verification

- `python -m unittest discover -s tests`: 13 tests passed.
- The tests cover verification and reset flows, login limits, CSRF, settings, profile/password changes, data export, and deletion cascades.
- Started `python app.py` and checked public pages, signed-out redirects, and signed-in `/account`, `/settings`, `/data`, `/privacy`, export, and delete pages at `http://127.0.0.1:5000`. The temporary HTTP-check account was removed.
- Outbound SMTP delivery has not been exercised because no SMTP credentials/provider are configured. Development mode logs verification/reset links to the server console.

## Data model for integration

- `users`: `id`, `email`, `display_name`, `password_hash`, `created_at`, `email_verified`.
- `user_settings`: `user_id`, `daily_reminders`.
- `tasks`: `id`, `user_id`, `title`, `done`, `due_at`, `completed_at`, `created_at`.
- `pets`: `user_id`, `name`, `hunger`, `happiness`, `energy`, `xp`, `level`, `avatar`, `room_theme`, `updated_at`.
- `tasks.user_id` and `pets.user_id` reference `users.id` with `ON DELETE CASCADE`. Pet/task endpoints and UI still need to be connected to this account schema by the feature owners.

## Not done yet

- Sending daily reminders; only the preference is saved.
- Connecting the task and pet UI/API to the account-owned tables. Until that integration is done, other app features may not save their progress in these tables.
- Configure and verify real SMTP delivery for a deployed environment. Production also needs `FLASK_SECRET_KEY` and HTTPS `PUBLIC_BASE_URL` configured.
- At-rest encryption for the SQLite database and an automatic retention/deletion schedule are not configured.

## Main files

- `app.py` - Flask account routes, CSRF, sessions, verification/reset, throttling, export, and deletion.
- `account_store.py` - SQLite schema and account-linked settings/task/pet tables.
- `account_mail.py` - console development mail and configurable SMTP delivery.
- `templates/` and `static/style.css` - account, settings, data, privacy, and authentication UI.
- `tests/test_accounts.py` - stdlib `unittest` coverage.
