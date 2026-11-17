/**
 * 100% Client-Side YouTube Resumable Video Uploader
 * Uses Google Identity Services (GIS) OAuth2 Token Client Flow (zero server secrets)
 */

export class YouTubeUploader {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Load the Google Identity Services SDK script dynamically
   */
  async loadGISScript() {
    if (window.google?.accounts?.oauth2) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = (e) => reject(new Error('Failed to load Google Identity Services SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Request OAuth2 Access Token with YouTube Upload scope
   */
  async requestAuthToken(clientId) {
    if (!clientId) {
      throw new Error('Google OAuth Client ID is missing. Please enter your Client ID in Settings.');
    }

    // Check if existing token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    await this.loadGISScript();

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube',
          callback: (response) => {
            if (response.error) {
              return reject(new Error(response.error_description || response.error));
            }
            this.accessToken = response.access_token;
            // Default GIS access token lifetime is 3600 seconds
            const expiresIn = (Number(response.expires_in) || 3600) * 1000;
            this.tokenExpiresAt = Date.now() + expiresIn;
            resolve(this.accessToken);
          }
        });

        // Prompt user for account authorization
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Perform Resumable Upload to YouTube Data API v3
   */
  async uploadVideo(videoBlob, metadata = {}, clientId, onProgress = null) {
    const token = await this.requestAuthToken(clientId);

    const {
      title = 'My YouTube Short #Shorts',
      description = 'Created with YT Short Clipper V2 🚀\n#Shorts #Viral',
      tags = ['Shorts', 'Viral'],
      privacyStatus = 'public',
      categoryId = '22'
    } = metadata;

    if (onProgress) onProgress({ status: 'initiating', percent: 2, message: 'Initiating YouTube upload session...' });

    // Step 1: Initialize Resumable Upload
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': videoBlob.type || 'video/mp4',
          'X-Upload-Content-Length': String(videoBlob.size)
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            tags,
            categoryId
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false
          }
        })
      }
    );

    if (!initResponse.ok) {
      const errJson = await initResponse.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `YouTube API rejected session: ${initResponse.statusText}`);
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('YouTube did not return a resumable upload Location URL');
    }

    if (onProgress) onProgress({ status: 'uploading', percent: 5, message: 'Uploading video bytes to YouTube...' });

    // Step 2: Stream Video Chunks via XMLHttpRequest for accurate progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', videoBlob.type || 'video/mp4');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.min(99, Math.round(5 + (e.loaded / e.total) * 94));
          onProgress({
            status: 'uploading',
            percent,
            loaded: e.loaded,
            total: e.total,
            message: `Uploaded ${(e.loaded / (1024 * 1024)).toFixed(1)}MB / ${(e.total / (1024 * 1024)).toFixed(1)}MB (${percent}%)`
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            if (onProgress) onProgress({ status: 'complete', percent: 100, message: 'Upload successfully published!' });
            resolve({
              videoId: result.id,
              url: `https://youtube.com/shorts/${result.id}`,
              result
            });
          } catch (e) {
            resolve({ result: xhr.responseText });
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during YouTube video upload'));
      xhr.send(videoBlob);
    });
  }
}
