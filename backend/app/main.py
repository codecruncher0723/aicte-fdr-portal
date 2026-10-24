"""
Main FastAPI Application for AICTE Fixed Deposit Receipt (FDR) Portal.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.auth import router as auth_router
from app.routers.institutions import router as institutions_router
from app.routers.workflow import router as workflow_router

app = FastAPI(
    title="AICTE FDR Management Portal API",
    description="Regulatory Custody, FDR Verification, and Lifecycle Management System",
    version="1.0.0",
)

# CORS Middleware for frontend development and local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router)
app.include_router(institutions_router)
app.include_router(workflow_router)


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "HEALTHY",
        "service": "AICTE FDR Portal Backend",
        "version": "1.0.0",
    }
