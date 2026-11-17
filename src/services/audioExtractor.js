/**
 * Pure client-side audio extraction and 16kHz mono resampling for Whisper AI
 */
export async function extractAudioFromVideoBlob(videoBlob, onProgress = null) {
  if (onProgress) onProgress({ status: 'reading', progress: 10, message: 'Reading video audio track...' });

  const arrayBuffer = await videoBlob.arrayBuffer();

  if (onProgress) onProgress({ status: 'decoding', progress: 40, message: 'Decoding audio stream...' });

  // Web Audio Context for decoding
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let decodedBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close();
  }

  if (onProgress) onProgress({ status: 'resampling', progress: 75, message: 'Resampling to 16kHz mono for Whisper...' });

  // Whisper expects 16,000 Hz sample rate, single channel (mono) Float32Array
  const targetSampleRate = 16000;
  const numChannels = 1;
  const targetLength = Math.round(decodedBuffer.duration * targetSampleRate);

  const offlineCtx = new OfflineAudioContext(numChannels, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampledBuffer = await offlineCtx.startRendering();
  const float32Data = resampledBuffer.getChannelData(0);

  if (onProgress) onProgress({ status: 'ready', progress: 100, message: 'Audio extraction complete!' });

  return float32Data;
}
