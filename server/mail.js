/* ============================================================================
   E-mailverzending.

   Twee standen:
   - Met SMTP_URL in de omgeving (bijv. smtp://user:pass@smtp.provider.nl:587)
     verstuurt de eigen SMTP-client (server/smtp.js) echte e-mail. MAIL_FROM
     bepaalt de afzender.
   - Zonder SMTP_URL worden berichten naar server/data/outbox geschreven en
     gelogd. De verificatie- en herstel-links zijn ook dan echt en werken.
   Zo is de hele mailstroom af voor livegang: alleen nog een SMTP-account
   koppelen via twee omgevingsvariabelen.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const OUTBOX = path.join(process.env.RTG_DATA_DIR || path.join(__dirname, 'data'), 'outbox');
const SMTP_URL = process.env.SMTP_URL || '';
const FROM = process.env.MAIL_FROM || 'Rahul Travel Group <no-reply@rahultravelgroup.example>';

let transporter = null;
if (SMTP_URL) {
  try {
    transporter = require('./smtp').createTransport(SMTP_URL);
    console.log('[mail] SMTP-transport actief.');
  } catch (e) {
    console.warn('[mail] SMTP_URL gezet maar ongeldig (' + (e && e.message) + '); e-mail gaat naar de outbox.');
  }
}
const CONFIGURED = !!transporter;

/* De outbox is niet alleen de ontwikkelstand: hij vangt ook mail op als een
   ECHTE verzending mislukt (zie send() hieronder). Dan liggen er dus op de
   productiemachine bestanden met het e-mailadres van een lid en een werkende
   bevestigings- of herstel-link erin. Daarom gaat de outbox door dezelfde kluis
   als de rest: staat RTG_ENC_KEY, dan versleuteld (.eml.enc), anders leesbaar
   (.txt) zodat lokaal ontwikkelen niet omslachtig wordt. Terugkijken kan met
   `npm run outbox`. */
function toOutbox(to, subject, text) {
  fs.mkdirSync(OUTBOX, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(OUTBOX, 0o700); } catch (e) {}
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bericht = `From: ${FROM}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`;
  const kluis = require('./kluis');
  const naam = stamp + (kluis.AAN ? '.eml.enc' : '.txt');
  fs.writeFileSync(path.join(OUTBOX, naam), kluis.versleutel(bericht), { mode: 0o600 });
  // het adres zelf hoort niet in het logboek als de inhoud wel beschermd is
  console.log(`[mail] (outbox) ${kluis.AAN ? 'versleuteld opgeslagen' : 'naar ' + to}: ${subject}`);
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
