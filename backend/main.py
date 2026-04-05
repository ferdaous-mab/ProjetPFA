from fastapi import FastAPI
from config import engine, Base
from db.models import Student, StudentFace
from routes.enrollment import router as enroll_router

app = FastAPI(title="Student Face Recognition System")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    print("Tables créées avec succès")

app.include_router(enroll_router, prefix="/api")

@app.get("/")
def root():
    return {"status": "ok", "message": "API en ligne"}