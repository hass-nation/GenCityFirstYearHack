"""Minimal account email delivery using SMTP or development-only console links."""

import smtplib
import ssl
from email.message import EmailMessage

from flask import current_app


def send_account_email(recipient, subject, body):
    backend = current_app.config["MAIL_BACKEND"]
    if backend == "console":
        current_app.logger.info(
            "Development account email\nTo: %s\nSubject: %s\n%s", recipient, subject, body
        )
        return

    if backend != "smtp":
        raise ValueError("MAIL_BACKEND must be 'console' or 'smtp'.")

    host = current_app.config["MAIL_HOST"]
    sender = current_app.config["MAIL_FROM"]
    if not host or not sender:
        raise RuntimeError("MAIL_HOST and MAIL_FROM are required for SMTP delivery.")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(host, current_app.config["MAIL_PORT"], timeout=15) as smtp:
            if current_app.config["MAIL_USE_TLS"]:
                smtp.starttls(context=ssl.create_default_context())
            username = current_app.config["MAIL_USERNAME"]
            if username:
                smtp.login(username, current_app.config["MAIL_PASSWORD"])
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise RuntimeError("Account email could not be delivered.") from exc
