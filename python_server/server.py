"""
YT Short Clipper V2 - Companion Python Server
Provides local/remote endpoints for yt-dlp downloading, FFmpeg processing, and Whisper transcription.
Usable inside Android Termux (http://127.0.0.1:8000), Google Colab, or Hugging Face Spaces.
"""

import os
import sys
import json
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import uvicorn

app = FastAPI(title="YT Short Clipper V2 Backend Bridge")

# Enable Full CORS including Chrome Private Network Access for mobile Termux
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_private_network_headers(request: Request, call_next):
    # Chrome Private Network Access support (allows web pages to reach local/private IP)
    if request.method == "OPTIONS":
        response = Response(status_code=204)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# Lazy Whisper model cache
whisper_model = None

def get_whisper_model(model_name: str = "tiny"):
    global whisper_model
    if whisper_model is None:
        try:
            import whisper
            print(f"[Whisper] Loading local whisper model: {model_name}...")
            whisper_model = whisper.load_model(model_name)
        except Exception as e:
            print(f"[Whisper] Could not load openai-whisper: {e}")
            whisper_model = None
    return whisper_model

@app.get("/")
@app.get("/health")
def health_check():
    has_ytdlp = shutil.which("yt-dlp") is not None
    has_ffmpeg = shutil.which("ffmpeg") is not None
    try:
        import whisper
        has_whisper = True
    except ImportError:
        has_whisper = False

    return {
        "status": "online",
        "service": "YT Short Clipper V2 Python Server",
        "capabilities": {
            "yt_dlp": has_ytdlp,
            "ffmpeg": has_ffmpeg,
            "whisper": has_whisper
        }
    }

@app.post("/api/download-yt")
async def download_youtube_clip(request: Request):
    data = await request.json()
    url = data.get("url")
    start = data.get("start", 0)
    duration = data.get("duration", 60)

    if not url:
        raise HTTPException(status_code=400, detail="Missing YouTube URL")

    temp_dir = tempfile.mkdtemp(prefix="ytclip_")
    out_pattern = os.path.join(temp_dir, "clip.mp4")

    # yt-dlp download command with section downloading if start/duration specified
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--output", out_pattern
    ]

    if start or duration:
        # download specific section
        cmd.extend(["--download-sections", f"*{start}-{start + duration}"])

    cmd.append(url)

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if proc.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={"error": "yt-dlp failed", "details": proc.stderr}
            )

        # Locate output file
        files = list(Path(temp_dir).glob("clip*.mp4"))
        if not files:
            files = list(Path(temp_dir).glob("*"))
        if not files:
            return JSONResponse(status_code=500, content={"error": "Output video file not found"})

        target_file = str(files[0])
        return FileResponse(
            target_file,
            media_type="video/mp4",
            filename="youtube_short_source.mp4"
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    model: str = Form("tiny"),
    language: Optional[str] = Form(None)
):
    try:
        model_instance = get_whisper_model(model)
        if model_instance is None:
            # Fallback to whisper CLI if installed
            if shutil.which("whisper"):
                pass
            else:
                return JSONResponse(
                    status_code=503,
                    content={"error": "Whisper library not installed on Python server. Install with: pip install openai-whisper"}
                )

        temp_dir = tempfile.mkdtemp(prefix="whisper_")
        input_path = os.path.join(temp_dir, file.filename or "input.wav")

        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Transcribe with word timestamps
        options = {"word_timestamps": True}
        if language and language != "auto":
            options["language"] = language

        result = model_instance.transcribe(input_path, **options)

        # Format into standardized word & segment timestamps
        segments_output = []
        words_output = []

        for seg in result.get("segments", []):
            segments_output.append({
                "id": seg.get("id"),
                "start": seg.get("start"),
                "end": seg.get("end"),
                "text": seg.get("text", "").strip()
            })
            for w in seg.get("words", []):
                words_output.append({
                    "word": w.get("word", "").strip(),
                    "start": w.get("start"),
                    "end": w.get("end"),
                    "probability": w.get("probability", 1.0)
                })

        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language"),
            "segments": segments_output,
            "words": words_output
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Transcription error: {str(e)}"})

@app.post("/api/render-broll")
async def render_broll(
    main_video: UploadFile = File(...),
    broll_video: UploadFile = File(...)
):
    # Splits screen: main video on top 50%, b-roll video on bottom 50% in 1080x1920 (9:16)
    temp_dir = tempfile.mkdtemp(prefix="render_")
    main_path = os.path.join(temp_dir, "main.mp4")
    broll_path = os.path.join(temp_dir, "broll.mp4")
    out_path = os.path.join(temp_dir, "output_split.mp4")

    with open(main_path, "wb") as f:
        shutil.copyfileobj(main_video.file, f)
    with open(broll_path, "wb") as f:
        shutil.copyfileobj(broll_video.file, f)

    cmd = [
        "ffmpeg", "-y",
        "-i", main_path,
        "-i", broll_path,
        "-filter_complex",
        "[0:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[top];"
        "[1:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[bottom];"
        "[top][bottom]vstack=inputs=2[v]",
        "-map", "[v]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-c:a", "aac",
        "-shortest",
        out_path
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        if proc.returncode != 0:
            return JSONResponse(status_code=500, content={"error": "FFmpeg render failed", "details": proc.stderr})
        return FileResponse(out_path, media_type="video/mp4", filename="rendered_split_916.mp4")
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting YT Short Clipper V2 Python Server on port {port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
