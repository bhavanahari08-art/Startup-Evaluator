# TrustEval — Explainable & Bias-Aware AI Framework

> Startup feasibility assessment as a real-world case study for Explainable AI, Bias Detection & Mitigation, and Trustworthy AI.

---

## Project Structure

```
trust-eval/
├── backend/                  # FastAPI backend
│   ├── main.py               # Entry point
│   ├── routers/              # API routes (auth, evaluate, explain, bias, reports)
│   ├── services/             # Business logic (SHAP, DiCE, Fairlearn, Gemini AI)
│   ├── models/               # Pydantic schemas
│   └── db/                   # SQLAlchemy + SQLite setup
├── frontend2/                # React + Vite + Tailwind CSS frontend
│   └── src/
│       ├── pages/            # Landing, Auth, Dashboard, Research, Bias, Reports
│       ├── components/       # Navbar, Sidebar, Charts, Gauges
│       ├── context/          # Auth + Theme context
│       └── api/              # Axios client
├── datasets/                 # Synthetic startup CSV
├── models/                   # Trained ML model (auto-generated)
└── requirements.txt          # Python dependencies
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) A Gemini API key from [Google AI Studio](https://aistudio.google.com)

---

### 1. Clone and set up Python environment

```bash
cd trust-eval

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

---

### 2. Set Gemini API Key (optional but recommended)

```bash
# Windows CMD
set GEMINI_API_KEY=your_key_here

# Windows PowerShell
$env:GEMINI_API_KEY="your_key_here"

# macOS/Linux
export GEMINI_API_KEY=your_key_here
```

Without the API key, TrustEval uses an intelligent offline fallback (rule-based analysis).

---

### 3. Start the FastAPI Backend

```bash
# From the trust-eval/ root directory
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will automatically:
- Create the SQLite database (`trusteval.db`)
- Generate synthetic startup dataset (`datasets/synthetic_startups.csv`)
- Train the baseline biased RandomForest model (`models/biased_rf_model.pkl`)

API docs available at: `http://localhost:8000/docs`

---

### 4. Start the React Frontend

```bash
cd frontend2
npm install          # First time only
npm run dev
```

Open: `http://localhost:5173`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login, get JWT token |
| GET  | `/api/auth/me` | Get current user info |
| POST | `/api/evaluate` | Evaluate startup idea (ML + Gemini AI) |
| POST | `/api/explain/shap` | Generate SHAP explanations |
| POST | `/api/explain/dice` | Generate DiCE counterfactuals |
| POST | `/api/bias/audit` | Run bias audit for a sensitive attribute |
| POST | `/api/bias/mitigate` | Run Fairlearn bias mitigation |
| GET  | `/api/reports/history` | List user's report history |
| GET  | `/api/reports/{id}` | Get full report details |
| DELETE | `/api/reports/{id}` | Delete a report |

---

## Key Research Contributions

### Explainable AI (XAI)
- **SHAP Global Explanations**: Average absolute feature importance across training data
- **SHAP Local Explanations**: Per-prediction contribution of each feature
- **DiCE Counterfactuals**: Minimal changes to flip the prediction outcome

### Bias Detection
Four protected attributes are audited:
- Founder Location (Rural vs Urban)
- Education Level (Tier 2/3 vs Tier 1)
- Funding Access (Low vs High Capital)
- Gender (Female vs Male)

Four fairness metrics computed:
- **Demographic Parity Difference**: Gap in selection rates
- **Equal Opportunity Difference**: Gap in true positive rates
- **Equalized Odds Difference**: Combined TPR/FPR gap
- **Intersectional Fairness**: Compound attribute combinations

### Bias Mitigation
- Uses **Fairlearn ThresholdOptimizer** (demographic parity constraint)
- Compares baseline vs mitigated model accuracy and fairness metrics
- Visualises the accuracy–fairness trade-off

---

## Dataset

Synthetic dataset of 1,500 startup profiles with:
- 4 sensitive attributes (intentional bias injected during generation)
- 5 technical/market attributes
- Binary feasibility label

The bias is intentionally injected to simulate real-world systemic bias in startup evaluation, making it a meaningful case study for XAI research.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion, Recharts, Radix UI |
| Backend | FastAPI, Python 3.10+, SQLAlchemy, SQLite |
| ML | scikit-learn (RandomForest) |
| XAI | SHAP, DiCE-ML |
| Fairness | Fairlearn (ThresholdOptimizer) |
| AI | Google Gemini 2.0 Flash |
| Auth | Custom JWT (base64, easily replaceable with python-jose) |

---

## Deployment

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | `""` | Google Gemini API key |
| `DATABASE_URL` | `sqlite:///./trusteval.db` | SQLAlchemy database URL |
| `SECRET_KEY` | `trusteval-secret-key-change-in-prod` | JWT signing secret |

### Production Build
```bash
# Build frontend
cd frontend2
npm run build
# Serves dist/ — configure FastAPI to serve static files or use a CDN

# Run backend with production server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## License
MIT — for research and educational purposes.
