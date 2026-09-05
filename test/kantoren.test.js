/* De RTG-kantoren en de boardroom: zesentwintig afdelingskamers met echte cijfers,
   taken per kamer, en de boardroom die alles ziet, elke platformfunctie kan
   schakelen (globaal en per doelgroep, en het werkt echt: het pad gaat dicht)
   en een verbeterkamer bijhoudt. Draai los:
   node --test test/kantoren.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoren-'));

const api = (pad, body) => fetch(base + (pad.startsWith('/api/') ? pad : '/api/office/' + pad), {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: {
    SMTP_URL: 'smtp://127.0.0.1:2525', SMTP_SANDBOX: '1', SMS_SANDBOX: '1',
    STRIPE_CONNECT_SANDBOX: '1', SEPA_SANDBOX: '1', STRIPE_WEBHOOK_SECRET: 'integratiekamer-test-secret',
    RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-KEURING-1'
  } });
  base = srv.base;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })
  });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zesentwintig kamers, elk met cijfers; zonder inlog blijft de deur dicht', async () => {
  const dicht = await fetch(base + '/api/office/kamers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401);
  const d = await api('kamers');
  assert.equal(d.status, 200);
  assert.equal(d.body.kamers.length, 26, 'zesentwintig afdelingen');
  for (const id of ['sales', 'marketing', 'pr', 'hr', 'financien', 'inkoop', 'verkoop', 'juridisch', 'creatief', 'intern', 'onderzoek', 'klantenservice', 'atelier', 'studio', 'hardware', 'architect', 'regering', 'opvang', 'integraties', 'controleregister', 'reisbureau']) {
    assert.ok(d.body.kamers.some(k => k.id === id), id + ' heeft een kamer');
  }
  const hr = await api('kamer', { id: 'hr' });
  assert.equal(hr.status, 200);
  assert.ok(hr.body.kpis.length >= 3, 'de kamer toont cijfers');
  assert.equal((await api('kamer', { id: 'kelder' })).status, 404);
});

test('Integratiekamer: lokale ketenproef, eigenaarsbesluit en noodstop werken echt', async () => {
  const begin = await api('techniek/integraties');
  assert.equal(begin.status, 200);
  assert.equal(begin.body.liveActivering, 'geblokkeerd', 'live heeft bewust geen schakelroute');
  assert.equal(begin.body.tegels.length, 4);
  assert.deepEqual(begin.body.tegels.map(x => x.id), ['smtp', 'sms', 'connect', 'sepa']);
  assert.ok(begin.body.tegels.every(x => x.geconfigureerd && x.aan && !x.live), 'alleen lokale sandboxes staan aan');

  const keten = await api('techniek/integraties/test', { id: 'keten' });
  assert.equal(keten.status, 200);
  assert.equal(keten.body.proef.stappen.length, 4);
  assert.ok(keten.body.proef.stappen.every(x => x.ok));
  assert.match(keten.body.proef.stappen.find(x => x.id === 'connect').detail, /niets als omzet geboekt/i);

  const eigen = await api('techniek/integraties/verantwoordelijke', { id: 'sms', naam: 'Noor · Techniek' });
  assert.equal(eigen.body.tegels.find(x => x.id === 'sms').verantwoordelijke, 'Noor · Techniek');

  const verzoek = await api('techniek/integraties/schakel', { id: 'sms', aan: false });
  assert.equal(verzoek.status, 200);
  assert.equal(verzoek.body.tegels.find(x => x.id === 'sms').aan, true, 'verzoek schakelt nog niets');
  const verzoekId = verzoek.body.verzoek.id;

  const gedeeldLogin = await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KANTOOR-KEURING-1' })
  });
  const gedeeld = (await gedeeldLogin.json()).token;
  const geenBaas = await fetch(base + '/api/office/techniek/integraties/besluit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + gedeeld },
    body: JSON.stringify({ verzoekId, akkoord: true })
  });
  assert.equal(geenBaas.status, 403, 'gedeelde kantoorcode mag geen besluit nemen');

  const besluit = await api('techniek/integraties/besluit', { verzoekId, akkoord: true });
  assert.equal(besluit.status, 200);
  assert.equal(besluit.body.tegels.find(x => x.id === 'sms').aan, false, 'runtime-zekering staat echt uit');

  const nood = await api('techniek/integraties/noodstop', { reden: 'contracttest' });
  assert.ok(nood.body.noodstop);
  assert.ok(nood.body.tegels.every(x => !x.aan), 'alle lokale rails zijn direct veilig uit');
  assert.ok(nood.body.log.some(x => x.soort === 'noodstop'), 'noodstop staat in het auditlog');
});

test('RTG Controleregister bewijst 100% en maakt geen spookwerk', async () => {
  const matrix = await api('magnaat/controle/overzicht', { soort: 'werkproces', gat: 'alle', limiet: 12 });
  assert.equal(matrix.status, 200);
  assert.equal(matrix.body.dekking.percentage, 100);
  assert.equal(matrix.body.dekking.metGaten, 0);
  assert.equal(matrix.body.dekking.dimensies.length, 11);
  assert.equal(matrix.body.punten.length, 0);
  const plan = await api('/api/office/magnaat/controle/gaten/plan', { limiet: 5 });
  assert.equal(plan.status, 200);
  assert.equal(plan.body.aangemaakt, 0);
  assert.equal(plan.body.bekeken, 0);
  assert.deepEqual(plan.body.taken, []);
  const terug = await api('magnaat/controle/overzicht', { soort: 'werkproces', gat: 'alle', limiet: 12 });
  assert.equal(terug.body.taken.filter(t => t.autoDekking).length, 0);
  assert.match(plan.body.waarschuwing, /trainingsomgeving/i);
});

/* De gatenplanner van het Controleregister. De toets hierboven belooft een huis
   ZONDER werkprocesgaten en houdt op zodra dat niet klopt -- dan is de route
   /api/office/magnaat/controle/gaten/plan nooit aangeroepen en staat hij als gat
   in het routejournaal. Deze toets belooft niets over het aantal gaten maar over
   het GEDRAG van de planner, en houdt daarom in beide werelden stand: hij kijkt
   naar precies de gaten die het register toont, hij houdt zich aan de limiet uit
   het lijf, en hij legt hetzelfde gat nooit twee keer op de stapel. */
test('de gatenplanner kijkt naar dezelfde gaten als het register en legt er nooit dubbel werk op', async () => {
  const dicht = await fetch(base + '/api/office/magnaat/controle/gaten/plan', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(dicht.status, 401, 'de gatenplanner zit achter de kantoorpoort');

  const register = await api('magnaat/controle/overzicht', { soort: 'werkproces', gat: 'alle', limiet: 100 });
  assert.equal(register.status, 200);

  const plan = await api('/api/office/magnaat/controle/gaten/plan', { limiet: 5 });
  assert.equal(plan.status, 200);
  assert.equal(plan.body.ok, true);
  assert.equal(plan.body.bekeken, register.body.paginering.totaal,
    'de planner weegt precies de werkprocesgaten die het register laat zien');
  assert.equal(plan.body.aangemaakt, plan.body.taken.length,
    'het getal is de lijst zelf en geen losse schatting ernaast');
  assert.ok(plan.body.aangemaakt <= 5, 'de limiet uit het lijf begrenst de werkvoorraad echt');
  assert.match(plan.body.waarschuwing, /trainingsomgeving/i,
    'een gatentaak belooft geen enkele productiebevoegdheid');
  for (const taak of plan.body.taken) {
    assert.equal(taak.autoDekking, true, 'een geplande taak is herkenbaar als automatisch');
    assert.equal(taak.status, 'open');
    assert.match(taak.titel, /^Dekkingsgat · /);
    assert.ok(taak.kantoor && taak.kantoor.id, 'elk gat krijgt een kantoor dat het oppakt');
  }

  const staat = await api('magnaat/controle/overzicht', { soort: 'werkproces', gat: 'alle', limiet: 100 });
  const open = staat.body.taken.find(t => t.autoDekking && t.status !== 'klaar');
  if (!open) {
    // geen enkel werkprocesgat: dan hoort de planner ook niets te verzinnen
    assert.equal(plan.body.aangemaakt, 0, 'zonder gat maakt de planner geen spookwerk');
    assert.equal(plan.body.bekeken, 0);
    return;
  }

  const af = await api('magnaat/controle/taak/zet',
    { taakId: open.id, status: 'klaar', bewijs: 'contracttest gatenplanner' });
  assert.equal(af.status, 200);
  assert.equal(af.body.taak.status, 'klaar', 'de dekkingstaak is afgerond en laat het gat weer vrij');

  const opnieuw = await api('/api/office/magnaat/controle/gaten/plan', { limiet: 50 });
  assert.equal(opnieuw.status, 200);
  assert.ok(opnieuw.body.taken.some(t => t.puntId === open.puntId),
    'het vrijgekomen gat staat meteen weer als werkvoorraad klaar');

  const derde = await api('/api/office/magnaat/controle/gaten/plan', { limiet: 50 });
  assert.equal(derde.status, 200);
  assert.ok(derde.body.taken.every(t => t.puntId !== open.puntId),
    'een gat met een openstaande taak krijgt er geen tweede bij');
});

test('taken per kamer: maken, afvinken en terugzien in het grid', async () => {
  const m = await api('kamer/taak', { id: 'sales', tekst: 'Beachclub Sol nabellen over de Zaakdoos' });
  assert.equal(m.status, 200);
  const k = await api('kamer', { id: 'sales' });
  const taak = k.body.taken[0];
  assert.match(taak.tekst, /Beachclub Sol/);
  assert.ok((await api('kamer/taak-zet', { id: 'sales', taakId: taak.id, af: true })).body.ok);
  const grid = await api('kamers');
  const sales = grid.body.kamers.find(x => x.id === 'sales');
  assert.equal(sales.takenOpen, 0, 'afgevinkt telt niet meer als open');
});

test('de boardroom ziet alles en schakelt echt: functie uit, pad dicht, weer aan', async () => {
  const b = await api('boardroom');
  assert.equal(b.status, 200);
  assert.equal(b.body.kamers.length, 26, 'alle kamers in beeld');
  assert.ok(b.body.functies.length >= 5, 'het volledige schakelbord staat erop');
  assert.ok(b.body.verbeterkamer.voorstellen.length >= 1, 'de verbeterkamer heeft een dagronde');
  // pak een echte functie van het bord en zet hem uit
  const alle = b.body.functies.flatMap(g => g.functies);
  const spelenFx = alle.find(f => /spel/i.test(f.naam + f.id)) || alle[0];
  const uit = await api('boardroom/schakel', { functie: spelenFx.id, aan: false });
  assert.equal(uit.status, 200);
  const na = await api('boardroom');
  assert.ok(na.body.functiesUit >= 1, 'het bord telt de uitgezette functie');
  // weer aan, en per doelgroep uit werkt ook
  assert.ok((await api('boardroom/schakel', { functie: spelenFx.id, aan: true })).body.ok);
  if (spelenFx.doelgroepen.length) {
    const dg = spelenFx.doelgroepen[0].id;
    assert.ok((await api('boardroom/schakel', { functie: spelenFx.id, doelgroep: dg, aan: false })).body.ok);
    const check = (await api('boardroom')).body.functies.flatMap(g => g.functies).find(f => f.id === spelenFx.id);
    assert.equal(check.doelgroepen.find(x => x.id === dg).aan, false, 'de doelgroep staat gericht uit');
    assert.ok((await api('boardroom/schakel', { functie: spelenFx.id, doelgroep: dg, aan: true })).body.ok);
  }
  assert.equal((await api('boardroom/schakel', { functie: 'bestaat-niet', aan: false })).status, 404);
});

test('de paniekkamer: een knop wordt een voorstel; de boardroom discussieert en besluit', async () => {
  const alle = (await api('boardroom')).body.functies.flatMap(g => g.functies);
  const fx = alle[1] || alle[0];
  // het voorstel: uit, met reden; dubbel voorstellen wordt tegengehouden
  const v = await api('paniek/stel', { functie: fx.id, aan: false, reden: 'Verdachte piek in het verkeer' });
  assert.equal(v.status, 200);
  assert.equal((await api('paniek/stel', { functie: fx.id, aan: false })).status, 409, 'geen dubbel voorstel voor dezelfde knop');
  // cruciaal: de knop is NIET omgezet; het is een voorstel
  let check = (await api('boardroom')).body;
  assert.equal(check.functies.flatMap(g => g.functies).find(f => f.id === fx.id).aan, true, 'nog niets geschakeld');
  assert.ok(check.paniek.some(p => p.id === v.body.voorstel.id), 'de boardroom ziet het voorstel');
  // discussie over en weer
  await api('paniek/bericht', { id: v.body.voorstel.id, wie: 'boardroom', tekst: 'Welke piek precies?' });
  await api('paniek/bericht', { id: v.body.voorstel.id, wie: 'paniekkamer', tekst: 'Honderden mislukte inlogs per minuut.' });
  const p = (await api('/api/office/paniek')).body.voorstellen.find(x => x.id === v.body.voorstel.id);
  assert.equal(p.discussie.length, 2);
  // de boardroom accepteert: nu pas schakelt hij echt
  assert.ok((await api('paniek/besluit', { id: v.body.voorstel.id, besluit: 'accepteer' })).body.ok);
  check = (await api('boardroom')).body;
  assert.equal(check.functies.flatMap(g => g.functies).find(f => f.id === fx.id).aan, false, 'na acceptatie staat de knop echt om');
  assert.ok(!check.paniek.some(x => x.id === v.body.voorstel.id), 'het voorstel is afgehandeld');
  // terug aan via een tweede voorstel dat wordt afgewezen: er verandert niets
  const v2 = await api('paniek/stel', { functie: fx.id, aan: true });
  assert.ok((await api('paniek/besluit', { id: v2.body.voorstel.id, besluit: 'wijs-af' })).body.ok);
  assert.equal((await api('boardroom')).body.functies.flatMap(g => g.functies).find(f => f.id === fx.id).aan, false, 'afgewezen is niet geschakeld');
  await api('boardroom/schakel', { functie: fx.id, aan: true }); // netjes terug
});

test('platform-statistieken, interne chat met snap en onboarding per kamer', async () => {
  // de statistieken beslaan het hele huis, van mensen tot de code zelf
  const s = await api('/api/office/stats');
  assert.equal(s.status, 200);
  const groepen = s.body.stats.map(g => g.groep);
  for (const g of ['Mensen', 'Beweging', 'Geld', 'De code zelf']) assert.ok(groepen.includes(g), g);
  // chat: bericht + snap in de sales-kamer; boardroom en paniekkamer hebben eigen kanalen
  const SNAP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal((await api('kachat/stuur', { kamer: 'sales', naam: 'Stagiair Bo', tekst: 'Hallo team!', foto: SNAP })).status, 200);
  assert.equal((await api('kachat/stuur', { kamer: 'boardroom', naam: 'Voorzitter', tekst: 'Welkom allemaal.' })).status, 200);
  assert.equal((await api('kachat/stuur', { kamer: 'kelder', tekst: 'x' })).status, 404);
  assert.equal((await api('kachat/stuur', { kamer: 'sales' })).status, 400, 'leeg bericht geweigerd');
  const c = await api('kachat', { kamer: 'sales' });
  const laatste = c.body.berichten[c.body.berichten.length - 1];
  assert.equal(laatste.naam, 'Stagiair Bo');
  assert.ok(laatste.foto && laatste.foto.startsWith('data:image/'), 'de snap kwam mee');
  // onboarding: warm welkom, huisregels, knoppen en handelingen, per kamer
  const o = await api('/api/office/onboarding', { kamer: 'sales' });
  assert.equal(o.status, 200);
  assert.match(o.body.onboarding.welkom, /gehoord, gesteund/);
  assert.ok(o.body.onboarding.regels.some(r => /vertrouwenspersoon/i.test(r)), 'de vertrouwenspersoon staat erin');
  assert.ok(o.body.onboarding.knoppen.length >= 2 && o.body.onboarding.handelingen.length >= 1);
  const hr = await api('onboarding', { kamer: 'hr' });
  assert.notDeepEqual(hr.body.onboarding.knoppen, o.body.onboarding.knoppen, 'elke afdeling zijn eigen knoppen');
});

test('aanmelden voor de dienst: kantoor of thuis, en iedereen ziet wie er werkt', async () => {
  const d = await api('dienst/in', { naam: 'Stagiair Bo', kamer: 'sales', waar: 'thuis' });
  assert.equal(d.status, 200);
  assert.equal(d.body.dienst.waar, 'thuis');
  assert.equal((await api('dienst/in', { naam: 'Stagiair Bo', kamer: 'sales' })).status, 409, 'niet dubbel aanmelden');
  assert.equal((await api('dienst/in', { naam: 'X', kamer: 'kelder' })).status, 404);
  const nu = await api('/api/office/dienst');
  assert.ok(nu.body.aangemeld.some(x => x.naam === 'Stagiair Bo' && x.waar === 'thuis'));
  assert.ok((await api('dienst/uit', { id: d.body.dienst.id })).body.ok);
  assert.ok(!(await api('dienst')).body.aangemeld.some(x => x.naam === 'Stagiair Bo'), 'afgemeld is weg uit de lijst');
});

test('de verbeterkamer loopt op verzoek een verse ronde', async () => {
  const v = await api('boardroom/verbeter');
  assert.equal(v.status, 200);
  assert.ok(v.body.verbeterkamer.voorstellen.length >= 1);
  assert.ok(v.body.verbeterkamer.voorstellen.every(p => p.kamer && p.tekst), 'elk voorstel wijst een kamer aan');
});

test('Techniek-controlekamer: de motorkap-momentopname (grootboek, motor, De Wacht)', async () => {
  const dicht = await fetch(base + '/api/office/techniek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401, 'zonder inlog blijft de controlekamer dicht');
  const t = await api('techniek');
  assert.equal(t.status, 200);
  assert.ok(t.body.grootboek && t.body.grootboek.pay, 'het pay-grootboek zit in het bord');
  assert.equal(t.body.grootboek.pay.klopt, true, 'RTG Pay sluit op de cent');
  assert.ok(t.body.motor, 'de motor-stand zit erin');
  assert.equal(t.body.motor.aan, false, 'in schaduw draait de motor niet mee');
  assert.ok(t.body.wacht && t.body.wacht.meters, 'het De Wacht-immuunbord zit erin');
  assert.ok('lastafworp' in t.body.wacht, 'de lastafworp-stand (voor de gezondheidsband) is aanwezig');
});

test('Rahul denkt mee in een kamer: adviserend, uit de echte cijfers (zonder AI-sleutel)', async () => {
  const dicht = await fetch(base + '/api/office/kamer/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'hr' }) });
  assert.equal(dicht.status, 401, 'zonder inlog blijft de kamer-AI dicht');
  const r = await api('kamer/ai', { id: 'hr', q: 'Waar liggen de risico\'s?' });
  assert.equal(r.status, 200);
  assert.match(r.body.kamer, /HR|Human|Mensen|Personeel/i);
  assert.ok(typeof r.body.antwoord === 'string' && r.body.antwoord.length > 0, 'er komt een advies terug');
  assert.ok(Array.isArray(r.body.punten) && r.body.punten.length >= 1, 'de punten uit de cijfers zitten erbij');
  assert.equal((await api('kamer/ai', { id: 'kelder' })).status, 404, 'een niet-bestaande kamer geeft 404');
});

test('Rahul kijkt over het hele huis: overkoepelend boardroom-advies (zonder AI-sleutel)', async () => {
  const dicht = await fetch(base + '/api/office/boardroom/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401, 'zonder inlog blijft de boardroom-AI dicht');
  const r = await api('boardroom/ai', { q: 'Welke kamer voelt de meeste druk?' });
  assert.equal(r.status, 200);
  assert.ok(typeof r.body.antwoord === 'string' && r.body.antwoord.length > 0, 'er komt een overkoepelend advies terug');
  assert.ok(Array.isArray(r.body.punten) && r.body.punten.length >= 1, 'de punten uit de dagronde zitten erbij');
});
