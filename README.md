# Mind Matters

A personal productivity OS — tasks, routines, cash flow, notes, reminders, vault, contacts, and AI parsing in one place.

## Stack

- **Backend**: FastAPI + MongoDB (motor) + PyJWT
- **AI**: Gemini via emergentintegrations
- **Frontend**: React 18 + Tailwind CSS v3 + Radix UI
- **Telegram**: Long-poll bot with 6 commands

## Features

- AI-parse anything (text or voice) into structured data
- Confidence badges + editable preview before every AI save
- Soft delete with 30-day recycle bin
- Global search across all modules
- People/contacts with linked items
- Vault for document storage with expiry alerts
- Telegram bot: briefing, task management, reminders
- Pending review queue for low-confidence parses
- Offline sync queue (Dexie)
- Dark/light theme, custom RSS news feed

## Quick Start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start   # starts on http://localhost:3000
```

## Environment Variables

See `backend/.env.example` for all required variables.

| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `JWT_SECRET` | JWT signing secret (change in production) |
| `EMERGENT_LLM_KEY` | Gemini API key via emergentintegrations |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `APP_BASE_URL` | Frontend URL for links in emails |
| `NEWS_API_KEY` | News API key (optional) |
| `SMTP_*` | Email settings for password reset |
