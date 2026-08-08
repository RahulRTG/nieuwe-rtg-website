/* Integratietests voor Het Privekantoor: de ENE app van de Lifestyle Pass.

   Wat hier bewezen wordt, en waarom juist dit:

     de poort        een RTG-pas komt er niet in, op geen enkele route
     de projectie    de Life Graph LEEST de bestaande dossiers en schrijft er
                     niets in terug -- de eigenschap waar de hele opzet op rust
     de tower        een verlopen verzekering staat in achterstallig en een
                     onderhoudsbeurt van over drie dagen in het weekvenster
     het dak         gezondheid en nalatenschap zijn niet te delegeren, ook niet
                     als het lid het zelf probeert
     de grens        EUR 2.000 binnen een grens van EUR 2.500 loopt door; EUR
                     300.000 wordt een beslissing
     de grendel      een besloten zaak bereikt het concierge-bureau niet, en het
                     bureau kan niets afronden waar het lid nog niet ja op zei

   Elke bewering staat als exacte waarde en niet als "een van deze statussen"
   (regel 9 van de lat): een toets die zowel 200 als 403 goedkeurt, keurt niets.

   Draai los: node --experimental-sqlite --test test/bureau.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, elevateTier } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bureau-'));
let child;

const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const bu = (pad, body, token) => raw('/member/bureau/' + pad, body, token);
const ls = (pad, body, token) => raw('/member/lifestyle/' + pad, body, token);
const oc = (pad, body, token) => raw('/office/' + pad, body, token);
const officeTok = async () => (await json(await raw('/office/login', { code: 'RTG-OFFICE' }))).token;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lidMet(tier) {
  const t = Date.now() + '' + (teller++);
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'b' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: regTier }));
  if (tier === 'lifestyle' || tier === 'business') await elevateTier(BASE, r.token, tier, await officeTok());
  return r.token;
}
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/* ---------------------------------------------------------------- de poort -- */
test('een RTG-pas komt het Privekantoor op geen enkele route binnen', async () => {
  const rtg = await lidMet('rtg');
  // álle routes, niet één steekproef: een poort die er bij negen van de tien
  // staat, is de tiende waar hij niet staat
  /* De paden staan hier VOLUIT en niet als achtervoegsel achter een hulpje.

     Dat is geen stijl maar een meter: `endpointsZonderTest` in NORM.json telt
     endpoints die in geen enkele toets VOORKOMEN, en die telling leest de tekst
     van dit bestand. Bouwde je de URL op uit stukjes, dan staat het pad er
     nergens, en dan telt een route als ongetoetst terwijl hij hier wel degelijk
     langskomt. Een meter die je om de tuin leidt met een sjabloonstring meet
     niets (regel 10 van de lat) -- dus schrijven we ze uit. */
  const paden = [
    '/api/member/bureau/overzicht', '/api/member/bureau/nu', '/api/member/bureau/ai',
    '/api/member/bureau/tower', '/api/member/bureau/termijnen', '/api/member/bureau/graaf',
    '/api/member/bureau/knoop', '/api/member/bureau/kamers', '/api/member/bureau/raakvlak',
    '/api/member/bureau/briefing', '/api/member/bureau/delegatie', '/api/member/bureau/delegatie/zet',
    '/api/member/bureau/zaken', '/api/member/bureau/zaak/open', '/api/member/bureau/zaak/beslis',
    '/api/member/bureau/zaak/intrek', '/api/member/bureau/twin', '/api/member/bureau/twin/ruimte',
    '/api/member/bureau/twin/ruimte/weg', '/api/member/bureau/twin/installatie',
    '/api/member/bureau/twin/installatie/weg', '/api/member/bureau/twin/beurt',
    '/api/member/bureau/beveiliging', '/api/member/bureau/beveiliging/post',
    '/api/member/bureau/beveiliging/post/weg', '/api/member/bureau/beveiliging/risico',
    '/api/member/bureau/beveiliging/risico/weg', '/api/member/bureau/beveiliging/digitaal',
    '/api/member/bureau/beveiliging/digitaal/weg', '/api/member/bureau/beveiliging/incident',
    '/api/member/bureau/reputatie', '/api/member/bureau/reputatie/optreden',
    '/api/member/bureau/reputatie/optreden/weg', '/api/member/bureau/reputatie/lijn',
    '/api/member/bureau/reputatie/lijn/weg', '/api/member/bureau/reputatie/woordvoerder',
    '/api/member/bureau/reputatie/woordvoerder/weg', '/api/member/bureau/reputatie/vermelding',
    '/api/member/bureau/reputatie/vermelding/weg',
    '/api/member/bureau/dieren', '/api/member/bureau/dieren/dier',
    '/api/member/bureau/dieren/dier/weg', '/api/member/bureau/dieren/document',
    '/api/member/bureau/dieren/document/weg', '/api/member/bureau/dieren/zorg',
    '/api/member/bureau/dieren/zorg/weg',
    '/api/member/bureau/collectie', '/api/member/bureau/collectie/herkomst',
    '/api/member/bureau/collectie/herkomst/weg', '/api/member/bureau/collectie/taxatie',
    '/api/member/bureau/collectie/taxatie/weg', '/api/member/bureau/collectie/conditie',
    '/api/member/bureau/collectie/bruikleen', '/api/member/bureau/collectie/terug',
    '/api/member/bureau/relaties', '/api/member/bureau/relaties/band',
    '/api/member/bureau/relaties/band/weg', '/api/member/bureau/relaties/ontmoeting',
    '/api/member/bureau/relaties/ontmoeting/weg', '/api/member/bureau/relaties/context',
    '/api/member/bureau/reisdek', '/api/member/bureau/reisdek/verstoring',
    '/api/member/bureau/reisdek/verstoring/weg', '/api/member/bureau/reisdek/gevolg',
    '/api/member/bureau/reisdek/bon', '/api/member/bureau/reisdek/vergeten',
    '/api/member/bureau/reisdek/punten'];
  for (const p of paden) {
    const r = await fetch(BASE + p, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + rtg }, body: '{}' });
    assert.equal(r.status, 403, p + ' hoort dicht te zitten voor een RTG-pas');
  }
  // en met een Lifestyle-pas doen ze het allemaal: anders bewijst de 403
  // hierboven alleen dat de route niet bestaat (regel 9)
  const life0 = await lidMet('lifestyle');
  for (const p of paden) {
    const r = await fetch(BASE + p, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + life0 }, body: '{}' });
    assert.ok(r.status === 200 || r.status === 400 || r.status === 404,
      p + ' hoort open te staan voor Lifestyle (kreeg ' + r.status + ')');
  }
  const life = await lidMet('lifestyle');
  assert.equal((await bu('overzicht', {}, life)).status, 200);
  const biz = await lidMet('business');
  assert.equal((await bu('overzicht', {}, biz)).status, 200, 'Business erft de suite mee');
});

test('zonder token is het kantoor dicht', async () => {
  assert.equal((await bu('overzicht', {})).status, 401);
});

/* ------------------------------------------------------------- de projectie -- */
test('de graaf leest de bestaande apps en verzint er niets bij', async () => {
  const tok = await lidMet('lifestyle');
  const leeg = await json(await bu('graaf', {}, tok));
  assert.equal(leeg.graaf.knopen.length, 0, 'een vers lid heeft een leeg kantoor');

  // het bezit wordt in de BESTAANDE app aangelegd, niet in het kantoor
  await ls('bezit/zet', { soort: 'vastgoed', naam: 'Villa Ibiza', waarde: 4200000,
    verzekerdTot: overDagen(-30), onderhoudOp: overDagen(3) }, tok);

  const g = await json(await bu('graaf', {}, tok));
  const namen = g.graaf.knopen.map(k => k.naam);
  assert.equal(g.graaf.knopen.length, 3, 'het huis plus zijn twee termijnen');
  assert.ok(namen.includes('Villa Ibiza'), 'het huis zelf staat erin');
  assert.deepEqual(namen.filter(n => n !== 'Villa Ibiza').sort(), ['onderhoud', 'verzekering']);

  const huis = g.graaf.knopen.find(k => k.naam === 'Villa Ibiza');
  assert.equal(huis.bron, 'Bezittingenregister', 'elk stuk draagt zijn bron');
  assert.equal(huis.kamer, 'huishouden', 'vastgoed hoort bij het huishouden');
  assert.equal(huis.waarde, 4200000);
  // de twee termijnen hangen aan het huis: dat is de kant die de tower gebruikt
  assert.equal(g.graaf.kanten.filter(e => e.van === huis.id).length, 2);
});

test('de graaf schrijft niets terug in het dossier van het lid', async () => {
  /* De hele opzet leunt hierop: de graaf is een PROJECTIE. Zou hij bij het lezen
     lijsten aanmaken, dan groeit de database met een rij per lid dat een keer
     heeft gekeken -- en erger, dan bestaat er een tweede plek waar de waarheid
     staat. Rechtstreeks op de kern getoetst, want via HTTP is "er is niets
     geschreven" niet te zien. */
  const db = { data: { lifestyle: { k1: { bezittingen: [{ id: 'b1', soort: 'kunst', naam: 'Doek', waarde: 100 }] } } } };
  let bewaard = 0;
  const kern = require('../server/kern/bureau')({ db, save: () => { bewaard++; },
    crypto, anthropic: null, liveCodename: () => 'Codenaam', notify: null });
  const voor = JSON.stringify(db.data.lifestyle);
  kern.bureau.overzicht('k1');
  kern.bureau.tower('k1');
  kern.bureau.graaf('k1', 'lid');
  kern.bureau.kamers('k1');
  assert.equal(JSON.stringify(db.data.lifestyle), voor, 'lezen mag het dossier niet veranderen');
  assert.equal(bewaard, 0, 'lezen mag niet opslaan');
  // en een lid dat nog nergens in staat, komt er ook niet in te staan
  kern.bureau.overzicht('nooitgezien');
  assert.equal(db.data.lifestyle.nooitgezien, undefined);
});

/* ----------------------------------------------------------------- de tower -- */
test('de Control Tower bundelt de termijnen uit verschillende apps', async () => {
  const tok = await lidMet('lifestyle');
  await ls('bezit/zet', { soort: 'vastgoed', naam: 'Villa', waarde: 100,
    verzekerdTot: overDagen(-30), onderhoudOp: overDagen(3) }, tok);
  // een tweede app: een paspoort dat al verlopen is
  await raw('/member/rechterhand/entourage/persoon', { naam: 'Kind A', band: 'kind' }, tok);
  const ent = await json(await raw('/member/rechterhand/entourage', {}, tok));
  await raw('/member/rechterhand/entourage/doc', { id: ent.gezelschap[0].id, soort: 'paspoort', tot: overDagen(-10) }, tok);

  const t = await json(await bu('tower', {}, tok));
  assert.equal(t.achterstallig.length, 2, 'de verzekering en het paspoort, uit twee verschillende apps');
  assert.deepEqual(t.achterstallig.map(r => r.bron).sort(), ['Bezittingenregister', 'Entourage']);
  assert.equal(t.achterstalligZwaar, 2, 'verzekering en paspoort tellen allebei als zwaar');

  const week = t.vensters.find(v => v.sleutel === 'week');
  assert.equal(week.aantal, 1, 'het onderhoud van over drie dagen');
  assert.equal(week.items[0].wat, 'onderhoud');
  assert.equal(week.items[0].waarvan, 'Villa', 'de tower zegt waar de termijn bij hoort');
  // en hij staat in PRECIES EEN venster; anders telt de kop hem dubbel
  const maand = t.vensters.find(v => v.sleutel === 'maand');
  assert.equal(maand.aantal, 0);
});

test('de kop van de Situation Room is een bewering die klopt', async () => {
  const tok = await lidMet('lifestyle');
  let nu = await json(await bu('nu', {}, tok));
  assert.equal(nu.kop, 'Alles onder controle', 'een leeg kantoor is rustig');
  assert.equal(nu.regels.length, 0);

  await ls('bezit/zet', { soort: 'vastgoed', naam: 'Villa', waarde: 100, verzekerdTot: overDagen(-5) }, tok);
  nu = await json(await bu('nu', {}, tok));
  assert.equal(nu.kop, '1 zaak vraagt aandacht', 'met iets verlopen mag daar niet "onder controle" staan');
  assert.equal(nu.ernst, 'hoog');
  assert.equal(nu.tellingen.achterstallig, 1);
});

/* -------------------------------------------------------------- de delegatie -- */
test('het dak op gezondheid en nalatenschap is niet op te hogen', async () => {
  const tok = await lidMet('lifestyle');
  for (const [domein, tever] of [['gezondheid', 2], ['nalatenschap', 1]]) {
    const r = await bu('delegatie/zet', { domein, niveau: tever }, tok);
    assert.equal(r.status, 400, domein + ' mag niet naar L' + tever);
  }
  // en de stand is er ook niet stiekem toch veranderd
  const d = await json(await bu('delegatie', {}, tok));
  assert.equal(d.domeinen.find(x => x.domein === 'gezondheid').niveau, 1);
  assert.equal(d.domeinen.find(x => x.domein === 'nalatenschap').niveau, 0);
  // wat WEL mag, moet ook echt werken -- anders bewijst de weigering hierboven
  // alleen dat de route stuk is
  assert.equal((await bu('delegatie/zet', { domein: 'gezondheid', niveau: 1 }, tok)).status, 200);
});

test('de grens bepaalt of een zaak doorloopt of op uw handtekening wacht', async () => {
  const tok = await lidMet('lifestyle');
  await bu('delegatie/zet', { domein: 'vervoer', niveau: 3, grensCenten: 250000 }, tok);

  const binnen = await json(await bu('zaak/open', { titel: 'Beurt', domein: 'vervoer', bedragCenten: 200000 }, tok));
  assert.equal(binnen.zaak.status, 'in uitvoering');
  assert.equal(binnen.zaak.beslissing.nodig, false);

  const buiten = await json(await bu('zaak/open', { titel: 'Nieuwe wagen', domein: 'vervoer', bedragCenten: 30000000 }, tok));
  assert.equal(buiten.zaak.status, 'wacht op uw akkoord');
  assert.equal(buiten.zaak.beslissing.nodig, true);

  // een bijzonder verzoek gaat ALTIJD langs het lid, ook binnen de grens
  const bijz = await json(await bu('zaak/open', { titel: 'Iets onmogelijks', soort: 'bijzonder',
    domein: 'vervoer', bedragCenten: 100 }, tok));
  assert.equal(bijz.zaak.status, 'wacht op uw akkoord');
  assert.ok(bijz.zaak.team.some(t => t.rol === 'Sourcing-specialist'));

  const na = await json(await bu('zaak/beslis', { id: buiten.zaak.id, akkoord: true }, tok));
  assert.equal(na.zaak.status, 'in uitvoering');
});

/* --------------------------------------------------------------- de grendel -- */
test('een besloten zaak bereikt het concierge-bureau niet', async () => {
  const tok = await lidMet('lifestyle');
  const otok = await officeTok();
  const open = await json(await bu('zaak/open', { titel: 'Gewoon verzoek', domein: 'huishouden' }, tok));
  const besloten = await json(await bu('zaak/open', { titel: 'Second opinion', domein: 'gezondheid' }, tok));

  // ook hier voluit, zodat de meter /api/office/bureau ziet staan
  const desk = await json(await raw('/office/bureau', {}, otok));
  const mijn = desk.zaken.find(z => z.id === open.zaak.id);
  assert.ok(mijn, 'het gewone verzoek hoort er wél te staan');
  assert.ok(!desk.zaken.some(z => z.id === besloten.zaak.id), 'de besloten zaak mag het bureau niet bereiken');

  // ook niet als het bureau hem rechtstreeks bij de kop pakt, met de sleutel van
  // dit lid uit de zaak die hij WEL mag zien
  const poging = await raw('/office/bureau/voortgang', { key: mijn.key, id: besloten.zaak.id,
    status: 'in uitvoering', notitie: 'x' }, otok);
  assert.equal(poging.status, 403);
});

test('alleen een mens achter het bureau kan een zaak op geregeld zetten', async () => {
  const tok = await lidMet('lifestyle');
  const otok = await officeTok();
  const z = await json(await bu('zaak/open', { titel: 'Tafel voor acht', domein: 'gelegenheden' }, tok));
  assert.equal(z.zaak.status, 'wacht op uw akkoord');

  const desk = await json(await oc('bureau', {}, otok));
  const mijn = desk.zaken.find(x => x.id === z.zaak.id);
  assert.ok(mijn, 'de zaak staat op het bureau');

  // zolang het lid niet getekend heeft, mag het bureau niets afronden
  const vroeg = await oc('bureau/voortgang', { key: mijn.key, id: z.zaak.id, status: 'geregeld', notitie: 'klaar' }, otok);
  assert.equal(vroeg.status, 400);

  await bu('zaak/beslis', { id: z.zaak.id, akkoord: true }, tok);
  const laat = await oc('bureau/voortgang', { key: mijn.key, id: z.zaak.id, status: 'geregeld', notitie: 'Bevestigd.' }, otok);
  assert.equal(laat.status, 200);

  const zaken = await json(await bu('zaken', {}, tok));
  const na = zaken.zaken.find(x => x.id === z.zaak.id);
  assert.equal(na.status, 'geregeld');
  assert.equal(na.tijdlijn[na.tijdlijn.length - 1].door, 'kantoor', 'de laatste stap komt van een mens');

  // en er is geen route van het lid die dat ook kan
  const zelf = await bu('zaak/beslis', { id: z.zaak.id, akkoord: true }, tok);
  assert.equal(zelf.status, 400, 'het lid kan zijn eigen zaak niet nog eens afronden');
});

/* ----------------------------------------------------------------- de kamers -- */
test('elke deur op de plattegrond geeft toegang tot een pagina die bestaat', async () => {
  /* Een kamer die naar een pagina wijst die er niet is, is een gesloten deur met
     een bordje. Dit is de machinale handhaving van de belofte in kamers.js. */
  const kern = require('../server/kern/bureau')({ db: { data: { lifestyle: {} } }, save: () => {},
    crypto, anthropic: null, liveCodename: () => '', notify: null });
  const wortel = path.join(__dirname, '..', 'public');
  let geteld = 0;
  for (const kamer of kern.bureau.KAMERS) {
    for (const app of kamer.apps) {
      const bestand = path.join(wortel, app.url.replace(/^\//, ''));
      assert.ok(fs.existsSync(bestand), kamer.naam + ' wijst naar ' + app.url + ', en dat bestand is er niet');
      geteld++;
    }
  }
  assert.ok(geteld >= 20, 'er horen echt deuren te zijn, niet nul (dan bewijst de lus niets)');
  // en de status is afgeleid, niet beweerd
  for (const kamer of kern.bureau.KAMERS) {
    const uit = kern.bureau.kamers('leeg').kamers.find(k => k.id === kamer.id);
    assert.equal(uit.status, kamer.apps.length ? 'ingericht' : 'in aanbouw');
  }
});

/* ----------------------------------------------------------------- de kluis -- */
test('besloten knopen verlaten de kring van het lid niet, wat een bron ook beweert', async () => {
  /* De poort in graaf.js zit in de knoop-fabriek en niet in elke bron apart. */
  const db = { data: { lifestyle: { k1: {
    cellier: [{ id: 'f1', naam: 'Chateau', aantal: 1, waarde: 100 }],
    afspraken: [{ id: 'a1', wat: 'Uitslag bespreken', datum: overDagen(2) }],
    nalatenschap: { documenten: [{ id: 'n1', titel: 'Testament' }] }
  } } } };
  const kern = require('../server/kern/bureau')({ db, save: () => {}, crypto,
    anthropic: null, liveCodename: () => '', notify: null });

  const alles = kern.bureau.graaf('k1', 'lid');
  assert.equal(alles.knopen.length, 3, 'het lid ziet zijn eigen kantoor helemaal');

  const bureau = kern.bureau.graaf('k1', 'kantoor');
  assert.deepEqual(bureau.knopen.map(k => k.naam), ['Chateau'], 'alleen de fles bereikt het bureau');
  assert.equal(bureau.verborgen, 2, 'de afspraak en het testament blijven binnen');

  // en de invariant zelf, over de hele graaf: besloten betekent altijd 'lid'
  for (const k of alles.knopen) {
    if (k.gevoelig >= 3) assert.equal(k.deel, 'lid', k.naam + ' is besloten maar reikt verder dan het lid');
  }
  // de Rechterhand zit ertussenin en ziet de fles wel, de afspraak niet
  const rh = kern.bureau.graaf('k1', 'rechterhand');
  assert.equal(rh.knopen.length, 1);
});

test('de knoop-fabriek zet een bron terug die zichzelf te ver vrijgeeft', async () => {
  /* De veertien bronnen houden zich netjes aan de regel, en juist daarom bewees
     de toets hierboven de FABRIEK niet: een mutatie die de regel eruit sloopte
     liet alles groen (afgeslagen -- regel 2 van de lat noemt dat een bevinding).
     Hier gaat de knoop er rechtstreeks in, met een bewering die niet mag. */
  const kern = require('../server/kern/bureau')({ db: { data: { lifestyle: {} } }, save: () => {},
    crypto, anthropic: null, liveCodename: () => '', notify: null });
  const K = kern.bureau.knoopFabriek;

  const stout = K({ id: 'x:1', soort: 'afspraak', naam: 'Uitslag', kamer: 'gezondheid',
    bron: 'Verzonnen bron', gevoelig: 3, deel: 'kantoor' });
  assert.equal(stout.deel, 'lid', 'besloten reikt nooit verder dan het lid, wat de bron ook zegt');

  // en de fabriek knijpt niet ALLES dicht: dat zou de toets hierboven ook groen
  // maken zonder dat er iets werkt
  const open = K({ id: 'x:2', soort: 'fles', naam: 'Chateau', kamer: 'collectie',
    bron: 'Cellier', gevoelig: 0, deel: 'kantoor' });
  assert.equal(open.deel, 'kantoor', 'een open knoop mag het bureau wel bereiken');

  // een bron die niets zegt, komt niet per ongeluk bij het bureau terecht
  assert.equal(K({ id: 'x:3', soort: 'bezit', naam: 'Ding', kamer: 'vermogen', bron: 'B' }).deel, 'rechterhand');
  // en een gevoeligheid buiten de trap valt binnen de trap
  assert.equal(K({ id: 'x:4', soort: 'bezit', naam: 'Ding', kamer: 'vermogen', bron: 'B', gevoelig: 9 }).deel, 'lid');
});

test('een verjaardag uit Attenties landt als datum in de Control Tower', async () => {
  /* Deze toets zit er omdat de kruisscan een gat aanwees: na het opknippen van
     de bronnen gebruikte de ene helft een hulpfunctie die alleen de andere
     importeerde. Dat viel niet om -- graaf.js vangt een vallende bron op en
     meldt hem als "stuk" -- maar het hele Attenties-deel was dan stil weg. Een
     kamer die stil leeg is, is precies waar regel 5 van de lat over gaat.

     Een verjaardag is 'MM-DD' en moet naar de eerstvolgende echte datum worden
     gerekend; die omrekening is het enige stukje eigen rekenwerk in de bronnen. */
  const tok = await lidMet('lifestyle');
  const over = new Date(Date.now() + 5 * 86400000);
  const mmdd = String(over.getMonth() + 1).padStart(2, '0') + '-' + String(over.getDate()).padStart(2, '0');
  await raw('/member/rechterhand/attenties/relatie', { naam: 'Moeder', band: 'familie', verjaardag: mmdd }, tok);

  const nu = await json(await bu('nu', {}, tok));
  assert.equal(nu.tellingen.storingen, 0, 'geen enkele bron mag stil omvallen');

  const t = await json(await bu('tower', {}, tok));
  const week = t.vensters.find(v => v.sleutel === 'week');
  assert.equal(week.aantal, 1, 'de verjaardag van over vijf dagen staat in het weekvenster');
  assert.equal(week.items[0].wat, 'verjaardag');
  assert.equal(week.items[0].waarvan, 'Moeder');
  assert.equal(week.items[0].dagen, 5);
});

/* ------------------------------------------------------- de orkestratie ----- */
test('"wij gaan zes weken weg" vindt wat daar in vier andere apps mee samenhangt', async () => {
  /* Dit is waar de graaf voor is gebouwd. Het lid noemt een periode; het
     kantoor komt terug met het paspoort dat er middenin verloopt, de
     verzekering die afloopt, de verjaardag die hij mist en de toezegging die
     hij al deed -- elk uit een andere app, geen ervan uit deze. */
  const tok = await lidMet('lifestyle');
  await ls('bezit/zet', { soort: 'vastgoed', naam: 'Huis', waarde: 100, verzekerdTot: overDagen(35) }, tok);
  await raw('/member/rechterhand/entourage/persoon', { naam: 'Kind A', band: 'kind' }, tok);
  const ent = await json(await raw('/member/rechterhand/entourage', {}, tok));
  await raw('/member/rechterhand/entourage/doc', { id: ent.gezelschap[0].id, soort: 'paspoort', tot: overDagen(40) }, tok);
  await raw('/member/rechterhand/table/zet', { naam: 'Diner Van Doorn', datum: overDagen(45) }, tok);
  // en iets ERBUITEN, dat dus juist NIET mee mag komen
  await ls('bezit/zet', { soort: 'voertuig', naam: 'Wagen', waarde: 100, onderhoudOp: overDagen(200) }, tok);

  const r = await json(await bu('raakvlak', { van: overDagen(30), tot: overDagen(72), domein: 'reizen' }, tok));
  assert.equal(r.dagen, 43);
  assert.equal(r.raakt.length, 3, 'drie punten vallen in het venster, de vierde niet');
  assert.deepEqual(r.raakt.map(x => x.bron).sort(), ['Bezittingenregister', 'Entourage', 'Table']);
  assert.ok(!r.raakt.some(x => x.naam === 'onderhoud'), 'wat buiten de periode valt hoort er niet bij');

  // de keten van het domein staat er ook, met de concrete punten eronder
  const gez = r.keten.find(k => k.domein === 'gezelschap');
  assert.equal(gez.raakt.length, 1, 'het paspoort hangt onder "reisdocumenten van uw gezelschap"');
  /* En wat het kantoor NIET dekt. Dit stond hier als
     `assert.ok(r.nietGedekt.includes('dieren'))` toen de Pet Office nog niet
     bestond; nu is er geen kamer meer in aanbouw en hoort de lijst leeg te zijn.
     De bewering is meegegroeid met de waarheid in plaats van weggehaald: hij
     komt uit kamers.js, dus zodra iemand een nieuwe wereld toevoegt zonder hem
     te bouwen, zakt deze regel en staat het weer op het scherm. */
  assert.deepEqual(r.nietGedekt, [], 'alle twintig werelden hebben nu een deur');
  assert.ok(r.keten.some(k => k.domein === 'dieren'), 'en de dieren zitten in de keten van een reis');
});

test('een verzoek valt uiteen in deelopdrachten, elk met een eigen mandaat', async () => {
  const tok = await lidMet('lifestyle');
  // twee domeinen, twee verschillende mandaten -> twee verschillende uitkomsten
  await bu('delegatie/zet', { domein: 'huishouden', niveau: 4, grensCenten: 100000 }, tok);
  const z = await json(await bu('zaak/open', { titel: 'Diner voor dertig', domein: 'gelegenheden' }, tok));
  const per = Object.fromEntries(z.zaak.deelopdrachten.map(d => [d.domein, d.magZelf]));
  assert.equal(per.huishouden, true, 'de woning gereedmaken valt onder het mandaat dat u gaf');
  assert.equal(per.vervoer, false, 'vervoer staat nog op voorbereiden en wordt voorgelegd');
  assert.equal(z.zaak.deelopdrachten.length, 5);
  assert.ok(!z.zaak.deelopdrachten.some(d => d.domein === 'gezondheid' || d.domein === 'nalatenschap'),
    'geen enkel verzoek sleept de twee besloten kamers mee');

  // een besloten zaak krijgt er helemaal geen
  const b = await json(await bu('zaak/open', { titel: 'Iets persoonlijks', domein: 'gezondheid' }, tok));
  assert.deepEqual(b.zaak.deelopdrachten, []);
});

/* ---------------------------------------------------------- de tweeling ----- */
test('de woningtweeling voedt dezelfde Control Tower als de rest', async () => {
  const tok = await lidMet('lifestyle');
  // een tweeling zonder woning in het register kan niet bestaan
  const zonder = await bu('twin/ruimte', { huisId: 'bestaatniet', naam: 'Kelder' }, tok);
  assert.equal(zonder.status, 404, 'geen tweede huizenlijst: de woning komt uit het register');

  await ls('bezit/zet', { soort: 'vastgoed', naam: 'Villa Ibiza', waarde: 100 }, tok);
  const bez = await json(await ls('bezit', {}, tok));
  const huisId = bez.bezittingen[0].id;
  await bu('twin/ruimte', { huisId, naam: 'Zwembad' }, tok);
  const t1 = await json(await bu('twin', { huisId }, tok));
  const ruimteId = t1.gekozen.ruimtes[0].id;
  await bu('twin/installatie', { huisId, ruimteId, naam: 'Pomp 2', soort: 'zwembad',
    merk: 'Speck', geplaatst: '2019-04-01', onderhoudOp: overDagen(4), leverancier: 'Aqua BV' }, tok);

  // en nu het punt: die datum staat in de tower, tussen de verzekeringen
  const tw = await json(await bu('tower', {}, tok));
  const week = tw.vensters.find(v => v.sleutel === 'week');
  assert.equal(week.aantal, 1);
  assert.equal(week.items[0].bron, 'Woningtweeling');
  assert.equal(week.items[0].waarvan, 'Zwembad · Pomp 2', 'de beurt hangt aan de installatie');

  // een beurt bijschrijven schuift de volgende datum mee
  const inst = t1.gekozen.ruimtes[0];
  const t2 = await json(await bu('twin', { huisId }, tok));
  const instId = t2.gekozen.ruimtes[0].installaties[0].id;
  await bu('twin/beurt', { huisId, id: instId, wat: 'Lager vervangen', door: 'Aqua BV',
    kostenCenten: 42000, volgende: overDagen(200) }, tok);
  const t3 = await json(await bu('twin', { huisId }, tok));
  const na = t3.gekozen.ruimtes[0].installaties[0];
  assert.equal(na.historie.length, 1);
  assert.equal(na.onderhoudOp, overDagen(200), 'de volgende beurt is opgeschoven');
  const tw2 = await json(await bu('tower', {}, tok));
  assert.equal(tw2.vensters.find(v => v.sleutel === 'week').aantal, 0, 'en hij staat niet meer deze week');
});

/* ------------------------------------------------------------- de inkoop ---- */
test('een geregelde inkoop schrijft zichzelf in het Bezittingenregister', async () => {
  const tok = await lidMet('lifestyle');
  const otok = await officeTok();
  const leeg = await json(await ls('bezit', {}, tok));
  assert.equal(leeg.bezittingen.length, 0);

  const z = await json(await bu('zaak/open', { titel: 'Horloge zoals dat van mijn vader',
    soort: 'inkoop', domein: 'collectie', bedragCenten: 2500000,
    registreerNaam: 'Patek 3448', registreerSoort: 'horloge' }, tok));
  assert.equal(z.zaak.registreren.gedaan, false, 'nog niet: er is nog niets geleverd');
  await bu('zaak/beslis', { id: z.zaak.id, akkoord: true }, tok);

  const desk = await json(await oc('bureau', {}, otok));
  const mijn = desk.zaken.find(x => x.id === z.zaak.id);
  assert.equal((await oc('bureau/voortgang', { key: mijn.key, id: z.zaak.id,
    status: 'geregeld', notitie: 'Gevonden en geleverd.' }, otok)).status, 200);

  const na = await json(await ls('bezit', {}, tok));
  assert.equal(na.bezittingen.length, 1, 'de aankoop staat nu in het register');
  assert.equal(na.bezittingen[0].naam, 'Patek 3448');
  assert.equal(na.bezittingen[0].soort, 'horloge');
  assert.equal(na.bezittingen[0].waarde, 25000, 'de centen van de zaak worden de euro\'s van het register');
  // en hij staat meteen in de graaf, waar de tower om een verzekering vraagt
  const g = await json(await bu('graaf', {}, tok));
  assert.ok(g.graaf.knopen.some(k => k.naam === 'Patek 3448' && k.kamer === 'collectie'));
});

/* ---------------------------------------------------------- de briefing ----- */
test('de avondbriefing telt wat er echt is gebeurd, niet wat er speelt', async () => {
  const tok = await lidMet('lifestyle');
  const stil = await json(await bu('briefing', { moment: 'avond' }, tok));
  assert.equal(stil.kop, 'Een rustige dag');
  assert.equal(stil.gebeurd.length, 0);

  await bu('delegatie/zet', { domein: 'huishouden', niveau: 3, grensCenten: 100000 }, tok);
  await bu('zaak/open', { titel: 'Ramen laten doen', domein: 'huishouden', bedragCenten: 50000 }, tok);
  const na = await json(await bu('briefing', { moment: 'avond' }, tok));
  assert.equal(na.gebeurd.length, 2, 'genoteerd en in uitvoering: twee stappen');
  assert.equal(na.kop, '2 stappen gezet vandaag');
  assert.equal(na.lopend, 1);

  // de ochtend kijkt vooruit en gebruikt andere getallen
  await ls('bezit/zet', { soort: 'vastgoed', naam: 'Huis', waarde: 1, onderhoudOp: overDagen(1) }, tok);
  const o = await json(await bu('briefing', { moment: 'ochtend' }, tok));
  assert.equal(o.morgen.length, 1);
  assert.equal(o.vandaag.length, 0);
  assert.equal(o.wijDoen.length, 1, 'wat wij vandaag voor u doen');
});

test('de briefing laat de twee besloten kamers erbuiten', async () => {
  const tok = await lidMet('lifestyle');
  await bu('zaak/open', { titel: 'Second opinion', domein: 'gezondheid' }, tok);
  await bu('zaak/open', { titel: 'Ramen', domein: 'huishouden' }, tok);
  const av = await json(await bu('briefing', { moment: 'avond' }, tok));
  assert.ok(!av.gebeurd.some(x => x.zaak === 'Second opinion'), 'een dagverslag is de verkeerde plek daarvoor');
  assert.ok(av.gebeurd.some(x => x.zaak === 'Ramen'));
  const och = await json(await bu('briefing', { moment: 'ochtend' }, tok));
  assert.ok(!och.beslissingen.some(x => x.titel === 'Second opinion'));
});

test('de avondbriefing telt alleen de stappen van vandaag', async () => {
  /* Deze toets bestaat omdat een mutatie AFSLOEG: de datumfilter in de
     avondbriefing eruit halen liet alles groen. Logisch -- in een toets gebeurt
     alles vandaag, dus "alleen vandaag" en "alles" geven hetzelfde antwoord.
     Een dagverslag dat stilletjes de hele week meetelt is wel precies het soort
     getal dat je overschrijft zonder het na te rekenen (regel 10 van de lat).
     Vandaar hier een dossier met een gisteren erin. */
  const gisteren = new Date(Date.now() - 86400000).toISOString();
  const db = { data: { lifestyle: { k1: { cases: [{
    id: 'c1', titel: 'Loopt al langer', domein: 'huishouden', soort: 'regulier',
    status: 'in uitvoering', besloten: false, at: gisteren,
    beslissing: { nodig: false, gegeven: '', op: '' }, delegatie: { reden: '' },
    team: [], deelopdrachten: [], tijdlijn: [
      { op: gisteren, status: 'genoteerd', notitie: 'Gisteren genoteerd.', door: 'systeem' },
      { op: gisteren, status: 'in voorbereiding', notitie: 'Gisteren opgepakt.', door: 'kantoor' },
      { op: new Date().toISOString(), status: 'in uitvoering', notitie: 'Vandaag verder.', door: 'kantoor' }
    ] }] } } } };
  const kern = require('../server/kern/bureau')({ db, save: () => {}, crypto,
    anthropic: null, liveCodename: () => '', notify: null });
  const av = kern.bureau.briefing('k1', 'avond');
  assert.equal(av.gebeurd.length, 1, 'twee stappen zijn van gisteren en horen er niet bij');
  assert.equal(av.gebeurd[0].notitie, 'Vandaag verder.');
  assert.equal(av.kop, '1 stap gezet vandaag');
  assert.equal(av.doorOns, 1);
  // en de lopende zaak telt nog steeds mee: die is niet van vandaag maar wel waar
  assert.equal(av.lopend, 1);
});

/* ------------------------------------------------- de laatste drie kamers --- */
test('een incident in de Security Office wordt meteen een zaak met een team', async () => {
  /* De koppeling is het punt. Een incident dat alleen in een eigen lijstje
     belandt, is een tweede plek waar iets loopt -- en dan is de vraag "waar
     staat dit ook alweer" terug. */
  const tok = await lidMet('lifestyle');
  const r = await json(await raw('/member/bureau/beveiliging/incident',
    { wat: 'Storing alarm Villa', details: 'Zone 3 meldt sinds vanochtend.' }, tok));
  assert.equal(r.zaak.soort, 'warroom');
  assert.equal(r.zaak.status, 'in uitvoering', 'bij een incident wordt niet eerst om budget gevraagd');
  assert.ok(r.zaak.team.some(t => t.rol === 'Incidentcoördinator'));

  const zaken = await json(await raw('/member/bureau/zaken', {}, tok));
  assert.ok(zaken.zaken.some(z => z.id === r.incident.caseId), 'het incident wijst naar de zaak');

  // en een risico-inschatting ZONDER houdbaarheid komt er niet in
  const zonder = await raw('/member/bureau/beveiliging/risico', { land: 'Ergens', niveau: 'hoog' }, tok);
  assert.equal(zonder.status, 400, 'een inschatting zonder datum wordt stilzwijgend eeuwig');
  const met = await raw('/member/bureau/beveiliging/risico',
    { land: 'Ergens', niveau: 'hoog', tot: overDagen(3) }, tok);
  assert.equal(met.status, 200);
  const tw = await json(await raw('/member/bureau/tower', {}, tok));
  assert.equal(tw.vensters.find(v => v.sleutel === 'week').items[0].wat, 'risico-inschatting',
    'en hij verloopt, zodat iemand er opnieuw naar kijkt');
});

test('de Pet Office vult het gat dat de Ibiza-proef liet zien', async () => {
  const tok = await lidMet('lifestyle');
  await raw('/member/bureau/dieren/dier', { naam: 'Nero', soort: 'hond', verzekerdTot: overDagen(40) }, tok);
  const d1 = await json(await raw('/member/bureau/dieren', {}, tok));
  assert.equal(d1.dieren.length, 1);
  assert.equal(d1.zonderOppas, 1, 'zonder oppas is zelf de melding');
  const dier = d1.dieren[0];
  await raw('/member/bureau/dieren/document', { id: dier.id, soort: 'vaccinatie', tot: overDagen(38) }, tok);
  await raw('/member/bureau/dieren/zorg', { id: dier.id, wat: 'Ontworming', volgende: overDagen(45) }, tok);

  // het punt: alle drie de datums vallen in de reisperiode en komen mee
  const r = await json(await raw('/member/bureau/raakvlak',
    { van: overDagen(30), tot: overDagen(72), domein: 'reizen' }, tok));
  const van = r.raakt.filter(x => x.kamer === 'dieren').map(x => x.wat).sort();
  assert.deepEqual(van, ['vaccinatie', 'verzekering', 'zorg']);
  const keten = r.keten.find(k => k.domein === 'dieren');
  assert.equal(keten.raakt.length, 3, 'ze hangen onder "uw dieren" en niet los onderaan');
});

test('een embargo verloopt, en tot die dag staat het in de tower', async () => {
  const tok = await lidMet('lifestyle');
  await raw('/member/bureau/reputatie/optreden',
    { wat: 'Interview over de stichting', soort: 'interview', datum: overDagen(20),
      embargoTot: overDagen(5), woordvoerder: 'J. Smit' }, tok);
  const tw = await json(await raw('/member/bureau/tower', {}, tok));
  const week = tw.vensters.find(v => v.sleutel === 'week');
  assert.equal(week.aantal, 1);
  assert.equal(week.items[0].wat, 'embargo');
  assert.equal(week.items[0].waarvan, 'Interview over de stichting');
  const rp = await json(await raw('/member/bureau/reputatie', {}, tok));
  assert.equal(rp.onderEmbargo, 1);
  assert.match(rp.bron, /monitoren het web NIET/, 'het scherm zegt zelf wat het niet doet');
});

/* ------------------------------------------------- de drie verdiepingen ----- */
test('een bruikleen zonder einddatum bestaat niet, en een lopende staat in de tower', async () => {
  const tok = await lidMet('lifestyle');
  await ls('bezit/zet', { soort: 'kunst', naam: 'Doek', waarde: 90000 }, tok);
  const bez = await json(await ls('bezit', {}, tok));
  const id = bez.bezittingen[0].id;

  const zonder = await raw('/member/bureau/collectie/bruikleen', { bezitId: id, aan: 'Museum' }, tok);
  assert.equal(zonder.status, 400, 'een bruikleen zonder einddatum is een schenking zonder handtekening');
  assert.equal((await raw('/member/bureau/collectie/bruikleen',
    { bezitId: id, aan: 'Museum X', tot: overDagen(5) }, tok)).status, 200);

  const tw = await json(await raw('/member/bureau/tower', {}, tok));
  const week = tw.vensters.find(v => v.sleutel === 'week');
  assert.equal(week.aantal, 1);
  assert.equal(week.items[0].wat, 'bruikleen');
  assert.equal(week.items[0].waarvan, 'Doek', 'de termijn hangt aan het stuk uit het register');

  // en zodra het terug is, is de termijn weg
  const col = await json(await raw('/member/bureau/collectie', { bezitId: id }, tok));
  await raw('/member/bureau/collectie/terug', { bezitId: id, id: col.gekozen.bruikleen[0].id }, tok);
  const tw2 = await json(await raw('/member/bureau/tower', {}, tok));
  assert.equal(tw2.vensters.find(v => v.sleutel === 'week').aantal, 0);

  // een taxatie zonder taxateur is een gok met twee decimalen
  assert.equal((await raw('/member/bureau/collectie/taxatie', { bezitId: id, bedrag: 100000 }, tok)).status, 400);
  assert.equal((await raw('/member/bureau/collectie/taxatie',
    { bezitId: id, bedrag: 100000, door: "Christie's", volgende: overDagen(400) }, tok)).status, 200);
});

test('een band tussen twee relaties wordt aan beide kanten vastgelegd', async () => {
  const tok = await lidMet('lifestyle');
  await raw('/member/rechterhand/attenties/relatie', { naam: 'Anna van Doorn', band: 'vriend' }, tok);
  await raw('/member/rechterhand/attenties/relatie', { naam: 'Pieter van Doorn', band: 'vriend' }, tok);
  const lijst = await json(await raw('/member/bureau/relaties', {}, tok));
  const [a, b] = lijst.relaties;

  assert.equal((await raw('/member/bureau/relaties/band',
    { relatieId: a.id, naarId: a.id, wat: 'partner' }, tok)).status, 400, 'niet met zichzelf');
  assert.equal((await raw('/member/bureau/relaties/band',
    { relatieId: a.id, naarId: b.id, wat: 'kind' }, tok)).status, 200);

  // de spiegel: bij de een 'kind', bij de ander 'ouder'
  const va = await json(await raw('/member/bureau/relaties', { relatieId: a.id }, tok));
  const vb = await json(await raw('/member/bureau/relaties', { relatieId: b.id }, tok));
  assert.equal(va.gekozen.kring[0].wat, 'kind');
  assert.equal(vb.gekozen.kring[0].wat, 'ouder', 'zonder spiegel ziet de ander niets');
  assert.equal(vb.gekozen.kring[0].naam, va.gekozen.naam);

  await raw('/member/bureau/relaties/context',
    { relatieId: a.id, werk: 'notaris', nooitOver: 'de scheiding' }, tok);
  const na = await json(await raw('/member/bureau/relaties', {}, tok));
  assert.equal(na.relaties.find(r => r.id === a.id).letOp, true, 'de lijst waarschuwt dat er iets ligt');

  // en weghalen haalt hem aan BEIDE kanten weg
  await raw('/member/bureau/relaties/band/weg', { relatieId: a.id, naarId: b.id }, tok);
  const vb2 = await json(await raw('/member/bureau/relaties', { relatieId: b.id }, tok));
  assert.equal(vb2.gekozen.kring.length, 0);
});

test('een verstoring houdt zijn gevolgen apart bij, en wat blijft liggen krijgt een datum', async () => {
  const tok = await lidMet('lifestyle');
  await raw('/member/rechterhand/reis/zet', { naam: 'Ibiza', van: overDagen(2), tot: overDagen(9) }, tok);
  const rb = await json(await raw('/member/rechterhand/reisboek', {}, tok));
  const reisId = rb.reizen[0].id;

  await raw('/member/bureau/reisdek/verstoring', { reisId, wat: 'Vlucht 74 minuten later',
    soort: 'vlucht', minuten: 74, gevolgen: ['Chauffeur aanpassen', 'Restaurant inlichten', 'Hotel late aankomst'] }, tok);
  let d = await json(await raw('/member/bureau/reisdek', { reisId }, tok));
  assert.equal(d.gekozen.verstoringen[0].gevolgen.length, 3);
  assert.equal(d.reizen[0].openGevolgen, 3, 'drie dingen staan open, niet een verstoring');

  const v = d.gekozen.verstoringen[0];
  await raw('/member/bureau/reisdek/gevolg',
    { reisId, verstoringId: v.id, id: v.gevolgen[0].id, stand: 'geregeld' }, tok);
  d = await json(await raw('/member/bureau/reisdek', { reisId }, tok));
  assert.equal(d.reizen[0].openGevolgen, 2, 'afvinken doe je per gevolg, niet per verstoring');

  // iets laten liggen: dat wordt een termijn in de Control Tower
  await raw('/member/bureau/reisdek/vergeten',
    { reisId, wat: 'Linnen jasje', waar: 'Hotel', terugOp: overDagen(4) }, tok);
  const tw = await json(await raw('/member/bureau/tower', {}, tok));
  const week = tw.vensters.find(v2 => v2.sleutel === 'week').items;
  assert.ok(week.some(x => x.wat === 'achtergelaten' && x.waarvan === 'Ibiza'),
    'een jas die ergens hangt is een termijn zolang hij niet terug is');

  // en zodra hij terug is, is hij weg uit de tower
  const dd = await json(await raw('/member/bureau/reisdek', { reisId }, tok));
  await raw('/member/bureau/reisdek/vergeten',
    { reisId, id: dd.gekozen.nazorg.vergeten[0].id, wat: 'Linnen jasje', stand: 'terug' }, tok);
  const tw2 = await json(await raw('/member/bureau/tower', {}, tok));
  assert.ok(!tw2.vensters.find(v2 => v2.sleutel === 'week').items.some(x => x.wat === 'achtergelaten'));
});

test('alle twintig werelden hebben een deur, en de plattegrond beweert dat niet zelf', async () => {
  const kern = require('../server/kern/bureau')({ db: { data: { lifestyle: {} } }, save: () => {},
    crypto, anthropic: null, liveCodename: () => '', notify: null });
  const k = kern.bureau.kamers('leeg');
  assert.equal(k.kamers.length, 20);
  assert.equal(k.ingericht, 20);
  assert.equal(k.inAanbouw, 0);
  /* De tegenproef. Deze rekende eerst de regel NA in de toets zelf, en toen een
     mutatie de echte regel verving door de vaste tekst 'ingericht' bleef alles
     groen -- afgeslagen, en dus een bevinding (regel 2 en 9 van de lat). Nu gaat
     de regel er als FUNCTIE in, met een kamer zonder deur. */
  assert.equal(kern.bureau.kamerStatus({ apps: [] }), 'in aanbouw',
    'een wereld zonder deur hoort "in aanbouw" te heten, ook als er nu geen is');
  assert.equal(kern.bureau.kamerStatus({ apps: [{ naam: 'X', url: '/apps/rtg.html' }] }), 'ingericht');
  // en de plattegrond gebruikt diezelfde functie, niet een eigen kopie ervan
  for (const kamer of kern.bureau.KAMERS) {
    const uit = k.kamers.find(x => x.id === kamer.id);
    assert.equal(uit.status, kern.bureau.kamerStatus(kamer), kamer.naam);
  }
});

/* --------------------------------------------- wat het platform al weet ----- */
test('een leeg dossier is geen leeg kantoor: boekingen en agenda komen vanzelf mee', async () => {
  /* Dit was de grootste zwakte van dit kantoor: alle bronnen lazen wat het lid
     zelf had ingetypt, dus wie niets invulde kreeg een Control Tower die
     opgewekt "alles onder controle" meldde omdat er nul datums in stonden. Een
     boeking en een agenda-item kosten het lid geen enkele extra handeling. */
  const tok = await lidMet('lifestyle');
  const leeg = await json(await bu('graaf', {}, tok));
  assert.equal(leeg.graaf.knopen.length, 0, 'nog niets: geen dossier, geen boeking');

  // een agenda-item via de gewone agenda-app van het lid
  assert.equal((await raw('/agenda/toevoegen',
    { titel: 'Notaris', datum: overDagen(3) }, tok)).status, 200);

  const g = await json(await bu('graaf', {}, tok));
  const agenda = g.graaf.knopen.find(k => k.bron === 'Agenda');
  assert.ok(agenda, 'het agenda-item staat in de graaf zonder dat er iets is overgetypt');
  assert.equal(agenda.naam, 'Notaris');
  assert.equal(agenda.kamer, 'prive');
  assert.equal(agenda.vervalt, overDagen(3));

  // en dus ook in de Control Tower, tussen de verzekeringen en de paspoorten
  const tw = await json(await bu('tower', {}, tok));
  const week = tw.vensters.find(v => v.sleutel === 'week');
  assert.equal(week.aantal, 1);
  assert.equal(week.items[0].bron, 'Agenda');

  /* De agenda van een lid kan letterlijk alles bevatten, dus hij reikt niet
     verder dan de Rechterhand. Het concierge-bureau krijgt hem niet. */
  const bureau = await json(await bu('graaf', {}, tok));
  assert.equal(agenda.deel, 'rechterhand');
  assert.ok(bureau.graaf.knopen.length >= 1);

  // een afgevinkt item hoort er NIET meer in te staan
  const lijst = await json(await raw('/agenda/mijn-lijst', {}, tok));
  await raw('/agenda/wijzig', { id: lijst.items[0].id, gedaan: true }, tok);
  const na = await json(await bu('graaf', {}, tok));
  assert.equal(na.graaf.knopen.filter(k => k.bron === 'Agenda').length, 0);
});

test('de boekingen van EEN lid, niet die van het hele platform', async () => {
  /* db.data.boekingen is een platte lijst voor iedereen. De bron filtert op
     customerKey, en deze toets bewijst dat die filter er echt is: twee leden,
     allebei een boeking, en geen van beiden ziet die van de ander. */
  const a = await lidMet('lifestyle');
  const b = await lidMet('lifestyle');
  /* GEEN ONTSNAPPING ALS ER GEEN PARTNER IS. Hier stond eerst
     `if (!zaak) return;` -- en die regel vuurde ELKE keer, want de routes heetten
     anders dan ik dacht (/api/suppliers en /api/booking/request, niet
     /member/partners). Deze toets deed dus maandenlang niets, en dat viel pas op
     toen een mutatie die het filter op customerKey sloopte hem NIET liet zakken.
     Regel 3 en 9 van de lat in een regel code: een toets die zichzelf uitzet bij
     ontbrekende invoer, hoort te zakken. */
  const lijstA = await json(await raw('/suppliers', {}, a));
  const zaak = (lijstA.suppliers || []).find(p => (p.services || []).length);
  assert.ok(zaak, 'de seed hoort een partner met een dienst te hebben; zonder bewijst deze toets niets');
  const dienst = zaak.services[0];
  for (const tok of [a, b]) {
    const r = await raw('/booking/request', { supplierCode: zaak.code, serviceId: dienst.id,
      date: overDagen(4), time: '19:30' }, tok);
    assert.equal(r.status, 200, 'de boeking moet echt zijn aangelegd');
  }
  const ga = await json(await bu('graaf', {}, a));
  const gb = await json(await bu('graaf', {}, b));
  const boekA = ga.graaf.knopen.filter(k => k.bron === 'Boekingen');
  const boekB = gb.graaf.knopen.filter(k => k.bron === 'Boekingen');
  assert.equal(boekA.length, 1, 'precies zijn eigen boeking');
  assert.equal(boekB.length, 1);
  assert.notEqual(boekA[0].id, boekB[0].id, 'en niet dezelfde');
  assert.equal(boekA[0].kamer, 'gelegenheden');
  assert.equal(boekA[0].deel, 'kantoor', 'de partner weet hier al van; achterhouden beschermt niemand');
});

test('het dak op de platformbronnen zwijgt niet als het wordt bereikt', async () => {
  /* Een dak dat stil afkapt op een scherm dat "alles onder controle" durft te
     zeggen, is de verkeerde stilte. Rechtstreeks op de kern, want er
     tweehonderd-en-een agenda-items in duwen via HTTP is traag en bewijst
     hetzelfde. */
  const { agendaLidSleutel } = require('../server/kern/agenda');
  const agendas = { [agendaLidSleutel('k1')]: [] };
  for (let i = 0; i < 260; i++) {
    agendas[agendaLidSleutel('k1')].push({ id: 'a' + i, titel: 'Item ' + i,
      datum: new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10) });
  }
  const kern = require('../server/kern/bureau')({ db: { data: { lifestyle: {}, agendas, boekingen: [] } },
    save: () => {}, crypto, anthropic: null, liveCodename: () => '', notify: null });
  const sam = kern.bureau.graafSamenvatting('k1');
  assert.equal(sam.knopen, 200, 'het dak doet wat het belooft');
  assert.equal(sam.afgekapt.length, 1);
  assert.equal(sam.afgekapt[0].bron, 'Agenda');

  const nu = kern.bureau.nu('k1');
  assert.equal(nu.tellingen.afgekapt, 1);
  const regel = nu.regels.find(r => r.soort === 'afgekapt');
  assert.ok(regel, 'en het staat op het scherm, niet alleen in de telling');
  assert.match(regel.tekst, /eerste 200 uit Agenda/);

  // onder het dak zegt hij niets: een melding die er altijd staat, meldt niets
  const klein = { [agendaLidSleutel('k2')]: agendas[agendaLidSleutel('k1')].slice(0, 5) };
  const kern2 = require('../server/kern/bureau')({ db: { data: { lifestyle: {}, agendas: klein, boekingen: [] } },
    save: () => {}, crypto, anthropic: null, liveCodename: () => '', notify: null });
  assert.equal(kern2.bureau.nu('k2').tellingen.afgekapt, 0);
});

test('vijftigduizend boekingen op het platform kosten dit scherm geen seconde', async () => {
  /* De bron loopt db.data.boekingen door om er EEN lid uit te filteren. Dat is
     een bewering over kosten, en die hoort gemeten te worden en niet aangenomen
     (regel 10 van de lat). De grens staat ruim: gaat dit ooit over de 250 ms,
     dan is een index per lid nodig en zakt deze toets voordat een gebruiker het
     merkt. */
  const boekingen = [];
  for (let i = 0; i < 50000; i++) {
    boekingen.push({ ref: 'B' + i, customerKey: 'lid' + (i % 2000), supplierName: 'Zaak',
      service: { name: 'Dienst' }, status: 'aangevraagd',
      wanneer: new Date(Date.now() + ((i % 900) - 300) * 86400000).toISOString().slice(0, 10) + ' 12:00' });
  }
  const kern = require('../server/kern/bureau')({ db: { data: { lifestyle: {}, boekingen, agendas: {} } },
    save: () => {}, crypto, anthropic: null, liveCodename: () => '', notify: null });
  const g = kern.bureau.graaf('lid7', 'lid');
  assert.ok(g.knopen.length > 0 && g.knopen.length < 50, 'alleen zijn eigen toekomstige boekingen');

  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) kern.bureau.overzicht('lid7');
  const ms = Number(process.hrtime.bigint() - t0) / 10 / 1e6;
  assert.ok(ms < 250, 'een schermbezoek koste ' + ms.toFixed(1) + ' ms bij 50.000 boekingen');
});
