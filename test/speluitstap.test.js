/* MAGNAAT: UITSTAPPEN -- iemand stopt, en de campagne gaat door.

   Fase C, de overdracht. De aanleiding is een gat dat pas zichtbaar wordt in
   een LANGE partij: `spelOpgeven` in server/kern/spellen/partij.js beeindigt
   het HELE potje zodra iemand ermee ophoudt. Voor schaken klopt dat -- er zijn
   er twee en de een geeft de ander de winst. Voor een campagne van zes over
   zesendertig maanden is het rampzalig: vijf mensen zijn hun partij kwijt
   omdat er een wegging.

   ACHT BEWERINGEN, en ze zijn alle acht stil terug te draaien:

   1. DE PARTIJ GAAT DOOR. Wie uitstapt haalt de anderen niet mee.
   2. ER WORDT NIETS GESCHAPEN EN NIETS VERNIETIGD. Een overdracht tegen
      boekwaarde laat het totaal aan tafel op de euro staan.
   3. DE PRIJS IS DE BOEKWAARDE en geen bedrag uit een invoerveld -- anders is
      uitstappen de goedkoopste samenzwering in het spel.
   4. WIE HET NIET KAN BETALEN, KRIJGT HET NIET. En dan gaat het ook niet half.
   5. WIE VOOR HEM WERKTE HOORT HET TE WETEN, met een reden die meereist.
   6. HIJ STAAT OP DE EINDSTAND EN WINT NIET. Twee helften van een regel.
   7. ZONDER OPVOLGER WORDT ER AFGEWIKKELD, precies zoals bij sluiten.
   8. HET KAN MAAR EEN KEER, en niet aan jezelf of aan wie zelf al weg is.

   Draai los: node --experimental-sqlite --test test/speluitstap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});

/* DEZELFDE PARTIJ, MAAR DOOR DE ECHTE DEUR. De toetsen hierboven spreken de
   motor rechtstreeks aan (`eco.zet`), en dat is prima voor de economie -- maar
   de BEURTBEWAKING zit een laag hoger, in server/kern/spellen/partij.js. Wie
   alleen de motor toetst, toetst nooit of de beurt uberhaupt doorgaat. Dat is
   precies hoe de fout hieronder jarenlang stil kon blijven staan. */
function aanTafel(spelers = ['a', 'b', 'c']) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = require('../server/kern/spellen')({ db, save() {}, crypto: require('crypto'),
    zijnVrienden: () => true, codenaamVan: (x) => x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true,
    sseClients: [], lidBoardUit: () => false });
  const REG = require('../server/kern/spellen/register')({ save() {}, crypto: require('crypto'),
    schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} });
  const p = { id: 'p1', soort: 'magnaat', modus: 'vrij', spelers, uitgenodigd: [], beurt: 0,
    teams: spelers.map((_, i) => i), status: 'bezig', winnaar: null,
    at: new Date().toISOString(), variant: ECO };
  REG.INITS.magnaat(p);
  db.data.spellen.potjes.p1 = p;
  for (const h of spelers) p.staat.geld[h] = 2000000;
  const kavels = kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard');
  let volgend = 0;
  const open = (h) => kern.spelZet(h, 'p1',
    { actie: 'open', kavel: kavels[volgend++].id, sector: 'horeca', omvang: 20 });
  return { kern, p, open };
}
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelsIn = (zone) => kaart('ijmuiden').kavels.filter(k => k.zone === zone);

/* Drie ondernemers met elk een zaak. Genoeg om te zien wat er met de ANDEREN
   gebeurt als er een wegloopt -- met twee is elk vertrek per ongeluk ook het
   einde van de partij, en dan meet je de verkeerde regel. */
function opstelling() {
  const m = maakMagnaat();
  const p = { id: 'u1', soort: 'magnaat', spelers: ['anna', 'boris', 'chris'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  const kavels = kavelsIn('boulevard');
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  p.spelers.forEach((h, i) => m.eco.zet(p, h,
    { actie: 'open', kavel: kavels[i].id, sector: 'horeca', omvang: 30 }));
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  /* Het wereldvermogen: iedereen bij elkaar, ook wie vertrok. Dat laatste is
     geen detail maar bewering 6b -- zie ../server/kern/spellen/magnaat/eindstand.js. */
  const totaal = () => m.eco.eindstand(p).reduce((n, x) => n + x.vermogen, 0);
  return { m, p, st: p.staat, maand, totaal, zaakVan: (h) => p.staat.vestigingen[h][0] };
}

/* ================= 1. de partij gaat door ================= */

test('wie uitstapt haalt de anderen niet mee', () => {
  const { m, p, maand } = opstelling();
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  assert.equal(p.status, 'bezig', 'de partij hoort gewoon door te lopen');
  assert.ok(!p.staat.klaar);
  maand(6);
  assert.equal(p.status, 'bezig');
  /* En de achterblijvers doen gewoon hun zetten. */
  const vrij = kavelsIn('centrum').find(k => !p.staat.kavelBezet[k.id]);
  assert.ok(m.eco.zet(p, 'chris', { actie: 'open', kavel: vrij.id, sector: 'retail', omvang: 20 }).ok);
});

test('uitstappen mag buiten je beurt, want wie stopt komt niet terug', () => {
  const { m } = opstelling();
  assert.ok(m.spel.buitenBeurt.includes('uitstappen'),
    'moest hij op zijn beurt wachten, dan wacht de tafel op iemand die er niet meer is');
});

/* ---------- de beurt, door de echte deur ---------- */

test('in een campagne komt iedereen aan de beurt en niet alleen speler een', () => {
  /* DIT ONTBRAK, en het is geen randgeval. De descriptor zegt dat openen een
     GROTE zet is die op je beurt hoort, partij.js handhaaft dat, en NIEMAND
     zette de beurt door in de economische vorm -- het bordspel wel, de economie
     niet. In een campagne van zes kon dus alleen speler een ooit bouwen. Zie
     ../server/kern/spellen/magnaat/verloop.js. */
  const { p, open } = aanTafel();
  assert.ok(open('a').ok, 'a is aan zet');
  assert.equal(p.beurt, 1, 'en daarna is b het');
  assert.ok(open('b').ok);
  assert.ok(open('c').ok);
  assert.equal(p.beurt, 0, 'de ronde is rond');
  assert.match(open('b').error, /aan zet/, 'buiten je beurt bouw je niet');
});

test('een vrije zet kost je je beurt niet', () => {
  const { kern, p, open } = aanTafel();
  assert.ok(open('a').ok);
  assert.ok(open('b').ok);
  assert.equal(p.beurt, 2, 'c is aan zet');
  /* b verzet zijn marketing: huishouding, geen zet. Dat mag altijd en het hoort
     de beurt van c niet af te pakken. */
  assert.ok(kern.spelZet('b', 'p1', { actie: 'beleid', id: p.staat.vestigingen.b[0].id, marketing: 1000 }).ok);
  assert.equal(p.beurt, 2, 'de beurt staat nog bij c, want b deed geen grote zet');
});

test('de tafel wacht niet op iemand die is uitgestapt', () => {
  const { kern, p, open } = aanTafel();
  assert.ok(open('a').ok);
  assert.equal(p.beurt, 1, 'b is aan zet');
  assert.ok(kern.spelZet('b', 'p1', { actie: 'uitstappen', naar: 'c' }).ok);
  assert.equal(p.beurt, 2, 'en schuift meteen door naar c: anders staat de tafel stil');
  assert.ok(open('c').ok);
  assert.equal(p.beurt, 0, 'b wordt overgeslagen');
  assert.ok(open('a').ok);
  assert.equal(p.beurt, 2);
});

test('stapt de speler aan zet uit terwijl een ander bouwt, dan schuift de beurt over hem heen', () => {
  const { kern, p, open } = aanTafel();
  assert.ok(kern.spelZet('b', 'p1', { actie: 'uitstappen' }).ok, 'b stapt uit terwijl a aan zet is');
  assert.equal(p.beurt, 0, 'a bleef gewoon aan zet');
  assert.ok(open('a').ok);
  assert.equal(p.beurt, 2, 'en na a is c aan de beurt, niet b');
});

/* ================= 2. niets geschapen, niets vernietigd ================= */

test('een overdracht tegen boekwaarde laat het totaal aan tafel staan', () => {
  const { m, p, totaal } = opstelling();
  const voor = totaal();
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  assert.equal(Math.round(totaal() - voor), 0,
    'de zaak gaat de ene kant op en het geld de andere: aan tafel verandert er niets');
});

test('wat de opvolger betaalt, ontvangt de vertrekker -- tot op de euro', () => {
  const { m, p, st } = opstelling();
  const kasAnna = st.geld.anna, kasBoris = st.geld.boris;
  const r = m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(Math.round(st.geld.anna - kasAnna), r.som);
  assert.equal(Math.round(kasBoris - st.geld.boris), r.som);
  assert.equal(st.vestigingen.anna.length, 0);
  assert.equal(st.vestigingen.boris.length, 2);
});

/* ================= 3. de prijs is de boekwaarde ================= */

test('de vertrekker kan de prijs niet zelf kiezen', () => {
  const { m, p, st } = opstelling();
  const eerlijk = m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).som;
  /* Dezelfde opstelling, nu met een verzonnen prijs van nul erbij. Een laag die
     naar zo'n veld luistert, maakt van uitstappen een schenking -- ik stop
     ermee en geef jou alles -- en dat is het patroon waar ../handel.js een
     prijsband voor kreeg. */
  const b = opstelling();
  const met = b.m.eco.zet(b.p, 'anna', { actie: 'uitstappen', naar: 'boris', prijs: 0, som: 0, bedrag: 0 });
  assert.equal(met.som, eerlijk, 'er is geen veld waarmee je de overnameprijs kunt zetten');
  assert.ok(eerlijk > 0);
  assert.ok(st.geld.anna > 0);
});

/* ================= 4. betalen of niets ================= */

test('een opvolger die het niet kan betalen, krijgt niets -- ook niet half', () => {
  const { m, p, st } = opstelling();
  st.geld.boris = 100;
  const r = m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' });
  assert.equal(r.ok, undefined);
  assert.match(r.error, /kan de overname niet betalen/);
  assert.equal(st.vestigingen.anna.length, 1, 'zijn zaak staat er nog');
  assert.equal(st.vestigingen.boris.length, 1);
  assert.equal(st.uit, undefined, 'en hij is niet half vertrokken');
});

test('vooraf is te zien wat het kost en of het kan', () => {
  const { m, p, st } = opstelling();
  const v = m.eco.uitstapvoorstel(p, 'anna', 'boris');
  assert.equal(v.vestigingen.length, 1);
  assert.equal(v.kanBetalen, true);
  st.geld.boris = 100;
  assert.equal(m.eco.uitstapvoorstel(p, 'anna', 'boris').kanBetalen, false);
  /* En zonder opvolger staat er wat er dan gebeurt, want dat is de andere helft
     van de keuze en niet een voetnoot. */
  assert.match(m.eco.uitstapvoorstel(p, 'anna', null).anders, /afgewikkeld/);
});

/* ================= 5. wie voor hem werkte ================= */

test('lopende dienstverbanden eindigen met een reden die zegt wat er gebeurde', () => {
  const { m, p, st } = opstelling();
  const zaak = st.vestigingen.anna[0];
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'bedrijfsleider' });
  m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id });
  assert.ok(m.eco.zet(p, 'anna', { actie: 'aannemen', id: f.id, speler: 'boris' }).ok);
  const r = m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'chris' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.losgelaten, 1);
  const d = st.diensten[0];
  assert.equal(d.status, 'geeindigd');
  assert.equal(d.reden, 'werkgever gestopt');
  assert.equal(d.tot, st.maand, 'en de datum is de maand waarin het gebeurde');
});

test('een openstaande vacature van een vertrekker is geen aanbod meer', () => {
  const { m, p, st } = opstelling();
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: st.vestigingen.anna[0].id, rol: 'hulp' });
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  assert.equal(st.functies.find(x => x.id === f.id).status, 'ingetrokken');
  const s = m.eco.zet(p, 'chris', { actie: 'solliciteren', id: f.id });
  assert.equal(s.ok, undefined, 'op een ingetrokken vacature kan niemand meer solliciteren');
});

test('wie zelf in dienst was, stapt eruit en is niet ontslagen', () => {
  const { m, p, st } = opstelling();
  const f = m.eco.zet(p, 'boris', { actie: 'functie-openen', vestiging: st.vestigingen.boris[0].id, rol: 'hulp' });
  m.eco.zet(p, 'anna', { actie: 'solliciteren', id: f.id });
  assert.ok(m.eco.zet(p, 'boris', { actie: 'aannemen', id: f.id, speler: 'anna' }).ok);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'chris' }).ok);
  const d = st.diensten.find(x => x.werknemer === 'anna');
  assert.equal(d.status, 'geeindigd');
  assert.equal(d.reden, 'uitgestapt', 'hij stapte eruit; dat is iets anders dan eruit gestuurd worden');
});

/* ================= 6. op de eindstand, en niet als winnaar ================= */

test('een vertrekker staat op de eindstand en dingt niet mee', () => {
  const { m, p, st } = opstelling();
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  const stand = m.eco.eindstand(p);
  assert.equal(stand.length, 3, 'hij staat erop: zijn kas bestaat nog');
  const anna = stand.find(x => x.codenaam === 'anna');
  assert.ok(anna.uit, 'en zijn rij zegt dat hij weg is');
  assert.equal(anna.uit.naar, 'boris');
  assert.equal(anna.uit.maand, st.maand);
  assert.ok(stand.findIndex(x => x.codenaam === 'anna') > 0,
    'wie nog meedoet staat boven wie vertrok, ook als de vertrekker rijker is');
  for (const x of stand.filter(y => y.codenaam !== 'anna')) assert.equal(x.uit, null);
});

test('een vertrekker met de volste kas wint de campagne niet', () => {
  const { m, p, st, maand } = opstelling();
  st.geld.anna = 50000000;
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  /* De speelduur inkorten is hoe je deze motor een partij laat afmaken: hij
     REKENT bij en tikt niet, dus een maand die voorbij de duur ligt is genoeg. */
  st.duur = 1;
  maand(2);
  assert.equal(p.staat.klaar, true);
  assert.notEqual(p.winnaar, 'anna', 'hij was er niet bij toen het uitgespeeld werd');
  assert.ok(['boris', 'chris'].includes(p.winnaar), 'winnaar was: ' + p.winnaar);
});

test('het vermogen van een vertrekker verdwijnt niet uit de wereld', () => {
  /* DE FOUT DIE DE GELDPOMP-KEURING VOND, en hij zat niet in de nieuwe laag
     maar in de meting: `eindstand` filterde de vertrekker eruit, dus zijn kas
     verdween uit het wereldtotaal terwijl hij gewoon in `st.geld` stond. De
     keuring las -31,75% op een handeling waar geen euro van eigenaar hoorde te
     veranderen. Zie ../server/kern/spellen/magnaat/eindstand.js. */
  const { m, p, st, totaal } = opstelling();
  const voor = totaal();
  st.geld.anna += 1000000;
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen' }).ok);
  assert.ok(totaal() > voor, 'die miljoen staat er nog: ' + Math.round(totaal() - voor));
  assert.ok(m.eco.eindstand(p).find(x => x.codenaam === 'anna').geld > 1000000);
});

/* ================= 7. zonder opvolger wordt er afgewikkeld ================= */

test('zonder opvolger gaat de zaak dezelfde weg als bij sluiten', () => {
  const { m, p, st } = opstelling();
  const zaak = st.vestigingen.anna[0];
  const kavel = zaak.kavel;
  const kas = st.geld.anna;
  const r = m.eco.zet(p, 'anna', { actie: 'uitstappen' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.naar, null);
  assert.equal(r.gedaan.afgewikkeld.length, 1);
  assert.equal(st.vestigingen.anna.length, 0);
  assert.equal(st.kavelBezet[kavel], undefined, 'en het kavel is weer vrij voor een ander');
  assert.equal(Math.round(st.geld.anna - kas), Math.round(zaak.gebouwdVoor * 0.5),
    'de halve bouwsom terug, net als bij sluiten -- geen bonus en geen straf');
});

/* ================= 8. het kan maar een keer ================= */

test('aan jezelf, aan een vreemde, of twee keer -- alle drie niet', () => {
  const { m, p } = opstelling();
  assert.match(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'anna' }).error, /Aan jezelf/);
  assert.match(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'dirk' }).error, /niet aan tafel/);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  assert.match(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'chris' }).error, /al uitgestapt/);
});

test('overdragen aan iemand die zelf al weg is, kan niet', () => {
  const { m, p } = opstelling();
  assert.ok(m.eco.zet(p, 'chris', { actie: 'uitstappen' }).ok);
  assert.match(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'chris' }).error, /zelf uitgestapt/);
});

test('een vertrekker doet geen zetten meer', () => {
  const { m, p, st } = opstelling();
  const zaak = st.vestigingen.anna[0];
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  const r = m.eco.zet(p, 'anna', { actie: 'beleid', id: zaak.id, marketing: 5000 });
  assert.equal(r.ok, undefined, 'de zaak is niet meer van hem, dus ook zijn knoppen niet');
});
