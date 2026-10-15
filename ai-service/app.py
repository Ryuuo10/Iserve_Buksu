from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from models.iserve_ai import analyze

app = FastAPI(title="I-Serve AI Analysis Service")


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1)


@app.get("/")
def root():
    return {"status": "AI service running"}


@app.get("/health")
def health():
    return {"success": True, "service": "capstone-ai-service"}


@app.post("/analyze")
def analyze_complaint(request: AnalyzeRequest):
    try:
        return analyze(request.text)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
