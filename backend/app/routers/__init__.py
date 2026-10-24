from .auth import router as auth_router
from .institutions import router as institutions_router
from .workflow import router as workflow_router
from .fdrs import router as fdrs_router
from .documents import router as documents_router
from .dashboard import router as dashboard_router
from .reports import router as reports_router
from .notifications import router as notifications_router

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
