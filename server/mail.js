/* ============================================================================
   E-mailverzending.

   Er is (nog) geen echte e-maildienst gekoppeld, dus berichten worden naar een
   "outbox" op schijf geschreven en gelogd. De verificatie- en herstel-links zijn
   echt en werken. Voor productie: vervang `deliver()` door een echte transport
   (SMTP via nodemailer, of een API zoals Resend/Postmark) en zet CONFIGURED aan.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const OUTBOX = path.join(__dirname, 'data', 'outbox');
const CONFIGURED = !!process.env.SMTP_URL; // in productie: echte transport aanwezig

function deliver(to, subject, text) {
  fs.mkdirSync(OUTBOX, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(OUTBOX, stamp + '.txt'), `To: ${to}\nSubject: ${subject}\n\n${text}\n`);
  console.log(`[mail] naar ${to}: ${subject}`);
}

function send(to, subject, text) {
  try { deliver(to, subject, text); } catch (e) { console.warn('[mail] mislukt:', e.message); }
}

module.exports = { send, configured: CONFIGURED };
