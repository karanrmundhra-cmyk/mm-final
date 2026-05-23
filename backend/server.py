"""Mind Matters v3 — Personal Operating System backend.
FastAPI + MongoDB. JWT auth. All routes prefixed /api.
"""
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import (FastAPI, APIRouter, HTTPException, Depends,
                     UploadFile, File, Form, Header, Query, BackgroundTasks)
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone, timedelta, date
import os, io, asyncio, base64, time, uuid, secrets, logging, json, re
import jwt as pyjwt
import httpx
import bcrypt

import google.generativeai as genai

MONGO_URL   = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME     = os.environ.get("DB_NAME", "mind_matters")
JWT_SECRET  = os.environ.get("JWT_SECRET", "mind-matters-dev-secret")
LLM_KEY     = os.environ.get("EMERGENT_LLM_KEY", "")
TG_TOKEN    = os.environ.get("TELEGRAM_BOT_TOKEN", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Mind Matters API", version="3.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mind-matters")

# ─────────────────────── CORS ───────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────── helpers ───────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def today_key() -> str:
    return datetime.now(timezone.utc).date().isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def make_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp()),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

def _hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def _verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def _llm(system: str, user: str, session_id: str = None) -> str:
    if not LLM_KEY:
        return ""
    try:
        genai.configure(api_key=LLM_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system
        )
        resp = await asyncio.to_thread(model.generate_content, user)
        return resp.text if hasattr(resp, "text") else str(resp)
    except Exception as e:
        logger.warning(f"LLM error: {e}")
        return ""

async def _next_sr(collection, user_id: str, project_id: str = None) -> int:
    filt: dict = {"user_id": user_id, "deleted": {"$ne": True}}
    if project_id:
        filt["project_id"] = project_id
    last = await db[collection].find_one(filt, sort=[("sr_no", -1)])
    return (last["sr_no"] + 1) if last and last.get("sr_no") else 1

def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc

# ─────────────────────── models ───────────────────────
class User(BaseModel):
    id: str; email: str; first_name: str; last_name: str = ""
    picture: str = ""; created_at: str

class SignupReq(BaseModel):
    first_name: str; email: str; password: str; last_name: str = ""

class LoginReq(BaseModel):
    email: str; password: str

class DemoLoginReq(BaseModel):
    first_name: Optional[str] = "Friend"

class ForgotReq(BaseModel):
    email: str

class ResetReq(BaseModel):
    email: str; code: str; new_password: str

class ChangePassReq(BaseModel):
    current_password: str; new_password: str

class TaskIn(BaseModel):
    date: Optional[str] = None
    name: str = ""
    task: str
    details: str = ""
    status: str = "Pending"
    group: str = ""
    section_id: Optional[str] = None
    parent_id: Optional[str] = None
    flagged: bool = False
    project_id: Optional[str] = None
    attachments: List[Dict[str, Any]] = []
    people_ids: List[str] = []
    confidence: Optional[str] = None
    pending_review: bool = False

class Task(TaskIn):
    id: str; sr_no: int; order_index: int = 0
    user_id: str; created_at: str; updated_at: str
    deleted: bool = False; deleted_at: Optional[str] = None

class RoutineIn(BaseModel):
    group: str = ""
    name: str = ""
    activity: str
    details: str = ""
    frequency: str = "Daily"
    priority: str = "Medium"
    status: str = "Active"
    section_id: Optional[str] = None
    parent_id: Optional[str] = None
    flagged: bool = False
    project_id: Optional[str] = None
    attachments: List[Dict[str, Any]] = []
    people_ids: List[str] = []
    confidence: Optional[str] = None
    pending_review: bool = False

class Routine(RoutineIn):
    id: str; sr_no: int = 0; order_index: int = 0
    user_id: str; created_at: str; updated_at: str
    deleted: bool = False; deleted_at: Optional[str] = None

class TransactionIn(BaseModel):
    date: Optional[str] = None
    vendor: str = ""
    details: str = ""
    amount: float = 0
    category: Literal["Income","Expense","Asset","Liability"] = "Expense"
    mode: str = ""
    head: str = ""
    currency: str = "INR"
    interest_rate: Optional[float] = None
    interest_type: Optional[str] = None
    repayment_date: Optional[str] = None
    emi: Optional[float] = None
    section_id: Optional[str] = None
    project_id: Optional[str] = None
    attachments: List[Dict[str, Any]] = []
    people_ids: List[str] = []
    confidence: Optional[str] = None
    pending_review: bool = False

class Transaction(TransactionIn):
    id: str; sr_no: int; order_index: int = 0
    user_id: str; created_at: str; updated_at: str
    deleted: bool = False; deleted_at: Optional[str] = None

class NoteIn(BaseModel):
    title: str
    body: str = ""
    tags: List[str] = []
    pinned: bool = False
    vault: bool = False
    project_id: Optional[str] = None
    attachments: List[Dict[str, Any]] = []
    people_ids: List[str] = []

class Note(NoteIn):
    id: str; user_id: str; created_at: str; updated_at: str
    deleted: bool = False; deleted_at: Optional[str] = None

class ReminderIn(BaseModel):
    title: str
    fire_at: str
    recurrence: str = "none"
    custom_recurrence: str = ""
    notes: str = ""
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    project_id: Optional[str] = None
    people_ids: List[str] = []

class Reminder(ReminderIn):
    id: str; sr_no: int = 0; user_id: str; sent: bool = False
    created_at: str; updated_at: str
    deleted: bool = False; deleted_at: Optional[str] = None

class PersonIn(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    location: str = ""
    relationship: str = ""
    notes: str = ""
    tags: List[str] = []

class Person(PersonIn):
    id: str; user_id: str; created_at: str; updated_at: str
    last_interaction: Optional[str] = None
    deleted: bool = False; deleted_at: Optional[str] = None

class VaultDocIn(BaseModel):
    name: str
    doc_type: str = "Document"
    expiry_date: Optional[str] = None
    notes: str = ""
    data_url: str = ""
    mime: str = ""
    size: int = 0

class VaultDoc(VaultDocIn):
    id: str; user_id: str; created_at: str; updated_at: str
    deleted: bool = False; deleted_at: Optional[str] = None

class SectionIn(BaseModel):
    name: str; module: str; project_id: Optional[str] = None
    color: str = "#C9A961"; position: int = 0

class Section(SectionIn):
    id: str; user_id: str; created_at: str

class ProjectIn(BaseModel):
    name: str; color: str = "#C9A961"; description: str = ""

class Project(ProjectIn):
    id: str; user_id: str; created_at: str; updated_at: str

class CommentIn(BaseModel):
    body: str; resource_type: str; resource_id: str
    project_id: Optional[str] = None

class Comment(CommentIn):
    id: str; user_id: str; author_name: str; created_at: str

class PendingReviewIn(BaseModel):
    item_type: str; item_id: str; reason: str
    kind: str = "low_confidence"
    duplicate_of: Optional[str] = None

class DigestSettingsIn(BaseModel):
    enabled: bool = True; digest_hour: int = 9

# ─────────────────────── seed ───────────────────────
async def _seed_examples(user_id: str, project_id: str):
    user = await db.users.find_one({"id": user_id})
    if user and user.get("seeded_at"):
        return
    now = now_iso()
    # Tasks
    tasks = [
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 1, "order_index": 1, "task": "Review Q2 investor deck",
         "name": "Priya Sharma", "details": "Check slides 12–18 for revenue projections",
         "date": (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat(),
         "status": "Pending", "group": "Finance", "flagged": True,
         "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 2, "order_index": 2, "task": "File GST returns for March",
         "name": "Rajesh Mehta", "details": "Deadline is end of month",
         "date": (datetime.now(timezone.utc) + timedelta(days=5)).date().isoformat(),
         "status": "Pending", "group": "Legal", "flagged": False,
         "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 3, "order_index": 3, "task": "Finalize office lease renewal",
         "name": "Neha Kapoor", "details": "Compare 2 proposals and negotiate terms",
         "date": (datetime.now(timezone.utc) + timedelta(days=14)).date().isoformat(),
         "status": "Pending", "group": "Admin", "flagged": False,
         "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
    ]
    await db.tasks.insert_many(tasks)
    # Routines
    routines = [
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 1, "order_index": 1, "activity": "Morning meditation & journaling",
         "name": "Self", "group": "Morning", "details": "20 minutes, no phone",
         "frequency": "Daily", "priority": "High", "status": "Active",
         "flagged": False, "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 2, "order_index": 2, "activity": "Weekly team standup",
         "name": "Team", "group": "Work", "details": "Mon 9am, 30 minutes",
         "frequency": "Weekly", "priority": "High", "status": "Active",
         "flagged": False, "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 3, "order_index": 3, "activity": "Review daily financials",
         "name": "Self", "group": "Finance", "details": "Check P&L and cash position",
         "frequency": "Daily", "priority": "Medium", "status": "Active",
         "flagged": False, "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
    ]
    await db.routines.insert_many(routines)
    # Transactions
    txns = [
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 1, "order_index": 1, "vendor": "KM Ventures",
         "details": "Monthly salary", "amount": 500000, "category": "Income",
         "mode": "Bank Transfer", "head": "Salary", "currency": "INR",
         "date": today_key(), "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 2, "order_index": 2, "vendor": "Commercial Properties Ltd",
         "details": "Office rent — May 2026", "amount": 85000, "category": "Expense",
         "mode": "NEFT", "head": "Rent", "currency": "INR",
         "date": today_key(), "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "project_id": project_id,
         "sr_no": 3, "order_index": 3, "vendor": "HDFC Bank",
         "details": "Fixed deposit — 12 months", "amount": 1000000, "category": "Asset",
         "mode": "Bank Transfer", "head": "Investment", "currency": "INR",
         "date": today_key(), "attachments": [], "people_ids": [], "deleted": False,
         "created_at": now, "updated_at": now},
    ]
    await db.transactions.insert_many(txns)
    # People seed
    people = [
        {"id": new_id(), "user_id": user_id, "name": "Priya Sharma",
         "email": "priya@kmventures.com", "phone": "+91 98765 43210",
         "location": "Mumbai", "relationship": "Work", "notes": "CFO at KM Ventures",
         "tags": ["Finance", "Work"], "last_interaction": now,
         "deleted": False, "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "name": "Rajesh Mehta",
         "email": "rajesh@mehtaCA.com", "phone": "+91 98765 43211",
         "location": "Mumbai", "relationship": "Professional", "notes": "CA & Tax Consultant",
         "tags": ["Legal", "Finance"], "last_interaction": now,
         "deleted": False, "created_at": now, "updated_at": now},
        {"id": new_id(), "user_id": user_id, "name": "Neha Kapoor",
         "email": "neha@kmventures.com", "phone": "+91 98765 43212",
         "location": "Mumbai", "relationship": "Work", "notes": "Executive Assistant",
         "tags": ["Work", "Admin"], "last_interaction": now,
         "deleted": False, "created_at": now, "updated_at": now},
    ]
    await db.people.insert_many(people)
    await db.users.update_one({"id": user_id}, {"$set": {"seeded_at": now}})

# ─────────────────────── AUTH routes ───────────────────────
@api.post("/auth/signup")
async def signup(body: SignupReq):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = new_id()
    now = now_iso()
    user_doc = {
        "id": uid, "email": body.email.lower(),
        "first_name": body.first_name, "last_name": body.last_name,
        "picture": "", "created_at": now, "updated_at": now,
        "password_hash": _hash_password(body.password),
    }
    await db.users.insert_one(user_doc)
    proj = {"id": new_id(), "user_id": uid, "name": "Personal",
            "color": "#C9A961", "description": "", "created_at": now, "updated_at": now}
    await db.projects.insert_one(proj)
    await _seed_examples(uid, proj["id"])
    token = make_token(uid)
    user_doc.pop("_id", None); user_doc.pop("password_hash", None)
    return {"token": token, "user": user_doc}

@api.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not _verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(user["id"])
    await _seed_examples(user["id"], "")
    user.pop("password_hash", None)
    return {"token": token, "user": user}

@api.post("/auth/demo-login")
async def demo_login(body: DemoLoginReq = None):
    email = "demo@mindmatters.app"
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        uid = new_id()
        now = now_iso()
        user = {"id": uid, "email": email, "first_name": (body.first_name if body else None) or "Karan",
                "last_name": "Mundhra", "picture": "", "created_at": now, "updated_at": now,
                "password_hash": _hash_password("demo123")}
        await db.users.insert_one(user)
        proj = {"id": new_id(), "user_id": uid, "name": "Personal",
                "color": "#C9A961", "description": "", "created_at": now, "updated_at": now}
        await db.projects.insert_one(proj)
        await _seed_examples(uid, proj["id"])
    token = make_token(user["id"])
    user.pop("_id", None); user.pop("password_hash", None)
    return {"token": token, "user": user}

@api.post("/auth/forgot")
async def forgot_password(body: ForgotReq):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        return {"ok": True}
    code = str(secrets.randbelow(900000) + 100000)
    exp = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    await db.password_resets.insert_one({
        "email": body.email.lower(), "code_hash": _hash_password(code),
        "expires_at": exp, "used": False, "created_at": now_iso()
    })
    if TG_TOKEN and user.get("tg_chat_id"):
        try:
            from tg import tg_send
            await tg_send(user["tg_chat_id"], f"🔐 Mind Matters reset code: *{code}*\nExpires in 30 minutes.")
        except Exception:
            pass
    return {"ok": True}

@api.post("/auth/reset")
async def reset_password(body: ResetReq):
    reset = await db.password_resets.find_one(
        {"email": body.email.lower(), "used": False},
        sort=[("created_at", -1)]
    )
    if not reset:
        raise HTTPException(400, "No reset request found")
    if datetime.fromisoformat(reset["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Code expired")
    if not _verify_password(body.code, reset["code_hash"]):
        raise HTTPException(400, "Invalid code")
    new_hash = _hash_password(body.new_password)
    await db.users.update_one({"email": body.email.lower()}, {"$set": {"password_hash": new_hash}})
    await db.password_resets.update_one({"_id": reset["_id"]}, {"$set": {"used": True}})
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0, "password_hash": 0})
    token = make_token(user["id"])
    return {"token": token, "user": user}

@api.post("/auth/change-password")
async def change_password(body: ChangePassReq, u=Depends(get_current_user)):
    full = await db.users.find_one({"id": u["id"]})
    if not _verify_password(body.current_password, full.get("password_hash", "")):
        raise HTTPException(400, "Current password incorrect")
    await db.users.update_one({"id": u["id"]}, {"$set": {"password_hash": _hash_password(body.new_password)}})
    return {"ok": True}

@api.patch("/auth/profile")
async def update_profile(body: dict, u=Depends(get_current_user)):
    allowed = {"first_name", "last_name", "picture"}
    update = {k: v for k, v in body.items() if k in allowed}
    if update:
        update["updated_at"] = now_iso()
        await db.users.update_one({"id": u["id"]}, {"$set": update})
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "password_hash": 0})
    return user

@api.get("/auth/me")
async def get_me(u=Depends(get_current_user)):
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "password_hash": 0})
    return user

# ─────────────────────── TASKS ───────────────────────
@api.get("/tasks")
async def list_tasks(
    project_id: Optional[str] = None,
    include_deleted: bool = False,
    u=Depends(get_current_user)
):
    filt: dict = {"user_id": u["id"]}
    if not include_deleted:
        filt["deleted"] = {"$ne": True}
    if project_id:
        filt["project_id"] = project_id
    docs = await db.tasks.find(filt, {"_id": 0}).sort("order_index", 1).to_list(1000)
    return docs

@api.post("/tasks")
async def create_task(body: TaskIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "user_id": u["id"],
        "sr_no": await _next_sr("tasks", u["id"], body.project_id),
        "order_index": await _next_sr("tasks", u["id"], body.project_id),
        "created_at": now, "updated_at": now, "deleted": False
    })
    await db.tasks.insert_one(doc)
    _clean(doc)
    # Auto-link people by name matching
    search_text = " ".join(filter(None, [doc.get("task",""), doc.get("name",""), doc.get("details","")]))
    auto_linked = await _auto_link_people(u["id"], search_text)
    if auto_linked:
        merged = list(dict.fromkeys((doc.get("people_ids") or []) + auto_linked))
        await db.tasks.update_one({"id": doc["id"]}, {"$set": {"people_ids": merged}})
        doc["people_ids"] = merged
    await _log_activity(u["id"], body.project_id, u["id"], f"{u['first_name']} {u.get('last_name','')}".strip(),
                        "task_created", doc["id"], doc["task"])
    return doc

@api.patch("/tasks/{tid}")
async def update_task(tid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"date","name","task","details","status","group","section_id","parent_id",
               "flagged","project_id","attachments","people_ids","order_index","sr_no",
               "confidence","pending_review"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.tasks.update_one({"id": tid, "user_id": u["id"]}, {"$set": update})
    doc = await db.tasks.find_one({"id": tid}, {"_id": 0})
    return doc

@api.delete("/tasks/{tid}")
async def delete_task(tid: str, permanent: bool = False, u=Depends(get_current_user)):
    if permanent:
        await db.tasks.delete_one({"id": tid, "user_id": u["id"]})
    else:
        now = now_iso()
        await db.tasks.update_one({"id": tid, "user_id": u["id"]},
                                  {"$set": {"deleted": True, "deleted_at": now}})
    return {"ok": True}

@api.post("/tasks/{tid}/restore")
async def restore_task(tid: str, u=Depends(get_current_user)):
    await db.tasks.update_one({"id": tid, "user_id": u["id"]},
                              {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.post("/tasks/reorder")
async def reorder_tasks(body: list, u=Depends(get_current_user)):
    for i, item in enumerate(body):
        await db.tasks.update_one(
            {"id": item["id"], "user_id": u["id"]},
            {"$set": {"order_index": i + 1, "sr_no": i + 1, "updated_at": now_iso()}}
        )
    return {"ok": True}

@api.post("/tasks/{tid}/attachments")
async def add_task_attachment(tid: str, file: UploadFile = File(...), u=Depends(get_current_user)):
    return await _add_attachment("tasks", tid, file, u["id"])

@api.delete("/tasks/{tid}/attachments/{att_id}")
async def del_task_attachment(tid: str, att_id: str, u=Depends(get_current_user)):
    return await _del_attachment("tasks", tid, att_id, u["id"])

# ─────────────────────── ROUTINES ───────────────────────
@api.get("/routines")
async def list_routines(project_id: Optional[str] = None, u=Depends(get_current_user)):
    filt: dict = {"user_id": u["id"], "deleted": {"$ne": True}}
    if project_id:
        filt["project_id"] = project_id
    docs = await db.routines.find(filt, {"_id": 0}).sort("order_index", 1).to_list(1000)
    return docs

@api.post("/routines")
async def create_routine(body: RoutineIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "user_id": u["id"],
        "sr_no": await _next_sr("routines", u["id"], body.project_id),
        "order_index": await _next_sr("routines", u["id"], body.project_id),
        "created_at": now, "updated_at": now, "deleted": False
    })
    await db.routines.insert_one(doc)
    _clean(doc)
    # Auto-link people by name matching
    search_text = " ".join(filter(None, [doc.get("activity",""), doc.get("name",""), doc.get("details","")]))
    auto_linked = await _auto_link_people(u["id"], search_text)
    if auto_linked:
        merged = list(dict.fromkeys((doc.get("people_ids") or []) + auto_linked))
        await db.routines.update_one({"id": doc["id"]}, {"$set": {"people_ids": merged}})
        doc["people_ids"] = merged
    return doc

@api.patch("/routines/{rid}")
async def update_routine(rid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"group","name","activity","details","frequency","priority","status",
               "section_id","parent_id","flagged","project_id","attachments","people_ids",
               "order_index","sr_no","confidence","pending_review"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.routines.update_one({"id": rid, "user_id": u["id"]}, {"$set": update})
    doc = await db.routines.find_one({"id": rid}, {"_id": 0})
    return doc

@api.delete("/routines/{rid}")
async def delete_routine(rid: str, permanent: bool = False, u=Depends(get_current_user)):
    if permanent:
        await db.routines.delete_one({"id": rid, "user_id": u["id"]})
    else:
        await db.routines.update_one({"id": rid, "user_id": u["id"]},
                                     {"$set": {"deleted": True, "deleted_at": now_iso()}})
    return {"ok": True}

@api.post("/routines/{rid}/restore")
async def restore_routine(rid: str, u=Depends(get_current_user)):
    await db.routines.update_one({"id": rid, "user_id": u["id"]},
                                 {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.post("/routines/reorder")
async def reorder_routines(body: list, u=Depends(get_current_user)):
    for i, item in enumerate(body):
        await db.routines.update_one(
            {"id": item["id"], "user_id": u["id"]},
            {"$set": {"order_index": i + 1, "sr_no": i + 1, "updated_at": now_iso()}}
        )
    return {"ok": True}

@api.post("/routines/{rid}/attachments")
async def add_routine_attachment(rid: str, file: UploadFile = File(...), u=Depends(get_current_user)):
    return await _add_attachment("routines", rid, file, u["id"])

@api.delete("/routines/{rid}/attachments/{att_id}")
async def del_routine_attachment(rid: str, att_id: str, u=Depends(get_current_user)):
    return await _del_attachment("routines", rid, att_id, u["id"])

@api.post("/routines/{rid}/log")
async def log_routine(rid: str, body: dict, u=Depends(get_current_user)):
    now = now_iso()
    date_key = body.get("date") or today_key()
    done = body.get("done", True)
    await db.routine_logs.update_one(
        {"routine_id": rid, "user_id": u["id"], "date": date_key},
        {"$set": {"done": done, "logged_at": now}},
        upsert=True
    )
    return {"ok": True}

@api.get("/routines/logs")
async def get_routine_logs(date: Optional[str] = None, u=Depends(get_current_user)):
    filt: dict = {"user_id": u["id"]}
    if date:
        filt["date"] = date
    logs = await db.routine_logs.find(filt, {"_id": 0}).to_list(500)
    return logs

# ─────────────────────── TRANSACTIONS ───────────────────────
@api.get("/transactions")
async def list_transactions(project_id: Optional[str] = None, u=Depends(get_current_user)):
    filt: dict = {"user_id": u["id"], "deleted": {"$ne": True}}
    if project_id:
        filt["project_id"] = project_id
    docs = await db.transactions.find(filt, {"_id": 0}).sort("order_index", 1).to_list(2000)
    return docs

@api.post("/transactions")
async def create_transaction(body: TransactionIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "user_id": u["id"],
        "sr_no": await _next_sr("transactions", u["id"], body.project_id),
        "order_index": await _next_sr("transactions", u["id"], body.project_id),
        "created_at": now, "updated_at": now, "deleted": False
    })
    if not doc.get("date"):
        doc["date"] = today_key()
    await db.transactions.insert_one(doc)
    _clean(doc)
    await _log_activity(u["id"], body.project_id, u["id"], f"{u['first_name']} {u.get('last_name','')}".strip(),
                        "transaction_created", doc["id"], doc.get("details",""))
    return doc

@api.patch("/transactions/{tid}")
async def update_transaction(tid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"date","vendor","details","amount","category","mode","head","currency",
               "interest_rate","interest_type","repayment_date","emi","section_id",
               "project_id","attachments","people_ids","order_index","sr_no","confidence","pending_review"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.transactions.update_one({"id": tid, "user_id": u["id"]}, {"$set": update})
    doc = await db.transactions.find_one({"id": tid}, {"_id": 0})
    return doc

@api.delete("/transactions/{tid}")
async def delete_transaction(tid: str, permanent: bool = False, u=Depends(get_current_user)):
    if permanent:
        await db.transactions.delete_one({"id": tid, "user_id": u["id"]})
    else:
        await db.transactions.update_one({"id": tid, "user_id": u["id"]},
                                         {"$set": {"deleted": True, "deleted_at": now_iso()}})
    return {"ok": True}

@api.post("/transactions/{tid}/restore")
async def restore_transaction(tid: str, u=Depends(get_current_user)):
    await db.transactions.update_one({"id": tid, "user_id": u["id"]},
                                     {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.post("/transactions/reorder")
async def reorder_transactions(body: list, u=Depends(get_current_user)):
    for i, item in enumerate(body):
        await db.transactions.update_one(
            {"id": item["id"], "user_id": u["id"]},
            {"$set": {"order_index": i + 1, "sr_no": i + 1, "updated_at": now_iso()}}
        )
    return {"ok": True}

@api.post("/transactions/{tid}/attachments")
async def add_txn_attachment(tid: str, file: UploadFile = File(...), u=Depends(get_current_user)):
    return await _add_attachment("transactions", tid, file, u["id"])

@api.delete("/transactions/{tid}/attachments/{att_id}")
async def del_txn_attachment(tid: str, att_id: str, u=Depends(get_current_user)):
    return await _del_attachment("transactions", tid, att_id, u["id"])

@api.get("/cashflow/totals")
async def cashflow_totals(project_id: Optional[str] = None, u=Depends(get_current_user)):
    filt: dict = {"user_id": u["id"], "deleted": {"$ne": True}}
    if project_id:
        filt["project_id"] = project_id
    docs = await db.transactions.find(filt, {"_id": 0}).to_list(5000)
    totals = {"Income": 0.0, "Expense": 0.0, "Asset": 0.0, "Liability": 0.0}
    for d in docs:
        cat = d.get("category", "Expense")
        totals[cat] = totals.get(cat, 0.0) + float(d.get("amount", 0))
    return totals

@api.get("/cashflow/loan-summary")
async def loan_summary(u=Depends(get_current_user)):
    docs = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "category": {"$in": ["Asset","Liability"]},
         "interest_rate": {"$ne": None}}, {"_id": 0}
    ).to_list(200)
    active = []
    today = datetime.now(timezone.utc).date()
    for d in docs:
        rdate = d.get("repayment_date")
        if rdate:
            try:
                rd = date.fromisoformat(rdate)
                if rd >= today:
                    active.append(d)
            except Exception:
                pass
    return {"loans": active, "count": len(active)}

@api.post("/transactions/upload")
async def upload_transactions(file: UploadFile = File(...), u=Depends(get_current_user)):
    import pandas as pd
    data = await file.read()
    try:
        if file.filename and file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(data))
        else:
            df = pd.read_excel(io.BytesIO(data))
        rows = df.to_dict("records")
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")
    parsed = []
    for r in rows[:50]:
        parsed.append({
            "date": str(r.get("Date", r.get("date", today_key()))),
            "vendor": str(r.get("Vendor", r.get("vendor", r.get("Name", "")))),
            "details": str(r.get("Details", r.get("details", r.get("Description", "")))),
            "amount": float(str(r.get("Amount", r.get("amount", 0))).replace(",", "")),
            "category": str(r.get("Category", r.get("category", "Expense"))),
            "mode": str(r.get("Mode", r.get("mode", ""))),
            "head": str(r.get("Head", r.get("head", ""))),
        })
    return {"rows": parsed, "count": len(parsed)}

# ─────────────────────── NOTES ───────────────────────
@api.get("/notes")
async def list_notes(project_id: Optional[str] = None, u=Depends(get_current_user)):
    filt: dict = {"user_id": u["id"], "deleted": {"$ne": True}}
    if project_id:
        filt["project_id"] = project_id
    docs = await db.notes.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.post("/notes")
async def create_note(body: NoteIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({"id": new_id(), "user_id": u["id"],
                "created_at": now, "updated_at": now, "deleted": False})
    await db.notes.insert_one(doc)
    _clean(doc)
    await _log_activity(u["id"], body.project_id, u["id"], f"{u['first_name']} {u.get('last_name','')}".strip(),
                        "note_created", doc["id"], doc["title"])
    return doc

@api.patch("/notes/{nid}")
async def update_note(nid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"title","body","tags","pinned","vault","project_id","attachments","people_ids"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.notes.update_one({"id": nid, "user_id": u["id"]}, {"$set": update})
    doc = await db.notes.find_one({"id": nid}, {"_id": 0})
    return doc

@api.delete("/notes/{nid}")
async def delete_note(nid: str, permanent: bool = False, u=Depends(get_current_user)):
    if permanent:
        await db.notes.delete_one({"id": nid, "user_id": u["id"]})
    else:
        await db.notes.update_one({"id": nid, "user_id": u["id"]},
                                  {"$set": {"deleted": True, "deleted_at": now_iso()}})
    return {"ok": True}

@api.post("/notes/{nid}/restore")
async def restore_note(nid: str, u=Depends(get_current_user)):
    await db.notes.update_one({"id": nid, "user_id": u["id"]},
                              {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.post("/notes/{nid}/attachments")
async def add_note_attachment(nid: str, file: UploadFile = File(...), u=Depends(get_current_user)):
    return await _add_attachment("notes", nid, file, u["id"])

@api.delete("/notes/{nid}/attachments/{att_id}")
async def del_note_attachment(nid: str, att_id: str, u=Depends(get_current_user)):
    return await _del_attachment("notes", nid, att_id, u["id"])

@api.post("/notes/append-list")
async def append_list(body: dict, u=Depends(get_current_user)):
    title = body.get("list_title", "")
    tag = body.get("list_tag", "")
    items = body.get("items", [])
    filt: dict = {"user_id": u["id"], "deleted": {"$ne": True}}
    if title:
        filt["title"] = {"$regex": title, "$options": "i"}
    elif tag:
        filt["tags"] = tag
    note = await db.notes.find_one(filt)
    if note:
        existing_body = note.get("body", "")
        new_body = existing_body + "\n" + "\n".join(f"- {i}" for i in items)
        await db.notes.update_one({"id": note["id"]},
                                  {"$set": {"body": new_body, "updated_at": now_iso()}})
        return await db.notes.find_one({"id": note["id"]}, {"_id": 0})
    new_note = NoteIn(title=title or tag, body="\n".join(f"- {i}" for i in items),
                      tags=[tag] if tag else [])
    return await create_note(new_note, u)

# ─────────────────────── REMINDERS ───────────────────────
@api.get("/reminders")
async def list_reminders(project_id: Optional[str] = None, u=Depends(get_current_user)):
    filt: dict = {"user_id": u["id"], "deleted": {"$ne": True}}
    if project_id:
        filt["project_id"] = project_id
    docs = await db.reminders.find(filt, {"_id": 0}).sort("fire_at", 1).to_list(500)
    # Enrich with source info
    for doc in docs:
        if doc.get("source_type") and doc.get("source_id"):
            doc["source_info"] = await _get_source_info(doc["source_type"], doc["source_id"])
    return docs

@api.post("/reminders")
async def create_reminder(body: ReminderIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "user_id": u["id"], "sent": False,
        "sr_no": await _next_sr("reminders", u["id"], body.project_id),
        "created_at": now, "updated_at": now, "deleted": False
    })
    await db.reminders.insert_one(doc)
    _clean(doc)
    return doc

@api.patch("/reminders/{rid}")
async def update_reminder(rid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"title","fire_at","recurrence","custom_recurrence","notes","sent",
               "source_type","source_id","project_id","people_ids"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.reminders.update_one({"id": rid, "user_id": u["id"]}, {"$set": update})
    doc = await db.reminders.find_one({"id": rid}, {"_id": 0})
    return doc

@api.delete("/reminders/{rid}")
async def delete_reminder(rid: str, permanent: bool = False, u=Depends(get_current_user)):
    if permanent:
        await db.reminders.delete_one({"id": rid, "user_id": u["id"]})
    else:
        await db.reminders.update_one({"id": rid, "user_id": u["id"]},
                                      {"$set": {"deleted": True, "deleted_at": now_iso()}})
    return {"ok": True}

@api.post("/reminders/{rid}/restore")
async def restore_reminder(rid: str, u=Depends(get_current_user)):
    await db.reminders.update_one({"id": rid, "user_id": u["id"]},
                                  {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.post("/reminders/{rid}/resend")
async def resend_reminder(rid: str, body: dict, u=Depends(get_current_user)):
    fire_at = body.get("fire_at", now_iso())
    await db.reminders.update_one({"id": rid, "user_id": u["id"]},
                                  {"$set": {"sent": False, "fire_at": fire_at, "updated_at": now_iso()}})
    return {"ok": True}

@api.post("/reminders/{rid}/attachments")
async def add_reminder_attachment(rid: str, file: UploadFile = File(...), u=Depends(get_current_user)):
    return await _add_attachment("reminders", rid, file, u["id"])

async def _get_source_info(source_type: str, source_id: str) -> Optional[dict]:
    coll_map = {"task": "tasks", "note": "notes", "transaction": "transactions",
                "routine": "routines"}
    coll = coll_map.get(source_type)
    if not coll:
        return None
    doc = await db[coll].find_one({"id": source_id}, {"_id": 0, "id": 1,
                                   "task": 1, "title": 1, "activity": 1, "details": 1, "amount": 1})
    if not doc:
        return None
    label = doc.get("task") or doc.get("title") or doc.get("activity") or ""
    return {"type": source_type, "id": source_id, "label": label}

# ─────────────────────── PEOPLE ───────────────────────
@api.get("/people")
async def list_people(u=Depends(get_current_user)):
    docs = await db.people.find({"user_id": u["id"], "deleted": {"$ne": True}},
                                {"_id": 0}).sort("name", 1).to_list(1000)
    return docs

@api.post("/people")
async def create_person(body: PersonIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({"id": new_id(), "user_id": u["id"],
                "created_at": now, "updated_at": now, "deleted": False})
    await db.people.insert_one(doc)
    _clean(doc)
    return doc

@api.patch("/people/{pid}")
async def update_person(pid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"name","email","phone","location","relationship","notes","tags","last_interaction"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.people.update_one({"id": pid, "user_id": u["id"]}, {"$set": update})
    doc = await db.people.find_one({"id": pid}, {"_id": 0})
    return doc

@api.delete("/people/{pid}")
async def delete_person(pid: str, permanent: bool = False, u=Depends(get_current_user)):
    if permanent:
        await db.people.delete_one({"id": pid, "user_id": u["id"]})
    else:
        await db.people.update_one({"id": pid, "user_id": u["id"]},
                                   {"$set": {"deleted": True, "deleted_at": now_iso()}})
    return {"ok": True}

@api.post("/people/{pid}/restore")
async def restore_person(pid: str, u=Depends(get_current_user)):
    await db.people.update_one({"id": pid, "user_id": u["id"]},
                               {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.get("/people/{pid}/items")
async def person_items(pid: str, u=Depends(get_current_user)):
    results = []
    for coll, item_type in [("tasks","task"),("routines","routine"),
                             ("transactions","transaction"),("notes","note"),
                             ("reminders","reminder")]:
        docs = await db[coll].find(
            {"user_id": u["id"], "people_ids": pid, "deleted": {"$ne": True}},
            {"_id": 0, "id": 1, "task": 1, "activity": 1, "title": 1, "details": 1, "amount": 1}
        ).to_list(100)
        for d in docs:
            label = d.get("task") or d.get("activity") or d.get("title") or ""
            results.append({"type": item_type, "id": d["id"], "label": label})
    return results

# ─────────────────────── VAULT ───────────────────────
@api.get("/vault")
async def list_vault(u=Depends(get_current_user)):
    docs = await db.vault.find({"user_id": u["id"], "deleted": {"$ne": True}},
                               {"_id": 0, "data_url": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.post("/vault")
async def create_vault_doc(body: VaultDocIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({"id": new_id(), "user_id": u["id"],
                "created_at": now, "updated_at": now, "deleted": False})
    await db.vault.insert_one(doc)
    _clean(doc)
    return doc

@api.get("/vault/{vid}")
async def get_vault_doc(vid: str, u=Depends(get_current_user)):
    doc = await db.vault.find_one({"id": vid, "user_id": u["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc

@api.patch("/vault/{vid}")
async def update_vault_doc(vid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"name","doc_type","expiry_date","notes"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.vault.update_one({"id": vid, "user_id": u["id"]}, {"$set": update})
    doc = await db.vault.find_one({"id": vid}, {"_id": 0, "data_url": 0})
    return doc

@api.delete("/vault/{vid}")
async def delete_vault_doc(vid: str, permanent: bool = False, u=Depends(get_current_user)):
    if permanent:
        await db.vault.delete_one({"id": vid, "user_id": u["id"]})
    else:
        await db.vault.update_one({"id": vid, "user_id": u["id"]},
                                  {"$set": {"deleted": True, "deleted_at": now_iso()}})
    return {"ok": True}

@api.post("/vault/{vid}/restore")
async def restore_vault_doc(vid: str, u=Depends(get_current_user)):
    await db.vault.update_one({"id": vid, "user_id": u["id"]},
                              {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.post("/vault/upload")
async def upload_vault_doc(
    file: UploadFile = File(...),
    doc_type: str = Form("Document"),
    expiry_date: Optional[str] = Form(None),
    notes: str = Form(""),
    u=Depends(get_current_user)
):
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 10 MB limit")
    b64 = base64.b64encode(data).decode()
    mime = file.content_type or "application/octet-stream"
    body = VaultDocIn(
        name=file.filename or "document",
        doc_type=doc_type,
        expiry_date=expiry_date,
        notes=notes,
        data_url=f"data:{mime};base64,{b64}",
        mime=mime,
        size=len(data)
    )
    return await create_vault_doc(body, u)

# ─────────────────────── RECYCLE BIN ───────────────────────
@api.get("/recycle-bin")
async def list_recycle_bin(
    item_type: Optional[str] = None,
    u=Depends(get_current_user)
):
    collections = [
        ("tasks", "task"), ("routines", "routine"),
        ("transactions", "transaction"), ("notes", "note"),
        ("reminders", "reminder"), ("vault", "document"),
        ("people", "person"),
    ]
    if item_type and item_type != "all":
        type_to_coll = {v: k for k, v in collections}
        coll = type_to_coll.get(item_type)
        if coll:
            collections = [(coll, item_type)]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    results = []
    for coll, item_type_label in collections:
        docs = await db[coll].find(
            {"user_id": u["id"], "deleted": True,
             "deleted_at": {"$gte": cutoff}},
            {"_id": 0}
        ).sort("deleted_at", -1).to_list(200)
        for d in docs:
            d.pop("data_url", None)
            d["_item_type"] = item_type_label
            label = (d.get("task") or d.get("activity") or d.get("title") or
                     d.get("name") or d.get("details") or "Untitled")
            d["_label"] = label
            deleted_at = d.get("deleted_at","")
            d["_days_remaining"] = 30 - max(0,
                (datetime.now(timezone.utc) - datetime.fromisoformat(deleted_at)).days
            ) if deleted_at else 30
            results.append(d)
    results.sort(key=lambda x: x.get("deleted_at",""), reverse=True)
    return results

@api.post("/recycle-bin/restore")
async def restore_item(body: dict, u=Depends(get_current_user)):
    item_type = body.get("item_type")
    item_id = body.get("item_id")
    type_to_coll = {"task":"tasks","routine":"routines","transaction":"transactions",
                    "note":"notes","reminder":"reminders","document":"vault","person":"people"}
    coll = type_to_coll.get(item_type)
    if not coll:
        raise HTTPException(400, "Unknown item type")
    await db[coll].update_one({"id": item_id, "user_id": u["id"]},
                              {"$set": {"deleted": False, "deleted_at": None}})
    return {"ok": True}

@api.delete("/recycle-bin/permanent")
async def delete_permanently(body: dict, u=Depends(get_current_user)):
    item_type = body.get("item_type")
    item_id = body.get("item_id")
    type_to_coll = {"task":"tasks","routine":"routines","transaction":"transactions",
                    "note":"notes","reminder":"reminders","document":"vault","person":"people"}
    coll = type_to_coll.get(item_type)
    if not coll:
        raise HTTPException(400, "Unknown item type")
    await db[coll].delete_one({"id": item_id, "user_id": u["id"]})
    return {"ok": True}

# ─────────────────────── GLOBAL SEARCH ───────────────────────
@api.get("/search")
async def global_search(q: str, u=Depends(get_current_user)):
    if not q or len(q) < 2:
        return []
    pattern = {"$regex": q, "$options": "i"}
    results = []
    # Tasks
    docs = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "$or": [{"task": pattern}, {"details": pattern}, {"name": pattern}]},
        {"_id": 0, "id": 1, "task": 1, "details": 1, "name": 1, "status": 1, "date": 1}
    ).limit(10).to_list(10)
    for d in docs:
        results.append({"type": "task", "id": d["id"],
                        "label": d.get("task",""), "preview": d.get("details",""),
                        "meta": d.get("status","")})
    # Routines
    docs = await db.routines.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "$or": [{"activity": pattern}, {"details": pattern}]},
        {"_id": 0, "id": 1, "activity": 1, "details": 1, "frequency": 1}
    ).limit(5).to_list(5)
    for d in docs:
        results.append({"type": "routine", "id": d["id"],
                        "label": d.get("activity",""), "preview": d.get("details",""),
                        "meta": d.get("frequency","")})
    # Transactions
    docs = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "$or": [{"vendor": pattern}, {"details": pattern}, {"head": pattern}]},
        {"_id": 0, "id": 1, "vendor": 1, "details": 1, "amount": 1, "category": 1, "date": 1}
    ).limit(5).to_list(5)
    for d in docs:
        results.append({"type": "transaction", "id": d["id"],
                        "label": d.get("vendor",""), "preview": d.get("details",""),
                        "meta": f"₹{d.get('amount',0):,.0f} · {d.get('category','')} · {d.get('date','')}"})
    # Notes
    docs = await db.notes.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "$or": [{"title": pattern}, {"body": pattern}]},
        {"_id": 0, "id": 1, "title": 1, "body": 1, "tags": 1}
    ).limit(5).to_list(5)
    for d in docs:
        results.append({"type": "note", "id": d["id"],
                        "label": d.get("title",""),
                        "preview": (d.get("body","") or "")[:80],
                        "meta": ", ".join(d.get("tags",[]))})
    # Reminders
    docs = await db.reminders.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "$or": [{"title": pattern}, {"notes": pattern}]},
        {"_id": 0, "id": 1, "title": 1, "fire_at": 1, "recurrence": 1}
    ).limit(5).to_list(5)
    for d in docs:
        results.append({"type": "reminder", "id": d["id"],
                        "label": d.get("title",""), "preview": "",
                        "meta": d.get("fire_at","")[:10]})
    # People
    docs = await db.people.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "$or": [{"name": pattern}, {"email": pattern}]},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "relationship": 1}
    ).limit(5).to_list(5)
    for d in docs:
        results.append({"type": "person", "id": d["id"],
                        "label": d.get("name",""), "preview": d.get("email",""),
                        "meta": d.get("relationship","")})
    # Vault
    docs = await db.vault.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "$or": [{"name": pattern}, {"notes": pattern}]},
        {"_id": 0, "id": 1, "name": 1, "doc_type": 1}
    ).limit(5).to_list(5)
    for d in docs:
        results.append({"type": "document", "id": d["id"],
                        "label": d.get("name",""), "preview": "",
                        "meta": d.get("doc_type","")})
    return results

# ─────────────────────── PENDING REVIEW ───────────────────────
@api.get("/pending-review")
async def list_pending_review(u=Depends(get_current_user)):
    low_conf = []
    duplicates = []
    for coll, item_type in [("tasks","task"),("routines","routine"),
                             ("transactions","transaction"),("notes","note"),("reminders","reminder")]:
        docs = await db[coll].find(
            {"user_id": u["id"], "deleted": {"$ne": True},
             "pending_review": True},
            {"_id": 0}
        ).to_list(100)
        for d in docs:
            label = d.get("task") or d.get("activity") or d.get("title") or d.get("details","")
            low_conf.append({
                "id": d["id"], "item_type": item_type, "label": label,
                "confidence": d.get("confidence","medium"),
                "reason": f"Low confidence parse — please review",
                "data": d
            })
    dup_docs = await db.duplicates.find({"user_id": u["id"], "resolved": {"$ne": True}},
                                        {"_id": 0}).to_list(50)
    for d in dup_docs:
        duplicates.append(d)
    return {"low_confidence": low_conf, "duplicates": duplicates}

@api.post("/pending-review/{item_type}/{item_id}/approve")
async def approve_pending(item_type: str, item_id: str, u=Depends(get_current_user)):
    coll_map = {"task":"tasks","routine":"routines","transaction":"transactions",
                "note":"notes","reminder":"reminders"}
    coll = coll_map.get(item_type)
    if coll:
        await db[coll].update_one({"id": item_id, "user_id": u["id"]},
                                  {"$set": {"pending_review": False, "updated_at": now_iso()}})
    return {"ok": True}

@api.delete("/pending-review/{item_type}/{item_id}")
async def discard_pending(item_type: str, item_id: str, u=Depends(get_current_user)):
    coll_map = {"task":"tasks","routine":"routines","transaction":"transactions",
                "note":"notes","reminder":"reminders"}
    coll = coll_map.get(item_type)
    if coll:
        await db[coll].update_one({"id": item_id, "user_id": u["id"]},
                                  {"$set": {"deleted": True, "deleted_at": now_iso(),
                                            "pending_review": False}})
    return {"ok": True}

@api.get("/pending-review/count")
async def pending_review_count(u=Depends(get_current_user)):
    total = 0
    for coll in ["tasks","routines","transactions","notes","reminders"]:
        count = await db[coll].count_documents(
            {"user_id": u["id"], "deleted": {"$ne": True}, "pending_review": True})
        total += count
    dup_count = await db.duplicates.count_documents(
        {"user_id": u["id"], "resolved": {"$ne": True}})
    total += dup_count
    return {"count": total}

# ─────────────────────── DUPLICATE DETECTION ───────────────────────
async def _check_duplicate(coll: str, user_id: str, doc: dict) -> Optional[dict]:
    """Returns existing doc if probable duplicate, else None."""
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if coll == "tasks":
        task_title = doc.get("task","").lower().strip()
        if not task_title:
            return None
        candidates = await db.tasks.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "created_at": {"$gte": yesterday}},
            {"_id": 0}
        ).to_list(50)
        for c in candidates:
            if _similarity(task_title, c.get("task","").lower()) >= 0.9:
                return c
    elif coll == "transactions":
        amount = doc.get("amount", 0)
        vendor = doc.get("vendor","").lower()
        date = doc.get("date","")
        yesterday_date = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
        candidates = await db.transactions.find(
            {"user_id": user_id, "deleted": {"$ne": True},
             "amount": amount, "date": {"$gte": yesterday_date}},
            {"_id": 0}
        ).to_list(20)
        for c in candidates:
            if _similarity(vendor, c.get("vendor","").lower()) >= 0.8:
                return c
    return None

def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    set_a, set_b = set(a.split()), set(b.split())
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0

@api.post("/check-duplicate")
async def check_duplicate_endpoint(body: dict, u=Depends(get_current_user)):
    coll = body.get("collection","")
    doc = body.get("data",{})
    existing = await _check_duplicate(coll, u["id"], doc)
    return {"duplicate": existing}

# ─────────────────────── AI PARSE ───────────────────────
def _confidence_label(text: str) -> str:
    text = text.lower()
    if "low" in text or "unsure" in text or "unclear" in text:
        return "low"
    if "medium" in text or "moderate" in text:
        return "medium"
    return "high"

@api.post("/parse/task")
async def parse_task(body: dict, u=Depends(get_current_user)):
    text = body.get("text","")
    system = """You are a task parser. Extract structured data from user input.
Return ONLY valid JSON with keys: task, name, date (YYYY-MM-DD or null), group, details, status, priority, confidence (high/medium/low).
confidence = high if all fields are clear, medium if some are inferred, low if guessing.
Examples:
Input: "Call Priya about Q2 deck tomorrow"
Output: {"task":"Call Priya about Q2 deck","name":"Priya","date":"<tomorrow>","group":"","details":"","status":"Pending","priority":"Medium","confidence":"high"}"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    raw = await _llm(system, f"Today is {today}. Parse: {text}")
    try:
        data = json.loads(raw.strip().strip("```json").strip("```").strip())
    except Exception:
        data = {"task": text, "confidence": "low"}
    confidence = data.pop("confidence", "high")
    data["pending_review"] = confidence == "low"
    data["confidence"] = confidence
    return data

@api.post("/parse/routine")
async def parse_routine(body: dict, u=Depends(get_current_user)):
    text = body.get("text","")
    system = """Parse a routine from text. Return JSON:
{"activity","group","name","details","frequency","priority","confidence"}
frequency options: Daily, Weekly, Monthly, Weekdays, Weekends, Every Monday, Every Tuesday, Every Wednesday, Every Thursday, Every Friday, Bi-weekly, Monthly
confidence: high/medium/low"""
    raw = await _llm(system, f"Parse: {text}")
    try:
        data = json.loads(raw.strip().strip("```json").strip("```").strip())
    except Exception:
        data = {"activity": text, "confidence": "low"}
    confidence = data.pop("confidence", "high")
    data["pending_review"] = confidence == "low"
    data["confidence"] = confidence
    return data

@api.post("/parse/transaction")
async def parse_transaction(body: dict, u=Depends(get_current_user)):
    text = body.get("text","")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    system = """Parse a financial transaction. Return JSON:
{"vendor","details","amount","category","mode","head","date","confidence"}
category must be one of: Income, Expense, Asset, Liability
Examples:
"paid 50000 rent to Commercial Properties" -> {"vendor":"Commercial Properties","details":"Office rent","amount":50000,"category":"Expense","mode":"NEFT","head":"Rent","date":"today","confidence":"high"}
"received 500000 salary from KM Ventures" -> {"vendor":"KM Ventures","details":"Monthly salary","amount":500000,"category":"Income","mode":"Bank Transfer","head":"Salary","date":"today","confidence":"high"}
"fixed deposit 1000000 HDFC" -> {"vendor":"HDFC Bank","details":"Fixed deposit","amount":1000000,"category":"Asset","mode":"Bank Transfer","head":"Investment","date":"today","confidence":"medium"}
confidence: high/medium/low"""
    raw = await _llm(system, f"Today is {today}. Parse: {text}")
    try:
        data = json.loads(raw.strip().strip("```json").strip("```").strip())
    except Exception:
        data = {"details": text, "confidence": "low"}
    if data.get("date") in ("today", None, ""):
        data["date"] = today
    confidence = data.pop("confidence", "high")
    data["pending_review"] = confidence == "low"
    data["confidence"] = confidence
    return data

@api.post("/parse/note")
async def parse_note(body: dict, u=Depends(get_current_user)):
    text = body.get("text","")
    system = """Parse a note. Return JSON:
{"title","body","tags":[],"confidence"}
confidence: high/medium/low"""
    raw = await _llm(system, f"Parse: {text}")
    try:
        data = json.loads(raw.strip().strip("```json").strip("```").strip())
    except Exception:
        data = {"title": text[:50], "body": text, "confidence": "low"}
    confidence = data.pop("confidence", "high")
    data["confidence"] = confidence
    return data

@api.post("/parse/reminder")
async def parse_reminder(body: dict, u=Depends(get_current_user)):
    text = body.get("text","")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:00")
    system = """Parse a reminder from text. Return JSON:
{"title","fire_at" (ISO datetime), "recurrence","notes","confidence"}
recurrence options: none, daily, weekly, monthly, yearly, weekdays, weekends, bi-weekly
If no time given default to 09:00. If no date given, default to tomorrow.
confidence: high/medium/low"""
    raw = await _llm(system, f"Now is {today}. Parse: {text}")
    try:
        data = json.loads(raw.strip().strip("```json").strip("```").strip())
    except Exception:
        data = {"title": text, "fire_at": today, "recurrence": "none", "confidence": "low"}
    confidence = data.pop("confidence", "high")
    data["confidence"] = confidence
    return data

@api.post("/parse/bulk")
async def parse_bulk(body: dict, u=Depends(get_current_user)):
    text = body.get("text","")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    system = f"""You are a smart capture parser. Parse any kind of input and identify multiple items.
Return JSON array of items. Each item has: type (task/routine/reminder/note/transaction), data object, confidence (high/medium/low).
Today is {today}.
Examples of what you parse:
- "Call Priya tomorrow and remind me at 9am" -> [{{"type":"task","data":{{"task":"Call Priya","date":"<tomorrow>","name":"Priya"}},"confidence":"high"}},{{"type":"reminder","data":{{"title":"Call Priya","fire_at":"<tomorrow>T09:00:00"}},"confidence":"high"}}]
Be practical and extract actual actionable items."""
    raw = await _llm(system, text)
    try:
        data = json.loads(raw.strip().strip("```json").strip("```").strip())
        if isinstance(data, dict):
            data = [data]
    except Exception:
        data = [{"type":"note","data":{"title":text[:50],"body":text},"confidence":"low"}]
    return data

@api.post("/parse/voice")
async def parse_voice(file: UploadFile = File(...), u=Depends(get_current_user)):
    """Receive audio, transcribe via Gemini, then parse into structured items."""
    audio_data = await file.read()
    if not LLM_KEY:
        return {"transcript": "", "items": [], "error": "LLM not configured"}
    try:
        b64 = base64.b64encode(audio_data).decode()
        mime = file.content_type or "audio/webm"
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        prompt = f"""Today is {today}. Transcribe this audio and extract structured items.
Return JSON: {{"transcript": "what was said", "items": [{{"type":"task/reminder/note/transaction","data":{{...}},"confidence":"high/medium/low"}}]}}"""
        genai.configure(api_key=LLM_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        audio_part = {"mime_type": mime, "data": b64}
        resp = await asyncio.to_thread(model.generate_content, [prompt, audio_part])
        raw = resp.text if hasattr(resp, "text") else str(resp)
        result = json.loads(raw.strip().strip("```json").strip("```").strip())
        return result
    except Exception as e:
        return {"transcript": "", "items": [], "error": str(e)}

@api.post("/ai/chat")
async def ai_chat(body: dict, u=Depends(get_current_user)):
    message = body.get("message","")
    session_id = body.get("session_id", new_id())
    system = f"""You are Mind Matters AI assistant for {u.get('first_name','Karan')} Mundhra.
Help with tasks, reminders, routines, cash flow, notes, and planning.
Be concise and actionable. Max 3-4 sentences. Lead with the action, not explanation."""
    resp = await _llm(system, message, session_id)
    return {"response": resp, "session_id": session_id}

# ─────────────────────── SECTIONS ───────────────────────
@api.get("/projects/{pid}/sections")
async def list_sections(pid: str, module: str = "tasks", u=Depends(get_current_user)):
    docs = await db.sections.find(
        {"user_id": u["id"], "project_id": pid, "module": module},
        {"_id": 0}
    ).sort("position", 1).to_list(100)
    return docs

@api.post("/projects/{pid}/sections")
async def create_section(pid: str, body: SectionIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({"id": new_id(), "user_id": u["id"], "project_id": pid, "created_at": now})
    await db.sections.insert_one(doc)
    _clean(doc)
    return doc

@api.patch("/sections/{sid}")
async def update_section(sid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"name","color","position"}
    update = {k: v for k, v in body.items() if k in allowed}
    await db.sections.update_one({"id": sid, "user_id": u["id"]}, {"$set": update})
    return await db.sections.find_one({"id": sid}, {"_id": 0})

@api.delete("/sections/{sid}")
async def delete_section(sid: str, u=Depends(get_current_user)):
    for coll in ["tasks","routines","transactions"]:
        await db[coll].update_many({"section_id": sid, "user_id": u["id"]},
                                   {"$set": {"section_id": None}})
    await db.sections.delete_one({"id": sid, "user_id": u["id"]})
    return {"ok": True}

# ─────────────────────── PROJECTS ───────────────────────
@api.get("/projects")
async def list_projects(u=Depends(get_current_user)):
    owned = await db.projects.find({"user_id": u["id"]}, {"_id": 0}).to_list(50)
    member_of = await db.project_members.find(
        {"user_id": u["id"]}, {"_id": 0, "project_id": 1}
    ).to_list(50)
    shared_ids = [m["project_id"] for m in member_of]
    shared = []
    for pid in shared_ids:
        p = await db.projects.find_one({"id": pid}, {"_id": 0})
        if p:
            p["_shared"] = True
            shared.append(p)
    return owned + shared

@api.post("/projects")
async def create_project(body: ProjectIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({"id": new_id(), "user_id": u["id"], "created_at": now, "updated_at": now})
    await db.projects.insert_one(doc)
    _clean(doc)
    return doc

@api.patch("/projects/{pid}")
async def update_project(pid: str, body: dict, u=Depends(get_current_user)):
    allowed = {"name","color","description"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.projects.update_one({"id": pid, "user_id": u["id"]}, {"$set": update})
    return await db.projects.find_one({"id": pid}, {"_id": 0})

@api.delete("/projects/{pid}")
async def delete_project(pid: str, u=Depends(get_current_user)):
    await db.projects.delete_one({"id": pid, "user_id": u["id"]})
    return {"ok": True}

@api.post("/projects/{pid}/share")
async def share_project(pid: str, body: dict, u=Depends(get_current_user)):
    email = body.get("email","").lower()
    role = body.get("role","viewer")
    invite_token = secrets.token_urlsafe(18)
    invite_url = f"{APP_BASE_URL}/invite/{invite_token}"
    existing = await db.project_members.find_one({"project_id": pid, "email": email})
    if existing:
        await db.project_members.update_one({"_id": existing["_id"]},
                                            {"$set": {"role": role, "invite_token": invite_token,
                                                      "invite_url": invite_url}})
    else:
        await db.project_members.insert_one({
            "project_id": pid, "email": email, "role": role,
            "invite_token": invite_token, "invite_url": invite_url,
            "accepted": False, "invited_at": now_iso(), "user_id": None
        })
    return {"ok": True, "invite_url": invite_url}

@api.get("/invites/{token}")
async def get_invite(token: str):
    member = await db.project_members.find_one({"invite_token": token}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Invite not found or expired")
    proj = await db.projects.find_one({"id": member["project_id"]}, {"_id": 0})
    inviter = await db.users.find_one({"id": proj["user_id"] if proj else ""}, {"_id": 0, "password_hash": 0})
    invited_user = await db.users.find_one({"email": member["email"]}, {"_id": 0})
    return {
        "project": proj, "inviter": inviter,
        "role": member["role"], "invited_email": member["email"],
        "accepted": member.get("accepted", False),
        "has_account": bool(invited_user)
    }

@api.post("/invites/{token}/accept")
async def accept_invite(token: str, u=Depends(get_current_user)):
    member = await db.project_members.find_one({"invite_token": token})
    if not member:
        raise HTTPException(404, "Invite not found")
    if member["email"] != u["email"]:
        raise HTTPException(403, "This invite is for a different email")
    await db.project_members.update_one(
        {"invite_token": token},
        {"$set": {"accepted": True, "user_id": u["id"], "accepted_at": now_iso()}}
    )
    return {"ok": True}

# ─────────────────────── COMMENTS ───────────────────────
@api.get("/comments")
async def list_comments(resource_id: str, resource_type: str, u=Depends(get_current_user)):
    docs = await db.comments.find(
        {"resource_id": resource_id, "resource_type": resource_type},
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return docs

@api.post("/comments")
async def create_comment(body: CommentIn, u=Depends(get_current_user)):
    now = now_iso()
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "user_id": u["id"],
        "author_name": f"{u['first_name']} {u.get('last_name','')}".strip(),
        "created_at": now
    })
    await db.comments.insert_one(doc)
    _clean(doc)
    return doc

@api.delete("/comments/{cid}")
async def delete_comment(cid: str, u=Depends(get_current_user)):
    await db.comments.delete_one({"id": cid, "user_id": u["id"]})
    return {"ok": True}

@api.get("/comments/counts")
async def comment_counts(project_id: Optional[str] = None, resource_type: str = "task",
                         u=Depends(get_current_user)):
    filt: dict = {"resource_type": resource_type}
    if project_id:
        filt["project_id"] = project_id
    docs = await db.comments.find(filt, {"_id": 0, "resource_id": 1}).to_list(2000)
    counts: dict = {}
    for d in docs:
        rid = d["resource_id"]
        counts[rid] = counts.get(rid, 0) + 1
    return counts

# ─────────────────────── ACTIVITY FEED ───────────────────────
async def _log_activity(user_id, project_id, actor_id, actor_name,
                         subject_kind, subject_id, body_text):
    await db.activity.insert_one({
        "id": new_id(), "user_id": user_id, "project_id": project_id,
        "actor_id": actor_id, "actor_name": actor_name,
        "subject_kind": subject_kind, "subject_id": subject_id,
        "body": body_text, "created_at": now_iso()
    })

@api.get("/activity")
async def list_activity(limit: int = 50, u=Depends(get_current_user)):
    docs = await db.activity.find(
        {"user_id": u["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return docs

# ─────────────────────── REPORTS ───────────────────────
@api.get("/reports/cashflow-monthly")
async def cashflow_monthly(months: int = 6, u=Depends(get_current_user)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=months*30)).isoformat()
    docs = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "created_at": {"$gte": cutoff}},
        {"_id": 0, "amount": 1, "category": 1, "date": 1}
    ).to_list(5000)
    monthly: dict = {}
    for d in docs:
        month = (d.get("date","") or "")[:7]
        if not month:
            continue
        if month not in monthly:
            monthly[month] = {"month": month, "Income": 0, "Expense": 0, "Asset": 0, "Liability": 0}
        cat = d.get("category","Expense")
        monthly[month][cat] = monthly[month].get(cat, 0) + float(d.get("amount",0))
    return sorted(monthly.values(), key=lambda x: x["month"])

@api.get("/reports/timeline")
async def reports_timeline(days: int = 30, u=Depends(get_current_user)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    events = []
    for coll, kind in [("tasks","task"),("routines","routine"),
                        ("transactions","transaction"),("notes","note")]:
        docs = await db[coll].find(
            {"user_id": u["id"], "deleted": {"$ne": True}, "created_at": {"$gte": cutoff}},
            {"_id": 0, "id": 1, "task": 1, "activity": 1, "title": 1, "details": 1,
             "amount": 1, "vendor": 1, "created_at": 1}
        ).to_list(50)
        for d in docs:
            label = d.get("task") or d.get("activity") or d.get("title") or d.get("vendor","")
            events.append({"kind": kind, "id": d["id"], "label": label,
                           "created_at": d.get("created_at","")})
    events.sort(key=lambda x: x["created_at"], reverse=True)
    return events[:200]

@api.post("/reports/briefing")
async def reports_briefing(u=Depends(get_current_user)):
    today = today_key()
    pending = await db.tasks.count_documents(
        {"user_id": u["id"], "deleted": {"$ne": True}, "status": {"$nin": ["Completed","Done"]}})
    overdue = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]},
         "date": {"$lt": today, "$ne": None}},
        {"_id": 0, "task": 1, "date": 1}
    ).limit(5).to_list(5)
    due_today = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]}, "date": today},
        {"_id": 0, "task": 1}
    ).limit(5).to_list(5)
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    income = 0; expense = 0
    txns = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True}, "created_at": {"$gte": week_start}},
        {"_id": 0, "amount": 1, "category": 1}
    ).to_list(1000)
    for t in txns:
        if t.get("category") == "Income": income += t.get("amount",0)
        if t.get("category") == "Expense": expense += t.get("amount",0)
    context = (f"Pending tasks: {pending}. Overdue: {len(overdue)}. "
               f"Due today: {len(due_today)}. "
               f"This week — income: ₹{income:,.0f}, expenses: ₹{expense:,.0f}. "
               f"Overdue items: {', '.join(o.get('task','') for o in overdue[:3])}.")
    system = f"You are a briefing assistant for {u.get('first_name','Karan')} Mundhra. Be concise, actionable, max 4 sentences. Lead with what needs immediate attention."
    ai_text = await _llm(system, f"Generate daily briefing. Data: {context}")
    if not ai_text:
        ai_text = f"{pending} tasks pending, {len(overdue)} overdue. Focus: {', '.join(o.get('task','') for o in overdue[:2]) or 'review your task list'}."
    return {"summary": ai_text, "stats": {
        "pending": pending, "overdue": len(overdue), "due_today": len(due_today),
        "income": income, "expense": expense
    }}

@api.get("/reports/patterns")
async def reports_patterns(u=Depends(get_current_user)):
    patterns = []
    today = today_key()
    month_start = today[:7] + "-01"
    last_month_start = (datetime.now(timezone.utc) - timedelta(days=60)).strftime("%Y-%m") + "-01"
    last_month_end = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    this_month = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "category": "Expense", "date": {"$gte": month_start}},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    last_month = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "category": "Expense", "date": {"$gte": last_month_start, "$lte": last_month_end}},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    this_total = sum(t.get("amount",0) for t in this_month)
    last_total = sum(t.get("amount",0) for t in last_month)
    if last_total > 0:
        pct = (this_total - last_total) / last_total * 100
        if abs(pct) >= 20:
            patterns.append({
                "type": "spending",
                "message": f"Expenses {'up' if pct > 0 else 'down'} {abs(pct):.0f}% vs last month",
                "severity": "warning" if pct > 0 else "info"
            })
    overdue_count = await db.tasks.count_documents(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]}, "date": {"$lt": today}})
    if overdue_count > 0:
        patterns.append({"type":"overdue","message":f"{overdue_count} overdue tasks","severity":"error"})
    loans = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "category": "Liability", "repayment_date": {"$ne": None}},
        {"_id": 0, "repayment_date": 1, "vendor": 1, "amount": 1}
    ).to_list(20)
    in_14 = (datetime.now(timezone.utc) + timedelta(days=14)).date().isoformat()
    for loan in loans:
        rd = loan.get("repayment_date","")
        if rd and rd <= in_14:
            patterns.append({"type":"loan","message":f"Loan repayment due: {loan.get('vendor','')} by {rd}","severity":"warning"})
    return patterns

# ─────────────────────── EXPORT ───────────────────────
@api.get("/export/{module}.csv")
async def export_csv(module: str, ids: Optional[str] = None, u=Depends(get_current_user)):
    import csv
    coll_map = {"tasks":"tasks","routines":"routines","cashflow":"transactions",
                "notes":"notes","reminders":"reminders"}
    coll = coll_map.get(module)
    if not coll:
        raise HTTPException(404, "Unknown module")
    filt: dict = {"user_id": u["id"], "deleted": {"$ne": True}}
    if ids:
        filt["id"] = {"$in": ids.split(",")}
    docs = await db[coll].find(filt, {"_id": 0}).to_list(5000)
    if not docs:
        return JSONResponse({"rows": []})
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(docs[0].keys()))
    writer.writeheader()
    for d in docs:
        d.pop("attachments", None)
        writer.writerow({k: str(v) for k, v in d.items()})
    output.seek(0)
    return StreamingResponse(io.BytesIO(output.getvalue().encode()),
                             media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={module}.csv"})

@api.get("/export/data.xlsx")
async def export_all_xlsx(u=Depends(get_current_user)):
    import openpyxl
    wb = openpyxl.Workbook()
    sheets = [("tasks","Tasks"),("routines","Routines"),("transactions","CashFlow"),
              ("notes","Notes"),("reminders","Reminders")]
    for i, (coll, sheet_name) in enumerate(sheets):
        ws = wb.active if i == 0 else wb.create_sheet(sheet_name)
        if i == 0:
            ws.title = sheet_name
        docs = await db[coll].find(
            {"user_id": u["id"], "deleted": {"$ne": True}}, {"_id": 0}
        ).to_list(5000)
        if not docs:
            continue
        keys = [k for k in docs[0].keys() if k not in ("attachments","_id")]
        ws.append(keys)
        for d in docs:
            ws.append([str(d.get(k,"")) for k in keys])
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=mind-matters-export.xlsx"})

# ─────────────────────── DASHBOARD ───────────────────────
@api.get("/dashboard")
async def dashboard_summary(u=Depends(get_current_user)):
    today = today_key()
    now_dt = datetime.now(timezone.utc)
    tomorrow = (now_dt + timedelta(days=1)).date().isoformat()
    week_end = (now_dt + timedelta(days=7)).date().isoformat()
    pending_count = await db.tasks.count_documents(
        {"user_id": u["id"], "deleted": {"$ne": True}, "status": {"$nin": ["Completed","Done"]}})
    overdue = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]}, "date": {"$lt": today, "$ne": None}},
        {"_id": 0, "id": 1, "task": 1, "date": 1, "name": 1, "flagged": 1}
    ).limit(5).to_list(5)
    due_today = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]}, "date": today},
        {"_id": 0, "id": 1, "task": 1, "name": 1, "flagged": 1}
    ).limit(5).to_list(5)
    due_soon = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]},
         "date": {"$gt": today, "$lte": week_end}},
        {"_id": 0, "id": 1, "task": 1, "date": 1}
    ).limit(5).to_list(5)
    done_today = await db.tasks.count_documents(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$in": ["Completed","Done"]}, "updated_at": {"$gte": today}})
    reminders_due = await db.reminders.find(
        {"user_id": u["id"], "deleted": {"$ne": True}, "sent": False,
         "fire_at": {"$gte": now_dt.isoformat(), "$lte": (now_dt + timedelta(days=2)).isoformat()}},
        {"_id": 0, "id": 1, "title": 1, "fire_at": 1}
    ).limit(5).to_list(5)
    today_routines = await db.routines.find(
        {"user_id": u["id"], "deleted": {"$ne": True}, "status": "Active"},
        {"_id": 0, "id": 1, "activity": 1, "group": 1, "frequency": 1}
    ).limit(10).to_list(10)
    logs_today = await db.routine_logs.find(
        {"user_id": u["id"], "date": today}, {"_id": 0, "routine_id": 1, "done": 1}
    ).to_list(100)
    done_routine_ids = {l["routine_id"] for l in logs_today if l.get("done")}
    for r in today_routines:
        r["done_today"] = r["id"] in done_routine_ids
    totals = {"Income": 0, "Expense": 0, "Asset": 0, "Liability": 0}
    month_start = today[:7] + "-01"
    txns = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True}, "date": {"$gte": month_start}},
        {"_id": 0, "amount": 1, "category": 1}
    ).to_list(5000)
    for t in txns:
        cat = t.get("category","Expense")
        totals[cat] = totals.get(cat, 0) + float(t.get("amount",0))
    pending_review_count = 0
    for coll in ["tasks","routines","transactions","notes","reminders"]:
        pending_review_count += await db[coll].count_documents(
            {"user_id": u["id"], "deleted": {"$ne": True}, "pending_review": True})
    return {
        "greeting": f"Good {'morning' if now_dt.hour < 12 else 'afternoon' if now_dt.hour < 17 else 'evening'}, {u['first_name']}",
        "date": now_dt.strftime("%A, %B %d, %Y"),
        "time": now_dt.strftime("%I:%M %p"),
        "stats": {"pending": pending_count, "overdue": len(overdue),
                  "done_today": done_today, "reminders_due": len(reminders_due)},
        "overdue": overdue, "due_today": due_today, "due_soon": due_soon,
        "reminders": reminders_due, "routines": today_routines,
        "cashflow": totals, "pending_review_count": pending_review_count
    }

# ─────────────────────── NEWS ───────────────────────
_news_cache: dict = {}

@api.get("/news")
async def get_news(category: str = "general", custom_url: str = ""):
    cache_key = custom_url or category
    if cache_key in _news_cache:
        cached_at, data = _news_cache[cache_key]
        if time.time() - cached_at < 1800:
            return data
    try:
        if custom_url and custom_url.startswith("http"):
            url = custom_url
        else:
            cat_map = {"general":"","business":"business","tech":"technology",
                       "india":"india","world":"world"}
            topic = cat_map.get(category,"")
            url = f"https://news.google.com/rss/search?q={topic}&hl=en-IN&gl=IN&ceid=IN:en" if topic else \
                  "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
        import re as _re
        items = _re.findall(r"<title><!\[CDATA\[(.*?)\]\]></title>", r.text)[:5]
        if not items:
            items = _re.findall(r"<title>(.*?)</title>", r.text)[1:6]
        source = "custom" if custom_url else category
        result = {"items": items, "source": source}
        _news_cache[cache_key] = (time.time(), result)
        return result
    except Exception:
        return {"items": [], "source": category}

# ─────────────────────── CALENDAR / iCal ───────────────────────
@api.get("/calendar/feed.ics")
async def calendar_feed(token: str):
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user_id = payload["user_id"]
    reminders = await db.reminders.find(
        {"user_id": user_id, "deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(500)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mind Matters//EN", "CALSCALE:GREGORIAN"]
    for r in reminders:
        try:
            dt = datetime.fromisoformat(r["fire_at"]).strftime("%Y%m%dT%H%M%SZ")
        except Exception:
            continue
        uid = r.get("id","")
        title = r.get("title","Reminder").replace(",","\\,")
        lines += [
            "BEGIN:VEVENT", f"UID:{uid}@mindmatters",
            f"DTSTART:{dt}", f"SUMMARY:{title}", "END:VEVENT"
        ]
    lines.append("END:VCALENDAR")
    return StreamingResponse(io.BytesIO("\r\n".join(lines).encode()),
                             media_type="text/calendar",
                             headers={"Content-Disposition": "attachment; filename=mindmatters.ics"})

# ─────────────────────── SETTINGS ───────────────────────
@api.get("/settings")
async def get_settings(u=Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": u["id"]}, {"_id": 0})
    if not settings:
        settings = {"user_id": u["id"], "theme": "dark", "digest_enabled": True,
                    "digest_hour": 9, "quiet_hours_start": 22, "quiet_hours_end": 7,
                    "tg_chat_id": None, "dashboard_widgets": {
                        "snapshot": True, "priorities": True, "waiting_on": True,
                        "reminders": True, "routines": True, "ai_brief": True,
                        "news": True, "affirmations": False
                    }}
    return settings

@api.patch("/settings")
async def update_settings(body: dict, u=Depends(get_current_user)):
    allowed = {"theme","digest_enabled","digest_hour","quiet_hours_start","quiet_hours_end",
               "tg_chat_id","dashboard_widgets","affirmation"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["user_id"] = u["id"]
    await db.user_settings.update_one({"user_id": u["id"]}, {"$set": update}, upsert=True)
    return await db.user_settings.find_one({"user_id": u["id"]}, {"_id": 0})

@api.get("/digest/settings")
async def get_digest_settings(u=Depends(get_current_user)):
    s = await db.user_settings.find_one({"user_id": u["id"]}, {"_id": 0})
    return {"enabled": (s or {}).get("digest_enabled", True),
            "digest_hour": (s or {}).get("digest_hour", 9),
            "last_sent": (s or {}).get("digest_last_sent")}

# ─────────────────────── TELEGRAM LINK ───────────────────────
@api.get("/telegram/link")
async def get_tg_link(u=Depends(get_current_user)):
    code = secrets.token_hex(8)
    await db.tg_links.insert_one({"user_id": u["id"], "code": code, "created_at": now_iso()})
    bot_name = "mindmattersbot"
    return {"link": f"https://t.me/{bot_name}?start={code}", "code": code}

@api.get("/telegram/status")
async def get_tg_status(u=Depends(get_current_user)):
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "tg_chat_id": 1})
    return {"linked": bool(user and user.get("tg_chat_id"))}

# ─────────────────────── QUOTES ───────────────────────
_FALLBACK_QUOTES = [
    "The secret of getting ahead is getting started. — Mark Twain",
    "Done is better than perfect. — Sheryl Sandberg",
    "Focus on being productive instead of busy. — Tim Ferriss",
    "Your time is limited, don't waste it living someone else's life. — Steve Jobs",
    "The way to get started is to quit talking and begin doing. — Walt Disney",
]

@api.get("/quote/today")
async def get_quote():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get("https://zenquotes.io/api/today")
        data = r.json()
        if data and isinstance(data, list):
            q = data[0]
            return {"quote": q.get("q",""), "author": q.get("a","")}
    except Exception:
        pass
    import random
    q = random.choice(_FALLBACK_QUOTES)
    return {"quote": q, "author": ""}

# ─────────────────────── ATTACHMENTS helper ───────────────────────
async def _add_attachment(coll: str, item_id: str, file: UploadFile, user_id: str):
    data = await file.read()
    per_file_limit = 10 * 1024 * 1024
    if len(data) > per_file_limit:
        raise HTTPException(413, "File exceeds 10 MB limit")
    doc = await db[coll].find_one({"id": item_id, "user_id": user_id}, {"_id": 0, "attachments": 1})
    if not doc:
        raise HTTPException(404, "Item not found")
    existing = doc.get("attachments", [])
    total = sum(a.get("size", 0) for a in existing)
    per_item_limit = 50 * 1024 * 1024
    if total + len(data) > per_item_limit:
        raise HTTPException(413, "Total attachments exceed 50 MB limit")
    mime = file.content_type or "application/octet-stream"
    b64 = base64.b64encode(data).decode()
    att = {
        "id": new_id(), "name": file.filename or "file",
        "mime": mime, "size": len(data),
        "data_url": f"data:{mime};base64,{b64}",
        "uploaded_at": now_iso()
    }
    existing.append(att)
    await db[coll].update_one({"id": item_id, "user_id": user_id},
                              {"$set": {"attachments": existing, "updated_at": now_iso()}})
    att_safe = {k: v for k, v in att.items() if k != "data_url"}
    return att_safe

async def _del_attachment(coll: str, item_id: str, att_id: str, user_id: str):
    doc = await db[coll].find_one({"id": item_id, "user_id": user_id}, {"_id": 0, "attachments": 1})
    if not doc:
        raise HTTPException(404, "Item not found")
    atts = [a for a in doc.get("attachments", []) if a.get("id") != att_id]
    await db[coll].update_one({"id": item_id, "user_id": user_id},
                              {"$set": {"attachments": atts, "updated_at": now_iso()}})
    return {"ok": True}

# ─────────────────────── CONTACT SYNC (import / export) ───────────────────────

def _parse_vcf(content: str) -> list:
    """Parse a vCard (.vcf) file and return a list of contact dicts."""
    contacts = []
    # Split into individual VCARD blocks
    blocks = re.split(r"BEGIN:VCARD", content, flags=re.IGNORECASE)
    for block in blocks:
        if not block.strip():
            continue
        c = {"name": "", "email": "", "phone": "", "notes": "",
             "location": "", "relationship": "", "tags": []}
        lines = block.replace("\r\n ", "").replace("\r\n\t", "").split("\r\n")
        if not lines:
            lines = block.replace("\n ", "").replace("\n\t", "").split("\n")

        for raw in lines:
            raw = raw.strip()
            if not raw or raw.upper().startswith("END:") or raw.upper().startswith("VERSION:"):
                continue

            # Split key (with optional params) from value
            if ":" not in raw:
                continue
            key_part, _, value = raw.partition(":")
            value = value.strip()
            key_upper = key_part.upper().split(";")[0]

            if key_upper == "FN":
                c["name"] = value
            elif key_upper == "N" and not c["name"]:
                # N:Family;Given;Additional;Prefix;Suffix
                parts = value.split(";")
                given  = parts[1].strip() if len(parts) > 1 else ""
                family = parts[0].strip() if parts else ""
                c["name"] = f"{given} {family}".strip()
            elif key_upper in ("EMAIL", "EMAIL;TYPE=INTERNET", "EMAIL;TYPE=HOME",
                               "EMAIL;TYPE=WORK", "EMAIL;PREF") or "EMAIL" in key_upper:
                if not c["email"]:
                    c["email"] = value
            elif "TEL" in key_upper:
                if not c["phone"]:
                    c["phone"] = value
            elif key_upper == "ORG":
                # ORG:Company;Dept → use as relationship/notes
                org = value.split(";")[0].strip()
                if org and not c["relationship"]:
                    c["relationship"] = org
            elif key_upper == "TITLE":
                if value:
                    c["notes"] = (c["notes"] + " " + value).strip()
            elif key_upper == "NOTE":
                if value:
                    c["notes"] = (c["notes"] + " " + value).strip()
            elif key_upper in ("ADR", "ADR;TYPE=HOME", "ADR;TYPE=WORK") or "ADR" in key_upper:
                # ADR:PO Box;Extended;Street;City;Region;PostCode;Country
                parts = [p.strip() for p in value.split(";") if p.strip()]
                if parts and not c["location"]:
                    c["location"] = ", ".join(parts[-3:])  # city, region, country
            elif key_upper == "CATEGORIES":
                c["tags"] = [t.strip() for t in value.split(",") if t.strip()]

        if c["name"]:
            contacts.append(c)
    return contacts


def _parse_contacts_csv(content: str) -> list:
    """Parse a CSV of contacts. Handles Google Contacts format and simple flat CSVs."""
    import csv, io
    contacts = []
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return contacts

    fields = [f.lower() for f in reader.fieldnames]

    # Column name aliases
    def _get(row, *keys):
        for k in keys:
            for f in row:
                if f.lower().strip() == k.lower():
                    v = row[f]
                    if v and str(v).strip() and str(v).strip() not in ("N/A","-"):
                        return str(v).strip()
        return ""

    def _get_prefix(row, prefix):
        """Find first column that starts with prefix (e.g. 'E-mail 1 - Value')."""
        for f in row:
            if f.lower().startswith(prefix.lower()):
                v = row[f]
                if v and str(v).strip():
                    return str(v).strip()
        return ""

    for row in reader:
        # Name: try full name first, then Given Name + Family Name
        name = (_get(row, "name", "full name", "display name") or
                ((_get(row, "given name", "first name") + " " +
                  _get(row, "family name", "last name")).strip()))
        if not name:
            continue
        email = (_get(row, "e-mail address", "email", "email address") or
                 _get_prefix(row, "e-mail") or _get_prefix(row, "email"))
        phone = (_get(row, "mobile phone", "phone", "telephone", "cell phone", "primary phone") or
                 _get_prefix(row, "phone") or _get_prefix(row, "mobile"))
        notes = _get(row, "notes", "note", "description", "comments")
        location = (_get(row, "location", "city", "address") or
                    _get_prefix(row, "home address") or _get_prefix(row, "work address"))
        relationship = _get(row, "relationship", "type", "category", "group membership", "group", "company", "organization", "org")
        tags_raw = _get(row, "tags", "labels", "group membership")
        tags = [t.strip().lstrip("* ") for t in tags_raw.split(":::") if t.strip()] if tags_raw else []

        contacts.append({
            "name": name, "email": email, "phone": phone,
            "notes": notes, "location": location,
            "relationship": relationship, "tags": tags,
        })
    return contacts


@api.post("/people/import/preview")
async def import_contacts_preview(
    file: UploadFile = File(...),
    u=Depends(get_current_user)
):
    """Parse a .vcf or .csv file and return contacts ready for review (no DB write yet)."""
    data = await file.read()
    fname = (file.filename or "").lower()
    try:
        content = data.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(400, "Could not decode file — ensure it is UTF-8 encoded")

    if fname.endswith(".vcf") or fname.endswith(".vcard") or "BEGIN:VCARD" in content[:200].upper():
        parsed = _parse_vcf(content)
        source = "vCard"
    elif fname.endswith(".csv"):
        parsed = _parse_contacts_csv(content)
        source = "CSV"
    else:
        # Try vCard first, then CSV
        if "BEGIN:VCARD" in content[:500].upper():
            parsed = _parse_vcf(content)
            source = "vCard"
        else:
            parsed = _parse_contacts_csv(content)
            source = "CSV"

    if not parsed:
        raise HTTPException(400, "No contacts found in file. Ensure it is a valid vCard or Google Contacts CSV export.")

    # Dedup check against existing people
    existing = await db.people.find(
        {"user_id": u["id"], "deleted": {"$ne": True}},
        {"_id": 0, "name": 1, "email": 1}
    ).to_list(2000)
    existing_emails = {p["email"].lower() for p in existing if p.get("email")}
    existing_names  = {p["name"].lower() for p in existing if p.get("name")}

    for c in parsed:
        email_dup = bool(c.get("email") and c["email"].lower() in existing_emails)
        name_dup  = c["name"].lower() in existing_names
        c["_duplicate"] = email_dup or name_dup
        c["_dup_reason"] = ("email already exists" if email_dup
                            else "name already exists" if name_dup else None)

    return {
        "source": source,
        "total": len(parsed),
        "new": sum(1 for c in parsed if not c["_duplicate"]),
        "duplicates": sum(1 for c in parsed if c["_duplicate"]),
        "contacts": parsed,
    }


@api.post("/people/import/confirm")
async def import_contacts_confirm(body: dict, u=Depends(get_current_user)):
    """Bulk-create contacts from a previously previewed import.
    Accepts { contacts: [...], skip_duplicates: true }."""
    contacts = body.get("contacts", [])
    skip_dupes = body.get("skip_duplicates", True)
    now = now_iso()
    created = 0
    skipped = 0

    for c in contacts:
        if skip_dupes and c.get("_duplicate"):
            skipped += 1
            continue
        doc = {
            "id": new_id(), "user_id": u["id"],
            "name": c.get("name","").strip(),
            "email": c.get("email","").strip(),
            "phone": c.get("phone","").strip(),
            "notes": c.get("notes","").strip(),
            "location": c.get("location","").strip(),
            "relationship": c.get("relationship","").strip(),
            "tags": c.get("tags", []),
            "last_interaction": None,
            "deleted": False, "created_at": now, "updated_at": now,
        }
        if not doc["name"]:
            skipped += 1
            continue
        await db.people.insert_one(doc)
        created += 1

    return {"created": created, "skipped": skipped}


@api.get("/export/contacts.vcf")
async def export_contacts_vcf(u=Depends(get_current_user)):
    """Export all people as a vCard 3.0 file."""
    people = await db.people.find(
        {"user_id": u["id"], "deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(5000)

    lines = []
    for p in people:
        name = p.get("name","")
        parts = name.rsplit(" ", 1)
        given  = parts[0] if len(parts) > 1 else name
        family = parts[1] if len(parts) > 1 else ""
        lines.append("BEGIN:VCARD")
        lines.append("VERSION:3.0")
        lines.append(f"FN:{name}")
        lines.append(f"N:{family};{given};;;")
        if p.get("email"):
            lines.append(f"EMAIL;TYPE=INTERNET:{p['email']}")
        if p.get("phone"):
            lines.append(f"TEL;TYPE=CELL:{p['phone']}")
        if p.get("relationship"):
            lines.append(f"ORG:{p['relationship']}")
        if p.get("location"):
            lines.append(f"ADR;TYPE=HOME:;;{p['location']};;;;")
        if p.get("notes"):
            lines.append(f"NOTE:{p['notes']}")
        if p.get("tags"):
            lines.append(f"CATEGORIES:{','.join(p['tags'])}")
        lines.append("END:VCARD")
        lines.append("")

    vcf_content = "\r\n".join(lines)
    return StreamingResponse(
        io.BytesIO(vcf_content.encode("utf-8")),
        media_type="text/vcard",
        headers={"Content-Disposition": "attachment; filename=mind-matters-contacts.vcf"}
    )


@api.get("/export/contacts.csv")
async def export_contacts_csv(u=Depends(get_current_user)):
    """Export all people as a Google Contacts-compatible CSV."""
    import csv
    people = await db.people.find(
        {"user_id": u["id"], "deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(5000)

    output = io.StringIO()
    fieldnames = [
        "Name","Given Name","Family Name",
        "E-mail 1 - Type","E-mail 1 - Value",
        "Phone 1 - Type","Phone 1 - Value",
        "Organization 1 - Type","Organization 1 - Name",
        "Address 1 - Type","Address 1 - Street",
        "Group Membership","Notes",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for p in people:
        name = p.get("name","")
        parts = name.rsplit(" ", 1)
        given  = parts[0] if len(parts) > 1 else name
        family = parts[1] if len(parts) > 1 else ""
        tags = " ::: ".join(p.get("tags",[])) if p.get("tags") else ""
        writer.writerow({
            "Name": name, "Given Name": given, "Family Name": family,
            "E-mail 1 - Type": "Work", "E-mail 1 - Value": p.get("email",""),
            "Phone 1 - Type": "Mobile", "Phone 1 - Value": p.get("phone",""),
            "Organization 1 - Type": "Work", "Organization 1 - Name": p.get("relationship",""),
            "Address 1 - Type": "Home", "Address 1 - Street": p.get("location",""),
            "Group Membership": tags,
            "Notes": p.get("notes",""),
        })

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mind-matters-contacts.csv"}
    )


# ─────────────────────── AUTO-LINK PEOPLE ───────────────────────
async def _auto_link_people(user_id: str, text: str) -> List[str]:
    """Fuzzy-match names in text against people collection. Returns matched IDs."""
    if not text:
        return []
    people = await db.people.find(
        {"user_id": user_id, "deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    matched = []
    text_lower = text.lower()
    for p in people:
        name = p.get("name", "").strip()
        if not name:
            continue
        name_lower = name.lower()
        parts = name_lower.split()
        # Full name match
        if name_lower in text_lower:
            matched.append(p["id"])
        # First name match (≥4 chars to reduce false positives)
        elif parts and len(parts[0]) >= 4 and parts[0] in text_lower.split():
            matched.append(p["id"])
    return list(dict.fromkeys(matched))  # deduplicate preserving order

@api.post("/tasks/{tid}/auto-link")
async def auto_link_task(tid: str, u=Depends(get_current_user)):
    """Re-run people auto-linking for a task."""
    task = await db.tasks.find_one({"id": tid, "user_id": u["id"]}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    search_text = " ".join(filter(None, [task.get("task",""), task.get("name",""), task.get("details","")]))
    linked = await _auto_link_people(u["id"], search_text)
    existing = task.get("people_ids", [])
    merged = list(dict.fromkeys(existing + linked))
    await db.tasks.update_one({"id": tid}, {"$set": {"people_ids": merged, "updated_at": now_iso()}})
    return {"people_ids": merged, "newly_linked": [p for p in linked if p not in existing]}

@api.post("/routines/{rid}/auto-link")
async def auto_link_routine(rid: str, u=Depends(get_current_user)):
    """Re-run people auto-linking for a routine."""
    routine = await db.routines.find_one({"id": rid, "user_id": u["id"]}, {"_id": 0})
    if not routine:
        raise HTTPException(404, "Routine not found")
    search_text = " ".join(filter(None, [routine.get("activity",""), routine.get("name",""), routine.get("details","")]))
    linked = await _auto_link_people(u["id"], search_text)
    existing = routine.get("people_ids", [])
    merged = list(dict.fromkeys(existing + linked))
    await db.routines.update_one({"id": rid}, {"$set": {"people_ids": merged, "updated_at": now_iso()}})
    return {"people_ids": merged, "newly_linked": [p for p in linked if p not in existing]}

# ─────────────────────── WEEKLY DIGEST ───────────────────────
@api.get("/digest/preview")
async def digest_preview(u=Depends(get_current_user)):
    """Generate a weekly AI digest of tasks, finances, routines and vault."""
    today = today_key()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    month_start = today[:7] + "-01"

    # Tasks
    completed_tasks = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$in": ["Completed","Done"]},
         "updated_at": {"$gte": week_ago}},
        {"_id": 0, "task": 1}
    ).limit(10).to_list(10)

    pending_count = await db.tasks.count_documents(
        {"user_id": u["id"], "deleted": {"$ne": True}, "status": {"$nin": ["Completed","Done"]}})

    overdue_tasks = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]},
         "date": {"$lt": today, "$ne": None}},
        {"_id": 0, "task": 1, "date": 1}
    ).limit(5).to_list(5)

    due_next_week = await db.tasks.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "status": {"$nin": ["Completed","Done"]},
         "date": {"$gte": today, "$lte": (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()}},
        {"_id": 0, "task": 1, "date": 1}
    ).limit(5).to_list(5)

    # Finances
    week_txns = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True}, "date": {"$gte": week_ago}},
        {"_id": 0, "amount": 1, "category": 1, "vendor": 1}
    ).to_list(500)
    income = sum(float(t.get("amount",0)) for t in week_txns if t.get("category") == "Income")
    expense = sum(float(t.get("amount",0)) for t in week_txns if t.get("category") == "Expense")

    # Vault expiring in 30 days
    in_30 = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    expiring_docs = await db.vault.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "expiry_date": {"$lte": in_30, "$gte": today}},
        {"_id": 0, "name": 1, "expiry_date": 1}
    ).limit(5).to_list(5)

    # Routine streaks
    routines = await db.routines.find(
        {"user_id": u["id"], "deleted": {"$ne": True}, "status": "Active"},
        {"_id": 0, "activity": 1, "streak": 1}
    ).limit(20).to_list(20)
    top_streaks = sorted(
        [r for r in routines if (r.get("streak") or 0) > 0],
        key=lambda r: r.get("streak", 0) or 0, reverse=True
    )[:3]

    context = (
        f"User: {u['first_name']} {u.get('last_name','')}\n"
        f"Period: {week_ago} → {today}\n\n"
        f"Tasks completed this week: {len(completed_tasks)}"
        + (f" ({', '.join(t['task'] for t in completed_tasks[:3])})" if completed_tasks else "")
        + f"\nPending tasks: {pending_count}"
        + f"\nOverdue: {len(overdue_tasks)}"
        + (f" ({', '.join(t['task'] for t in overdue_tasks[:2])})" if overdue_tasks else "")
        + f"\nDue next 7 days: {len(due_next_week)}"
        + (f" ({', '.join(t['task'] for t in due_next_week[:2])})" if due_next_week else "")
        + f"\n\nWeekly income: ₹{income:,.0f}"
        + f"\nWeekly expenses: ₹{expense:,.0f}"
        + f"\nNet: ₹{income-expense:,.0f}"
        + f"\n\nDocuments expiring in 30 days: "
        + (", ".join(f"{d['name']} ({d['expiry_date']})" for d in expiring_docs) or "None")
        + f"\nTop routine streaks: "
        + (", ".join(f"{r['activity']} 🔥{r.get('streak',0)}" for r in top_streaks) or "None")
    )

    system = (
        f"You are the weekly digest writer for Mind Matters personal OS. "
        f"Write a warm, insightful weekly summary for {u['first_name']}. "
        f"Use markdown with 3 sections: ## 📋 Week in Review, ## ⚡ Action Items, ## 🔥 Keep Going. "
        f"Be specific and encouraging. Max 200 words total."
    )
    summary = await _llm(system, f"Generate digest:\n{context}")
    if not summary:
        summary = (
            f"## 📋 Week in Review\n{len(completed_tasks)} tasks completed. "
            f"{pending_count} still pending.\n\n"
            f"## ⚡ Action Items\n{len(overdue_tasks)} overdue tasks need attention.\n\n"
            f"## 🔥 Keep Going\nKeep building your routines!"
        )

    return {
        "summary": summary,
        "stats": {
            "completed": len(completed_tasks),
            "pending": pending_count,
            "overdue": len(overdue_tasks),
            "due_next_week": len(due_next_week),
            "income": income,
            "expense": expense,
            "expiring_docs": len(expiring_docs),
            "top_streaks": [{"activity": r["activity"], "streak": r.get("streak",0)} for r in top_streaks],
        },
        "generated_at": now_iso(),
        "period": {"from": week_ago, "to": today},
    }

@api.post("/digest/send")
async def digest_send(u=Depends(get_current_user)):
    """Generate digest and deliver it via Telegram if the user is linked."""
    result = await digest_preview(u)
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "tg_chat_id": 1})
    chat_id = (user or {}).get("tg_chat_id")
    sent_tg = False
    if chat_id and TG_TOKEN:
        try:
            from tg import tg_send
            await tg_send(chat_id, f"📊 *Mind Matters Weekly Digest*\n\n{result['summary'][:3000]}")
            sent_tg = True
        except Exception as e:
            logger.warning(f"Digest TG send failed: {e}")
    await db.user_settings.update_one(
        {"user_id": u["id"]}, {"$set": {"digest_last_sent": now_iso()}}, upsert=True
    )
    return {"ok": True, "sent_telegram": sent_tg, "summary": result["summary"]}

# ─────────────────────── SPENDING ANOMALIES ───────────────────────
@api.get("/cashflow/anomalies")
async def cashflow_anomalies(u=Depends(get_current_user)):
    """Detect spending anomalies by comparing this month to a 3-month baseline."""
    today = today_key()
    month_start = today[:7] + "-01"
    three_mo_ago = (datetime.now(timezone.utc) - timedelta(days=93)).date().isoformat()

    # This month's expenses
    current_txns = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "category": "Expense", "date": {"$gte": month_start}},
        {"_id": 0, "amount": 1, "head": 1, "vendor": 1, "date": 1}
    ).to_list(1000)

    # Prior 3 months' expenses
    prior_txns = await db.transactions.find(
        {"user_id": u["id"], "deleted": {"$ne": True},
         "category": "Expense",
         "date": {"$gte": three_mo_ago, "$lt": month_start}},
        {"_id": 0, "amount": 1, "head": 1, "vendor": 1, "date": 1}
    ).to_list(3000)

    def _group(txns: list) -> dict:
        groups: dict = {}
        for t in txns:
            key = (t.get("head") or "").strip() or (t.get("vendor") or "").strip() or "Other"
            groups[key] = groups.get(key, 0.0) + float(t.get("amount", 0))
        return groups

    current_by_cat = _group(current_txns)
    prior_by_cat   = _group(prior_txns)

    anomalies = []
    # Check all categories that appear in current month
    for cat, current_amt in current_by_cat.items():
        prior_total = prior_by_cat.get(cat, 0.0)
        prior_avg   = prior_total / 3.0

        if prior_avg > 0:
            pct = (current_amt - prior_avg) / prior_avg * 100
            # Only flag if significant amount and significant change
            if abs(pct) >= 40 and current_amt >= 1000:
                anomalies.append({
                    "category": cat,
                    "current":  round(current_amt, 2),
                    "avg_3mo":  round(prior_avg, 2),
                    "change_pct": round(pct, 1),
                    "severity": "high" if abs(pct) >= 100 else "medium",
                    "direction": "up" if pct > 0 else "down",
                })
        elif current_amt >= 5000:
            # Brand-new spending category this month
            anomalies.append({
                "category": cat,
                "current":  round(current_amt, 2),
                "avg_3mo":  0,
                "change_pct": 100.0,
                "severity": "info",
                "direction": "new",
            })

    anomalies.sort(key=lambda a: abs(a["change_pct"]), reverse=True)
    anomalies = anomalies[:10]

    insight = ""
    if anomalies:
        anomaly_text = "; ".join(
            f"{a['category']}: ₹{a['current']:,.0f} "
            f"({'+' if a['change_pct'] >= 0 else ''}{a['change_pct']:.0f}% vs 3-mo avg)"
            for a in anomalies[:5]
        )
        system = (
            "You are a concise financial advisor. "
            "Give a 1–2 sentence practical insight about these spending anomalies. "
            "Be specific. Do not add disclaimers."
        )
        insight = await _llm(system, f"Spending anomalies this month: {anomaly_text}")

    return {
        "month": today[:7],
        "anomalies": anomalies,
        "insight": insight,
        "summary": {
            "total_current": round(sum(a["current"] for a in anomalies), 2),
            "flagged_count": len(anomalies),
        },
    }

# ─────────────────────── AUTO-PURGE (30-day trash) ───────────────────────
async def _purge_old_trash():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    for coll in ["tasks","routines","transactions","notes","reminders","vault","people"]:
        await db[coll].delete_many({"deleted": True, "deleted_at": {"$lt": cutoff}})

# ─────────────────────── STARTUP / BACKGROUND ───────────────────────
async def _reminder_loop():
    while True:
        try:
            await asyncio.sleep(30)
            if not TG_TOKEN:
                continue
            now = now_iso()
            reminders = await db.reminders.find(
                {"sent": False, "deleted": {"$ne": True}, "fire_at": {"$lte": now}},
                {"_id": 0}
            ).to_list(100)
            for r in reminders:
                user = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "tg_chat_id": 1})
                chat_id = user.get("tg_chat_id") if user else None
                if chat_id:
                    try:
                        from tg import tg_send
                        await tg_send(chat_id, f"🔔 *{r['title']}*\n{r.get('notes','')}")
                    except Exception:
                        pass
                await db.reminders.update_one({"id": r["id"]}, {"$set": {"sent": True}})
        except Exception as e:
            logger.warning(f"Reminder loop error: {e}")

async def _daily_purge_loop():
    while True:
        await asyncio.sleep(86400)
        try:
            await _purge_old_trash()
        except Exception as e:
            logger.warning(f"Purge error: {e}")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True, sparse=True)
    await db.tasks.create_index([("user_id", 1), ("deleted", 1), ("order_index", 1)])
    await db.routines.create_index([("user_id", 1), ("deleted", 1)])
    await db.transactions.create_index([("user_id", 1), ("deleted", 1)])
    await db.notes.create_index([("user_id", 1), ("deleted", 1)])
    await db.reminders.create_index([("user_id", 1), ("deleted", 1), ("fire_at", 1)])
    await db.people.create_index([("user_id", 1), ("deleted", 1)])
    await db.vault.create_index([("user_id", 1), ("deleted", 1)])
    asyncio.create_task(_reminder_loop())
    asyncio.create_task(_daily_purge_loop())
    if TG_TOKEN:
        try:
            from tg import tg_poll_loop
            asyncio.create_task(tg_poll_loop())
        except Exception as e:
            logger.warning(f"TG poll loop failed to start: {e}")
    logger.info("Mind Matters v3 started")

@api.get("/")
async def health():
    return {"status": "ok", "version": "3.0.0"}

app.include_router(api)
