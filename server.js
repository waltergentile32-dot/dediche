// server.js
const express = require("express");
const { google } = require("googleapis");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// 🔑 ID del foglio Google (solo l’ID)
const DEDICHE_SHEET_ID = "16Epeco74Y5Z1baEND6hoMYCeknSkH6s-HFOMHNblt0E";

// 📂 Legge le credenziali dall'env (Render)
if (!process.env.GOOGLE_CREDENTIALS) {
  console.error("❌ Variabile GOOGLE_CREDENTIALS mancante!");
  process.exit(1);
}
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// 🔑 Autenticazione Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// 📞 Funzioni utili
function normalizePhone(phone) {
  return (phone || "").replace(/\s+/g, "").replace(/[\(\)\-\.]/g, "");
}
function isValidItalianPhone(phone) {
  if (!phone) return false;
  const p = normalizePhone(phone);
  return /^\+39\d{9,10}$/.test(p) || /^3\d{8,9}$/.test(p) || /^0\d{8,10}$/.test(p);
}
const bannedWords = ["cazzo", "stronzo", "merda", "insulto1", "insulto2"];
function containsBanned(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return bannedWords.some((w) => t.includes(w));
}

// 📩 Endpoint submit
app.post("/submit", async (req, res) => {
  try {
    const payload = req.body || {};
    const date = (payload.date || "").trim();
    const nomeDestinatario = (payload.nomeDestinatario || "").trim();
    const destinatario = normalizePhone((payload.destinatario || "").trim());
    const mittente = normalizePhone((payload.mittente || "").trim());
    const canzone = (payload.canzone || "").trim();
    const messaggio = (payload.messaggio || "").trim();

    if (!date) return res.status(400).json({ success: false, message: "Data mancante." });
    if (!nomeDestinatario) return res.status(400).json({ success: false, message: "Nome destinatario mancante." });
    if (!isValidItalianPhone(destinatario)) return res.status(400).json({ success: false, message: "Numero destinatario non valido." });
    if (!isValidItalianPhone(mittente)) return res.status(400).json({ success: false, message: "Numero mittente non valido." });
    if (!canzone) return res.status(400).json({ success: false, message: "Canzone non fornita." });
    if (!messaggio || messaggio.length > 2000) return res.status(400).json({ success: false, message: "Messaggio vuoto o troppo lungo." });
    if (containsBanned(messaggio)) return res.status(400).json({ success: false, message: "Messaggio contiene termini non consentiti." });

    // ✍️ Scrive la riga sul foglio Google
    await sheets.spreadsheets.values.append({
      spreadsheetId: DEDICHE_SHEET_ID,
      range: "Foglio1!A:F", // prima riga libera
      valueInputOption: "RAW",
      requestBody: {
        values: [[date, nomeDestinatario, destinatario, mittente, canzone, messaggio]],
      },
    });

    return res.json({ success: true, message: "Dedica registrata." });
  } catch (err) {
    console.error("❌ Errore submit dettagliato:", err);
    return res.status(500).json({ success: false, message: "Errore interno." });
  }
});

// 🚀 Avvio server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server attivo su http://localhost:${PORT}`);
});
