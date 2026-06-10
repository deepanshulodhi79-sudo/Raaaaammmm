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

function createTransporter(senderEmail, senderPassword, smtpHost, smtpPort) {
  return nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: parseInt(smtpPort) || 587,
    secure: parseInt(smtpPort) === 465,
    auth: { user: senderEmail, pass: senderPassword },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

// Single email
app.post("/send", async (req, res) => {
  const { senderEmail, senderPassword, smtpHost, smtpPort, toEmail, subject, message, senderName } = req.body;

  if (!senderEmail || !senderPassword || !toEmail || !subject || !message) {
    return res.status(400).json({ success: false, error: "Zaroori fields khaali hain." });
  }

  const transporter = createTransporter(senderEmail, senderPassword, smtpHost, smtpPort);

  try {
    const info = await transporter.sendMail({
      from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
      replyTo: senderEmail,
      to: toEmail,
      subject,
      text: message,
    });
    res.json({ success: true, message: "Email bhej diya gaya! ✅", messageId: info.messageId });
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

  const results = [];

  for (const email of emailList) {
    const transporter = createTransporter(senderEmail, senderPassword, smtpHost, smtpPort);
    try {
      await transporter.sendMail({
        from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
        replyTo: senderEmail,
        to: email,
        subject,
        text: message,
      });
      results.push({ email, status: "success" });
    } catch (err) {
      results.push({ email, status: "failed", error: err.message });
    } finally {
      transporter.close();
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;
  res.json({
    success: true,
    message: `${successCount}/${emailList.length} emails bheje gaye.`,
    results,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server chal raha hai port ${PORT} par`);
});
