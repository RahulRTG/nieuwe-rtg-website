/* Het werknemersportaal: komt er een LOONSTROOK uit, van de klok tot het
   scherm van de medewerker?

   WAAROM DEZE TOETS ER IS. De hele loonlaag (regelpakket, motor, run, journaal)
   was in stukken getoetst en elk stuk stond groen -- maar er kwam nooit een
   strook uit, want er was geen enkele manier om een CONTRACT vast te leggen.
   /api/office/payroll/run/open slaat iedereen zonder contract over (terecht: een
   uurloon verzinnen is erger dan een lege run), dus elke run was leeg. Geen
   enkele losse toets kon dat zien; ze leverden hun eigen contract mee.

   Deze toets loopt daarom de HELE keten af, over echte HTTP:
     wervingslink -> RTG-account -> contract -> klok -> loonrun -> vier ogen
     -> definitief -> /api/member/loonstroken
   en eist aan het eind een bedrag met een uitleg erbij.

   TWEE DINGEN DIE DE OPZET BEPALEN, en allebei zijn het regels en geen hindernis:

   1. DE UREN KOMEN UIT DE KLOK VAN DE ZAAK, niet uit het verzoek. Een toets kan
      dus geen uren meesturen. Daarom draait de server twee keer: een keer om te
      werven, dan zetten we diensten in db.json zoals de klok ze schrijft, en dan
      pas de loonrun. Omslachtig, maar het alternatief is een achterdeur in
      run/open -- en die zou in productie ook openstaan.
   2. DE ZAAK MOET IN NEDERLAND STAAN. De run vraagt het regelpakket van het land
      van de zaak, en er ligt alleen een NL-jaargang. Vandaar Meridiaan Toren en
      niet een van de tweeenzeventig Spaanse demo-zaken: die kunnen tot er een
      ES-jaargang ligt geen loonrun draaien, en dat hoort ook zo -- met Nederlandse
      tarieven Spaans loon rekenen is erger dan niet rekenen.

   De mutatie die hem hoort te laten zakken: haal
   /api/supplier/payroll/contract uit server/routes/payroll-os-zaak.js. Dan is
   de run weer leeg en heeft de medewerker geen strook.

   Draai los: node --experimental-sqlite --test test/loonstrook-portaal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, stopNet } = require('./helper');

const KANTOOR = 'KANTOOR-LOONSTROOK-1';
const ZAAK = 'MERIDIAAN';   // Meridiaan Toren, de NL-zaak in de demo
const MANAGER = 99;          // Evi van Dalen, gebouwmanager
const PERIODE = '2026-03';

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, data: await r.json() };
}

/* Diensten zoals /api/staff/clock ze wegschrijft: een rij per zaak, met een in
   en een out in ISO. Twintig dagen van acht uur in maart 2026. */
function diensten(staffId, naam) {
  const rijen = [];
  for (let d = 2; d <= 21; d++) {
    const dag = PERIODE + '-' + String(d).padStart(2, '0');
    rijen.push({ id: 'proef' + d, staffId, name: naam,
      in: dag + 'T09:00:00.000Z', out: dag + 'T17:00:00.000Z' });
  }
  return rijen;
}

test('van de wervingslink tot de loonstrook van de medewerker', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-loonstrook-'));
  /* RTG_STORE=json, want deze toets moet TUSSEN twee starts de klok kunnen
     vullen. Een verse installatie kiest anders sqlite (db/keuze.js) en dan is
     er geen db.json om in te schrijven. Het is dezelfde db.data die alle routes
     gebruiken; alleen de motor eronder verschilt. */
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: KANTOOR, RTG_STORE: 'json' };
  try {
    /* ---- ronde 1: iemand komt binnen via de wervingslink ---- */
    let s = await startServer({ env });
    let zaakTok = (await post(s.base, '/api/supplier/login',
      { code: ZAAK, staffId: MANAGER, pin: '1234' })).data.token;
    assert.ok(zaakTok, 'manager-sessie bij de zaak');

    const invite = await post(s.base, '/api/supplier/staff/invite',
      { name: 'Timo Vos', role: 'staff', func: 'Receptie' }, zaakTok);
    assert.equal(invite.status, 200, JSON.stringify(invite.data));

    const reg = await post(s.base, '/api/auth/register', { name: 'Timo Vos', email: 'timo@rtg.example',
      phone: '0612345001', password: 'geheim123', geboortedatum: '1995-05-05', tier: 'rtg' });
    assert.ok(reg.data.token, 'het gratis RTG-account is er');
    const verbind = await post(s.base, '/api/werving/verbind',
      { kassacode: invite.data.invite.kassacode }, reg.data.token);
    assert.equal(verbind.status, 200, JSON.stringify(verbind.data));
    const staffId = verbind.data.staffId;
    /* stopNet en niet stop: stop() is SIGKILL en dan spoelt de write-behind van
       de json-opslag zijn laatste staat niet weg -- we lezen db.json hierna van
       schijf en schrijven hem terug, dus alles wat nog in de wachtrij stond
       zouden we overschrijven met een oudere stand. */
    await stopNet(s.child);

    /* ---- de klok vullen, zoals de vloer hem zou hebben gevuld ---- */
    const dbPad = path.join(TMP, 'db.json');
    const db = JSON.parse(fs.readFileSync(dbPad, 'utf8'));
    db.klok = db.klok || {};
    db.klok[ZAAK] = diensten(staffId, 'Timo Vos').concat(db.klok[ZAAK] || []);
    fs.writeFileSync(dbPad, JSON.stringify(db));

    /* ---- ronde 2: contract, loonrun, vier ogen, definitief ---- */
    s = await startServer({ env });
    const base = s.base;

    // het kantoor merkt de jaargang aan; zonder dat mag er geen definitieve run op
    const kantoor = (await post(base, '/api/office/login', { code: KANTOOR })).data.token;
    assert.ok(kantoor, 'kantoorsessie');
    const regels = (await post(base, '/api/office/payroll/regels', { land: 'NL' }, kantoor)).data;
    const pakket = (regels.pakketten || []).find(p => p.geldigVan <= PERIODE + '-01' &&
      (!p.geldigTot || p.geldigTot >= PERIODE + '-01'));
    assert.ok(pakket, 'er ligt een regelpakket dat geldt in ' + PERIODE);
    assert.equal((await post(base, '/api/office/payroll/regels/keur',
      { land: 'NL', versie: pakket.versie }, kantoor)).data.stand, 'goedgekeurd');

    // de werkgever legt het contract vast -- de stap die ontbrak
    zaakTok = (await post(base, '/api/supplier/login',
      { code: ZAAK, staffId: MANAGER, pin: '1234' })).data.token;
    const contract = await post(base, '/api/supplier/payroll/contract', {
      staffId, vanaf: '2026-01-01', soort: 'vast', uurloonCenten: 1800, urenPerWeek: 32
    }, zaakTok);
    assert.equal(contract.status, 200, 'het contract is vastgelegd: ' + JSON.stringify(contract.data));

    // het kantoor draait de run over de gemeten uren
    const open = await post(base, '/api/office/payroll/run/open', { code: ZAAK, periode: PERIODE }, kantoor);
    assert.equal(open.status, 200, JSON.stringify(open.data));
    const runId = open.data.run.id;
    // open() geeft een samenvatting terug (zonder stroken); de run zelf staat achter run/een
    const vol = (await post(base, '/api/office/payroll/run/een', { runId }, kantoor)).data;
    const mijn = vol.run.stroken.find(x => x.staffId === staffId);
    assert.ok(mijn, 'de medewerker met een contract staat in de run');
    /* 20 diensten van 8 uur zijn 160 uur, en die worden GEWOGEN: bij een
       contract van 32 uur per week ligt de drempel op 32 x 4,33 = 138,6 uur, de
       rest zijn overuren met hun eigen tarief. Vandaar de optelling en niet een
       vast getal -- de splitsing is juist het werk dat we willen zien. */
    const uren = mijn.strook.regels
      .filter(r => ['gewerkte_uren', 'overuren_125'].includes(r.component))
      .reduce((s, r) => s + r.aantal, 0);
    assert.equal(Math.round(uren), 160, '20 diensten van 8 uur zijn samen 160 uur');
    assert.ok(mijn.strook.regels.some(r => r.component === 'overuren_125'),
      'wat boven de contracturen uitkomt staat als overuren op de strook, niet als gewoon loon');

    // vier ogen: de manager bij de zaak, de administrateur bij het kantoor
    assert.equal((await post(base, '/api/supplier/payroll/keur', { runId }, zaakTok)).status, 200);
    assert.equal((await post(base, '/api/office/payroll/run/keur', { runId }, kantoor)).status, 200);
    const def = await post(base, '/api/office/payroll/run/definitief', { runId }, kantoor);
    assert.equal(def.status, 200, 'definitief: ' + JSON.stringify(def.data));

    /* ---- de drie uitgangen, en of ze hetzelfde zeggen ----
       Boeking, betaalbestand en aangifte komen uit dezelfde run. Lopen ze
       uiteen, dan boekt de werkgever iets anders dan hij betaalt en geeft hij
       weer iets anders aan -- en dat komt pas boven bij een controle. */
    const journaal = await post(base, '/api/office/payroll/journaal', { runId }, kantoor);
    assert.equal(journaal.status, 200, JSON.stringify(journaal.data));
    assert.equal(journaal.data.somDebet, journaal.data.somCredit, 'de boeking telt op tot nul');

    const aan = await post(base, '/api/office/payroll/aangifte', { runId }, kantoor);
    assert.equal(aan.status, 200, JSON.stringify(aan.data));
    assert.equal(aan.data.aangifte.nominatief.length, 1, 'een nominatieve regel per werknemer');
    const sluit = await post(base, '/api/office/payroll/aangifte/aansluiting',
      { id: aan.data.aangifte.id }, kantoor);
    assert.equal(sluit.status, 200, 'aangifte en loonjournaal sluiten aan: ' + JSON.stringify(sluit.data));
    assert.equal(sluit.data.loonheffingCenten, aan.data.aangifte.totalen.ingehoudenLoonheffing);

    // indienen zonder kenmerk mag niet; met kenmerk wordt het vastgelegd
    assert.equal((await post(base, '/api/office/payroll/aangifte/indienen',
      { id: aan.data.aangifte.id, kenmerk: '' }, kantoor)).status, 400);
    const ingediend = await post(base, '/api/office/payroll/aangifte/indienen',
      { id: aan.data.aangifte.id, kenmerk: 'BD-2026-03-0001' }, kantoor);
    assert.equal(ingediend.status, 200, JSON.stringify(ingediend.data));
    assert.equal(ingediend.data.aangifte.stand, 'ingediend');

    // en de werkgever ziet hem, maar dient hem niet in
    const bijZaak = await post(base, '/api/supplier/payroll/aangiftes', { periode: PERIODE }, zaakTok);
    assert.equal(bijZaak.status, 200);
    assert.equal(bijZaak.data.aangiftes.length, 1, 'de werkgever ziet wat er namens hem is aangegeven');
    assert.equal(bijZaak.data.aangiftes[0].kenmerk, 'BD-2026-03-0001');

    /* ---- en dan: ziet de medewerker het? ---- */
    const lid = (await post(base, '/api/auth/login',
      { login: 'timo@rtg.example', password: 'geheim123' })).data;
    assert.ok(lid.token, 'de medewerker logt in met zijn eigen RTG-account');
    const portaal = await post(base, '/api/member/loonstroken', {}, lid.token);
    assert.equal(portaal.status, 200, JSON.stringify(portaal.data));
    const strook = (portaal.data.stroken || []).find(x => x.periode === PERIODE);
    assert.ok(strook, 'zijn loonstrook over ' + PERIODE + ' staat in zijn portaal');
    assert.notEqual(strook.zaak, ZAAK, 'de zaak staat op naam en niet als code');
    assert.ok(strook.strook.nettoCenten > 0, 'er staat een nettobedrag');

    /* De uitleg is het punt van dit scherm: een strook die alleen bedragen
       toont laat mensen raden. Hij hoort de uren te noemen waar het bedrag uit
       komt, in gewone taal. */
    assert.match(strook.uitleg, /\d[\d,.]* gewerkte uren/, 'de uitleg noemt waar het bedrag vandaan komt');
    assert.match(strook.uitleg, /overuren/i, 'en noemt het onderdeel dat deze periode anders maakt');
    assert.match(strook.uitleg, /loonheffing/i, 'en wat eraf gaat');

    /* ---- de vier vragen, over echte HTTP ----
       De afgesproken maatstaf: iedere euro moet kunnen zeggen waarom hij is
       berekend, met welke regel en versie, wie tekende, en waar hij daarna
       heen ging. Hier is de betaling nog niet gemaakt, dus het dossier hoort
       NIET volledig te zijn -- en dat eerlijk te zeggen. */
    const dosOpen = await post(base, '/api/office/payroll/dossier', { runId, staffId }, kantoor);
    assert.equal(dosOpen.status, 200, JSON.stringify(dosOpen.data));
    assert.equal(dosOpen.data.antwoorden.waarheen.betaald.stand, 'open',
      'er is nog geen betaalbestand, en dat staat er als open');
    assert.equal(dosOpen.data.volledig, false, 'dus het dossier is nog niet volledig');

    const betaal = await post(base, '/api/office/payroll/betaalbestand',
      { runId, rekeningen: { [staffId]: 'NL91ABNA0417164300' } }, kantoor);
    assert.equal(betaal.status, 200, JSON.stringify(betaal.data));

    const dos = await post(base, '/api/office/payroll/dossier', { runId, staffId }, kantoor);
    assert.equal(dos.data.volledig, true, 'nu wel: ' + JSON.stringify(dos.data.antwoorden.waarheen));
    for (const vraag of ['waarom', 'welkeRegel', 'wieKeurde', 'waarheen'])
      assert.equal(dos.data.antwoorden[vraag].stand, 'beantwoord', vraag + ' is beantwoord');
    assert.equal(dos.data.antwoorden.welkeRegel.goedgekeurdDoor != null, true,
      'met de naam van wie het regelpakket aanmerkte');

    // en de medewerker kan diezelfde vier vragen over zijn EIGEN bedrag stellen
    const mijnDos = await post(base, '/api/member/dossier', { runId }, lid.token);
    assert.equal(mijnDos.status, 200, JSON.stringify(mijnDos.data));
    assert.equal(mijnDos.data.medewerker.staffId, staffId);
    assert.equal(mijnDos.data.volledig, true);

    // en niet over die van een ander: een vreemde run levert niets
    const vreemd = await post(base, '/api/member/dossier', { runId: 'run_bestaatniet' }, lid.token);
    assert.equal(vreemd.status, 404, 'andermans dossier is geen kwestie van een ander getal invullen');

    // en het inzagespoor van de andere kant: leeg, maar de route antwoordt
    const spoor = await post(base, '/api/member/identiteit/verzoeken', {}, lid.token);
    assert.equal(spoor.status, 200);
    assert.deepEqual(spoor.data.verzoeken, [], 'niemand vroeg zijn papieren op');

    await stop(s.child);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
