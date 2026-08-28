/* HET INKOOPDOSSIER, DE TIJDLIJN EN DE CONTROLERONDE -- de enterprise-kant.

   Wat deze toets vastlegt, en waarom elk punt er staat:

     1. Elke bewering in het dossier draagt een BRON. Een leverancierspak met
        beweringen zonder bron is een ingevulde vragenlijst, en die is niets
        waard omdat niemand hem kan nakijken.
     2. Het dossier zegt ook wat het NIET kan zeggen. Dat is niet de restpost
        maar het deel dat de rest geloofwaardig maakt.
     3. De sterkste claim is een NEGATIEVE -- de leverancier heeft geen kopie,
        want de app heeft geen netwerk -- en die wordt hier tegen de echte
        CSP-kop gehouden. Een claim die alleen in een document staat, is precies
        wat dit dossier niet wil zijn.
     4. De tijdlijn schrijft bij elk toestemmingsmoment mee, groeit aan en wordt
        nooit herschreven -- ook niet als het lid de app verwijdert. Juist dan
        niet: dan is hij het bewijs.
     5. Dat er is GEWIST komt erin; wat er stond niet.
     6. Een lid ziet alleen zijn eigen tijdlijn.
     7. De controleronde haalt een app eruit waarvan de bytes niet meer kloppen
        met wat een mens heeft afgetekend. Daar valt niets af te wegen.

   Draai los: node --experimental-sqlite --test test/appstore-dossier.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-dossier-'));
let srv, base, lid, lid2, sup, office, tech, hash;
const ORG = 'O-DOSSIER';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>D</title></head>' +
  '<body><p id="u">hoi</p><script src="app.js"></script></body></html>';
const bundel = (extra) => [{ pad: 'index.html', inhoud: HTML },
  { pad: 'app.js', inhoud: 'document.getElementById("u").textContent = "draait";' }].concat(extra || []);
const manifest = (over) => {
  const m = Object.assign({
    sleutel: 'dossier-app', naam: 'Dossierapp', versie: '1.0.0',
    uitleg: 'Een app van een derde, om het inkoopdossier en de controleronde te tonen.',
    categorie: 'leven', machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }] }, over || {});
  delete m._extra;
  return m;
};
async function publiceer(over) {
  const r = await api('/api/appstore/uitgever/inzenden', { manifest: manifest(over), bestanden: bundel(over && over._extra) }, sup);
  assert.equal(r.status, 200, JSON.stringify(r.body.fouten || r.body.bevindingen || r.body.error || ''));
  /* De toegankelijkheidspoort staat sinds 27 augustus 2026 aan: publiceren kan
     niet zonder een geslaagde keuring op DEZE bundelhash. De keurloper doet dat
     in het echt (scripts/appstore-a11y.js); hier zetten we de uitslag zelf neer,
     want deze toetsen gaan over de winkel en niet over de keuring. */
  await api('/api/appstore/kantoor/toegankelijk',
    { versieId: r.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  const b = await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  return r.body.versie;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Dossier Lid', email: 'dos@x.nl', phone: '0612345673',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  lid2 = (await api('/api/auth/register', { name: 'Ander Lid', email: 'ander@x.nl', phone: '0612345672',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
  assert.ok(lid && lid2 && office && tech && sup);
  await api('/api/techniek/tenant', { org: ORG, naam: 'Dossier Uitgeverij' }, tech);
  await api('/api/techniek/tenant/bind', { org: ORG, soort: 'zaak', code: 'KIKUNOI' }, tech);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Dossier Uitgeverij', contact: 'dev@dossier.nl' }, sup);
  await api('/api/appstore/kantoor/uitgever', { org: ORG, besluit: 'toegelaten', door: 'Sam van RTG' }, office);
  hash = (await publiceer()).hash;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. elke bewering in het dossier draagt een bron', async () => {
  const d = (await api('/api/appstore/dossier', { sleutel: 'dossier-app' }, lid)).body;
  assert.equal(d.ok, true);
  const blokken = ['leverancier', 'watErDraait', 'watHetMag', 'watHetNooitKrijgt', 'waarDeGegevensBlijven', 'watDePoortVond', 'uitgang'];
  let n = 0;
  for (const b of blokken) {
    assert.ok(d[b], 'blok ' + b + ' staat in het dossier');
    assert.ok(Array.isArray(d[b].bewijs) && d[b].bewijs.length, b + ' draagt bewijs');
    for (const bw of d[b].bewijs) {
      n++;
      for (const veld of ['claim', 'hoe', 'bron']) {
        assert.ok(bw[veld] && String(bw[veld]).length > 5, b + ': een bewijsregel draagt "' + veld + '" (' + JSON.stringify(bw) + ')');
      }
      assert.ok(/\.(js|html)|toets/.test(bw.bron), 'de bron wijst een bestand of een toets aan, geen afdeling: ' + bw.bron);
      /* EN DAT BESTAND BESTAAT ECHT, MET DIE NAAM ERIN. Deze regel staat er
         omdat het al is misgegaan: een bron wees naar
         kern/appstore/winkel.js (magCel) terwijl magCel bij een opsplitsing naar
         uitgifte.js was verhuisd. Een dossier waarvan de verwijzingen niet meer
         kloppen, is de vragenlijst die het niet wil zijn (LAT-regel 6).

         WAT HIJ WEL EN NIET PAKT, want dat is gemeten en niet gehoopt. Wel: een
         bestand dat er niet (meer) is, en een naam die in dat bestand nergens
         voorkomt. NIET: precies de verhuizing hierboven -- winkel.js noemt
         magCel nog steeds, want hij haalt hem uit uitgifte.js en geeft hem door.
         Dat verschil hoort een mens te zien bij het opsplitsen; deze toets vangt
         alleen de bron die nergens meer op slaat. Wie hem sterker maakt, moet
         de DEFINITIE zoeken en niet de naam. */
      const pad = String(bw.bron).replace(/\s*\(.*$/, '').replace(/^kern\//, 'server/kern/').replace(/^routes\//, 'server/routes/');
      if (/\.(js|html)$/.test(pad)) {
        const vol = path.join(__dirname, '..', pad);
        assert.ok(fs.existsSync(vol), 'de bron wijst naar een bestand dat er ook is: ' + bw.bron + ' -> ' + pad);
        const noemt = /\(([A-Za-z_$][\w$]*)\)\s*$/.exec(bw.bron);
        if (noemt) {
          assert.ok(fs.readFileSync(vol, 'utf8').includes(noemt[1]),
            'en die naam staat er ook echt in -- anders is hij verhuisd zonder dat het dossier meeging: ' + bw.bron);
        }
      }
    }
  }
  assert.ok(n >= 12, 'en het zijn er genoeg om iets te betekenen: ' + n);
  assert.equal(d.leverancier.toegelatenDoor, 'Sam van RTG', 'wie de leverancier toeliet, staat erin');
  assert.equal(d.watDePoortVond.afgetekendDoor, 'Sam van RTG');
});

test('2. het dossier zegt ook wat het NIET kan zeggen', async () => {
  const d = (await api('/api/appstore/dossier', { sleutel: 'dossier-app' }, lid)).body;
  const niet = Object.keys(d.nietGebouwd || {});
  assert.ok(niet.length >= 4, 'een pak dat overal ja zegt is niets waard: ' + niet.join(', '));
  for (const k of niet) assert.ok(d.nietGebouwd[k].length > 40, '"' + k + '" draagt een reden en niet alleen een nee');
  assert.ok(niet.some(k => /beschikbaarheid/i.test(k)), 'juist de uptime van een derde hoort hier: die bestaat niet, want er is geen server van een derde');
});

test('3. de sterkste claim is negatief, en hij klopt tegen de echte kop', async () => {
  const d = (await api('/api/appstore/dossier', { sleutel: 'dossier-app' }, lid)).body;
  assert.match(d.waarDeGegevensBlijven.antwoord, /geen kopie/);
  const bron = d.waarDeGegevensBlijven.bewijs.find(b => /connect-src/.test(b.hoe));
  assert.ok(bron, 'de claim wijst naar de CSP en niet naar een belofte');

  /* En dan de claim zelf nakijken. Een dossier dat zegt "de app heeft geen
     netwerk" terwijl de kop iets anders zegt, is precies de vragenlijst die dit
     niet moet worden. */
  const r = await fetch(base + '/appcel/dossier-app/' + hash + '/index.html');
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /connect-src 'none'/, 'de bewering staat ook echt in de kop van elke celrespons');
  assert.match(csp, /sandbox allow-scripts/);

  const kanaal = (await api('/api/appstore/kanaal', {}, lid)).body;
  assert.ok(kanaal.nietGebouwd.betalen, 'en wat GEEN enkele app kan vragen, is voor het hele kanaal na te lezen');
});

test('4. de tijdlijn schrijft bij elk toestemmingsmoment mee', async () => {
  await api('/api/appstore/installeer', { sleutel: 'dossier-app', machtigingen: ['opslag.eigen'] }, lid);
  await api('/api/appstore/verleen', { sleutel: 'dossier-app', machtigingen: [] }, lid);
  const t = (await api('/api/appstore/tijdlijn', {}, lid)).body;
  const soorten = t.tijdlijn.map(x => x.soort);
  assert.deepEqual(soorten, ['teruggenomen', 'geinstalleerd'], 'nieuwste eerst, en allebei genoteerd');
  assert.deepEqual(t.tijdlijn[1].gaf, ['opslag.eigen'], 'wat het lid GAF staat erbij, want daar gaat de vraag later over');
  assert.deepEqual(t.tijdlijn[0].weg, ['opslag.eigen'], 'en wat hij terugnam ook');
  assert.ok(t.soorten.geinstalleerd, 'de soorten zijn een gesloten lijst met uitleg');
});

test('5. een verwijderde app blijft in de tijdlijn staan; wissen komt erin, de inhoud niet', async () => {
  await api('/api/appstore/verleen', { sleutel: 'dossier-app', machtigingen: ['opslag.eigen'] }, lid);
  await api('/api/appstore/brug', { sleutel: 'dossier-app', methode: 'opslag.zet', args: { sleutel: 'geheim', waarde: 'zeer vertrouwelijk' } }, lid);
  await api('/api/appstore/wis-opslag', { sleutel: 'dossier-app' }, lid);
  const w = await api('/api/appstore/weg', { sleutel: 'dossier-app' }, lid);
  assert.match(w.body.let, /jouw inhoud/, 'het lid leest wat er WEL en NIET is weggegooid');

  const t = (await api('/api/appstore/tijdlijn', { sleutel: 'dossier-app' }, lid)).body.tijdlijn;
  assert.equal(t[0].soort, 'verwijderd');
  assert.ok(t.some(x => x.soort === 'gewist'), 'dat er is gewist, staat erin');
  assert.ok(t.some(x => x.soort === 'geinstalleerd'), 'en de installatie van eerder staat er nog: de tijdlijn wordt nooit herschreven');
  const plat = JSON.stringify(t);
  assert.ok(!plat.includes('zeer vertrouwelijk'), 'maar WAT er stond niet -- alleen dat het weg is');
  assert.ok(!plat.includes('geheim'), 'ook de sleutels niet');
});

test('6. een lid ziet alleen zijn eigen tijdlijn', async () => {
  const leeg = (await api('/api/appstore/tijdlijn', {}, lid2)).body;
  assert.deepEqual(leeg.tijdlijn, [], 'een ander lid heeft niets gedaan en ziet dus niets');
  /* En hij kan er ook niet om vragen: de sleutel komt uit de sessie. Wat er in
     de body staat, verandert er niets aan.

     LET OP WELKE SLEUTEL HIER MEEGAAT. Hier stond eerst een verzonnen 'user-1',
     en daarmee bewees deze toets niets: hij bleef ook groen toen de route de
     sleutel WEL uit de body ging halen, want 'user-1' bestaat niet. De echte
     sleutel van het eerste lid komt daarom uit de opgeslagen tijdlijn zelf --
     precies wat een aanvaller zou moeten raden, hier gewoon gegeven. Zakt de
     regel eronder weg, dan leest het ene lid het andere. */
  const kv = new (require('node:sqlite').DatabaseSync)(path.join(TMP, 'store.db'), { readOnly: true });
  const rij = kv.prepare("SELECT val FROM kv WHERE key = 'appstore'").get();
  kv.close();
  const echteSleutel = Object.keys((JSON.parse(rij.val) || {}).tijdlijn || {})[0];
  assert.ok(echteSleutel, 'het eerste lid heeft een tijdlijn, anders meet deze toets niets');
  const poging = (await api('/api/appstore/tijdlijn', { key: echteSleutel, sleutel: 'dossier-app' }, lid2)).body;
  assert.deepEqual(poging.tijdlijn, [], 'ook mét de juiste sleutel in de body: de sessie beslist');
  assert.equal((await api('/api/appstore/tijdlijn', {})).status, 401);
});

test('7. de controleronde haalt eruit wat niet meer klopt met wat is afgetekend', async () => {
  const eerst = await api('/api/appstore/kantoor/hercontrole', { door: 'Sam van RTG' }, office);
  assert.equal(eerst.status, 200);
  assert.equal(eerst.body.gekeurd, 1);
  assert.equal(eerst.body.inOrde, 1);
  assert.deepEqual(eerst.body.uitgezet, []);
  assert.match(eerst.body.let, /byte voor byte/);

  // nu de bytes op schijf veranderen zonder dat er iets is ingezonden
  const vol = path.join(TMP, 'appstore', 'dossier-app', hash, 'app.js');
  fs.writeFileSync(vol, 'window.location = "https://elders.example";');

  const na = await api('/api/appstore/kantoor/hercontrole', { door: 'Sam van RTG' }, office);
  assert.equal(na.body.uitgezet.length, 1, 'een aangetaste bundel gaat eruit, en dat is geen afweging');
  assert.equal(na.body.uitgezet[0].sleutel, 'dossier-app');
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.totaal, 0, 'weg uit de winkel');
  assert.equal((await fetch(base + '/appcel/dossier-app/' + hash + '/index.html')).status, 404, 'en de cel is dicht');
  assert.equal((await api('/api/appstore/dossier', { sleutel: 'dossier-app' }, lid)).status, 409,
    'van een app die niet live staat, is geen dossier te maken');

  const j = (await api('/api/appstore/kantoor/journaal', {}, office)).body.journaal;
  assert.ok(j.some(x => x.wat === 'hercontrole' && x.wie === 'Sam van RTG'), 'de ronde staat in het journaal');
});

/* ---------------------------------------------------------------------------
   DE TWEEDE LEZER. Het dossier in de Mall is voor wie KIEST; deze drie punten
   gaan over wie ernaartoe wordt gestuurd -- een inkoper, een security officer --
   en over de uitgever, die hoort te weten waarop hij wordt afgerekend. */

test('8. het kanaaldossier gaat over het platform en niet over een leverancier', async () => {
  const k = (await api('/api/appstore/kanaal', {}, lid)).body;
  /* Dit is de vraag die een inkoper echt stelt: "kan zo'n app ooit bij onze
     betaalgegevens?" Dat is geen vraag per app maar per platform, en het
     antwoord hoort een keer gelezen te worden in plaats van twintig keer. */
  assert.ok(Object.keys(k.nietGebouwd || {}).length >= 3, 'wat GEEN enkele app kan vragen, staat er');
  for (const kk of Object.keys(k.nietGebouwd)) {
    assert.ok(k.nietGebouwd[kk].length > 30, '"' + kk + '" draagt een reden en niet alleen een nee');
  }
  assert.ok(k.machtigingen.length, 'en wat er wel te vragen valt ook');
  for (const m of k.machtigingen) {
    assert.ok(m.geeft && m.nooit, m.id + ' zegt wat hij geeft EN wat hij nooit geeft');
  }
  /* En het kanaaldossier hangt van geen enkele app af -- dat is precies waarom
     het apart bestaat. Zakt deze regel, dan is het een tweede app-dossier
     geworden en kan een inkoper het niet meer een keer lezen. */
  const plat = JSON.stringify(k);
  assert.ok(!plat.includes('dossier-app'), 'er staat geen enkele app in');
  assert.ok(!plat.includes('Dossier Uitgeverij'), 'en geen enkele leverancier');
});

test('9. een uitgever leest wat de klant leest -- en alleen over zijn eigen app', async () => {
  /* Een EIGEN app, want toets 7 heeft de eerste er zojuist uitgehaald. Dat is
     geen omweg maar precies goed: van een app die niet live staat, bestaat er
     ook voor de uitgever geen dossier. */
  await publiceer({ sleutel: 'dossier-app-2', naam: 'Dossierapp twee' });
  const eigen = await api('/api/appstore/uitgever/dossier', { sleutel: 'dossier-app-2' }, sup);
  assert.equal(eigen.status, 200, JSON.stringify(eigen.body));
  assert.equal(eigen.body.waarDeGegevensBlijven.antwoord,
    (await api('/api/appstore/dossier', { sleutel: 'dossier-app-2' }, lid)).body.waarDeGegevensBlijven.antwoord,
    'woord voor woord hetzelfde als wat het lid leest; twee versies van een dossier is er een te veel');
  assert.equal((await api('/api/appstore/uitgever/dossier', { sleutel: 'dossier-app' }, sup)).status, 409,
    'en van een app die eruit is gehaald, bestaat ook voor de uitgever geen dossier');
  assert.ok(eigen.body.kanaal, 'met het kanaaldossier erbij, want daar wordt hij ook op afgerekend');
  assert.match(eigen.body.let, /van je concurrent/, 'en hij leest dat het NIET-blok bij elke app hetzelfde is');

  /* De poort staat bij de ROUTE en niet in de kern: welke app van wie is, is een
     vraag van de poort. Een app die niet van deze uitgever is, bestaat hier
     niet -- en dat is een 404 en geen 403, want anders is het bestaan van een
     app van een ander al informatie. */
  assert.equal((await api('/api/appstore/uitgever/dossier', { sleutel: 'bestaat-niet' }, sup)).status, 404);
  assert.equal((await api('/api/appstore/uitgever/dossier', { sleutel: 'dossier-app-2' })).status, 401,
    'en zonder inlog helemaal niets');

  /* EN NU DE ECHTE PROEF: een app van een ANDERE uitgever, die wel bestaat en
     wel live staat. Zonder die app bewees dit niets -- "bestaat-niet" geeft ook
     404 als de org-controle eruit valt, en een app die niet live staat geeft
     409 om een heel andere reden. Hier is de enige reden voor een 404 dat hij
     van iemand anders is. */
  const ORG2 = 'O-DOSSIER-2';
  const roster2 = (await api('/api/supplier/roster', { code: 'SAKURA' })).body;
  const chef2 = (roster2.staff || []).find(x => x.role === 'manager');
  const sup2 = (await api('/api/supplier/login', { code: 'SAKURA', staffId: chef2.id, pin: '1234' })).body.token;
  await api('/api/techniek/tenant', { org: ORG2, naam: 'Andere Uitgeverij' }, tech);
  await api('/api/techniek/tenant/bind', { org: ORG2, soort: 'zaak', code: 'SAKURA' }, tech);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Andere Uitgeverij', contact: 'dev@ander.nl' }, sup2);
  await api('/api/appstore/kantoor/uitgever', { org: ORG2, besluit: 'toegelaten', door: 'Sam van RTG' }, office);
  const ander = await api('/api/appstore/uitgever/inzenden',
    { manifest: manifest({ sleutel: 'andermans-app', naam: 'Andermans app' }), bestanden: bundel() }, sup2);
  assert.equal(ander.status, 200, JSON.stringify(ander.body.fouten || ander.body.bevindingen || ander.body.error || ''));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: ander.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  await api('/api/appstore/kantoor/besluit', { versieId: ander.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);

  assert.equal((await api('/api/appstore/uitgever/dossier', { sleutel: 'andermans-app' }, sup2)).status, 200,
    'de eigenaar leest hem wel');
  assert.equal((await api('/api/appstore/uitgever/dossier', { sleutel: 'andermans-app' }, sup)).status, 404,
    'en een andere uitgever niet -- een 404 en geen 403, want het bestaan van andermans app is zelf al informatie');
  /* Als LID mag hij er gewoon bij: het dossier is openbaar binnen dit huis. Dat
     verschil is het punt van de poort -- hij zit op de UITGEVERSingang. */
  assert.equal((await api('/api/appstore/dossier', { sleutel: 'andermans-app' }, lid)).status, 200);
});
