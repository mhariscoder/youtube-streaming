const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

app.use(cors());
const PORT = 5000;

app.set('view engine', 'ejs');

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'SECRET'
}));

app.get('/', function (req, res) {
  res.render('pages/auth');
});

var userProfile;

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');

app.get('/success', (req, res) => res.send(userProfile));
app.get('/error', (req, res) => res.send("error logging in"));

passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});

const CLIENT_ID = '303758285182-9jn5hltm4ksm61m6s0is5071m5gh46j1.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URL = 'http://localhost:5000/auth/google/callback';

// const CLIENT_ID = '418999650850-9i9gl4rhgqopqpfhsq2kpo6of35360hu.apps.googleusercontent.com';
// const CLIENT_SECRET = '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';
// const REDIRECT_URL = 'http://localhost:5000/auth/google/callback';
const API_KEY = 'AIzaSyC3_B2SfuEBqMOwvtiDDHB0cy3tPzxXphA';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

passport.use(new GoogleStrategy({
  clientID: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  callbackURL: REDIRECT_URL
},
  function (accessToken, refreshToken, profile, done) {
    userProfile = profile;
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return done(null, userProfile);
  }
));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.force-ssl'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/error' }), function (req, res) {
  res.redirect('http://localhost:3000');
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    fs.access(uploadDir, (err) => {
      if (err) {
        fs.mkdir(uploadDir, (err) => {
          if (err) {
            console.error('Error creating upload directory:', err);
            cb(err, null);
          } else {
            cb(null, uploadDir);
          }
        });
      } else {
        cb(null, uploadDir);
      }
    });
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});


const upload = multer({ storage });
// const streamURL = 'rtmps://a.rtmps.youtube.com/live2/3jet-83m1-b5gr-07us-d9fk'

app.post('/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).send('No file uploaded');
    }

    console.log('Uploaded file:', req.file);

    const tokens = JSON.parse(req.body.tokens);
    console.log('Tokens:', tokens);
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const videoPath = path.join(__dirname, 'uploads', req.file.filename);
    console.log('Video path:', videoPath);

    const streamURL = 'rtmps://a.rtmps.youtube.com/live2/YOUR_STREAM_KEY';
    console.log('Stream URL:', streamURL);

    ffmpeg(videoPath)
      .setFfmpegPath(ffmpegPath)
      .outputOptions([
        '-f flv',
        '-c:v libx264',
        '-c:a aac',
        '-ar 44100',
        '-b:a 128k',
        '-b:v 4000k',
        '-maxrate 4000k',
        '-bufsize 8000k',
      ])
      .output(streamURL)
      .on('start', () => {
        console.log('FFmpeg streaming started.');
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        res.status(500).send('FFmpeg error: ' + err.message);
      })
      .on('end', () => {
        console.log('FFmpeg streaming ended.');
        res.send('Streaming ended.');
      })
      .run();
  } catch (error) {
    console.error('Error during upload processing:', error);
    res.status(500).send('Error during upload processing: ' + error.message);
  }
});
// Live stream endpoints
app.post('/start-broadcast', async (req, res) => {
  try {
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    const startTime = new Date(Date.now()).toISOString();


    const liveBroadcastInsertResponse = await youtube.liveBroadcasts.insert({
      part: ['id,snippet,contentDetails,status'],
      requestBody: {
        snippet: {
          title: `New Video: ${new Date().toISOString()}`,
          scheduledStartTime: startTime,
          description: 'A description of your video stream. This field is optional.',
        },
        contentDetails: {
          recordFromStart: true,
          // startWithSlate: true,
          enableAutoStart: false,
          monitorStream: {
            enableMonitorStream: false,
          },
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: true,
          lifeCycleStatus: "live",
        },
      }
    });

    const broadcastId = liveBroadcastInsertResponse?.data?.id;
    // console.log('liveBroadcastInsertResponse', liveBroadcastInsertResponse)
    console.log('broadcastId', broadcastId);


    const liveStreamsInsertResponse = await youtube.liveStreams.insert({
      part: 'id,snippet,cdn,contentDetails,status',
      requestBody: {
        snippet: {
          title: "Your new video stream's name",
          description:
            'A description of your video stream. This field is optional.',
        },
        cdn: {
          frameRate: '30fps',
          ingestionType: 'rtmp',
          resolution: '720p',
          format: '',
        },
        contentDetails: {
          isReusable: true,
        },
        status: {
          streamStatus: "active"
        },
      }
    });

    const streamId = liveStreamsInsertResponse?.data?.id;
    console.log('streamId', streamId)

    const liveBroadcastsBindResponse = await youtube.liveBroadcasts.bind({
      part: 'id,snippet,contentDetails,status',
      id: broadcastId,
      streamId: streamId
    });
    // console.log('liveBroadcastsBindResponse', liveBroadcastsBindResponse)

    // setTimeout(() => {
    //   const liveBroadcastsTransitionResponse = youtube.liveBroadcasts.transition({
    //     part: 'snippet,status',
    //     broadcastStatus: 'live',
    //     id: broadcastId,
    //   });

    //   console.log('liveBroadcastsTransitionResponse', liveBroadcastsTransitionResponse)
    // }, 10000);

    res.json({ broadcastId });
  } catch (error) {
    console.error(error)
    res.status(500).send('Error starting broadcast');
  }
});

const mediaStreams = {};

app.post('/upload-video', upload.single('video'), (req, res) => {
  const { broadcastId } = req.query;
  const videoChunk = req.file.buffer;
  if (!mediaStreams[broadcastId]) {
    mediaStreams[broadcastId] = [];
  }
  mediaStreams[broadcastId].push(videoChunk);
  res.send('Video chunk received successfully!');
});

app.get('/stream-video/:broadcastId', (req, res) => {
  const { broadcastId } = req.params;
  const stream = mediaStreams[broadcastId];
  if (!stream) {
    res.status(404).send('Broadcast not found');
    return;
  }

  res.setHeader('Content-Type', 'video/mp4');
  stream.forEach(chunk => res.write(chunk));
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});