import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js for client-side execution and caching
env.allowLocalModels = false;
env.useBrowserCache = true;

// Disable multi-threading in WASM if SharedArrayBuffer is restricted
if (self.crossOriginIsolated) {
  env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
} else {
  env.backends.onnx.wasm.numThreads = 1;
}

class WhisperPipelineSingleton {
  static task = 'automatic-speech-recognition';
  static model = 'onnx-community/whisper-tiny';
  static instance = null;

  static async getInstance(progress_callback = null, modelName = 'onnx-community/whisper-tiny') {
    if (this.instance === null || this.model !== modelName) {
      this.model = modelName;
      
      // Determine device capability (prefer WebGPU, fallback to WASM)
      let device = 'wasm';
      if (navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            device = 'webgpu';
            console.log('[WhisperWorker] WebGPU is supported and selected! ⚡');
          }
        } catch (e) {
          console.warn('[WhisperWorker] WebGPU check failed, using WASM:', e);
          device = 'wasm';
        }
      }

      self.postMessage({
        status: 'init',
        message: `Loading ${modelName} on ${device.toUpperCase()}...`,
        device
      });

      this.instance = await pipeline(this.task, this.model, {
        device: device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        progress_callback
      });

      self.postMessage({
        status: 'ready',
        message: `Model ready on ${device.toUpperCase()}!`,
        device
      });
    }
    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  if (type === 'load') {
    try {
      await WhisperPipelineSingleton.getInstance((progress) => {
        self.postMessage({
          status: 'downloading',
          progress: progress
        });
      }, data?.modelName || 'onnx-community/whisper-tiny');
      self.postMessage({ status: 'loaded' });
    } catch (err) {
      self.postMessage({ status: 'error', error: err.message || String(err) });
    }
  } else if (type === 'transcribe') {
    try {
      const { audio, modelName, language } = data;
      const transcriber = await WhisperPipelineSingleton.getInstance((progress) => {
        self.postMessage({
          status: 'downloading',
          progress: progress
        });
      }, modelName || 'onnx-community/whisper-tiny');

      self.postMessage({ status: 'transcribing', message: 'Analyzing speech & generating timestamps...' });

      const options = {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5
      };

      if (language && language !== 'auto') {
        options.language = language;
      }

      const output = await transcriber(audio, options);

      // Normalize result into words and segments
      const words = [];
      const segments = [];

      if (output.chunks && Array.isArray(output.chunks)) {
        for (const chunk of output.chunks) {
          const text = chunk.text.trim();
          const [start, end] = chunk.timestamp || [0, 0];
          
          segments.push({
            text,
            start,
            end
          });

          // If word-level tokens exist
          const chunkWords = text.split(/\s+/).filter(Boolean);
          const duration = Math.max(0.1, end - start);
          const wordDur = duration / Math.max(1, chunkWords.length);

          chunkWords.forEach((cw, idx) => {
            words.push({
              word: cw,
              start: Number((start + idx * wordDur).toFixed(2)),
              end: Number((start + (idx + 1) * wordDur).toFixed(2))
            });
          });
        }
      }

      self.postMessage({
        status: 'complete',
        result: {
          text: output.text,
          segments,
          words: words.length > 0 ? words : []
        }
      });
    } catch (err) {
      console.error('[WhisperWorker Error]', err);
      self.postMessage({ status: 'error', error: err.message || String(err) });
    }
  }
});
