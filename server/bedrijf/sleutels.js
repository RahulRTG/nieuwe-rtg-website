/* DE SLEUTELS VAN EEN WERKRUIMTE (workos.workspace_access_tokens).

   Buiten productie opent het Werk OS met twee soorten bearers: een BEHEER-
   sleutel voor wie de werkruimte opende, en een LID-sessie per medewerker. In
   productie bestaan ze niet: daar is het RTG-account de enige drager
   (./productie-identiteit.js). Dit bestand zorgt dat de bearers die er buiten
   productie WEL zijn, zich aan het credentialbeleid houden:

   - 128 bits (WB./WL.<32 hex> via kern/bearercode.js), en kaal alleen in het
     antwoord dat ze uitgeeft: aanmaken, aanmelden, /api/bedrijf/mijn (een
     NIEUWE sessie per keer, nooit de oude terug) en roteren;
   - op de werkruimte staat alleen een hash met issuer, doel, scope, onderwerp
     (werkruimte, lid, epoch), issued_at en expires_at;
   - een sessie is geen eenmalige code: sinds bearercode v2 (Fase 1) staat er
     gebruik 'sessie' in plaats van max_gebruik = 0, zodat onbeperkt gebruik
     een verklaarde keuze is en niet per ongeluk ontstaat. Wat de sessie
     begrenst is haar vervaltijd (lid 7 dagen, beheer 30), het plafond van
     MAX_SESSIES per lid, de EPOCH en intrekken/roteren aan de serverkant;
   - afgeleid 'perAanroep': er ontstaat uit een sessie niets dat blijft; elke
     aanroep toetst de epoch opnieuw (reden() hieronder), en een contracthash
     maakt een overschreven einde of onderwerp dicht;
   - de EPOCH: uit dienst, afgewezen, deprovisioning, bewaring of een import
     hoogt hem op (sluit()), en dan valt elke sessie van dat lid tegelijk weg;
   - zoeken vergelijkt elke hash met timingSafeEqual, zonder vroege uitgang.

   Er is geen eenmalige claim om atomair te maken: uitgeven, roteren en
   intrekken zijn EEN synchrone mutatie van de werkruimte binnen een verzoek. */
'use strict';

const munt = require('crypto');
const klok = require('../lib/klok');

const LID_MS = 7 * 86400000;
const BEHEER_MS = 30 * 86400000;
const MAX_SESSIES = 8;
const DOEL = Object.freeze({ beheer: 'werkruimte-beheer', lid: 'werkruimte-lid' });
const VORM = /^W[BL]\.[0-9A-F]{32}$|^[0-9a-f]{48}$/i;

function maak({ nu = () => klok.datum().toISOString() } = {}) {
  const bearer = require('../kern/bearercode')({ crypto: munt, namespace: 'workos.workspace_access_tokens', nu });
  const scope = soort => ['werkos.' + soort];

  function record(soort, w, l) {
    return bearer.maak({ prefix: soort === 'beheer' ? 'WB' : 'WL', issuer: 'rtg.werkos', doel: DOEL[soort],
      scope: scope(soort), onderwerp: { werkruimte: w.code, lidId: l ? l.id : null, epoch: epoch(w, l) },
      geldigheid: { duurMs: soort === 'beheer' ? BEHEER_MS : LID_MS }, gebruik: 'sessie', afgeleid: 'perAanroep' });
  }
  /* Een oude kale sleutel krijgt een v1-record: zijn hash komt van de sleutel
     die er AL was, en een v2-record zou die overschrijving terecht als
     gemanipuleerd zien. Hij blijft v1 tot de houder hem roteert. */
  function legacyRecord(soort, w, l, raw) {
    const g = bearer.maak({ prefix: soort === 'beheer' ? 'WB' : 'WL', issuer: 'rtg.werkos', doel: DOEL[soort],
      scope: scope(soort), onderwerp: { werkruimte: w.code, lidId: l ? l.id : null, epoch: epoch(w, l) },
      geldigMs: soort === 'beheer' ? BEHEER_MS : LID_MS });
    g.toegang.max_gebruik = 0;
    g.toegang.code_hash = bearer.hash(raw);
    g.toegang.legacy = 'legacy192';
    return g;
  }
  const epoch = (w, l) => l ? (l.sessieEpoch || 0) : (w.beheerEpoch || 0);
  const lijst = (w, l) => l ? (l.sessies = l.sessies || []) : (w.beheerSessies = w.beheerSessies || []);
  function bewaar(w, l, t) {
    const rij = lijst(w, l).filter(x => !x.ingetrokken_at && Date.parse(x.expires_at) > Date.parse(nu()));
    rij.push(t);
    while (rij.length > MAX_SESSIES) bearer.intrekken(rij.shift(), 'systeem', 'te veel sessies');
    if (l) l.sessies = rij; else w.beheerSessies = rij;
  }
  function geef(soort, w, l) {
    const g = record(soort, w, l);
    bewaar(w, l, g.toegang);
    return g.code;
  }

  function reden(t, soort, w, l) {
    const r = bearer.reden(t, { doel: DOEL[soort], scope: scope(soort), negeerGebruik: true });
    if (r) return r;
    const o = t.onderwerp || {};
    if (o.werkruimte !== w.code || o.lidId !== (l ? l.id : null) || o.epoch !== epoch(w, l)) return 'onderwerp';
    return null;
  }
  /* Constant-time: elke sessie van de werkruimte wordt vergeleken. */
  function zoek(w, raw, soort) {
    const kale = String(raw || '').trim();
    if (!w || !VORM.test(kale)) return null;
    const gezocht = bearer.hash(kale);
    let hit = null;
    const kandidaten = soort === 'beheer' ? [[null, w.beheerSessies]]
      : Object.values(w.leden || {}).map(l => [l, l && l.sessies]);
    for (const [l, rij] of kandidaten)
      for (const t of rij || []) if (bearer.zelfdeHash(t && t.code_hash, gezocht)) hit = { l, t };
    if (!hit || reden(hit.t, soort, w, hit.l)) return null;
    return hit;
  }

  function roteer(w, raw, soort) {
    const hit = zoek(w, raw, soort);
    if (!hit) return null;
    bearer.intrekken(hit.t, soort, 'geroteerd');
    return geef(soort, w, hit.l);
  }
  function intrek(w, raw, soort) {
    const hit = zoek(w, raw, soort);
    if (!hit) return false;
    bearer.intrekken(hit.t, soort, 'ingetrokken door de houder');
    return true;
  }

  /* Oude kale sleutels (48 hex, 192 bits) worden hash met het merkteken
     legacy192: sterk genoeg om te houden, maar vanaf nu met een vervaltijd. */
  function migreer(ws, { productie } = {}) {
    let n = 0;
    const neem = (w, l, raw, soort) => {
      n++;
      if (productie || typeof raw !== 'string' || !raw) return;
      bewaar(w, l, legacyRecord(soort, w, l, raw).toegang);
    };
    for (const w of Object.values(ws || {})) {
      if (!w || typeof w !== 'object') continue;
      if (Object.prototype.hasOwnProperty.call(w, 'beheerToken')) {
        neem(w, null, w.beheerToken, 'beheer'); delete w.beheerToken;
      }
      for (const l of Object.values(w.leden || {})) {
        if (!l || typeof l !== 'object' || !Object.prototype.hasOwnProperty.call(l, 'token')) continue;
        neem(w, l, l.status === 'actief' || l.status === 'wacht' ? l.token : null, 'lid'); delete l.token;
      }
    }
    return n;
  }

  return { geefLid: (w, l) => geef('lid', w, l), geefBeheer: w => geef('beheer', w, null),
    lidVan: (w, raw) => zoek(w, raw, 'lid'), beheerVan: (w, raw) => zoek(w, raw, 'beheer'),
    roteer, intrek, migreer, publiek: bearer.publiek, DOEL };
}

/* Een lid sluiten: de epoch omhoog en elke sessie weg. Geen crypto nodig, dus
   ook bruikbaar voor de tenantlaag (brug, bewaring, import). */
function sluit(l) {
  if (!l || typeof l !== 'object') return l;
  l.sessieEpoch = (l.sessieEpoch || 0) + 1;
  l.sessies = [];
  delete l.token;
  return l;
}
function sluitBeheer(w) {
  if (!w || typeof w !== 'object') return w;
  w.beheerEpoch = (w.beheerEpoch || 0) + 1;
  w.beheerSessies = [];
  delete w.beheerToken;
  return w;
}
const heeftSessie = l => !!(l && ((l.sessies || []).some(t => !t.ingetrokken_at) || l.token));

module.exports = { maak, sluit, sluitBeheer, heeftSessie, DOEL, MAX_SESSIES, LID_MS, BEHEER_MS };
