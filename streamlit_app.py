"""
Mening Ovozim — Matndan nutqqa (Aisha AI + RVC)
Streamlit Community Cloud uchun web-ilova.

DEPLOY QILISH:
1. GitHub'da repo yarating (yoki mavjudiga qo'shing), shu fayllarni yuklang:
   - streamlit_app.py (shu fayl)
   - requirements.txt
   - packages.txt
   - shoyadbek_ovoz.pth  (va bo'lsa shoyadbek_ovoz.index)
     * DIQQAT: GitHub 100MB dan katta faylni oddiy push bilan qabul qilmaydi.
       Model fayl shundan katta bo'lsa, Git LFS ishlating yoki modelni
       Google Drive'da saqlab, ilova ishga tushganda avtomatik yuklab olish
       kodini qo'shish kerak bo'ladi (kerak bo'lsa shuni ham yozib beraman).
2. share.streamlit.io saytiga GitHub hisobingiz bilan kiring
3. "New app" -> repo, branch va "streamlit_app.py" ni tanlang -> Deploy
4. Deploy oldidan "Advanced settings -> Secrets" bo'limiga qo'shing:
       AISHA_API_KEY = "sizning_api_keyingiz"
"""

import os
import re
import streamlit as st
from pydub import AudioSegment
from aisha_ai import AishaClient
from rvc_python.infer import RVCInference

st.set_page_config(page_title="Mening Ovozim", page_icon="🎙️")

# ============== SOZLAMALAR ==============

AISHA_API_KEY = st.secrets.get("AISHA_API_KEY", os.environ.get("AISHA_API_KEY", ""))

RVC_MODEL_PATH = "shoyadbek_ovoz.pth"
RVC_INDEX_PATH = "shoyadbek_ovoz.index"

RVC_DEVICE = "cpu"       # Streamlit Cloud'da faqat CPU bor
RVC_PITCH = 0
RVC_INDEX_RATE = 0.75
RVC_PROTECT = 0.33

# =========================================


@st.cache_resource
def load_clients():
    aisha = AishaClient(api_key=AISHA_API_KEY)
    rvc = RVCInference(device=RVC_DEVICE)
    rvc.load_model(RVC_MODEL_PATH)
    try:
        rvc.set_params(
            index_path=RVC_INDEX_PATH,
            index_rate=RVC_INDEX_RATE,
            f0_up_key=RVC_PITCH,
            protect=RVC_PROTECT,
        )
    except Exception:
        pass
    return aisha, rvc


aisha_client, rvc_client = load_clients()


def _split_text(text, max_len=900):
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks, current = [], ""
    for s in sentences:
        if len(current) + len(s) + 1 <= max_len:
            current = f"{current} {s}".strip()
        else:
            if current:
                chunks.append(current)
            current = s
    if current:
        chunks.append(current)
    return chunks


def text_to_my_voice(text, mood, speed):
    chunks = _split_text(text)
    combined = AudioSegment.empty()

    for i, chunk in enumerate(chunks):
        raw_path = f"_aisha_part_{i}.wav"
        rvc_path = f"_rvc_part_{i}.wav"

        aisha_client.tts(
            transcript=chunk,
            language="uz",
            model="Gulnoza",
            mood=mood,
            speed=speed,
            output_path=raw_path,
        )
        rvc_client.infer_file(raw_path, rvc_path)
        combined += AudioSegment.from_wav(rvc_path)

        os.remove(raw_path)
        os.remove(rvc_path)

    output_path = "final_output.wav"
    combined.export(output_path, format="wav")
    return output_path


st.title("🎙️ Matndan — o'z ovozimda nutq")

text = st.text_area("Matn", height=150, placeholder="Bu yerga matningizni yozing...")

col1, col2 = st.columns(2)
with col1:
    mood = st.selectbox("Kayfiyat", ["Neutral", "Cheerful", "Happy", "Sad"])
with col2:
    speed = st.slider("Tezlik", 0.5, 2.0, 1.0, 0.1)

if st.button("Ovoz yaratish", type="primary"):
    if not text.strip():
        st.warning("Iltimos, matn kiriting.")
    elif not AISHA_API_KEY:
        st.error("AISHA_API_KEY sozlanmagan (Streamlit Secrets'ga qo'shing).")
    else:
        with st.spinner("Yaratilmoqda... (CPU'da bir necha o'nlab soniya ketishi mumkin)"):
            out_path = text_to_my_voice(text, mood, speed)
        st.audio(out_path)
        with open(out_path, "rb") as f:
            st.download_button("Yuklab olish", f, file_name="ovoz.wav")
