/**
 * Mobile Native Sharing & Download Helper
 * Integrates @capacitor/share and Web Share API (navigator.share)
 */
import { Share } from '@capacitor/share';

export async function shareVideoFile(videoBlob, filename = 'youtube_short.mp4') {
  const file = new File([videoBlob], filename, { type: videoBlob.type || 'video/mp4' });

  // 1. Try Capacitor Native Share if available (Android APK environment)
  try {
    const canShare = await Share.canShare();
    if (canShare.value) {
      // Create object URL or base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(videoBlob);
      });
      const base64Url = await base64Promise;

      await Share.share({
        title: 'Exported Short Video',
        text: 'Created with YT Short Clipper V2 🚀 #Shorts',
        url: base64Url,
        dialogTitle: 'Share to TikTok / Reels / Shorts'
      });
      return { success: true, method: 'capacitor' };
    }
  } catch (capErr) {
    console.log('[NativeShare] Capacitor share not active or failed, trying Web Share:', capErr);
  }

  // 2. Try Standard Web Share API (Mobile Browsers: Chrome on Android, Safari on iOS)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'YT Short Clipper Video',
        text: 'Check out this short clip! #Shorts'
      });
      return { success: true, method: 'web-share' };
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      console.warn('[NativeShare] navigator.share error:', shareErr);
    }
  }

  // 3. Fallback: Direct Download to phone storage
  downloadBlob(videoBlob, filename);
  return { success: true, method: 'download' };
}

export function downloadBlob(blob, filename = 'youtube_short.mp4') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
