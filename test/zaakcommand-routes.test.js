/* ============================================================================
   DE ROUTES VAN ZAAK COMMAND -- de commandolaag van EEN zaak, over HTTP.

   test/zaakcommand.test.js toetst de motor met nagemaakte gegevens: daar staat
   dat de zaak niets van de buurman ziet en niets van RTG. Dit bestand toetst
   dezelfde belofte langs de deur waar hij in het echt langskomt, plus de twee
   dingen die alleen op deze laag bestaan:

     1. DE ZAAKCODE KOMT UIT DE SESSIE EN NOOIT UIT DE BODY. Wie de code van een
        andere zaak meestuurt, krijgt zijn eigen zaak terug -- niet die van de
        ander en ook geen foutmelding die verraadt dat de ander bestaat.
     2. DE MANAGERGRENS. Kijken mag iedereen die in de zaak-app zit; herstellen,
        beleid zetten en besluiten is voor de leiding.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - laag(req) laten lezen uit req.body.code in plaats van req.supplier
     -> "de code uit de body verandert niets" ZAKT (RAAK)
   - de managerOnly-regel uit runbook/voer gehaald
     -> "een medewerker herstelt niets" ZAKT (RAAK)
   - het zaakvak vervangen door db.data in kern/zaakcommand
     -> "het journaal van deze zaak is van deze zaak" ZAKT (RAAK)

   Draai los: node --test test/zaakcommand-routes.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zcroutes-'));
let srv, base, baas, vloer, buurBaas;

const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const api = (pad, body, token) => post('/api/supplier/command/' + pad, body, token || baas);

async function moet(pad, body, wat, token) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

/* Inloggen bij een zaak: eerst wie er werkt, dan als die persoon naar binnen.
   `rol` kiest of we de leiding of de vloer nemen -- het verschil tussen die
   twee is de helft van wat dit bestand toetst. */
async function inloggen(code, leiding) {
  const roster = await post('/api/supplier/roster', { code });
  const lijst = roster.body.staff || [];
  const wie = leiding ? lijst.find(x => x.role === 'manager')
    : lijst.find(x => x.role !== 'manager');
  assert.ok(wie, (leiding ? 'een manager' : 'een medewerker') + ' bij ' + code);
  // demo-PINs uit kern/staffseed.js: de leiding 1234, de vloer 5678
  const l = await post('/api/supplier/login', { code, staffId: wie.id, pin: leiding ? '1234' : '5678' });
  assert.ok(l.body.token, 'inloggen bij ' + code + ' lukt: ' + (l.body.error || ''));
  return l.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  baas = await inloggen('KIKUNOI', true);
  vloer = await inloggen('KIKUNOI', false);
  buurBaas = await inloggen('SEGUR', true);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. het beginscherm van de zaak gaat over de zaak, en niet over RTG', async () => {
  const s = await moet('start', {}, 'het beginscherm');
  assert.ok(s && typeof s === 'object', 'de stand komt terug');
  await moet('puls', {}, 'de puls');
  await moet('werk', { dagen: 30 }, 'het werkbord');

  /* Het bereik is de lijst soorten die deze laag KENT. Staat er iets van het
     platform in (leden, andere zaken, de foundation), dan is het register te
     ruim gebouwd en niet te ruim gefilterd. */
  const z = await moet('zoek', { q: 'zzzzgeentreffer' }, 'zoeken');
  assert.ok(Array.isArray(z.bereik) && z.bereik.length > 0, 'het bereik staat erbij');
  const verboden = z.bereik.filter(b => /lid|leden|member|foundation|stad/i.test(b.type + ' ' + b.label));
  assert.deepEqual(verboden, [], 'de zaak kent geen platformsoorten: ' + JSON.stringify(verboden));
});

test('2. de code uit de body verandert niets: de sessie bepaalt de zaak', async () => {
  /* Niet het hele antwoord vergelijken: daar zit een tijdstempel in en die
     verschilt per milliseconde. Waar het om gaat is WIENS zaak eruit komt. */
  const eigen = await moet('start', {}, 'de eigen stand');
  assert.equal(eigen.puls.zaak.code, 'KIKUNOI', 'de eigen zaak');

  const gelogen = await moet('start', { code: 'SEGUR', supplierCode: 'SEGUR' },
    'de stand met een vreemde code erin');
  assert.equal(gelogen.puls.zaak.code, 'KIKUNOI', 'de meegestuurde code doet niets');
  assert.equal(/SEGUR/.test(JSON.stringify(gelogen)), false, 'er lekt niets van de andere zaak in');

  const buur = await moet('start', {}, 'de stand van de buurman', buurBaas);
  assert.equal(buur.puls.zaak.code, 'SEGUR', 'wie daar inlogt, ziet die zaak wel');
});

test('3. een medewerker kijkt, maar herstelt niets', async () => {
  await moet('runbooks', {}, 'de vloer mag de recepten zien', vloer);
  await moet('zaken', {}, 'de vloer mag de uitzonderingen zien', vloer);

  const l = await moet('runbooks', {}, 'de recepten');
  assert.ok(l.runbooks.length > 0, 'er staan recepten in');
  const rb = l.runbooks[0];

  const geweigerd = await api('runbook/voer', { id: rb.id, droog: false, reden: 'de vloer probeert het' }, vloer);
  assert.equal(geweigerd.status, 403, 'herstellen is voor de leiding');

  const plan = await moet('operator/plan', { q: 'zet de administratie recht' }, 'de vloer mag een plan maken', vloer);
  const uit = await api('operator/uitvoeren', { plan: plan.plan.id, reden: 'de vloer probeert het' }, vloer);
  assert.equal(uit.status, 403, 'uitvoeren is voor de leiding');
});

test('4. een recept draait droog tenzij je het anders zegt, en is terug te draaien', async () => {
  const l = await moet('runbooks', {}, 'de recepten');
  const rb = l.runbooks.find(r => r.terugDraaibaar) || l.runbooks[0];

  const droog = await moet('runbook/voer', { id: rb.id, reden: 'zonder het veld' }, 'droogloop');
  assert.equal(droog.run.droog, true, 'de standaard is droog');

  const nat = await moet('runbook/voer', { id: rb.id, droog: false, reden: 'de routetoets draait nat',
    menselijkAkkoord: true }, 'nat draaien');
  assert.equal(nat.run.droog, false, 'nu gaat hij echt');

  const terug = await moet('runbook/terug', { run: nat.run.id, reden: 'de routetoets draait terug' },
    'terugdraaien');
  assert.equal(terug.run.teruggedraaid, true, 'de run draagt zijn terugdraaiing');

  const runs = await moet('runs', { n: 10 }, 'de runlijst');
  assert.ok(runs.runs.some(r => r.id === nat.run.id), 'de run staat in de lijst van deze zaak');

  const onbekend = await api('runbook/voer', { id: 'bestaat-niet', droog: false });
  assert.equal(onbekend.status, 404, 'een recept dat er niet is, is 404');
});

test('5. signalen worden zaken, en een zaak loopt langs een mens', async () => {
  const sig = await moet('signalen', {}, 'de signalen');
  assert.ok(Array.isArray(sig.signalen), 'er is een signalenlijst');

  if (sig.signalen.length) {
    const opgepakt = await moet('signaal/oppakken', { id: sig.signalen[0].id,
      reden: 'de routetoets pakt hem op' }, 'een signaal oppakken');
    assert.ok(opgepakt && typeof opgepakt === 'object', 'het oppakken levert iets op');
  } else {
    const leeg = await api('signaal/oppakken', { id: 'bestaat-niet' });
    assert.equal(leeg.status, 404, 'een signaal dat er niet is, is 404');
  }

  const zaken = await moet('zaken', { max: 25 }, 'de uitzonderingen');
  assert.ok(zaken.tellingen, 'de lijst komt met tellingen');
  const open = (zaken.zaken || [])[0];
  if (open) {
    const neem = await moet('zaak/neem', { id: open.id }, 'oppakken');
    assert.ok(neem.zaak.eigenaar, 'de eigenaar komt uit de sessie');
    const besluit = await moet('zaak/besluit', { id: open.id, keuze: 'opgelost',
      reden: 'de routetoets sluit hem' }, 'besluiten');
    assert.equal(besluit.zaak.status, 'afgehandeld');
    const doorDeVloer = await api('zaak/besluit', { id: open.id, keuze: 'opgelost', reden: 'x' }, vloer);
    assert.equal(doorDeVloer.status, 403, 'besluiten is voor de leiding');
  } else {
    assert.equal((await api('zaak/neem', { id: 'bestaat-niet' })).status, 404, 'onbekende zaak is 404');
    assert.equal((await api('zaak/besluit', { id: 'bestaat-niet', keuze: 'opgelost' })).status, 404,
      'onbekende zaak is 404');
  }
});

test('6. het beleid van de zaak is van de zaak, met geschiedenis en terugknop', async () => {
  const stand = await moet('beleid', {}, 'het beleid van de zaak');
  assert.ok(stand.regels.length > 0, 'er staan regels in');
  const regel = stand.regels[0];

  const geweigerd = await api('beleid/zet', { id: regel.id, waarde: regel.waarde, reden: 'de vloer' }, vloer);
  assert.equal(geweigerd.status, 403, 'beleid zetten is voor de leiding');

  const gezet = await moet('beleid/zet', { id: regel.id, waarde: regel.waarde,
    reden: 'de routetoets zet dezelfde waarde' }, 'beleid zetten');
  assert.ok(gezet && typeof gezet === 'object', 'de wijziging komt terug');

  const g = await moet('beleid/geschiedenis', { id: regel.id }, 'de geschiedenis');
  assert.ok(Array.isArray(g.versies) && g.versies.length >= 1, 'de versies staan erin');

  const t = await api('beleid/terug', { id: regel.id, reden: 'de routetoets' });
  assert.ok([200, 409].includes(t.status), 'terugzetten is 200 of een nette 409: ' + t.status);

  const buurStand = await moet('beleid', {}, 'het beleid van de buurman', buurBaas);
  assert.equal(buurStand.regels.length, stand.regels.length, 'dezelfde regels, eigen waarden');
});

test('7. het journaal van deze zaak is van deze zaak', async () => {
  const mijn = await moet('journaal', { n: 50 }, 'het journaal');
  assert.ok(mijn.regels.length > 0, 'wat we hierboven deden staat erin');
  const tekst = JSON.stringify(mijn.regels);
  assert.equal(/SEGUR/.test(tekst), false, 'er staat niets van de buurman in');

  const buur = await moet('journaal', { n: 50 }, 'het journaal van de buurman', buurBaas);
  const mijnIds = new Set(mijn.regels.map(r => r.id));
  assert.deepEqual(buur.regels.filter(r => mijnIds.has(r.id)), [],
    'geen enkele regel komt in beide journalen voor');

  const h = await moet('journaal/herbeleef', { van: '2000-01-01', tot: '2099-01-01' }, 'herbeleven');
  assert.ok(h.stappen > 0, 'de reconstructie heeft stappen');
});

test('8. kwaliteit, graaf, herkomst en dossier gaan alle vier over deze zaak', async () => {
  const k = await moet('kwaliteit', {}, 'de gegevenskwaliteit');
  assert.ok(k && typeof k === 'object', 'de meting komt terug');
  const gr = await moet('graaf', {}, 'de graaf');
  assert.ok(gr && typeof gr === 'object', 'de vorm komt terug');
  const hk = await moet('herkomst', {}, 'de herkomst');
  assert.ok(hk && typeof hk === 'object', 'de kaart komt terug');

  const onzin = await api('object', { type: 'ditbestaatniet', id: 'x' });
  assert.equal(onzin.status, 404, 'een onbekende soort is 404');

  const gevonden = await moet('zoek', { q: 'KIKUNOI' }, 'zoeken in de eigen zaak');
  const groep = (gevonden.groepen || []).find(g => (g.rijen || []).length);
  if (groep) {
    const d = await moet('object', { type: groep.type, id: groep.rijen[0].id }, 'het dossier');
    assert.ok(d && typeof d === 'object', 'het dossier komt terug');
  }
});
