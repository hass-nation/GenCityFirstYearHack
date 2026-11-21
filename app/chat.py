"""Server-side Cortex chat for the Flask pet room."""

import json
import os
import re
from urllib.parse import quote, urlsplit

import requests
from flask import Blueprint, jsonify, render_template, request, session

from backend.api import current_user

pet_chat = Blueprint("pet_chat", __name__)
HISTORY_MESSAGES = 6


def _agent_config():
    account = os.environ.get("SNOWFLAKE_ACCOUNT_URL", "").strip().rstrip("/")
    token = os.environ.get("SNOWFLAKE_TOKEN", "").strip()
    database = os.environ.get("PET_AGENT_DB", "").strip()
    schema = os.environ.get("PET_AGENT_SCHEMA", "").strip()
    name = os.environ.get("PET_AGENT_NAME", "").strip() or "PC_PET_AGENT"
    parsed = urlsplit(account)
    if not all((token, database, schema)) or parsed.scheme != "https" or not parsed.hostname:
        return None
    if parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        return None
    db, schema, name = (quote(value, safe="") for value in (database, schema, name))
    return f"{account}/api/v2/databases/{db}/schemas/{schema}/agents/{name}:run", token


def _text(value, limit):
    return value.strip()[:limit] if isinstance(value, str) else ""


def _number(value):
    return value if type(value) is int and 0 <= value <= 1_000_000 else "unknown"


def _scripted_reply(user_text, name):
    if re.search(r"\b(hello|hi|hey)\b", user_text, re.I):
        return "Hi there! I'm so glad you're here. What shall we do together?"
    if re.search(r"\b(sad|bad|hard|stress|tired|worry)\b", user_text, re.I):
        return "That sounds like a lot. Let's take one small thing at a time. I'm right here with you. 💜"
    if re.search(r"\b(task|study|work|homework|focus)\b", user_text, re.I):
        return "You've got this! A tiny first step counts. Finish a task and we'll earn 20 XP together."
    if re.search(r"\b(play|game|fun)\b", user_text, re.I):
        return "Play time! Use the Play button and I'll get a happiness boost (and 5 XP!)."
    if re.search(r"\b(food|eat|hungry|snack)\b", user_text, re.I):
        return "A snack sounds lovely. Tap Feed and I'll feel much better! 🍓"
    if re.search(r"\b(thanks|thank you)\b", user_text, re.I):
        return f"Always, {name}! You're doing great. ✨"
    return "I like chatting with you! Tell me about your day, or we can take a break together. ✨"


def _message(role, text):
    return {"role": role, "content": [{"type": "text", "text": text}]}


def _assistant_text(payload):
    if not isinstance(payload, dict) or payload.get("role", "assistant") != "assistant":
        return ""
    content = payload.get("content")
    if not isinstance(content, list):
        return ""
    parts = []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            text = _text(item.get("text"), 4000)
            if text:
                parts.append(text)
    return "\n".join(parts)[:4000]


def ask_pet(user_text, pet, next_task, streak, history):
    """Return a reply and source given history as (role, text) pairs."""
    next_task = next_task or {}
    name = _text(pet.get("name"), 32) or "Biscuit"
    mood = _text(pet.get("mood"), 24) or "unknown"
    title = _text(next_task.get("title"), 120)
    due = _text(next_task.get("dueAt"), 32)
    task_context = f"{title!r} due {due}" if title and due else repr(title) if title else "unknown"
    context = (
        f"[pet: name={name}, mood={mood}, level={_number(pet.get('level'))}, "
        f"xp={_number(pet.get('xp'))}; streak={_number(streak)} days; next task: {task_context}]"
    )
    messages = [_message(role, text) for role, text in history[-HISTORY_MESSAGES:]
                if role in {"user", "assistant"}]
    messages.append(_message("user", f"{context}\n{user_text}"))

    try:
        config = _agent_config()
        if config:
            url, token = config
            response = requests.post(url, headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }, json={"stream": False, "messages": messages}, timeout=8, allow_redirects=False)
            response.raise_for_status()
            reply = _assistant_text(response.json())
            if reply:
                return {"reply": reply, "source": "agent"}
    except (requests.RequestException, ValueError):
        pass
    return {"reply": _scripted_reply(user_text, name), "source": "scripted"}


@pet_chat.get("/pet")
def room():
    return render_template("pet.html")


@pet_chat.post("/pet/chat")
def chat():
    request.max_content_length = 8192
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not (message := _text(payload.get("message"), 180)):
        return jsonify(reply="Say something when you're ready. I’m here!", source="scripted")

    context = payload.get("context")
    context = context if isinstance(context, dict) else {}
    pet = context.get("pet")
    pet = pet if isinstance(pet, dict) else {}
    next_task = context.get("next_task")
    next_task = next_task if isinstance(next_task, dict) else {}
    user = current_user()
    scope = user["id"] if user else None
    if user:
        pet = {**pet, "name": user["pet_name"]}

    history = session.get("pet_chat_history", []) if session.get("pet_chat_user") == scope else []
    result = ask_pet(message, pet, next_task, context.get("streak"), history)
    # Keep complete exchanges small enough for Flask's signed session cookie.
    remembered = [("user", message), ("assistant", result["reply"][:280])]
    history = (history + remembered)[-HISTORY_MESSAGES:]
    while len(json.dumps(history)) > 2600:
        history = history[2:]
    session["pet_chat_history"] = history
    session["pet_chat_user"] = scope
    return jsonify(result)
