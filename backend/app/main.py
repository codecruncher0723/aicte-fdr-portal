"""
Main FastAPI Application for AICTE Fixed Deposit Receipt (FDR) Portal.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

<<<<<<< HEAD
from .routers.auth import router as auth_router
from .routers.institutions import router as institutions_router
from .routers.workflow import router as workflow_router
from .routers.fdrs import router as fdrs_router
from .routers.documents import router as documents_router
from .routers.dashboard import router as dashboard_router
from .routers.reports import router as reports_router
from .routers.notifications import router as notifications_router
=======
from app.routers.auth import router as auth_router
from app.routers.institutions import router as institutions_router
from app.routers.workflow import router as workflow_router
from app.routers.fdrs import router as fdrs_router
from app.routers.documents import router as documents_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reports import router as reports_router
from app.routers.notifications import router as notifications_router
from app.routers.audit import router as audit_router
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4

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

# Mount All Protected Routers
app.include_router(auth_router)
app.include_router(institutions_router)
app.include_router(workflow_router)
app.include_router(fdrs_router)
app.include_router(documents_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(audit_router)


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "HEALTHY",
        "service": "AICTE FDR Portal Backend",
        "version": "1.0.0",
    }
