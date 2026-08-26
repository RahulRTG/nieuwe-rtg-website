/* BUDGETTEN EN SLIM BETALEN -- meerdere potjes, één tik.

   WAAROM DEZE TOETS ER IS

   Zodra een lid meer dan één positie heeft, is "betaal 72 euro" geen opdracht
   meer maar een vraag: waar komt het vandaan? Het lid hoort die vraag nooit te
   krijgen, dus beantwoordt kern/waarde/samenstellen.js hem. En die keuze is niet
   willekeurig: pakt het systeem het vrije geld eerst, dan ziet het lid aan het
   eind van de maand zijn maaltijdbudget verlopen terwijl hij zijn eigen geld
   heeft uitgegeven aan precies datgene waar dat budget voor was. Dat is de fout
   die deze toets moet uitsluiten, en hij is met geen enkele foutmelding
   zichtbaar -- alleen met een verwachting over de VOLGORDE.

   WAT HIER WORDT NAGETROKKEN

   1. GELD ONTSTAAT NIET UIT HET NIETS. Een werkgever die budget uitdeelt, is
      het kwijt. Het grootboek sluit erna nog steeds op nul.
   2. HET GEBONDEN POTJE GAAT EERST OP, en het eigen saldo blijft staan.
   3. HET BELEID BLIJFT GELDEN. Een maaltijdbudget met genrebeperking gaat niet
      mee naar een zaak die er niet onder valt; dan betaalt het eigen geld.
   4. EEN LID KAN NIET UITDELEN WAT DE UITGEVER NIET HEEFT.
   5. UITBETAALBARE WAARDE IS NIET UIT TE GEVEN. Anders was uitgifte een manier
      om de bevoegdhedenlijst te omzeilen.
   6. DE PORTEFEUILLE TELT VRIJ EN GEBONDEN NIET BIJ ELKAAR OP.
   7. DE LIJST VAN UITGEDEELDE BUDGETTEN IS AAN DE MANAGER. Die lijst noemt per
      regel een codenaam met een restant erachter; voor een werkgever is dat het
      personeelsdossier in tabelvorm.

   Draai los: node --experimental-sqlite --test test/paybudget.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-budget-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const wallet = () => api('pay/overzicht', {}, lid.token).then(r => r.body);
const portefeuille = () => api('pay/portefeuille', {}, lid.token).then(r => r.body);
const code = (max) => api('pay/kascode', { maxCenten: max }, lid.token).then(r => r.body.code);
const sluit = async () => (await (await fetch(base + '/api/pay/gezond')).json()).klopt;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const d = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = { token: d.token, codenaam: (await api('pay/overzicht', {}, d.token)).body.codenaam };
  const s = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json();
  sup = { token: s.token, code: s.state.supplier.code, genre: s.state.supplier.type };
  assert.ok(lid.codenaam && sup.code && sup.genre, 'de zaak heeft een genre in het register');
  // het lid heeft eigen geld, en de zaak heeft omzet om budget uit te geven
  await api('pay/oplaad', { centen: 10000, idem: 'b-eigen' }, lid.token);
  const c = await code(50000);
  await api('supplier/pay/in', { code: c, centen: 8000, idem: 'b-omzet' }, sup.token);
  await api('pay/oplaad', { centen: 10000, idem: 'b-eigen2' }, lid.token);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een budget geven kost de uitgever precies dat bedrag; het grootboek sluit', async () => {
  const voor = (await api('supplier/pay/overzicht', {}, sup.token)).body.saldo;
  const r = await api('supplier/pay/budget', { aan: lid.codenaam, klasse: 'EMPLOYER_BUDGET',
    centen: 4000, oms: 'Maaltijdbudget', beleid: { genres: [sup.genre] }, idem: 'g1' }, sup.token);
  assert.equal(r.status, 200, 'de zaak deelt 40 euro maaltijdbudget uit');
  assert.ok(r.body.positie.startsWith('waarde:'), 'er is een eigen positie voor gemaakt');
  assert.equal(r.body.restantUitgever, voor - 4000, 'en de uitgever is precies dat kwijt');
  assert.equal(await sluit(), true, 'geld ontstaat niet uit het niets');

  const p = await portefeuille();
  assert.equal(p.posities.length, 2, 'het lid heeft nu twee posities');
  const budget = p.posities.find(x => x.klasse === 'EMPLOYER_BUDGET');
  assert.equal(budget.saldo, 4000);
  assert.equal(budget.uitgever, sup.code, 'en het lid ziet van wie het komt');
  assert.ok(budget.vervaltOp > Date.now(), 'een budget vervalt altijd');
});

test('de portefeuille telt vrij en gebonden niet bij elkaar op', async () => {
  const p = await portefeuille();
  assert.equal(p.gebonden, 4000, 'het maaltijdbudget is gebonden');
  assert.ok(p.vrijBesteedbaar > 0, 'en het eigen saldo is vrij');
  assert.equal(p.totaal, undefined,
    'er is met opzet geen totaal: dat leest als "dit kan ik uitgeven" en dat is gebonden geld niet');
});

test('het gebonden potje gaat eerst op, en het eigen saldo blijft staan', async () => {
  const voorW = (await wallet()).saldo;
  const voorP = await portefeuille();
  const budgetVoor = voorP.posities.find(x => x.klasse === 'EMPLOYER_BUDGET').saldo;

  // een rekening van 25 euro bij een zaak van het juiste genre
  const c = await code(50000);
  const r = await api('supplier/pay/in', { code: c, centen: 2500, idem: 'p1' }, sup.token);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.delen) && r.body.delen.length >= 1, 'de betaling is samengesteld');

  const naP = await portefeuille();
  const budgetNa = naP.posities.find(x => x.klasse === 'EMPLOYER_BUDGET').saldo;
  assert.equal(budgetNa, budgetVoor - 2500, 'het gebonden budget heeft de hele rekening gedragen');
  assert.equal((await wallet()).saldo, voorW, 'en het eigen saldo is niet aangeraakt');
  assert.equal(await sluit(), true);
});

test('valt de zaak buiten het beleid, dan blijft dat budget staan', async () => {
  /* Een TWEEDE budget, gebonden aan een genre dat deze zaak niet heeft. Het
     genre komt uit het partnerregister, dus deze zaak kan er niet bij -- ook
     niet door het zelf te sturen. */
  const g = await api('supplier/pay/budget', { aan: lid.codenaam, klasse: 'EMPLOYER_BUDGET',
    centen: 3000, oms: 'Sportbudget', beleid: { genres: ['sportschool'] }, idem: 'g-ander' }, sup.token);
  assert.equal(g.status, 200);
  const anderRek = g.body.positie;
  const voorW = (await wallet()).saldo;

  const c = await code(50000);
  const r = await api('supplier/pay/in', { code: c, centen: 1200, idem: 'p2' }, sup.token);
  assert.equal(r.status, 200);

  const na = (await portefeuille()).posities.find(x => x.rek === anderRek);
  assert.equal(na.saldo, 3000, 'het sportbudget geldt hier niet en is niet aangeraakt');
  assert.ok(r.body.delen.every(d => d.rek !== anderRek), 'het zat niet in de samenstelling');
  assert.equal(await sluit(), true);
});

test('een genrebeperking faalt DICHT: zonder bekend genre geldt het tegoed niet', async () => {
  /* Dit is de fout die deze laag bijna had. De genretoets stond eerst als
     "als er een genre bekend is EN het past niet, dan nee" -- en dus glipte
     elke betaling zonder bekend genre langs elke beperking heen. Een
     beleidslaag die bij twijfel goedkeurt, is geen beleidslaag. */
  const { toets } = require('../server/kern/waarde/policy');
  const positie = { klasse: 'EMPLOYER_BUDGET', beleid: { genres: ['horeca'] } };
  assert.equal(toets(positie, { centen: 100, genre: 'horeca', soort: 'besteden' }).mag, true);
  assert.equal(toets(positie, { centen: 100, genre: 'slijterij', soort: 'besteden' }).reden, 'genre');
  assert.equal(toets(positie, { centen: 100, soort: 'besteden' }).reden, 'genre',
    'geen genre bekend is geen vrijbrief');
});

test('is het budget op, dan vult het eigen saldo aan -- in één tik', async () => {
  const p = await portefeuille();
  const budget = p.posities.find(x => x.klasse === 'EMPLOYER_BUDGET');
  const rest = budget.saldo;
  assert.ok(rest > 0 && rest < 3000, 'er staat nog een restje op het budget');
  const voorW = (await wallet()).saldo;

  const c = await code(50000);
  const r = await api('supplier/pay/in', { code: c, centen: rest + 800, idem: 'p3' }, sup.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.delen.length, 2, 'twee potjes, één betaling');

  const naB = (await portefeuille()).posities.find(x => x.klasse === 'EMPLOYER_BUDGET').saldo;
  assert.equal(naB, 0, 'het budget is helemaal opgemaakt');
  assert.equal((await wallet()).saldo, voorW - 800, 'en het eigen geld vulde precies de rest aan');
  assert.equal(await sluit(), true);
});

test('een uitgever kan niet uitdelen wat hij niet heeft, en uitbetaalbaar is niet uit te geven', async () => {
  const saldo = (await api('supplier/pay/overzicht', {}, sup.token)).body.saldo;
  const teveel = await api('supplier/pay/budget', { aan: lid.codenaam, klasse: 'EMPLOYER_BUDGET',
    centen: saldo + 100000, idem: 'g2' }, sup.token);
  assert.equal(teveel.status, 402, 'boven zijn eigen saldo kan niet');

  const fout = await api('supplier/pay/budget', { aan: lid.codenaam, klasse: 'PARTNER_SETTLEMENT',
    centen: 100, idem: 'g3' }, sup.token);
  assert.equal(fout.status, 403, 'uitbetaalbare waarde is niet uit te geven');
  assert.match(fout.body.error, /bevoegdheid/, 'en het antwoord zegt waar dat wel hoort');
  assert.equal(await sluit(), true);
});

test('de lijst met uitgedeelde budgetten is aan de manager, niet aan de vloer', async () => {
  /* WAT HIER WORDT NAGETROKKEN, en waarom het niet vanzelf spreekt.

     `supplier/pay/budget` (uitdelen) vroeg vanaf het begin de manager, want dat
     kost de zaak geld. De LIJST vroeg dat niet -- en die is voor de privacy de
     zwaardere van de twee: hij geeft per regel de codenaam van de ontvanger,
     zijn restant en waaraan het gebonden is. Bij een werkgever met een
     maaltijdbudget kon dus elke collega met een PDA zien wie hoeveel kreeg.

     De vloerlogin is een echte tweede sessie (personeelspin), niet een gefnuikt
     token: de rol komt uit het rooster en niet uit het verzoek. */
  const man = await api('supplier/pay/budget/lijst', {}, sup.token);
  assert.equal(man.status, 200, 'de manager ziet zijn eigen uitgedeelde budgetten');
  assert.ok(man.body.posities.some(p => p.aan === lid.codenaam),
    'en het budget van dit lid staat erin, op codenaam');
  assert.equal(man.body.uitstaandCenten,
    man.body.posities.reduce((n, p) => n + p.saldo, 0),
    'het uitstaande bedrag is de som van de restanten en niet van het uitgedeelde');

  const roster = await (await fetch(base + '/api/supplier/roster', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: sup.code }) })).json();
  const vloer = roster.staff.find(x => x.role !== 'manager');
  assert.ok(vloer, 'deze zaak heeft vloerpersoneel op het rooster');
  const inlog = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: sup.code, staffId: vloer.id, pin: '5678' }) })).json();
  assert.ok(inlog.token, 'en die kan gewoon inloggen op de PDA');

  const vl = await api('supplier/pay/budget/lijst', {}, inlog.token);
  assert.equal(vl.status, 403, 'maar komt niet bij de lijst');
  assert.equal(vl.body.posities, undefined, 'en krijgt geen enkele regel mee');
});
