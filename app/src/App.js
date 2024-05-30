import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [broadcastId, setBroadcastId] = useState('');
  const [mediaStream, setMediaStream] = useState(null);

  useEffect(() => {
    const getMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMediaStream(stream);
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    getMediaStream();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleStartBroadcast = async () => {
    try {
      const response = await axios.post('http://localhost:5000/start-broadcast');
      setBroadcastId(response.data.broadcastId);
      const mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          const formData = new FormData();
          formData.append('video', event.data);
          // Use the current broadcastId here instead of the state value
          axios.post(`http://localhost:5000/upload-video?broadcastId=${response.data.broadcastId}`, formData);
        }
      };
      mediaRecorder.start(1000); // Record a chunk every 1 second
    } catch (error) {
      console.error('Error starting broadcast:', error);
    }
  };

  const handleGoogleAuth = async () => {
    try {
        // Redirect user to backend for Google OAuth2 authentication
        window.location.href = 'http://localhost:5000/auth/google';
    } catch (error) {
        console.error('Error with Google authentication:', error);
    }
  };

  useEffect(() => {
    // Check if redirected from backend after successful authentication
    if (window.location.href.includes('http://localhost:5000/auth/google/callback')) {
        // Perform any necessary actions after authentication (e.g., fetch user data)
        // For example, you can fetch user data from the backend here
        console.log('Authenticated successfully!');
    }
  }, []);

  return (
    <div>
      <h1>YouTube Live Streaming</h1>
      <button onClick={handleGoogleAuth}>Authenticate with Google</button>
      <button onClick={handleStartBroadcast}>Start Broadcast</button>
      {broadcastId && (
        <div>
          <h2>Live Stream</h2>
          <video
            width="560"
            height="315"
            autoPlay
            controls
            ref={videoRef => {
              if (videoRef && mediaStream) {
                videoRef.srcObject = mediaStream;
              }
            }}
          ></video>
        </div>
      )}
    </div>
  );
}

export default App;
