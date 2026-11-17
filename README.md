# ⚡ YT Short Clipper V2 - Online & Mobile Hybrid Studio

> **All-in-One Online & Mobile Hybrid Studio** for creating high-impact 9:16 vertical short videos (TikTok, Instagram Reels, YouTube Shorts) with **Zero PC, Zero Vercel, and Zero Paid AI API Keys**.

---

## 🌟 Highlights & Architecture

- **🌐 Live Online Web App (GitHub Pages)**: Deploys automatically on every push to `main` via GitHub Actions. Open directly from any mobile browser.
- **📱 Automated Android APK (Capacitor + Gradle)**: Builds `app-debug.apk` automatically on `ubuntu-latest` with Java 17 and Android SDK via GitHub Actions, available as both an Actions Artifact and a downloadable release file under **GitHub Releases**.
- **🤖 Keyless AI Transcription**:
  - **Engine 1 (In-Browser On-Device WebGPU Whisper)**: Runs quantized `onnx-community/whisper-tiny` (~40MB) directly in a Web Worker using WebGPU/WASM via `@huggingface/transformers`. Cached automatically in IndexedDB on first load. Generates word-level timestamps with **$0 cost** and **no API keys**.
  - **Engine 2 (Companion Python Server)**: Optional bridge for Android Termux (`http://127.0.0.1:8000`) or free Google Colab / HuggingFace Spaces using `yt-dlp` and `ffmpeg` with full CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Private-Network: true`).
- **⚡ On-Device GPU 9:16 Canvas Rendering**: Hardware-accelerated canvas video cropping, animated karaoke/MrBeast subtitles, and MP4 encoding using `WebCodecs` and `mp4-muxer`.
- **📲 Mobile Native Sharing**: 1-tap instant share sheet (`@capacitor/share` & `navigator.share`) to TikTok, Instagram Reels, and YouTube Shorts.
- **▶ Client-Side YouTube Resumable Upload**: 100% browser-based YouTube Data API v3 upload using Google Identity Services (GIS) OAuth 2.0 Token Client (no `client_secrets.json` or backend server required).

---

## 🚀 Quick Setup & Automated Deployment

### Step 1: Push to GitHub
Initialize your Git repository and push the project to GitHub:

```bash
git init
git add .
git commit -m "feat: All-in-One Online & Mobile Hybrid Studio V2.1.0"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: Automated GitHub Actions CI/CD
Once pushed to `main`, `.github/workflows/build-and-deploy.yml` triggers two automated jobs:
1. **🌐 Deploy Live Web Studio (GitHub Pages)**:
   - Builds static assets and publishes your studio to `https://<your-username>.github.io/<your-repo-name>/`.
   - *Note:* Make sure GitHub Pages is enabled in your repository under **Settings &rarr; Pages &rarr; Source: GitHub Actions**.
2. **📱 Build Automated Android APK**:
   - Runs on `ubuntu-latest` with Java 17 and Android SDK.
   - Executes `./gradlew assembleDebug`.
   - Uploads `app-debug.apk` as a downloadable artifact in the GitHub Actions run summary AND publishes it as an installable release asset under **Releases**.

---

## 🤖 AI Transcription Engines

### Engine 1: In-Browser WebGPU Whisper (Recommended)
- **Zero Configuration**: Tap **"Auto-Generate Vertical Captions"** inside the app.
- Audio is extracted directly from the video stream using the browser Web Audio API and resampled to 16kHz mono.
- The quantized ONNX Whisper model downloads once (~40MB) and is cached in IndexedDB for offline and instant subsequent loads.

### Engine 2: Companion Python Server (Termux Android / Google Colab)

#### Option A: Running on Android via Termux (Local 127.0.0.1:8000)
1. Open the **Termux** app on your Android device.
2. Run the 1-click setup script:
   ```bash
   cd python_server
   chmod +x setup_termux.sh
   ./setup_termux.sh
   ```
3. In the YT Short Clipper app, go to **Settings &rarr; Speech AI Transcription Engine &rarr; Local/Remote Python Server** with URL `http://127.0.0.1:8000`.

#### Option B: Running on Free Google Colab (GPU-Accelerated)
1. Open [`python_server/colab_server.ipynb`](file:///c:/Users/Admin/Music/YTShortClipperV2_2.0.7-beta_x64_portable/python_server/colab_server.ipynb) in [Google Colab](https://colab.research.google.com).
2. Set Runtime to **T4 GPU** (`Runtime` &rarr; `Change runtime type`).
3. Run the cells to launch the server and tunnel URL (via ngrok or localtunnel).
4. Paste the tunnel URL into the app's Settings modal.

---

## 🎬 9:16 Rendering & Styling

- **Layout Modes**:
  - **Crop 9:16**: Smart center crop of 16:9 landscape video into full 9:16 portrait.
  - **Blurred BG**: Centers the original video over a blurred, zoomed background copy.
  - **Split / B-Roll**: Displays primary video on top and secondary clip/mirror on bottom.
- **Caption Styles**:
  - **MrBeast Punch**: High-impact yellow highlighted active words with heavy black stroke.
  - **Neon Glow**: Glowing cyan/magenta pill with modern typography.
  - **Karaoke**: Highlight box following active spoken words.
  - **Minimal**: Subtle semi-transparent rounded pill.

---

## 🔑 Google OAuth 2.0 YouTube Setup Guide (Mobile Browser)

You do **not** need a computer to configure direct YouTube uploads:

1. Open **[console.cloud.google.com](https://console.cloud.google.com)** in mobile Chrome and switch to **"Desktop Site"** mode.
2. Create a new project and enable **YouTube Data API v3**.
3. Go to **APIs & Services &rarr; OAuth consent screen**:
   - Choose **External** and enter an App Name and your email.
   - Under **Test Users**, add your YouTube channel Gmail address.
4. Go to **Credentials &rarr; Create Credentials &rarr; OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `https://<your-username>.github.io` (your live GitHub Pages URL)
     - `https://localhost` (for Capacitor Android APK)
     - `http://localhost:5173` (for local dev testing)
5. Copy the generated **Client ID** (e.g. `xxxx.apps.googleusercontent.com`) and paste it into the **Google OAuth Client ID** field in the app's Settings modal.

---

## 🛠 Local Development & Testing

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Build production static bundle (dist/)
npm run build

# Sync Capacitor Android project
npx cap sync android
```
