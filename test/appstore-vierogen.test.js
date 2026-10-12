/* DE VIER-OGENREGEL OP DE MENS -- wie inzendt, tekent niet af.

   Grens 2 stond op de ORGANISATIE, en dat is genoeg zolang de uitgever een
   externe partij is: die heeft geen kantoorinlog. Bij RTG's eigen uitgever is
   het niets -- daar kan dezelfde mens bouwen, inzenden en aftekenen. Wat deze
   toets vastlegt:

     1. De inzender wordt vastgelegd op de VERSIE, met een handvat en een naam.
     2. Het handvat komt nooit in een antwoord: het dient om te vergelijken, niet
        om te tonen.
     3. Dezelfde SLEUTEL tekent niet af -- dat is de harde vergelijking.
     4. Dezelfde NAAM tekent ook niet af -- de zachte, voor een gedeelde
        kantoorcode, en die is er juist voor het geval dat hierboven niet werkt.
     5. Een besluit draagt de GRAAD van de scheiding, en alleen `bewezen` (twee
        inlogs) laat door. Een getypte naam is GEEN tweede handtekening
        (besluit van de eigenaar, 11 oktober 2026): de gedeelde kantoorcode met
        een andere naam in `door` publiceert niets.
     6. Twee verschillende mensen OP NAAM komen er gewoon door; dezelfde mens
        aan beide kanten niet.

   Draai los: node --test test/appstore-vierogen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody, keurLidGoed, zaakMensOpNaam } = require('./helper');
const vierogen = require('../server/kern/appstore/vierogen');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vierogen-'));
let srv, base, sup, office, opNaam, tech, actorNaam;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>P</title></head><body><p id="n">Proef</p><script src="app.js"></script></body></html>';
const bundel = (n) => [{ pad: 'index.html', inhoud: HTML }, { pad: 'app.js', inhoud: 'var n=' + n + ';\n' }];
const manifest = (versie) => ({ sleutel: 'vierogen-proef', naam: 'Vierogen', versie,
  uitleg: 'Een proefapp om de scheiding tussen inzenden en aftekenen te toetsen.', categorie: 'leven',
  machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }] });

test('0. de toets zelf: sleutel gaat voor naam, en de graad zegt hoe hard hij is', () => {
  const zelfde = vierogen.toets({ inzender: { id: 'staff:K:9', naam: 'Sam' }, doorKey: 'staff:K:9', doorNaam: 'Iemand anders' });
  assert.equal(zelfde.mag, false);
  assert.equal(zelfde.code, 'zelfde-mens');
  assert.equal(zelfde.graad, 'bewezen', 'een gelijke sleutel is bewijs, geen vermoeden');

  const zelfdeNaam = vierogen.toets({ inzender: { id: 'a', naam: 'Sam van RTG ' }, doorKey: 'b', doorNaam: 'sam van rtg.' });
  assert.equal(zelfdeNaam.mag, false);
  assert.equal(zelfdeNaam.code, 'zelfde-naam');

  assert.equal(vierogen.toets({ inzender: { id: 'a', naam: 'Sam' }, doorKey: 'b', doorNaam: 'Ada' }).graad, 'bewezen');
  /* EEN GETYPTE NAAM TEKENT NIETS AF. De namen verschillen, maar wie tekent
     heeft geen sleutel: dat is de gedeelde kantoorcode met een woord erbij. */
  const getypt = vierogen.toets({ inzender: { id: null, naam: 'Sam' }, doorKey: null, doorNaam: 'Ada' });
  assert.equal(getypt.mag, false, 'een getypte naam telde als tweede handtekening');
  assert.equal(getypt.graad, 'opgegeven', 'de graad beschrijft wat er lag');
  assert.equal(getypt.code, 'geen-tweede-mens');
  assert.match(getypt.reden, /op naam/, 'de weigering zegt hoe het wel kan');
  const getyptMetInzender = vierogen.toets({ inzender: { id: 'staff:K:9', naam: 'Sam' }, doorKey: null, doorNaam: 'Ada' });
  assert.equal(getyptMetInzender.mag, false, 'ook met een bekende inzender is een getypte naam geen tweede mens');
  assert.equal(getyptMetInzender.code, 'geen-tweede-mens');
  const onbekend = vierogen.toets({ inzender: null, doorKey: null, doorNaam: 'Ada' });
  assert.equal(onbekend.graad, 'onbekend');
  assert.equal(onbekend.mag, false, 'zonder identiteit is niet vast te stellen dat het twee mensen zijn: dicht (AUTHORITY.md B2)');
  assert.equal(onbekend.code, 'geen-identiteit');
  assert.match(onbekend.reden, /persoonlijke inlog/, 'de weigering zegt hoe het wel kan');
  assert.equal(vierogen.toets({ inzender: { soort: 'medewerker', id: null, naam: null }, doorKey: 'user-7', doorNaam: 'Ada' }).mag, false,
    'een inzending zonder mens erachter tekent niemand af, ook niet met een bewezen sleutel aan de andere kant');
  assert.match(vierogen.toets({ inzender: { soort: 'medewerker', id: null, naam: null }, doorKey: 'user-7', doorNaam: 'Ada' }).reden,
    /INZENDING/, 'met een bekende tekenaar zegt de weigering dat de INZENDING opnieuw moet');
  assert.equal(vierogen.toets({ inzender: { id: 'staff:K:1', ids: ['user-7'] }, doorKey: 'user-7' }).code, 'zelfde-mens',
    'een tweede sleutel van dezelfde inzender telt ook');
  /* N2: twee sleutels in verschillende ruimtes die niet gelijk zijn, bewijzen
     niets -- een inzending van voor `ids` (alleen een personeelsnummer) tekent
     een kantoormens op naam niet af. */
  const oud = vierogen.toets({ inzender: { id: 'staff:K:1', naam: 'Sam' }, doorKey: 'user-42', doorNaam: 'Ada' });
  assert.equal(oud.mag, false, 'staff tegenover user werd als bewezen scheiding gelezen');
  assert.equal(oud.code, 'geen-identiteit');
  assert.notEqual(oud.graad, 'bewezen');
  assert.match(oud.reden, /INZENDING/);
  assert.equal(vierogen.toets({ inzender: { id: 'staff:K:1', ids: ['user-7'] }, doorKey: 'user-42' }).graad, 'bewezen',
    'met een sleutel in dezelfde ruimte is de scheiding wel bewezen');
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  opNaam = await kantoorAlsPersoon(base);
  assert.ok(opNaam, 'een kantoormens op naam hoort in te loggen');
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  actorNaam = chef.name;
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
  await api('/api/techniek/tenant', { org: 'O-VIER', naam: 'Vierogen Uitgeverij' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-VIER', soort: 'zaak', code: 'KIKUNOI' }, tech);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Vierogen Uitgeverij', contact: 'dev@vier.nl' }, sup);
  await api('/api/appstore/kantoor/uitgever', { org: 'O-VIER', besluit: 'toegelaten', door: 'Sam van RTG' }, opNaam);
});
test.after(() => stop(srv));

test('1. de inzender staat op de versie, met zijn naam en zonder zijn handvat', async () => {
  const inz = await api('/api/appstore/uitgever/inzenden', { manifest: manifest('1.0.0'), bestanden: bundel(1) }, sup);
  assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
  assert.equal(inz.body.versie.inzender.soort, 'medewerker');
  assert.equal(inz.body.versie.inzender.naam, actorNaam);
  /* De sleutel dient om te vergelijken en niet om te tonen: hij hoort in geen
     enkel antwoord te staan. */
  assert.ok(!('id' in inz.body.versie.inzender), 'het handvat van de inzender lekt naar buiten');
  assert.ok(!JSON.stringify(inz.body).includes('staff:KIKUNOI'), 'de sleutel staat in het antwoord');
});

test('2. dezelfde NAAM tekent niet af', async () => {
  const wachtrij = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body;
  const v = wachtrij.inzendingen.find(x => x.sleutel === 'vierogen-proef');
  await api('/api/appstore/kantoor/toegankelijk', { versieId: v.id, stand: 'in-orde', fouten: 0 }, office);
  const r = await api('/api/appstore/kantoor/besluit',
    { versieId: v.id, besluit: 'gepubliceerd', door: actorNaam }, office);
  assert.equal(r.status, 403, 'de inzender tekende zijn eigen inzending af');
  assert.equal(r.body.code, 'zelfde-naam');
  assert.match(r.body.error, /tekent hem niet af/);
});

test('3. de gedeelde code met een getypte naam publiceert NIET; een tweede mens op naam wel', async () => {
  const wachtrij = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body;
  const v = wachtrij.inzendingen.find(x => x.sleutel === 'vierogen-proef');
  /* HET LEK: een andere naam typen in `door` was genoeg om met de gedeelde
     kantoorcode een app live te zetten. */
  const getypt = await api('/api/appstore/kantoor/besluit',
    { versieId: v.id, besluit: 'gepubliceerd', door: 'Ada van RTG' }, office);
  assert.equal(getypt.status, 403, 'de gedeelde code plus een getypte naam publiceerde: ' + JSON.stringify(getypt.body));
  assert.equal(getypt.body.code, 'geen-tweede-mens');
  assert.match(getypt.body.error, /op naam/, 'de weigering zegt de weg erheen');
  const nog = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body.inzendingen.find(x => x.id === v.id);
  assert.ok(nog, 'de inzending staat nog in de wachtrij: er is niets gepubliceerd');

  /* N2: deze inzending kwam van een PIN-sessie zonder ledensleutel (alleen
     `staff:...`). Een kantoormens op naam (`user-N`) is daarmee niet te
     vergelijken -- twee ongelijke sleutels in twee ruimtes bewijzen niets. */
  const ongelijk = await api('/api/appstore/kantoor/besluit',
    { versieId: v.id, besluit: 'gepubliceerd', door: 'Ada van RTG' }, opNaam);
  assert.equal(ongelijk.status, 403, 'staff tegenover user werd als twee mensen gelezen: ' + JSON.stringify(ongelijk.body));
  assert.equal(ongelijk.body.code, 'geen-identiteit');
  assert.match(ongelijk.body.error, /INZENDING/);

  // een zaakmens OP NAAM zendt opnieuw in; die is wel te vergelijken
  const mens = await zaakMensOpNaam(base, sup, 'KIKUNOI');
  const opnieuw = await api('/api/appstore/uitgever/inzenden', { manifest: manifest('1.0.1'), bestanden: bundel(11) }, mens);
  assert.equal(opnieuw.status, 200, JSON.stringify(opnieuw.body.bevindingen || opnieuw.body.error));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: opnieuw.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  const r = await api('/api/appstore/kantoor/besluit',
    { versieId: opnieuw.body.versie.id, besluit: 'gepubliceerd', door: 'Ada van RTG' }, opNaam);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.versie.status, 'gepubliceerd');
  assert.equal(r.body.versie.besluit.scheiding.graad, 'bewezen',
    'twee inlogs: de scheiding is bewezen en niet opgegeven');
});

test('4. de wachtrij toont de inzender, zodat de mens die tekent het ZIET', async () => {
  await api('/api/appstore/uitgever/inzenden', { manifest: manifest('1.1.0'), bestanden: bundel(2) }, sup);
  const wachtrij = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body;
  const v = wachtrij.inzendingen.find(x => x.sleutel === 'vierogen-proef' && x.versie === '1.1.0');
  assert.ok(v, 'de nieuwe inzending staat in de wachtrij');
  assert.equal(v.inzender.naam, actorNaam, 'wie tekent, ziet van wie hij tekent');
});

test('5. dezelfde mens aan beide kanten publiceert NIET, ook op naam', async () => {
  /* Een mens die zowel uitgever (als PERSOON, met zijn ledensleutel) als
     kantoormedewerker op naam is (dezelfde sleutel). Twee inlogs, een mens:
     dat is geen tweede paar ogen. */
  const u = Date.now().toString(36);
  const email = 'vierogen-' + u + '@voorbeeld.test';
  const reg = await api('/api/auth/register', { name: 'Vierogen Zelf', email,
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)),
    password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'geregistreerd: ' + JSON.stringify(reg.body).slice(0, 160));
  const codenaam = (await api('/api/auth/me', {}, reg.body.token)).body.user.codename;
  await keurLidGoed(base, reg.body.token, codenaam, '1990-01-01');
  const lid = (await api('/api/auth/login', { login: email, password: 'Geheim123!', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'opnieuw ingelogd na de keuring');
  const kop = await api('/api/account/koppel', await kantoorKoppelBody(base, lid), lid);
  assert.equal(kop.status, 200, 'de kantoorrol gekoppeld: ' + JSON.stringify(kop.body).slice(0, 160));
  const zelfKantoor = (await api('/api/account/start', { rol: 'kantoor' }, lid)).body.token;
  assert.ok(zelfKantoor, 'dezelfde mens staat op naam in het kantoor');

  const aan = await api('/api/appstore/persoon/aanvraag', { naam: 'Vierogen Zelf', contact: email }, lid);
  assert.equal(aan.status, 200, 'de aanvraag als persoon: ' + JSON.stringify(aan.body));
  const org = (await api('/api/appstore/persoon', {}, lid)).body.org;
  assert.ok(org, 'een persoonlijke uitgeversplek');
  assert.equal((await api('/api/appstore/kantoor/uitgever', { org, besluit: 'toegelaten', door: 'Sam van RTG' }, opNaam)).status, 200);
  const inz = await api('/api/appstore/persoon/inzenden', { manifest: Object.assign(manifest('1.0.0'), { sleutel: 'vierogen-zelf' }),
    bestanden: bundel(3) }, lid);
  assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: inz.body.versie.id, stand: 'in-orde', fouten: 0 }, office);

  const zelf = await api('/api/appstore/kantoor/besluit',
    { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Iemand anders' }, zelfKantoor);
  assert.equal(zelf.status, 403, 'dezelfde mens tekende zijn eigen inzending af: ' + JSON.stringify(zelf.body));
  assert.equal(zelf.body.code, 'zelfde-mens');
  assert.equal(zelf.body.scheiding, 'bewezen');

  /* En de tegenproef op dezelfde inzending: een ANDERE mens op naam mag wel. */
  const ander = await api('/api/appstore/kantoor/besluit',
    { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Ada van RTG' }, opNaam);
  assert.equal(ander.status, 200, JSON.stringify(ander.body));
});

test('5b. een werkplekmedewerker met kantoorrol tekent zijn eigen inzending niet af', async () => {
  /* Een mens, twee sleutelruimtes: als medewerker draagt hij `staff:...`, in
     het kantoor op naam `user-N`. De inzending bewaart beide; een van de twee
     gelijk is dezelfde mens. */
  const u = (Date.now() + 7).toString(36);
  const email = 'werkplek-' + u + '@voorbeeld.test';
  const lid = (await api('/api/auth/register', { name: 'Werkplek Zelf', email,
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)),
    password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'geregistreerd');
  const nieuw = await api('/api/supplier/staff/add', { name: 'Werkplek Zelf', role: 'staff', func: 'Ontwikkeling' }, sup);
  assert.equal(nieuw.status, 200, JSON.stringify(nieuw.body).slice(0, 160));
  const k = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId: nieuw.body.staff.id, pin: nieuw.body.pin }, lid);
  assert.equal(k.status, 200, 'personeel gekoppeld: ' + JSON.stringify(k.body).slice(0, 160));
  const werk = (await api('/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId: nieuw.body.staff.id }, lid)).body.token;
  assert.ok(werk, 'een werksessie als medewerker');
  const kk = await api('/api/account/koppel', await kantoorKoppelBody(base, lid), lid);
  assert.equal(kk.status, 200, 'kantoorrol gekoppeld');
  const zelfKantoor = (await api('/api/account/start', { rol: 'kantoor' }, lid)).body.token;
  assert.ok(zelfKantoor, 'dezelfde mens op naam in het kantoor');

  const inz = await api('/api/appstore/uitgever/inzenden', { manifest: Object.assign(manifest('2.0.0'), { sleutel: 'vierogen-werkplek' }),
    bestanden: bundel(5) }, werk);
  assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
  const zelf = await api('/api/appstore/kantoor/besluit',
    { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Iemand anders' }, zelfKantoor);
  assert.equal(zelf.status, 403, 'een mens tekende als kantoormens zijn eigen inzending als medewerker af: ' + JSON.stringify(zelf.body));
  assert.equal(zelf.body.code, 'zelfde-mens');
  assert.ok(!JSON.stringify(inz.body).includes('user-'), 'de ledensleutel van de inzender lekt niet naar buiten');
});

test('6. de sleutel beslist en staat in het spoor, alleen voor het kantoor', async () => {
  // de gedeelde code laat geen uitgever toe, trekt niets in en draait geen controleronde
  for (const [pad, lijf] of [['/api/appstore/kantoor/uitgever', { org: 'O-VIER', besluit: 'toegelaten', door: 'Sam' }],
    ['/api/appstore/kantoor/intrekken', { sleutel: 'vierogen-proef', reden: 'toets', door: 'Sam' }],
    ['/api/appstore/kantoor/hercontrole', { door: 'Sam' }]]) {
    const r = await api(pad, lijf, office);
    assert.equal(r.status, 403, pad + ' liet de gedeelde code door: ' + JSON.stringify(r.body).slice(0, 120));
    assert.equal(r.body.watNu, 'inloggen-op-naam');
  }
  const kj = (await api('/api/appstore/kantoor/journaal', { n: 200 }, office)).body.journaal;
  const pub = kj.find(r => r.wat === 'versie-gepubliceerd' && r.over === 'vierogen-proef');
  assert.ok(pub && pub.intern && /^user-\d+$/.test(pub.intern.doorKey), 'het kantoorjournaal draagt de sleutel van wie tekende: ' + JSON.stringify(pub));
  const uj = (await api('/api/appstore/uitgever/journaal', { n: 200 }, sup)).body.lijst;
  assert.ok(uj.some(r => r.wat === 'versie-gepubliceerd'), 'de uitgever ziet het besluit');
  assert.ok(!JSON.stringify(uj).includes('user-') && !uj.some(r => 'intern' in r), 'maar nooit de sleutel van de tekenaar');
  const eigen = (await api('/api/appstore/uitgever', {}, sup)).body.apps.find(a => a.sleutel === 'vierogen-proef');
  assert.ok(eigen && eigen.live && eigen.live.besluit, 'het besluit staat op de versie');
  assert.equal(eigen.live.besluit.doorKey, undefined, 'de sleutel staat niet in publiekV');
});

test('6b. de bus krijgt de sleutel van de tekenaar nooit (N4)', () => {
  /* Het journaal geeft elke regel ook als gebeurtenis naar buiten. De sleutel
     staat intern in de regel voor het kantoor; op de bus hoort hij niet -- niet
     in de inhoud en niet als actor. Hier luistert de toets de bus zelf af. */
  const maakJournaal = require('../server/kern/appstore/journaal');
  const staat = { journaal: [], apps: { x: { sleutel: 'x', org: 'O-X' } } };
  const gehoord = [];
  const j = maakJournaal({ S: () => staat, nu: () => '2026-10-12T00:00:00Z', norm: (o) => String(o).toUpperCase(),
    bus: { publish: (kanaal, bericht) => gehoord.push(bericht) } });
  j.boek('versie-gepubliceerd', 'x', 'Ada van RTG', { versie: '1.0.0', intern: { doorKey: 'user-42' } });
  assert.equal(gehoord.length, 1, 'de regel ging de bus op');
  assert.ok(!JSON.stringify(gehoord).includes('user-42'), 'de sessiesleutel stond op de bus: ' + JSON.stringify(gehoord));
  assert.equal(staat.journaal[0].intern.doorKey, 'user-42', 'en in de kantoorregel staat hij wel');
  assert.ok(!JSON.stringify(j.journaalVan('O-X')).includes('user-42'), 'het uitgeversjournaal krijgt hem niet');
});
