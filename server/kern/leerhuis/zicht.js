/* ============================================================================
   HET LEERHUIS -- wat een mens ziet: My Academy, de vakstaat, en de cockpits
   van trainer en manager.

   Elke stand draagt WAT / WAAROM / VOLGENDE_STAP (de opdracht, par. 26). Een getal
   zonder uitleg komt hier niet voor, en een voortgangspercentage evenmin: wat
   telt is welke vaardigheid bewezen is, niet hoeveel procent van een cursus is
   aangeklikt.

   MINSTE KENNIS PER LEZER (grondwet 21). Een trainer ziet van zijn leerling
   alleen het leerpad dat hij geeft; een manager ziet of zijn mensen gereed zijn
   en WAT er ontbreekt, maar niet de criteria of het bewijs van een beoordeling.
   Wat een lezer niet ziet, staat er als `nietZichtbaar` bij, met de reden.

   De vakstaat heet niet "Skills Passport": `paspoort` is bezet (207 bestanden,
   ARBEID.md par. 6.1 punt 140). Hij is een projectie en geen tweede dossier.
   ========================================================================== */
'use strict';

const { verversen, certStand, versheid, trainerGeldig } = require('./oordeel');
const { rolKlaar, loopbaan } = require('./gereedheid');
const { LEERBEWIJS } = require('./standen');

const VOLGENDE_STAP = {
  ASSIGNED: 'begin met lezen en kijken (UNDERSTAND, OBSERVE)', LEARNING: 'ga oefenen in de zandbak', PRACTICING: 'speel een scenario',
  SIMULATING: 'werk een keer onder toezicht van je trainer', SUPERVISED: 'je trainer bevestigt dat je klaar bent voor beoordeling',
  READY_FOR_ASSESSMENT: 'vraag een beoordeling aan', ASSESSING: 'een onafhankelijke assessor beoordeelt je',
  NOT_YET_PROVEN: 'volg het herstelpad uit je beoordeling', PROVEN: 'een certificaat kan worden uitgegeven waar dat vereist is',
  CERTIFIED: 'bevoegdheid is een apart besluit; zie je mijlpalen', AUTHORITY_ELIGIBLE: 'je mag het werk doen dat het beleid noemt',
  PRACTICING_IN_ROLE: 'je werkt zelfstandig; bij een kennisverandering hoor je het hier'
};

function vakstaat(st, persoon, nu) {
  const p = st.personen[persoon] || { rollen: [], bewezen: {} };
  const bewijzen = Object.values(st.bewijs).filter(b => b.persoon === persoon && !b.ongeldig);
  return {
    persoon, organisatie: st.org && st.org.id, rollen: p.rollen,
    vaardigheden: Object.entries(p.bewezen).map(([v, x]) => {
      const eigen = bewijzen.filter(b => b.vaardigheid === v);
      const vers = eigen.map(b => versheid(st, b, nu));
      return { vaardigheid: v, naam: (st.vaardigheden[v] || {}).naam, niveau: (st.vaardigheden[v] || {}).niveau,
        sinds: x.at, beoordeling: x.beoordeling, draagbaar: (st.vaardigheden[v] || {}).draagbaar,
        versheid: vers.includes('CURRENT') ? 'CURRENT' : vers.includes('AGING') ? 'AGING' : 'STALE' };
    }),
    certificaten: Object.values(st.certificaten).filter(c => c.persoon === persoon)
      .map(c => ({ id: c.id, vaardigheden: c.vaardigheden, geldigTot: c.geldigTot, ...certStand(st, c, nu) })),
    trainer: st.trainers[persoon] ? { trede: st.trainers[persoon].trede, curricula: st.trainers[persoon].curricula } : null,
    bestuur: st.bestuur[persoon] || [],
    verversen: verversen(st, persoon, nu)
  };
}

function mijn(st, persoon, nu) {
  const p = st.personen[persoon] || { rollen: [], leren: {}, bewezen: {} };
  const loopt = (v) => Object.values(st.beoordelingen).some(b => b.persoon === persoon && b.vaardigheid === v && ['REQUESTED', 'ASSESSING'].includes(b.stand));
  const pad = Object.entries(p.leren).map(([c, l]) => ({ curriculum: c, titel: (st.curricula[c] || {}).titel, stand: l.stand,
    wat: 'leerpad ' + c + ' staat op ' + l.stand, waarom: l.reden, volgende: VOLGENDE_STAP[l.stand] || null, trainer: l.trainer,
    vaardigheden: ((st.curricula[c] || {}).vaardigheden || []).map(v => ({ id: v, naam: (st.vaardigheden[v] || {}).naam || v, loopt: loopt(v) })) }));
  const ververs = verversen(st, persoon, nu).map(x => ({ wat: 'verversen: ' + x.vaardigheid, waarom: x.waarom,
    volgende: x.klasse === 'LEARNING_UPDATE' ? 'lees de nieuwe versie en leg dat vast' : 'opnieuw bewijzen' }));
  const lopend = new Set(Object.keys(p.leren).flatMap(c => (st.curricula[c] || { vaardigheden: [] }).vaardigheden));
  const opvolgers = p.rollen.flatMap(r => (st.rollen[r] || {}).opvolgers || []);
  return {
    /* De eigen sleutel: de leerling zet er zijn eigen stappen mee (lerenStand noemt de persoon). */
    IK: persoon,
    VANDAAG: ververs.concat(pad.filter(x => !['PRACTICING_IN_ROLE', 'AUTHORITY_ELIGIBLE'].includes(x.stand)).slice(0, 3)),
    PAD: pad,
    OEFENEN: Object.values(st.scenarios).filter(s => s.vaardigheden.some(v => lopend.has(v)))
      /* De stappen staan er door elkaar en op alfabet: welke vereist en welke verboden
         zijn, zegt de motor pas na het spelen (acties-simulatie.js). */
      .map(s => ({ scenario: s.id, domein: s.domein, moeilijkheid: s.moeilijkheid, wat: 'oefenen zonder gevolgen in productie',
        begin: s.begin || null, stappen: [...new Set(s.vereist.concat(s.verboden))].sort() })),
    VAARDIGHEDEN: vakstaat(st, persoon, nu),
    GROEI: opvolgers.map(r => ({ rol: r, ...loopbaan(st, persoon, r, nu) })),
    COACH: { wat: 'vragen over officiele kennis', grond: 'alleen ACTIVE kennis; zonder bron is het antwoord ONBEKEND' }
  };
}

/* Per sessie: doel, waarom, wat te laten zien en wat te zien. */
function sessie(st, curriculumId) {
  const c = st.curricula[curriculumId];
  const vs = c.vaardigheden.map(v => st.vaardigheden[v]).filter(Boolean);
  const rollen = Object.values(st.rollen).filter(r => r.vaardigheden.some(v => c.vaardigheden.includes(v)));
  const scen = Object.values(st.scenarios).filter(s => s.vaardigheden.some(v => c.vaardigheden.includes(v)));
  const fase = (n) => (c.fasen || []).filter(f => f.fase === n).map(f => f.wat);
  return { DOEL: vs.map(v => v.naam + ' (' + v.niveau + ')'), WAAROM: rollen.map(r => 'rol ' + r.titel + ' vraagt dit'),
    DEMONSTRATIE: fase('OBSERVE'), OEFENEN: fase('PRACTICE').concat(scen.map(s => 'scenario ' + s.id)),
    VRAGEN: fase('UNDERSTAND'), VEELGEMAAKTE_FOUTEN: scen.flatMap(s => s.verboden),
    GRENZEN: rollen.flatMap(r => r.grenzen || []),
    TE_ZIEN_BEWIJS: vs.map(v => v.id + ': ' + (v.bewijsEis.soorten.join(', ') || 'bewijs') + ', minstens ' + v.bewijsEis.sterkte) };
}

function trainerCockpit(st, trainer) {
  const t = st.trainers[trainer];
  if (!t) return { ok: false, reden: trainer + ' is geen trainer in deze organisatie' };
  const leerlingen = [];
  /* Alleen OF er een beoordeling loopt, niet de uitslag of de criteria. */
  const lopend = (k, v) => Object.values(st.beoordelingen).some(b => b.persoon === k && b.vaardigheid === v && ['REQUESTED', 'ASSESSING'].includes(b.stand));
  for (const [k, p] of Object.entries(st.personen))
    for (const [c, l] of Object.entries(p.leren)) if (l.trainer === trainer) leerlingen.push({ persoon: k, curriculum: c, stand: l.stand, volgende: VOLGENDE_STAP[l.stand] || null,
      vaardigheden: ((st.curricula[c] || {}).vaardigheden || []).map(v => ({ id: v, naam: (st.vaardigheden[v] || {}).naam || v, loopt: lopend(k, v) })) });
  /* Soorten en sterktes komen mee, zodat het scherm geen eigen kopie draagt; of
     een trainer ze MAG zetten, zegt bewijsVastleggen (acties-oordeel.js). */
  return { ok: true, trede: t.trede, bewijsSoorten: LEERBEWIJS, sterktes: ['OBSERVED', 'DOCUMENTED'],
    VANDAAG: leerlingen.filter(x => ['SIMULATING', 'SUPERVISED'].includes(x.stand)),
    LEERLINGEN: leerlingen,
    SESSIES: t.curricula.map(c => ({ curriculum: c.id, geldig: trainerGeldig(st, trainer, c.id), gids: st.curricula[c.id] ? sessie(st, c.id) : null })),
    nietZichtbaar: 'beoordelingscriteria, bewijs van andere trainers en alles buiten de curricula die u geeft' };
}

function managerCockpit(st, manager, nu) {
  const team = Object.entries(st.relaties).filter(([, r]) => r.manager === manager && r.actief).map(([k]) => k);
  /* De rollen van de organisatie komen mee om toe te wijzen; `plan` zegt voor welke rol er een startplan ligt. */
  return { ROLLEN: Object.values(st.rollen).map(r => ({ id: r.id, titel: r.titel })),
    TEAM: team.map(k => ({ persoon: k, rollen: (st.personen[k] || { rollen: [] }).rollen, plan: (st.startplannen[k] || {}).rol || null,
    gereed: ((st.personen[k] || { rollen: [] }).rollen).map(r => { const x = rolKlaar(st, k, r, nu); return { rol: r, klaar: x.klaar, ontbreekt: x.ontbreekt, verloopt: x.verloopt }; }) })),
  nietZichtbaar: 'criteria, bewijs en uitslagen van beoordelingen; er is geen productiviteits-, loyaliteits- of persoonlijkheidsscore, en die komt er niet' };
}

module.exports = { vakstaat, mijn, sessie, trainerCockpit, managerCockpit, VOLGENDE_STAP };
