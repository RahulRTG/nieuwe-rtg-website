/* ============================================================================
   HET LEERHUIS -- de oordelen, zonder opslag.

   Elk oordeel hier is BEREKEND uit de projectie en draagt zijn opbouw: een ja
   zonder waarom is een orakel (AUTHORITY.md grens 4). Er zit geen model in en
   geen score op een mens; alleen regels die je kunt nalezen.

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. BEKWAAM IS NIET BEVOEGD. De brug naar bevoegdheid staat apart, in
      ./brug.js, en geeft hoogstens AUTHORITY_ELIGIBLE.

   2. FAIL CLOSED. Een vaardigheid die niet bestaat, een beleid dat niemand
      tweede heeft goedgekeurd, een bewijs dat is ingetrokken: allemaal
      NOT_ELIGIBLE, met de reden. `onbekend` wordt hier nooit `ja`.

   3. VERVAL IS EEN BEREKENING. Een certificaat verloopt, een bewijs veroudert en
      een kennisverandering vraagt verversing -- en geen van die drie wordt als
      vlag opgeslagen (kern/vakbewijs.js regel 3).
   ========================================================================== */
'use strict';

const { STERKTE, IMPACT, minimumSterkte } = require('./standen');

const DAG = 86400000;
const EXPIRING_DAGEN = 30;
const rang = (lijst, x) => lijst.indexOf(x);
const ms = (t) => (typeof t === 'number' ? t : Date.parse(t));

const heeftBestuur = (st, persoon, rol) => (st.bestuur[persoon] || []).includes(rol);
/* Met een bron (besluit B2) telt een relatie alleen zolang de bron de persoon
   kent: een beeindigd dienstverband beeindigt de relatie, zonder dat iemand in
   het leerhuis eraan hoeft te denken. Onbekend telt als nee (fail closed). */
const relatieActief = (st, persoon) => !!(st.relaties[persoon] && st.relaties[persoon].actief
  && (!(st.org && st.org.bron) || (typeof st.bronToets === 'function' && st.bronToets(persoon) === true)));

/* Hoe vers is een bewijs? Alleen voor een vaardigheid met een geldigheid;
   zonder termijn blijft bewijs CURRENT tot een kennisverandering iets anders zegt. */
function versheid(st, b, nu) {
  const v = st.vaardigheden[b.vaardigheid];
  if (!v || !v.geldigDagen) return 'CURRENT';
  const leeftijd = (nu - ms(b.at)) / DAG;
  if (leeftijd > v.geldigDagen) return 'STALE';
  if (leeftijd > v.geldigDagen / 2) return 'AGING';
  return 'CURRENT';
}

/* Draagt deze set bewijsstukken een PROVEN voor deze mens en vaardigheid?
   Elk stuk moet in DEZE organisatie bestaan, over DEZE mens en vaardigheid
   gaan, niet ingetrokken zijn en niet door de mens zelf als meer dan
   SELF_REPORTED zijn gezet. Samen moeten ze de eis van de vaardigheid halen. */
function bewijsVoldoet(st, ids, persoon, vaardigheidId, nu) {
  const v = st.vaardigheden[vaardigheidId];
  if (!v) return { ok: false, redenen: ['onbekende vaardigheid ' + vaardigheidId] };
  const redenen = [];
  const stukken = [];
  for (const id of ids || []) {
    const b = st.bewijs[id];
    if (!b) { redenen.push('bewijs ' + id + ' bestaat niet in deze organisatie'); continue; }
    if (b.persoon !== persoon) { redenen.push('bewijs ' + id + ' gaat over iemand anders'); continue; }
    if (b.vaardigheid !== vaardigheidId) { redenen.push('bewijs ' + id + ' gaat over een andere vaardigheid'); continue; }
    if (b.ongeldig) { redenen.push('bewijs ' + id + ' is ingetrokken: ' + b.ongeldig.reden); continue; }
    if (versheid(st, b, nu) === 'STALE') { redenen.push('bewijs ' + id + ' is verouderd'); continue; }
    stukken.push(b);
  }
  const eis = v.bewijsEis || {};
  const soorten = new Set(stukken.map(b => b.soort));
  for (const s of eis.soorten || []) if (!soorten.has(s)) redenen.push('bewijs van soort ' + s + ' ontbreekt');
  /* De sterkte van de set is die van de STERKSTE vereiste soort, maar de eis
     geldt per stuk dat hem moet dragen: we eisen dat minstens een stuk de
     minimale sterkte haalt en dat geen enkel vereist stuk zwakker is. */
  const nodig = eis.sterkte || 'OBSERVED';
  const sterkste = stukken.map(b => b.sterkte).sort((a, b) => rang(STERKTE, b) - rang(STERKTE, a))[0];
  if (!sterkste || rang(STERKTE, sterkste) < rang(STERKTE, nodig))
    redenen.push('bewijs haalt niet de vereiste sterkte ' + nodig + ' (sterkste: ' + (sterkste || 'geen') + ')');
  return { ok: redenen.length === 0 && stukken.length > 0, redenen, stukken: stukken.map(b => b.id),
    minimum: minimumSterkte(stukken.map(b => b.sterkte)) };
}

/* Welke kennisveranderingen vragen iets van deze mens? */
function verversen(st, persoon, nu) {
  const p = st.personen[persoon]; if (!p) return [];
  const uit = [];
  for (const im of st.impacts) {
    const r = rang(IMPACT, im.klasse);
    if (r <= rang(IMPACT, 'INFORMATION_ONLY')) continue;
    for (const v of im.vaardigheden || []) {
      const bew = p.bewezen[v];
      if (!bew || ms(bew.at) >= ms(im.at)) continue;   // na de wijziging opnieuw bewezen
      if (r === rang(IMPACT, 'LEARNING_UPDATE')) {
        const bijgeleerd = Object.values(st.bewijs).some(b => b.persoon === persoon && b.vaardigheid === v && !b.ongeldig && ms(b.at) > ms(im.at));
        if (bijgeleerd) continue;
      }
      uit.push({ vaardigheid: v, kennis: im.kennis, versie: im.versie, klasse: im.klasse, sinds: im.at,
        waarom: 'kennis ' + im.kennis + ' ging naar versie ' + im.versie + ' (' + im.klasse + ') na uw laatste bewijs' });
    }
  }
  return uit;
}
const blokkeert = (item) => rang(IMPACT, item.klasse) >= rang(IMPACT, 'ASSESSMENT_REQUIRED');

/* De stand van een certificaat, elke keer opnieuw. */
function certStand(st, c, nu) {
  const laatst = c.gebeurd.slice().reverse().find(g => ['SUSPENDED', 'REVOKED', 'ACTIVE'].includes(g.naar));
  if (c.gebeurd.some(g => g.naar === 'REVOKED')) return { stand: 'REVOKED', reden: c.gebeurd.find(g => g.naar === 'REVOKED').reden };
  if (laatst && laatst.naar === 'SUSPENDED') return { stand: 'SUSPENDED', reden: laatst.reden };
  /* Een certificaat staat op geldig bewijs, of het staat niet (invariant
     NO_CERT_WITHOUT_VALID_EVIDENCE). Valt een beoordeling achteraf weg, dan valt
     het certificaat mee -- berekend, zonder dat iemand eraan hoeft te denken. */
  for (const bId of c.beoordelingen || []) {
    const b = st.beoordelingen[bId];
    if (!b || b.stand !== 'PROVEN') return { stand: 'SUSPENDED', reden: 'beoordeling ' + bId + ' draagt dit certificaat niet meer' };
  }
  if (c.geldigTot && nu > ms(c.geldigTot)) return { stand: 'EXPIRED', reden: 'geldig tot ' + c.geldigTot };
  /* Hercertificering hangt aan het CERTIFICAAT en niet aan de mens: een
     certificaat dat voor de wijziging is uitgegeven, blijft REFRESH_REQUIRED,
     ook als dezelfde mens later opnieuw bewijst -- dan krijgt hij een NIEUW
     certificaat en blijft het oude als historie staan. */
  const na = st.impacts.find(im => ms(im.at) > ms(c.at) && rang(IMPACT, im.klasse) >= rang(IMPACT, 'RECERTIFICATION_REQUIRED')
    && (im.vaardigheden || []).some(v => (c.vaardigheden || []).includes(v)));
  if (na) return { stand: 'REFRESH_REQUIRED', reden: 'kennis ' + na.kennis + ' ging na uitgifte naar versie ' + na.versie + ' (' + na.klasse + ')' };
  if (c.geldigTot && (ms(c.geldigTot) - nu) / DAG <= EXPIRING_DAGEN) return { stand: 'EXPIRING', reden: 'verloopt op ' + c.geldigTot };
  return { stand: 'ACTIVE', reden: null };
}
const certTelt = (s) => s === 'ACTIVE' || s === 'EXPIRING';

/* Is deze trainer NU bevoegd dit curriculum te geven? Hij moet gekwalificeerd
   zijn voor dit curriculum EN deze versie, een lopende relatie hebben, en bij
   zijn na de laatste kennisverandering die dit curriculum raakte. */
function trainerGeldig(st, trainer, curriculumId) {
  const t = st.trainers[trainer];
  const c = st.curricula[curriculumId];
  if (!c) return { ok: false, reden: 'onbekend curriculum' };
  if (!t) return { ok: false, reden: trainer + ' is geen gekwalificeerde trainer in deze organisatie' };
  if (!relatieActief(st, trainer)) return { ok: false, reden: trainer + ' heeft hier geen lopende relatie' };
  const q = (t.curricula || []).find(x => x.id === curriculumId);
  if (!q) return { ok: false, reden: trainer + ' is niet gekwalificeerd voor ' + curriculumId };
  if (q.versie !== c.versie) return { ok: false, reden: trainer + ' is gekwalificeerd voor versie ' + q.versie + ', het curriculum staat op ' + c.versie };
  const raakt = st.impacts.filter(im => (im.curricula || []).includes(curriculumId) && rang(IMPACT, im.klasse) > 0);
  const laatste = raakt.length ? raakt[raakt.length - 1] : null;
  if (laatste && ms(t.bijgewerkt) < ms(laatste.at))
    return { ok: false, reden: trainer + ' is nog niet bijgewerkt na kennis ' + laatste.kennis + ' versie ' + laatste.versie };
  return { ok: true, reden: null };
}

module.exports = { versheid, bewijsVoldoet, verversen, blokkeert, certStand, certTelt, trainerGeldig,
  heeftBestuur, relatieActief, DAG, ms };
