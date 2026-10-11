/* DE HERZEGELING: een AVG-wissing legt het externe anker niet meer stil, en
   een vervalsing blijft een alarm (server/lib/ankerherzegel.js).

   De drie beweringen, elk met zijn tegenproef:
     1. een wettige wissing in het API-spoor -> de ankerronde klopt, geen
        alarm, en het nieuwe blok gaat MET de getekende herzegeling naar buiten;
     2. een herschrijving zonder herzegeling -> alarm, en geen nieuw blok;
     3. een vervalste herzegeling -- een andere sleutel, of de goede sleutel
        over ANDERE regels dan er veranderden -> alarm.
   Plus de fundering: het plan dat de ankerdienst vóór de wissing tekent, is
   byte voor byte wat wisActor daarna werkelijk doet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { maakAnkerdienst } = require('../server/lib/ankerdienst');
const { maakAnkerpost } = require('../server/lib/ankerpost');
const { plan } = require('../server/lib/ankerherzegel');
const { maakJournaal } = require('../server/kern/command/journaal');
const timer = require('../server/lib/ankertimer');
const wacht = require('../server/lib/auditwacht');
const { maakOntvanger } = require('../scripts/ankerontvanger');

const ZAAD = Buffer.alloc(32, 11);
const stil = { warn() {}, error() {} };
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herzegel-'));
/* Elke toets een eigen tweede machine: een gedeelde ontvanger zou het blok
   van de ene toets naast het journaal van de andere leggen. */
const open = [];
let ontvanger, url;
test.beforeEach(async () => {
  process.env.RTG_ANKERPOST_ONVEILIG = '1';
  ontvanger = maakOntvanger({ map: fs.mkdtempSync(path.join(map, 'o-')) });
  await new Promise((ja, nee) => ontvanger.server.listen(0, '127.0.0.2', ja).on('error', nee));
  open.push(ontvanger.server);
  url = 'http://127.0.0.2:' + ontvanger.server.address().port + '/';
});
test.after(() => { for (const s of open) s.close(); fs.rmSync(map, { recursive: true, force: true }); });

function huis({ zaad, bestemming } = {}) {
  const db = { data: { inzageLog: [], securityLog: [], handelingLog: [], livingLab: { audit: [] }, ledenBoardLog: {},
    apiSpoor: { commandJournaal: [], commandJournaalTotaal: 0 } } };
  const dienst = maakAnkerdienst({ db, sleutel: () => zaad || ZAAD, omgeving: {} });
  const spoor = maakJournaal({ db, save: () => {}, crypto, vak: () => db.data.apiSpoor });
  const post = maakAnkerpost({ ankerdienst: dienst, omgeving: { RTG_ANKERPOST_URL: bestemming || url } });
  for (let i = 0; i < 10; i++) spoor.noteer({ actor: i % 3 === 1 ? 'user-wis' : 'user-blijf', actie: 'POST /x' + i });
  return { db, dienst, spoor, post };
}
/* De wissing zoals kern/vergeten.js hem doet: eerst tekenen, dan wissen. */
function wis(h, actor) {
  const rec = h.dienst.herzegelVoor({ journaal: 'apiSpoor', actor: actor || 'user-wis', reden: 'AVG art. 17',
    door: { rol: 'lid', wie: 'de betrokkene zelf' } });
  h.spoor.wisActor(actor || 'user-wis', 'AVG art. 17');
  return rec;
}
const regels = (o) => fs.readFileSync(o.bestand, 'utf8').trim().split('\n').map(r => JSON.parse(r));

test('het getekende plan is precies wat wisActor daarna doet', () => {
  const h = huis();
  const voor = JSON.parse(JSON.stringify(h.db.data.apiSpoor));
  const p = plan(voor.commandJournaal, voor.commandJournaalTotaal, 'user-wis');
  h.spoor.wisActor('user-wis', 'x');
  const na = h.db.data.apiSpoor.commandJournaal;
  assert.equal(p.regels[0].nr, 2, 'het bereik begint bij de eerste gewiste regel');
  assert.equal(p.regels[p.regels.length - 1].nr, 10, 'en loopt tot de kop van vóór de wissing');
  for (const g of p.regels) {
    assert.equal(na[g.nr - 1].zegel, g.nieuw, 'regel ' + g.nr + ': het plan voorspelde een andere zegel');
    assert.equal(voor.commandJournaal[g.nr - 1].zegel, g.oud);
    assert.equal(g.gewist, voor.commandJournaal[g.nr - 1].actor === 'user-wis');
  }
  assert.ok(!JSON.stringify(p).includes('user-wis'), 'de gewiste sleutel staat niet in het plan');
});

test('1. een AVG-wissing: de ronde klopt, geen alarm, en de herzegeling gaat mee naar buiten', async () => {
  wacht._wis();
  const h = huis();
  assert.equal((await timer.eenRonde(h.post, stil)).ok, true, 'eerste blok weg');
  const rec = wis(h);
  assert.ok(rec && rec.handtekening, 'de wissing tekende een herzegeling');
  assert.ok(!JSON.stringify(h.db.data.ankerHerzegelingen).includes('user-wis'), 'zonder de gewiste sleutel');
  const r = await timer.eenRonde(h.post, stil);
  assert.equal(r.ok, true, 'een wettige wissing is geen vervalsing: ' + JSON.stringify(r));
  assert.equal(r.vergeleken, true);
  assert.deepEqual(r.herzegeld, [rec.id]);
  assert.equal(wacht.bevinding(), null, 'geen alarm');
  const laatste = regels(ontvanger).pop();
  assert.equal(laatste.herzegelingen && laatste.herzegelingen[0].id, rec.id, 'het waarom ligt op de tweede machine');
  /* En daarna gewoon door: het anker staat niet stil. */
  h.spoor.noteer({ actor: 'user-blijf', actie: 'POST /daarna' });
  assert.equal((await timer.eenRonde(h.post, stil)).ok, true);
});

test('1b. twee wissingen tussen twee ankers, en een wissing terwijl de tweede machine plat lag', async () => {
  wacht._wis();
  const plat = huis({ bestemming: 'http://127.0.0.2:1/' });
  const h = huis();
  const buiten = h.dienst.blok();
  const a = wis(h, 'user-wis');
  h.spoor.noteer({ actor: 'user-blijf', actie: 'POST /tussen' });
  const b = wis(h, 'user-blijf');
  const uit = h.dienst.reken(buiten);
  assert.equal(uit.ok, true, JSON.stringify(uit.perJournaal.apiSpoor));
  assert.deepEqual(uit.perJournaal.apiSpoor.wissingen, [a.id, b.id]);
  /* Plat tijdens de wissing: de ronde zegt dat, en er is niets kwijt -- de
     getekende herzegeling ligt hier en verklaart de herschrijving later. */
  const vooraf = plat.dienst.blok();
  wis(plat);
  const r = await timer.eenRonde(plat.post, stil);
  assert.equal(r.ok, false); assert.equal(r.vergeleken, false);
  assert.equal(plat.dienst.reken(vooraf).ok, true, 'de opgeslagen herzegeling verklaart het alsnog');
});

test('2. een herschrijving ZONDER herzegeling blijft een alarm, en er gaat geen nieuw blok weg', async () => {
  wacht._wis();
  const h = huis();
  await timer.eenRonde(h.post, stil);
  const aantal = regels(ontvanger).length;
  /* De wissing zonder het getekende plan: precies wat er vóór deze reparatie gebeurde. */
  h.spoor.wisActor('user-wis', 'zonder bewijs');
  const r = await timer.eenRonde(h.post, stil);
  assert.equal(r.ok, false); assert.equal(r.afwijking, true);
  assert.match(wacht.bevinding() || '', /anker/);
  assert.equal(regels(ontvanger).length, aantal, 'geen nieuw blok over een onverklaarde herschrijving');
  assert.match(h.dienst.reken(regels(ontvanger).pop().blok).perJournaal.apiSpoor.herzegeling, /geen herzegeling/);
});

test('3a. een herzegeling met een ANDERE sleutel verklaart niets', () => {
  const h = huis();
  const buiten = h.dienst.blok();
  /* Dezelfde database, een vreemde sleutel: het record ziet er perfect uit. */
  const vreemd = maakAnkerdienst({ db: h.db, sleutel: () => Buffer.alloc(32, 99), omgeving: {} });
  vreemd.herzegelVoor({ journaal: 'apiSpoor', actor: 'user-wis', door: { rol: 'lid', wie: 'x' } });
  h.spoor.wisActor('user-wis', 'x');
  const uit = h.dienst.reken(buiten);
  assert.equal(uit.ok, false);
  assert.match(uit.perJournaal.apiSpoor.herzegeling, /geen enkele is door deze installatie getekend/);
  /* En een met de hand bijgestelde echte herzegeling breekt zijn handtekening. */
  const h2 = huis();
  const b2 = h2.dienst.blok();
  const rec = wis(h2);
  rec.regels[0].gewist = false;
  assert.equal(h2.dienst.reken(b2).ok, false);
});

test('3b. de GOEDE sleutel over ANDERE regels dan er veranderden: alarm', () => {
  const h = huis();
  const buiten = h.dienst.blok();
  const voor = JSON.parse(JSON.stringify(h.db.data.apiSpoor));
  wis(h);
  /* Bovenop de wissing stelt iemand regel 6 (actor bleef) bij en zegelt de
     keten opnieuw. Elke hash klopt weer, en hij laat met de echte sleutel een
     record tekenen dat alleen de gewiste regels als veranderd opgeeft. */
  const rij = h.db.data.apiSpoor.commandJournaal;
  rij[5].actie = 'POST /nooit-gebeurd';
  const hash = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 32);
  let vorig = rij[0].vorig;
  for (const r of rij) { r.vorig = vorig; const { zegel, ...z } = r; r.zegel = hash(z); vorig = r.zegel; }
  assert.equal(h.spoor.controleer().heel, true, 'lokaal klopt alles');
  const p = plan(voor.commandJournaal, voor.commandJournaalTotaal, 'user-wis');
  for (const g of p.regels) g.nieuw = rij[g.nr - 1].zegel;   // klopt met de vervalste stand
  h.db.data.ankerHerzegelingen.length = 0;
  const tweeling = maakAnkerdienst({ db: { data: { apiSpoor: { commandJournaal: voor.commandJournaal, commandJournaalTotaal: voor.commandJournaalTotaal } } },
    sleutel: () => ZAAD, omgeving: {} });
  const echt = tweeling.herzegelVoor({ journaal: 'apiSpoor', actor: 'user-wis', door: null });
  /* Hetzelfde record maar met de nieuwe zegels van de vervalsing, opnieuw
     getekend met de goede sleutel -- een ondertekenaar die meer tekent dan er
     gebeurde. */
  const { handtekening, ...kaal } = echt; kaal.regels = p.regels;
  const herzegel = require('../server/lib/ankerherzegel');
  const { kanoniek } = require('../server/lib/ankerzegel');
  const prive = require('../server/lib/ankerzegel').sleutelpaar(ZAAD);
  h.db.data.ankerHerzegelingen.push(Object.assign({}, kaal, { handtekening: Object.assign({}, handtekening,
    { waarde: crypto.sign(null, herzegel.teTekenen(kaal, kanoniek), prive.prive).toString('base64') }) }));
  assert.equal(h.dienst.herzegelingGeldig(h.db.data.ankerHerzegelingen[0]), true, 'de handtekening zelf is echt');
  const uit = h.dienst.reken(buiten);
  assert.equal(uit.ok, false, 'een record dat andere regels noemt dan er veranderden, verklaart niets');
  assert.match(uit.perJournaal.apiSpoor.herzegeling, /regel 6 is méér veranderd dan zijn keten/);
});

test('de ontvanger: dezelfde kop met een andere hash alleen met een geldige herzegeling', () => {
  const o = maakOntvanger({ map: fs.mkdtempSync(path.join(map, 'los-')) });
  const h = huis();
  assert.equal(o.neemAan({ blok: h.dienst.blok() }).status, 200);
  const rec = wis(h);
  /* Zonder de regel "wissing in het spoor" staat de kop op hetzelfde nummer met
     een nieuwe zegel: precies wat de ontvanger een teruggang noemt. */
  h.db.data.apiSpoor.commandJournaal.pop(); h.db.data.apiSpoor.commandJournaalTotaal--;
  const blok = h.dienst.blok();
  assert.equal(o.neemAan({ blok }).status, 409, 'zonder herzegeling: geweigerd');
  const vreemd = maakAnkerdienst({ db: { data: { apiSpoor: { commandJournaal: [], commandJournaalTotaal: 0 } } },
    sleutel: () => Buffer.alloc(32, 98), omgeving: {} });
  const valsRec = Object.assign({}, rec, { handtekening: Object.assign({}, rec.handtekening,
    { waarde: crypto.sign(null, Buffer.from('x'), require('../server/lib/ankerzegel').sleutelpaar(Buffer.alloc(32, 98)).prive).toString('base64') }) });
  assert.ok(vreemd);
  assert.equal(o.neemAan({ blok, herzegelingen: [valsRec] }).status, 409, 'een ongeldige handtekening: geweigerd');
  assert.equal(o.neemAan({ blok, herzegelingen: [rec] }).status, 200, 'met de getekende herzegeling: aangenomen');
  assert.equal(o.laatste().herzegelingen[0].id, rec.id, 'en het waarom wordt mee bewaard');
});

/* ---- vervalsingen bovenop of tussen echte wissingen ---------------------- */
const zegelVan = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 32);
function herketen(rij) {
  let vorig = rij[0].vorig;
  for (const r of rij) { r.vorig = vorig; const { zegel, ...z } = r; r.zegel = zegelVan(z); vorig = r.zegel; }
}
/* Een record opnieuw tekenen met de ECHTE sleutel: de zwaarste aanvaller, die
   de ondertekenaar meer laat tekenen dan er gebeurde. */
function tekenMetEchteSleutel(kaal) {
  const herzegel = require('../server/lib/ankerherzegel');
  const zegel = require('../server/lib/ankerzegel');
  const p = zegel.sleutelpaar(ZAAD);
  return Object.assign({}, kaal, { handtekening: { alg: 'ed25519', sleutelId: p.sleutelId, publiek: p.publiekB64,
    waarde: crypto.sign(null, herzegel.teTekenen(kaal, zegel.kanoniek), p.prive).toString('base64') } });
}

test('3c. na het anker een gewiste regel bijgesteld en de keten opnieuw gezegeld: alarm', () => {
  const h = huis();
  const buiten = h.dienst.blok();                                       // anker op regel 10
  h.spoor.noteer({ actor: 'user-wis', actie: 'POST /na-het-anker' });   // regel 11
  h.spoor.noteer({ actor: 'user-blijf', actie: 'POST /erna' });         // regel 12
  wis(h);
  const rij = h.db.data.apiSpoor.commandJournaal;
  rij[10].actie = 'POST /iets-anders';                                  // regel 11, al "gewist"
  herketen(rij);
  assert.equal(h.spoor.controleer().heel, true);
  const uit = h.dienst.reken(buiten);
  assert.equal(uit.ok, false, 'een gewiste regel mag zijn actor verliezen en verder niets');
  assert.match(uit.perJournaal.apiSpoor.herzegeling, /regel 11 heeft niet de zegel/);
});

test('3d. een herzegeling kan alleen WISSEN, niet een handeling op een andere naam zetten', () => {
  const h = huis();
  const buiten = h.dienst.blok();
  const voor = JSON.parse(JSON.stringify(h.db.data.apiSpoor.commandJournaal));
  const rij = h.db.data.apiSpoor.commandJournaal;
  rij[2].actor = 'user-zondebok';                                       // regel 3, was user-blijf
  herketen(rij);
  const regels = rij.slice(2).map((r, i) => ({ nr: 3 + i, oud: voor[2 + i].zegel, nieuw: r.zegel, gewist: i === 0 }));
  h.db.data.ankerHerzegelingen = [tekenMetEchteSleutel({ soort: 'herzegeling', versie: 1, id: 'vals', journaal: 'apiSpoor',
    at: new Date().toISOString(), door: null, reden: '', vorigAnker: null, kopVoor: null, regels })];
  const uit = h.dienst.reken(buiten);
  assert.equal(uit.ok, false);
  assert.match(uit.perJournaal.apiSpoor.herzegeling, /regel 3 staat als gewist maar draagt een actor/);
});

test('3e. een vervalsing TUSSEN twee wissingen wordt niet door de tweede witgewassen', () => {
  const h = huis();
  const buiten = h.dienst.blok();
  wis(h, 'user-wis');                                                   // echt, getekend
  const rij = h.db.data.apiSpoor.commandJournaal;
  rij[2].actie = 'POST /nooit-gebeurd';                                 // regel 3, user-blijf
  herketen(rij);
  wis(h, 'user-blijf');                                                 // ook getekend -- maar over de vervalste stand
  const uit = h.dienst.reken(buiten);
  assert.equal(uit.ok, false, 'de tweede herzegeling sluit niet aan op de eerste');
  assert.match(uit.perJournaal.apiSpoor.herzegeling, /komen niet uit bij de zegel die er nu staat/);
});
