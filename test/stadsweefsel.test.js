/* HET STADSWEEFSEL: de laag die van losse stadssystemen een stad maakt.

   Getest, en per toets is de bewering met een MUTATIE nagetrokken (de lat,
   regel 2). De twaalf mutaties staan per blok, met wat er ECHT van zakte --
   alle twaalf zijn gedraaid en alle twaalf beten (RAAK), geen enkele sloeg af.
   Waar een mutatie meer dan een toets meenam staat dat erbij met de reden; geen
   enkele mutatie liet alles zakken, want dan bewijst hij niets.

   1. geografie: de boom stad->wijk->buurt->zone->straatsegment, en een positie
      die zichzelf terugvindt tot op het straatsegment.
   2. objectregister: het gebied is AFGELEID uit de positie, niet ingetikt; de
      onderhoudsstaat rekent zich uit; buiten de stad wordt geweigerd.
   3. relaties + afhankelijkheden: wat sleept wat mee.
   4. de zaakmotor: twee kanalen over dezelfde lantaarn = EEN zaak, twee
      kanalen over verschillende plekken = twee zaken.
   5. werkorders: klaarmelden boekt onderhoud MET kosten (een keer, niet twee)
      en sluit de zaak.
   6. de gedeelde bovenstroomse oorzaak van meerdere zaken.
   7. tijdreeksen: uur- en dagemmers, hogere gebieden gerekend uit hun zones,
      en de bewaartermijn die echt veegt.
   8. de naden: kern/stad leest zijn zones hier, een Stadsdoos staat op de
      kaart, een metingskanaal vult het geheugen, en de gemeente en Mijn Stad
      landen op dezelfde zaak.
   9. de keerzijde van samenvoegen: een melder ziet zijn eigen tekst en niet
      die van de buurman die dezelfde paal meldde. Dat gat maakte deze ronde
      zelf, en het is met een mutatie gevonden -- niet met een gedachte.
   10. alle weefselroutes zitten achter de kantoordeur.

   Draai los: node --test test/stadsweefsel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-weefsel-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const oapi = (pad, body) => api('office/' + pad, { ...(body || {}), naam: 'Aïsha' }, office);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-WEEFSEL-1' } });
  base = srv.base;
  const o = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  office = o.token;
  assert.ok(office, 'het kantoor logt in');
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = l.token;
  assert.ok(lid, 'en een lid ook');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------- 1. Eén geografische waarheid ---------------- */
/* MUTATIE (RAAK, alleen deze toets): STRAAT_M in geografie.js van 80 naar 0,
   zodat een punt nooit meer aan een straatsegment bindt. Toets 1 zakte op de
   bewering "tot op het straatsegment"; de acht andere toetsen bleven staan. */
test('de geografie: vijf niveaus, en een positie vindt zichzelf terug tot op de straat', async () => {
  const g = await oapi('weefsel/gebieden');
  assert.equal(g.status, 200);
  const per = (n) => g.body.gebieden.filter(x => x.niveau === n);
  assert.equal(per('stad').length, 1, 'een stad');
  assert.equal(per('wijk').length, 3, 'drie wijken');
  assert.equal(per('buurt').length, 3, 'drie buurten');
  assert.equal(per('zone').length, 6, 'zes zones');
  assert.ok(per('straatsegment').length >= 12, 'en straatsegmenten daaronder');
  // elke zone hangt onder een buurt, elke buurt onder een wijk: de boom klopt
  for (const z of per('zone')) assert.ok(per('buurt').some(b => b.id === z.ouder), z.naam + ' hangt onder een buurt');

  // een punt midden in Centrum kent zijn hele kruimelpad
  const centrum = per('zone').find(z => z.naam === 'Centrum');
  const p = await oapi('weefsel/plaats', { lat: centrum.centrum.lat, lng: centrum.centrum.lng });
  assert.equal(p.body.binnenStad, true);
  assert.equal(p.body.zone.naam, 'Centrum');
  assert.ok(p.body.straat && /Centrum/.test(p.body.straat.naam), 'tot op het straatsegment: ' + JSON.stringify(p.body.straat));
  assert.deepEqual(p.body.pad.map(x => x.niveau), ['stad', 'wijk', 'buurt', 'zone', 'straatsegment']);

  // een punt in een andere zone geeft een ANDERE zone (zones overlappen niet)
  const marina = per('zone').find(z => z.naam === 'Marina');
  const p2 = await oapi('weefsel/plaats', { lat: marina.centrum.lat, lng: marina.centrum.lng });
  assert.equal(p2.body.zone.naam, 'Marina');
  assert.notEqual(p2.body.zone.id, p.body.zone.id);

  // buiten de stad is geen plaats, en dat zegt het antwoord ook
  const buiten = await oapi('weefsel/plaats', { lat: 52.37, lng: 4.9 });
  assert.equal(buiten.body.binnenStad, false, 'Amsterdam ligt niet in deze stad');
  assert.equal((await oapi('weefsel/plaats', { lat: null, lng: null })).status, 400, 'een ontbrekende positie wordt geweigerd, niet 0,0');
});

/* ---------------- 2. Het objectregister ---------------- */
/* MUTATIE (RAAK): in objecten.js het gebied op de eerste zone gezet in plaats
   van op de uitkomst van geo.plaats(). Toets 2 zakte op "het gebied is
   AFGELEID uit de positie". Toets 7 zakte mee, en terecht: als elk object in
   dezelfde zone belandt, komen ook alle metingen in een emmer -- dat is
   dezelfde fout twee lagen verderop en geen te grove mutatie. */
test('het objectregister: plaats afgeleid, beheercijfers uitgerekend, buiten de stad geweigerd', async () => {
  const beeld = (await oapi('weefsel')).body;
  assert.ok(beeld.objecten.totaal >= 60, 'de stad staat vol objecten: ' + beeld.objecten.totaal);
  assert.ok(beeld.objecten.vervangingswaarde > 1000000, 'met een vervangingswaarde: ' + beeld.objecten.vervangingswaarde);
  assert.ok(beeld.objecten.perSoort.lantaarn >= 30 && beeld.objecten.perSoort.gemaal >= 3);

  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Groenzone');
  const maak = await oapi('weefsel/object/maak', { soort: 'boom', objectNaam: 'Plataan bij de vijver',
    lat: zone.centrum.lat, lng: zone.centrum.lng, bouwjaar: 1975, beheerder: 'Groenbeheer Zuid' });
  assert.equal(maak.status, 200);
  const o = maak.body.object;
  assert.equal(o.soort, 'boom');
  assert.match(o.plaats, /Groenzone/, 'het gebied is AFGELEID uit de positie: ' + o.plaats);
  assert.equal(o.vervangingsjaar, 1975 + 80, 'levensduur uit de soort, niet uit de invoer');
  assert.ok(o.restlevensduur < 40 && o.restlevensduur > 20, 'restlevensduur uitgerekend: ' + o.restlevensduur);
  assert.equal(o.beheerder, 'Groenbeheer Zuid');

  // buiten de stad, onbekende soort en een ontbrekende positie: alle drie een nette weigering
  assert.equal((await oapi('weefsel/object/maak', { soort: 'boom', lat: 52.37, lng: 4.9 })).status, 400);
  assert.equal((await oapi('weefsel/object/maak', { soort: 'ufo', lat: zone.centrum.lat, lng: zone.centrum.lng })).status, 400);
  assert.equal((await oapi('weefsel/object/maak', { soort: 'boom' })).status, 400);

  // de staat bijwerken loopt met naam door het auditlog
  const zet = await oapi('weefsel/object/zet', { id: o.id, conditie: 5, status: 'storing' });
  assert.equal(zet.body.object.conditieLabel, 'slecht');
  assert.equal((await oapi('weefsel/object/zet', { id: o.id, conditie: 9 })).status, 400, 'de conditieschaal loopt tot 6');
  const board = (await oapi('boardroom')).body;
  assert.ok((board.audit || []).some(a => /Stadsobject toegevoegd: Plataan/.test(a.wat)), 'het toevoegen staat in het auditlog');

  // en hij staat op de aandachtslijst: conditie 5 vraagt om aandacht zonder dat iemand belde
  const aandacht = (await oapi('weefsel/aandacht')).body;
  assert.ok(aandacht.objecten.some(x => x.id === o.id && /conditie 5/.test(x.reden)), 'conditie 5 staat op de aandachtslijst');
});

/* ---------------- 3. Afhankelijkheden ---------------- */
/* MUTATIE (RAAK): in relaties.js de seed van de voedt-randen uitgezet. Toets 3
   zakte (de uitval raakte niets meer), en toets 6 zakte mee omdat een gedeelde
   oorzaak zonder randen niet bestaat -- dat is precies wat deze twee toetsen
   samen beweren, niet een mutatie die te breed sloeg. */
test('afhankelijkheden: een transformator sleept zijn wijk mee, een lantaarn kent zijn bron', async () => {
  const trafo = (await oapi('weefsel/objecten', { soort: 'transformator' })).body.objecten[0];
  const uit = await oapi('weefsel/uitval', { id: trafo.id, minuten: 45 });
  assert.equal(uit.status, 200);
  assert.ok(uit.body.aantal >= 10, 'er hangt een wijk aan: ' + uit.body.aantal + ' objecten');
  assert.ok(uit.body.perSoort.lantaarn >= 6, 'waaronder lantaarns');
  assert.ok(uit.body.domeinen.includes('licht'), 'en het raakt het lichtdomein');
  assert.ok(Object.keys(uit.body.perGebied).length >= 2, 'verspreid over meerdere zones');
  assert.match(uit.body.let_op, /berekening/, 'het antwoord zegt zelf dat het een berekening is, geen meting');
  assert.equal((await oapi('weefsel/uitval', { id: 'O-bestaatniet' })).status, 404);

  // en andersom: een lantaarn weet waar hij van afhangt
  const lantaarn = (await oapi('weefsel/objecten', { soort: 'lantaarn' })).body.objecten[0];
  const keten = await oapi('weefsel/keten', { id: lantaarn.id });
  assert.ok(keten.body.bovenstrooms.some(x => x.soort === 'transformator'), 'de lantaarn kent zijn voedingsbron');
  assert.equal(keten.body.benedenstrooms.length, 0, 'en er hangt niets onder een lantaarn');
});

/* ---------------- 4. Eén zaakmotor voor alle kanalen ---------------- */
/* MUTATIE (RAAK): zelfdeZaak() in zaken.js altijd null laten geven. Toets 4
   zakte op de duplicaat-bewering, en toets 8 zakte mee omdat de gemeentemelding
   dan naast de bewonersmelding komt te staan in plaats van erbij -- dat is
   dezelfde belofte, gemeten aan de andere kant van het huis. */
test('de zaakmotor: twee kanalen over dezelfde paal worden EEN zaak, verderop een tweede', async () => {
  const lantaarn = (await oapi('weefsel/objecten', { soort: 'lantaarn' })).body.objecten[0];

  // kanaal 1: de telefoon op het kantoor
  const a = await oapi('weefsel/waarneming', { kanaal: 'telefoon', categorie: 'verlichting',
    tekst: 'lantaarn brandt niet, het is er pikdonker', lat: lantaarn.lat, lng: lantaarn.lng });
  assert.equal(a.status, 200);
  assert.equal(a.body.duplicaat, false, 'de eerste melding opent een zaak');
  assert.equal(a.body.zaak.object.id, lantaarn.id, 'en de zaak hangt aan het OBJECT, niet aan een vage plek');

  // kanaal 2: een ambtenaar die vlak ernaast staat -> dezelfde zaak
  const b = await oapi('weefsel/waarneming', { kanaal: 'ambtenaar', categorie: 'verlichting',
    tekst: 'donkere paal gezien tijdens de ronde', lat: lantaarn.lat + 0.0002, lng: lantaarn.lng });
  assert.equal(b.body.duplicaat, true, 'de tweede waarneming hoort bij dezelfde zaak');
  assert.equal(b.body.zaak.ref, a.body.zaak.ref);
  assert.equal(b.body.zaak.melders, 2, 'twee waarnemingen op een zaak');
  assert.deepEqual([...b.body.zaak.kanalen].sort(), ['ambtenaar', 'telefoon'], 'beide kanalen staan erbij');

  // dezelfde categorie, maar in een andere zone -> een eigen zaak
  const ver = await oapi('weefsel/waarneming', { kanaal: 'telefoon', categorie: 'verlichting',
    tekst: 'lamp stuk aan de kade in de haven', gebied: 'Marina' });
  assert.equal(ver.body.duplicaat, false, 'een probleem verderop is een eigen zaak');
  assert.notEqual(ver.body.zaak.ref, a.body.zaak.ref);

  // een waarneming zonder plaats of met een te korte tekst wordt geweigerd
  assert.equal((await oapi('weefsel/waarneming', { categorie: 'verlichting', tekst: 'donker hier' })).status, 400, 'zonder plaats geen zaak');
  assert.equal((await oapi('weefsel/waarneming', { categorie: 'verlichting', tekst: 'x', gebied: 'Marina' })).status, 400);
  assert.equal((await oapi('weefsel/waarneming', { categorie: 'onzin', tekst: 'iets kapots hier', gebied: 'Marina' })).status, 400);

  // de prioriteit komt uit de categorie, niet uit de invoer
  const riool = await oapi('weefsel/waarneming', { kanaal: 'telefoon', categorie: 'riool',
    tekst: 'water komt omhoog uit de put', gebied: 'Boulevard' });
  assert.equal(riool.body.zaak.prioriteit, 'hoog', 'riool weegt zwaarder dan verlichting');
});

/* ---------------- 5. Van zaak naar uitgevoerd werk ---------------- */
/* MUTATIE (RAAK, alleen deze toets): de onderhoudsboeking in zaakKlaar()
   teruggezet, naast die van de werkorder. Toets 5 zakte op "precies EEN
   onderhoudsregel". Dat is geen verzonnen mutatie: zo stond het er eerst
   werkelijk, en het viel op omdat de historie twee keer dezelfde reparatie
   toonde -- een keer met kosten en een keer met nul. */
test('werkorders: klaarmelden boekt onderhoud MET kosten, precies een keer, en sluit de zaak', async () => {
  const container = (await oapi('weefsel/objecten', { soort: 'container' })).body.objecten[0];
  const z = await oapi('weefsel/waarneming', { kanaal: 'bedrijf', categorie: 'afval',
    tekst: 'container zit tjokvol en de klep klemt', lat: container.lat, lng: container.lng });
  assert.equal(z.body.zaak.object.id, container.id);

  // de zaak heeft meteen werk: een zaak zonder werkorder is een wachtrij
  const werk = (await oapi('weefsel/werk')).body;
  const wo = werk.werkorders.find(w => w.zaakRef === z.body.zaak.ref);
  assert.ok(wo, 'er staat werk klaar voor deze zaak');
  assert.equal(wo.ploeg, 'reiniging', 'bij de juiste ploeg');
  assert.match(wo.plaats, /·/, 'met de plaats erbij: ' + wo.plaats);

  const klaar = await oapi('weefsel/werk/klaar', { id: wo.id, notitie: 'geleegd en klep gesmeerd', kosten: 85.5, uren: 0.75 });
  assert.equal(klaar.status, 200);
  assert.equal(klaar.body.zaakGesloten, z.body.zaak.ref, 'de laatste werkorder sluit de zaak');

  // precies EEN onderhoudsregel, met kosten en met de werkorder erbij
  const na = (await oapi('weefsel/object', { id: container.id })).body.object;
  assert.equal(na.onderhoud.length, 1, 'een handeling is een regel in de historie, niet twee');
  assert.equal(na.onderhoud[0].kosten, 85.5, 'met de kosten erin');
  assert.equal(na.onderhoud[0].werkorder, wo.id, 'en met de werkorder erbij');
  assert.ok(na.laatsteInspectie, 'de inspectiedatum schuift mee');

  // de zaak is dicht en komt niet meer op de werklijst
  assert.equal((await oapi('weefsel/zaak', { id: z.body.zaak.id })).body.zaak.status, 'klaar');
  assert.ok(!(await oapi('weefsel/werk')).body.werkorders.some(w => w.id === wo.id), 'klaar werk staat niet meer op de lijst');
  assert.equal((await oapi('weefsel/werk/klaar', { id: wo.id })).status, 400, 'twee keer klaarmelden kan niet');
  assert.equal((await oapi('weefsel/werk/klaar', { id: 'WO-BESTAATNIET' })).status, 404);
});

/* ---------------- 6. De gedeelde oorzaak ---------------- */
/* MUTATIE (RAAK, alleen deze toets): gemeenschappelijk() in afhankelijkheden.js
   null laten geven. Toets 6 zakte: er kwam geen oorzaakhint meer. */
test('de gedeelde oorzaak: drie donkere palen op een voedingsgroep wijzen naar de transformator', async () => {
  const wijk = (await oapi('weefsel/gebieden', { niveau: 'wijk' })).body.gebieden[0];
  const palen = (await oapi('weefsel/objecten', { soort: 'lantaarn', gebied: wijk.id })).body.objecten.slice(0, 3);
  assert.equal(palen.length, 3, 'drie palen in dezelfde wijk');
  for (const p of palen)
    await oapi('weefsel/waarneming', { kanaal: 'bewonersapp', categorie: 'verlichting', objectId: p.id,
      tekst: 'deze paal is al dagen donker', lat: p.lat, lng: p.lng });

  const zaken = (await oapi('weefsel/zaken', { categorie: 'verlichting' })).body;
  const hint = zaken.oorzaken.find(o => /verlichting/i.test(o.tekst));
  assert.ok(hint, 'de motor wijst een gedeelde oorzaak aan');
  assert.equal(hint.object.soort, 'transformator', 'en dat is de voedingsbron, niet een van de palen');
  assert.match(hint.tekst, /Controleer die eerst/, 'als hint voor een mens, niet als besluit');
});

/* ---------------- 7. Het geheugen ---------------- */
/* DRIE MUTATIES, want deze toets draagt drie verschillende beweringen.
   (a) RAAK, alleen deze toets: in tijdreeksen.js alleen nog de uuremmer
       bijgewerkt -> zakt op de dagreeks terwijl de uurreeks blijft staan.
   (b) RAAK, deze toets en toets 8: de Stadsdozen geen plaats laten krijgen
       (weefselDoosPlaats altijd null) -> geen enkele meting landt nog.
   (c) RAAK, alleen de tellerbewering: een sensorsoort ('geluid') laten
       weigeren in boek() -> de uur- en dagreeksen van lucht blijven gewoon
       staan en alleen `nietGeboekt` slaat aan (3 !== 0). Die derde is er
       omdat (b) de toets al eerder liet zakken en de TELLER dus nog nergens
       door bewezen was -- een meter die je niet hebt zien uitslaan, meet
       niets (de lat, regel 10). */
test('tijdreeksen: uur- en dagemmers, hogere gebieden gerekend, en de bewaartermijn veegt echt', async () => {
  // de demovloot meet vanzelf; een paar keer het bord opvragen zet metingen door
  for (let i = 0; i < 2; i++) await oapi('stad');
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Centrum');

  const uur = await oapi('weefsel/reeks', { sens: 'lucht', gebied: zone.id, laag: 'uur' });
  assert.equal(uur.status, 200);
  assert.ok(uur.body.punten.length >= 1, 'er staat een uuremmer voor Centrum');
  const punt = uur.body.punten[uur.body.punten.length - 1];
  assert.ok(punt.n >= 1 && punt.gem > 0 && punt.min <= punt.gem && punt.gem <= punt.max, 'de emmer telt n, gem, min en max: ' + JSON.stringify(punt));
  const dag = await oapi('weefsel/reeks', { sens: 'lucht', gebied: zone.id, laag: 'dag' });
  assert.ok(dag.body.punten.length >= 1, 'en een dagemmer');

  /* Het stadscijfer wordt GEREKEND uit de zones eronder, niet apart bewaard.
     Twee langs verschillende weg verkregen getallen tegen elkaar: het aantal
     metingen stadsbreed is minstens dat van een enkele zone, en hij dekt meer
     zones. */
  const stad = await oapi('weefsel/reeks', { sens: 'lucht', laag: 'uur' });
  assert.ok(stad.body.zones >= 6, 'stadsbreed telt over alle zones: ' + stad.body.zones);
  const somZone = uur.body.punten.reduce((s, p) => s + p.n, 0);
  const somStad = stad.body.punten.reduce((s, p) => s + p.n, 0);
  assert.ok(somStad >= somZone, 'de stad telt minstens wat een zone telt (' + somStad + ' >= ' + somZone + ')');
  assert.equal((await oapi('weefsel/reeks', { sens: 'lucht', gebied: 'G-bestaatniet' })).status, 404);

  /* En de tegenhanger van "er staan emmers": staat er niets NAAST de emmers?
     Een geheugen dat stilletjes de helft mist ziet er precies zo uit als een
     geheugen dat werkt, dus de gemiste metingen worden geteld en horen op nul
     te staan zolang elke Stadsdoos een plaats heeft. */
  assert.equal((await oapi('weefsel')).body.reeksen.nietGeboekt, 0, 'geen enkele meting is buiten het geheugen gevallen');

  // de bewaartermijn: verse emmers blijven staan, en de termijn staat erbij
  const voor = (await oapi('weefsel')).body.reeksen.emmers;
  assert.ok(voor > 0, 'er staan emmers: ' + voor);
  const veeg = await oapi('weefsel/reeks/veeg');
  assert.equal(veeg.body.verwijderd, 0, 'niets van vandaag is over de termijn');
  assert.ok(veeg.body.bewaartermijnen.uur >= 1 && veeg.body.bewaartermijnen.dag > veeg.body.bewaartermijnen.uur,
    'de dagemmers blijven langer dan de uuremmers');
  assert.equal((await oapi('weefsel')).body.reeksen.emmers, voor, 'en de verse emmers staan er nog');
});

/* ---------------- 8. De naden met de rest van het huis ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in kern/stad/index.js zones() een eigen
   lijstje laten teruggeven in plaats van de geografie te lezen. Toets 8 zakte
   meteen op "een zonelijst, niet twee" -- precies de dubbele waarheid die deze
   laag wegnam. */
test('de naden: de stad leest zijn zones hier, een Stadsdoos staat op de kaart, kanalen delen een zaak', async () => {
  // 1. de zones van kern/stad komen uit de geografie van het weefsel
  const zonesWeefsel = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.map(z => z.naam).sort();
  const zonesStad = (await api('stad/bewoner', {}, lid)).body.zones.slice().sort();
  assert.deepEqual(zonesStad, zonesWeefsel, 'een zonelijst, niet twee');

  // 2. elke Stadsdoos is een object met een plaats
  const dozen = (await oapi('stad')).body.nodes;
  const sensoren = (await oapi('weefsel/objecten', { soort: 'sensor' })).body.objecten;
  assert.ok(sensoren.length >= dozen.length, 'elke doos staat in het objectregister: ' + sensoren.length + ' >= ' + dozen.length);
  assert.ok(sensoren.every(s => s.lat && s.lng && s.plaats), 'met een positie en een gebied');
  const kaart = (await oapi('weefsel/kaart')).body;
  assert.ok(kaart.objecten.some(o => o.soort === 'sensor'), 'en hij staat op de kaart');
  assert.ok(kaart.grenzen.length === 6 && kaart.grenzen[0].geometrie.punten.length >= 4, 'met de zonegrenzen erbij');

  // 3. een bewonersmelding uit Mijn Stad is een zaak in het weefsel
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Bedrijvenkwartier');
  const m = await api('stad/melding', { zone: 'Bedrijvenkwartier', soort: 'afval', tekst: 'container omgevallen op het plein' }, lid);
  assert.equal(m.status, 200);
  const zaak = (await oapi('weefsel/zaak', { id: m.body.melding.id })).body.zaak;
  assert.equal(zaak.categorie, 'afval', 'het woord "afval" van de bewoner is de stedelijke categorie');
  assert.equal(zaak.kanalen[0], 'bewonersapp');

  // 4. en een gemeentemelding op dezelfde plek landt op DEZELFDE zaak
  const g = await api('gemeente/meld', { categorie: 'afval', tekst: 'omgevallen container, rommel op straat',
    lat: zaak.lat, lng: zaak.lng }, lid);
  assert.equal(g.status, 200);
  assert.equal(g.body.melding.zaak, zaak.ref, 'de gemeentemelding hangt aan dezelfde zaak: ' + g.body.melding.zaak);
  assert.equal(g.body.melding.samengevoegd, true, 'en zegt dat hij is samengevoegd');
  const na = (await oapi('weefsel/zaak', { id: zaak.id })).body.zaak;
  assert.equal(na.melders, 2, 'twee kanalen, een zaak');
  assert.deepEqual([...na.kanalen].sort(), ['bewonersapp', 'gemeente']);

  // 5. de veld-app ziet de klus, en klaarmelden komt bij de bewoner terug
  const werk = (await oapi('stad/werk')).body;
  const klus = werk.klussen.find(k => k.sleutel === 'melding:' + zaak.id);
  assert.ok(klus, 'de zaak staat als klus op de veldlijst');
  await oapi('stad/werk/klaar', { sleutel: klus.sleutel, naam: 'Bram', notitie: 'opgeruimd' });
  const mijn = (await api('stad/bewoner', {}, lid)).body.mijnMeldingen.find(x => x.id === zaak.id);
  assert.equal(mijn.status, 'klaar', 'de melder ziet zijn melding als opgelost');
  assert.equal(mijn.melders, 2, 'en dat er meer mensen over meldden');

  // 6. de vrije tekst van bewoners gaat NIET de AI-dataset in
  const ai = (await oapi('aidata')).body;
  assert.ok(!Object.keys(ai.bronnen).some(b => /weefsel|zaak/i.test(b)), 'de zakentak is geen AI-bron: ' + Object.keys(ai.bronnen).join(','));
});

/* ---------------- 9b. De beheerhandelingen ---------------- */
/* MUTATIE (RAAK, alleen deze toets): in werkorders.js de weigering van
   status:'klaar' via werkorderZet weghalen, zodat een werkorder buiten de
   klaarmelding om dicht kan. Deze toets zakte op precies die bewering -- en dat
   is er een die telt: langs die weg wordt er geen onderhoud geboekt, geen
   kosten vastgelegd en geen zaak gesloten, en dan is het werk "af" zonder dat
   de stad er iets van heeft geleerd. */
test('beheer: een gebied erbij, een relatie erbij en weer weg, werk toewijzen, een zaak verzetten', async () => {
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Boulevard');

  // een straatsegment erbij, onder de juiste ouder
  const g = await oapi('weefsel/gebied/maak', { niveau: 'straatsegment', gebiedNaam: 'Havenkade', ouder: zone.id,
    punten: [{ lat: zone.geometrie.punten[0].lat, lng: zone.geometrie.punten[0].lng }, { lat: zone.centrum.lat, lng: zone.centrum.lng }] });
  assert.equal(g.status, 200);
  assert.equal(g.body.gebied.geometrie.soort, 'lijn', 'twee punten is een lijn');
  // een zone ONDER een straatsegment hangen mag niet: de boom loopt maar een kant op
  assert.equal((await oapi('weefsel/gebied/maak', { niveau: 'zone', gebiedNaam: 'Onzin', ouder: g.body.gebied.id,
    punten: [{ lat: zone.centrum.lat, lng: zone.centrum.lng }] })).status, 400);
  /* Een gebied zonder ouder hangt nergens onder. Dat werd vroeger
     tegengehouden door de coordinaattoets tegen de vaste rechthoek van Ibiza;
     sinds het weefsel meerdere steden draagt is dat de verkeerde reden -- een
     ouderloze buurt hoort dan bij GEEN stad en valt uit elke stad-gescopete
     vraag. De eis staat nu op de ouder zelf. */
  const wees = await oapi('weefsel/gebied/maak', { niveau: 'buurt', gebiedNaam: 'Amsterdam-Zuid', punten: [{ lat: 52.34, lng: 4.87 }] });
  assert.equal(wees.status, 400);
  assert.match(wees.body.error, /hangt onder een gebied/);
  // en een stad maak je niet zo: die heeft zijn hele raster nodig
  assert.equal((await oapi('weefsel/gebied/maak', { niveau: 'stad', gebiedNaam: 'Losse stad', punten: [{ lat: 52.34, lng: 4.87 }] })).status, 400);

  // een relatie leggen tussen twee echte objecten, en weer weghalen
  const gemaal = (await oapi('weefsel/objecten', { soort: 'gemaal' })).body.objecten[0];
  const put = (await oapi('weefsel/objecten', { soort: 'put' })).body.objecten[0];
  const r = await oapi('weefsel/relatie/maak', { van: put.id, naar: gemaal.id, soort: 'afvoer-naar' });
  assert.equal(r.status, 200);
  assert.ok((await oapi('weefsel/relaties', { objectId: put.id })).body.relaties.some(x => x.naar === gemaal.id));
  assert.equal((await oapi('weefsel/relatie/maak', { van: put.id, naar: put.id, soort: 'voedt' })).status, 400, 'een object hangt niet aan zichzelf');
  assert.equal((await oapi('weefsel/relatie/maak', { van: put.id, naar: gemaal.id, soort: 'onzin' })).status, 400);
  assert.equal((await oapi('weefsel/relatie/weg', { id: r.body.relatie.id })).status, 200);
  assert.equal((await oapi('weefsel/relatie/weg', { id: r.body.relatie.id })).status, 404, 'twee keer weghalen kan niet');

  /* Gepland werk zonder dat iemand belde: een inspectie op een object. Dat is
     de helft van het werk van een stad, en die helft komt nooit uit een zaak. */
  const brug = (await oapi('weefsel/objecten', { soort: 'gemaal' })).body.objecten[1];
  const wo = await oapi('weefsel/werk/maak', { objectId: brug.id, omschrijving: 'jaarlijkse inspectie pompkelder', soort: 'inspectie', ploeg: 'techniek' });
  assert.equal(wo.status, 200);
  assert.equal(wo.body.werkorder.zaakId, null, 'werk kan bestaan zonder zaak');
  assert.equal(wo.body.werkorder.status, 'open');
  const zet = await oapi('weefsel/werk/zet', { id: wo.body.werkorder.id, uitvoerder: 'Bram' });
  assert.equal(zet.body.werkorder.status, 'toegewezen', 'een uitvoerder erop zet hem op toegewezen');
  assert.equal((await oapi('weefsel/werk/zet', { id: wo.body.werkorder.id, status: 'klaar' })).status, 400,
    'klaarmelden gaat NIET langs deze weg: daar horen naam, kosten en uren bij');
  assert.equal((await oapi('weefsel/werk/maak', { objectId: brug.id })).status, 400, 'wat moet er gebeuren?');

  // een zaak verzetten met een notitie, en de trendvraag die eerlijk "weet ik niet" zegt
  const zaak = (await oapi('weefsel/zaken', {})).body.zaken[0];
  const zz = await oapi('weefsel/zaak/zet', { id: zaak.id, status: 'in-behandeling', prioriteit: 'urgent', notitie: 'ploeg is onderweg' });
  assert.equal(zz.body.zaak.status, 'in-behandeling');
  assert.equal(zz.body.zaak.prioriteit, 'urgent');
  assert.equal(zz.body.zaak.notities[0].tekst, 'ploeg is onderweg');
  assert.equal((await oapi('weefsel/zaak/zet', { id: zaak.id, status: 'onzin' })).status, 400);
  const tr = await oapi('weefsel/trend', { sens: 'lucht', dagen: 7 });
  assert.equal(tr.status, 200);
  assert.equal(tr.body.richting, 'onbekend', 'een dag oude stad heeft geen vorige week');
  assert.match(tr.body.reden, /te weinig geschiedenis/, 'en zegt dat, in plaats van een percentage te verzinnen');
});

/* ---------------- 9b. Een straatnaam is invoer, geen patroon ----------------
   De straatzoeker bouwt van een gebiedsnaam een reguliere uitdrukking, en die
   naam komt van BUITEN: een ambtenaar typt hem in bij /weefsel/gebied/maak.
   Staat er een haakje of een punt in, dan hoort dat een letterlijk teken te
   zijn en geen stukje patroon -- anders werpt new RegExp en valt elke melding
   zonder GPS om, ook die over heel andere straten.

   Dit is met een mutatie nagetrokken en RAAK (alleen deze toets): in
   geografie.js uitTekst() de ontsnapping '\\$&' vervangen door letterlijke
   tekst. Zo stond het hier ECHT (commit 257bac8, kapotgegaan bij een
   zoek-vervang) en niemand zag het, omdat geen van de geseede straten een
   patroonteken in zijn naam heeft. */
test('een gebiedsnaam met haakjes is een naam en geen patroon', async () => {
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Groenzone');
  const naam = 'Sint-Jan (Oost)';
  const g = await oapi('weefsel/gebied/maak', { niveau: 'straatsegment', gebiedNaam: naam, ouder: zone.id,
    punten: [{ lat: zone.geometrie.punten[0].lat, lng: zone.geometrie.punten[0].lng }, { lat: zone.centrum.lat, lng: zone.centrum.lng }] });
  assert.equal(g.status, 200, 'de naam mag zo heten');

  // een melding zonder GPS die de straat noemt: hij moet er landen, niet omvallen
  const w = await oapi('weefsel/waarneming', { kanaal: 'telefoon', categorie: 'verlichting',
    tekst: 'lantaarn uit op de ' + naam + ' ter hoogte van nummer 4' });
  assert.equal(w.status, 200, 'geen serverfout op een naam met haakjes');
  assert.equal(w.body.zaak.gebied, g.body.gebied.id, 'en de zaak landt op precies dat segment');

  /* De haakjes mogen ook niets ANDERS gaan vangen. Ze WEGPOETSEN in plaats van
     ontsnappen is de voor de hand liggende verkeerde reparatie: dan zou
     "Sint-Jan Oost" zonder haakjes ineens deze straat worden. Hij hoort
     onvindbaar te zijn, en dan wordt er geen plek gegokt. */
  const w2 = await oapi('weefsel/waarneming', { kanaal: 'telefoon', categorie: 'afval',
    tekst: 'container omgevallen op de Sint-Jan Oost bij de hoek' });
  assert.equal(w2.status, 400, 'zonder haakjes is het een andere straat, en die bestaat niet');
  assert.match(w2.body.error, /Waar is het/);
});

/* ---------------- 10. Samenvoegen mag geen deur openzetten ---------------- */
/* Dit gat maakte het samenvoegen ZELF, en het is met een mutatie gevonden en
   niet met een gedachte: zolang elke melding een eigen dossier was, kon een
   melder alleen zijn eigen tekst terugzien; zodra twee mensen op EEN zaak
   uitkomen, toonde de gewone zaakweergave hem de vrije tekst van zijn buurman.

   MUTATIE (RAAK, alleen deze toets): in kern/stadsweefsel/index.js
   weefselZakenVanMelder() de volle publiek()-weergave laten geven in plaats van
   voorMelder() -- precies zoals het er eerst stond. Deze toets zakt dan op de
   tekst van de buurman. */
test('een melder ziet zijn EIGEN tekst, niet die van de buurman op dezelfde zaak', async () => {
  /* TWEE ECHTE ACCOUNTS, en dat is hier het halve punt. Mijn eerste versie
     logde twee keer met /api/login?tier=rtg in -- dat is dezelfde demo-persona
     met dezelfde codenaam, dus de toets zakte terwijl de code klopte. Een
     privacytoets met een en dezelfde persoon aan beide kanten meet niets. */
  const maakLid = async (u) => {
    const r = await api('auth/register', { name: 'Buur ' + u, email: 'buur' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
    return r.body.token;
  };
  const melderA = await maakLid('11223344');
  const melderB = await maakLid('55667788');
  assert.ok(melderA && melderB && melderA !== melderB, 'twee verschillende leden');

  // twee leden melden dezelfde paal; de tweede tekst is herkenbaar
  const eerst = await api('stad/melding', { zone: 'Groenzone', soort: 'licht', tekst: 'de lamp bij mijn voordeur is stuk' }, melderA);
  assert.equal(eerst.status, 200);
  const tweede = await api('stad/melding', { zone: 'Groenzone', soort: 'licht', tekst: 'GEHEIM ik durf er s avonds niet langs' }, melderB);
  assert.equal(tweede.status, 200);
  assert.equal(tweede.body.samengevoegd, true, 'dezelfde zone en soort: het is dezelfde zaak');
  assert.equal(tweede.body.melding.id, eerst.body.melding.id);

  // het eerste lid ziet zijn eigen zin, en nergens die van de buurman
  const mijn = (await api('stad/bewoner', {}, melderA)).body.mijnMeldingen;
  const rij = mijn.find(x => x.id === eerst.body.melding.id);
  assert.ok(rij, 'zijn melding staat er');
  assert.match(rij.tekst, /mijn voordeur/, 'met zijn eigen woorden');
  assert.ok(!JSON.stringify(mijn).includes('GEHEIM'), 'en nergens de tekst van de buurman');
  assert.equal(rij.melders, 2, 'dat het er twee zijn mag hij wel weten: dat is geen gegeven van een ander');

  // en andersom precies zo
  const zijne = (await api('stad/bewoner', {}, melderB)).body.mijnMeldingen;
  assert.match(zijne.find(x => x.id === eerst.body.melding.id).tekst, /GEHEIM/, 'de buurman ziet wel zijn eigen zin');
  assert.ok(!JSON.stringify(zijne).includes('voordeur'), 'en niet die van het eerste lid');
});

/* ---------------- 11. Elke weefselroute: een poort en een antwoord ----------------

   De paden staan hier VOLUIT, en dat is een keuze met twee redenen.

   De eerste is de toets zelf: hij loopt ze allemaal af, dus een route die zijn
   poort verliest of stukgaat valt hier om -- ook een route die verder in geen
   enkele andere toets voorkomt.

   De tweede is een eerlijkheidspunt over een METER. De statische
   dekkingsindicator in scripts/keuring.js zoekt het pad als TEKST in de toetsen
   en vindt hem niet in de vorm `oapi('weefsel/objecten')`, want daar staat het
   pad in twee stukken. Dat is dezelfde blinde vlek waar de Rechterhand-suite
   op stukliep (zie de kop van die regel in keuring.js): de teller onderschat
   dan. Ze hier uitschrijven maakt die indicatie eerlijk -- en dat mag alleen
   omdat elke route hieronder in deze toets ook echt wordt AANGEROEPEN. Een pad
   in een commentaarregel zou de meter net zo goed oppoetsen, en dat zou hem
   bedriegen in plaats van repareren.

   MUTATIE (RAAK, alleen deze toets): officeAuth van
   /api/office/weefsel/objecten vervangen door een doorgeefluik -- de route gaf
   200 op een onzin-token. Let op de vorm: de toets eist 401 OF 403, en dat is
   een klasse. Een 404 telt hier bewust NIET als "geweigerd", want dan zou een
   route die helemaal verdwenen is als veilig gelden -- vandaar de tweede helft,
   die eist dat de route met een kantoorinlog wel degelijk ANTWOORDT. */
const WEEFSEL_ROUTES = [
  '/api/office/weefsel', '/api/office/weefsel/kaart', '/api/office/weefsel/gebieden',
  '/api/office/weefsel/plaats', '/api/office/weefsel/objecten', '/api/office/weefsel/object',
  '/api/office/weefsel/aandacht', '/api/office/weefsel/relaties', '/api/office/weefsel/keten',
  '/api/office/weefsel/zaken', '/api/office/weefsel/zaak', '/api/office/weefsel/werk',
  '/api/office/weefsel/reeks', '/api/office/weefsel/trend', '/api/office/weefsel/uitval',
  '/api/office/weefsel/object/maak', '/api/office/weefsel/object/zet',
  '/api/office/weefsel/relatie/maak', '/api/office/weefsel/relatie/weg',
  '/api/office/weefsel/gebied/maak', '/api/office/weefsel/waarneming',
  '/api/office/weefsel/zaak/zet', '/api/office/weefsel/werk/maak',
  '/api/office/weefsel/werk/zet', '/api/office/weefsel/werk/klaar',
  '/api/office/weefsel/reeks/veeg'
];
test('elke weefselroute staat achter de kantoordeur en antwoordt zonder serverfout', async () => {
  assert.ok(WEEFSEL_ROUTES.length >= 26, 'de lijst dekt het hele weefsel');
  for (const vol of WEEFSEL_ROUTES) {
    const pad = vol.slice(5);                       // zonder '/api/'
    const zonder = await api(pad, {}, 'onzin-token');
    assert.ok(zonder.status === 401 || zonder.status === 403, vol + ' is dicht zonder kantoorinlog (gaf ' + zonder.status + ')');
    const alsLid = await api(pad, {}, lid);
    assert.ok(alsLid.status === 401 || alsLid.status === 403, vol + ' is ook dicht voor een gewoon lid (gaf ' + alsLid.status + ')');

    /* En met de kantoorinlog: hij bestaat, hij draait, en hij valt niet om.
       Een lege body mag een nette 400 of 404 uit de HANDLER geven -- dat is
       iets anders dan een route die er niet is, en dat verschil zit hem in het
       JSON-antwoord: een onbekend pad valt door naar de statische laag en geeft
       geen JSON-lichaam terug. */
    const open = await api(pad, { naam: 'Aïsha' }, office);
    assert.ok(open.status < 500, vol + ' gaf een serverfout (' + open.status + ')');
    assert.ok(Object.keys(open.body).length > 0, vol + ' gaf geen JSON-antwoord -- bestaat de route nog?');
  }
});
