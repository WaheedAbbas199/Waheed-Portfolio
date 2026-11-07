from fastapi import APIRouter

from app.api.v1.endpoints import admin, public, system

api_router = APIRouter()
for module in (system, public, admin):
    api_router.include_router(module.router)
