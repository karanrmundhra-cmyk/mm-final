"""Telegram bot for Mind Matters v3.
Long-poll getUpdates. Commands: /tasks /briefing /add /remind /find /help
"""
import os, asyncio, json, logging, re
from datetime import datetime, timezone, timedelta
import httpx

TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
BASE = f"https://api.telegram.org/bot{TG_TOKEN}"
logger = logging.getLogger("mm-tg")

_pending_state: dict = {}

async def tg_send(chat_id, text: str, parse_mode: str = "Markdown", reply_markup=None):
    if not TG_TOKEN:
        return
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(f"{BASE}/sendMessage", json=payload)
        except Exception as e:
            logger.warning(f"tg_send error: {e}")

async def tg_send_document(chat_id, filename: str, data: bytes, caption: str = ""):
    if not TG_TOKEN:
        return
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            files = {"document": (filename, data, "application/pdf")}
            data_form = {"chat_id": str(chat_id)}
            if caption:
                data_form["caption"] = caption
            await client.post(f"{BASE}/sendDocument", data=data_form, files=files)
        except Exception as e:
            logger.warning(f"tg_send_document error: {e}")

async def _get_updates(offset: int = 0):
    async with httpx.AsyncClient(timeout=35) as client:
        try:
            r = await client.get(f"{BASE}/getUpdates",
                                 params={"offset": offset, "timeout": 30})
            return r.json().get("result", [])
        except Exception:
            return []

async def _get_user_by_chat(chat_id: int):
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "mind_matters")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    user = await db.users.find_one({"tg_chat_id": chat_id}, {"_id": 0})
    client.close()
    return user

async def _get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "mind_matters")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name], client

def _today():
    return datetime.now(timezone.utc).date().isoformat()

def _tomorrow():
    return (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()

async def _handle_start(chat_id: int, text: str):
    parts = text.strip().split()
    code = parts[1] if len(parts) > 1 else ""
    if code:
        db, client = await _get_db()
        try:
            link = await db.tg_links.find_one({"code": code})
            if link:
                user_id = link["user_id"]
                await db.users.update_one({"id": user_id}, {"$set": {"tg_chat_id": chat_id}})
                await db.tg_links.delete_one({"_id": link["_id"]})
                user = await db.users.find_one({"id": user_id})
                name = user.get("first_name","") if user else "there"
                await tg_send(chat_id, f"✅ Telegram linked! Welcome, {name}.\n\nTry /tasks or /briefing")
                return
        finally:
            client.close()
    await tg_send(chat_id,
        "👋 *Mind Matters* — your personal OS.\n\n"
        "To link your account: open the app → Settings → Telegram → Get link.\n\n"
        "Once linked, use:\n"
        "/tasks — today's tasks\n/briefing — daily summary\n"
        "/add [text] — capture anything\n/remind [text] — set reminder\n"
        "/find [query] — search\n/help — all commands")

async def _handle_tasks(chat_id: int, user_id: str):
    db, client = await _get_db()
    try:
        today = _today()
        pending = await db.tasks.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "status": {"$nin": ["Completed","Done"]}},
            {"_id": 0, "task": 1, "date": 1, "name": 1}
        ).sort("date", 1).limit(10).to_list(10)
        overdue = [t for t in pending if t.get("date") and t["date"] < today]
        due_today = [t for t in pending if t.get("date") == today]
        upcoming = [t for t in pending if not t.get("date") or t["date"] > today]
        done_count = await db.tasks.count_documents(
            {"user_id": user_id, "deleted": {"$ne": True},
             "status": {"$in": ["Completed","Done"]},
             "updated_at": {"$gte": today}})
        msg = f"📋 *Your tasks today* ({today})\n\n"
        if overdue:
            msg += f"🔴 *Overdue ({len(overdue)})*\n"
            for t in overdue[:5]:
                days = (datetime.fromisoformat(today) - datetime.fromisoformat(t['date'])).days
                msg += f"  • {t['task']} ({days}d overdue)\n"
            msg += "\n"
        if due_today:
            msg += f"📅 *Due today ({len(due_today)})*\n"
            for t in due_today[:5]:
                msg += f"  • {t['task']}" + (f" · {t['name']}" if t.get('name') else "") + "\n"
            msg += "\n"
        if upcoming:
            msg += f"⏳ *Upcoming ({len(upcoming)})*\n"
            for t in upcoming[:3]:
                d = t.get('date','—')
                msg += f"  • {t['task']} ({d})\n"
            msg += "\n"
        if done_count:
            msg += f"✅ Done today: {done_count}\n"
        if not pending:
            msg = "✅ *No pending tasks!* Great work.\n\nUse /add to capture new tasks."
        await tg_send(chat_id, msg)
    finally:
        client.close()

async def _handle_briefing(chat_id: int, user_id: str):
    db, client = await _get_db()
    try:
        today = _today()
        now_dt = datetime.now(timezone.utc)
        overdue = await db.tasks.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "status": {"$nin":["Completed","Done"]}, "date": {"$lt": today, "$ne": None}},
            {"_id": 0, "task": 1, "date": 1}
        ).limit(5).to_list(5)
        due_today = await db.tasks.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "status": {"$nin":["Completed","Done"]}, "date": today},
            {"_id": 0, "task": 1}
        ).limit(5).to_list(5)
        reminders_today = await db.reminders.find(
            {"user_id": user_id, "deleted": {"$ne": True}, "sent": False,
             "fire_at": {"$gte": today, "$lte": today + "T23:59:59"}},
            {"_id": 0, "title": 1, "fire_at": 1}
        ).limit(5).to_list(5)
        month_start = today[:7] + "-01"
        txns = await db.transactions.find(
            {"user_id": user_id, "deleted": {"$ne": True}, "date": {"$gte": month_start}},
            {"_id": 0, "amount": 1, "category": 1}
        ).to_list(1000)
        income = sum(t["amount"] for t in txns if t.get("category") == "Income")
        expense = sum(t["amount"] for t in txns if t.get("category") == "Expense")
        greeting = "Good morning" if now_dt.hour < 12 else "Good afternoon" if now_dt.hour < 17 else "Good evening"
        msg = f"☀️ *{greeting}! Briefing for {today}*\n\n"
        if overdue:
            msg += f"🔴 *Urgent — Overdue ({len(overdue)})*\n"
            for t in overdue:
                msg += f"  • {t['task']}\n"
            msg += "\n"
        if due_today:
            msg += f"📅 *Due today ({len(due_today)})*\n"
            for t in due_today:
                msg += f"  • {t['task']}\n"
            msg += "\n"
        if reminders_today:
            msg += f"🔔 *Reminders today*\n"
            for r in reminders_today:
                t = r['fire_at'][11:16] if len(r['fire_at']) > 10 else ""
                msg += f"  • {t} — {r['title']}\n"
            msg += "\n"
        msg += f"💰 *Month finances*\n  Income: ₹{income:,.0f} | Expenses: ₹{expense:,.0f}\n\n"
        if overdue:
            msg += f"⚡ *Top action*\nComplete: {overdue[0]['task']}"
        else:
            msg += "⚡ *All clear!* No overdue items."
        await tg_send(chat_id, msg)
    finally:
        client.close()

async def _handle_add(chat_id: int, user_id: str, text: str):
    content = text.replace("/add","").strip()
    if not content:
        await tg_send(chat_id, "What would you like to add?\n\nExample: /add Call Priya about Q2 deck tomorrow")
        return
    _pending_state[chat_id] = {"action": "add_choose_type", "content": content}
    markup = {"inline_keyboard": [[
        {"text": "📋 Task", "callback_data": "add_task"},
        {"text": "🔔 Reminder", "callback_data": "add_reminder"},
        {"text": "📝 Note", "callback_data": "add_note"},
    ]]}
    await tg_send(chat_id, f"*What type?*\n\n\"{content}\"", reply_markup=markup)

async def _handle_remind(chat_id: int, user_id: str, text: str):
    content = text.replace("/remind","").strip()
    if not content:
        await tg_send(chat_id, "What to remind you about?\n\nExample: /remind May 25 at 9am call Priya")
        return
    db, client = await _get_db()
    try:
        import uuid as _uuid
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        llm_key = os.environ.get("EMERGENT_LLM_KEY","")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:00")
        if llm_key:
            try:
                chat = LlmChat(api_key=llm_key, session_id=str(_uuid.uuid4()),
                               system_prompt=f"Parse reminder. Return JSON: {{title, fire_at (ISO), recurrence}}. Now is {today}.").with_model("gemini","gemini-2.0-flash")
                resp = await chat.send_message(UserMessage(text=content))
                raw = resp.text if hasattr(resp,"text") else str(resp)
                data = json.loads(raw.strip().strip("```json").strip("```").strip())
            except Exception:
                data = {"title": content, "fire_at": today, "recurrence": "none"}
        else:
            data = {"title": content, "fire_at": today, "recurrence": "none"}
        import uuid as _uuid2
        now_iso = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": str(_uuid2.uuid4()), "user_id": user_id,
            "title": data.get("title", content),
            "fire_at": data.get("fire_at", today),
            "recurrence": data.get("recurrence","none"),
            "notes": "", "sent": False, "source_type": "telegram",
            "created_at": now_iso, "updated_at": now_iso, "deleted": False
        }
        await db.reminders.insert_one(doc)
        await tg_send(chat_id,
            f"✅ *Reminder set!*\n\n"
            f"📌 {doc['title']}\n"
            f"📅 {doc['fire_at'][:16].replace('T',' ')}\n"
            f"🔁 {doc['recurrence']}")
    finally:
        client.close()

async def _handle_find(chat_id: int, user_id: str, text: str):
    query = text.replace("/find","").strip()
    if not query:
        await tg_send(chat_id, "What are you looking for?\n\nExample: /find invoices")
        return
    db, client = await _get_db()
    try:
        pattern = {"$regex": query, "$options": "i"}
        results = []
        tasks = await db.tasks.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "$or": [{"task": pattern},{"details": pattern}]},
            {"_id": 0, "task": 1}
        ).limit(3).to_list(3)
        for t in tasks:
            results.append(f"📋 Task: {t['task']}")
        notes = await db.notes.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "$or": [{"title": pattern},{"body": pattern}]},
            {"_id": 0, "title": 1}
        ).limit(3).to_list(3)
        for n in notes:
            results.append(f"📝 Note: {n['title']}")
        txns = await db.transactions.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "$or": [{"vendor": pattern},{"details": pattern}]},
            {"_id": 0, "vendor": 1, "amount": 1}
        ).limit(3).to_list(3)
        for t in txns:
            results.append(f"💰 Transaction: ₹{t.get('amount',0):,.0f} — {t.get('vendor','')}")
        people = await db.people.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "$or": [{"name": pattern},{"email": pattern}]},
            {"_id": 0, "name": 1, "relationship": 1}
        ).limit(3).to_list(3)
        for p in people:
            results.append(f"👤 Person: {p['name']} ({p.get('relationship','')})")
        if results:
            msg = f"🔍 *Found {len(results)} results for \"{query}\"*\n\n" + "\n".join(results)
        else:
            msg = f"🔍 No results for \"{query}\".\n\nTry different keywords."
        await tg_send(chat_id, msg)
    finally:
        client.close()

async def _handle_help(chat_id: int):
    await tg_send(chat_id,
        "📖 *Mind Matters commands*\n\n"
        "/tasks — Show today's tasks\n"
        "/briefing — Get AI daily summary\n"
        "/add [text] — Capture task/reminder/note\n"
        "/remind [text] — Quick reminder\n"
        "/find [query] — Search your data\n"
        "/help — Show this help\n\n"
        "*Examples:*\n"
        "  /add Call Priya about Q2 deck tomorrow\n"
        "  /remind May 25 at 9am follow up with Rajesh\n"
        "  /find invoices\n"
        "  /tasks\n\n"
        "[Open app](" + os.environ.get("APP_BASE_URL","http://localhost:3000") + ")")

async def _handle_callback(callback_query: dict):
    chat_id = callback_query["message"]["chat"]["id"]
    data = callback_query.get("data","")
    user = await _get_user_by_chat(chat_id)
    if not user:
        await tg_send(chat_id, "Please link your account first. Open the app → Settings → Telegram.")
        return
    user_id = user["id"]
    state = _pending_state.get(chat_id, {})
    if data in ("add_task","add_reminder","add_note") and state.get("action") == "add_choose_type":
        content = state.get("content","")
        db, client = await _get_db()
        try:
            import uuid as _uuid
            now_iso = datetime.now(timezone.utc).isoformat()
            if data == "add_task":
                doc = {"id": str(_uuid.uuid4()), "user_id": user_id,
                       "task": content, "name": "", "details": "", "status": "Pending",
                       "group": "", "flagged": False, "sr_no": 1, "order_index": 1,
                       "attachments": [], "people_ids": [], "deleted": False,
                       "created_at": now_iso, "updated_at": now_iso}
                await db.tasks.insert_one(doc)
                await tg_send(chat_id, f"✅ *Task added!*\n\n📋 {content}\nStatus: Pending")
            elif data == "add_reminder":
                tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%dT09:00:00")
                doc = {"id": str(_uuid.uuid4()), "user_id": user_id,
                       "title": content, "fire_at": tomorrow,
                       "recurrence": "none", "notes": "", "sent": False,
                       "created_at": now_iso, "updated_at": now_iso, "deleted": False}
                await db.reminders.insert_one(doc)
                await tg_send(chat_id, f"✅ *Reminder added!*\n\n🔔 {content}\nTime: tomorrow 9am")
            elif data == "add_note":
                doc = {"id": str(_uuid.uuid4()), "user_id": user_id,
                       "title": content[:60], "body": content,
                       "tags": [], "pinned": False, "vault": False,
                       "attachments": [], "people_ids": [],
                       "created_at": now_iso, "updated_at": now_iso, "deleted": False}
                await db.notes.insert_one(doc)
                await tg_send(chat_id, f"✅ *Note added!*\n\n📝 {content[:60]}")
            _pending_state.pop(chat_id, None)
        finally:
            client.close()

async def tg_poll_loop():
    if not TG_TOKEN:
        return
    offset = 0
    logger.info("Telegram poll loop started")
    while True:
        try:
            updates = await _get_updates(offset)
            for update in updates:
                offset = update["update_id"] + 1
                if "callback_query" in update:
                    await _handle_callback(update["callback_query"])
                    continue
                msg = update.get("message", {})
                if not msg:
                    continue
                chat_id = msg["chat"]["id"]
                text = msg.get("text","").strip()
                if not text:
                    continue
                if text.startswith("/start"):
                    await _handle_start(chat_id, text)
                    continue
                user = await _get_user_by_chat(chat_id)
                if not user:
                    await tg_send(chat_id, "Please link your account. Open Mind Matters → Settings → Telegram → Get Link")
                    continue
                uid = user["id"]
                if text.startswith("/tasks"):
                    await _handle_tasks(chat_id, uid)
                elif text.startswith("/briefing"):
                    await _handle_briefing(chat_id, uid)
                elif text.startswith("/add"):
                    await _handle_add(chat_id, uid, text)
                elif text.startswith("/remind"):
                    await _handle_remind(chat_id, uid, text)
                elif text.startswith("/find"):
                    await _handle_find(chat_id, uid, text)
                elif text.startswith("/help"):
                    await _handle_help(chat_id)
                else:
                    state = _pending_state.get(chat_id)
                    if state:
                        pass
                    else:
                        await tg_send(chat_id, "Use /help to see available commands.")
        except Exception as e:
            logger.warning(f"Poll loop error: {e}")
            await asyncio.sleep(5)

async def reminder_loop():
    pass

async def digest_loop():
    pass
