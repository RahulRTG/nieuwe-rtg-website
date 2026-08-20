/* HET STADSWEEFSEL, BESTUURSKANT: onderhoud, contracten, indicatoren,
   begroting, energie, klimaat, simulatie en het algoritmeregister.

   test/stadsweefsel.test.js dekt de operatie (waar staat het, wie gaat erheen);
   dit dekt wat je ermee stuurt. Per blok staat de mutatie waarmee de bewering
   is nagetrokken en wat er precies van zakte -- alle elf mutaties zijn gedraaid.

   EN VIER ERVAN SLOEGEN DE EERSTE KEER AF. Dat is het waard om hier te laten
   staan, want het ging vier keer om dezelfde fout uit lat-regel 9: een toets
   die zijn eigen vraag niet durft te stellen.

     - de doorlooptijd-bewering liep over een lijst die LEEG kon zijn (nul
       rondes = nul beweringen). Nu staat hij op een tijdvak in 2020, waarin
       met zekerheid niets is gebeurd, en moet hij null zijn.
     - de nulmeting werd getoetst met `!== undefined`, en null is ook niet
       undefined. Nu draagt hij zijn indicator, richting en tijdstip.
     - de kritiek-controle bij energie kon niet AANSLAAN, omdat geen enkele
       maatregel een kritiek object raakte in de startstad. De toets maakt de
       situatie nu zelf: hij classificeert een laadpunt als kritiek.
     - het niveau van een handeling werd getoetst met `mag === false`, en dat
       is voor alles behalve niveau 3 waar. Een verlaging van 4 naar 1 bleef
       dus groen. Nu staan het NIVEAU en de REDEN in de bewering.

   Zonder de mutaties waren die vier gewoon als geslaagde toetsen blijven staan.

   Draai los: node --test test/stadsbestuur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bestuur-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const oapi = (pad, body) => api('office/' + pad, { ...(body || {}), naam: 'Aïsha' }, office);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-BESTUUR-1' } });
  base = srv.base;
  const o = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  office = o.token;
  assert.ok(office, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------- 1. Onderhoud: plannen, en de vier ogen ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in onderhoud.js de vier-ogen-controle bij
   een kritiek object weghalen -> het gemaal kwam er met EEN naam doorheen en
   deze toets zakte op "veiligheidskritiek werk vraagt twee namen". Dat is de
   bewering die telt: de rest van deze laag is administratie, dit is de rem. */
test('onderhoud: een lijst die niet uit meldingen komt, en vier ogen bij kritieke infrastructuur', async () => {
  const lijst = await oapi('weefsel/onderhoud');
  assert.equal(lijst.status, 200);
  assert.ok(lijst.body.aantal > 0 && lijst.body.aantal < 68, 'niet alles staat erop, en niet niets: ' + lijst.body.aantal);
  const eerste = lijst.body.objecten[0];
  assert.ok(eerste.score > 0 && eerste.redenen.length, 'elk signaal draagt zijn redenen: ' + JSON.stringify(eerste.redenen));
  assert.ok(lijst.body.regime.speeltoestel < lijst.body.regime.lantaarn, 'een speeltoestel wordt vaker geschouwd dan een lantaarn');

  // de putten staan over hun inspectietermijn: dat is het regime, geen melding
  const put = lijst.body.objecten.find(o => o.soort === 'put');
  assert.ok(put && put.overMaanden > 0, 'de kolken zijn over hun schouwtermijn: ' + (put && put.overMaanden));

  // een voorstel is een voorstel: er ontstaat geen werk van
  const voor = (await oapi('weefsel/werk')).body.aantal;
  const plan = await oapi('weefsel/onderhoud/plan', { soort: 'put' });
  assert.equal(plan.status, 200);
  assert.ok(plan.body.voorstellen.length >= 1);
  assert.equal(plan.body.vanzelf.mag, false, 'onderhoud plannen gebeurt niet vanzelf');
  assert.match(plan.body.let_op, /geen werk tot een mens het gunt/);
  assert.equal((await oapi('weefsel/werk')).body.aantal, voor, 'een plan maakt geen werkorders aan');

  // gunnen maakt ze wel, met naam
  const gun = await oapi('weefsel/onderhoud/gun', { objectIds: plan.body.voorstellen.slice(0, 2).map(v => v.objectId) });
  assert.equal(gun.status, 200);
  assert.equal(gun.body.gemaakt, 2, 'twee werkorders uit het voorstel');
  assert.equal((await oapi('weefsel/werk')).body.aantal, voor + 2);

  /* En de rem: een gemaal is veiligheidskritiek. Met een naam gaat hij niet
     door, met twee verschillende namen wel. */
  const gemaal = (await oapi('weefsel/objecten', { soort: 'gemaal' })).body.objecten[0];
  const alleen = await oapi('weefsel/onderhoud/gun', { objectIds: [gemaal.id] });
  assert.equal(alleen.body.gemaakt, 0, 'een kritiek object gaat niet door met een naam');
  assert.match(alleen.body.overgeslagen[0].reden, /vier ogen/);
  assert.equal((await oapi('weefsel/onderhoud/gun', { objectIds: [gemaal.id], tweede: 'Aïsha' })).body.gemaakt, 0,
    'twee keer dezelfde naam is geen vier ogen');
  const vier = await oapi('weefsel/onderhoud/gun', { objectIds: [gemaal.id], tweede: 'Bram' });
  assert.equal(vier.body.gemaakt, 1, 'met twee verschillende namen wel');
  assert.equal(vier.body.tweede, 'Bram');
  const board = (await oapi('boardroom')).body;
  assert.ok((board.audit || []).some(a => /vier ogen met Bram/.test(a.wat)), 'en dat staat zo in het auditlog');
});

/* ---------------- 2. Contracten en de SLA-klok ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in contracten.js de reactieklok laten
   stoppen op de STATUS in plaats van op het toewijzen van een uitvoerder ->
   de toets zakte op "de klok stopt bij een handeling". Tweede mutatie, ook
   RAAK: voorWerk() het EERSTE contract laten kiezen in plaats van het meest
   specifieke -> het stadsbrede contract won van het zonecontract. */
test('contracten: het meest specifieke contract wint, en de SLA-klok stopt bij een handeling', async () => {
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Marina');
  const breed = await oapi('weefsel/contract/maak', { partij: 'Stadsbeheer BV', soorten: ['lantaarn', 'container', 'put'] });
  assert.equal(breed.status, 200);
  assert.equal(breed.body.contract.gebiedNaam, 'de hele stad');
  const smal = await oapi('weefsel/contract/maak', { partij: 'Havenwerk VOF', soorten: ['lantaarn'], gebied: zone.id,
    sla: { reactieUur: { hoog: 1 }, herstelDagen: { hoog: 2 } } });
  assert.equal(smal.status, 200);
  assert.equal((await oapi('weefsel/contract/maak', { partij: 'Niemand', soorten: ['ufo'] })).status, 400);

  // een lantaarnzaak in Marina hoort bij het havencontract, niet bij het brede
  const paal = (await oapi('weefsel/objecten', { soort: 'lantaarn', gebied: zone.id })).body.objecten[0];
  const z = await oapi('weefsel/waarneming', { kanaal: 'telefoon', categorie: 'verlichting',
    tekst: 'lantaarn aan de kade is stuk', lat: paal.lat, lng: paal.lng });
  const wo = (await oapi('weefsel/werk')).body.werkorders.find(w => w.zaakRef === z.body.zaak.ref);
  assert.ok(wo, 'er staat werk klaar');
  assert.equal(wo.organisatie, 'Havenwerk VOF', 'het meest specifieke contract wint');
  assert.ok(wo.slaReactieVoor > wo.at && wo.slaHerstelVoor > wo.slaReactieVoor, 'twee klokken, en herstel staat na reactie');

  // de reactieklok stopt pas als iemand hem oppakt
  assert.equal(wo.reactieAt, null, 'nog niemand opgepakt, dus nog geen reactie');
  await oapi('weefsel/werk/zet', { id: wo.id, uitvoerder: 'Bram' });
  const na = (await oapi('weefsel/werk')).body.werkorders.find(w => w.id === wo.id);
  assert.ok(na.reactieAt, 'een uitvoerder erop = gereageerd');
  assert.equal(na.reactieBinnenSla, true, 'en dat was binnen het uur dat het contract belooft');

  await oapi('weefsel/werk/klaar', { id: wo.id, kosten: 120, uren: 1 });
  const p = await oapi('weefsel/prestatie', {});
  const haven = p.body.partijen.find(x => x.partij === 'Havenwerk VOF');
  assert.ok(haven, 'de partij staat in de prestatiemeting');
  assert.equal(haven.afgerond, 1);
  assert.equal(haven.reactiePct, 100);
  assert.equal(haven.herstelPct, 100);
  assert.equal(haven.kosten, 120);
});

/* ---------------- 3. Indicatoren en wijkverschillen ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in indicatoren.js een lege doorlooptijd
   als 0 teruggeven in plaats van null -> de toets zakte op "niet gemeten is
   niet nul". Dat is precies de fout die een bestuur geruststelt met lucht. */
test('indicatoren: richting per getal, niet gemeten is niet nul, en het verschil tussen wijken', async () => {
  const r = await oapi('weefsel/indicatoren', { dagen: 30 });
  assert.equal(r.status, 200);
  const per = Object.fromEntries(r.body.indicatoren.map(i => [i.id, i]));
  assert.equal(per.doorlooptijd.beterIs, 'lager', 'sneller is beter');
  assert.equal(per.gesloten.beterIs, 'hoger', 'meer opgeloste zaken is beter');
  assert.equal(per.kosten.eenheid, 'euro');
  assert.match(r.body.let_op, /technische beschikbaarheid/i, 'sensoren-online staat er met opzet NIET tussen');

  /* NIET GEMETEN IS NIET NUL, en die bewering hoort op een tijdvak te staan
     waarin met ZEKERHEID niets is gebeurd -- anders loopt de lus over een lege
     verzameling en bewijst hij niets. Vandaar een venster in 2020: daar bestond
     deze stad nog niet, dus doorlooptijd MOET daar null zijn met een tekst. */
  const oud = await oapi('weefsel/indicatoren', { vanaf: Date.parse('2020-01-01'), tot: Date.parse('2020-02-01') });
  const oudPer = Object.fromEntries(oud.body.indicatoren.map(i => [i.id, i]));
  assert.equal(oudPer.doorlooptijd.waarde, null, 'geen zaken in 2020, dus geen doorlooptijd -- geen nul');
  assert.equal(oudPer.doorlooptijd.meting, 'niet gemeten in dit tijdvak', 'en het zegt dat met zoveel woorden');
  assert.equal(oudPer.gesloten.waarde, 0, 'een AANTAL is daar wel gewoon nul: niets is niet hetzelfde als niet gemeten');
  assert.equal(oudPer.doorlooptijd.beter, null, 'zonder meting is er ook geen oordeel of het beter ging');
  const sla = per.sla;
  assert.ok(sla.waarde === null || (sla.waarde >= 0 && sla.waarde <= 100), 'sla is een percentage of niet gemeten');

  const w = await oapi('weefsel/wijken', { dagen: 30 });
  assert.equal(w.status, 200);
  assert.equal(w.body.wijken.length, 3, 'drie wijken');
  assert.ok(w.body.wijken.every(x => typeof x.geopend === 'number'), 'elke wijk draagt zijn eigen cijfers');
  assert.ok(w.body.spreidingDoorlooptijdUur === null || w.body.spreidingDoorlooptijdUur >= 0);
  assert.match(w.body.let_op, /spreiding|te weinig/, 'en zegt wat de spreiding betekent, of dat hij er niet is');

  const leef = await oapi('weefsel/leefomgeving', { dagen: 7 });
  assert.equal(leef.status, 200);
  assert.ok(leef.body.leefomgeving.lucht, 'de luchtkwaliteit staat erbij');
  assert.match(leef.body.let_op, /geen wettelijke meting/, 'met de eerlijke voetnoot erbij');
});

/* ---------------- 4. Begroting: doel -> budget -> uitkomst ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in begroting.js de nulmeting bij het
   AFSLUITEN opnieuw laten bepalen in plaats van bij de start -> het effect werd
   altijd 0 en de toets zakte op de nulmeting. Achteraf is elke startwaarde de
   waarde die het beste uitkomt; daarom staat hij vast bij de start. */
test('begroting: een project kent zijn nulmeting, zijn uitgaven en zijn effect', async () => {
  const doel = await oapi('weefsel/doel/maak', { doelNaam: 'Verkeersveiligheid rond scholen', jaar: 2026, indicator: 'doorlooptijd' });
  assert.equal(doel.status, 200);
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Oud-West');
  const p = await oapi('weefsel/project/maak', { doelId: doel.body.doel.id, projectNaam: 'Verlichting schoolroute',
    budget: 25000, gebied: zone.id, indicator: 'doorlooptijd' });
  assert.equal(p.status, 200);
  assert.equal(p.body.project.budget, 25000);
  /* De nulmeting is bij de START vastgelegd, en dat is meer dan "het veld
     bestaat": hij draagt de indicator, zijn eenheid en het tijdstip waarop hij
     is genomen. Een assertie op !== undefined zou hier niets bewijzen -- null
     is ook niet undefined. */
  const nul = p.body.project.nulmeting;
  assert.ok(nul && nul.indicator === 'doorlooptijd', 'de nulmeting noemt zijn indicator: ' + JSON.stringify(nul));
  assert.ok(nul.at > Date.now() - 60000, 'en is nu genomen, niet achteraf gereconstrueerd');
  assert.equal(nul.beterIs, 'lager', 'met de richting erbij');
  assert.equal((await oapi('weefsel/project/maak', { doelId: doel.body.doel.id, projectNaam: 'Zonder budget' })).status, 400);

  // werk eraan hangen, uitvoeren, en dan pas telt het als uitgave
  const paal = (await oapi('weefsel/objecten', { soort: 'lantaarn', gebied: zone.id })).body.objecten[0];
  const wo = await oapi('weefsel/werk/maak', { objectId: paal.id, omschrijving: 'armatuur vervangen bij de school', soort: 'vervanging' });
  await oapi('weefsel/project/koppel', { projectId: p.body.project.id, werkorderId: wo.body.werkorder.id });
  let staat = (await oapi('weefsel/project', { id: p.body.project.id })).body.project;
  assert.equal(staat.uitgegeven, 0, 'werk dat nog loopt heeft nog geen kosten');
  assert.equal(staat.werkOpen, 1);

  // afsluiten kan niet zolang er werk openstaat
  assert.equal((await oapi('weefsel/project/sluit', { projectId: p.body.project.id })).status, 400);
  await oapi('weefsel/werk/klaar', { id: wo.body.werkorder.id, kosten: 1800, uren: 6 });
  staat = (await oapi('weefsel/project', { id: p.body.project.id })).body.project;
  assert.equal(staat.uitgegeven, 1800, 'na het klaarmelden telt het als uitgave');
  assert.equal(staat.resterend, 23200);
  assert.equal(staat.overschreden, false);

  const dicht = await oapi('weefsel/project/sluit', { projectId: p.body.project.id, evaluatie: 'route is verlicht' });
  assert.equal(dicht.status, 200);
  assert.equal(dicht.body.project.status, 'afgesloten');
  assert.ok(dicht.body.effect.gemeten === true || dicht.body.effect.reden, 'het effect is gemeten, of het zegt waarom niet');
  if (dicht.body.effect.gemeten) assert.match(dicht.body.effect.let_op, /geen bewijs van oorzaak/, 'met de eerlijke kanttekening');
  assert.equal((await oapi('weefsel/project/sluit', { projectId: p.body.project.id })).status, 400, 'twee keer afsluiten kan niet');

  const b = await oapi('weefsel/begroting', { jaar: 2026 });
  assert.equal(b.body.doelen[0].budget, 25000);
  assert.equal(b.body.doelen[0].uitgegeven, 1800);
  assert.match(b.body.let_op, /geen geld verplaatst/, 'dit is administratie, geen betaalrail');
});

/* ---------------- 5. Energie: adviseren is niet schakelen ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in energie.js de kritiek-controle
   weghalen -> een maatregel op een gebied met een kritiek object werd gewoon
   vastgelegd en de toets zakte op de 403. Tweede mutatie, ook RAAK: de
   vier-ogen-eis bij een zware maatregel weghalen. */
test('energie: het net in beeld, advies met terugvalstand, en geen knop naar de fysieke wereld', async () => {
  const e = await oapi('weefsel/energie');
  assert.equal(e.status, 200);
  assert.ok(e.body.gebieden.length >= 3, 'elk transformatorstation is een voedingsgebied');
  const g = e.body.gebieden[0];
  assert.ok(g.capaciteitKw > 0 && g.afnemers, 'met capaciteit en wat eraan hangt');
  assert.ok(g.marge.includes('hulpdiensten'), 'en een marge die voor hulpdiensten gereserveerd blijft');
  assert.match(e.body.let_op, /schakelt zelf niets/, 'het bord zegt zelf dat het niets schakelt');

  const a = await oapi('weefsel/energie/advies');
  assert.equal(a.status, 200);
  assert.equal(a.body.niveau.mag, false, 'een energiemaatregel gaat niet vanzelf');
  for (const v of a.body.voorstellen) assert.ok(v.terugvalstand, 'elk voorstel draagt zijn terugvalstand');

  /* De harde grens: een maatregel die een VEILIGHEIDSKRITIEK object raakt gaat
     niet door, ook niet met twee namen. Om dat echt te toetsen moet er zo'n
     object staan, dus de toets maakt de situatie: een laadpunt dat de
     hulpdiensten voedt, wordt als kritiek geclassificeerd. Daarna is
     "laden-uitstellen" in die zone verboden -- en dat is precies de bedoeling.
     Een assertie die 403 OF 200 goedkeurt (zoals mijn eerste versie) zou hier
     niets hebben bewezen; die vorm staat niet voor niets in de lat. */
  const laadpaal = (await oapi('weefsel/objecten', { soort: 'laadpaal' })).body.objecten[0];
  assert.ok(laadpaal, 'er staat een laadpunt in de stad');
  const zetKritiek = await oapi('weefsel/object/zet', { id: laadpaal.id, risico: 'kritiek' });
  assert.equal(zetKritiek.body.object.risico, 'kritiek');
  const zoneVanPaal = (await oapi('weefsel/plaats', { lat: laadpaal.lat, lng: laadpaal.lng })).body.zone;
  const kritiek = await oapi('weefsel/energie/opdracht', { gebied: zoneVanPaal.id, maatregel: 'laden-uitstellen', tweede: 'Bram' });
  assert.equal(kritiek.status, 403, 'een maatregel op veiligheidskritieke infrastructuur wordt geweigerd');
  assert.match(kritiek.body.error, /eigen procedure/, 'met de reden: dat loopt niet via dit bord');
  await oapi('weefsel/object/zet', { id: laadpaal.id, risico: 'midden' });   // terug naar normaal

  // een zware maatregel vraagt vier ogen
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Groenzone');
  assert.equal((await oapi('weefsel/energie/opdracht', { gebied: zone.id, maatregel: 'batterij-inzetten' })).status, 400,
    'een zware maatregel met een naam wordt geweigerd');
  const zwaar = await oapi('weefsel/energie/opdracht', { gebied: zone.id, maatregel: 'batterij-inzetten', tweede: 'Bram', reden: 'piek verwacht' });
  assert.equal(zwaar.status, 200);
  assert.match(zwaar.body.let_op, /Vastgelegd, niet geschakeld/, 'vastgelegd, niet geschakeld');
  assert.ok(zwaar.body.opdracht.tot > zwaar.body.opdracht.at, 'en hij vervalt vanzelf');
  assert.equal((await oapi('weefsel/energie/opdracht', { gebied: zone.id, maatregel: 'batterij-inzetten', tweede: 'Bram' })).status, 400,
    'dezelfde maatregel twee keer tegelijk kan niet');

  const in2 = await oapi('weefsel/energie/intrek', { id: zwaar.body.opdracht.id });
  assert.equal(in2.status, 200);
  assert.ok(in2.body.terugvalstand, 'intrekken noemt de terugvalstand');
  assert.equal((await oapi('weefsel/energie/intrek', { id: zwaar.body.opdracht.id })).status, 400);
});

/* ---------------- 6. Klimaat en de wat-als-vragen ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in klimaat.js de risicokenmerken niet
   zaaien -> het scenario rekende over nul zones en de toets zakte op de zones
   EN op het advies dat dan juist "leg dat eerst vast" hoort te zeggen. */
test('klimaat: risicozones, een scenario dat op het register rekent, en drie andere wat-als-vragen', async () => {
  const k = await oapi('weefsel/klimaat');
  assert.equal(k.status, 200);
  assert.ok(Object.keys(k.body.meters).length === 5, 'vijf meetsoorten naast de acht domeinen van het bord');
  assert.ok(k.body.risicozones.length >= 3, 'er zijn zones met een risicokenmerk: ' + k.body.risicozones.length);
  assert.ok(k.body.risicozones.some(z => z.kenmerken.includes('kade')), 'de haven ligt aan het water');

  const s = await oapi('weefsel/simuleer', { soort: 'klimaat', scenario: 'hoogwater', ernst: 'zwaar' });
  assert.equal(s.status, 200);
  assert.ok(s.body.zones.length >= 1, 'hoogwater raakt de kadezones: ' + s.body.zones.join(', '));
  assert.ok(Array.isArray(s.body.advies) && s.body.advies.length, 'met advies');
  assert.match(s.body.let_op, /geen hydrologisch model/, 'en de eerlijke grens erbij');
  assert.equal((await oapi('weefsel/simuleer', { soort: 'klimaat', scenario: 'onzin' })).status, 400);

  // wegafsluiting: wat staat eraan en blijft er een verbinding over
  const straat = (await oapi('weefsel/gebieden', { niveau: 'straatsegment' })).body.gebieden[0];
  const weg = await oapi('weefsel/simuleer', { soort: 'wegafsluiting', gebied: straat.id, dagen: 7 });
  assert.equal(weg.status, 200);
  assert.ok(weg.body.gevolgen.length >= 3, 'met concrete gevolgen');
  assert.ok(weg.body.alternatieven.length >= 1, 'en wat er als verbinding overblijft');
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden[0];
  assert.equal((await oapi('weefsel/simuleer', { soort: 'wegafsluiting', gebied: zone.id })).status, 400,
    'een hele zone afsluiten is geen wegafsluiting');

  // evenement: houdt wat er staat het vol
  const ev = await oapi('weefsel/simuleer', { soort: 'evenement', gebied: zone.id, bezoekers: 20000, uren: 8 });
  assert.equal(ev.status, 200);
  assert.ok(ev.body.verwacht.afvalLiter > ev.body.verwacht.containercapaciteitLiter, '20.000 bezoekers passen niet in de containers');
  assert.ok(ev.body.knelpunten.some(t => /Afval/.test(t)), 'en dat staat als knelpunt benoemd');
  assert.ok(ev.body.aannames.afvalPerBezoeker > 0, 'de aannames staan er met naam en getal bij');
  assert.equal((await oapi('weefsel/simuleer', { soort: 'onzin' })).status, 400);
});

/* ---------------- 7. Het algoritmeregister ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in ainiveau.js 'kritiek-onderhoud' van
   niveau 4 naar 1 zetten -> magAutomatisch() gaf ineens groen licht en de
   toets zakte op de bewering dat niveau 4 nooit vanzelf gaat. Het register
   leest zijn niveaus uit de code, dus die twee kunnen niet uit elkaar lopen. */
test('het algoritmeregister is openbaar, leest zijn niveaus uit de code en noemt zijn beperkingen', async () => {
  // openbaar: zonder enige inlog
  const open = await fetch(base + '/api/stad/algoritmes').then(r => r.json());
  assert.ok(Array.isArray(open.regels) && open.regels.length >= 6, 'het register staat er, zonder inlog');
  for (const r of open.regels) {
    assert.ok(r.doel && r.werking, r.id + ' zegt wat hij doet');
    assert.ok(r.beperking && r.beperking.length > 20, r.id + ' noemt zijn beperking, niet alleen zijn kunnen');
    assert.ok(r.gegevens.length, r.id + ' noemt welke gegevens hij gebruikt');
    assert.ok(typeof r.niveau === 'number' && r.niveauNaam, r.id + ' draagt zijn beslisruimte: ' + r.niveau);
    assert.ok(r.bezwaar, r.id + ' zegt waar je terecht kunt');
  }
  assert.match(open.geenProfilering, /oordeel over een persoon/);
  assert.equal(open.niveaus.length, 5, 'de vijf niveaus staan erbij');

  /* HETZELFDE REGISTER VIA POST. routes/stad.js hangt beide werkwoorden op --
     de app praat met POST, een openbaar register hoort ook met een gewone GET
     te openen -- maar de POST was nooit aangeroepen: de dekkingsmeting telde per
     PAD en de GET hierboven zette hem gratis op groen. Sinds ze per METHODE
     telt, valt dat op. De bewering is de belofte en niet de statuscode: hetzelfde
     register, langs welk werkwoord je ook binnenkomt. */
  const viaPost = await fetch(base + '/api/stad/algoritmes',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(async r => ({ status: r.status, body: await r.json() }));
  assert.equal(viaPost.status, 200, 'het register antwoordt ook op POST');
  assert.deepEqual(viaPost.body, open, 'en geeft precies hetzelfde register');

  // en de niveaus komen uit de code: niveau 4 gaat nooit vanzelf
  /* De niveaus komen uit de code. Let op waar de assertie op staat: alleen
     `mag === false` toetsen zou niets bewijzen, want alles behalve niveau 3
     geeft false -- een handeling die van 4 naar 1 zakt, blijft dan groen. Het
     NIVEAU en de REDEN zijn wat het verschil laat zien. */
  const { magAutomatisch } = require('../server/kern/stadsweefsel/ainiveau');
  const kritiek = magAutomatisch('kritiek-onderhoud');
  assert.equal(kritiek.mag, false, 'werk aan kritieke infrastructuur gaat nooit vanzelf');
  assert.equal(kritiek.niveau, 4, 'en staat op het hoogste niveau, niet ergens halverwege');
  assert.match(kritiek.reden, /verboden zonder een expliciete menselijke beslissing/);
  assert.equal(magAutomatisch('hulpdienst-inzetten').niveau, 4);
  assert.equal(magAutomatisch('weg-afsluiten').niveau, 4);
  assert.equal(magAutomatisch('onderhoud-plannen').niveau, 2, 'voorbereiden mag, uitvoeren niet');
  assert.equal(magAutomatisch('melding-samenvoegen').mag, true, 'meldingen samenvoegen mag wel: laag-risico en omkeerbaar');
  assert.equal(magAutomatisch('iets-verzonnens').mag, false, 'wat niet op de lijst staat, gebeurt niet vanzelf');
  assert.match(magAutomatisch('iets-verzonnens').reden, /onbekende handeling/);
});

/* ---------------- 7b. Elke bestuursroute: een poort en een antwoord ----------------

   Zelfde vorm als in test/stadsweefsel.test.js, en om dezelfde twee redenen:
   deze toets loopt ze allemaal echt af (een route die zijn poort verliest valt
   hier om), en de paden staan voluit zodat de statische dekkingsteller in
   scripts/keuring.js ze ziet -- die vindt het pad niet in de vorm
   `oapi('weefsel/onderhoud')`, want daar staat het in twee stukken.

   MUTATIE (RAAK, alleen deze toets): officeAuth van
   /api/office/weefsel/begroting vervangen door een doorgeefluik -> de route
   gaf 200 op een onzin-token. */
const BESTUUR_ROUTES = [
  '/api/office/weefsel/onderhoud', '/api/office/weefsel/onderhoud/plan', '/api/office/weefsel/onderhoud/gun',
  '/api/office/weefsel/contracten', '/api/office/weefsel/contract/maak', '/api/office/weefsel/contract/zet',
  '/api/office/weefsel/prestatie', '/api/office/weefsel/indicatoren', '/api/office/weefsel/wijken',
  '/api/office/weefsel/leefomgeving', '/api/office/weefsel/begroting', '/api/office/weefsel/doel/maak',
  '/api/office/weefsel/project/maak', '/api/office/weefsel/project', '/api/office/weefsel/project/koppel',
  '/api/office/weefsel/project/sluit', '/api/office/weefsel/energie', '/api/office/weefsel/energie/advies',
  '/api/office/weefsel/energie/opdracht', '/api/office/weefsel/energie/intrek', '/api/office/weefsel/klimaat',
  '/api/office/weefsel/klimaat/kenmerk', '/api/office/weefsel/simulaties', '/api/office/weefsel/simuleer'
];
test('elke bestuursroute staat achter de kantoordeur en antwoordt zonder serverfout', async () => {
  assert.ok(BESTUUR_ROUTES.length >= 24, 'de lijst dekt de hele bestuurskant');
  for (const vol of BESTUUR_ROUTES) {
    const pad = vol.slice(5);
    const zonder = await api(pad, {}, 'onzin-token');
    assert.ok(zonder.status === 401 || zonder.status === 403, vol + ' is dicht zonder kantoorinlog (gaf ' + zonder.status + ')');
    const open = await api(pad, { naam: 'Aïsha' }, office);
    assert.ok(open.status < 500, vol + ' gaf een serverfout (' + open.status + ')');
    assert.ok(Object.keys(open.body).length > 0, vol + ' gaf geen JSON-antwoord -- bestaat de route nog?');
  }
});

/* ---------------- 8. De drie naden ---------------- */
/* MUTATIE (RAAK, alleen deze toets): de straatzoeker in geografie.js altijd
   null laten geven -> de gemeentemelding zonder GPS viel weer buiten het
   weefsel en de toets zakte. Tweede mutatie, ook RAAK: in gemeente/meldingen.js
   het sluiten van de zaak bij 'opgelost' weghalen -> de zaak bleef open. */
test('de naden: een melding zonder GPS landt op straatnaam, en de gemeente sluit de zaak echt', async () => {
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) })).json();

  // zonder positie, met een straatnaam in de tekst
  const m = await api('gemeente/meld', { categorie: 'wegdek', tekst: 'flink gat in het asfalt op de Boulevardlaan' }, l.token);
  assert.equal(m.status, 200);
  assert.ok(m.body.melding.zaak, 'de melding kreeg een stadszaak zonder dat er GPS bij zat: ' + m.body.melding.zaak);
  const zaak = (await oapi('weefsel/zaak', { id: m.body.melding.zaak })).body.zaak;
  assert.match(zaak.plaats, /Boulevard/, 'op de goede plek: ' + zaak.plaats);

  // een melding waarin geen enkele straat of zone voorkomt, landt bewust NIET
  const vaag = await api('gemeente/meld', { categorie: 'wegdek', tekst: 'ergens een kuil, geen idee waar precies' }, l.token);
  assert.equal(vaag.status, 200, 'de melding zelf gaat gewoon door');
  assert.equal(vaag.body.melding.zaak, null, 'maar hij krijgt geen gegokte plek in het weefsel');

  /* En als de GEMEENTE hem oplost, gaat de zaak in het weefsel ook dicht. Dat
     loopt via de echte deur van een gemeente-medewerker (de partner-inlog met
     personeels-PIN), want dat is de weg waarlangs het in het echt gebeurt. */
  assert.equal(zaak.status, 'open');
  const roster = await api('supplier/roster', { code: 'GEMEENTE' });
  const man = roster.body.staff.find(x => x.role === 'manager');
  const glog = await api('supplier/login', { code: 'GEMEENTE', staffId: man.id, pin: '1234' });
  assert.ok(glog.body.token, 'de gemeente-medewerker logt in');
  const zet = await api('gemeente/melding/zet', { ref: m.body.melding.ref, status: 'opgelost', update: 'asfalt gedicht' }, glog.body.token);
  assert.equal(zet.status, 200);
  const na = (await oapi('weefsel/zaak', { id: m.body.melding.zaak })).body.zaak;
  assert.equal(na.status, 'klaar', 'opgelost bij de gemeente is opgelost in de stad');
  assert.match(na.klaarDoor, /\w/, 'met een naam erbij');
});
