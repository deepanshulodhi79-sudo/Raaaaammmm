// ─── Tab switching ───────────────────────────────────────────────────────────
let currentTab = "single";

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;

    document.getElementById("singleFields").style.display =
      currentTab === "single" ? "block" : "none";
    document.getElementById("bulkFields").style.display =
      currentTab === "bulk" ? "block" : "none";

    document.getElementById("result").style.display = "none";
    document.getElementById("bulkResults").style.display = "none";
    document.getElementById("sendBtn").querySelector("#btnText").textContent =
      currentTab === "single" ? "Email Bhejo 🚀" : "Bulk Email Bhejo 🚀";
  });
});

// ─── Password toggle ──────────────────────────────────────────────────────────
function togglePassword() {
  const inp = document.getElementById("senderPassword");
  inp.type = inp.type === "password" ? "text" : "password";
}

// ─── Server health check ──────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById("statusBadge");
  try {
    const res = await fetch("/health");
    if (res.ok) {
      badge.className = "status-badge online";
      badge.innerHTML = '<span class="dot"></span> Server online ✅';
    } else {
      throw new Error("not ok");
    }
  } catch {
    badge.className = "status-badge offline";
    badge.innerHTML = '<span class="dot"></span> Server offline ❌';
  }
}
checkHealth();
setInterval(checkHealth, 30000);

// ─── Show result helper ───────────────────────────────────────────────────────
function showResult(msg, type = "success") {
  const el = document.getElementById("result");
  el.textContent = msg;
  el.className = `result ${type}`;
  el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── Show bulk results ────────────────────────────────────────────────────────
function showBulkResults(data) {
  const container = document.getElementById("bulkResults");
  const successCount = data.results.filter((r) => r.status === "success").length;

  let html = `<div class="bulk-header">📊 Result: ${successCount}/${data.results.length} emails bheje gaye</div>`;
  data.results.forEach((r) => {
    html += `
      <div class="bulk-item">
        <span class="email">${r.email}</span>
        ${
          r.status === "success"
            ? `<span class="ok">✅ Bheja</span>`
            : `<span class="fail">❌ ${r.error || "Failed"}</span>`
        }
      </div>`;
  });

  container.innerHTML = html;
  container.style.display = "block";
  container.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── Main send function ───────────────────────────────────────────────────────
async function sendEmail() {
  const btn = document.getElementById("sendBtn");
  const btnText = document.getElementById("btnText");
  const resultEl = document.getElementById("result");
  const bulkEl = document.getElementById("bulkResults");

  // Hide previous results
  resultEl.style.display = "none";
  bulkEl.style.display = "none";

  // Get common fields
  const senderEmail = document.getElementById("senderEmail").value.trim();
  const senderPassword = document.getElementById("senderPassword").value;
  const smtpHost = document.getElementById("smtpHost").value.trim();
  const smtpPort = document.getElementById("smtpPort").value.trim();
  const senderName = document.getElementById("senderName").value.trim();

  if (!senderEmail || !senderPassword) {
    showResult("❌ Apna email aur password zaroor daalo.", "error");
    return;
  }

  btn.disabled = true;
  btnText.textContent = "Bhej raha hai... ⏳";

  try {
    if (currentTab === "single") {
      // ── Single email ──
      const toEmail = document.getElementById("toEmail").value.trim();
      const subject = document.getElementById("subject").value.trim();
      const message = document.getElementById("message").value.trim();

      if (!toEmail || !subject || !message) {
        showResult("❌ To email, subject aur message bhar dalo.", "error");
        return;
      }

      const res = await fetch("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail, senderPassword, smtpHost, smtpPort, toEmail, subject, message, senderName }),
      });

      const data = await res.json();
      if (data.success) {
        showResult(`✅ ${data.message}\nMessage ID: ${data.messageId}`, "success");
      } else {
        showResult(`❌ Error: ${data.error}`, "error");
      }
    } else {
      // ── Bulk email ──
      const recipients = document.getElementById("recipients").value.trim();
      const subject = document.getElementById("bulkSubject").value.trim();
      const message = document.getElementById("bulkMessage").value.trim();

      if (!recipients || !subject || !message) {
        showResult("❌ Recipients, subject aur message bhar dalo.", "error");
        return;
      }

      const res = await fetch("/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail, senderPassword, smtpHost, smtpPort, recipients, subject, message, senderName }),
      });

      const data = await res.json();
      if (data.success) {
        showResult(`✅ ${data.message}`, "success");
        showBulkResults(data);
      } else {
        showResult(`❌ Error: ${data.error}`, "error");
      }
    }
  } catch (err) {
    showResult(`❌ Network error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btnText.textContent = currentTab === "single" ? "Email Bhejo 🚀" : "Bulk Email Bhejo 🚀";
  }
}

// ─── Enter key support ────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") sendEmail();
});
