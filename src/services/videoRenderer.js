/**
 * On-Device GPU 9:16 Video Renderer & Caption Burner
 * Pure client-side canvas rendering using WebCodecs / mp4-muxer / MediaRecorder
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export class VideoRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.width = 1080;
    this.height = 1920;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  /**
   * Draw a single frame to preview or render canvas
   */
  drawFrame(videoEl, currentTime, layoutMode = 'crop', subtitleStyle = 'mrbeast', words = [], customText = '') {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    if (videoEl && videoEl.videoWidth > 0) {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const videoAspect = vw / vh;
      const targetAspect = w / h; // 9:16 = 0.5625

      if (layoutMode === 'crop') {
        // Smart Center Crop: scale video so it covers 1080x1920
        let scale = Math.max(w / vw, h / vh);
        let sw = w / scale;
        let sh = h / scale;
        let sx = (vw - sw) / 2;
        let sy = (vh - sh) / 2;
        ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, w, h);
      } else if (layoutMode === 'blur') {
        // Blurred zoomed background clone
        ctx.save();
        ctx.filter = 'blur(30px) brightness(0.6)';
        let bgScale = Math.max(w / vw, h / vh) * 1.2;
        let bgW = vw * bgScale;
        let bgH = vh * bgScale;
        ctx.drawImage(videoEl, (w - bgW) / 2, (h - bgH) / 2, bgW, bgH);
        ctx.restore();

        // Centered sharp main video
        let fitScale = Math.min(w / vw, (h * 0.75) / vh);
        let fitW = vw * fitScale;
        let fitH = vh * fitScale;
        let fitX = (w - fitW) / 2;
        let fitY = (h - fitH) / 2;
        ctx.drawImage(videoEl, fitX, fitY, fitW, fitH);
      } else if (layoutMode === 'split') {
        // Top 50% main video, Bottom 50% zoomed/tinted
        // Top half (1080x960)
        let topH = h / 2;
        let scaleTop = Math.max(w / vw, topH / vh);
        let swTop = w / scaleTop;
        let shTop = topH / scaleTop;
        ctx.drawImage(videoEl, (vw - swTop) / 2, (vh - shTop) / 2, swTop, shTop, 0, 0, w, topH);

        // Divider line
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(0, topH - 4, w, 8);

        // Bottom half (1080x960) - Stylized inverted/glow mirror
        ctx.save();
        ctx.filter = 'brightness(0.7) contrast(1.2)';
        ctx.drawImage(videoEl, (vw - swTop) / 2, (vh - shTop) / 2, swTop, shTop, 0, topH, w, topH);
        ctx.restore();
      }
    }

    // Render Subtitles
    this.renderSubtitles(currentTime, subtitleStyle, words, customText);

    return this.canvas;
  }

  /**
   * Render dynamic animated subtitles matching active timestamp
   */
  renderSubtitles(currentTime, style, words = [], customText = '') {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Find active words or group into 3-word punchy chunks
    let activeChunk = [];
    if (words && words.length > 0) {
      // Find current active word index
      const activeIdx = words.findIndex(
        (item) => currentTime >= item.start && currentTime <= item.end
      );

      if (activeIdx !== -1) {
        // Show current word and neighboring 2 words for smooth reading
        const startIdx = Math.max(0, activeIdx - 1);
        const endIdx = Math.min(words.length, activeIdx + 2);
        activeChunk = words.slice(startIdx, endIdx).map((item, idx) => ({
          ...item,
          isActive: startIdx + idx === activeIdx
        }));
      } else {
        // Check if between words within short tolerance
        const nearest = words.find(
          (item) => Math.abs(item.start - currentTime) < 0.3
        );
        if (nearest) {
          activeChunk = [{ ...nearest, isActive: true }];
        }
      }
    } else if (customText) {
      activeChunk = customText.split(/\s+/).map((word) => ({ word, isActive: true }));
    }

    if (activeChunk.length === 0) return;

    ctx.save();
    // Default Y positioning: 72% down canvas (optimal for TikTok/Shorts UI safe zone)
    const textY = h * 0.72;

    if (style === 'mrbeast') {
      // Bold Montserrat/Impact punch style: Heavy black outline, yellow highlighted active word
      ctx.font = '900 68px "Impact", "Montserrat", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      const fullPhrase = activeChunk.map((c) => c.word.toUpperCase()).join(' ');
      const totalWidth = ctx.measureText(fullPhrase).width;
      let curX = (w - totalWidth) / 2;

      ctx.textAlign = 'left';
      activeChunk.forEach((chunk) => {
        const text = chunk.word.toUpperCase() + ' ';
        const wordWidth = ctx.measureText(text).width;

        // Black stroke outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 16;
        ctx.strokeText(text, curX, textY);

        // Fill color
        ctx.fillStyle = chunk.isActive ? '#FACC15' : '#FFFFFF';
        ctx.fillText(text, curX, textY);

        curX += wordWidth;
      });
    } else if (style === 'neon') {
      // Glowing Cyan/Magenta Pill Style
      ctx.font = 'bold 56px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const phrase = activeChunk.map((c) => c.word).join(' ');
      const textWidth = ctx.measureText(phrase).width;
      const padding = 28;

      // Pill Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect((w - textWidth) / 2 - padding, textY - 45, textWidth + padding * 2, 90, 45);
      ctx.fill();
      ctx.stroke();

      // Text with Cyan glow
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(phrase, w / 2, textY);
    } else if (style === 'karaoke') {
      // Clean white text with highlighted background box on active word
      ctx.font = '800 60px "Montserrat", sans-serif';
      ctx.textBaseline = 'middle';

      const fullPhrase = activeChunk.map((c) => c.word).join(' ');
      const totalWidth = ctx.measureText(fullPhrase).width;
      let curX = (w - totalWidth) / 2;

      ctx.textAlign = 'left';
      activeChunk.forEach((chunk) => {
        const text = chunk.word + ' ';
        const wordWidth = ctx.measureText(text).width;

        if (chunk.isActive) {
          // Highlight background pill for active word
          ctx.fillStyle = '#4f46e5';
          ctx.beginPath();
          ctx.roundRect(curX - 8, textY - 40, wordWidth, 80, 16);
          ctx.fill();
        }

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 8;
        ctx.strokeText(text, curX, textY);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, curX, textY);

        curX += wordWidth;
      });
    } else {
      // Clean Minimal
      ctx.font = '600 52px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const phrase = activeChunk.map((c) => c.word).join(' ');
      const textWidth = ctx.measureText(phrase).width;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.roundRect((w - textWidth) / 2 - 20, textY - 35, textWidth + 40, 70, 14);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(phrase, w / 2, textY);
    }

    ctx.restore();
  }

  /**
   * Export video as MP4 client-side
   */
  async exportMP4(videoElement, options = {}, onProgress = null) {
    const {
      layoutMode = 'crop',
      subtitleStyle = 'mrbeast',
      words = [],
      duration = videoElement.duration || 10,
      startTime = 0,
      fps = 30
    } = options;

    return new Promise(async (resolve, reject) => {
      try {
        const totalDuration = Math.min(duration, (videoElement.duration || 60) - startTime);
        const totalFrames = Math.floor(totalDuration * fps);

        // Check if WebCodecs VideoEncoder is available for fast hardware encoding
        const hasWebCodecs = typeof window.VideoEncoder === 'function';

        if (hasWebCodecs) {
          try {
            console.log('[VideoRenderer] Using WebCodecs + mp4-muxer for high-speed GPU MP4 encoding ⚡');
            const blob = await this._exportWithWebCodecs(
              videoElement,
              startTime,
              totalDuration,
              fps,
              totalFrames,
              layoutMode,
              subtitleStyle,
              words,
              onProgress
            );
            return resolve(blob);
          } catch (wcErr) {
            console.warn('[VideoRenderer] WebCodecs encoding fallback to MediaRecorder:', wcErr);
          }
        }

        // MediaRecorder Fallback
        console.log('[VideoRenderer] Using MediaRecorder for MP4 rendering...');
        const blob = await this._exportWithMediaRecorder(
          videoElement,
          startTime,
          totalDuration,
          fps,
          layoutMode,
          subtitleStyle,
          words,
          onProgress
        );
        resolve(blob);
      } catch (err) {
        reject(err);
      }
    });
  }

  async _exportWithWebCodecs(videoElement, startTime, duration, fps, totalFrames, layoutMode, subtitleStyle, words, onProgress) {
    const muxerTarget = new ArrayBufferTarget();
    const muxer = new Muxer({
      target: muxerTarget,
      video: {
        codec: 'avc',
        width: this.width,
        height: this.height
      },
      fastStart: 'in-memory'
    });

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error('[VideoEncoder Error]', e)
    });

    videoEncoder.configure({
      codec: 'avc1.420028', // H.264 Baseline Profile Level 4.0
      width: this.width,
      height: this.height,
      bitrate: 4_500_000, // 4.5 Mbps
      framerate: fps
    });

    const frameInterval = 1 / fps;
    let frameIdx = 0;

    for (let time = startTime; time < startTime + duration; time += frameInterval) {
      videoElement.currentTime = time;
      await new Promise((r) => {
        const onSeeked = () => {
          videoElement.removeEventListener('seeked', onSeeked);
          r();
        };
        videoElement.addEventListener('seeked', onSeeked, { once: true });
      });

      this.drawFrame(videoElement, time, layoutMode, subtitleStyle, words);

      const videoFrame = new VideoFrame(this.canvas, {
        timestamp: Math.round((time - startTime) * 1_000_000) // microseconds
      });

      videoEncoder.encode(videoFrame, { keyFrame: frameIdx % (fps * 2) === 0 });
      videoFrame.close();

      frameIdx++;
      if (onProgress) {
        const percent = Math.min(99, Math.round((frameIdx / totalFrames) * 100));
        onProgress({ percent, frame: frameIdx, totalFrames });
      }
    }

    await videoEncoder.flush();
    muxer.finalize();

    const buffer = muxerTarget.buffer;
    return new Blob([buffer], { type: 'video/mp4' });
  }

  async _exportWithMediaRecorder(videoElement, startTime, duration, fps, layoutMode, subtitleStyle, words, onProgress) {
    return new Promise((resolve, reject) => {
      const stream = this.canvas.captureStream(fps);

      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
          ? 'video/mp4;codecs=avc1'
          : 'video/webm;codecs=vp9';
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        resolve(finalBlob);
      };

      recorder.onerror = (e) => reject(e);

      videoElement.currentTime = startTime;
      videoElement.play();
      recorder.start(100);

      const interval = setInterval(() => {
        const curTime = videoElement.currentTime;
        this.drawFrame(videoElement, curTime, layoutMode, subtitleStyle, words);

        const progressPercent = Math.min(99, Math.round(((curTime - startTime) / duration) * 100));
        if (onProgress) onProgress({ percent: progressPercent });

        if (curTime >= startTime + duration || videoElement.ended) {
          clearInterval(interval);
          videoElement.pause();
          recorder.stop();
        }
      }, 1000 / fps);
    });
  }
}
