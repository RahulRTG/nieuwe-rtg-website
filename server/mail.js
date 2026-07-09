/* ============================================================================
   E-mailverzending.

   Twee standen:
   - Met SMTP_URL in de omgeving (bijv. smtp://user:pass@smtp.provider.nl:587)
     verstuurt nodemailer echte e-mail. MAIL_FROM bepaalt de afzender.
   - Zonder SMTP_URL worden berichten naar server/data/outbox geschreven en
     gelogd. De verificatie- en herstel-links zijn ook dan echt en werken.
   Zo is de hele mailstroom af voor livegang: alleen nog een SMTP-account
   koppelen via twee omgevingsvariabelen.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const OUTBOX = path.join(__dirname, 'data', 'outbox');
const SMTP_URL = process.env.SMTP_URL || '';
const FROM = process.env.MAIL_FROM || 'Rahul Travel Group <no-reply@rahultravelgroup.example>';

let transporter = null;
if (SMTP_URL) {
  try {
    transporter = require('nodemailer').createTransport(SMTP_URL);
    console.log('[mail] SMTP-transport actief.');
  } catch (e) {
    console.warn('[mail] SMTP_URL gezet maar nodemailer ontbreekt (npm install); e-mail gaat naar de outbox.');
  }
}
const CONFIGURED = !!transporter;

function toOutbox(to, subject, text) {
  fs.mkdirSync(OUTBOX, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(OUTBOX, stamp + '.txt'), `From: ${FROM}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
  console.log(`[mail] (outbox) naar ${to}: ${subject}`);
}

function send(to, subject, text) {
  if (!to || !/@/.test(String(to))) return;
  if (transporter) {
    transporter.sendMail({ from: FROM, to, subject, text })
      .then(() => console.log(`[mail] verzonden naar ${to}: ${subject}`))
      .catch(e => { console.warn('[mail] verzenden mislukt, naar outbox:', e.message); try { toOutbox(to, subject, text); } catch (e2) {} });
    return;
  }
  try { toOutbox(to, subject, text); } catch (e) { console.warn('[mail] mislukt:', e.message); }
}

module.exports = { send, configured: CONFIGURED };
