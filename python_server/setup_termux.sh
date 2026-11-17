#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# YT Short Clipper V2 - 1-Click Termux Setup Script for Android
# ==============================================================================

echo "================================================================="
echo "   YT SHORT CLIPPER V2 - TERMUX PYTHON SERVER SETUP (ANDROID)   "
echo "================================================================="

# Update package lists
pkg update -y && pkg upgrade -y

# Install dependencies: Python, FFmpeg, Git, clang
pkg install -y python ffmpeg git clang libjpeg-turbo libcrypt

# Upgrade pip
pip install --upgrade pip

# Install server requirements
pip install fastapi uvicorn python-multipart yt-dlp

# Optional: Install whisper or whisper.cpp for Android CPU
echo "Installing whisper..."
pip install openai-whisper

echo ""
echo "================================================================="
echo " Setup complete! Starting local server on http://127.0.0.1:8000"
echo " Open the YT Short Clipper V2 App on your phone and connect to:"
echo " http://127.0.0.1:8000"
echo "================================================================="
echo ""

python server.py
