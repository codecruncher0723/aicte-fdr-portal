from app.routers.auth import router as auth_router
from app.routers.institutions import router as institutions_router
from app.routers.workflow import router as workflow_router
from app.routers.fdrs import router as fdrs_router
from app.routers.documents import router as documents_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reports import router as reports_router
from app.routers.notifications import router as notifications_router

__all__ = [
    "auth_router",
    "institutions_router",
    "workflow_router",
    "fdrs_router",
    "documents_router",
    "dashboard_router",
    "reports_router",
    "notifications_router",
]
