'use strict';
/* ============================================================================
   DE WERELD VAN DE LEERHUISPROEF -- een leerhuis in het geheugen, met een klok
   die de proef zelf verzet.

   Geen server en geen database: de proef gaat over de REGELS van de lus
   (./../../server/kern/leerhuis), en die hebben alleen `db.data` en `save`
   nodig. Dat is een grens van dit bewijs en die staat in de uitslag
   (de opdracht, par. 34): of een HTTP-route de actor uit de sessie haalt, bewijst
   deze wereld niet.

   `doe` gooit bij een weigering, zodat een proef die een ja verwacht nooit stil
   een nee inslikt; `probeer` geeft de weigering terug, voor storingen.
   ========================================================================== */
const { maakLeerhuis } = require('../../server/kern/leerhuis');

const BEGIN = Date.parse('2026-09-27T09:00:00Z');
const MINUUT = 60000;
const DAG = 86400000;

function maakWereld() {
  let tijd = BEGIN;
  const db = { data: {} };
  let saves = 0;
  const lh = maakLeerhuis({ db, save: () => { saves++; }, nu: () => tijd });
  function probeer(org, actie, invoer, door, opties) {
    tijd += MINUUT;
    return lh.doe(org, actie, invoer, door, opties);
  }
  function doe(org, actie, invoer, door, opties) {
    const r = probeer(org, actie, invoer, door, opties);
    if (!r.ok) throw new Error(actie + ' door ' + door + ' geweigerd (' + r.status + '): ' + r.reden);
    return r;
  }
  return { lh, db, doe, probeer, verzet: (dagen) => { tijd += dagen * DAG; }, nu: () => tijd, saves: () => saves };
}

/* Een organisatie met gescheiden bestuursrollen: eigenaar, twee
   kenniseigenaren, een curriculumeigenaar, een kwaliteitsmens, een assessor. */
function richtIn(w, org, soort, p) {
  const e = p.eigenaar;
  w.doe(org, 'orgOpen', { id: org, soort, naam: org, eigenaar: e }, e);
  for (const [k, rel] of Object.entries(p.relaties || {})) w.doe(org, 'relatieZet', { persoon: k, ...rel }, e);
  for (const [k, rollen] of Object.entries(p.bestuur || {})) for (const r of rollen) w.doe(org, 'bestuurZet', { persoon: k, rol: r }, e);
}

/* Een organisatie krijgt haar eigen kennis, vaardigheden, rollen, curriculum en
   scenario's: er is geen gedeelde definitie over organisaties heen (grondwet 16).
   `co` schrijft (CURRICULUM_OWNER), `ko` keurt goed (KNOWLEDGE_OWNER). */
function definieer(w, org, co, ko) {
  const doe = (a, i, door) => w.doe(org, a, i, door);
  const [CO, KO] = [co, ko];
  doe('kennisSchrijf', { id: 'terugboeken', domein: 'betalingen', titel: 'Een betaling terugboeken', tekst: 'Controleer de oorspronkelijke betaling, leg de reden vast, laat een tweede mens tekenen boven 500 euro.', bron: 'GELD.md par. 3' }, CO);
  doe('kennisStand', { id: 'terugboeken', versie: 1, naar: 'REVIEW' }, CO);
  doe('kennisSchrijf', { id: 'lesgeven', domein: 'academy', titel: 'Voordoen, laten doen, observeren', tekst: 'Een trainer laat zien, laat oefenen, observeert en legt bewijs vast; hij beoordeelt niet zelf.', bron: 'de opdracht, par. 13' }, CO);
  doe('kennisStand', { id: 'lesgeven', versie: 1, naar: 'REVIEW' }, CO);
  doe('kennisStand', { id: 'terugboeken', versie: 1, naar: 'ACTIVE' }, KO);
  doe('kennisStand', { id: 'lesgeven', versie: 1, naar: 'ACTIVE' }, KO);
  doe('vaardigheidZet', { id: 'terugboeken', naam: 'Een betaling terugboeken', niveau: 'PRACTITIONER', kritiek: true, kennis: ['terugboeken'],
    bewijsEis: { sterkte: 'OBSERVED', soorten: ['SIMULATION_EVIDENCE', 'OBSERVATION_EVIDENCE'] }, geldigDagen: 365, hercertificering: 'EVENT_DRIVEN' }, CO);
  doe('vaardigheidZet', { id: 'didactiek', naam: 'Train-the-Trainer', niveau: 'ADVANCED', kritiek: true, trainerschap: true, kennis: ['lesgeven'],
    bewijsEis: { sterkte: 'OBSERVED', soorten: ['TRAINER_EVIDENCE', 'SIMULATION_EVIDENCE'] } }, CO);
  doe('rolZet', { id: 'ops', titel: 'Operations Professional', soort: 'OPERATIONS', vaardigheden: ['terugboeken'], certificaten: ['terugboeken'],
    grenzen: ['boven 500 euro tekent een tweede mens'], opvolgers: ['ops-trainer'] }, CO);
  doe('rolZet', { id: 'ops-trainer', titel: 'Operations Trainer', soort: 'TRAINER', vaardigheden: ['terugboeken', 'didactiek'] }, CO);
  const fasen = ['UNDERSTAND', 'OBSERVE', 'PRACTICE', 'SIMULATE', 'SUPERVISED_WORK', 'PROVE', 'CERTIFY', 'REFRESH'].map(f => ({ fase: f, wat: f.toLowerCase() + ': terugboeken' }));
  doe('curriculumZet', { id: 'ops-basis', titel: 'Terugboeken', vaardigheden: ['terugboeken'], kennis: ['terugboeken'], fasen }, CO);
  doe('curriculumStand', { id: 'ops-basis', naar: 'REVIEW' }, CO);
  doe('curriculumStand', { id: 'ops-basis', naar: 'ACTIVE' }, CO);
  doe('scenarioZet', { id: 'storno', domein: 'betalingen', vaardigheden: ['terugboeken'], vereist: ['controleer', 'reden', 'tweede-mens'], verboden: ['direct-uitbetalen'], volgorde: true }, CO);
  doe('scenarioZet', { id: 'lesdemo', domein: 'academy', vaardigheden: ['didactiek'], vereist: ['voordoen', 'laten-doen', 'observeren'], verboden: ['zelf-beoordelen'] }, CO);
}

/* Snelle wegen voor toetsen die een wereld NA een stap nodig hebben. De proef
   zelf loopt elke stap uit; deze helpers doen hetzelfde in minder regels. */
const alleBewijs = (w, org, p, v) => Object.values(w.lh.stand(org).bewijs)
  .filter(b => b.persoon === p && b.vaardigheid === v && !b.ongeldig).map(b => b.id);

function bewijs(w, org, p, v, door, sim, stappen) {
  w.doe(org, 'simulatieAfronden', { scenario: sim, keuzes: stappen }, p);
  const soort = v === 'didactiek' ? 'TRAINER_EVIDENCE' : 'OBSERVATION_EVIDENCE';
  w.doe(org, 'bewijsVastleggen', { persoon: p, vaardigheid: v, soort, sterkte: 'OBSERVED', bron: 'toets' }, door);
}
const STORNO = ['controleer', 'reden', 'tweede-mens'];
const LES = ['voordoen', 'laten-doen', 'observeren'];

function beoordeel(w, org, p, v, a, aanvrager) {
  const b = w.doe(org, 'beoordelingAanvragen', { persoon: p, vaardigheid: v }, aanvrager || p).id;
  w.doe(org, 'beoordelingStart', { id: b }, a);
  w.doe(org, 'beoordelingAfronden', { id: b, uitkomst: 'PROVEN', bewijs: alleBewijs(w, org, p, v), criteria: 'gezien' }, a);
  return b;
}

/* Een ervaren mens wordt de eerste trainer: bewijs, beoordeling, certificaat,
   dan Train-the-Trainer. `r` = { A: assessor, Q: trainer- en certificaatautoriteit }. */
function kwalificeerTrainer(w, org, t, r) {
  bewijs(w, org, t, 'terugboeken', r.A, 'storno', STORNO);
  const b1 = beoordeel(w, org, t, 'terugboeken', r.A);
  w.doe(org, 'certificaatUitgeven', { persoon: t, vaardigheden: ['terugboeken'], beoordelingen: [b1], geldigDagen: 365 }, r.Q);
  bewijs(w, org, t, 'didactiek', r.A, 'lesdemo', LES);
  const b2 = beoordeel(w, org, t, 'didactiek', r.A);
  w.doe(org, 'certificaatUitgeven', { persoon: t, vaardigheden: ['didactiek'], beoordelingen: [b2] }, r.Q);
  w.doe(org, 'trainerKwalificeer', { persoon: t, trede: 'CERTIFIED_TRAINER', curricula: ['ops-basis'] }, r.Q);
}

/* Een leerling van rol tot certificaat, met trainer `r.T`. Geeft de ids terug. */
function leidOp(w, org, n, r) {
  const stap = (naar, door) => w.doe(org, 'lerenStand', { persoon: n, curriculum: 'ops-basis', naar }, door);
  w.doe(org, 'rolToewijzen', { persoon: n, rol: 'ops' }, r.M);
  w.doe(org, 'startplanMaak', { persoon: n, rol: 'ops' }, r.M);
  const l = w.lh.stand(org).personen[n].leren['ops-basis'];
  if (l.trainer !== r.T) w.doe(org, 'trainerToewijzen', { persoon: n, curriculum: 'ops-basis', trainer: r.T }, r.Q);
  stap('LEARNING', n); stap('PRACTICING', n);
  w.doe(org, 'simulatieAfronden', { scenario: 'storno', keuzes: STORNO }, n);
  stap('SIMULATING', n); stap('SUPERVISED', r.T);
  w.doe(org, 'bewijsVastleggen', { persoon: n, vaardigheid: 'terugboeken', soort: 'OBSERVATION_EVIDENCE', sterkte: 'OBSERVED', bron: 'toets' }, r.T);
  stap('READY_FOR_ASSESSMENT', r.T);
  const b = beoordeel(w, org, n, 'terugboeken', r.A);
  const c = w.doe(org, 'certificaatUitgeven', { persoon: n, vaardigheden: ['terugboeken'], beoordelingen: [b], geldigDagen: 365 }, r.Q).id;
  return { beoordeling: b, certificaat: c };
}

module.exports = { maakWereld, richtIn, definieer, alleBewijs, bewijs, beoordeel, kwalificeerTrainer, leidOp, STORNO, LES, BEGIN, DAG };
