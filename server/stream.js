const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const inputFilePath = 'video.mp4';
const twitchStreamUrl = 'rtmp://live.twitch.tv/app/YOUR_TWITCH_STREAM_KEY'; // Replace YOUR_TWITCH_STREAM_KEY if needed
const youtubeStreamUrls = [
  'rtmp://a.rtmp.youtube.com/live2/3jet-83m1-b5gr-07us-d9fk',
  'rtmp://b.rtmp.youtube.com/live2/3jet-83m1-b5gr-07us-d9fk',
  'rtmp://c.rtmp.youtube.com/live2/3jet-83m1-b5gr-07us-d9fk'
];

function streamToService(inputFile, streamUrl) {
  const args = [
    '-loglevel', 'debug', // Increase logging verbosity
    '-protocol_whitelist', 'file,udp,rtp,rtmp,tcp', // Allow necessary protocols
    '-re', // Read input at native frame rate
    '-i', inputFile, // Input file
    '-c:v', 'libx264', // Video codec
    '-c:a', 'aac', // Audio codec
    '-f', 'flv', // Output format
    streamUrl // Output URL
  ];

  const ffmpegProcess = spawn(ffmpegPath, args);

  ffmpegProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  ffmpegProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
  });

  ffmpegProcess.on('error', (err) => {
    console.error(`Failed to start subprocess: ${err}`);
  });
}

// Stream to Twitch
streamToService(inputFilePath, twitchStreamUrl);

// Try streaming to YouTube on different RTMP servers
youtubeStreamUrls.forEach(url => {
  streamToService(inputFilePath, url);
});
