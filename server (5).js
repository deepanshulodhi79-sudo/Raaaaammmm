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

// Send email route
app.post("/send", async (req, res) => {
  const { senderEmail, senderPassword, smtpHost, smtpPort, toEmail, subject, message, senderName } = req.body;

  // Validation
  if (!senderEmail || !senderPassword || !toEmail || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: "Zaroori fields khaali hain: senderEmail, senderPassword, toEmail, subject, message",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost || "smtp.gmail.com",
      port: parseInt(smtpPort) || 587,
      secure: parseInt(smtpPort) === 465,
      auth: {
        user: senderEmail,
        pass: senderPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
      to: toEmail,
      subject: subject,
      text: message,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${message.replace(/\n/g, "<br>")}</div>`,
    };

    const info = await transporter.sendMail(mailOptions);

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

// Bulk send route
app.post("/send-bulk", async (req, res) => {
  const { senderEmail, senderPassword, smtpHost, smtpPort, recipients, subject, message, senderName } = req.body;

  if (!senderEmail || !senderPassword || !recipients || !subject || !message) {
    return res.status(400).json({ success: false, error: "Zaroori fields khaali hain." });
  }

  const emailList = recipients.split(/[\n,;]+/).map((e) => e.trim()).filter((e) => e);

  if (emailList.length === 0) {
    return res.status(400).json({ success: false, error: "Koi valid email address nahi mila." });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: parseInt(smtpPort) || 587,
    secure: parseInt(smtpPort) === 465,
    auth: { user: senderEmail, pass: senderPassword },
    tls: { rejectUnauthorized: false },
  });

  const results = [];
  for (const email of emailList) {
    try {
      await transporter.sendMail({
        from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
        to: email,
        subject,
        text: message,
        html: `<div style="font-family: Arial, sans-serif;">${message.replace(/\n/g, "<br>")}</div>`,
      });
      results.push({ email, status: "success" });
    } catch (err) {
      results.push({ email, status: "failed", error: err.message });
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
  console.log(`✅ Mail Sender Server chal raha hai port ${PORT} par`);
});
