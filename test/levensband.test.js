/* LEVEN.md fase 2: rechten per relatie.

   Dit bestand handhaaft de twee besluiten van 11 augustus 2026, en het is
   daarmee het belangrijkste toetsbestand van deze fase. Elke toets noemt de
   paragraaf die hij bewaakt, en elke toets is met een MUTATIE gezien zakken --
   welke, staat erbij. Een grenstoets die zijn mutatie overleeft is erger dan
   geen grenstoets: hij geeft een gerust gevoel over iets dat niemand nakijkt.

   In-process op een lege database, met een injecteerbare klok: vervaldatums
   toetsen vraagt om de tijd te kunnen verzetten, en dat kan niet met wachten.

   Draai los: node --experimental-sqlite --test test/levensband.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const LID = 'CODE-ANNA';          // een RTG-lid, op codenaam
const KIND = 'rtf:HUIS7:p2';      // een gezinsprofiel, op handle
const OUDER = 'rtf:HUIS7:p1';

let tijd = new Date('2026-08-11T10:00:00Z');
function maak() {
  tijd = new Date('2026-08-11T10:00:00Z');
  const db = { data: {} };
  const { levensband } = require('../server/kern/levensband')({
    db, save: () => {}, klok: () => tijd
  });
  return { db, L: levensband };
}
const dag = (n) => new Date(tijd.getTime() + n * 864e5).toISOString().slice(0, 10);

/* ---- besluit 1: een band ontstaat alleen als BEIDE kanten bevestigen ---- */

/* MUTATIE GEZIEN ZAKKEN: in banden.js de regel `if (b.gevraagdDoor === w)`
   verwijderd; zakte op "wie vraagt, bevestigt niet". Teruggedraaid, groen. */
test('par. 2.8: wie vraagt bevestigt niet -- de aanvrager kan zijn eigen band niet sluiten', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  assert.equal(v.status, 200, 'vragen mag: ' + JSON.stringify(v));

  const zelf = L.bandBevestig(OUDER, v.band.id);
  assert.equal(zelf.status, 403, 'de aanvrager hoort zijn eigen verzoek NIET te kunnen bevestigen');
  assert.match(zelf.error, /zelf gestuurd/, 'en hij hoort te horen waarom');
  assert.equal(L.banden(OUDER)[0].staat, 'gevraagd', 'de band staat nog steeds open');

  const ander = L.bandBevestig(KIND, v.band.id);
  assert.equal(ander.status, 200, 'de ANDERE kant bevestigt wel');
  assert.equal(ander.band.staat, 'bevestigd');
});

/* MUTATIE GEZIEN ZAKKEN: in banden.js de isKant-controle bij bevestig()
   weggehaald; zakte op "een vreemde bevestigt niets". */
test('par. 2.8: een derde die de band-id kent, bevestigt niets', () => {
  const { L } = maak();
  const v = L.bandVraag(LID, KIND, { soort: 'mentor', lidKant: 'van', gezin: 'HUIS7' });
  const vreemde = L.bandBevestig('rtf:HUIS7:p9', v.band.id);
  assert.equal(vreemde.status, 403, 'wie geen kant van de band is, heeft er niets te zeggen');
  assert.equal(L.banden(LID)[0].staat, 'gevraagd');
});

test('par. 2.8: elke kant verbreekt altijd, zonder toestemming van de ander', () => {
  const { L } = maak();
  const v = L.bandVraag(LID, KIND, { soort: 'mentor', lidKant: 'van', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);
  const weg = L.bandVerbreek(KIND, v.band.id);
  assert.equal(weg.status, 200, 'de andere kant mag verbreken');
  assert.deepEqual(L.banden(LID), [], 'een verbroken band staat niet meer in de lijst');
});

/* ---- besluit 2: standaard NIETS; het kind deelt per stuk ---- */

/* MUTATIE GEZIEN ZAKKEN: in inzage.js de delingen-filter vervangen door "alle
   stukken van de eigenaar"; zakte op "een bevestigde band geeft uit zichzelf
   geen enkel stuk". */
test('par. 2.8: een bevestigde band geeft uit zichzelf NIETS te zien', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);

  const z = L.inzage(OUDER, KIND);
  assert.deepEqual(z.stukken, [],
    'een ouder ziet standaard niets van een kind; er is geen pakket dat bij een soort band hoort');
  assert.equal(z.band, v.band.id, 'de band bestaat wel degelijk -- er is alleen niets vrijgegeven');

  /* EN MET EEN DELING DIE NIET VOOR DEZE OUDER IS. Zonder deze helft meet de
     toets alleen "er is niets", en dat is ook waar als de poort helemaal weg
     is: de mutatie die inzage() alles van de eigenaar liet teruggeven,
     overleefde deze toets aanvankelijk en zakte pas verderop. Een grenstoets
     hoort de grens te meten die hij in zijn naam draagt. */
  const derde = L.bandVraag(LID, KIND, { soort: 'mentor', lidKant: 'van', gezin: 'HUIS7' });
  L.bandBevestig(KIND, derde.band.id);
  L.deelZet(KIND, { bandId: derde.band.id, stuk: 'afspraken', vervalt: dag(30) });

  assert.deepEqual(L.inzage(LID, KIND).stukken.map(s => s.stuk), ['afspraken'],
    'de mentor ziet wat het kind AAN HEM deelde');
  assert.deepEqual(L.inzage(OUDER, KIND).stukken, [],
    'en de ouder ziet dat NIET: een deling geldt per band, niet per persoon-die-iets-deelde');
});

test('par. 2.8: pas wat het kind zelf deelt, en alleen dat', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);

  const d = L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(30) });
  assert.equal(d.status, 200, 'het kind deelt zelf: ' + JSON.stringify(d));

  const z = L.inzage(OUDER, KIND);
  assert.deepEqual(z.stukken.map(s => s.stuk), ['afspraken'], 'precies wat er gedeeld is, niet meer');
  assert.equal(L.inzageMag(OUDER, KIND, 'afspraken').stuk, 'afspraken');
  assert.equal(L.inzageMag(OUDER, KIND, 'gezondheid'), null, 'en van de rest niets');
});

/* MUTATIE GEZIEN ZAKKEN: in delen.js de eigenaarscontrole (`band.lid !== w &&
   band.profiel !== w`) verwijderd; zakte op "een ouder deelt niets namens een
   kind". Dat pad is de achterdeur van besluit 2. */
test('par. 2.8: een ouder deelt NIETS namens het kind', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);
  /* De ouder deelt hier ZIJN eigen stuk; dat mag, en het zegt niets over het
     kind. Wat niet mag, is dat die deling inzage in het KIND oplevert. */
  L.deelZet(OUDER, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(30) });
  assert.deepEqual(L.inzage(OUDER, KIND).stukken, [],
    'wat de ouder deelt, geeft hem geen blik op het kind');
  assert.deepEqual(L.inzage(KIND, OUDER).stukken.map(s => s.stuk), ['afspraken'],
    'omgekeerd wel: het kind ziet wat de ouder deelde');
});

test('par. 2.5: het dagboek en de dromen zijn niet deelbaar, ook niet als u het wilt', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);
  for (const stuk of L.deelNooit()) {
    const r = L.deelZet(KIND, { bandId: v.band.id, stuk, vervalt: dag(30) });
    assert.equal(r.status, 403, '"' + stuk + '" hoort niet deelbaar te zijn');
  }
});

/* ---- vervaldatums: toestemming die eeuwig duurt, wordt vergeten ---- */

/* MUTATIE GEZIEN ZAKKEN: in delen.js de vervalt-eis weggehaald (lege datum
   toegestaan); zakte op "delen zonder einddatum kan niet". */
test('par. 2.8: delen kan niet zonder einddatum', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);
  /* OP DE REDEN TOETSEN EN NIET ALLEEN OP DE CODE. Dat maakte hier het
     verschil: zonder datum viel de aanroep door naar de volgende controle
     (een lege string is kleiner dan vandaag) en kwam er ook een 400 uit --
     met de melding "die datum is al voorbij". De mutatie die de eis
     weghaalde, overleefde de toets dus. Een weigering met de verkeerde reden
     is een gat dat je niet ziet. */
  const zonder = L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken' });
  assert.equal(zonder.status, 400);
  assert.match(zonder.error, /Tot wanneer/,
    'zonder datum hoort de vraag te zijn WELKE datum, niet dat hij voorbij is');

  const voorbij = L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(-1) });
  assert.equal(voorbij.status, 400);
  assert.match(voorbij.error, /al voorbij/, 'een datum die al voorbij is, is geen datum');
});

/* MUTATIE GEZIEN ZAKKEN: in inzage.js de `verlopen(x)`-controle weggehaald;
   zakte op "na de vervaldatum ziet de ander niets meer". */
test('par. 2.8: een deling dooft vanzelf, zonder dat iemand eraan hoeft te denken', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);
  L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(7) });
  assert.equal(L.inzage(OUDER, KIND).stukken.length, 1, 'vandaag zichtbaar');

  tijd = new Date(tijd.getTime() + 8 * 864e5);
  assert.deepEqual(L.inzage(OUDER, KIND).stukken, [], 'acht dagen later niet meer');
  assert.equal(L.inzageMag(OUDER, KIND, 'afspraken'), null);
});

test('par. 2.8: een band met een vervaldatum dooft ook, en neemt de inzage mee', () => {
  const { L } = maak();
  const v = L.bandVraag(LID, KIND, { soort: 'leerkracht', lidKant: 'van', gezin: 'HUIS7', vervalt: dag(10) });
  L.bandBevestig(KIND, v.band.id);
  L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(300) });
  assert.equal(L.inzage(LID, KIND).stukken.length, 1);

  tijd = new Date(tijd.getTime() + 11 * 864e5);
  assert.deepEqual(L.inzage(LID, KIND).stukken, [],
    'de deling loopt nog, maar de BAND is voorbij -- dan is er geen weg meer');
  assert.equal(L.banden(KIND)[0].staat, 'verlopen', 'en dat is zichtbaar');
});

test('par. 2.8: intrekken kan altijd, en de rij gaat echt weg', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);
  const d = L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(30) });
  assert.equal(L.deelIn(OUDER, d.deling.id).status, 403, 'de ontvanger trekt niets in');
  assert.equal(L.deelIn(KIND, d.deling.id).status, 200, 'wie deelde wel');
  assert.deepEqual(L.delingen(KIND), [], 'en er blijft geen spoor van "ooit gedeeld" staan');
});

test('par. 2.8: een verbroken band neemt de delingen mee', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);
  L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(30) });
  L.bandVerbreek(OUDER, v.band.id);
  assert.deepEqual(L.delingen(KIND), [],
    'delingen horen niet stil geldig te blijven wachten op een nieuwe band');
  assert.deepEqual(L.inzage(OUDER, KIND).stukken, []);
});

test('delen kan pas als de band staat: een openstaand verzoek geeft niets', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  const d = L.deelZet(KIND, { bandId: v.band.id, stuk: 'afspraken', vervalt: dag(30) });
  assert.equal(d.status, 400);
  assert.match(d.error, /nog niet bevestigd/);
});

/* ---- het veiligheidssignaal: DAT er iets is, nooit WAT ---- */

/* MUTATIE GEZIEN ZAKKEN: in inzage.js aan de signaalzin de telling per soort
   toegevoegd; zakte op "het signaal noemt geen inhoud". */
test('par. 2.8: het signaal zegt DAT er iets is en nooit WAT', () => {
  const { L } = maak();
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  L.bandBevestig(KIND, v.band.id);

  const s = L.inzageSignaal(OUDER, KIND, 2);
  assert.equal(s.mag, true, 'een levende band geeft recht op het signaal, zonder enige deling');
  assert.equal(s.aandacht, 2);
  /* De zin mag geen enkel woord bevatten dat naar inhoud wijst. Dit is de
     kern van de uitzondering: veiligheid rechtvaardigt een signaal, geen
     inzage. */
  for (const woord of ['dagboek', 'gevoel', 'stemming', 'school', 'cijfer', 'bericht', 'gezondheid']) {
    assert.equal(s.zin.toLowerCase().includes(woord), false,
      'het signaal hoort geen "' + woord + '" te noemen');
  }
  assert.match(s.zin, /vraag het/, 'het nodigt uit tot een gesprek en vervangt het niet');
});

test('par. 2.8: zonder levende band geen signaal', () => {
  const { L } = maak();
  assert.equal(L.inzageSignaal(OUDER, KIND, 3).mag, false, 'geen band, geen signaal');
  const v = L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  assert.equal(L.inzageSignaal(OUDER, KIND, 3).mag, false, 'een openstaand verzoek is geen band');
  L.bandBevestig(KIND, v.band.id);
  L.bandVerbreek(KIND, v.band.id);
  assert.equal(L.inzageSignaal(OUDER, KIND, 3).mag, false, 'en een verbroken band ook niet');
});

/* ---- de opslag ---- */

test('kijken laat geen spoor achter in de database', () => {
  const { db, L } = maak();
  L.banden(LID); L.inzage(OUDER, KIND); L.delingen(KIND); L.bandVerzoeken(LID);
  assert.equal(db.data.levensbanden, undefined,
    'wie alleen kijkt, hoort geen rij aan te maken (zelfde afspraak als kern/geldbeleid)');
});

test('op mijn bord staan alleen verzoeken waar ik aan zet ben', () => {
  const { L } = maak();
  L.bandVraag(OUDER, KIND, { soort: 'ouder', lidKant: 'geen', gezin: 'HUIS7' });
  assert.deepEqual(L.bandVerzoeken(OUDER), [], 'wie zelf vroeg, wacht -- en wachten is geen taak');
  const opBord = L.bandVerzoeken(KIND);
  assert.equal(opBord.length, 1);
  assert.equal(opBord[0].van, OUDER, 'en er staat bij van wie het komt');
});
