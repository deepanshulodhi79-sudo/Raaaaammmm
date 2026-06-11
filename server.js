const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "launcher.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

function makeHtml(message) {
  const lines = message.split("\n").map(line => `<p style="margin:0 0 8px 0;">${line}</p>`).join("");
  return `
    <div style="font-family:'Georgia',serif;font-size:15px;line-height:1.8;color:#1a1a1a;max-width:600px;">
      ${lines}
    </div>
  `;
}

// Single email
app.post("/send", async (req, res) => {
  const { senderEmail, senderPassword, smtpHost, smtpPort, toEmail, subject, message, senderName } = req.body;

  if (!senderEmail || !senderPassword || !toEmail || !subject || !message) {
    return res.status(400).json({ success: false, error: "Zaroori fields khaali hain." });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: parseInt(smtpPort) || 587,
    secure: false,
    auth: { user: senderEmail, pass: senderPassword },
    tls: { rejectUnauthorized: false },
  });

  try {
    const info = await transporter.sendMail({
      from: senderName ? `"${senderName}" <${senderEmail}>` : `<${senderEmail}>`,
      to: toEmail,
      replyTo: senderEmail,
      subject,
      text: message,
      html: makeHtml(message),
    });
    res.json({ success: true, message: "Email bhej diya! ✅", messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    transporter.close();
  }
});

// Bulk email
app.post("/send-bulk", async (req, res) => {
  const { senderEmail, senderPassword, smtpHost, smtpPort, recipients, subject, message, senderName } = req.body;

  if (!senderEmail || !senderPassword || !recipients || !subject || !message) {
    return res.status(400).json({ success: false, error: "Zaroori fields khaali hain." });
  }

  const emailList = recipients.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);

  if (!emailList.length) {
    return res.status(400).json({ success: false, error: "Koi valid email nahi mila." });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: parseInt(smtpPort) || 587,
    secure: false,
    auth: { user: senderEmail, pass: senderPassword },
    tls: { rejectUnauthorized: false },
  });

  const from = senderName ? `"${senderName}" <${senderEmail}>` : `<${senderEmail}>`;
  const results = [];

  for (const email of emailList) {
    try {
      await transporter.sendMail({
        from,
        to: email,
        replyTo: senderEmail,
        subject,
        text: message,
        html: makeHtml(message),
      });
      results.push({ email, status: "success" });
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      results.push({ email, status: "failed", error: err.message });
    }
  }

  transporter.close();

  const successCount = results.filter((r) => r.status === "success").length;
  res.json({
    success: true,
    message: `${successCount}/${emailList.length} emails bheje gaye.`,
    results,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
