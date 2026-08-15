/* Magnaat Wereld: alle functies zijn speelbaar, maar de spelbrug raakt nooit
   productie. De Future Engine stelt voor; een mens bepaalt iedere fase. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const functies = require('../server/functies');
const maak = require('../server/kern/magnaatwereld');

function wereld() {
  const db = { data: {} };
  let saves = 0;
  const { magnaatWereld } = maak({ db, save: () => { saves += 1; }, crypto, functies });
  return { db, saves: () => saves, w: magnaatWereld };
}

function voltooi(w, key, functieId, apparaat = 'computer') {
  let r = w.taakStart(key, functieId, apparaat);
  assert.equal(r.ok, true);
  const taakId = r.taak.id;
  while (r.taak.status === 'bezig') {
    r = r.taak.huidig.soort === 'software'
      ? w.taakHandeling(key, taakId, r.taak.huidig.doel)
      : w.taakAntwoord(key, taakId, 0);
    assert.equal(r.ok, true);
  }
  return r;
}

function formulierInvoer(stap) {
  return Object.fromEntries(stap.velden.map(veld => [veld.id,
    veld.type === 'vink' ? true : veld.opties ? veld.opties[0]
      : 'Volledige synthetische notitie voor dit overdraagbare RTG-dossier.'
  ]));
}

test('elke geregistreerde RTG-functie heeft een veilige computer- en PDA-opdracht', () => {
  const { w } = wereld();
  assert.equal(w.catalogus.length, functies.FUNCTIES.length);
  assert.deepEqual(new Set(w.catalogus.map(c => c.id)), new Set(functies.FUNCTIES.map(f => f.id)));
  for (const c of w.catalogus) {
    assert.deepEqual(c.apparaten, ['computer', 'pda']);
    assert.equal(c.omgeving, 'trainingskopie');
    assert.equal(c.echteActie, false);
    assert.ok(['groen', 'geel', 'rood'].includes(c.veiligheidsniveau));
  }
  const gevoelig = w.catalogus.find(c => /betaal|verific|paspoort|bank|pay/i.test(c.id + ' ' + c.naam));
  assert.ok(gevoelig, 'er is een gevoelige functie in de echte catalogus');
  assert.equal(gevoelig.veiligheidsniveau, 'rood');
});

test('een speler voltooit een echte functie als synthetische missie en verdient alleen spelstaat', () => {
  const { db, w } = wereld();
  const c = w.catalogus[0];
  let r = w.taakStart('user-42', c.id, 'pda');
  assert.equal(r.ok, true);
  assert.equal(r.taak.omgeving, 'trainingskopie');
  assert.equal(r.taak.dossier.synthetisch, true);
  assert.match(r.taak.dossier.referentie, /^MW-\d{8}-\d{4}$/);
  assert.ok(r.taak.dossier.codenaam);
  assert.ok(r.taak.dossier.stad);
  assert.equal(JSON.stringify(r.taak.dossier).includes('user-42'), false, 'de spelersleutel lekt niet in het dossier');
  const taakId = r.taak.id;
  while (r.taak.status === 'bezig') {
    r = r.taak.huidig.soort === 'software'
      ? w.taakHandeling('user-42', taakId, r.taak.huidig.doel)
      : w.taakAntwoord('user-42', taakId, 0);
    assert.equal(r.ok, true);
  }
  assert.equal(r.taak.status, 'klaar');
  assert.ok(r.speler.xp > 0);
  assert.ok(r.speler.virtueelBudget > 250000);
  assert.ok(db.data.magnaatWereld, 'alleen de Magnaat-spelstaat is aangemaakt');
  assert.equal(db.data.orders, undefined, 'de echte orderstaat is niet geraakt');
  assert.equal(db.data.pay, undefined, 'het echte betaalgrootboek is niet geraakt');
});

test('een missie controleert dat de speler het juiste echte RTG-scherm opent', () => {
  const { w } = wereld();
  const c = w.catalogus.find(x => x.id === 'betalen');
  const gestart = w.taakStart('user-software', c.id, 'computer');
  assert.equal(gestart.taak.huidig.soort, 'software');
  assert.equal(gestart.taak.huidig.doel, 'tab:betalen');
  const fout = w.taakHandeling('user-software', gestart.taak.id, 'tab:salon');
  assert.equal(fout.status, 400);
  const goed = w.taakHandeling('user-software', gestart.taak.id, 'tab:betalen');
  assert.equal(goed.ok, true);
  assert.equal(goed.taak.huidig.soort, 'keuze');
  assert.ok(goed.taak.punten >= 75);
});

test('spelers zien elkaars opdrachten niet, maar delen wel dezelfde wereldtotalen', () => {
  const { w } = wereld();
  const c = w.catalogus[0];
  const a = w.taakStart('user-a', c.id, 'computer');
  assert.ok(a.taak);
  const b = w.overzicht('user-b');
  assert.equal(b.speler.actieveTaak, null);
  assert.equal(b.wereld.online, 2);
});

test('de Future Engine maakt gededupliceerde RTG/RTF-voorstellen en zet niets live', () => {
  const { w } = wereld();
  const eerste = w.kantoorStatus();
  assert.ok(eerste.voorstellen.length >= 2, 'de catalogusgaten leveren voorstellen op');
  assert.ok(eerste.voorstellen.some(v => v.spoor === 'rtg'));
  assert.ok(eerste.voorstellen.some(v => v.spoor === 'rtf'));
  assert.ok(eerste.voorstellen.every(v => v.productie === false && v.status === 'voorstel'));
  const aantal = eerste.voorstellen.length;
  w.scan('test', true);
  assert.equal(w.kantoorStatus().voorstellen.length, aantal, 'dezelfde kans wordt niet dubbel gemaakt');
});

test('alleen expliciete menselijke fasebesluiten brengen een voorstel naar test en pilot', () => {
  const { w } = wereld();
  const v = w.kantoorStatus().voorstellen[0];
  const teVroeg = w.beslis(v.id, 'pilot', 'user-eigenaar', 'Nog niet getest');
  assert.equal(teVroeg.status, 400);
  const testfase = w.beslis(v.id, 'test', 'user-eigenaar', 'Kleine synthetische proef');
  assert.equal(testfase.voorstel.status, 'test');
  assert.equal(testfase.voorstel.productie, false);
  const pilot = w.beslis(v.id, 'pilot', 'user-eigenaar', 'Resultaten beoordeeld');
  assert.equal(pilot.voorstel.status, 'pilot');
  assert.match(pilot.waarschuwing, /productie blijft ongewijzigd/i);
});

test('terugkerende spelfrictie maakt automatisch een menselijk verbeter-voorstel', () => {
  const { w } = wereld();
  for (let i = 0; i < 3; i++) voltooi(w, 'user-frictie', 'betalen');
  const voorstel = w.kantoorStatus().voorstellen.find(v => v.sleutel === 'spel-frictie-betalen');
  assert.ok(voorstel, 'drie zwakke betaalmissies leveren een verbeter-voorstel op');
  assert.equal(voorstel.productie, false);
  assert.equal(voorstel.status, 'voorstel');
  assert.equal(voorstel.bewijs.missies, 3);
  assert.ok(voorstel.bewijs.gemiddelde < 72);
});

test('de wereld gebruikt echte plaatsnamen maar noemt de economie expliciet een spelindex', () => {
  const { w } = wereld();
  const d = w.wereld();
  assert.ok(d.steden.some(s => s.naam === 'Amsterdam'));
  assert.ok(d.steden.some(s => s.naam === 'Tokyo'));
  assert.match(d.databron, /spelindices/i);
});

test('iedere speler krijgt dagelijks drie verschillende dossiers rond hetzelfde wereldsignaal', () => {
  const { w } = wereld();
  const a = w.overzicht('user-dienst-a');
  const b = w.overzicht('user-dienst-b');
  assert.equal(a.speler.dienst.dossiers.length, 3);
  assert.equal(new Set(a.speler.dienst.dossiers.map(d => d.functieId)).size, 3);
  assert.equal(a.speler.dienst.gebeurtenis.id, a.wereld.gebeurtenis.id);
  assert.equal(b.speler.dienst.gebeurtenis.id, a.wereld.gebeurtenis.id);
  assert.equal(a.speler.dienst.dossiers[0].spelvorm, a.wereld.gebeurtenis.spelvorm);
});

test('drie dagdossiers leveren precies één dienstbonus op', () => {
  const { w } = wereld();
  const key = 'user-dienst-bonus';
  const eerste = w.overzicht(key).speler;
  const ids = eerste.dienst.dossiers.map(d => d.functieId);
  let laatste;
  for (const id of ids) laatste = voltooi(w, key, id);
  assert.equal(laatste.speler.dienst.voltooid, 3);
  assert.equal(laatste.speler.dienst.bonusOntvangen, true);
  assert.equal(laatste.speler.dienstenVoltooid, 1);
  const naBonus = laatste.speler.virtueelBudget;
  voltooi(w, key, ids[0]);
  const herhaald = w.overzicht(key).speler;
  assert.equal(herhaald.dienstenVoltooid, 1, 'vrije herhaling telt niet als een tweede dienst');
  assert.ok(herhaald.virtueelBudget > naBonus, 'de vrije missie zelf blijft wel belonen');
});

test('computer en PDA tonen de echte RTG-app in een afgeschermde spelstand', () => {
  const basis = path.join(__dirname, '..', 'public', 'apps');
  const magnaat = fs.readFileSync(path.join(basis, 'magnaat.html'), 'utf8');
  const app = fs.readFileSync(path.join(basis, 'app.html'), 'utf8');
  const kern = fs.readFileSync(path.join(basis, 'app-main', 'app-main-02.js'), 'utf8');
  const os = fs.readFileSync(path.join(basis, 'app-main', 'app-main-24a2.js'), 'utf8');
  const sandbox = fs.readFileSync(path.join(basis, 'magnaat-sandbox.js'), 'utf8');
  assert.equal((magnaat.match(/src="\/apps\/app\.html\?pas=business&amp;magnaat=1"/g) || []).length, 2);
  assert.equal((magnaat.match(/allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"/g) || []).length, 2);
  assert.match(app, /<script src="\/apps\/magnaat-sandbox\.js"><\/script>/);
  assert.match(kern, /if \(magnaatProef\) API\.enabled = false;/);
  assert.match(sandbox, /url\.pathname\.indexOf\('\/api\/'\) === 0/);
  assert.match(sandbox, /window\.RTCPeerConnection/);
  assert.match(sandbox, /Object\.defineProperty\(window, 'localStorage'/);
  assert.match(sandbox, /window\.XMLHttpRequest\.prototype\.send/);
  assert.match(sandbox, /document\.addEventListener\('submit'/);
  assert.match(magnaat, /data-ctl-open/);
  assert.match(magnaat, /openControlScreen/);
  assert.match(magnaat, /\^\\\/apps\\\/\[\^\?\#\]\+\\\.html\$/,
    'alleen lokale appschermen mogen in de veilige computer worden geopend');
  assert.match(os, /'tab:reizen'/);
  assert.match(os, /'link:passkeys'/);
});

test('de wereld toont de automatische Capability Graph naast de bestaande functiecatalogus', () => {
  const { w } = wereld();
  const d = w.overzicht('user-graph');
  assert.equal(d.capabilityGraph.cijfers.functieFlags, functies.FUNCTIES.length);
  assert.equal(d.capabilityGraph.motor.bron, 'javascript');
  assert.equal(d.capabilityGraph.motor.reden, 'uitgeschakeld');
  assert.equal(Object.hasOwn(d.capabilityGraph.motor, 'canarySleutel'), false,
    'de bestuurlijke status toont de motorstand maar nooit de instance-sleutel');
  assert.ok(d.capabilityGraph.cijfers.apps >= 150);
  assert.ok(d.capabilityGraph.cijfers.apiActies >= 1500);
  assert.ok(d.capabilityGraph.cijfers.werkprocessen >= 500);
  assert.ok(d.capabilityGraph.cijfers.controlepunten >= 2500);
  assert.ok(d.capabilityGraph.cijfers.ongedekteApiActies > 0);
  assert.equal(d.capabilityGraph.dekkingsmatrix.percentage, 100);
  assert.equal(d.capabilityGraph.dekkingsmatrix.metGaten, 0);
  assert.equal(d.capabilityGraph.dekkingsmatrix.dimensies.length, 11);
  assert.ok(d.capabilityGraph.dekkingsmatrix.dimensies.every(x => x.percentage === 100));
  assert.equal(d.capabilityGraph.automatischeWerkprocessen, d.capabilityGraph.cijfers.werkprocessen);
  assert.ok(d.capabilityGraph.kantoren.some(k => k.id === 'klantenservice'));
  assert.ok(d.capabilityGraph.volledigeWerkprocessen.some(wf => wf.id === 'service-reiswijziging' && wf.stappen === 8));
  assert.ok(d.capabilityGraph.werkprocessen.every(wf => wf.startbaar && wf.dekking.volledig),
    'iedere ontdekte codefamilie heeft een startbare volledige route');
});

test('een automatisch ontdekt werkproces opent het echte scherm en rondt het synthetische dossier af', () => {
  const { db, w } = wereld();
  const key = 'user-auto-route';
  const workflow = w.capabilityGraph().werkprocessen.find(x => x.id !== 'service-reiswijziging');
  let r = w.werkprocesStart(key, workflow.id, 'computer');
  assert.equal(r.ok, true);
  assert.equal(r.taak.stappen, 5);
  assert.equal(r.taak.huidig.schermPad, workflow.app.pad);
  assert.match(r.taak.huidig.schermPad, /^\/apps\/.*\.html$/);
  while (r.taak.status === 'bezig') {
    const stap = r.taak.huidig;
    r = stap.soort === 'software'
      ? w.taakHandeling(key, r.taak.id, stap.doel)
      : w.taakActie(key, r.taak.id, formulierInvoer(stap));
    assert.equal(r.ok, true);
  }
  assert.equal(r.taak.dossier.werklog.length, 4);
  assert.ok(r.taak.economischEffect);
  assert.equal(db.data.orders, undefined);
  assert.equal(db.data.pay, undefined);
  assert.deepEqual(Object.keys(db.data), ['magnaatWereld']);
});

test('een volledig servicedossier gebruikt drie echte RTG-schermen en vier gevalideerde werkhandelingen', () => {
  const { db, w } = wereld();
  const key = 'user-service';
  let r = w.werkprocesStart(key, 'service-reiswijziging', 'computer');
  assert.equal(r.ok, true);
  assert.equal(r.speler.kantoor.naam, 'Klantenservice');
  assert.equal(r.speler.kantoor.rol, 'Service-regisseur');
  assert.equal(r.taak.stappen, 8);
  const schermen = [];
  let formulieren = 0;
  while (r.taak.status === 'bezig') {
    const stap = r.taak.huidig;
    if (stap.soort === 'software') {
      schermen.push(stap.doel);
      r = w.taakHandeling(key, r.taak.id, stap.doel);
    } else {
      formulieren += 1;
      const invoer = {};
      for (const veld of stap.velden) {
        invoer[veld.id] = veld.type === 'vink' ? true
          : veld.opties ? veld.opties[0]
            : 'Volledige synthetische notitie voor dit overdraagbare RTG-dossier.';
      }
      r = w.taakActie(key, r.taak.id, invoer);
    }
    assert.equal(r.ok, true);
  }
  assert.deepEqual(schermen, ['link:berichten', 'tab:reizen', 'os:werk', 'link:berichten']);
  assert.equal(formulieren, 4);
  assert.equal(r.taak.dossier.werklog.length, 4);
  assert.equal(r.taak.status, 'klaar');
  assert.equal(db.data.orders, undefined);
  assert.equal(db.data.pay, undefined);
  assert.deepEqual(Object.keys(db.data), ['magnaatWereld']);
});

test('een onvolledige dossierhandeling wordt geweigerd en raakt de werklog niet', () => {
  const { w } = wereld();
  const key = 'user-service-validatie';
  let r = w.werkprocesStart(key, 'service-reiswijziging', 'pda');
  r = w.taakHandeling(key, r.taak.id, 'link:berichten');
  const fout = w.taakActie(key, r.taak.id, { samenvatting: 'te kort', urgentie: 'Vandaag', toestemming: false });
  assert.equal(fout.status, 400);
  assert.equal(r.taak.dossier.werklog.length, 0);
});

test('de bestaande RTG-wereld levert een gebalanceerde economie en missie-effecten', async () => {
  const { w } = wereld();
  const begin = w.overzicht('user-economie');
  assert.equal(begin.economie.grootboek.controle.inBalans, true);
  const missie = voltooi(w, 'user-economie', 'betalen');
  assert.ok(missie.taak.economischEffect);
  assert.equal(w.overzicht('user-economie').economie.werkvoorraad.aantal, 1);
  const dag = await w.economieVolgendeDag('user-economie', 'wereld-economie-dag-1');
  assert.equal(dag.dag, 1);
  assert.equal(dag.grootboek.controle.verschil, 0);
  assert.equal(dag.werkvoorraad.aantal, 0);
});

test('de economische cockpit en het Economenlab zijn onderdeel van de echte Magnaat-app', () => {
  const basis = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(basis, 'public/apps/magnaat.html'), 'utf8');
  const routes = fs.readFileSync(path.join(basis, 'server/routes/magnaatwereld.js'), 'utf8');
  assert.match(html, /id="economie"/);
  assert.match(html, /id="ecoStrategy"/);
  assert.match(html, /id="ecoChart"/);
  assert.match(html, /id="ecoLedger"/);
  assert.match(html, /id="ecoIncome"/);
  assert.match(html, /id="ecoBalanceSheet"/);
  assert.match(html, /id="econAnalysis"/);
  assert.match(html, /function renderEconomistLab\(e\)/);
  assert.match(html, /function renderEconomy\(\)/);
  assert.match(routes, /\/api\/member\/magnaat\/economie\/beslis/);
  assert.match(routes, /\/api\/member\/magnaat\/economie\/analyse/);
  assert.match(routes, /\/api\/member\/magnaat\/economie\/volgende-dag/);
  assert.match(routes, /\/api\/member\/magnaat\/economie\/schok/);
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
  assert.doesNotThrow(() => inline.forEach(script => new Function(script)));
});

test('een boardroom-schakelaar zet gameplay uit zonder productie te raken', () => {
  const { db, w } = wereld();
  const uit = w.boardroomControleOverzicht('user-eigenaar', { soort: 'functie', zoek: 'betalen', limiet: 100 });
  const punt = uit.punten.find(p => p.sleutel === 'betalen');
  assert.ok(punt);
  const gezet = w.boardroomControleZet('user-eigenaar', punt.id, { aan: false });
  assert.equal(gezet.punt.aan, false);
  const geblokkeerd = w.taakStart('user-geblokkeerd', 'betalen', 'computer');
  assert.equal(geblokkeerd.status, 423);
  assert.equal(db.data.pay, undefined);
  assert.equal(db.data.orders, undefined);
  assert.deepEqual(Object.keys(db.data), ['magnaatWereld']);
});

test('het Controleregister maakt bij volledige dekking geen spooktaken', () => {
  const { w } = wereld();
  const voor = w.boardroomControleOverzicht('user-eigenaar', { soort: 'werkproces', gat: 'alle', limiet: 20 });
  assert.equal(voor.dekking.percentage, 100);
  assert.equal(voor.dekking.metGaten, 0);
  assert.equal(voor.punten.length, 0);
  const plan = w.boardroomControlePlanGaten('user-eigenaar', { limiet: 8 });
  assert.equal(plan.aangemaakt, 0);
  assert.equal(plan.bekeken, 0);
  assert.deepEqual(plan.taken, []);
  const nogmaals = w.boardroomControlePlanGaten('user-eigenaar', { limiet: 8 });
  assert.equal(nogmaals.aangemaakt, 0);
});

test('medewerker en boardroom hebben beide een volledige codecontrole-interface', () => {
  const basis = path.join(__dirname, '..');
  const member = fs.readFileSync(path.join(basis, 'public/apps/magnaat.html'), 'utf8');
  const boardroom = fs.readFileSync(path.join(basis, 'public/apps/magnaat-kantoor.html'), 'utf8');
  const routes = fs.readFileSync(path.join(basis, 'server/routes/magnaatwereld.js'), 'utf8');
  for (const html of [member, boardroom]) {
    assert.match(html, /id="controlPoints"/);
    assert.match(html, /id="controlTasks"/);
    assert.match(html, /function renderControl\(\)/);
    const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
    assert.doesNotThrow(() => inline.forEach(script => new Function(script)));
  }
  assert.match(member, /id="officeRoleSelect"/);
  assert.match(member, /id="officeWorkflowSelect"/);
  assert.match(member, /function openWorkflowScreen\(\)/);
  assert.match(boardroom, /id="officeMatrix"/);
  assert.match(boardroom, /data-ctl-office/);
  assert.match(boardroom, /data-ctl-role/);
  assert.match(routes, /\/api\/member\/magnaat\/controle\/zet/);
  assert.match(routes, /\/api\/office\/magnaat\/controle\/zet/);
  assert.match(routes, /\/api\/member\/magnaat\/controle\/zelftest/);
  assert.match(routes, /\/api\/office\/magnaat\/controle\/zelftest/);
  assert.match(routes, /\/api\/office\/magnaat\/controle\/gaten\/plan/);
});
