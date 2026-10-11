/* ============================================================================
   DE REGEL -- hoe een auditrecord eruitziet en hoe zijn hash wordt gerekend.

   Dezelfde kanonieke vorm als `lib/keten.js` (sleutels gesorteerd, `hash` telt
   niet mee, `vorige` en `nr` wel), maar DIEP: ook de sleutels van `actor`,
   `bron` en `context` staan gesorteerd, zodat een herserialisatie nooit een
   andere hash geeft. Het andere verschil met de oudere journalen is de hash: hier de VOLLE
   SHA-256 (64 tekens) met een eigen domeinprefix, want deze hash gaat naar een
   plek buiten de database en wordt daar door iemand anders bewaard. Een
   afgekapte hash van 32 tekens is voor een lokale link genoeg; voor een anker
   dat jaren moet standhouden niet.

   Een regel draagt WIE (actor uit sessie/CI), WAAR (bron), WANNEER (tijd, door
   de schrijver gezet en nooit door de aanroeper), WAT (type + uitkomst + context
   volgens de gesloten lijst) en een correlatie-id waarmee een keten van
   gebeurtenissen (aanvraag -> weigering -> uitvoering) aan elkaar te knopen is.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const cat = require('./gebeurtenissen');

const DOMEIN = 'RTG:AUDITBOEK:v1\0';
const VERSIE = 1;

function kanoniek(waarde) {
  const orden = v => {
    if (Array.isArray(v)) return v.map(orden);
    if (v && typeof v === 'object') {
      const uit = {};
      for (const k of Object.keys(v).sort()) if (v[k] !== undefined) uit[k] = orden(v[k]);
      return uit;
    }
    return v;
  };
  return JSON.stringify(orden(waarde));
}
const hashRegel = regel => {
  const zonder = { ...regel }; delete zonder.hash;
  return crypto.createHash('sha256').update(DOMEIN + kanoniek(zonder)).digest('hex');
};

function controleerInvoer(inv) {
  const k = [];
  const spec = cat.GEBEURTENISSEN[inv && inv.type];
  if (!spec) return ['onbekend gebeurtenistype'];
  if (!cat.UITKOMSTEN.includes(inv.uitkomst)) k.push('uitkomst onbekend');
  k.push(...cat.controleerActor(inv.actor));
  if (!inv.bron || !cat.VORMEN.ref.test(String(inv.bron.dienst || '')) || !cat.VORMEN.ref.test(String(inv.bron.instantie || '')))
    k.push('bron (dienst, instantie) ontbreekt of heeft een ongeldige vorm');
  if (inv.correlatie != null && !cat.VORMEN.ref.test(String(inv.correlatie))) k.push('correlatie heeft een ongeldige vorm');
  if (inv.onderwerp != null && !cat.VORMEN.ref.test(String(inv.onderwerp)) && !cat.VORMEN.pad.test(String(inv.onderwerp)) &&
      !cat.VORMEN.digest.test(String(inv.onderwerp))) k.push('onderwerp heeft een ongeldige vorm');
  k.push(...cat.controleerContext(inv.type, inv.context));
  return k;
}

/* Bouwt de regel; `nr`, `vorige` en `tijd` komen van de SCHRIJVER. */
function maakRegel(inv, { nr, vorige, tijd }) {
  const klachten = controleerInvoer(inv);
  if (klachten.length) throw Object.assign(new Error('Auditregel geweigerd: ' + klachten.join('; ')), { code: 'AUDIT_ONGELDIG', klachten });
  const regel = { v: VERSIE, nr, vorige: vorige || null, tijd, type: inv.type,
    categorie: cat.GEBEURTENISSEN[inv.type].categorie, uitkomst: inv.uitkomst,
    actor: { soort: inv.actor.soort, ref: inv.actor.ref },
    bron: { dienst: inv.bron.dienst, instantie: inv.bron.instantie },
    correlatie: inv.correlatie || null, onderwerp: inv.onderwerp || null, context: { ...inv.context } };
  return { ...regel, hash: hashRegel(regel) };
}

/* Controleert een regel zoals hij uit de opslag komt: hash, vorm, catalogus. */
function controleerRegel(regel) {
  const k = [];
  if (!regel || typeof regel !== 'object') return ['regel is geen object'];
  if (regel.v !== VERSIE) k.push('onbekende schemaversie');
  if (!/^[a-f0-9]{64}$/.test(String(regel.hash || '')) || hashRegel(regel) !== regel.hash) k.push('inhoud klopt niet met hash');
  if (regel.vorige != null && !/^[a-f0-9]{64}$/.test(String(regel.vorige))) k.push('vorige is geen hash');
  const inv = { type: regel.type, uitkomst: regel.uitkomst, actor: regel.actor, bron: regel.bron,
    correlatie: regel.correlatie, onderwerp: regel.onderwerp, context: regel.context };
  const spec = cat.GEBEURTENISSEN[regel.type];
  if (spec && spec.categorie !== regel.categorie) k.push('categorie hoort niet bij het type');
  k.push(...controleerInvoer(inv));
  if (!Number.isFinite(Date.parse(regel.tijd))) k.push('tijd is geen tijdstip');
  return k;
}

module.exports = { kanoniek, hashRegel, maakRegel, controleerRegel, controleerInvoer, VERSIE, DOMEIN };
