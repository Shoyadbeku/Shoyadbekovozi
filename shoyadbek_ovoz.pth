import os
import gdown
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from rvc_python.infer import RVCInference

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "shoyadbek_ovoz_40e_160s.pth"
DRIVE_FILE_ID = "1JxU5sGAMaLVfdj0oWA3O-BORu0q80goO"

# Server ishga tushganda Drive'dan .pth faylini avtomatik yuklab oladi
if not os.path.exists(MODEL_PATH):
    gdown.download(id=DRIVE_FILE_ID, output=MODEL_PATH, quiet=False)

@app.post("/convert")
async def convert_audio(file: UploadFile = File(...)):
    input_path = f"temp_{file.filename}"
    output_path = "output.wav"
    
    with open(input_path, "wb") as buffer:
        buffer.write(await file.read())
        
    rvc = RVCInference(device="cpu")
    rvc.load_model(MODEL_PATH)
    rvc.load_index("shoyadbek_ovoz.index")
    
    rvc.infer_file(input_path, output_path)
    
    if os.path.exists(input_path):
        os.remove(input_path)
    
    return FileResponse(output_path, media_type="audio/wav")
