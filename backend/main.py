from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import engine, Base
from db.models import Student, StudentFace, StudentFaceTemp
from routes.enrollment  import router as enroll_router
from routes.recognition import router as recog_router

app = FastAPI(title="SmartCampus IA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    print("Tables créées avec succès")

app.include_router(enroll_router,  prefix="/api")
app.include_router(recog_router,   prefix="/api")

@app.get("/")
def root():
    return {"status": "ok", "message": "SmartCampus IA en ligne"}