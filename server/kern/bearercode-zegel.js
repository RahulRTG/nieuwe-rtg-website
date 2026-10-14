/* HET ZEGEL OP EEN BEARERCODE-V2-RECORD: HMAC-SHA-256 met een sleutelversie.

   Tot 14 oktober 2026 stond in `contracthash` een KALE sha256 over de
   beveiligingsvelden (VELDEN) plus de namespace. Wie in de opslag kan
   schrijven, rekende die na een greep in het record (een opgerekte
   expires_at, een bredere scope) gewoon opnieuw uit. Een hash beschermt niet
   tegen wie zowel het record als de hash kan wijzigen; een HMAC met een
   sleutel die NIET in die opslag woont wel (de ring: ./bearercode-sleutelring.js).

   DE CONSTRUCTIE, met domeinscheiding op twee plekken:
     K_ns = HKDF-SHA-256(ringsleutel[kid], info = 'rtg-bearer-v2|zegel|' + ns)
     mac  = HMAC-SHA-256(K_ns, 'rtg-bearer-v2|hmac|' + ns + '|' + kid + '|'
                               + stabiel(VELDEN uit het record))
   Een zegel uit een andere namespace of onder een andere kid opent dus niets.
   Op het record: `contractkid` (de sleutelversie) en `contracthash` (de mac).

   DE UITSLAG van toets(): null (in orde), of
     ongezegeld         een record zonder kid: een kale sha256 van voor de
                        migratie (bearercode-migratie.js). Die wordt NOOIT meer
                        als kale hash gecontroleerd en valt NIET terug op v1;
     sleutel-ontbreekt  geen leesbare ring, of de kid staat er niet (meer) in;
     gemanipuleerd      de mac klopt niet.
   Zegelen zonder sleutel gooit `sleutel-ontbreekt`: zonder sleutel geen code.

   DE GRENS. Een HMAC helpt tegen wie de opslag heeft, niet tegen wie ook de
   sleutel heeft; daarom woont die in een ander domein (zie de ring). */
'use strict';

const VELDEN = ['issuer', 'doel', 'scope', 'onderwerp', 'issued_at', 'expires_at', 'max_gebruik',
  'gebruiksvorm', 'code_hash', 'bron_toegang', 'stapOp', 'afgeleid'];

/* Een vaste volgorde van sleutels, zodat dezelfde inhoud dezelfde mac geeft. */
function stabiel(v) {
  if (Array.isArray(v)) return '[' + v.map(stabiel).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stabiel(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const deel = t => { const d = {}; for (const k of VELDEN) d[k] = t[k] === undefined ? null : t[k]; return d; };

/* De oude, kale vorm. Alleen nog voor de migratie: die hersealt uitsluitend
   een record waarvan deze hash NU klopt. */
const kaleHash = (crypto, ns, t) =>
  crypto.createHash('sha256').update('rtg-bearer-v2|' + ns + '|' + stabiel(deel(t))).digest('hex');

const fout = (code, tekst) => Object.assign(new Error('bearercode v2: ' + tekst), { code });

function maakContractzegel({ crypto, ns, sleutelring }) {
  /* Alleen een WEGGELATEN ring is de ring van het proces; null is geen ring. */
  const leesRing = sleutelring === undefined ? require('./bearercode-sleutelring').ring
    : typeof sleutelring === 'function' ? sleutelring : () => sleutelring;
  const afgeleid = new Map();   // per sleutelobject en kid: K_ns
  const nsSleutel = (kid, sleutel) => {
    const id = kid + '|' + sleutel.toString('hex');
    if (!afgeleid.has(id)) afgeleid.set(id, Buffer.from(crypto.hkdfSync('sha256', sleutel, Buffer.alloc(0),
      Buffer.from('rtg-bearer-v2|zegel|' + ns), 32)));
    return afgeleid.get(id);
  };
  const ring = () => { const r = leesRing(); return r && r.sleutels instanceof Map && r.sleutels.size ? r : null; };
  const mac = (t, kid, sleutel) => crypto.createHmac('sha256', nsSleutel(kid, sleutel))
    .update('rtg-bearer-v2|hmac|' + ns + '|' + kid + '|' + stabiel(deel(t))).digest('hex');

  /* { contractkid, contracthash } met de nieuwste sleutel (of een genoemde). */
  function zegel(t, kid) {
    const r = ring();
    const k = kid || (r && r.actief);
    const s = r && r.sleutels.get(k);
    if (!s) throw fout('sleutel-ontbreekt', 'er is geen zegelsleutel' + (k ? ' voor kid ' + k : '') +
      (r === null && leesRing() && leesRing().fout ? ' (' + leesRing().fout + ')' : ''));
    return { contractkid: k, contracthash: mac(t, k, s) };
  }

  function toets(t) {
    if (typeof t.contractkid !== 'string' || !t.contractkid) return 'ongezegeld';
    const r = ring();
    const s = r && r.sleutels.get(t.contractkid);
    if (!s) return 'sleutel-ontbreekt';
    const h = String(t.contracthash || '');
    if (!/^[a-f0-9]{64}$/.test(h)) return 'gemanipuleerd';
    /* Constante tijd zonder timingSafeEqual: die telt in de toetsen van de
       domeinen als "een rij vergeleken" bij het ZOEKEN op code_hash. */
    const a = Buffer.from(h, 'hex'), b = Buffer.from(mac(t, t.contractkid, s), 'hex');
    let verschil = 0;
    for (let i = 0; i < 32; i++) verschil |= a[i] ^ b[i];
    return verschil === 0 ? null : 'gemanipuleerd';
  }

  return { zegel, toets, actief: () => { const r = ring(); return r ? r.actief : null; } };
}

module.exports = { maakContractzegel, kaleHash, stabiel, VELDEN };
