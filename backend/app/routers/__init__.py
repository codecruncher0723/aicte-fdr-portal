from app.routers.auth import router as auth_router
from app.routers.institutions import router as institutions_router
from app.routers.workflow import router as workflow_router

__all__ = ["auth_router", "institutions_router", "workflow_router"]
