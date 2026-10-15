# Capstone AI Service

FastAPI service for the trained grievance AI model.

Render settings:

- Root Directory: `ai-service`
- Language: Python 3
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

Endpoints:

- `GET /health`
- `POST /analyze` with body `{ "text": "complaint text" }`

Important: the trained model artifact folders are too large for normal GitHub commits. Add these folders beside `models/iserve_ai.py` by using Git LFS or by downloading an archive during build/deploy:

- `models/classification/`
- `models/urgency/`
- `models/sentiment/`
- `models/summarizer/`

Without those folders, `iserve_ai.py` falls back to its lightweight rule-based logic.
