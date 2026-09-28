from fastapi import FastAPI
from pydantic import BaseModel

from services.trust_service import calculate_trust_score
from services.document_service import analyze_document
from services.threat_service import analyze_threat


app = FastAPI(
    title="TrustSphere X",
    description="Enterprise Digital Trust Intelligence Platform",
    version="1.0.0"
)


class DocumentRequest(BaseModel):
    text: str
    department: str


@app.get("/")
def root():
    return {
        "message": "TrustSphere X API is running",
        "status": "online"
    }


@app.post("/analyze")
def analyze_document_endpoint(request: DocumentRequest):

    # Step 1: Analyze document
    document_result = analyze_document(request.text)

    risk_score = document_result["risk_score"]

    # Step 2: Calculate Trust Score
    trust_result = calculate_trust_score(
        sender_trust=20,
        document_risk=risk_score,
        behavior_risk=10,
        network_risk=10
    )

    # Step 3: Analyze threat propagation
    threat_result = analyze_threat(
        department=request.department,
        risk_score=risk_score
    )

    return {
        "document_analysis": document_result,
        "trust_analysis": trust_result,
        "threat_propagation": threat_result
    }