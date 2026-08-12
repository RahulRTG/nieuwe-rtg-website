/* DE PROMOTIE -- "Sven wil je spreken."

   VERHAAL.md hoofdstuk 2. Promoveren KON al: je zegt je baan op en solliciteert
   opnieuw. Maar dat is ontslag met een sollicitatie erachter -- het reset je
   dienstjaren en breekt de arbeidsrelatie.

   Negen beweringen, en ze zijn alle negen stil terug te draaien:

   1. HET IS EEN INTERNE OVERGANG: dezelfde relatie, dezelfde dienstjaren.
   2. HET IS EEN ONDERHANDELING: ja, nee of een tegenbod.
   3. EEN PROMOTIE GAAT OMHOOG en betaalt meer.
   4. HET LOON BLIJFT IN DE BAND van de NIEUWE rol.
   5. DRIE SOORTEN: vakinhoudelijk, leidinggevend, bestuurlijk.
   6. JE KRIJGT BEVOEGDHEDEN, geen niveau.
   7. DE AI GEBRUIKT DEZELFDE HANDELING -- geen `if diensttijd > x: rol++`.
   8. `eerste_promotie` ONTSTAAT VANZELF uit de eerste geaccepteerde stijging.
   9. `samen_door` VEREIST ECHTE GEDEELDE TEGENSLAG, en dat je het haalde.

   Draai los: node --experimental-sqlite --test test/spelpromotie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const D = require('../server/kern/spellen/magnaat/dienst');
const P = require('../server/kern/spellen/magnaat/promotie');
const W = require('../server/kern/spellen/magnaat/concurrent-werven');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };

/* Anna heeft een hotel dat groot genoeg is om iemand te laten groeien. */
function opstelling() {
  const m = maakMagnaat();
  const p = { id: 'pm1', soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 8000000;
  const kav = kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard');
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kav[0].id, sector: 'hotel', omvang: 120, naam: 'Havenzicht' });
  const zaak = p.staat.vestigingen.anna[0];
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  const f = m.eco.zet(p, 'anna', { actie: 'functie-openen', vestiging: zaak.id, rol: 'hulp' });
  m.eco.zet(p, 'boris', { actie: 'solliciteren', id: f.id });
  m.eco.zet(p, 'anna', { actie: 'aannemen', id: f.id, speler: 'boris' });
  return { m, p, st: p.staat, zaak, maand, dienst: () => D.dienstVan(p.staat, 'boris') };
}
const bied = (o, rol, loon) => o.m.eco.zet(o.p, 'anna',
  Object.assign({ actie: 'promotie-aanbieden', dienst: o.dienst().id, rol }, loon === undefined ? {} : { loon }));

/* ================= 1. een interne overgang ================= */

test('promotie breekt het dienstverband niet en reset geen dienstjaren', () => {
  /* DE KERN. Zou het dienstverband breken, dan wordt "hij werkte drie jaar en
     twee maanden voor jou" twee losse baantjes. */
  const o = opstelling();
  o.maand(14);
  const voor = o.dienst();
  const id = voor.id, sinds = voor.sinds, maanden = voor.maanden;
  const b = bied(o, 'vakkracht');
  assert.ok(b.ok, JSON.stringify(b));
  const a = o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id, antwoord: 'ja' });
  assert.ok(a.ok, JSON.stringify(a));
  const na = o.dienst();
  assert.equal(na.id, id, 'hetzelfde dienstverband');
  assert.equal(na.sinds, sinds, 'dezelfde begindatum');
  assert.equal(na.maanden, maanden, 'dezelfde dienstjaren');
  assert.equal(na.rol, 'vakkracht');
  assert.equal(o.st.diensten.filter(x => x.werknemer === 'boris').length, 1, 'en geen tweede regel');
});

/* ================= 2. een onderhandeling ================= */

test('je kunt een promotie weigeren, en dan verandert er niets', () => {
  const o = opstelling();
  o.maand(10);
  const b = bied(o, 'vakkracht');
  assert.ok(o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id, antwoord: 'nee' }).ok);
  assert.equal(o.dienst().rol, 'hulp', 'hij bleef waar hij zat');
});

test('een tegenbod wisselt van kant en blijft EEN gesprek', () => {
  const o = opstelling();
  o.maand(10);
  const band = P.TRAP ? null : null;
  const b = bied(o, 'vakkracht');
  const eerst = o.st.promoties[0].loon;
  const t = o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id,
    antwoord: 'tegenbod', loon: Math.round(eerst * 1.2) });
  assert.ok(t.ok, JSON.stringify(t));
  assert.equal(o.st.promoties.length, 1, 'geen tweede voorstel, hetzelfde gesprek');
  assert.equal(o.st.promoties[0].tegenbiedingen.length, 1);
  /* Nu is de werkgever aan zet -- de werknemer niet meer. */
  const opnieuw = o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id, antwoord: 'ja' });
  assert.equal(opnieuw.ok, undefined, 'hij kan niet zijn eigen tegenbod accepteren');
  const ja = o.m.eco.zet(o.p, 'anna', { actie: 'promotie-antwoord', id: b.id, antwoord: 'ja' });
  assert.ok(ja.ok, JSON.stringify(ja));
  assert.equal(o.dienst().loon, Math.round(eerst * 1.2), 'tegen zijn eigen bedrag');
});

test('een voorstel is van beide kanten in te trekken', () => {
  const o = opstelling();
  o.maand(10);
  const b = bied(o, 'vakkracht');
  assert.ok(o.m.eco.zet(o.p, 'anna', { actie: 'promotie-intrekken', id: b.id }).ok);
  const laat = o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id, antwoord: 'ja' });
  assert.equal(laat.ok, undefined);
  assert.equal(o.dienst().rol, 'hulp');
});

/* ================= 3 en 4. omhoog, en meer ================= */

test('een promotie gaat omhoog en betaalt meer', () => {
  const o = opstelling();
  o.maand(10);
  const omlaag = o.m.eco.zet(o.p, 'anna', { actie: 'promotie-aanbieden', dienst: o.dienst().id, rol: 'hulp' });
  assert.equal(omlaag.ok, undefined);
  assert.match(omlaag.error, /omhoog/);
  const gelijkLoon = bied(o, 'vakkracht', Math.round(o.dienst().loon));
  assert.equal(gelijkLoon.ok, undefined, 'meer werk voor hetzelfde geld is geen aanbod');
  assert.match(gelijkLoon.error, /betaalt meer/);
});

test('het loon blijft in de band van de NIEUWE rol', () => {
  const o = opstelling();
  o.maand(10);
  const r = bied(o, 'vakkracht', 99999999);
  assert.equal(r.ok, undefined);
  assert.match(r.error, /tussen/);
});

test('twee bedrijfsleiders op een zaak kan niet, en twee voorstellen ook niet', () => {
  const o = opstelling();
  o.maand(10);
  bied(o, 'vakkracht');
  const tweede = bied(o, 'bedrijfsleider');
  assert.equal(tweede.ok, undefined);
  assert.match(tweede.error, /ligt al een voorstel/);
});

/* ================= 5 en 6. soorten en bevoegdheden ================= */

test('drie soorten promotie, en ze heten naar wat ze veranderen', () => {
  assert.equal(P.soortVan('hulp', 'vakkracht'), 'vakinhoudelijk');
  assert.equal(P.soortVan('vakkracht', 'bedrijfsleider'), 'leidinggevend');
  assert.equal(P.soortVan('bedrijfsleider', 'ceo'), 'bestuurlijk');
  assert.ok(P.TRAP.ceo > P.TRAP.bedrijfsleider && P.TRAP.bedrijfsleider > P.TRAP.hulp);
});

test('je krijgt bevoegdheden en geen niveau', () => {
  /* De belofte van VERHAAL.md hoofdstuk 3: het systeem vertelt je niet dat je
     belangrijker bent geworden, het geeft je verantwoordelijkheid. */
  const o = opstelling();
  o.maand(10);
  const voorHeen = o.m.eco.zet(o.p, 'boris', { actie: 'werk-beleid', prijs: 'hoog' });
  assert.equal(voorHeen.ok, undefined, 'als hulpkracht ging hij daar niet over');
  const b = bied(o, 'bedrijfsleider');
  const a = o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id, antwoord: 'ja' });
  assert.ok(a.ok, JSON.stringify(a));
  assert.deepEqual(a.mag.slice().sort(), ['marketing', 'onderhoud', 'personeel', 'prijs']);
  assert.ok(o.m.eco.zet(o.p, 'boris', { actie: 'werk-beleid', prijs: 'hoog' }).ok,
    'vandaag mag hij wat hij gisteren niet mocht');
  assert.equal(o.st.vestigingen.anna[0].prijs, 'hoog');
  /* En er is nergens een getal dat zegt hoe ver hij is. */
  const tekst = JSON.stringify(o.dienst());
  for (const woord of ['niveau', 'level', 'xp', 'punten', 'rang'])
    assert.ok(!tekst.includes(woord), 'het dienstverband draagt een ' + woord);
});

/* ================= 7. de AI doet hetzelfde ================= */

test('de AI promoveert langs dezelfde handeling, zonder eigen regel', () => {
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/concurrent-werven.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(bron.includes("ACTIES['promotie-aanbieden']"), 'hij roept de gewone actie aan');
  for (const eigen of ['d.rol =', 'd.loon =', 'rol++'])
    assert.ok(!bron.includes(eigen), 'de AI verzet zelf een rol: ' + eigen);
});

/* ================= 8 en 9. wat ervan blijft ================= */

test('de eerste geaccepteerde stijging wordt vanzelf een moment', () => {
  const o = opstelling();
  o.maand(12);
  const b = bied(o, 'vakkracht');
  o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id, antwoord: 'ja' });
  o.maand(4);
  o.p.status = 'klaar';
  const L = require('../server/kern/spellen/loopbaan')({ db: { data: {} }, save() {},
    codenaamVan: (h) => 'CN-' + h, progressieMag: () => true, GEEN_PROGRESSIE: 'x' });
  L.noteerLoopbaan(o.p);
  const m = L.terugblik('boris', 'CN-boris').momenten.find(x => x.soort === 'eerste_promotie');
  assert.ok(m, 'de promotie staat in zijn loopbaan');
  assert.equal(m.samen, 'CN-anna', 'en wie hem gaf staat erbij');
  assert.match(m.zin, /goed genoeg/);
});

test('samen_door vereist echte gedeelde tegenslag, en dat je het haalde', () => {
  const o = opstelling();
  o.maand(6);
  const L = () => require('../server/kern/spellen/loopbaan')({ db: { data: {} }, save() {},
    codenaamVan: (h) => 'CN-' + h, progressieMag: () => true, GEEN_PROGRESSIE: 'x' });
  /* Zonder schade: geen moment, hoe lang je ook samen werkte. */
  const zonder = Object.assign({}, o.p, { status: 'klaar', loopbaanGenoteerd: false });
  const a = L(); a.noteerLoopbaan(zonder);
  assert.ok(!a.terugblik('boris', 'CN-boris').momenten.some(x => x.soort === 'samen_door'),
    'samen werken is nog geen samen doorstaan');
  /* Met schade EN een dienstverband dat het haalde: wel. */
  o.dienst().zwaar = [{ maand: 3, wat: 'Storm' }];
  const met = Object.assign({}, o.p, { status: 'klaar', loopbaanGenoteerd: false });
  const b = L(); b.noteerLoopbaan(met);
  const m = b.terugblik('boris', 'CN-boris').momenten.find(x => x.soort === 'samen_door');
  assert.ok(m, 'nu wel');
  assert.match(m.zin, /Storm/);
  /* Maar wie wegging toen het tegenzat, ging er niet samen doorheen. */
  o.dienst().status = 'geeindigd';
  const weg = Object.assign({}, o.p, { status: 'klaar', loopbaanGenoteerd: false });
  const c = L(); c.noteerLoopbaan(weg);
  assert.ok(!c.terugblik('boris', 'CN-boris').momenten.some(x => x.soort === 'samen_door'));
});

/* ================= de scene ================= */

test('DE HELE BOOG: van niemand tot iemand, in een wereld die al draaide', () => {
  /* Dit is de toets die er echt toe doet, en hij leest als een scene.

     Een verse wereld waarin de speler NIETS heeft. De AI bouwt Havenzicht en
     zoekt personeel. Hij solliciteert, wordt aangenomen, werkt maanden, krijgt
     loon. Dan komt er een voorstel: Sven wil hem spreken. Hij accepteert, en
     zijn bevoegdheden veranderen in dezelfde software waar zijn baas gisteren
     nog zat. Aan het eind staat het in zijn loopbaan.

     Wat hier bewezen wordt is meer dan "promotie werkt": een speler kan in
     Magnaat ergens binnenkomen als niemand, door een ander gezien worden,
     verantwoordelijkheid verdienen, en daar een geschiedenis aan overhouden. */
  const m = maakMagnaat();
  const p = { id: 'scene', soort: 'magnaat', spelers: ['ik', 'sven'], teams: [0, 1],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend', start: 'mens', ai: 1 } };
  m.spel.init(p);
  const st = p.staat;
  const maand = (n) => { for (let i = 0; i < n; i++) { st.gerekendTot -= st.maandMs; m.eco.bijrekenen(p); } };

  assert.equal(st.vestigingen.ik.length, 0, 'je hebt niets');
  maand(8);
  const vac = D.functies(st).filter(f => f.status === 'open');
  assert.ok(vac.length, 'maar de stad draait, en zoekt mensen');

  assert.ok(m.eco.zet(p, 'ik', { actie: 'solliciteren', id: vac[0].id }).ok);
  maand(1);
  const baan = D.dienstVan(st, 'ik');
  assert.ok(baan, 'iemand neemt je aan');
  assert.equal(baan.rol, 'hulp');
  assert.equal(baan.werkgever, 'sven');

  const kas = st.geld.ik;
  maand(W.NA_MAANDEN + 2);
  assert.ok(st.geld.ik > kas, 'je verdient');

  const voorstel = (st.promoties || []).find(x => x.werknemer === 'ik');
  assert.ok(voorstel, 'en na een tijd wil Sven je spreken');
  assert.equal(voorstel.van, 'hulp');
  assert.ok(P.TRAP[voorstel.naar] > P.TRAP.hulp);
  assert.ok(voorstel.loon > baan.loon, 'met meer loon: ' + baan.loon + ' -> ' + voorstel.loon);

  const sinds = D.dienstVan(st, 'ik').sinds;
  const ja = m.eco.zet(p, 'ik', { actie: 'promotie-antwoord', id: voorstel.id, antwoord: 'ja' });
  assert.ok(ja.ok, JSON.stringify(ja));
  const na = D.dienstVan(st, 'ik');
  assert.equal(na.sinds, sinds, 'dezelfde arbeidsrelatie, een trede hoger');
  assert.ok(na.mag !== undefined || ja.mag.length >= 0);
  assert.ok(ja.mag.length > 0, 'en je mag iets wat je gisteren niet mocht: ' + ja.mag.join(', '));

  maand(6);
  p.status = 'klaar';
  const L = require('../server/kern/spellen/loopbaan')({ db: { data: {} }, save() {},
    codenaamVan: (h) => 'CN-' + h, progressieMag: () => true, GEEN_PROGRESSIE: 'x' });
  L.noteerLoopbaan(p);
  const t = L.terugblik('ik', 'CN-ik');
  assert.equal(t.begin.werkgever, 'CN-sven', 'waar je begon');
  const soorten = t.momenten.map(x => x.soort);
  assert.ok(soorten.includes('eerste_baan'), soorten.join(', '));
  assert.ok(soorten.includes('eerste_promotie'), soorten.join(', '));
  /* En er staat geen enkel bedrag in wat je overhoudt. */
  assert.ok(!/\d{4,}/.test(JSON.stringify(t)), JSON.stringify(t));
});

/* ================= het moment op het scherm ================= */

test('het voorstel bereikt het scherm, en het is een regel en geen kaart', () => {
  /* Het moment hoort klein en serieus te zijn. Wat het scherm krijgt is
     precies genoeg voor EEN regel ("X wil je spreken") en daarachter een
     gesprek -- niet een blok met een cijfer erop. */
  const o = opstelling();
  o.maand(10);
  const b = bied(o, 'vakkracht');
  const zicht = o.m.eco.zicht(o.p, o.st, 'boris').werk;
  const v = (zicht.promoties || [])[0];
  assert.ok(v, 'het voorstel staat op zijn scherm');
  assert.equal(v.van_wie, 'anna', 'en van wie het komt');
  assert.equal(v.mijn, true, 'hij is aan zet');
  assert.ok(v.naarNaam, 'met de rol in mensentaal: ' + v.naarNaam);
  assert.ok(Array.isArray(v.mag), 'en wat er verandert aan bevoegdheden');
  /* Geen score, geen niveau, geen voortgang -- er valt niets te vieren, er valt
     iets te beslissen. */
  for (const woord of ['xp', 'niveau', 'level', 'punten', 'voortgang', 'badge'])
    assert.ok(!JSON.stringify(v).toLowerCase().includes(woord), 'het voorstel draagt een ' + woord);
  /* De werkgever ziet hetzelfde voorstel, maar is niet aan zet. */
  const bij = o.m.eco.zicht(o.p, o.st, 'anna').werk.promoties[0];
  assert.equal(bij.mijn, false);
  assert.equal(bij.aan, 'boris');
});

test('de terugblik houdt er een regel aan over, zonder bedrag', () => {
  const o = opstelling();
  o.maand(12);
  const b = bied(o, 'bedrijfsleider');
  o.m.eco.zet(o.p, 'boris', { actie: 'promotie-antwoord', id: b.id, antwoord: 'ja' });
  o.maand(3);
  o.p.status = 'klaar';
  const L = require('../server/kern/spellen/loopbaan')({ db: { data: {} }, save() {},
    codenaamVan: (h) => 'CN-' + h, progressieMag: () => true, GEEN_PROGRESSIE: 'x' });
  L.noteerLoopbaan(o.p);
  const m = L.terugblik('boris', 'CN-boris').momenten.find(x => x.soort === 'eerste_promotie');
  assert.equal(m.naam, 'Je eerste promotie');
  assert.match(m.zin, /^CN-anna vond je goed genoeg voor /);
  assert.ok(!/\d/.test(m.zin), 'geen enkel cijfer in de zin: ' + m.zin);
});

/* ================= de werkgeverskant, en de loonstrook ================= */

test('een MENS start dezelfde promotiehandeling als Sven', () => {
  /* DE CIRKEL SLUITEN. Zolang alleen de AI promoveert, spreken de AI en de
     speler niet dezelfde arbeidsmarkt -- en dan is "dezelfde werkwoorden" een
     belofte die op een scherm strandt. */
  const o = opstelling();
  o.maand(10);
  const mensen = o.m.eco.zicht(o.p, o.st, 'anna').werk.mijnMensen;
  assert.equal(mensen.length, 1, 'zij ziet haar mensen');
  const x = mensen[0];
  assert.equal(x.wie, 'boris');
  assert.equal(x.naar, 'vakkracht', 'en welke trede er boven hem ligt');
  assert.equal(x.inGesprek, false);
  /* Precies de zet die het scherm doet -- en het is dezelfde die de AI doet. */
  const r = o.m.eco.zet(o.p, 'anna', { actie: 'promotie-aanbieden', dienst: x.id, rol: x.naar });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(o.m.eco.zicht(o.p, o.st, 'anna').werk.mijnMensen[0].inGesprek, true,
    'en daarna staat er geen tweede knop');
});

test('het scherm biedt geen trede aan die al bezet is', () => {
  const o = opstelling();
  o.maand(8);
  /* Anna neemt zelf ook een vakkracht aan; dan is die trede weg voor boris. */
  const f = o.m.eco.zet(o.p, 'anna', { actie: 'functie-openen', vestiging: o.zaak.id, rol: 'vakkracht' });
  o.m.eco.zet(o.p, 'chris', { actie: 'solliciteren', id: f.id });
  o.p.spelers.push('chris');
  o.st.geld.chris = 0; o.st.vestigingen.chris = [];
  o.m.eco.zet(o.p, 'chris', { actie: 'solliciteren', id: f.id });
  o.m.eco.zet(o.p, 'anna', { actie: 'aannemen', id: f.id, speler: 'chris' });
  const boris = o.m.eco.zicht(o.p, o.st, 'anna').werk.mijnMensen.find(x => x.wie === 'boris');
  assert.equal(boris.naar, 'bedrijfsleider', 'vakkracht is bezet, dus de trede erboven');
});

test('de loonstrook is sober en wordt nergens bewaard', () => {
  const o = opstelling();
  o.maand(5);
  const b = o.m.eco.zicht(o.p, o.st, 'boris').werk.baan;
  assert.ok(b.strook, 'er is een strook zodra er gewerkt is');
  assert.deepEqual(Object.keys(b.strook).sort(),
    ['bedrag', 'dienstmaanden', 'functie', 'periode', 'sinds', 'werkgever', 'zaak'],
    'periode, werkgever, functie, bedrag -- en niets meer');
  assert.equal(b.strook.werkgever, 'anna');
  assert.equal(b.strook.functie, 'Hulpkracht');
  assert.equal(b.strook.bedrag, Math.round(o.dienst().loon));
  assert.equal(b.strook.periode, o.st.maand);
  /* AFGELEID EN NIET BEWAARD: een tweede voorraad naast een som die klopt is
     een tweede waarheid. */
  assert.ok(!('strook' in o.dienst()), 'hij staat niet op het dienstverband');
  assert.ok(!JSON.stringify(o.st).includes('"strook"'), 'en nergens in de staat');
});

test('wie nog geen maand gewerkt heeft, heeft nog geen strook', () => {
  const o = opstelling();
  const b = o.m.eco.zicht(o.p, o.st, 'boris').werk.baan;
  assert.equal(b.strook, null, 'aangenomen is nog niet betaald');
});

test('een bestuurder krijgt geen volgende trede aangeboden', () => {
  /* Een bestuursrol hangt aan het CONCERN en niet aan een vestiging, dus
     "welke trede ligt hier boven" is er geen zinnige vraag over -- die stap is
     een ander gesprek (magnaat/bestuur.js). Zonder deze grens zou het scherm
     een knop tonen die de motor terecht weigert. */
  const o = opstelling();
  o.maand(10);
  const d = o.dienst();
  d.rol = 'ceo';
  d.vestiging = null;
  const x = o.m.eco.zicht(o.p, o.st, 'anna').werk.mijnMensen.find(y => y.wie === 'boris');
  assert.equal(x.naar, null, 'geen trede voor wie het concern bestuurt');
});
