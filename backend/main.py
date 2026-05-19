import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from config import init_db, FRONTEND_URL
from routes.enrollment  import router as enroll_router
from routes.recognition import router as recognition_router
from routes.auth        import router as auth_router
from routes.bi          import router as bi_router
from routes.prof        import router as prof_router
from routes.student     import router as student_router
from routes.gestion     import router as gestion_router
from routes.voice       import router as voice_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title       = "SmartCampus IA",
    description = "Plateforme intelligente de gestion des étudiants",
    version     = "2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = [
        FRONTEND_URL,
        "http://10.10.1.79:5173",
        "https://localhost:5173",
        "http://localhost:5173",
    ],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(auth_router,        prefix="/api")
app.include_router(enroll_router,      prefix="/api")
app.include_router(recognition_router, prefix="/api")
app.include_router(bi_router,          prefix="/api")
app.include_router(prof_router,        prefix="/api")
app.include_router(student_router,     prefix="/api")
app.include_router(gestion_router,     prefix="/api")
app.include_router(voice_router,       prefix="/api")


def _preload_ai_models():
    """Charge les modèles InsightFace une fois au démarrage pour éviter
    le délai de 30-60 s sur la première requête /capture."""
    from routes.enrollment import get_detector, get_encoder
    logger.info("Chargement des modeles IA (InsightFace buffalo_l)...")
    get_detector()
    logger.info("Detecteur pret.")
    get_encoder()
    logger.info("Encodeur pret. Modeles IA charges.")


@app.on_event("startup")
async def startup():
    init_db()
    try:
        await run_in_threadpool(_preload_ai_models)
    except Exception as e:
        logger.error(f"Erreur chargement modeles IA: {e}")


@app.get("/")
async def root():
    return {"app": "SmartCampus IA", "version": "2.0.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}