import React, { useRef, useEffect, useState } from 'react';
import RecordRTC, { invokeSaveAsDialog } from 'recordrtc';

function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const ws = useRef(null); // WebSocket reference
  const [accessToken, setAccessToken] = useState('');
  const [liveBroadcastId, setLiveBroadcastId] = useState(null);

  useEffect(() => {
    // Access token ko URL se extract karna
    const getAccessTokenFromURL = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      setAccessToken(params.get('access_token'));
    };
    getAccessTokenFromURL();
  }, []);

  useEffect(() => {
    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } catch (err) {
        console.error('Error accessing media devices.', err);
      }
    }

    startStream();
  }, []);

  // const startRecording = () => {
  //   if (!streamRef.current) return;

  //   recorderRef.current = new RecordRTC(streamRef.current, {
  //     type: 'video',
  //     mimeType: 'video/webm;codecs=vp8',
  //     bitsPerSecond: 128000,
  //   });

  //   recorderRef.current.startRecording();
  // };

  // const stopRecording = async () => {
  //   if (!recorderRef.current) return;
  
  //   try {
  //     await recorderRef.current.stopRecording(() => {
  //       const blob = recorderRef.current.getBlob();
  
  //       if (blob instanceof Blob) {
  //         // Send the recorded video blob to the backend server
  //         const formData = new FormData();
  //         formData.append('video', blob, 'stream.webm');
  
  //         fetch('http://localhost:4000/upload', {
  //           method: 'POST',
  //           body: formData,
  //         })
  //           .then((response) => response.json())
  //           .then((data) => console.log(data))
  //           .catch((error) => console.error(error));
  
  //         invokeSaveAsDialog(blob); // Optional: Save the video locally
  //       } else {
  //         console.error('Recorded data is not a Blob:', blob);
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Error stopping recording:', error);
  //   }
  // };
  
  

  const startLiveBroadcast = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    videoRef.current.srcObject = stream;
    videoRef.current.play();

    const requestBody = {
      snippet: {
        title: `New Video: ${now.toISOString()}`,
        scheduledStartTime: now.toISOString(),
        description: 'A description of your video stream. This field is optional.',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: true,
      },
    };

    try {
      const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts?access_token=${accessToken}&part=id,snippet,status`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        setLiveBroadcastId(data.id);
        createLiveStream(data.id); // Live stream create karne ke liye function call
        console.log('Live broadcast created:', data);
        alert('Live broadcast successfully created!');
      } else {
        console.error('Failed to create live broadcast:', response.status);
        alert('Live broadcast create nahi hui. Dobara try karein.');
      }
    } catch (error) {
      console.error('Error creating live broadcast:', error);
      alert('Live broadcast create karne mein error hua.');
    }
  };

  const createLiveStream = async (broadcastId) => {
    const liveStreamRequestBody = {
      snippet: {
        title: "Your new video stream's name",
        description: 'A description of your video stream. This field is optional.',
      },
      cdn: {
        frameRate: 'variable',
        ingestionType: 'rtmp',
        resolution: 'variable',
      },
      status: { streamStatus: 'active' },
    };

    try {
      const liveStreamUrl = `https://www.googleapis.com/youtube/v3/liveStreams?access_token=${accessToken}&part=id,snippet,cdn,status`;
      const liveStreamResponse = await fetch(liveStreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(liveStreamRequestBody),
      });

      if (liveStreamResponse.ok) {
        const liveStreamData = await liveStreamResponse.json();
        bindBroadcastToStream(broadcastId, liveStreamData.id, liveStreamData.cdn.ingestionInfo);
        console.log('Live stream created:', liveStreamData);
      } else {
        console.error('Failed to create live stream:', liveStreamResponse.status);
      }
    } catch (error) {
      console.error('Error creating live stream:', error);
    }
  };

  const bindBroadcastToStream = async (broadcastId, streamId, ingestionInfo) => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&part=id,snippet,contentDetails,status&streamId=${streamId}&access_token=${accessToken}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {

        startWebcamStream(ingestionInfo);
        // console.log('Broadcast successfully bound to stream');
        // console.log('ingestionInfo', ingestionInfo);

        // // Initialize WebSocket connection
        // ws.current = new WebSocket('ws://localhost:5000'); // Adjust WebSocket URL as needed
        // ws.current.onopen = function () {
        //   console.log('WebSocket connected');
        //   ws.current.send(JSON.stringify(ingestionInfo)); // Send ingestion info to server
        // };

        // // 10 seconds delay ke baad broadcast ko live transition karna
        // setTimeout(() => transitionToLive(broadcastId), 10000);
      } else {
        console.error('Failed to bind broadcast to stream:', response.status);
      }
    } catch (error) {
      console.error('Error binding broadcast to stream:', error);
    }
  };

  const transitionToLive = async (broadcastId) => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=live&id=${broadcastId}&part=id,status&access_token=${accessToken}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        console.log('Broadcast successfully transitioned to live');
      } else {
        console.error('Failed to transition broadcast to live:', response.status);
      }
    } catch (error) {
      console.error('Error transitioning broadcast to live:', error);
    }
  };
  const startWebcamStream = async (ingestionInfo) => {
    const rtmpUrl = `${ingestionInfo.ingestionAddress}/${ingestionInfo.streamName}`;
    const response = await fetch('http://localhost:5000/start-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtmpUrl }),
    });

    if (response.ok) {
        console.log('Streaming to YouTube started');
    } else {
        console.error('Failed to start streaming:', response.status);
    }
};
  const oauthSignIn = () => {
    const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = {
      client_id: '418999650850-9i9gl4rhgqopqpfhsq2kpo6of35360hu.apps.googleusercontent.com',
      redirect_uri: 'http://localhost:3000',
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
      include_granted_scopes: 'true',
      state: 'pass-through value',
    };
    const queryString = Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&');
    window.location.href = oauth2Endpoint + '?' + queryString;
  };

  return (
    <div>
      <h2>Create Live Broadcast</h2>
      <video ref={videoRef} width="600" height="400" autoPlay muted></video>
      <button onClick={startRecording}>Start Recording</button>
      <button onClick={stopRecording}>Stop Recording</button>
      <button onClick={startLiveBroadcast}>Start Live Broadcast</button>
      <button onClick={oauthSignIn}>Sign In with Google</button>
    </div>
  );
}

export default App;