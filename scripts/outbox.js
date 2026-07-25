/* De outbox teruglezen.

   Zonder SMTP_URL, en als een echte verzending mislukt, legt server/mail.js het
   bericht in server/data/outbox. Met RTG_ENC_KEY staat dat versleuteld op schijf
   (.eml.enc), want er staat een e-mailadres en een werkende bevestigings- of
   herstel-link in. Dit scriptje maakt ze weer leesbaar, met dezelfde sleutel als
   de server.

   Gebruik:
     npm run outbox              de laatste 10 berichten
     npm run outbox -- 3         de laatste 3
     npm run outbox -- alles     allemaal

   Draait alleen met de juiste RTG_ENC_KEY in de omgeving; zonder sleutel zegt
   hij dat, in plaats van onleesbare tekst te tonen. */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'server', 'data');
const OUTBOX = path.join(DATA_DIR, 'outbox');
const kluis = require('../server/kluis');

const arg = String(process.argv[2] || '10').toLowerCase();
const hoeveel = arg === 'alles' || arg === 'all' ? Infinity : (Number(arg) || 10);

let namen;
try { namen = fs.readdirSync(OUTBOX); }
catch (e) { console.log('Geen outbox in ' + OUTBOX + ' (er is nog niets opgeslagen).'); process.exit(0); }

const berichten = namen.filter(n => n.endsWith('.txt') || n.endsWith('.eml.enc')).sort().reverse();
if (!berichten.length) { console.log('De outbox is leeg.'); process.exit(0); }

console.log(berichten.length + ' bericht(en) in ' + OUTBOX +
  (hoeveel < berichten.length ? ', hieronder de laatste ' + hoeveel : '') + '\n');

let mislukt = 0;
for (const naam of berichten.slice(0, hoeveel)) {
  const ruw = fs.readFileSync(path.join(OUTBOX, naam), 'utf8');
  let tekst;
  try { tekst = kluis.ontsleutel(ruw); }
  catch (e) { mislukt++; tekst = '  (niet te ontsleutelen: ' + e.message + ')'; }
  console.log('=== ' + naam + ' ' + '='.repeat(Math.max(0, 60 - naam.length)));
  console.log(tekst.trimEnd());
  console.log('');
}
if (mislukt) {
  console.log(mislukt + ' bericht(en) konden niet gelezen worden. Draait dit script met dezelfde');
  console.log('RTG_ENC_KEY als de server? Zonder die sleutel is de inhoud niet terug te halen.');
  process.exit(1);
}
