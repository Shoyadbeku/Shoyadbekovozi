"""
RVC (Retrieval-based Voice Conversion) Server for Shoyadbek Ovozi
Model: shoyadbek_ovoz_40e_160s.pth
Drive ID: 1JxU5sGAMaLVfdj0oWA3O-BORu0q80goO
Index: shoyadbek_ovoz.index

Run locally or on Google Colab:
  pip install rvc-python gdown fastapi uvicorn python-multipart
  uvicorn rvc_server:app --host 0.0.0.0 --port 8000
"""

import os
import sys
import shutil
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Shoyadbek Ovozi RVC Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "shoyadbek_ovoz_40e_160s.pth"
INDEX_PATH = "shoyadbek_ovoz.index"
DRIVE_FILE_ID = "1JxU5sGAMaLVfdj0oWA3O-BORu0q80goO"

rvc_instance = None

def get_rvc():
    global rvc_instance
    if rvc_instance is not None:
        return rvc_instance

    try:
        import torch
        from rvc_python.infer import RVCInference
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Kutubxonalar topilmadi. 'pip install rvc-python torch gdown' o'rnating. Xato: {str(e)}"
        )

    # Download model from Google Drive if not locally present
    if not os.path.exists(MODEL_PATH):
        print(f"[RVC] {MODEL_PATH} yuklab olinmoqda (Google Drive)...")
        try:
            import gdown
            gdown.download(id=DRIVE_FILE_ID, output=MODEL_PATH, quiet=False)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Google Drive'dan modelni yuklab olishda xatolik: {str(e)}"
            )

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    print(f"[RVC] Model yuklanmoqda (Qurilma: {device})...")
    rvc = RVCInference(device=device)
    rvc.load_model(MODEL_PATH)

    if os.path.exists(INDEX_PATH):
        print(f"[RVC] Index yuklanmoqda: {INDEX_PATH}")
        rvc.load_index(INDEX_PATH)
    else:
        print(f"[RVC] Ogohlantirish: {INDEX_PATH} topilmadi, index-siz ishlaydi.")

    rvc_instance = rvc
    return rvc_instance

@app.get("/")
@app.get("/health")
def health_check():
    has_model = os.path.exists(MODEL_PATH)
    has_index = os.path.exists(INDEX_PATH)
    return {
        "status": "ok",
        "service": "Shoyadbek Ovozi RVC Server",
        "model": MODEL_PATH,
        "has_model_file": has_model,
        "has_index_file": has_index,
        "drive_file_id": DRIVE_FILE_ID,
    }

@app.post("/convert")
async def convert_audio(file: UploadFile = File(...)):
    """
    Kiritilgan audio faylni Shoyadbek ovoziga aylantirish (RVC Inference).
    """
    rvc = get_rvc()

    suffix = os.path.splitext(file.filename or "input.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
        shutil.copyfileobj(file.file, tmp_in)
        temp_input_path = tmp_in.name

    temp_output_path = temp_input_path + "_rvc_output.wav"

    try:
        rvc.infer_file(
            input_path=temp_input_path,
            output_path=temp_output_path,
        )

        if not os.path.exists(temp_output_path):
            raise HTTPException(
                status_code=500,
                detail="RVC ovozni o'zgartirish jarayonida fayl yaratilmadi."
            )

        return FileResponse(
            temp_output_path,
            media_type="audio/wav",
            filename="shoyadbek_ovoz.wav"
        )
    finally:
        if os.path.exists(temp_input_path):
            try:
                os.remove(temp_input_path)
            except Exception:
                pass

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5005))
    print(f"[RVC] Server ishga tushmoqda: http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
