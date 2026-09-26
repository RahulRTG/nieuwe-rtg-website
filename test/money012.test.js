/* MONEY-012 -- geld dat het huis verlaat, eindigt na elke onderbreking in
   precies EEN verklaarbare waarheid.

   Vier wetten, en deze toets beproeft ze op de uitgaande kant (de
   betaalopdracht, server/kern/betaalopdracht/), het enige pad waar geld RTG
   echt verlaat:

     1. BEHOUD         het bedrag gaat precies een keer weg: of de rail betaalt
                       het uit, of het komt terug op de rekening. Nooit allebei
                       (geld uit niets), nooit geen van beide na afstemming.
     2. EEN GEVOLG     een herhaalde inzending draagt dezelfde sleutel, dus de
                       rail voert hem hooguit een keer uit, en er wordt hooguit
                       een keer teruggeboekt.
     3. HERSTEL        na elke onderbreking -- ook een herstart na elke stap --
                       komt de opdracht, zodra de rail zich uitspreekt, op
                       AFGEWIKKELD of TERUGGEBOEKT uit.
     4. AFSTEMMING     zolang RTG niet weet of de rail hem uitvoerde, staat dat
                       er als ONBEKEND, zichtbaar in de reconciliatie. Nooit
                       stilletjes mislukt, nooit stilletjes gelukt.

   WAAROM UITPUTTEND EN NIET STEEKPROEF. Er zijn vier soorten poging (gelukt,
   voor de deur geweigerd, uitgevoerd-maar-antwoord-kwijt, time-out zonder
   uitvoering) en drie pogingen: 64 volgordes. Die zijn allemaal te lopen, dus
   er valt niets te raden. Elke volgorde loopt twee keer: een keer in een
   proces, en een keer met een HERSTART na elke stap (de rij gaat door JSON,
   precies zoals hij op schijf staat).

   Wat deze toets NIET bewijst staat in docs/money-012.md: een echte provider,
   de inkomende kant en de motor. De inkomende kant heeft eigen proeven
   (test/betaalwaarheid.test.js, test/betaalwebhook-fouten.test.js).
   Draai los: node --test test/money012.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAX = 3;
const SOORTEN = ['ok', 'dicht', 'kwijt', 'stil'];
/*  ok     de rail voert uit en antwoordt
    dicht  geweigerd VOOR de deur (nietVerstuurd): er ging niets naar buiten
    kwijt  de rail voert uit, het antwoord raakt onderweg kwijt
    stil   time-out zonder dat de rail iets deed -- voor RTG niet te
           onderscheiden van `kwijt`, en dat is precies het punt */

/* De rail als buitenwereld: hij kent zijn eigen waarheid (wat hij per sleutel
   heeft uitgevoerd) en herkent een herhaalde sleutel, zoals elke echte
   provider met een idempotentiesleutel. `eerlijk: false` is de tegenproef: een
   rail die een kwijtgeraakt antwoord als "niet verstuurd" meldt. */
function maakRail(volgorde, { eerlijk = true } = {}) {
  const uitgevoerd = new Map();   // sleutel -> providerreferentie
  const sleutels = [];
  let i = 0;
  let daarna = 'ok';
  return {
    uitgevoerd, sleutels,
    zetDaarna(s) { daarna = s; },
    async inzenden(o) {
      sleutels.push(o.idemSleutel);
      const soort = i < volgorde.length ? volgorde[i] : daarna;
      i++;
      const voer = () => {
        if (!uitgevoerd.has(o.idemSleutel)) uitgevoerd.set(o.idemSleutel, 'po_' + uitgevoerd.size + '_' + o.idemSleutel);
        return { id: uitgevoerd.get(o.idemSleutel), status: 'ingepland' };
      };
      if (soort === 'ok') return voer();
      if (soort === 'dicht') throw Object.assign(new Error('rail dicht'), { nietVerstuurd: true });
      if (soort === 'kwijt') { voer(); throw Object.assign(new Error('verbinding verbroken na verzending'), eerlijk ? {} : { nietVerstuurd: true }); }
      if (soort === 'stil') throw new Error('time-out');
      throw new Error('onbekende soort ' + soort);
    }
  };
}

/* Een opstelling met een klok en een "schijf" (db). `herstart()` bouwt de rij
   opnieuw op uit wat er op schijf staat -- het geheugen van het oude proces is
   weg. De teruggang telt hoe vaak het geld terugkwam. */
function maakWereld(rail) {
  const schijf = { data: {} };
  const klok = { t: 1_000_000 };
  const terug = [];
  let op;
  function bouw() {
    op = require('../server/kern/betaalopdracht')({
      d: () => schijf.data, save: () => {}, crypto, nu: () => klok.t,
      maxPogingen: MAX, backoffMs: [10, 20, 40], log: { warn: () => {} },
      railInzenden: (o) => rail.inzenden(o)
    });
    op.registreerTeruggang('sepa-uit', async (o) => { terug.push(o.id); return { ok: true, boeking: { id: 'T' + terug.length } }; });
  }
  bouw();
  return {
    get op() { return op; }, klok, terug,
    herstart() { schijf.data = JSON.parse(JSON.stringify(schijf.data)); bouw(); }
  };
}

const basis = { soort: 'sepa-uit', centen: 12500, bron: 'NL00RTG0000000001',
  bestemming: 'NL91ABNA0417164300', ledgerRef: 'BB-M012', idemSleutel: 'bank-sepa:M012' };

/* Een volgorde aflopen zoals productie hem zou beleven: de eerste inzending,
   daarna de automatische ronde tot hij niets meer te doen heeft. */
async function loop(volgorde, { herstartElkeStap = false, eerlijk = true } = {}) {
  const rail = maakRail(volgorde, { eerlijk });
  const w = maakWereld(rail);
  const o = w.op.maak(basis);
  const id = o.id;
  await w.op.dienIn(id);
  for (let stap = 0; stap < MAX + 2; stap++) {
    if (herstartElkeStap) w.herstart();
    w.klok.t += 1000;
    await w.op.ronde({ tot: w.klok.t });
  }
  if (herstartElkeStap) w.herstart();
  return { rail, w, id };
}

/* De rail spreekt zich uit (de afstemming): wat zegt hij over deze sleutel?
   Heeft hij hem uitgevoerd, dan bevestigt hij dat; anders meldt hij de
   mislukking. Voor een ONBEKENDE opdracht zonder referentie gaat de uitspraak
   via een handmatige herinzending met dezelfde sleutel -- dat is precies wat
   /api/office/bank/opdrachten/opnieuw doet. */
async function stemAf({ rail, w, id }, { via = 'herinzending' } = {}) {
  rail.zetDaarna('ok');
  let o = w.op.vind(id);
  const uitgevoerd = rail.uitgevoerd.has(basis.idemSleutel);
  if (o.status === 'ONBEKEND' && via === 'afschrift') {
    /* De afschriftweg (kern/betaalopdracht/afstemming.js): de rail zegt wat hij
       deed, met zijn eigen referentie en bedrag. */
    await w.op.stemAf({ id, uitspraak: uitgevoerd ? 'uitgevoerd' : 'niet-uitgevoerd',
      providerRef: rail.uitgevoerd.get(basis.idemSleutel) || null, centen: basis.centen, valuta: 'eur',
      bron: 'afschrift proef', echtheid: 'DIRECT_API' });
    return w.op.vind(id);
  }
  if (o.status === 'ONBEKEND' && uitgevoerd) { await w.op.dienIn(id); o = w.op.vind(id); }
  if (o.status === 'ONBEKEND' && !uitgevoerd) { await w.op.bevestig({ id, gelukt: false, reden: 'rail: niet ontvangen' }); o = w.op.vind(id); }
  if (o.status === 'INGEDIEND') { await w.op.bevestig({ id, settlementRef: o.settlementRef }); o = w.op.vind(id); }
  return o;
}

function alleVolgordes() {
  const uit = [];
  const bouw = (pref) => { if (pref.length === MAX) { uit.push(pref); return; } for (const s of SOORTEN) bouw([...pref, s]); };
  bouw([]);
  return uit;
}

/* Alle vier wetten op een volgorde. Geeft een lijst schendingen terug in plaats
   van te gooien, zodat de tegenproef hieronder kan tellen hoeveel er zijn. */
async function schendingen(volgorde, opties) {
  const fout = [];
  const run = await loop(volgorde, opties);
  const { rail, w, id } = run;
  const naam = volgorde.join('>') + (opties.herstartElkeStap ? ' (herstart)' : '');

  // wet 2: een sleutel, hooguit een uitvoering, hooguit een teruggang
  if (new Set(rail.sleutels).size !== 1) fout.push(naam + ': de pogingen droegen verschillende sleutels');
  if (w.terug.length > 1) fout.push(naam + ': ' + w.terug.length + ' keer teruggeboekt');

  // wet 1 VOOR de afstemming: nooit uitgevoerd EN teruggeboekt
  const uitgevoerd = rail.uitgevoerd.has(basis.idemSleutel);
  if (uitgevoerd && w.terug.length) fout.push(naam + ': de rail betaalde uit EN het geld kwam terug (geld uit niets)');

  // wet 4: niet weten staat er als ONBEKEND, en telt in de reconciliatie
  const voor = w.op.vind(id);
  const open = w.op.openstaand();
  if (voor.status === 'MISLUKT' || voor.status === 'TERUGGEBOEKT') {
    if (uitgevoerd) fout.push(naam + ': opgegeven terwijl de rail hem had uitgevoerd');
  }
  if (voor.status === 'ONBEKEND' && open.onbekend !== 1) fout.push(naam + ': ONBEKEND telt niet mee in de reconciliatie');
  if (voor.status === 'ONBEKEND' && !voor.misschienVerstuurd) fout.push(naam + ': ONBEKEND zonder dat hij misschien verstuurd is');

  // wet 3 + wet 1 NA de afstemming: precies een waarheid, en het bedrag is precies een keer weg
  const eind = await stemAf(run, { via: opties.via });
  const naUitgevoerd = rail.uitgevoerd.has(basis.idemSleutel) ? 1 : 0;
  if (!['AFGEWIKKELD', 'TERUGGEBOEKT'].includes(eind.status)) fout.push(naam + ': eindigt op ' + eind.status);
  if (naUitgevoerd + w.terug.length !== 1) fout.push(naam + ': uitgevoerd ' + naUitgevoerd + ' + teruggeboekt ' + w.terug.length + ' is niet precies 1');
  if (w.op.openstaand().aantal !== 0) fout.push(naam + ': na afstemming staat er nog iets open');
  return fout;
}

test('wet 1-4 over alle 64 storingsvolgordes, in een proces', async () => {
  const alle = [];
  for (const v of alleVolgordes()) alle.push(...await schendingen(v, {}));
  assert.deepEqual(alle, []);
});

test('wet 1-4 over alle 64 storingsvolgordes, met een herstart na elke stap', async () => {
  const alle = [];
  for (const v of alleVolgordes()) alle.push(...await schendingen(v, { herstartElkeStap: true }));
  assert.deepEqual(alle, []);
});

test('wet 1-4 over alle 64 storingsvolgordes, gesloten via de afschriftweg', async () => {
  const alle = [];
  for (const v of alleVolgordes()) alle.push(...await schendingen(v, { via: 'afschrift' }));
  assert.deepEqual(alle, []);
});

/* DE TEGENPROEF. Een meter die niet kan uitslaan is geen meter (LAT.md regel
   9). Laat de rail een kwijtgeraakt antwoord als "niet verstuurd" melden -- het
   oude gedrag, waarin elke fout een mislukking was -- en de sweep moet de
   volgordes vinden waarin geld uit niets ontstaat. */
test('tegenproef: een rail die over een verloren antwoord liegt, laat de sweep zakken', async () => {
  const alle = [];
  for (const v of alleVolgordes()) alle.push(...await schendingen(v, { eerlijk: false }));
  assert.ok(alle.some(s => /geld uit niets/.test(s)), 'de sweep ziet het gat dat MONEY-012 dichtzet');
});

test('het scherpste geval, uitgeschreven: uitgevoerd, antwoord kwijt, rail daarna dicht', async () => {
  const run = await loop(['kwijt', 'dicht', 'dicht']);
  const o = run.w.op.vind(run.id);
  assert.equal(o.status, 'ONBEKEND', 'niet MISLUKT: de rail kan het geld al hebben verstuurd');
  assert.equal(run.w.terug.length, 0, 'en er is NIET teruggeboekt');
  assert.equal(o.misschienVerstuurd, true);
  const open = run.w.op.openstaand();
  assert.equal(open.onbekend, 1, 'het verschil staat zichtbaar in de reconciliatie');
  assert.equal(open.onbekendeCenten, 12500);

  // de automaat blijft eraf: blijven aanbieden verandert niets aan wat er gebeurde
  const pogingen = o.pogingen;
  run.w.klok.t += 1e9;
  await run.w.op.ronde({ tot: run.w.klok.t });
  assert.equal(run.w.op.vind(run.id).pogingen, pogingen, 'de ronde pakt een ONBEKENDE opdracht niet op');

  // de afstemming: dezelfde sleutel levert het bestaande resultaat, daarna bevestigt de rail
  const eind = await stemAf(run);
  assert.equal(eind.status, 'AFGEWIKKELD');
  assert.equal(run.rail.uitgevoerd.size, 1, 'precies een uitbetaling bij de rail');
  assert.equal(run.w.terug.length, 0, 'en geen teruggang');
});

test('al aangenomen door de rail, daarna gaat de rail dicht: nooit terugboeken', async () => {
  /* Een INGEDIENDE opdracht gaat elke ronde opnieuw langs de rail. Zet het
     kantoor de rail daarna uit, dan gooit elke herhaling een fout die wel
     "voor de deur" is -- maar de eerste inzending was al aangenomen. Vroeger
     leidde dat na de laatste poging tot een terugboeking. */
  const run = await loop(['ok', 'dicht', 'dicht', 'dicht']);
  const o = run.w.op.vind(run.id);
  assert.notEqual(o.status, 'TERUGGEBOEKT');
  assert.equal(run.w.terug.length, 0, 'het geld is al onderweg bij de rail en komt niet ook nog terug');
});

test('een ONBEKENDE opdracht zonder uitvoering: pas na de uitspraak van de rail terug', async () => {
  const run = await loop(['stil', 'stil', 'stil']);
  assert.equal(run.w.op.vind(run.id).status, 'ONBEKEND');
  assert.equal(run.w.terug.length, 0, 'de tijd alleen is geen uitspraak');

  // opnieuw aanbieden en weer geen uitsluitsel: blijft onbekend, telt niet op naar opgeven
  run.rail.zetDaarna('stil');
  await run.w.op.dienIn(run.id);
  assert.equal(run.w.op.vind(run.id).status, 'ONBEKEND');
  assert.equal(run.w.terug.length, 0);

  await run.w.op.bevestig({ id: run.id, gelukt: false, reden: 'rail: niet ontvangen' });
  assert.equal(run.w.op.vind(run.id).status, 'TERUGGEBOEKT');
  assert.equal(run.w.terug.length, 1, 'precies een keer terug, en pas nu');
});

test('voor de deur geweigerd, elke keer: opgeven en terugboeken blijft werken', async () => {
  const run = await loop(['dicht', 'dicht', 'dicht']);
  assert.equal(run.w.op.vind(run.id).status, 'TERUGGEBOEKT');
  assert.equal(run.w.terug.length, 1);
  assert.equal(run.rail.uitgevoerd.size, 0);
});

/* DE ECHTE UITBETAALNAAD. De opdrachtenrij vertrouwt op `nietVerstuurd`; dan
   moet server/betaal.js het ook echt zetten waar een fout voor de deur valt, en
   het NIET zetten op iets anders. */
const WORTEL = path.join(__dirname, '..');
function kind(code, extra) {
  return spawnSync(process.execPath, ['-e', code], {
    cwd: WORTEL, encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', RTG_DEMO: '', STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '',
      ADYEN_API_KEY: '', STRIPE_DEMO_BEWUST: '', RTG_MAGNAAT_TEST: '', RTG_SIMULATIEBANK: '', MAIL_DIRECT: '', SMTP_URL: '', ...extra }
  });
}

test('server/betaal.js merkt fouten voor de deur als nietVerstuurd', () => {
  const code = `
    const b=require('./server/betaal');
    const vang=p=>p.then(()=>'geen fout',e=>({code:e.code||e.message,nv:e.nietVerstuurd===true}));
    Promise.all([
      vang(b.maakUitbetaling({bedrag:0,iban:'NL91ABNA0417164300',referentie:'m012-nul'})),
      vang(b.maakUitbetaling({bedrag:100,iban:'NL00ABNA0417164300',referentie:'m012-iban'}))
    ]).then(r=>{console.log(JSON.stringify(r));}).catch(e=>{console.error(e);process.exit(8)});`;
  const r = kind(code, { SEPA_SANDBOX: '1' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const [nul, ongeldig] = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(nul.nv, true, 'een ongeldig bedrag gaat niet de deur uit');
  assert.equal(ongeldig.code, 'IBAN_ONGELDIG');
  assert.equal(ongeldig.nv, true, 'een IBAN dat de sandbox weigert gaat niet de deur uit');
});

test('server/betaal.js merkt ook "geen rail" als nietVerstuurd', () => {
  const code = `
    const b=require('./server/betaal');
    b.maakUitbetaling({bedrag:100,iban:'NL91ABNA0417164300',referentie:'m012-geenrail'})
      .then(()=>{console.log(JSON.stringify({code:'geen fout'}));},
            e=>{console.log(JSON.stringify({code:e.code||e.message,nv:e.nietVerstuurd===true}));});`;
  const r = kind(code, {});
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const uit = JSON.parse(r.stdout.trim().split('\n').pop());
  if (uit.code === 'geen fout') return;   // deze omgeving heeft toch een rail: dan valt er niets te merken
  assert.equal(uit.nv, true, 'zonder rail gaat er niets de deur uit: ' + uit.code);
});

/* DE AFSTEMMING (kern/betaalopdracht/afstemming.js): ONBEKEND is een tussenstand.
   Drie uitkomsten, en alleen met bewijs dat niet uit de invoer van een formulier
   komt. */
async function onbekendeOpdracht(volgorde = ['kwijt', 'dicht', 'dicht']) {
  const run = await loop(volgorde);
  assert.equal(run.w.op.vind(run.id).status, 'ONBEKEND');
  return run;
}
const uitspraak = (run, extra) => Object.assign({ id: run.id, uitspraak: 'uitgevoerd',
  providerRef: run.rail.uitgevoerd.get(basis.idemSleutel) || 'po_x', centen: basis.centen, valuta: 'eur',
  bron: 'afschrift 24-09', echtheid: 'OVERGENOMEN' }, extra || {});

test('afstemming BEVESTIGD: de rail noemt dit bedrag, de opdracht is afgewikkeld zonder teruggang', async () => {
  const run = await onbekendeOpdracht();
  const r = await run.w.op.stemAf(uitspraak(run));
  assert.equal(r.uitkomst, 'BEVESTIGD');
  assert.equal(run.w.op.vind(run.id).status, 'AFGEWIKKELD');
  assert.equal(run.w.terug.length, 0);
  assert.equal(run.w.op.vind(run.id).uitspraken.at(-1).echtheid, 'OVERGENOMEN', 'de graad staat in het spoor');
});

test('afstemming NIET_UITGEVOERD: het geld komt precies een keer terug', async () => {
  const run = await onbekendeOpdracht(['stil', 'stil', 'stil']);
  const r = await run.w.op.stemAf(uitspraak(run, { uitspraak: 'niet-uitgevoerd', providerRef: null }));
  assert.equal(r.uitkomst, 'NIET_UITGEVOERD');
  assert.equal(run.w.op.vind(run.id).status, 'TERUGGEBOEKT');
  assert.equal(run.w.terug.length, 1);
  const weer = await run.w.op.stemAf(uitspraak(run, { uitspraak: 'niet-uitgevoerd' }));
  assert.equal(weer.status, 409, 'een tweede uitspraak raakt een gesloten opdracht niet');
  assert.equal(run.w.terug.length, 1, 'en boekt niet nog eens terug');
});

test('afstemming VERSCHIL: ander bedrag, dan gebeurt er niets met het geld en ligt er een zaak', async () => {
  const run = await onbekendeOpdracht();
  const r = await run.w.op.stemAf(uitspraak(run, { centen: 12000 }));
  assert.equal(r.uitkomst, 'VERSCHIL');
  const o = run.w.op.vind(run.id);
  assert.equal(o.status, 'ONBEKEND', 'niet afgewikkeld en niet teruggeboekt');
  assert.equal(run.w.terug.length, 0);
  assert.deepEqual(o.verschil.verwacht.centen, 12500);
  assert.deepEqual(o.verschil.gezien.centen, 12000, 'verwacht en gezien staan naast elkaar, niets afgerond');
  assert.equal(run.w.op.openstaand().verschil, 1, 'de zaak telt in de reconciliatie');

  // een latere, kloppende uitspraak sluit hem, en het verschil blijft in het spoor
  const later = await run.w.op.stemAf(uitspraak(run, { bron: 'gecorrigeerd afschrift' }));
  assert.equal(later.uitkomst, 'BEVESTIGD');
  assert.ok(run.w.op.vind(run.id).verschil.opgelostAt, 'het verschil is opgelost en niet gewist');
  assert.equal(run.w.op.openstaand().verschil, 0);
  assert.equal(run.w.op.vind(run.id).uitspraken.length, 2);
});

test('afstemming VERSCHIL ook bij het juiste bedrag in een andere valuta', async () => {
  const run = await onbekendeOpdracht();
  const r = await run.w.op.stemAf(uitspraak(run, { valuta: 'usd' }));
  assert.equal(r.uitkomst, 'VERSCHIL', '12500 dollarcent is geen 12500 eurocent');
  assert.equal(run.w.op.vind(run.id).status, 'ONBEKEND');
});

test('afstemming weigert zonder bewijs, zonder bron, en op een opdracht die niet ONBEKEND is', async () => {
  const run = await onbekendeOpdracht();
  assert.equal((await run.w.op.stemAf(uitspraak(run, { echtheid: 'PROVIDER_ASSERTED' }))).status, 403);
  assert.equal((await run.w.op.stemAf(uitspraak(run, { echtheid: undefined }))).status, 403);
  assert.equal((await run.w.op.stemAf(uitspraak(run, { bron: '' }))).status, 400);
  assert.equal((await run.w.op.stemAf(uitspraak(run, { uitspraak: 'misschien' }))).status, 400);
  assert.equal((await run.w.op.stemAf(uitspraak(run, { providerRef: null }))).status, 400, 'uitgevoerd zonder railreferentie is geen bewijs');
  assert.equal(run.w.op.vind(run.id).status, 'ONBEKEND', 'geen van die weigeringen heeft iets veranderd');

  const ander = await loop(['ok']);
  const r = await ander.w.op.stemAf(uitspraak(ander));
  assert.equal(r.status, 409, 'een aangenomen opdracht sluit via de rail zelf, niet via deze weg');
});
