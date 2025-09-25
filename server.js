// server.js
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// 🔑 ID del foglio Google (solo l’ID, NON l’URL intero)
const DEDICHE_SHEET_ID = "16Epeco74Y5Z1baEND6hoMYCeknSkH6s-HFOMHNblt0E";

// 📂 Carica il file delle credenziali JSON
let CREDENTIALS = null;
if (fs.existsSync(path.join(__dirname, 'credentials.json'))) {
  CREDENTIALS = require('./credentials.json');
} else {
  console.error('❌ File credentials.json mancante!');
  process.exit(1);
}

// 🔑 Funzione per collegarsi al foglio Google
async function getDoc(sheetId) {
  if (!CREDENTIALS) throw new Error('Credenziali Google mancanti');
  const doc = new GoogleSpreadsheet(sheetId);

  await doc.useServiceAccountAuth({
    client_email: CREDENTIALS.client_email,
    private_key: CREDENTIALS.private_key.replace(/\\n/g, '\n'),
  });

  await doc.loadInfo();
  return doc;
}

// 📞 Validazioni di base
function normalizePhone(phone) {
  return (phone || '').replace(/\s+/g, '').replace(/[\(\)\-\.]/g, '');
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
  return bannedWords.some(w => t.includes(w));
}

// 📩 Endpoint submit
app.post('/submit', async (req, res) => {
  try {
    const payload = req.body || {};
    const date = (payload.date || '').trim();
    const nomeDestinatario = (payload.nomeDestinatario || '').trim();
    const destinatario = normalizePhone((payload.destinatario || '').trim());
    const mittente = normalizePhone((payload.mittente || '').trim());
    const canzone = (payload.canzone || '').trim();
    const messaggio = (payload.messaggio || '').trim();

    if (!date) return res.status(400).json({ success: false, message: 'Data mancante.' });
    if (!nomeDestinatario) return res.status(400).json({ success: false, message: 'Nome destinatario mancante.' });
    if (!isValidItalianPhone(destinatario)) return res.status(400).json({ success: false, message: 'Numero destinatario non valido.' });
    if (!isValidItalianPhone(mittente)) return res.status(400).json({ success: false, message: 'Numero mittente non valido.' });
    if (!canzone) return res.status(400).json({ success: false, message: 'Canzone non fornita.' });
    if (!messaggio || messaggio.length > 2000) return res.status(400).json({ success: false, message: 'Messaggio vuoto o troppo lungo.' });
    if (containsBanned(messaggio)) return res.status(400).json({ success: false, message: 'Messaggio contiene termini non consentiti.' });

    const doc = await getDoc(DEDICHE_SHEET_ID);
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      DATA: date,
      'NOME DESTINATARIO': nomeDestinatario,
      'NUMERO DESTINATARIO': destinatario,
      'NUMERO MITTENTE': mittente,
      'CANZONE ITALIANA DA DEDICARE': canzone,
      MESSAGGIO: messaggio
    });

    return res.json({ success: true, message: 'Dedica registrata.' });
  } catch (err) {
    console.error('❌ Errore submit dettagliato:', err);
    return res.status(500).json({ success: false, message: 'Errore interno.' });
  }
});

// 🚀 Avvio server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server attivo su http://localhost:${PORT}`);
});
