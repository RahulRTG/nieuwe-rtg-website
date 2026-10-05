/* ============================================================================
   HET LEERHUIS -- de projectie: van gebeurtenissen naar een stand.

   DE WAARHEID IS HET SPOOR, NIET DE STAND. Per organisatie staat er een
   gekettingde lijst gebeurtenissen (lib/keten.js); alles wat hieronder staat
   wordt bij elke vraag opnieuw uit dat spoor gerekend. Er is dus geen veld dat
   iemand kan bijwerken zonder dat er een gebeurtenis bij komt, en historie wordt
   nooit stil herschreven (grondwet 18): een intrekking is een NIEUWE regel.

   EEN ORGANISATIE, EEN SPOOR. Er is geen gedeelde lijst mensen, bewijzen of
   certificaten over organisaties heen. Een certificaat in organisatie A kan
   daarom structureel niet verwijzen naar bewijs uit B: de opzoeking bestaat niet
   (grondwet 16, NO_CROSS_TENANT_LEAK). Waar draagbaarheid gewenst is, loopt die
   via EVC in de ontvangende organisatie -- een mens beoordeelt, niets gaat vanzelf.

   Snelheid: een herhaling over het spoor is O(n) per vraag. Dat is voor V1 een
   bewuste keuze en geen schaalbewering; ACADEMY.md par. 9 zegt wat er gemeten
   is en wat niet.
   ========================================================================== */
'use strict';

const leeg = (org) => ({
  id: org, org: null, bestuur: {}, relaties: {}, eenheden: {}, rollen: {}, vaardigheden: {}, kennis: {}, curricula: {},
  personen: {}, trainers: {}, bewijs: {}, beoordelingen: {}, certificaten: {}, beleid: {}, voorstellen: {},
  scenarios: {}, impacts: [], startplannen: {}, werk: [], sleutels: {}, bezwaren: {}, evc: {}, loopReceipts: {}
});

function persoon(st, key) {
  if (!st.personen[key]) st.personen[key] = { rollen: [], leren: {}, bewezen: {}, verversd: {} };
  return st.personen[key];
}

/* Van oud naar nieuw toepassen. `regels` staat nieuwste-eerst, zoals lib/keten.js
   hem bewaart. */
function standUitSpoor(orgId, regels) {
  const st = leeg(orgId);
  const lijst = (regels || []).slice().reverse();
  for (const r of lijst) pas(st, r);
  return st;
}

function pas(st, r) {
  const d = r.data || {};
  if (r.sleutel) st.sleutels[r.sleutel] = r;
  switch (r.soort) {
    case 'org': st.org = { id: d.id, soort: d.soort, naam: d.naam, ouder: d.ouder || null, bron: d.bron || null, at: r.at }; break;
    case 'bestuur': {
      const b = st.bestuur[d.persoon] || (st.bestuur[d.persoon] = []);
      if (d.aan) { if (!b.includes(d.rol)) b.push(d.rol); } else st.bestuur[d.persoon] = b.filter(x => x !== d.rol);
      break;
    }
    case 'relatie': st.relaties[d.persoon] = { soort: d.soort, actief: d.actief !== false, sinds: r.at, eenheid: d.eenheid || null, manager: d.manager || null }; break;
    case 'eenheid': st.eenheden[d.id] = { id: d.id, soort: d.soort, naam: d.naam, ouder: d.ouder || null }; break;
    case 'rol': st.rollen[d.id] = { ...d, versie: ((st.rollen[d.id] || {}).versie || 0) + 1 }; break;
    case 'vaardigheid': st.vaardigheden[d.id] = { ...d, versie: ((st.vaardigheden[d.id] || {}).versie || 0) + 1 }; break;
    case 'kennisVersie': {
      const k = st.kennis[d.id] || (st.kennis[d.id] = { id: d.id, versies: {}, actief: null });
      k.versies[d.versie] = { ...d, stand: 'DRAFT', auteur: r.door, at: r.at, historie: [{ stand: 'DRAFT', door: r.door, at: r.at }] };
      break;
    }
    case 'kennisStand': {
      const k = st.kennis[d.id]; const v = k.versies[d.versie];
      v.stand = d.naar; v.historie.push({ stand: d.naar, door: r.door, at: r.at, reden: d.reden || null });
      if (d.bron) v.bron = d.bron;
      if (d.naar === 'ACTIVE') {
        if (k.actief && k.actief !== d.versie) {
          const oud = k.versies[k.actief]; oud.stand = 'DEPRECATED';
          oud.historie.push({ stand: 'DEPRECATED', door: r.door, at: r.at, reden: 'opgevolgd door versie ' + d.versie });
        }
        k.actief = d.versie; v.activeerder = r.door; v.actiefSinds = r.at;
      }
      if ((d.naar === 'REVOKED' || d.naar === 'DEPRECATED') && k.actief === d.versie) k.actief = null;
      break;
    }
    case 'curriculum': st.curricula[d.id] = { ...d, versie: ((st.curricula[d.id] || {}).versie || 0) + 1, stand: 'DRAFT', at: r.at }; break;
    case 'curriculumStand': st.curricula[d.id].stand = d.naar; break;
    case 'rolToegewezen': { const p = persoon(st, d.persoon); if (!p.rollen.includes(d.rol)) p.rollen.push(d.rol); break; }
    case 'rolIngetrokken': { const p = persoon(st, d.persoon); p.rollen = p.rollen.filter(x => x !== d.rol); break; }
    case 'leren': persoon(st, d.persoon).leren[d.curriculum] = { stand: 'ASSIGNED', versie: d.versie, reden: d.reden, trainer: (persoon(st, d.persoon).leren[d.curriculum] || {}).trainer || null, at: r.at, historie: [{ stand: 'ASSIGNED', at: r.at, door: r.door }] }; break;
    case 'lerenStand': { const l = persoon(st, d.persoon).leren[d.curriculum]; l.stand = d.naar; l.historie.push({ stand: d.naar, at: r.at, door: r.door }); break; }
    case 'trainerToegewezen': persoon(st, d.persoon).leren[d.curriculum].trainer = d.trainer; break;
    case 'trainer': st.trainers[d.persoon] = { trede: d.trede, curricula: d.curricula || [], door: r.door, at: r.at, bijgewerkt: r.at }; break;
    case 'trainerBijgewerkt': st.trainers[d.persoon].bijgewerkt = r.at; break;
    case 'trainerIngetrokken': delete st.trainers[d.persoon]; break;
    case 'scenario': st.scenarios[d.id] = { ...d, versie: ((st.scenarios[d.id] || {}).versie || 0) + 1 }; break;
    case 'bewijs': st.bewijs[d.id] = { ...d, door: r.door, at: r.at, org: st.org && st.org.id, integriteit: r.hash }; break;
    case 'bewijsOngeldig': st.bewijs[d.id].ongeldig = { door: r.door, at: r.at, reden: d.reden }; break;
    case 'beoordeling': st.beoordelingen[d.id] = { ...d, stand: 'REQUESTED', aanvrager: r.door, at: r.at }; break;
    case 'beoordelingStand': {
      const b = st.beoordelingen[d.id]; b.stand = d.naar;
      if (d.naar === 'ASSESSING') b.assessor = r.door;
      if (['PROVEN', 'NOT_YET_PROVEN', 'INCONCLUSIVE'].includes(d.naar)) {
        b.bewijs = d.bewijs || []; b.criteria = d.criteria || null; b.afgerond = r.at; b.herstel = d.herstel || null;
        if (d.naar === 'PROVEN') persoon(st, b.persoon).bewezen[b.vaardigheid] = { beoordeling: b.id, at: r.at, kennis: d.kennis || {} };
      }
      if (d.naar === 'INVALIDATED') {
        b.ongeldig = { door: r.door, at: r.at, reden: d.reden };
        const p = persoon(st, b.persoon);
        if (p.bewezen[b.vaardigheid] && p.bewezen[b.vaardigheid].beoordeling === b.id) delete p.bewezen[b.vaardigheid];
      }
      break;
    }
    case 'certificaat': st.certificaten[d.id] = { ...d, uitgegevenDoor: r.door, at: r.at, gebeurd: [] }; break;
    case 'certificaatStand': st.certificaten[d.id].gebeurd.push({ naar: d.naar, door: r.door, at: r.at, reden: d.reden }); break;
    case 'beleid': st.beleid[d.id] = { ...d, voorgesteldDoor: r.door, at: r.at, goedgekeurd: null, herzien: r.at }; break;
    case 'beleidGoedgekeurd': st.beleid[d.id].goedgekeurd = { door: r.door, at: r.at }; st.beleid[d.id].herzien = r.at; break;
    case 'werk': st.werk.push({ ...d, door: r.door, at: r.at }); break;
    case 'voorstel': st.voorstellen[d.id] = { ...d, stand: 'SUBMITTED', indiener: r.door, at: r.at, historie: [] }; break;
    case 'voorstelStand': { const v = st.voorstellen[d.id]; v.stand = d.naar; v.historie.push({ stand: d.naar, door: r.door, at: r.at, notitie: d.notitie || null }); if (d.kennisVersie) v.kennisVersie = d.kennisVersie; if (d.meting) v.meting = d.meting; break; }
    case 'loopChangeReceipt': st.loopReceipts[d.receiptId] = { ...d, door: r.door, at: r.at,
      integrityRef: { auditId: 'leerhuis:' + st.id + ':' + r.nr, hash: r.hash } }; break;
    case 'impact': st.impacts.push({ ...d, door: r.door, at: r.at }); break;
    case 'startplan': st.startplannen[d.persoon] = { ...d, at: r.at }; break;
    case 'bezwaar': st.bezwaren[d.id] = { ...d, stand: 'REVIEW_REQUEST', indiener: r.door, at: r.at }; break;
    case 'bezwaarStand': { const b = st.bezwaren[d.id]; b.stand = d.naar; if (d.naar === 'INDEPENDENT_REVIEW') b.reviewer = r.door; b.uitkomst = d.notitie || b.uitkomst; break; }
    case 'evc': st.evc[d.id] = { ...d, stand: 'CLAIM', at: r.at }; break;
    case 'evcStand': st.evc[d.id].stand = d.naar; break;
    default: break;   // een onbekende soort breekt de projectie niet; ./index.js schrijft er nooit een
  }
}

module.exports = { standUitSpoor, leeg };
