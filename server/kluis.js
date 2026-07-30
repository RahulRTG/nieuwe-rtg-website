/* Versleuteling-at-rest. Met RTG_ENC_KEY in de omgeving worden de opgeslagen
   data (chats, sessies, snaps, de hele db, en de KYC-documenten) versleuteld
   weggeschreven met AES-256-GCM (authenticated: geknoei valt op). Zonder sleutel
   verandert er niets: alles blijft leesbaar zoals altijd.

   Elke versleutelde waarde begint met een magische markering. Zo laadt bestaande
   plaintext-data ook na het aanzetten van de sleutel gewoon door (geleidelijke
   migratie: nieuwe schrijfacties zijn versleuteld). Staat er versleutelde data en
   ontbreekt de sleutel, dan stopt het ontsleutelen met een duidelijke fout in
   plaats van stil door te draaien.

   Zet de sleutel als 64 hex-tekens (32 bytes) of een lange wachtzin (wordt dan
   met sha-256 tot 32 bytes gemaakt). Bewaar hem BUITEN de datamap. */
const crypto = require('crypto');

const RUW = process.env.RTG_ENC_KEY || '';
let KEY = null;
if (RUW) KEY = /^[0-9a-fA-F]{64}$/.test(RUW) ? Buffer.from(RUW, 'hex') : crypto.createHash('sha256').update(RUW).digest();
const AAN = !!KEY;
const MAGIC = Buffer.from('RTGENC1');
const MAGIC_TXT = 'RTGENC1:';

// tekst -> "RTGENC1:<base64(iv|tag|ciphertext)>", of ongewijzigd zonder sleutel
function versleutel(tekst) {
  if (!KEY) return tekst;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(String(tekst), 'utf8'), c.final()]);
  return MAGIC_TXT + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function ontsleutel(waarde) {
  if (typeof waarde !== 'string' || !waarde.startsWith(MAGIC_TXT)) return waarde; // plaintext of niet-versleuteld
  if (!KEY) throw new Error('Data is versleuteld maar RTG_ENC_KEY ontbreekt.');
  const buf = Buffer.from(waarde.slice(MAGIC_TXT.length), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

// binaire varianten voor bestanden (KYC-documenten): magic|iv|tag|ciphertext
function versleutelBuf(buf) {
  if (!KEY) return buf;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), enc]);
}
function ontsleutelBuf(buf) {
  if (!buf || buf.length < MAGIC.length || !buf.subarray(0, MAGIC.length).equals(MAGIC)) return buf; // niet versleuteld
  if (!KEY) throw new Error('Bestand is versleuteld maar RTG_ENC_KEY ontbreekt.');
  const p = MAGIC.length;
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(p, p + 12));
  d.setAuthTag(buf.subarray(p + 12, p + 28));
  return Buffer.concat([d.update(buf.subarray(p + 28)), d.final()]);
}

/* ---------- bestanden gebonden aan hun naam ----------

   versleutelBuf hierboven beschermt de INHOUD van een bestand, maar zegt niets
   over WELK bestand het is. Wie bij de opslag kan, kan een blob dus omwisselen:
   het identiteitsbewijs van de een op de plek van de ander. De AEAD merkt daar
   niets van -- het blob is ongeschonden -- en de backoffice ziet daarna het
   verkeerde document bij een goedkeuring. Voor KYC-bestanden is dat het ergste
   wat er met deze opslag kan gebeuren.

   Daarom gaat de bestandsnaam als additional authenticated data mee. Alle drie de
   opslagplaatsen (uploads, media, bestanden) verwijzen naar hun bestanden met de
   kale naam, en die naam is bij zowel schrijven als lezen bekend -- dus is het
   overal dezelfde conventie. Verwissel je twee blobs, dan klopt de naam niet meer
   en gaat er niets open.

   Bestaande bestanden blijven leesbaar: RTGENC1 (ongebonden) en onversleutelde
   bytes gaan door de oude weg. Nieuwe schrijfacties zijn gebonden (RTGENC2).
   Zonder RTG_ENC_KEY versleutelt deze laag niets, en dan valt er ook niets te
   binden -- dat is dezelfde afweging als hierboven. */
const MAGIC2 = Buffer.from('RTGENC2'); // zelfde lengte als MAGIC: offsets blijven gelijk

function versleutelBestand(buf, naam) {
  if (!KEY) return buf;
  if (!naam) throw new Error('versleutelBestand vraagt de bestandsnaam (de context).');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  c.setAAD(Buffer.from('rtg-bestand-v2|' + naam, 'utf8'));
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC2, iv, c.getAuthTag(), enc]);
}

function ontsleutelBestand(buf, naam) {
  if (!buf || buf.length < MAGIC2.length) return buf;
  if (!buf.subarray(0, MAGIC2.length).equals(MAGIC2)) return ontsleutelBuf(buf); // RTGENC1 of plat
  if (!KEY) throw new Error('Bestand is versleuteld maar RTG_ENC_KEY ontbreekt.');
  const p = MAGIC2.length;
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(p, p + 12));
  d.setAAD(Buffer.from('rtg-bestand-v2|' + String(naam || ''), 'utf8'));
  d.setAuthTag(buf.subarray(p + 12, p + 28));
  return Buffer.concat([d.update(buf.subarray(p + 28)), d.final()]); // gooit bij een verkeerde naam
}

module.exports = {
  AAN, versleutel, ontsleutel, versleutelBuf, ontsleutelBuf,
  versleutelBestand, ontsleutelBestand
};
