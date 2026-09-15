/* ============================================================================
   FOUNDATION CONNECT -- de grenzen die geen ketenproef van buitenaf kan zien.

   scripts/lusproef.js loopt de lus over een echte server: vijftien schakels en
   tien storingen. Wat die proef NIET kan, staat hier, en het zijn precies de
   twee soorten beweringen waar deze laag op staat of valt:

     1. DE OPSLAG ZELF. "Lezen verandert niets" is van buitenaf alleen
        waarneembaar aan wat er terugkomt; hier is db.data te lezen. Dat is geen
        detail: drie lezers maakten hun rij WEL aan, zonder save(), dus
        onzichtbaar tot een andere handeling toevallig opsloeg.
     2. WAT ER VANDAAG NOG NIET AANGESLOTEN IS. Schakel 8 van de lusproef staat
        open omdat geen enkele bron een maker draagt. Dat de haak WEL werkt
        zodra er een is, kan alleen hier bewezen worden -- door de resolver in
        te spuiten. Een open schakel in een ketenproef mag niet betekenen dat
        het mechanisme ongetoetst is.

   ELKE BEWERING IS MET EEN MUTATIE NAGETROKKEN (LAT-regel: een toets die je
   niet hebt zien zakken, is geen toets). Waar dat iets opleverde, staat het bij
   de toets.

   Draai los: node --test test/connect.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const lus = require('../server/kern/connect/lus');
const kring = require('../server/kern/connect/kring');
const ontdekking = require('../server/kern/connect/ontdekking');
const { maakConnect } = require('../server/kern/connect');
const { DOELEN } = require('../server/kern/leerstof');

const bouw = (extra) => {
  const db = { data: {} };
  let bewaard = 0;
  const c = maakConnect(Object.assign({ db, save: () => { bewaard++; }, crypto, DOELEN, rtfos: null }, extra || {}));
  return { db, c, saves: () => bewaard };
};

/* ---------------------------------------------------------------- 1 -- de lus */
test('1. een onbekend werkwoord verdwijnt niet stil maar komt terug met de reden', () => {
  const v = lus.verklaar(['ontdek', 'beloon', 'rangschik']);
  assert.deepEqual(v.werkwoorden, ['ontdek']);
  assert.equal(v.geweigerd.length, 2);
  for (const g of v.geweigerd) assert.ok(g.reden && g.reden.length > 20, 'elke weigering draagt een reden');
});

test('2. een voorwaarde wordt afgeleid en de ketting loopt door', () => {
  /* `help` hangt aan `verbind`; `deel` aan `maak`. Een ronde is niet genoeg als
     een afgeleide zelf nog een voorwaarde heeft -- daarom de lus in verklaar(). */
  const v = lus.verklaar(['help', 'deel']);
  assert.ok(v.werkwoorden.includes('verbind'), 'help sleept verbind mee');
  assert.ok(v.werkwoorden.includes('maak'), 'deel sleept maak mee');
});

test('3. de drie werkwoorden die een tweede mens raken komen apart terug', () => {
  const v = lus.verklaar(['ontdek', 'begrijp', 'doe', 'maak', 'deel', 'verbind', 'help', 'groei']);
  assert.deepEqual(v.bevestigtEenMens, ['deel', 'verbind', 'help']);
  /* De vlag staat op de LIJST en niet per werkwoord in de uitkomst: een lijst
     waar je doorheen moet lopen om de gevaarlijke eruit te halen, is een lijst
     waar iemand dat vergeet. */
  assert.ok(!v.werkwoorden.some(w => typeof w === 'object'));
});

test('4. wegvallen werkt de andere kant op en is niet de omgekeerde van verklaren', () => {
  const z = lus.zonder(['help', 'deel'], 'maak');
  assert.deepEqual(z.gevallen, ['maak', 'deel'], 'deel leunde op maak en valt mee om');
  assert.ok(z.werkwoorden.includes('help'), 'help leunde er niet op en blijft staan');
});

/* ------------------------------------------------------------- 5 -- de kring */
test('5. de kringladder loopt de goede kant op: dichtbij ziet wat verder reikt', () => {
  /* DE MUTATIE DIE DIT OPLEVERDE: hier stond `kijker >= doel`, en daarmee kon
     een gezinslid het publieke werk van zijn eigen kind niet zien. De twee
     trappen meten niet hetzelfde -- bereik tegenover nabijheid. */
  assert.equal(kring.magZien('publiek', 'gezin'), true, 'een gezinslid ziet iets publieks');
  assert.equal(kring.magZien('gezin', 'publiek'), false, 'een vreemde ziet het gezin niet');
  assert.equal(kring.magZien('alleenIk', 'alleenIk'), true, 'de maker ziet zijn eigen werk');
  assert.equal(kring.magZien('publiek', 'watdanook'), false, 'een onbekende relatie is DICHT');
});

test('6. een beschermd profiel gaat niet publiek en kan altijd versmallen', () => {
  const heen = kring.zet('team', 'publiek', { beschermd: true });
  assert.equal(heen.ok, false);
  assert.equal(heen.hoogste, 'team');
  /* De uitgang staat VOOR de grens in de code. Zou de beschermd-toets erboven
     staan, dan kan een kind zijn eigen werk niet meer terugtrekken zodra het
     per ongeluk in `team` stond -- een grens die de uitgang meeneemt. */
  const terug = kring.zet('team', 'alleenIk', { beschermd: true });
  assert.equal(terug.ok, true);
  assert.equal(terug.versmald, true);
});

/* --------------------------------------------------------- 7 -- de projectie */
test('7. een ontdekking met een cijfer of een persoonsgegeven valt HELEMAAL af', () => {
  const basis = { onderwerp: 'sterren', soort: 'video', titel: 'T', ingang: '/apps/media.html',
    herkomst: 'mediaos', dektNiet: 'x', kring: 'publiek', werkwoorden: ['ontdek'] };
  for (const veld of ['score', 'rang', 'populariteit', 'leeftijd', 'postcode', 'bsn']) {
    const r = ontdekking.projecteer(Object.assign({ [veld]: 1 }, basis));
    assert.equal(r.ok, false, veld + ' hoort geweigerd te worden');
    assert.equal(r.veld, veld);
  }
  /* Weigeren betekent hier: de HELE ontdekking valt af, niet het veld eruit
     strippen. Anders denkt de bron dat hij het heeft meegestuurd, en de
     volgende versie stuurt er twee. */
  assert.equal(ontdekking.projecteer(basis).ok, true);
});

test('8. een bron die zijn bereik niet noemt, hoort dat te LEZEN', () => {
  /* Hier viel het stil dicht op `alleenIk`. Veilig, en fout: een bron die zijn
     kring vergeet leverde ontdekkingen die NIEMAND te zien kreeg, zonder dat er
     iets klaagde -- de stille non-bezorging van kern/ontvanger.js. */
  const r = ontdekking.projecteer({ onderwerp: 's', soort: 'v', titel: 'T', ingang: '/a',
    herkomst: 'm', dektNiet: 'x', werkwoorden: ['ontdek'] });
  assert.equal(r.ok, false);
  assert.equal(r.veld, 'kring');
});

test('9. de ingang is een pad en nooit een handeling', () => {
  const basis = { onderwerp: 's', soort: 'v', titel: 'T', herkomst: 'm', dektNiet: 'x',
    kring: 'publiek', werkwoorden: ['ontdek'] };
  assert.equal(ontdekking.projecteer(Object.assign({ ingang: 'https://elders.nl' }, basis)).ok, false);
  assert.equal(ontdekking.projecteer(Object.assign({ ingang: '/apps/x.html' }, basis)).ok, true);
});

/* ---------------------------------------------------- 10 -- het leerdossier */
test('10. de trede met bewijskracht kan een mens niet zelf zetten', () => {
  const { c } = bouw();
  assert.equal(c.connectDossierNoteer('AB', { trede: 'onderwezen', onderwerp: 'koken', door: 'zelf' }).ok, false);
  assert.equal(c.connectDossierNoteer('AB', { trede: 'onderwezen', onderwerp: 'koken',
    door: 'eenAnder', bron: 'naklank:1' }).ok, true);
});

test('11. "gemaakt" zonder verwijzing naar het gemaakte wordt geweigerd', () => {
  const { c } = bouw();
  assert.equal(c.connectDossierNoteer('AB', { trede: 'gemaakt', onderwerp: 'koken', door: 'hetSysteem' }).ok, false);
  assert.equal(c.connectDossierNoteer('AB', { trede: 'gemaakt', onderwerp: 'koken',
    door: 'hetSysteem', bron: 'foto:9' }).ok, true);
});

test('12. de hoogste trede is per ONDERWERP en er komt nergens een totaal', () => {
  const { c } = bouw();
  c.connectDossierNoteer('AB', { trede: 'gezien', onderwerp: 'breuken', door: 'hetSysteem' });
  c.connectDossierNoteer('AB', { trede: 'gemaakt', onderwerp: 'koken', door: 'hetSysteem', bron: 'f:1' });
  const d = c.connectDossier('AB');
  assert.equal(d.perOnderwerp.length, 2);
  /* Geen niveau, geen score, geen totaal over onderwerpen heen: een getal over
     alle onderwerpen IS een niveau, hoe je het ook noemt. */
  for (const verboden of ['niveau', 'score', 'punten', 'rang']) {
    assert.ok(!(verboden in d), 'het dossier draagt geen "' + verboden + '"');
  }
  /* En het is niet op hoogte gesorteerd -- dat zou een ranglijst van je eigen
     leven zijn. `breuken` staat op gezien en toch vooraan, op alfabet. */
  assert.equal(d.perOnderwerp[0].onderwerp, 'breuken');
});

test('13. gezien en begrepen zijn een feit en geen teller', () => {
  const { c } = bouw();
  const een = c.connectOpen('AB', { id: 'les:1', onderwerp: 'koken', herkomst: 'leerstof' });
  const twee = c.connectOpen('AB', { id: 'les:1', onderwerp: 'koken', herkomst: 'leerstof' });
  assert.equal(een.nieuw, true);
  assert.equal(twee.nieuw, false, 'een tweede keer kijken is geen tweede feit');
  assert.equal(twee.ok, true, 'en het is geen fout');
  /* De vijf andere treden herhalen WEL: twee keer oefenen zijn twee
     oefeningen, en twee mensen die zeggen dat u hen hielp zijn twee mensen. */
  c.connectDossierNoteer('AB', { trede: 'geoefend', onderwerp: 'koken', door: 'hetSysteem' });
  c.connectDossierNoteer('AB', { trede: 'geoefend', onderwerp: 'koken', door: 'hetSysteem' });
  assert.equal(c.connectDossier('AB').totaal, 3);
});

/* ------------------------------------------------------------ 14 -- naklank */
test('14. de zes naklanken worden nooit tot een cijfer verwerkt', () => {
  const { c } = bouw();
  c.connectNaklank('werk:1', 'CD', 'geleerd');
  const t = c.connectNaklankTel('werk:1', 'CD');
  assert.equal(t.soorten.length, 6);
  for (const verboden of ['totaal', 'score', 'gemiddelde', 'rang']) {
    assert.ok(!(verboden in t), 'de teller draagt geen "' + verboden + '"');
  }
  assert.ok(t.nietGemeten && t.nietGemeten.length > 30, 'en zegt wat hij NIET zegt');
});

test('15. de maker komt uit een resolver en nooit uit de aanroep', () => {
  /* DIT IS SCHAKEL 8 VAN scripts/lusproef.js, die daar OPEN staat omdat geen
     enkele aangesloten bron een maker draagt. Hier is de resolver in te
     spuiten, en dan hoort de haak wel te lopen -- zodat een open schakel niet
     betekent dat het mechanisme ongetoetst is.

     WAT ER EERST MIS WAS: `maker` kwam uit het verzoek. Daarmee kon iedereen
     een regel `onderwezen` in het dossier van een willekeurig ander schrijven,
     in de enige trede met bewijskracht -- en de zelf-weigering sloeg nooit aan,
     want een verzonnen codenaam is per definitie niet gelijk aan de gever. */
  const { c } = bouw({ makerVan: (id) => id === 'werk:1' ? { sleutel: 'MAKER', onderwerp: 'koken' } : null });

  const los = c.connectNaklank('werk:onbekend', 'CD', 'geholpen');
  assert.equal(los.ok, true, 'de naklank wordt geteld -- hij gaat over het DING');
  assert.equal(los.dossier, null, 'maar er komt geen regel bij een maker');
  assert.ok(los.dossierReden, 'en de reden staat erbij');

  const raak = c.connectNaklank('werk:1', 'CD', 'geholpen');
  assert.equal(raak.dossier.ok, true, 'met een maker loopt de haak wel');
  const d = c.connectDossier('MAKER');
  assert.equal(d.perOnderwerp[0].trede, 'onderwezen');
  assert.equal(d.perOnderwerp[0].graad, 'bewezen', 'wat een ander bevestigt, is bewezen');
  assert.equal(d.regels[0].onderwerp, 'koken', 'het onderwerp komt ook uit de resolver');

  /* En op je eigen werk telt hij niet -- nu pas echt toetsbaar, want de maker
     staat vast. */
  assert.equal(c.connectNaklank('werk:1', 'MAKER', 'geholpen').ok, false);
});

/* --------------------------------------------------- 16 -- lezen is stil */
test('16. lezen laat de opslag volledig met rust', async () => {
  /* Van buitenaf niet te zien, en daarom staat deze toets hier en niet in de
     ketenproef. Drie lezers maakten hun rij WEL aan -- zonder save(), dus
     onzichtbaar tot een andere handeling toevallig opsloeg. Een route die
     `leest: true` heet en de opslag laat groeien, klopt niet met zijn eigen
     mutatiecontract en niemand zou het merken. */
  const { db, c, saves } = bouw();
  c.connectHorizon('AB');
  c.connectDossier('AB');
  c.connectNaklankTel('werk:1', 'AB');
  await c.connectOntdek('AB', { vandaag: '2026-09-15' });
  assert.deepEqual(db.data, {}, 'na alleen lezen staat er niets in de opslag');
  assert.equal(saves(), 0, 'en er is niet eens geprobeerd op te slaan');

  c.connectSignaal('AB', 'koken', 'meer');
  assert.ok(db.data.connect.horizon.AB, 'schrijven doet het wel');
});

/* -------------------------------------------------- 17 -- horizon en mixer */
test('17. de horizon weigert een contactgegeven als voorkeur', () => {
  const { c } = bouw();
  for (const niet of ['iemand@ergens.nl', '06 12345678', '2011 AB']) {
    assert.equal(c.connectSignaal('AB', niet, 'meer').ok, false, niet + ' is geen onderwerp');
  }
  assert.equal(c.connectSignaal('AB', 'fotografie', 'meer').ok, true);
});

test('18. "verras me" verzet de instelling van de mens niet', () => {
  const { c } = bouw();
  c.connectSchuif('AB', 10);
  const r = c.connectSignaal('AB', null, 'verras');
  assert.equal(r.eenmalig, true);
  assert.equal(r.bewaard, false);
  assert.equal(c.connectHorizon('AB').schuif, 10, 'de schuif van de mens staat er nog');
});

test('19. een voorkeur kan niet onbeperkt groeien', () => {
  const { c } = bouw();
  for (let i = 0; i < 20; i++) c.connectSignaal('AB', 'koken', 'meer');
  assert.equal(c.connectHorizon('AB').onderwerpen[0].gewicht, 3,
    'honderd keer drukken betekent hetzelfde als drie keer; anders wordt een voorkeur vanzelf de enige');
});

test('20. een motor zonder bron zegt dat hij niet kijkt', () => {
  const { c } = bouw();
  const m = c.connectMotoren();
  assert.equal(m.length, 8);
  const stil = m.filter(x => !x.aangesloten);
  assert.ok(stil.length > 0);
  for (const x of stil) assert.ok(x.reden, x.id + ' hoort zijn reden te dragen');
  /* "hier is geen gebied" is niet "hier is geen motor" (KAARTEN.md par. 6):
     een lijst die stilletjes korter is, leest als een lijst die compleet is. */
  for (const x of m) assert.ok(x.grond && x.dektNiet);
});

test('21. de schuif van de mens verdeelt de plekken, en niets anders doet dat', async () => {
  const { c } = bouw();
  c.connectSignaal('AB', 'voetbal', 'meer');
  c.connectSchuif('AB', 0);
  const vertrouwd = await c.connectOntdek('AB', { vandaag: '2026-09-15' });
  c.connectSchuif('AB', 100);
  const ontdekkend = await c.connectOntdek('AB', { vandaag: '2026-09-15' });
  assert.equal(vertrouwd.verdeling.ontdekken, 0);
  assert.equal(ontdekkend.verdeling.vertrouwd, 0);
  /* Geen plek draagt een score: er is niets om later op te optimaliseren. */
  for (const p of ontdekkend.plekken) {
    assert.ok(p.door && p.waarom, 'elke plek zegt wie hem koos en waarom');
    assert.ok(!('score' in p) && !('rang' in p));
  }
});

test('22. dezelfde dag geeft hetzelfde, een andere dag iets anders', async () => {
  /* Een lijst die bij elke aanraking verandert, is een gokkast -- en hij is
     bovendien niet na te rekenen, wat elke toets hierover waardeloos maakt. */
  const { c } = bouw();
  c.connectSignaal('AB', 'koken', 'meer');
  const a = await c.connectOntdek('AB', { vandaag: '2026-09-15' });
  const b = await c.connectOntdek('AB', { vandaag: '2026-09-15' });
  const c2 = await c.connectOntdek('AB', { vandaag: '2026-10-02' });
  const ids = (r) => r.plekken.map(p => p.ontdekking.id).join('|');
  assert.equal(ids(a), ids(b), 'twee keer verversen op dezelfde dag geeft hetzelfde');
  assert.notEqual(ids(a), ids(c2), 'een andere dag geeft iets anders');
});

test('23. de lus komt van een alledaags onderwerp bij een vak waar niet om gevraagd is', async () => {
  const { c } = bouw();
  c.connectSignaal('AB', 'voetbal', 'meer');
  const r = await c.connectOntdek('AB', { vandaag: '2026-09-15' });
  const brug = r.plekken.find(p => p.ontdekking.soort === 'vraag');
  assert.ok(brug, 'er is een brug');
  assert.notEqual(brug.ontdekking.onderwerp, 'voetbal', 'en hij komt ergens anders uit');
  /* De brug draagt zijn graad: niemand heeft gemeten dat hij werkt. */
  assert.ok(/vermoed|verklaard/.test(String(brug.ontdekking.zekerheid || '') + brug.ontdekking.dektNiet));
});

test('24. een maker die MEEGESTUURD wordt, wordt genegeerd', () => {
  /* DEZE TOETS BESTAAT OMDAT MUTATIE 5 HEM MISTE. Toets 15 spuit een resolver
     in en bewijst dat de haak loopt -- maar hij zakte NIET toen de oude weg
     werd teruggezet, waarin `opties.maker` voorging op de resolver. Dat is
     precies de faalvorm van BEWIJSMACHINE.md par. 6a: een toets die het goede
     gedrag bevestigt zonder het slechte uit te sluiten.

     Wat hier wordt uitgesloten is het lek zelf: een gever die een codenaam
     meestuurt, schrijft daarmee geen regel in het dossier van die mens. */
  const { c } = bouw({ makerVan: () => null });
  const r = c.connectNaklank('werk:van-niemand', 'AANVALLER', 'geholpen',
    { maker: 'SLACHTOFFER', onderwerp: 'ik ben hier nooit geweest' });
  assert.equal(r.ok, true, 'de naklank zelf mag gewoon geteld worden');
  assert.equal(r.dossier, null, 'maar er ontstaat geen dossierregel');
  assert.equal(c.connectDossier('SLACHTOFFER').totaal, 0,
    'en in het dossier van de genoemde mens staat niets');

  /* En ook niet als er WEL een resolver is die iemand anders aanwijst: dan
     wint de resolver, niet de aanroep. */
  const twee = bouw({ makerVan: () => ({ sleutel: 'ECHTE-MAKER', onderwerp: 'koken' }) });
  twee.c.connectNaklank('werk:1', 'AANVALLER', 'geholpen', { maker: 'SLACHTOFFER', onderwerp: 'x' });
  assert.equal(twee.c.connectDossier('SLACHTOFFER').totaal, 0);
  assert.equal(twee.c.connectDossier('ECHTE-MAKER').totaal, 1);
  assert.equal(twee.c.connectDossier('ECHTE-MAKER').regels[0].onderwerp, 'koken',
    'ook het onderwerp komt uit de resolver en niet uit de aanroep');
});

test('25. een geweigerde naklank laat geen rij achter', () => {
  /* Dezelfde faalvorm als toets 16, maar aan de SCHRIJFkant: `van()` maakt de
     rij aan en stond VOOR alle weigeringen, dus een naklank op je eigen werk
     werd netjes geweigerd en liet toch een lege rij in db.data achter. De
     opslag groeit dan door aanroepen die niets mochten -- en niets klaagt. */
  const { db, c } = bouw({ makerVan: () => ({ sleutel: 'MIJ', onderwerp: 'koken' }) });
  assert.equal(c.connectNaklank('werk:1', 'MIJ', 'geholpen').ok, false, 'op je eigen werk: geweigerd');
  assert.deepEqual(db.data, {}, 'en er staat niets in de opslag');
  assert.equal(c.connectNaklank('werk:1', 'JIJ', 'bestaatniet').ok, false, 'onbekende soort: geweigerd');
  assert.deepEqual(db.data, {}, 'ook daarna niets');
  c.connectNaklank('werk:1', 'JIJ', 'mooi');
  assert.ok(db.data.connect.naklank['werk:1'], 'een geldige naklank schrijft wel');
});
