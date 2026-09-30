#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE LEERHUISPROEF -- LOOP_COMPLETENESS_CHECK van RTG Academy.

   de opdracht, par. 38 eist dat een kritieke vaardigheid de hele keten
   machineleesbaar en menselijk uitlegbaar bewijst:

     NEED -> ROLE -> KNOWLEDGE -> COMPETENCY -> CURRICULUM -> QUALIFIED TRAINER
     -> TRAINEE -> PRACTICE -> SIMULATION -> SUPERVISED WORK -> EVIDENCE
     -> ASSESSMENT -> CERTIFICATION -> AUTHORITY ELIGIBILITY -> AUTHORITY POLICY
     -> REAL WORK -> FEEDBACK -> IMPROVEMENT -> KNOWLEDGE CHANGE -> IMPACT
     -> TRAINER UPDATE -> EMPLOYEE REFRESH -> NEXT TRAINER -> NEXT TRAINEE

   Elke schakel wordt gemeten bij de ONTVANGER (de vorm van scripts/tafelproef.js:
   handelt A, en ziet B dat?) -- niet aan het antwoord van wie handelde. Een
   schakel zonder eigen waarneming kan niet zakken en telt dus niet.

   TWEE UITSLAGEN DIE NOOIT WORDEN OPGETELD.
     LOOP_COMPLETENESS  sluit de lus in de REGELS van het leerhuis? (deze proef)
     ACADEMY_STATUS     is de Academy klaar voor productie? Dat is strenger:
                        een gesloten lus zonder HTTP-deur, zonder scherm en
                        zonder domeinpoort die de geschiktheid leest, is
                        BLOCKED -- met die blokkades bij naam.
   Een groene lus met een BLOCKED status is geen tegenspraak maar precies de
   eerlijke stand (LAT-regel 17: een poort bewijst alleen zijn eigen bereik).

   GRENS. Geen server, geen HTTP, geen browser: de proef gaat over de regels.
   Dat de actor uit een sessie komt, dat een route de juiste deur draagt en dat
   het spoor een herstart overleeft, bewijst dit NIET.

   Draaien:  npm run leerhuisproef          (print; zakt op een open schakel)
             node scripts/leerhuisproef.js --json
   ============================================================================ */
const { maakWereld, richtIn, definieer } = require('./lib/leerhuiswereld');

const MIN_SCHAKELS = 24;
const ORG = 'RTG-OPS';
const [E, KO, CO, Q, A, T, M, N, N2] = ['lid:1', 'lid:2', 'lid:4', 'lid:5', 'lid:6', 'lid:7', 'lid:8', 'lid:9', 'lid:10'];

/* De P0-blokkades van de opdracht, par. 37, elk met waar hij gesloten wordt.
   Hij staat hier als DATA zodat de status niet los van het document kan lopen:
   test/leerhuis-lus.test.js zakt als ACADEMY.md een blokkade niet noemt. */
const BLOKKADES = [
  { id: 'UI', klasse: 'UX', wat: 'Mijn leerhuis en het werkscherm staan (/apps/leerhuis.html, /apps/leerhuis-werk.html: toezicht bevestigen, bewijs vastleggen, een beoordeling aanvragen, beoordelen, kennis activeren, een rol toewijzen, een startplan maken, een curriculum activeren, relaties en bestuursrollen op codenaam, kennis, vaardigheden, rollen, curricula en scenario\'s schrijven, certificaten, trainers kwalificeren en toewijzen, de eigen stappen van de leerling, een rol intrekken en uit dienst, bezwaren behandelen, ongeldig verklaren en beleid, bezwaar en EVC, bewijs intrekken, werk vastleggen: 33 van de 37 handelingen); voorstellen en eenheden hebben nog geen scherm', sluit: 'fase B-UI: het bestuurswerk' },
  { id: 'DOMEINPOORT', klasse: 'AUTHORITY', wat: 'een RTG-handeling (de factuurcorrectie) leest de geschiktheid mee, maar alleen in de schaduw: geschiktheid verandert nog nergens een recht', sluit: 'afdwingen als de schaduw rijp is en nul keer oneens staat (een volgend besluit na B1)' },
  { id: 'IDENTITEIT', klasse: 'TENANT_ISOLATION', wat: 'entiteit, zaak en RTF-stad zijn een bron, maar RTG zelf heeft nog geen entiteit: juist het leerhuis van RTG Operations draait nog op een verklaring', sluit: 'RTG als entiteit in RTG Concern (de eigenaar)' }
];

function meet() {
  const w = maakWereld();
  const lees = w.lh.lees;
  const schakels = []; const storingen = [];
  const ids = {};
  function schakel(naar, wat, fn) {
    const nr = schakels.length + 1;
    try { const ziet = fn(); schakels.push({ nr, naar, wat, stand: ziet ? 'gesloten' : 'open', ziet: ziet || null }); }
    catch (e) { schakels.push({ nr, naar, wat, stand: 'stuk', fout: e.message }); }
  }
  function storing(naam, belofte, fn) {
    try { const r = fn(); storingen.push({ naam, belofte, stand: r ? 'gehouden' : 'gebroken', wat: r || null }); }
    catch (e) { storingen.push({ naam, belofte, stand: 'gebroken', wat: e.message }); }
  }
  const doe = (a, i, door) => w.doe(ORG, a, i, door);
  const probeer = (a, i, door) => w.probeer(ORG, a, i, door);
  const pad = (p, c) => (lees.mijn(ORG, p).PAD.find(x => x.curriculum === c) || {}).stand;
  const vers = (p, c, stappen) => { for (const [s, door] of stappen) doe('lerenStand', { persoon: p, curriculum: c, naar: s }, door); };

  richtIn(w, ORG, 'RTG', { eigenaar: E,
    relaties: { [KO]: { soort: 'EMPLOYEE' }, [CO]: { soort: 'EMPLOYEE' }, [Q]: { soort: 'EMPLOYEE' }, [A]: { soort: 'EMPLOYEE' },
      [T]: { soort: 'EMPLOYEE', manager: M }, [M]: { soort: 'EMPLOYEE' } },
    bestuur: { [KO]: ['KNOWLEDGE_OWNER'], [CO]: ['CURRICULUM_OWNER'], [Q]: ['TRAINER_AUTHORITY', 'ASSESSMENT_AUTHORITY', 'QUALITY_AUTHORITY'], [A]: ['ASSESSOR'] } });

  definieer(w, ORG, CO, KO);

  schakel('NEED', 'een behoefte aan een operationsmens is BLOCKED zolang niemand hem kan dragen', () => {
    const g = lees.gereedheid(ORG, { ops: 1 });
    return g.stand === 'BLOCKED' && g.regels[0].ontbreekt === 1 && g.waarom;
  });
  schakel('ROLE', 'de rol noemt zijn vaardigheden en grenzen', () => { const r = w.lh.stand(ORG).rollen.ops; return r && r.vaardigheden.includes('terugboeken') && r.grenzen.length && r.titel; });
  schakel('KNOWLEDGE', 'kennis is ACTIVE, goedgekeurd door een ander dan de schrijver', () => {
    const v = w.lh.stand(ORG).kennis.terugboeken.versies[1]; return v.stand === 'ACTIVE' && v.activeerder !== v.auteur && 'auteur ' + v.auteur + ', goedgekeurd door ' + v.activeerder; });
  schakel('COMPETENCY', 'de vaardigheid is kritiek, steunt op die kennis en eist OBSERVED bewijs', () => {
    const v = w.lh.stand(ORG).vaardigheden.terugboeken; return v.kritiek && v.kennis[0] === 'terugboeken' && v.bewijsEis.sterkte === 'OBSERVED' && 'eis ' + v.bewijsEis.soorten.join('+'); });
  schakel('CURRICULUM', 'het curriculum is ACTIVE en loopt van UNDERSTAND tot REFRESH', () => {
    const c = w.lh.stand(ORG).curricula['ops-basis']; return c.stand === 'ACTIVE' && c.fasen.length === 8 && 'versie ' + c.versie; });

  /* --- de eerste trainer: bewezen vakman, dan Train-the-Trainer --- */
  const bewijsDoor = (p, v, soort, sterkte, door) => doe('bewijsVastleggen', { persoon: p, vaardigheid: v, soort, sterkte, bron: 'proef' }, door).id;
  const sim = (p, s, keuzes) => w.doe(ORG, 'simulatieAfronden', { scenario: s, keuzes }, p);
  const beoordeel = (p, v, door, bewijs) => {
    const b = doe('beoordelingAanvragen', { persoon: p, vaardigheid: v }, door).id;
    doe('beoordelingStart', { id: b }, A);
    doe('beoordelingAfronden', { id: b, uitkomst: 'PROVEN', bewijs, criteria: 'alle vereiste stappen gezien, geen verboden stap' }, A);
    return b;
  };
  const alleBewijs = (p, v) => Object.values(w.lh.stand(ORG).bewijs).filter(b => b.persoon === p && b.vaardigheid === v && !b.ongeldig).map(b => b.id);
  const evc = doe('evcIndienen', { vaardigheid: 'terugboeken', extern: 'tien jaar betalingsverkeer bij een bank' }, T).id;
  doe('evcBeoordeel', { id: evc, uitkomst: 'PARTIAL' }, A);
  sim(T, 'storno', ['controleer', 'reden', 'tweede-mens']);
  bewijsDoor(T, 'terugboeken', 'OBSERVATION_EVIDENCE', 'OBSERVED', A);
  ids.bT1 = beoordeel(T, 'terugboeken', T, alleBewijs(T, 'terugboeken'));
  doe('certificaatUitgeven', { persoon: T, vaardigheden: ['terugboeken'], beoordelingen: [ids.bT1], geldigDagen: 365 }, Q);
  doe('trainerKwalificeer', { persoon: T, trede: 'TRAINER_CANDIDATE', curricula: ['ops-basis'] }, Q);
  sim(T, 'lesdemo', ['voordoen', 'laten-doen', 'observeren']);
  bewijsDoor(T, 'didactiek', 'TRAINER_EVIDENCE', 'OBSERVED', A);
  ids.bT2 = beoordeel(T, 'didactiek', T, alleBewijs(T, 'didactiek'));
  doe('certificaatUitgeven', { persoon: T, vaardigheden: ['didactiek'], beoordelingen: [ids.bT2] }, Q);
  doe('trainerKwalificeer', { persoon: T, trede: 'CERTIFIED_TRAINER', curricula: ['ops-basis'] }, Q);
  schakel('QUALIFIED TRAINER', 'de trainer is gekwalificeerd door een ander, op bewezen vak en bewezen didactiek', () => {
    const x = lees.waaromTrainer(ORG, T, 'ops-basis'); return x.ok && x.trede === 'CERTIFIED_TRAINER' && x.gekwalificeerdDoor === Q && 'gekwalificeerd door ' + x.gekwalificeerdDoor; });

  /* --- de nieuwe medewerker --- */
  doe('relatieZet', { persoon: N, soort: 'EMPLOYEE', manager: M }, E);
  doe('rolToewijzen', { persoon: N, rol: 'ops' }, M);
  doe('startplanMaak', { persoon: N, rol: 'ops', startdatum: '2026-10-01', buddy: T }, M);
  schakel('TRAINEE', 'de nieuwe medewerker ziet zijn pad, zijn trainer, een rustige Day Zero en een eerste veilige oefening', () => {
    const m = lees.mijn(ORG, N); const plan = w.lh.stand(ORG).startplannen[N]; const p = m.PAD[0];
    return p && p.trainer === T && p.waarom && plan.fasen.DAY_ZERO.length <= 4 && plan.fasen.DAY_ONE.length === 1 && !plan.capaciteit.length && 'trainer ' + p.trainer + ', ' + p.waarom; });
  vers(N, 'ops-basis', [['LEARNING', N], ['PRACTICING', N]]);
  schakel('PRACTICE', 'de leerling ziet een oefenscenario zonder productiegevolgen', () => { const o = lees.mijn(ORG, N).OEFENEN; return o.some(x => x.scenario === 'storno') && pad(N, 'ops-basis') === 'PRACTICING' && 'scenario storno'; });
  const voor = Object.keys(w.lh.stand(ORG).bewijs).length;
  const mis = w.probeer(ORG, 'simulatieAfronden', { scenario: 'storno', keuzes: ['direct-uitbetalen'] }, N);
  sim(N, 'storno', ['controleer', 'reden', 'tweede-mens']);
  vers(N, 'ops-basis', [['SIMULATING', N]]);
  schakel('SIMULATION', 'een mislukte poging laat niets na; een geslaagde laat SYSTEM_VERIFIED bewijs na', () => {
    const st = w.lh.stand(ORG); const nieuw = Object.values(st.bewijs).filter(b => b.persoon === N);
    return mis.ok && mis.uit.uitslag.geslaagd === false && Object.keys(st.bewijs).length === voor + 1 && nieuw[0].sterkte === 'SYSTEM_VERIFIED' && nieuw[0].door === 'systeem:simulatie' && 'een stuk, door systeem:simulatie'; });
  vers(N, 'ops-basis', [['SUPERVISED', T]]);
  ids.obs = bewijsDoor(N, 'terugboeken', 'OBSERVATION_EVIDENCE', 'OBSERVED', T);
  schakel('SUPERVISED WORK', 'de trainer zag het onder toezicht gebeuren en legde het vast', () => { const b = w.lh.stand(ORG).bewijs[ids.obs]; return pad(N, 'ops-basis') === 'SUPERVISED' && b.door === T && b.sterkte === 'OBSERVED' && 'gezien door ' + T; });
  schakel('EVIDENCE', 'elk bewijsstuk draagt wie, wanneer, welke kennisversie en een integriteitshash', () => { const b = w.lh.stand(ORG).bewijs[ids.obs]; return b.kennis.terugboeken === 1 && /^[0-9a-f]{32}$/.test(b.integriteit) && b.org === ORG && 'kennis v' + b.kennis.terugboeken + ', ' + b.integriteit.slice(0, 8); });
  vers(N, 'ops-basis', [['READY_FOR_ASSESSMENT', T]]);
  ids.bN1 = beoordeel(N, 'terugboeken', N, alleBewijs(N, 'terugboeken'));
  schakel('ASSESSMENT', 'een onafhankelijke assessor (niet de trainer) beoordeelde PROVEN op genoemde criteria', () => {
    const b = w.lh.stand(ORG).beoordelingen[ids.bN1]; return b.stand === 'PROVEN' && b.assessor === A && b.assessor !== T && b.criteria && pad(N, 'ops-basis') === 'PROVEN' && 'assessor ' + b.assessor; });
  ids.cN1 = doe('certificaatUitgeven', { persoon: N, vaardigheden: ['terugboeken'], beoordelingen: [ids.bN1], geldigDagen: 365 }, Q).id;
  schakel('CERTIFICATION', 'het certificaat staat ACTIVE in de vakstaat van de medewerker', () => {
    const c = lees.vakstaat(ORG, N).certificaten.find(x => x.id === ids.cN1); return c && c.stand === 'ACTIVE' && pad(N, 'ops-basis') === 'CERTIFIED' && 'geldig tot ' + c.geldigTot; });
  const zonderBeleid = lees.geschiktheid(ORG, N, 'betaling.terugboeken');
  doe('beleidZet', { id: 'terugboeken-l2', handeling: 'betaling.terugboeken', rol: 'ops', vaardigheden: ['terugboeken'], certificaat: true }, E);
  const ongetekend = lees.geschiktheid(ORG, N, 'betaling.terugboeken');
  doe('beleidGoedkeuren', { id: 'terugboeken-l2' }, Q);
  schakel('AUTHORITY ELIGIBILITY', 'bekwaam en gecertificeerd is pas geschikt met een beleid, en nooit een verleend recht', () => {
    const g = lees.geschiktheid(ORG, N, 'betaling.terugboeken');
    return zonderBeleid.uitkomst === 'NOT_ELIGIBLE' && ongetekend.uitkomst === 'NOT_ELIGIBLE' && g.uitkomst === 'AUTHORITY_ELIGIBLE' && g.verleent === false && g.opbouw.length >= 5 && g.opbouw.length + ' eisen, alle gehaald'; });
  schakel('AUTHORITY POLICY', 'het beleid is voorgesteld en goedgekeurd door twee verschillende mensen', () => { const b = w.lh.stand(ORG).beleid['terugboeken-l2']; return b.goedgekeurd && b.goedgekeurd.door !== b.voorgesteldDoor && b.voorgesteldDoor + ' -> ' + b.goedgekeurd.door; });
  doe('werkVastleggen', { handeling: 'betaling.terugboeken', uitkomst: 'storno 120 euro, reden vastgelegd' }, N);
  schakel('REAL WORK', 'het werk ging langs de brug, laat werkbewijs na, en de behoefte is nu READY', () => {
    const st = w.lh.stand(ORG); const g = lees.gereedheid(ORG, { ops: 1 });
    return st.werk.length === 1 && pad(N, 'ops-basis') === 'PRACTICING_IN_ROLE' && g.stand === 'READY' && 'gereedheid ' + g.stand; });

  /* --- de kennislus --- */
  ids.v = doe('voorstelIndienen', { kennis: 'terugboeken', probleem: 'klanten wachten op de tweede handtekening bij kleine bedragen', huidigeRegel: 'boven 500 euro',
    voorstel: 'grens naar 1000 euro, en altijd controleren op dubbele storno', reden: 'dubbele storno kwam twee keer voor', bewijs: 'twee incidenten', risico: 'midden' }, N).id;
  schakel('FEEDBACK', 'een voorstel uit de praktijk staat bij de kenniseigenaar, zonder dat de kennis veranderde', () => {
    const st = w.lh.stand(ORG); return st.voorstellen[ids.v].stand === 'SUBMITTED' && st.kennis.terugboeken.actief === 1 && 'SUBMITTED, kennis nog v1'; });
  for (const s of ['TRIAGED', 'REVIEW', 'APPROVED']) doe('voorstelStand', { id: ids.v, naar: s }, KO);
  schakel('IMPROVEMENT', 'het voorstel is goedgekeurd door een ander dan de indiener', () => { const v = w.lh.stand(ORG).voorstellen[ids.v]; return v.stand === 'APPROVED' && v.historie.at(-1).door !== v.indiener && 'door ' + v.historie.at(-1).door; });
  doe('kennisSchrijf', { id: 'terugboeken', domein: 'betalingen', titel: 'Een betaling terugboeken', tekst: 'Controleer op dubbele storno, leg de reden vast, laat een tweede mens tekenen boven 1000 euro.', bron: 'voorstel ' + ids.v, voorstel: ids.v, reden: 'dubbele storno' }, CO);
  doe('kennisStand', { id: 'terugboeken', versie: 2, naar: 'REVIEW' }, CO);
  doe('kennisStand', { id: 'terugboeken', versie: 2, naar: 'ACTIVE', impactKlasse: 'RECERTIFICATION_REQUIRED' }, KO);
  doe('voorstelStand', { id: ids.v, naar: 'IMPLEMENTED' }, KO);
  schakel('KNOWLEDGE CHANGE', 'versie 2 is ACTIVE, versie 1 DEPRECATED maar leesbaar, en de coach kent alleen versie 2', () => {
    const k = w.lh.stand(ORG).kennis.terugboeken; const g = lees.grond(ORG, 'dubbele storno terugboeken');
    return k.actief === 2 && k.versies[1].stand === 'DEPRECATED' && k.versies[1].tekst && g.bronnen[0].versie === 2 && 'coach gegrond op v2'; });
  schakel('IMPACT', 'de wijziging raakt medewerker, trainer en beleid, en het certificaat vraagt hercertificering', () => {
    const im = w.lh.stand(ORG).impacts[0]; const c = lees.certStand(ORG, ids.cN1);
    return im.mensen.includes(N) && im.trainers.includes(T) && im.beleid.includes('terugboeken-l2') && c.stand === 'REFRESH_REQUIRED'
      && lees.geschiktheid(ORG, N, 'betaling.terugboeken').uitkomst === 'NOT_ELIGIBLE' && lees.gereedheid(ORG, { ops: 1 }).stand === 'BLOCKED' && c.reden; });

  const trainerVoor = lees.waaromTrainer(ORG, T, 'ops-basis');
  sim(T, 'storno', ['controleer', 'reden', 'tweede-mens']);
  bewijsDoor(T, 'terugboeken', 'OBSERVATION_EVIDENCE', 'OBSERVED', A);
  const nieuwT = alleBewijs(T, 'terugboeken').slice(-2);
  beoordeel(T, 'terugboeken', T, nieuwT);
  doe('trainerBijwerken', { persoon: T }, Q);
  schakel('TRAINER UPDATE', 'de trainer gaf niet op oude kennis, verfriste zelf, en is pas daarna weer geldig', () => {
    const x = lees.waaromTrainer(ORG, T, 'ops-basis'); return !trainerVoor.ok && x.ok && trainerVoor.reden; });

  vers(N, 'ops-basis', [['LEARNING', N], ['PRACTICING', N]]);
  sim(N, 'storno', ['controleer', 'reden', 'tweede-mens']);
  vers(N, 'ops-basis', [['SIMULATING', N], ['SUPERVISED', T]]);
  bewijsDoor(N, 'terugboeken', 'OBSERVATION_EVIDENCE', 'OBSERVED', T);
  vers(N, 'ops-basis', [['READY_FOR_ASSESSMENT', T]]);
  ids.bN2 = beoordeel(N, 'terugboeken', N, alleBewijs(N, 'terugboeken').slice(-2));
  ids.cN2 = doe('certificaatUitgeven', { persoon: N, vaardigheden: ['terugboeken'], beoordelingen: [ids.bN2], geldigDagen: 365 }, Q).id;
  doe('werkVastleggen', { handeling: 'betaling.terugboeken', uitkomst: 'storno volgens versie 2' }, N);
  doe('voorstelStand', { id: ids.v, naar: 'MEASURED', meting: 'na versie 2 nul dubbele storno in de proef' }, KO);
  schakel('EMPLOYEE REFRESH', 'de medewerker ververste, is opnieuw gecertificeerd op versie 2 en weer geschikt; het oude certificaat blijft als historie', () => {
    const c2 = lees.certStand(ORG, ids.cN2); const c1 = lees.certStand(ORG, ids.cN1);
    const bew = w.lh.stand(ORG).personen[N].bewezen.terugboeken;
    return c2.stand === 'ACTIVE' && c1.stand === 'REFRESH_REQUIRED' && bew.kennis.terugboeken === 2 && lees.geschiktheid(ORG, N, 'betaling.terugboeken').uitkomst === 'AUTHORITY_ELIGIBLE'
      && w.lh.stand(ORG).voorstellen[ids.v].stand === 'MEASURED' && 'bewezen op v2, voorstel MEASURED'; });

  sim(N, 'lesdemo', ['voordoen', 'laten-doen', 'observeren']);
  bewijsDoor(N, 'didactiek', 'TRAINER_EVIDENCE', 'OBSERVED', A);
  const bD = beoordeel(N, 'didactiek', N, alleBewijs(N, 'didactiek'));
  doe('certificaatUitgeven', { persoon: N, vaardigheden: ['didactiek'], beoordelingen: [bD] }, Q);
  doe('trainerKwalificeer', { persoon: N, trede: 'CERTIFIED_TRAINER', curricula: ['ops-basis'] }, Q);
  schakel('NEXT TRAINER', 'de medewerker van gisteren is nu zelf gekwalificeerd trainer, langs dezelfde weg', () => { const x = lees.waaromTrainer(ORG, N, 'ops-basis'); return x.ok && x.trede === 'CERTIFIED_TRAINER' && 'trainer ' + N; });

  doe('relatieZet', { persoon: N2, soort: 'EMPLOYEE', manager: M }, E);
  doe('rolToewijzen', { persoon: N2, rol: 'ops' }, M);
  doe('startplanMaak', { persoon: N2, rol: 'ops' }, M);
  doe('trainerToewijzen', { persoon: N2, curriculum: 'ops-basis', trainer: N }, Q);
  schakel('NEXT TRAINEE', 'de nieuwe trainer ziet zijn eerste leerling, en de leerling ziet zijn trainer', () => {
    const c = lees.trainerCockpit(ORG, N); return c.ok && c.LEERLINGEN.some(x => x.persoon === N2) && lees.mijn(ORG, N2).PAD[0].trainer === N && N + ' traint ' + N2; });

  schakel('AUDIT', 'een auditor reconstrueert het certificaat en het spoor is ongebroken', () => {
    const r = lees.reconstrueer(ORG, ids.cN1); const k = w.lh.verifieer(ORG);
    return r.ok && r.beoordelingen[0].assessor === A && r.bewijs.length >= 2 && r.kennisDestijds.terugboeken === 1 && r.laterVeranderd.length === 1 && r.toewijzing[0].trainer && k.ok && k.geteld + ' regels, keten ok'; });

  /* --- storingen die de lus niet mag doorlaten --- */
  storing('zelfcertificering', 'niemand certificeert zichzelf', () => { const r = probeer('certificaatUitgeven', { persoon: Q, vaardigheden: ['terugboeken'], beoordelingen: [ids.bN2] }, Q); return !r.ok && r.reden; });
  storing('dubbel certificaat', 'een beoordeling draagt hoogstens een certificaat', () => { const r = probeer('certificaatUitgeven', { persoon: N, vaardigheden: ['terugboeken'], beoordelingen: [ids.bN2] }, Q); return !r.ok && r.status === 409 && r.reden; });
  storing('verlopen certificaat', 'na de vervaldatum is er geen geschiktheid meer', () => { w.verzet(400); const g = lees.geschiktheid(ORG, N, 'betaling.terugboeken'); return g.uitkomst === 'NOT_ELIGIBLE' && g.opbouw.filter(x => !x.ok).map(x => x.waarom).join('; '); });
  storing('uit dienst', 'wie vertrekt, houdt geen geschiktheid en verliest zijn historie niet', () => {
    doe('uitDienst', { persoon: N }, E); const g = lees.geschiktheid(ORG, N, 'betaling.terugboeken');
    return g.uitkomst === 'NOT_ELIGIBLE' && w.lh.stand(ORG).certificaten[ids.cN2] && !lees.waaromTrainer(ORG, N, 'ops-basis').ok && 'geen geschiktheid, certificaat bewaard, geen trainer meer'; });
  storing('gemanipuleerd spoor', 'wie een regel achteraf wijzigt, breekt de keten aanwijsbaar', () => {
    const regels = w.db.data.leerhuis[ORG]; const r = regels[regels.length - 5]; const oud = r.door; r.door = 'lid:99';
    const v = w.lh.verifieer(ORG); r.door = oud; return !v.ok && v.gebroken.length >= 1 && 'gebroken op index ' + v.gebroken[0].index; });

  const telling = { schakels: schakels.length, gesloten: schakels.filter(s => s.stand === 'gesloten').length, open: schakels.filter(s => s.stand === 'open').length,
    stuk: schakels.filter(s => s.stand === 'stuk').length, storingen: storingen.length, gehouden: storingen.filter(s => s.stand === 'gehouden').length,
    gebroken: storingen.filter(s => s.stand === 'gebroken').length };
  const sluit = telling.open === 0 && telling.stuk === 0 && telling.gebroken === 0 && telling.schakels >= MIN_SCHAKELS;
  return { uitleg: 'de gouden lus van RTG Academy, gemeten bij de ontvanger', grens: 'geen server, geen HTTP, geen browser; de proef gaat over de regels van server/kern/leerhuis',
    schakels, storingen, telling, LOOP_COMPLETENESS: sluit ? 'CLOSED' : 'OPEN', sluit,
    ACADEMY_STATUS: sluit && !BLOKKADES.length ? 'READY' : 'BLOCKED', blokkades: sluit ? BLOKKADES : [{ id: 'LUS', wat: 'de lus sluit niet' }].concat(BLOKKADES) };
}

module.exports = { meet, BLOKKADES, MIN_SCHAKELS };

if (require.main === module) {
  const uit = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(uit)); process.exit(uit.sluit ? 0 : 1); }
  for (const s of uit.schakels) console.log((s.stand === 'gesloten' ? '  ok  ' : '  XX  ') + String(s.nr).padStart(2) + ' ' + s.naar.padEnd(22) + (s.ziet && s.ziet !== true ? s.ziet : s.fout || s.wat));
  console.log('');
  for (const s of uit.storingen) console.log((s.stand === 'gehouden' ? '  ok  ' : '  XX  ') + s.naam.padEnd(22) + (s.wat || ''));
  console.log('\nLOOP_COMPLETENESS=' + uit.LOOP_COMPLETENESS + '  (' + uit.telling.gesloten + '/' + uit.telling.schakels + ' schakels, ' + uit.telling.gehouden + '/' + uit.telling.storingen + ' storingen)');
  console.log('ACADEMY_STATUS=' + uit.ACADEMY_STATUS);
  for (const b of uit.blokkades) console.error('  blokkade ' + b.id + ': ' + b.wat + (b.sluit ? ' (sluit: ' + b.sluit + ')' : ''));
  console.log(uit.sluit ? 'De lus sluit.' : 'DE LUS SLUIT NIET.');
  process.exit(uit.sluit ? 0 : 1);
}
