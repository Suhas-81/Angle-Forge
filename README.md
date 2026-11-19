# AngleForge — AI Marketing Campaign Generator

A **complete full-source project** for Challenge 2: generate three marketing concepts for a fictional smart travel mug, select one, generate three persona-tailored social posts and three emails, enforce brand rules, repair failures once, review and export the results.

This full-project package includes the original application **plus the updated Brewly Brand Hub, more responsive layout, sequential navigation, editable browser-local account profile, simpler dashboard, and a streamlined icon system with dashboard-based exports**. It is not a patch: extract and run directly.

![AngleForge architecture](docs/architecture/angleforge-wired-architecture.png)

## Current features

- **Brewly brand kit**, loaded by default: brand/product name, tagline, price, approved facts, claims policy, tone words, do/don't instructions, example lines, banned terms, and social/email channel rules. Import/export the exact nested JSON format from the challenge.
- **Three editable, synthetic personas** with distinct needs and suggested messaging angles.
- **Guided step-by-step navigation:** Dashboard → Brand Hub → Personas → Campaigns → Content Studio → Brand Compliance. The export tools remain available on the Dashboard (disabled until six assets exist). There is no standalone Export Center or Agent Pipeline navigation item.
- **Three AI campaign concepts** with name, key message and hook. Select one, then generate three posts and three emails, all with per-piece brand checks.
- **Exact brand checks in Python:** visible Unicode grapheme character counting, hashtag and emoji counts, banned terms, email subject/body limits, required exact email sign-off, and a defined CTA marker convention. A model supplies the subjective 1–5 brand-fit score and rationale.
- **Automatic repair:** one retry for hard-rule failures, then show any unresolved violations. Regenerate individual pieces, regenerate all six, or recheck after rule changes.
- **Review/export:** brand-compliance details, Markdown/JSON downloads, browser-local snapshots and restore.
- **Profile editing:** name, email, role and organization are editable and saved in the browser. This is **not real account authentication**.
- **Responsive CSS:** layouts adapt for smaller laptop screens, tablets and phones. The interface uses a consistent Compass brand mark and restrained Lucide product icons; no technology logos, lightning/flash graphics, or provider logos are shown in the UI.
- **Four orchestrated agent roles:** strategist, copywriter, reviewer and refinement. This uses a transparent Python orchestrator rather than external autonomous-agent frameworks.

No PostgreSQL, RAG, vector database or Docker installation is required. Only synthetic data is bundled. The offline preview path still exists for development/testing but the dashboard no longer displays a Demo Mode banner or switch. To demonstrate live model generation, configure Gemini.

## Stack

**Frontend:** React 18, Vite 6, CSS, Lucide; **Backend:** Python 3.10+, FastAPI, Pydantic, httpx, `regex`; **LLM:** optional Google Gemini API; **Storage:** browser `localStorage` (not a shared database).

## How to run

Prerequisites: Python 3.10+, Node.js 20+, npm. Run from the extracted `AngleForge` folder.

### Backend — Windows PowerShell

```powershell
cd AngleForge\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### Backend — macOS/Linux

```bash
cd AngleForge/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend — second terminal

```bash
cd AngleForge/frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/api/health
- API docs: http://localhost:8000/docs

Vite proxies `/api` requests to FastAPI port 8000.

### Enable live Gemini generation

Set these values in `backend/.env` and restart the backend:

```dotenv
GEMINI_API_KEY=your_private_key_here
GEMINI_MODEL=gemini-2.5-flash
DEMO_MODE=false
```

The API key stays server-side and `.env` is gitignored. Live Gemini requests require a valid provider key and model access; they were not tested in this environment.

## Guided workflow and screens

1. **Dashboard:** concise progress overview, guided steps, JSON/Markdown export buttons, and collapsible browser-local version history.
2. **Brand Hub:** edit Brewly-style nested brand-kit data, including banned words and social/email constraints. Import/export your own synthetic JSON brand kit. Click **Continue to personas**.
3. **Personas:** edit the three fictional personas, including pain points and goals; advance to Campaigns.
4. **Campaigns:** generate 3 concepts, choose one, and generate all six assets.
5. **Content Studio:** compare the persona-specific posts and emails, with individual and full regeneration.
6. **Brand Compliance:** inspect scores and hard-rule violations, and recheck after changing brand rules; use **Export from dashboard** to return to the export tools.

The backend agent orchestrator continues running, but its former UI page and its navigation item have been removed. The most recent trace is still included in the JSON export.

**Navigation note:** Previously unlocked screens remain revisitable so that users can edit rules and regenerate, but users cannot jump ahead to future screens without completing earlier steps.

## Important details and limitations

- Exact social character counts are measured by user-perceived Unicode grapheme clusters, not Python `len()` code points. Emoji sequences count as a single visible symbol.
- Hashtags, emoji, prohibited word/phrase occurrences, email subject length, word ranges, CTA-line markers and sign-offs are checked in code. **CTA counting uses an explicit `→` line marker convention**, not general semantic link detection.
- Product-fact fidelity, tone, benefit accuracy, persuasiveness and cultural appropriateness are not guaranteed by deterministic checks. They require model evaluation and human review.
- The 1–5 brand-fit score is subjective; a high score does not override a failed hard rule.
- A single auto-fix attempt may not eliminate every violation; remaining issues stay visible.
- Version history and profile data are stored in one browser; cross-device access, logins, server-side storage and collaborative editing are not implemented.
- The offline preview generates **synthetic sample content**, not live LLM output; it is available for reproducible demos when a Gemini key is not configured.

## API routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Mode and health |
| `GET /api/sample` | Synthetic brand and personas |
| `GET /api/agents` | Agent-role summary |
| `POST /api/concepts` | Generate 3 concepts |
| `POST /api/generate` | Generate and validate 6 assets |
| `POST /api/regenerate` | Regenerate one asset |
| `POST /api/recheck` | Revalidate/repair existing assets |

## Tests and verification

```bash
cd AngleForge/backend
python -m pytest -q tests
```

**15 backend tests passed**, including Brewly validation rules. Frontend JSX source has been syntax-parsed. A full Vite build and live Gemini request have not been verified in this environment; run `npm install && npm run build` on your laptop before the hackathon.

## Source directory

```text
AngleForge/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Screens, guided workflow, profile, exports
│   │   ├── styles.css             # Responsive styling
│   │   ├── seed.json              # Synthetic Brewly brand + 3 personas
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI routes
│   │   ├── agents.py              # Four agent roles and orchestration
│   │   ├── llm.py                 # Gemini generation/review/refinement
│   │   ├── rules.py               # Deterministic hard checks
│   │   ├── demo.py                # Synthetic offline preview generation
│   │   ├── schemas.py             # Typed request/response contracts
│   │   └── sample.py              # Matching Brewly synthetic data
│   ├── tests/
│   └── requirements.txt
├── docs/
│   ├── DEMO_SCRIPT.md
│   ├── EXPLANATION.md
│   ├── SYNTHETIC_SAMPLE.json
│   └── architecture/
└── README.md
```

Do not include real customer information or secrets in a hackathon demonstration.
