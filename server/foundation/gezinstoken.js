/* HET GEZINSPROFIELTOKEN (CODECREDENTIALS.json:
   foundation.family_profile_token_buiten_harde_poort, besluit B17).

   Dit is de ENE plek waar een gezinssessie ontstaat, wordt herkend, roteert en
   ophoudt. Elke consumer (rtf.verifieerProfiel en alles wat erop leunt:
   rtfSociaal, gezinsPoort, huisPoort, rtfPoort, rtfSpeler, profiel(), en
   sessieVan/familieVan/beheerderVan onder /api/foundation) gaat via
   profielVan() in ./gezinshulp.js, en die vraagt het hier. Geen tweede
   vergelijking ernaast: test/foundation-gezinstoken-productie.test.js zakt op
   een `.token ===` tegen een gezinsprofiel.

   - 128 bits (GZ.<32 hex> via kern/bearercode.js), kaal alleen in het antwoord
     dat hem uitgeeft; op het profiel staat alleen een hash met issuer, doel,
     scope, onderwerp, issued_at en expires_at;
   - het onderwerp is gezin + profiel-id + rol (beheerder of lid) + epoch en
     verder NIETS: geen naam, geen leeftijd, geen groep. Een kind is geen
     profiel (LEVEN.md par. 2), en een token is geen plek voor wie hij is;
   - een sessie is geen eenmalige code: max_gebruik 0 = NIET GETELD. Wat haar
     begrenst is de vervaltijd, het plafond per profiel, de epoch en intrekken;
   - GELDIG_MS 7 dagen (besluit B19, 4 oktober 2026; was 30). Wie binnen die
     termijn met zijn passkey bevestigt, krijgt opnieuw 7 dagen
     (./gezinsdeur.js, /gezin/sessie/verleng); zonder passkey is het daarna
     opnieuw inloggen met gezinscode en pincode. Nooit langer dan 7 dagen per
     stap: geef() kapt elke termijn af, en reden() telt ook vanaf issued_at,
     zodat een sessie van voor B19 (30 dagen op schijf) na 7 dagen ophoudt.
     KANAAL_MS 12 uur: de RTG-app van een gekoppelde oppas vraagt het kanaal
     opnieuw op met zijn eigen ingelogde RTG-account, dus een werkdag is genoeg;
   - de EPOCH: een nieuwe pincode, een andere rol, ontkoppelen of een beheerder
     die "overal afmelden" kiest hoogt hem op (sluit()), en dan valt elke sessie
     van dat profiel tegelijk weg;
   - zoeken vergelijkt ELKE hash van het gezin met timingSafeEqual, zonder
     vroege uitgang;
   - een OUD kaal token (48 hex, raw op het profiel) opent niets: het heeft de
     verkeerde vorm, en ruimOud() haalt het van schijf. Wie zo'n token had, logt
     opnieuw in met de gezinscode en zijn eigen pincode. Er wordt niets omgezet:
     een raw bewaard geheim wordt geen hash met een nieuwe vervaltijd. */
'use strict';

const klok = require('../lib/klok');

const GELDIG_MS = 7 * 86400000;
const KANAAL_MS = 12 * 3600000;
const MAX_SESSIES = 8;
const DOEL = 'gezinsprofiel-sessie';
const SCOPE = Object.freeze(['foundation.gezin']);
const VORM = /^GZ\.[0-9A-F]{32}$/i;
const rolVan = p => (p && p.rol === 'beheerder' ? 'beheerder' : 'lid');

function maak({ crypto, nu = () => klok.datum().toISOString() }) {
  const bearer = require('../kern/bearercode')({ crypto, namespace: 'foundation.gezinsprofiel', nu });
  const epoch = p => (Number.isSafeInteger(p && p.sessieEpoch) ? p.sessieEpoch : 0);
  const levend = t => t && !t.ingetrokken_at && Date.parse(t.expires_at) > Date.parse(nu());

  /* Een nieuwe sessie voor dit profiel; de kale waarde komt EEN keer terug. */
  function geef(g, p, { geldigMs } = {}) {
    if (!g || !p || !g.code || !p.id) throw new Error('gezinstoken vereist een gezin en een profiel');
    const m = bearer.maak({ prefix: 'GZ', issuer: 'rtg.foundation', doel: DOEL, scope: SCOPE,
      onderwerp: { gezin: String(g.code), profiel: String(p.id), rol: rolVan(p), epoch: epoch(p) },
      geldigheid: { duurMs: Math.min(Number(geldigMs) || GELDIG_MS, GELDIG_MS) }, gebruik: 'sessie',
      afgeleid: 'perAanroep' });
    const rij = (Array.isArray(p.sessies) ? p.sessies : []).filter(levend);
    rij.push(m.toegang);
    while (rij.length > MAX_SESSIES) rij.shift();
    p.sessies = rij;
    delete p.token;
    return m.code;
  }

  function reden(g, p, t) {
    const r = bearer.reden(t, { doel: DOEL, scope: SCOPE, negeerGebruik: true });
    if (r) return r;
    if (!(Date.parse(t.issued_at) + GELDIG_MS > Date.parse(nu()))) return 'verlopen';
    const o = t.onderwerp || {};
    if (o.gezin !== g.code || o.profiel !== p.id || o.rol !== rolVan(p) || o.epoch !== epoch(p)) return 'onderwerp';
    return null;
  }

  /* Constant-time: elke sessie van elk profiel van dit gezin wordt vergeleken. */
  function zoek(g, raw) {
    const kaal = String(raw == null ? '' : raw).trim();
    if (!g || !VORM.test(kaal)) return null;
    const gezocht = bearer.hash(kaal);
    let hit = null;
    for (const p of Object.values(g.profielen || {}))
      for (const t of (p && Array.isArray(p.sessies) ? p.sessies : []))
        if (bearer.zelfdeHash(t && t.code_hash, gezocht)) hit = { p, t };
    if (!hit || reden(g, hit.p, hit.t)) return null;
    return hit;
  }
  const vind = (g, raw) => { const h = zoek(g, raw); return h ? h.p : null; };

  /* De houder roteert zijn EIGEN sessie: de gebruikte valt weg, een nieuwe komt
     een keer terug. Niemand roteert de sessie van een ander -- dan kreeg de
     beheerder de sleutel van zijn kind in handen; hij kan hem wel intrekken.
     ROTEREN VERLENGT NIET (B19): de nieuwe sessie houdt het einde van de oude,
     anders was elke zevende dag roteren een eeuwige sessie zonder passkey.
     Alleen `verleng` (na een passkeybevestiging, ./gezinsdeur.js) geeft weer
     een volle termijn -- en een gast nooit: zijn kanaal blijft 12 uur. */
  function roteer(g, raw, { verleng } = {}) {
    const h = zoek(g, raw);
    if (!h || (verleng && h.p.rol === 'gast')) return null;
    const rest = Date.parse(h.t.expires_at) - Date.parse(nu());
    if (!(rest > 0)) return null;
    bearer.intrekken(h.t, 'houder', verleng ? 'verlengd' : 'geroteerd');
    return geef(g, h.p, { geldigMs: verleng ? GELDIG_MS : rest });
  }
  function intrek(g, raw) {
    const h = zoek(g, raw);
    if (!h) return false;
    bearer.intrekken(h.t, 'houder', 'afgemeld');
    h.p.sessies = h.p.sessies.filter(levend);
    return true;
  }
  /* Alle sessies van dit profiel tegelijk weg, ook op apparaten die niemand meer
     ziet: de epoch omhoog. */
  function sluit(p) {
    if (!p || typeof p !== 'object') return p;
    p.sessieEpoch = epoch(p) + 1;
    p.sessies = [];
    delete p.token;
    return p;
  }
  /* Het oude kale token van schijf; het opent al niets meer (zie VORM). */
  function ruimOud(gezinnen) {
    let n = 0;
    for (const g of Object.values(gezinnen || {}))
      for (const p of Object.values((g && g.profielen) || {}))
        if (p && Object.prototype.hasOwnProperty.call(p, 'token')) { delete p.token; n++; }
    return n;
  }
  /* Wat een beheerder mag zien: hoeveel apparaten, en wanneer het laatst. Nooit
     een hash, nooit het onderwerp. */
  function overzicht(p) {
    const rij = (p && Array.isArray(p.sessies) ? p.sessies : []).filter(levend);
    return { apparaten: rij.length, laatstUitgegeven: rij.map(t => t.issued_at).sort().pop() || null };
  }
  /* Leeft de sessie met deze hash nog op dit profiel? Voor een open live-stroom
     (./gezinsstroom.js): die controleert bij elke hartslag, zodat afmelden,
     intrekken en verlopen ook een lopende verbinding sluiten. */
  function leeft(g, profielId, codeHash) {
    const p = g && g.profielen && Object.prototype.hasOwnProperty.call(g.profielen, profielId) ? g.profielen[profielId] : null;
    let hit = null;
    for (const t of (p && Array.isArray(p.sessies) ? p.sessies : []))
      if (bearer.zelfdeHash(t && t.code_hash, codeHash)) hit = t;
    return !!(hit && !reden(g, p, hit));
  }
  return { geef, zoek, vind, roteer, intrek, sluit, ruimOud, overzicht, leeft,
    DOEL, SCOPE, GELDIG_MS, KANAAL_MS, MAX_SESSIES };
}

module.exports = { maak, DOEL, SCOPE, GELDIG_MS, KANAAL_MS, MAX_SESSIES, VORM };
