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

app.use(cors());
const PORT = 5000;

app.set('view engine', 'ejs');

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'SECRET' 
}));

app.get('/', function(req, res) {
  res.render('pages/auth');
});

var userProfile;

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');

app.get('/success', (req, res) => res.send(userProfile));
app.get('/error', (req, res) => res.send("error logging in"));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

const CLIENT_ID = '303758285182-9jn5hltm4ksm61m6s0is5071m5gh46j1.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URL = 'http://localhost:5000/auth/google/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: REDIRECT_URL
  },
  function(accessToken, refreshToken, profile, done) {
      userProfile = profile;
      oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
      return done(null, userProfile);
  }
));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.force-ssl'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/error' }), function(req, res) {
    res.redirect('http://localhost:3000');
});

// Multer setup for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage });

// Endpoint to upload video
app.post('/upload', upload.single('video'), (req, res) => {
    const tokens = JSON.parse(req.body.tokens);
    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const videoPath = path.join(__dirname, 'uploads', req.file.filename);

    youtube.videos.insert(
        {
            resource: {
                snippet: {
                    title: req.body.title,
                    description: req.body.description,
                },
                status: {
                    privacyStatus: 'private',
                },
            },
            part: 'snippet,status',
            media: {
                body: fs.createReadStream(videoPath),
            },
        },
        (err, response) => {
            if (err) return res.status(500).send('Error uploading video');
            fs.unlinkSync(videoPath); // Remove the file after upload
            res.send('Video uploaded successfully');
        }
    );
});

// Live stream endpoints
app.post('/start-broadcast', async (req, res) => {
  try {
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    const startTime = new Date(Date.now() + 60000).toISOString(); // Start in 1 minute
    const { data } = await youtube.liveBroadcasts.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: 'My Live Stream',
          scheduledStartTime: startTime
        },
        status: {
          privacyStatus: 'public'
        }
      }
    });

    const broadcastId = data.id;
    const streamName = data.contentDetails.boundStreamId;
    res.json({ broadcastId, streamName });
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
