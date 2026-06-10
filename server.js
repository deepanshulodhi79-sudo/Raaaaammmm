const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "launcher.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Mail Sender Server is running!" });
});

// Transporter banao — ek baar, reuse karo
function createTransporter(senderEmail, senderPassword, smtpHost, smtpPort) {
  return nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: parseInt(smtpPort) || 587,
    secure: parseInt(smtpPort) === 465,
    auth: { user: senderEmail, pass: senderPassword },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,   // 10 sec mein connect nahi hua toh error
    greetingTimeout: 10000,
    socketTimeout: 15000,
    pool: true,                  // connection pool — fast reuse
    maxConnections: 5,
  });
}

// Single email
app.post("/send", async (req, res) => {
  const { senderEmail, senderPassword, smtpHost, smtpPort, toEmail, subject, message, senderName } = req.body;

  if (!senderEmail || !senderPassword || !toEmail || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: "Zaroori fields khaali hain: senderEmail, senderPassword, toEmail, subject, message",
    });
  }

  try {
    const transporter = createTransporter(senderEmail, senderPassword, smtpHost, smtpPort);

    const info = await transporter.sendMail({
      from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
      to: toEmail,
      subject,
      text: message,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${message.replace(/\n/g, "<br>")}</div>`,
    });

    transporter.close();

    res.json({
      success: true,
      message: "Email successfully bhej diya gaya! ✅",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Email error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Email bhejne mein kuch problem aayi.",
    });
  }
});

// Bulk email
app.post("/send-bulk", async (req, res) => {
  const { senderEmail, senderPassword, smtpHost, smtpPort, recipients, subject, message, senderName } = req.body;

  if (!senderEmail || !senderPassword || !recipients || !subject || !message) {
    return res.status(400).json({ success: false, error: "Zaroori fields khaali hain." });
  }

  const emailList = recipients.split(/[\n,;]+/).map((e) => e.trim()).filter((e) => e);

  if (emailList.length === 0) {
    return res.status(400).json({ success: false, error: "Koi valid email address nahi mila." });
  }

  // Ek hi transporter sab ke liye — fast
  const transporter = createTransporter(senderEmail, senderPassword, smtpHost, smtpPort);
  const from = senderName ? `"${senderName}" <${senderEmail}>` : senderEmail;

  const results = [];

  // Parallel bhejo — 3 ek saath (Gmail limit ke andar)
  const BATCH = 3;
  for (let i = 0; i < emailList.length; i += BATCH) {
    const batch = emailList.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map((email) =>
        transporter.sendMail({
          from,
          to: email,
          subject,
          text: message,
          html: `<div style="font-family: Arial, sans-serif;">${message.replace(/\n/g, "<br>")}</div>`,
        })
      )
    );
    batchResults.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        results.push({ email: batch[idx], status: "success" });
      } else {
        results.push({ email: batch[idx], status: "failed", error: result.reason?.message });
      }
    });
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
  console.log(`✅ Mail Sender Server chal raha hai port ${PORT} par`);
});
