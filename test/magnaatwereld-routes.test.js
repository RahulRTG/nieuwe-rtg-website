/* ============================================================================
   MAGNAAT WERELD OVER DE LEDENDEUR.

   test/magnaatwereld.test.js en de magnaat-*-toetsen draaien de kern in het
   proces met een verzonnen spelerssleutel. De twaalf ledendeuren daarvoor riep
   niemand aan: overzicht, taak/start|antwoord|handeling|actie, kantoor/kies,
   werkproces/start, economie/volgende-dag|schok en controle/zet|taak/maak|
   zelftest. Over de route komt de speler uit de SESSIE, en wat hier moet kloppen:

     - een missie loopt over HTTP van begin tot klaar en raakt alleen spelstaat;
     - een werkdossier weigert een onvolledige handeling (400) en accepteert een
       volledige;
     - een kantoor kiezen kan alleen met een rol die bij dat kantoor hoort;
     - de controlekamer: een medewerker ziet zijn eigen kantoor en schakelt niets
       (403), een coordinator wel binnen het eigen kantoor, en een zelftest
       draait alleen op een punt dat aan staat (423);
     - gasten spelen niet mee.

   MUTATIE GEZIEN ZAKKEN: in server/kern/magnaatwereld.js de rolcontrole in
   kiesKantoor() (`!rollen.includes(rol)`) op `false`; de toets zakte op "een rol
   die niet bij dit kantoor hoort".

   Draai los: node --test test/magnaatwereld-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-magnaatroutes-'));
let srv, base, speler, tweede, gast;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const M = (pad, body, tok) => api('/api/member/magnaat/' + pad, body, tok);
let n = 0;
const lid = async () => (await api('/api/auth/register', { name: 'Speler ' + n, email: 'magnaat' + Date.now() + (n++) + '@x.nl',
  password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  speler = await lid(); tweede = await lid();
  gast = (await api('/api/login', { tier: 'guest' })).body.token;
  assert.ok(speler && tweede && gast);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een missie loopt over de route van start tot klaar, en gasten spelen niet mee', async () => {
  assert.equal((await api('/api/member/magnaat/overzicht', {}, gast)).status, 403);
  assert.equal((await api('/api/member/magnaat/overzicht', {}, null)).status, 401);
  const o = await api('/api/member/magnaat/overzicht', {}, speler);
  assert.equal(o.status, 200);
  assert.ok(o.body.catalogus.length > 0, 'er zijn functies om te spelen');
  assert.match(o.body.spelbrug.regel, /synthetische data/);

  const functie = o.body.catalogus[0].id;
  let r = await api('/api/member/magnaat/taak/start', { functieId: functie, apparaat: 'pda' }, speler);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.taak.omgeving, 'trainingskopie');
  const taakId = r.body.taak.id;
  assert.equal((await api('/api/member/magnaat/taak/antwoord', { taakId, keuze: 0 }, tweede)).status, 404,
    'een andere speler speelt deze taak niet');
  let stappen = 0;
  while (r.body.taak.status === 'bezig' && stappen++ < 30) {
    const h = r.body.taak.huidig;
    r = h.soort === 'software'
      ? await api('/api/member/magnaat/taak/handeling', { taakId, handeling: h.doel }, speler)
      : await api('/api/member/magnaat/taak/antwoord', { taakId, keuze: 0 }, speler);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  }
  assert.equal(r.body.taak.status, 'klaar', 'de missie is voltooid');
});

test('een werkdossier weigert een onvolledige handeling en neemt een volledige aan', async () => {
  let r = await api('/api/member/magnaat/werkproces/start', { workflowId: 'service-reiswijziging', apparaat: 'computer' }, tweede);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal((await api('/api/member/magnaat/werkproces/start', { workflowId: 'bestaat-niet' }, speler)).status, 404);
  let formulieren = 0;
  let geweigerd = false;
  let stappen = 0;
  while (r.body.taak.status === 'bezig' && stappen++ < 30) {
    const stap = r.body.taak.huidig;
    if (stap.soort === 'software') {
      r = await api('/api/member/magnaat/taak/handeling', { taakId: r.body.taak.id, handeling: stap.doel }, tweede);
    } else {
      if (!geweigerd) {
        const fout = await api('/api/member/magnaat/taak/actie', { taakId: r.body.taak.id, invoer: {} }, tweede);
        assert.equal(fout.status, 400, 'een lege handeling wordt geweigerd');
        geweigerd = true;
      }
      const invoer = {};
      for (const veld of stap.velden) {
        invoer[veld.id] = veld.type === 'vink' ? true : veld.opties ? veld.opties[0]
          : 'Volledige synthetische notitie voor dit overdraagbare RTG-dossier.';
      }
      formulieren += 1;
      r = await api('/api/member/magnaat/taak/actie', { taakId: r.body.taak.id, invoer }, tweede);
    }
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  }
  assert.ok(geweigerd, 'er zat een formulier in het dossier');
  assert.equal(r.body.taak.status, 'klaar');
  assert.equal(r.body.taak.dossier.werklog.length, formulieren, 'elke geaccepteerde handeling staat in de werklog, de geweigerde niet');
});

test('kantoor kiezen en de controlekamer: de rol bepaalt wat je mag', async () => {
  const fout = await api('/api/member/magnaat/kantoor/kies', { kantoorId: 'klantenservice', rol: 'Boardroom-regisseur' }, speler);
  assert.equal(fout.status, 400, 'een rol die niet bij dit kantoor hoort');
  assert.equal((await api('/api/member/magnaat/kantoor/kies', { kantoorId: 'bestaat-niet' }, speler)).status, 404);

  const med = await api('/api/member/magnaat/kantoor/kies', { kantoorId: 'klantenservice' }, speler);
  assert.equal(med.status, 200, JSON.stringify(med.body).slice(0, 160));
  assert.match(med.body.kantoor.rol, /medewerker/);
  const zicht = await api('/api/member/magnaat/controle/overzicht', { limiet: 50 }, speler);
  assert.equal(zicht.status, 200);
  assert.ok(zicht.body.punten.length > 0, 'de medewerker ziet punten');
  assert.ok(zicht.body.punten.every(p => p.kantoor.id === 'klantenservice'), 'alleen van het eigen kantoor');
  const groen = zicht.body.punten.find(p => p.risico !== 'rood');
  assert.ok(groen, 'er is een groen of geel punt');
  assert.equal((await api('/api/member/magnaat/controle/zet', { puntId: groen.id, wijziging: { aan: false } }, speler)).status, 403,
    'een medewerker schakelt niets');

  const coord = await api('/api/member/magnaat/kantoor/kies', { kantoorId: 'klantenservice', rol: med.body.kantoor.naam + '-coördinator' }, speler);
  assert.equal(coord.status, 200);
  const uit = await api('/api/member/magnaat/controle/zet', { puntId: groen.id, wijziging: { aan: false } }, speler);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 160));
  assert.equal(uit.body.punt.aan, false);
  assert.equal(uit.body.punt.productieGewijzigd, false, 'de echte productie verandert nooit');

  const taak = await api('/api/member/magnaat/controle/taak/maak', { puntId: groen.id, invoer: { titel: 'Bewijs dit punt' } }, speler);
  assert.equal(taak.status, 200, JSON.stringify(taak.body).slice(0, 160));
  const taakId = taak.body.taak.id;
  assert.equal((await api('/api/member/magnaat/controle/taak/zet', { taakId, status: 'klaar', bewijs: 'kort' }, speler)).status, 400,
    'afronden vraagt testbewijs');
  assert.equal((await api('/api/member/magnaat/controle/taak/zet', { taakId, status: 'verzonnen' }, speler)).status, 400);
  const buiten = await lid();
  const bk = await api('/api/member/magnaat/kantoor/kies', { kantoorId: 'intern' }, buiten);
  assert.equal(bk.status, 200, JSON.stringify(bk.body).slice(0, 160));
  assert.equal((await api('/api/member/magnaat/controle/taak/zet', { taakId, status: 'klaar', bewijs: 'Zelftest groen op de trainingskopie' }, buiten)).status, 403,
    'een speler uit een ander kantoor rondt de taak niet af');
  const af = await api('/api/member/magnaat/controle/taak/zet', { taakId, status: 'klaar', bewijs: 'Zelftest groen op de trainingskopie' }, speler);
  assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 160));
  assert.equal((await api('/api/member/magnaat/controle/zelftest', { puntId: groen.id }, speler)).status, 423,
    'een uitgezet punt test je niet');
  assert.equal((await api('/api/member/magnaat/controle/zet', { puntId: groen.id, wijziging: { aan: true } }, speler)).status, 200);
  const proef = await api('/api/member/magnaat/controle/zelftest', { puntId: groen.id }, speler);
  assert.equal(proef.status, 200, JSON.stringify(proef.body).slice(0, 160));
});

test('de economie: een bestaand scenario klaarzetten en een dag verder', async () => {
  assert.equal((await api('/api/member/magnaat/economie/schok', { schokId: 'zwarte-zwaan' }, speler)).status, 400,
    'een verzonnen scenario bestaat niet');
  const s = await api('/api/member/magnaat/economie/schok', { schokId: 'vraagpiek' }, speler);
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 160));
  assert.equal(s.body.gepland.id, 'vraagpiek');
  const d = await api('/api/member/magnaat/economie/volgende-dag', { commandoId: 'routes-dag-1' }, speler);
  assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 160));
  assert.ok(Number.isInteger(d.body.dag) && d.body.dag >= 1, 'de economie schoof een dag op');
  assert.equal(d.body.grootboek.controle.verschil, 0, 'het grootboek blijft in balans');
  assert.equal((await api('/api/member/magnaat/economie/schok', { schokId: 'vraagpiek' }, gast)).status, 403);
});
