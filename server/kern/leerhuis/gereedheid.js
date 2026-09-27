/* ============================================================================
   HET LEERHUIS -- gereedheid: van een rol, van een team, van een eenheid.

   GEEN READY ZONDER GEMETEN EISEN (de opdracht, par. 37). Elke uitkomst noemt de
   eisen, wat er is, wat ontbreekt, wat verloopt en waarom -- en een rol die
   niet bestaat of geen vaardigheden kent, is BLOCKED en niet "vacuum waar".

   GEEN SCORE OP EEN MENS. Er wordt geteld wie een rol aantoonbaar KAN dragen;
   er wordt niet gerangschikt wie het "beste" is. Dezelfde grens als
   kern/beveiliging/rooster/aanvragen.js en CARRIERE.md par. 4.1.

   EIGEN MENSEN EN GASTEN. Een eenheid die haar trainers of assessoren leent,
   kan het volgende cohort niet zelf opleiden. Wie hier via een relatie van soort
   PARTNER of PROJECT staat, telt als gast: bruikbaar, maar niet als bewijs dat
   de eenheid zichzelf in stand houdt (grondwet 20, par. 15).
   ========================================================================== */
'use strict';

const { verversen, blokkeert, certStand, certTelt, trainerGeldig, heeftBestuur, relatieActief, versheid } = require('./oordeel');

const GAST = ['PARTNER', 'PROJECT'];
const LEIDING = ['EXECUTIVE', 'MANAGEMENT'];
const VAK = ['OPERATIONS', 'PROFESSIONAL', 'EXPERT', 'TECHNICAL', 'BUSINESS', 'SUPPLIER', 'FOUNDATION', 'VOLUNTEER'];

function rolKlaar(st, persoon, rolId, nu) {
  const rol = st.rollen[rolId];
  if (!rol) return { klaar: false, ontbreekt: ['rol ' + rolId + ' bestaat niet'], verloopt: [] };
  if (!(rol.vaardigheden || []).length) return { klaar: false, ontbreekt: ['rol ' + rolId + ' noemt geen vaardigheden; zonder eisen geen gereedheid'], verloopt: [] };
  const ontbreekt = []; const verloopt = [];
  if (!relatieActief(st, persoon)) ontbreekt.push('geen lopende relatie');
  const p = st.personen[persoon] || { bewezen: {} };
  const open = verversen(st, persoon, nu);
  for (const v of rol.vaardigheden) {
    if (!p.bewezen[v]) { ontbreekt.push(v + ' is niet bewezen'); continue; }
    const o = open.find(x => x.vaardigheid === v);
    if (o && blokkeert(o)) ontbreekt.push(o.waarom);
    else if (o) verloopt.push(o.waarom);
    const bew = Object.values(st.bewijs).filter(b => b.persoon === persoon && b.vaardigheid === v && !b.ongeldig);
    if (bew.length && bew.every(b => versheid(st, b, nu) !== 'CURRENT')) verloopt.push('het bewijs voor ' + v + ' veroudert');
  }
  for (const v of rol.certificaten || []) {
    const cs = Object.values(st.certificaten).filter(c => c.persoon === persoon && (c.vaardigheden || []).includes(v))
      .map(c => certStand(st, c, nu).stand);
    if (!cs.some(certTelt)) ontbreekt.push('geen geldig certificaat voor ' + v);
    else if (!cs.includes('ACTIVE')) verloopt.push('het certificaat voor ' + v + ' verloopt');
  }
  return { klaar: ontbreekt.length === 0, ontbreekt, verloopt };
}

/* Workforce readiness: eisen als { rolId: aantal }. */
function gereedheid(st, eisen, nu) {
  const regels = [];
  for (const [rolId, aantal] of Object.entries(eisen || {})) {
    const dragers = Object.entries(st.personen).filter(([, p]) => p.rollen.includes(rolId)).map(([k]) => k);
    const vervuld = []; const verloopt = []; const geblokkeerd = [];
    for (const k of dragers) {
      const r = rolKlaar(st, k, rolId, nu);
      if (r.klaar) { vervuld.push(k); if (r.verloopt.length) verloopt.push({ persoon: k, waarom: r.verloopt }); }
      else geblokkeerd.push({ persoon: k, waarom: r.ontbreekt });
    }
    regels.push({ rol: rolId, bestaat: !!st.rollen[rolId], eis: aantal, vervuld: vervuld.length,
      ontbreekt: Math.max(0, aantal - vervuld.length), verloopt, geblokkeerd,
      bron: 'rol ' + rolId + (st.rollen[rolId] ? ' versie ' + st.rollen[rolId].versie : ' (onbekend)') });
  }
  const tekort = regels.filter(r => !r.bestaat || r.ontbreekt > 0);
  /* Conditioneel: de eis wordt gehaald, maar alleen met mensen van wie iets
     verloopt -- zonder hen zakt het aantal onder de eis. */
  const wankel = regels.filter(r => r.ontbreekt === 0 && r.vervuld - r.verloopt.length < r.eis);
  const stand = !regels.length ? 'BLOCKED' : tekort.length ? 'BLOCKED' : wankel.length ? 'CONDITIONAL' : 'READY';
  return { stand, regels, waarom: !regels.length ? 'er zijn geen eisen opgegeven' :
    tekort.length ? tekort.map(r => r.rol + ': ' + (r.bestaat ? r.ontbreekt + ' te weinig' : 'rol bestaat niet')).join('; ') :
      wankel.length ? wankel.map(r => r.rol + ': gehaald met mensen van wie iets verloopt').join('; ') : 'alle eisen gehaald' };
}

/* Houdt deze eenheid zichzelf in stand? */
function eenheid(st, nu) {
  const gast = (k) => st.relaties[k] && GAST.includes(st.relaties[k].soort);
  const klaarIn = (soorten) => Object.entries(st.personen).filter(([k, p]) =>
    p.rollen.some(r => st.rollen[r] && soorten.includes(st.rollen[r].soort) && rolKlaar(st, k, r, nu).klaar)).map(([k]) => k);
  const actieveCurricula = Object.values(st.curricula).filter(c => c.stand === 'ACTIVE' || c.stand === 'MONITORED');
  const trainers = Object.keys(st.trainers).filter(k => actieveCurricula.some(c => trainerGeldig(st, k, c.id).ok));
  const assessoren = Object.keys(st.bestuur).filter(k => heeftBestuur(st, k, 'ASSESSOR') && relatieActief(st, k));
  const kennis = Object.keys(st.bestuur).filter(k => heeftBestuur(st, k, 'KNOWLEDGE_OWNER') && relatieActief(st, k));
  const bestuur = Object.keys(st.bestuur).filter(k => heeftBestuur(st, k, 'ACADEMY_OWNER') && relatieActief(st, k));
  const groepen = { leiding: klaarIn(LEIDING), vakmensen: klaarIn(VAK), trainers, assessoren, kennis, bestuur };
  const regels = Object.entries(groepen).map(([naam, lijst]) => ({ naam, totaal: lijst.length,
    eigen: lijst.filter(k => !gast(k)).length, gasten: lijst.filter(gast).length }));
  /* Onafhankelijkheid: een kritieke beoordeling mag niet alleen bij de trainer
     liggen, dus er moet een eigen assessor zijn die geen trainer is. */
  const onafhankelijk = assessoren.some(k => !gast(k) && !trainers.includes(k));
  const busfactor = actieveCurricula.map(c => ({ curriculum: c.id,
    trainers: trainers.filter(k => trainerGeldig(st, k, c.id).ok).length }));
  const risico = busfactor.filter(b => b.trainers <= 1).map(b => ({ soort: 'opvolging', curriculum: b.curriculum,
    waarom: b.trainers ? 'maar een trainer: valt hij weg, dan stopt dit curriculum' : 'geen geldige trainer' }));
  const nul = regels.filter(r => r.totaal === 0);
  const geleend = regels.filter(r => r.totaal > 0 && r.eigen === 0);
  const stand = nul.length ? 'BLOCKED' : (geleend.length || !onafhankelijk) ? 'DEPENDENT' : 'SELF_SUSTAINING';
  return { stand, regels, onafhankelijkeAssessor: onafhankelijk, busfactor, risico,
    waarom: nul.length ? 'ontbreekt: ' + nul.map(r => r.naam).join(', ')
      : geleend.length ? 'alleen geleend: ' + geleend.map(r => r.naam).join(', ')
        : !onafhankelijk ? 'geen eigen assessor die niet ook trainer is'
          : 'leiding, vakmensen, trainers, assessoren, kennis en bestuur zijn eigen mensen' };
}

/* Loopbaan: hoe dicht staat iemand bij een volgende rol? Promotie blijft een
   menselijk besluit; dit zegt alleen wat er nog ontbreekt. */
function loopbaan(st, persoon, rolId, nu) {
  if (!relatieActief(st, persoon)) return { stand: 'NOT_ELIGIBLE', waarom: ['geen lopende relatie'], besluit: 'mens' };
  const r = rolKlaar(st, persoon, rolId, nu);
  if (r.klaar) return { stand: 'READY', waarom: [], besluit: 'mens' };
  const stand = r.ontbreekt.length <= 1 ? 'NEARLY_READY' : 'DEVELOPING';
  return { stand, waarom: r.ontbreekt, besluit: 'mens' };
}

module.exports = { rolKlaar, gereedheid, eenheid, loopbaan };
