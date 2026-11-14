/* ============================================================================
   EEN ONHERSTELBARE AUDITBREUK VERKLAREN, ZONDER HAAR WEG TE POETSEN.

   Een extern anker mag nooit stil naar een kortere of andere lokale keten
   springen. Als de ontbrekende regels niet meer terug te halen zijn, bestaat
   er daarom maar een eerlijke uitweg: het oude tijdvak blijft staan, een
   APARTE herstelbevoegdheid tekent wat verloren is, en een nieuw tijdvak begint
   bij een concreet punt in de overgebleven keten.

   De gewone ankersleutel telt hier nadrukkelijk NIET. Die sleutel draait in de
   app en moet automatisch blokken kunnen maken; wie de app overneemt, mag
   daarmee geen verdwenen geschiedenis legitimeren. Een herstelverklaring wordt
   getekend met RTG_ANKER_HERSTEL_SIGN_KEY_FILE (alleen in het handmatige script) en
   getoetst met RTG_ANKER_HERSTEL_PUBLIEK(_BESTAND) in app en ontvanger.

   De verklaring bindt:
     - `van`: de laatste externe kop in het oude tijdvak;
     - `gemeenschappelijk`: een ouder punt dat extern EN lokaal nog bestaat;
     - `naar`: het eerste bewijsbare punt van de overgebleven lokale tak;
     - `verlies`: exact de nummers na het gemeenschappelijke punt t/m `van`;
     - bewijs-digests: verwijzingen naar bewaarde incidentstukken, nooit inhoud.

   Dit is geen herstel van de ontbrekende regels. De uitslag blijft daarom
   `auditbreuk: true`; alleen de operationele ankerketen kan na de expliciete,
   append-only verklaring weer verder in het volgende tijdvak.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { kanoniek } = require('./ankerzegel');

const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');
const TEKENDOEL = 'rtg-ankerherstel-v1\n';
const SOORT = 'ankerherstelverklaring';
const REDEN = 'ONHERSTELBARE_AUDITBREUK';

const tijdvakVan = p => Math.max(1, Number(p && p.tijdvak) || 1);
const isIso = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const isHash = v => typeof v === 'string' && /^[0-9a-f]{32}$/i.test(v);
const isSha = v => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v);
const puntGoed = p => p && Number.isSafeInteger(Number(p.nr)) && Number(p.nr) > 0 && isHash(p.hash) && isIso(p.at);

function zonderHandtekening(v) { const { handtekening, ...kaal } = v || {}; return kaal; }
const teTekenen = v => Buffer.from(TEKENDOEL + kanoniek(zonderHandtekening(v)), 'utf8');

function vormFout(v) {
  if (!v || v.soort !== SOORT || Number(v.versie) !== 1) return 'onbekende soort of versie';
  if (typeof v.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id))
    return 'ongeldig verklaring-id';
  if (!isIso(v.gemaaktAt)) return 'ongeldige maaktijd';
  if (typeof v.journaal !== 'string' || !/^[A-Za-z][A-Za-z0-9]{1,63}$/.test(v.journaal)) return 'ongeldig journaal';
  if (v.redenCode !== REDEN) return 'de verklaring noemt geen onherstelbare auditbreuk';
  if (!puntGoed(v.van) || !puntGoed(v.gemeenschappelijk) || !puntGoed(v.naar)) return 'een van de drie punten is ongeldig';
  const oud = tijdvakVan(v.van), nieuw = tijdvakVan(v.naar);
  if (nieuw !== oud + 1) return 'het nieuwe tijdvak volgt niet direct op het oude';
  if (Number(v.gemeenschappelijk.nr) >= Number(v.van.nr)) return 'het gemeenschappelijke punt ligt niet vóór de externe kop';
  if (Number(v.gemeenschappelijk.nr) >= Number(v.naar.nr)) return 'het lokale beginpunt ligt niet na het gemeenschappelijke punt';
  const verlies = v.verlies;
  if (!verlies || verlies.status !== 'inhoud-onherstelbaar') return 'het verlies is niet als onherstelbaar benoemd';
  const vanaf = Number(v.gemeenschappelijk.nr) + 1, tot = Number(v.van.nr);
  if (Number(verlies.vanafNr) !== vanaf || Number(verlies.totNr) !== tot || Number(verlies.aantal) !== tot - vanaf + 1)
    return 'het verliesbereik sluit niet exact aan op het oude tijdvak';
  if (!Array.isArray(v.bewijs) || !v.bewijs.length || v.bewijs.length > 32) return 'er zijn geen bruikbare bewijs-digests';
  if (v.bewijs.some(b => !b || typeof b.soort !== 'string' || b.soort.length < 2 || b.soort.length > 80 || !isSha(b.sha256)))
    return 'een bewijsverwijzing is ongeldig';
  return null;
}

function publiekObject(ruw) {
  if (!Buffer.isBuffer(ruw) || ruw.length !== 32) return null;
  try { return crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519, ruw]), format: 'der', type: 'spki' }); }
  catch { return null; }
}

function publiekUitOmgeving(env = process.env) {
  let tekst = String(env.RTG_ANKER_HERSTEL_PUBLIEK || '').trim();
  if (!tekst && env.RTG_ANKER_HERSTEL_PUBLIEK_BESTAND) {
    try { tekst = fs.readFileSync(env.RTG_ANKER_HERSTEL_PUBLIEK_BESTAND, 'utf8').trim(); } catch { return null; }
  }
  const ruw = tekst ? Buffer.from(tekst, 'base64') : null;
  return ruw && ruw.length === 32 ? { ruw, b64: ruw.toString('base64'), sleutel: publiekObject(ruw) } : null;
}

function controleer(v, publiek) {
  const fout = vormFout(v);
  if (fout) return { geldig: false, reden: fout };
  const p = publiek && publiek.sleutel ? publiek : (Buffer.isBuffer(publiek) ?
    { ruw: publiek, b64: publiek.toString('base64'), sleutel: publiekObject(publiek) } : null);
  const h = v.handtekening;
  if (!p || !p.sleutel) return { geldig: false, reden: 'de aparte publieke herstelsleutel ontbreekt' };
  if (!h || h.alg !== 'ed25519' || h.publiek !== p.b64 || typeof h.waarde !== 'string')
    return { geldig: false, reden: 'de verklaring draagt niet de ingestelde herstelhandtekening' };
  try {
    const geldig = crypto.verify(null, teTekenen(v), p.sleutel, Buffer.from(h.waarde, 'base64'));
    return { geldig, reden: geldig ? null : 'de herstelhandtekening klopt niet' };
  } catch { return { geldig: false, reden: 'de herstelhandtekening is onleesbaar' }; }
}

function teken(kaal, prive) {
  const sleutel = typeof prive === 'string' || Buffer.isBuffer(prive) ? crypto.createPrivateKey(prive) : prive;
  const publiek = crypto.createPublicKey(sleutel);
  const ruw = publiek.export({ format: 'der', type: 'spki' }).subarray(-32);
  const basis = Object.assign({}, kaal);
  const fout = vormFout(basis);
  if (fout) throw new Error('ankerherstel: ' + fout);
  return Object.assign(basis, { handtekening: { alg: 'ed25519',
    sleutelId: crypto.createHash('sha256').update(ruw).digest('hex').slice(0, 16), publiek: ruw.toString('base64'),
    waarde: crypto.sign(null, teTekenen(basis), sleutel).toString('base64') } });
}

function zelfdePunt(a, b, metTijdvak) {
  return !!a && !!b && Number(a.nr) === Number(b.nr) && a.hash === b.hash && a.at === b.at &&
    (!metTijdvak || tijdvakVan(a) === tijdvakVan(b));
}

function maakHerstel({ omgeving } = {}) {
  const env = omgeving || process.env;
  let gelezen = false, verklaring = null, fout = null;
  function lees() {
    if (gelezen) return { verklaring, fout };
    gelezen = true;
    if (!env.RTG_ANKER_HERSTEL_FILE) return { verklaring: null, fout: null };
    try { verklaring = JSON.parse(fs.readFileSync(env.RTG_ANKER_HERSTEL_FILE, 'utf8')); }
    catch (e) { fout = 'de herstelverklaring is niet leesbaar: ' + (e && e.message || e); return { verklaring: null, fout }; }
    const c = controleer(verklaring, publiekUitOmgeving(env));
    if (!c.geldig) { fout = c.reden; verklaring = null; }
    return { verklaring, fout };
  }

  function punt(naam, p) {
    if (!p) return p;
    const v = lees().verklaring;
    return v && v.journaal === naam ? Object.assign({}, p, { tijdvak: tijdvakVan(v.naar), herstelId: v.id }) : p;
  }

  function verklaar({ naam, anker, regels }) {
    const l = lees(), v = l.verklaring;
    if (!v || v.journaal !== naam) return { verklaard: false, reden: l.fout || 'geen geldige herstelverklaring voor dit journaal' };
    if (!zelfdePunt(v.van, anker, true)) return { verklaard: false, reden: 'de verklaring hoort niet bij de laatste externe kop' };
    const rij = Array.isArray(regels) ? regels : [];
    if (!rij.some(r => zelfdePunt(r, v.gemeenschappelijk, false)))
      return { verklaard: false, reden: 'het gemeenschappelijke punt bestaat lokaal niet meer met dezelfde hash' };
    if (!rij.some(r => zelfdePunt(r, v.naar, false)))
      return { verklaard: false, reden: 'het verklaarde beginpunt van het nieuwe tijdvak bestaat lokaal niet met dezelfde hash' };
    return { verklaard: true, verklaring: v, reden: 'onherstelbare auditbreuk expliciet verklaard; verder in tijdvak ' + tijdvakVan(v.naar) };
  }

  return { lees, punt, verklaar };
}

module.exports = { maakHerstel, controleer, teken, vormFout, teTekenen, publiekUitOmgeving,
  tijdvakVan, zelfdePunt, TEKENDOEL, SOORT, REDEN };
