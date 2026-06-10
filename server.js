// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const net = require('net');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

const HARD_USERNAME = "!@#$%^&*())(*&^%$#@!@#$%^&*";
const HARD_PASSWORD = "!@#$%^&*())(*&^%$#@!@#$%^&*";

let mailLimits = {};
let launcherLocked = false;
const sessionStore = new session.MemoryStore();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'bulk-mailer-secret',
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

function fullServerReset() {
  console.log("🔁 FULL LAUNCHER RESET");
  launcherLocked = true;
  mailLimits = {};
  sessionStore.clear(() => console.log("🧹 All sessions cleared"));
  setTimeout(() => {
    launcherLocked = false;
    console.log("✅ Launcher unlocked for fresh login");
  }, 2000);
}

function requireAuth(req, res, next) {
  if (launcherLocked) return res.redirect('/');
  if (req.session.user) return next();
  return res.redirect('/');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (launcherLocked) {
    return res.json({ success: false, message: "⛔ Launcher reset ho raha hai, thodi der baad login karo" });
  }
  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    setTimeout(fullServerReset, 60 * 60 * 1000);
    return res.json({ success: true });
  }
  return res.json({ success: false, message: "❌ Invalid credentials" });
});

app.get('/launcher', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: "✅ Logged out successfully" });
  });
});

// ✅ SMTP Test Route
app.get('/test-smtp', async (req, res) => {
  const test = (port) => new Promise((resolve) => {
    const socket = net.createConnection(port, 'smtp.gmail.com');
    socket.setTimeout(5000);
    socket.on('connect', () => { socket.destroy(); resolve(`Port ${port}: OPEN ✅`); });
    socket.on('error', (e) => resolve(`Port ${port}: BLOCKED ❌ - ${e.message}`));
    socket.on('timeout', () => { socket.destroy(); resolve(`Port ${port}: TIMEOUT ⏱️`); });
  });

  const [r1, r2] = await Promise.all([test(587), test(465)]);
  res.json({ results: [r1, r2] });
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendBatch(transporter, mails, batchSize = 5) {
  const results = [];
  for (let i = 0; i < mails.length; i += batchSize) {
    const batch = await Promise.allSettled(
      mails.slice(i, i + batchSize).map(m => transporter.sendMail(m))
    );
    results.push(...batch);
    await delay(300);
  }
  return results;
}

app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients) {
      return res.json({ success: false, message: "Email, password and recipients required" });
    }

    const now = Date.now();

    if (!mailLimits[email] || now - mailLimits[email].startTime > 60 * 60 * 1000) {
      mailLimits[email] = { count: 0, startTime: now };
    }

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    if (mailLimits[email].count + recipientList.length > 27) {
      return res.json({
        success: false,
        message: `❌ Max 27 mails/hour | Remaining: ${27 - mailLimits[email].count}`
      });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false }
    });

    await transporter.verify();
    console.log(`✅ SMTP verified for ${email}`);

    const mails = recipientList.map(r => ({
      from: `"${senderName || 'Anonymous'}" <${email}>`,
      to: r,
      subject: subject || "Quick Note",
      text: (message || "")
    }));

    const results = await sendBatch(transporter, mails, 5);

    const failed = results.filter(r => r.status === 'rejected');
    const succeeded = results.filter(r => r.status === 'fulfilled');

    if (failed.length > 0) {
      console.error("❌ Failed mails:", failed.map(f => f.reason?.message));
    }

    mailLimits[email].count += succeeded.length;

    return res.json({
      success: succeeded.length > 0,
      message: `✅ Sent ${succeeded.length} | Failed ${failed.length} | Used ${mailLimits[email].count}/27`,
      errors: failed.map(f => f.reason?.message)
    });

  } catch (err) {
    console.error("❌ Mail error:", err.message);
    return res.json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Mail Launcher running on port ${PORT}`);
});
