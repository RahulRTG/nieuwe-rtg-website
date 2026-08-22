/* ============================================================================
   DE BESTUURSROUTES VAN RTG COMMAND -- beleid, simulatie, journaal, toezicht.

   WAAROM DIT BESTAND ER IS. De motortoetsen (test/zaakcommand.test.js en de
   toetsen per laag) rekenen aan de kern met nagemaakte gegevens. Die kunnen
   allemaal groen staan terwijl er over HTTP niets bereikbaar is. Dat was hier
   geen theorie: de waargenomen dekking wees drieendertig routes aan die tijdens
   de hele suite geen enkele keer zijn aangeroepen, en op precies zo'n route
   stond een 500 te wachten (server/routes/staff/inzetbaarheid.js).

   EN HET IS GEEN AANRAAKTOETS. Elke bewering hieronder gaat over gedrag dat mis
   kan gaan: dat een vier-ogen-regel NIET verandert door hem te zetten, dat
   dezelfde actor zijn eigen voorstel niet mag goedkeuren, dat een simulatie
   niets aanraakt, dat een ingetrokken recht ook echt weg is. Een route die
   antwoordt met 200 bewijst niets; een route die het juiste weigert wel.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de vierOgen-tak uit kern/command/beleid.js zet() gehaald
     -> "een vier-ogen-regel verandert niet van een enkel verzoek" ZAKT (RAAK)
   - de gelijke-actor-controle uit keur() gehaald
     -> "wie voorstelt, keurt niet" ZAKT (RAAK)
   - trekIn() laten teruggeven zonder het recht te sluiten
     -> "een ingetrokken recht staat niet meer in de graaf" ZAKT (RAAK)

   Draai los: node --test test/command-routes-bestuur.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cmdbestuur-'));
const CODE = 'KANTOOR-CMDBESTUUR-1';
let srv, base, office;

const api = (pad, body) => fetch(base + '/api/command/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, wat) {
  const r = await api(pad, body);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  const l = await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE })
  })).json();
  office = l.token;
  assert.ok(office, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. het beginscherm komt in een keer: start, puls, werk en zoek antwoorden', async () => {
  const s = await moet('start', {}, 'het beginscherm');
  assert.ok(s && typeof s === 'object', 'start geeft een beeld terug');
  const p = await moet('puls', {}, 'de puls');
  assert.ok(p && typeof p === 'object', 'de puls geeft een beeld terug');
  const w = await moet('werk', { dagen: 30 }, 'het werkbord');
  assert.ok(w.bord && typeof w.bord.automatiseringsgraad === 'number', 'het bord telt handwerk');

  /* Het bereik hoort ALTIJD mee, ook bij nul treffers: anders is "niets
     gevonden" niet te onderscheiden van "er is niet gezocht". */
  const leeg = await moet('zoek', { q: 'zzzzgeenenkeletreffer' }, 'zoeken zonder treffer');
  assert.equal(leeg.totaal, 0, 'geen treffers op onzin');
  assert.ok(Array.isArray(leeg.bereik) && leeg.bereik.length > 0, 'het bereik staat er ook bij nul treffers bij');
});

test('2. een vier-ogen-regel verandert NIET van een enkel verzoek', async () => {
  const stand = await moet('beleid', {}, 'het beleidsregister');
  const regel = (stand.regels || []).find(r => r.vierOgen);
  assert.ok(regel, 'er is een regel met vier ogen');

  const uit = await moet('beleid/zet', { id: regel.id, waarde: regel.waarde, reden: 'de routetoets' },
    'een vier-ogen-regel zetten');
  assert.equal(uit.vierOgen, true, 'het antwoord zegt dat er een tweede paar ogen nodig is');
  assert.equal(uit.voorstel.status, 'wacht', 'er ligt een voorstel en geen wijziging');

  const na = await moet('beleid', {}, 'het register opnieuw');
  const nu = na.regels.find(r => r.id === regel.id);
  assert.equal(nu.versie, regel.versie, 'de regel staat nog op dezelfde versie');
  assert.ok(na.open >= 1, 'het voorstel telt mee als openstaand');
});

test('3. wie voorstelt, keurt niet: dezelfde actor krijgt nee', async () => {
  /* De gedeelde kantoorcode geeft iedereen dezelfde actornaam. Dat is met opzet
     zo (zie routes/command/index.js) en het maakt deze toets scherp: hij kan
     niet per ongeluk slagen doordat er twee namen in het spel zijn. */
  const stand = await moet('beleid', {}, 'het register');
  const voorstel = (stand.voorstellen || []).find(v => v.status === 'wacht');
  assert.ok(voorstel, 'er staat een voorstel open');
  const r = await api('beleid/keur', { voorstel: voorstel.id, akkoord: true, reden: 'zelf' });
  assert.notEqual(r.status, 200, 'de indiener mag zijn eigen voorstel niet goedkeuren');
  assert.match(String(r.body.error || ''), /ogen|zelf|ander/i, 'en zegt waarom: ' + r.body.error);
});

test('4. geschiedenis en terugzetten zeggen de waarheid over wat er ligt', async () => {
  const stand = await moet('beleid', {}, 'het register');
  const regel = stand.regels[0];
  const g = await moet('beleid/geschiedenis', { id: regel.id }, 'de geschiedenis');
  assert.equal(g.id, regel.id);
  assert.ok(Array.isArray(g.versies) && g.versies.length >= 1, 'er staat minstens de startwaarde in');

  /* Terugzetten terwijl er niets is om naar terug te gaan, hoort een nette
     weigering te zijn en geen stille nul. */
  const t = await api('beleid/terug', { id: regel.id, reden: 'de routetoets' });
  assert.equal(t.status, 409, 'terug zonder eerdere versie is een conflict');
  assert.match(String(t.body.error || ''), /eerdere versie/i, t.body.error);

  const onbekend = await api('beleid/geschiedenis', { id: 'bestaat.niet' });
  assert.equal(onbekend.status, 404, 'een onbekende regel is 404 en geen leeg antwoord');
});

test('5. de simulaties raken niets aan', async () => {
  const voor = (await moet('beleid', {}, 'het register')).regels[0];
  const proef = await moet('simulatie/beleid', { id: voor.id, waarde: Number(voor.waarde) + 5 },
    'de beleidsproef');
  assert.equal(proef.regel, voor.id);
  assert.ok('gevolg' in proef, 'de proef zegt wat de waarde met de routering doet');

  const watals = await moet('simulatie/watals', { groei: 10 }, 'de groeiproef');
  assert.ok(Array.isArray(watals.regels) && watals.aannames.length > 0,
    'de tweeling noemt zijn eigen aannames');

  const na = (await moet('beleid', {}, 'het register')).regels.find(r => r.id === voor.id);
  assert.equal(na.waarde, voor.waarde, 'de echte regel is niet meebewogen met de proef');
});

test('6. het journaal is een keten, en herbeleven laat zien wat we net deden', async () => {
  const j = await moet('journaal', { n: 20 }, 'het journaal');
  assert.ok(j.aantal > 0, 'er staat iets in');
  assert.equal(j.keten.heel, true, 'de ketencontrole gaat op: ' + JSON.stringify(j.keten));

  const h = await moet('journaal/herbeleef', { van: '2000-01-01', tot: '2099-01-01' }, 'de herbeleving');
  assert.ok(h.stappen > 0 && Array.isArray(h.lijn), 'de reconstructie heeft stappen');
  assert.ok(h.lijn.some(x => /beleid/.test(x.actie)),
    'het beleidsvoorstel van toets 2 staat in de lijn');
});

test('7. een object opvragen: onbekende soort is 404, een bestaande zaak opent', async () => {
  const onzin = await api('object', { type: 'ditbestaatniet', id: 'x' });
  assert.equal(onzin.status, 404, 'een onbekende soort is een nette 404');

  const gevonden = await moet('zoek', { q: 'KIKUNOI' }, 'zoeken op een zaak uit de seed');
  const groep = (gevonden.groepen || []).find(g => (g.rijen || []).length);
  assert.ok(groep, 'de zoekbalk vindt de seed-zaak');
  const treffer = groep.rijen[0];
  const dossier = await moet('object', { type: groep.type, id: treffer.id }, 'het dossier');
  assert.ok(dossier && typeof dossier === 'object', 'het dossier komt terug');
});

test('8. de rechtengraaf: geven, breken en intrekken zijn alle drie zichtbaar', async () => {
  const graaf = await moet('rechten', {}, 'de rechtengraaf');
  assert.ok(graaf.soorten.length > 0 && graaf.actief.length === 0,
    'de rusttoestand is: geen enkel zwaar recht open');
  const soort = graaf.soorten[0].id;

  const gegeven = await moet('recht/geef', { recht: soort, aan: 'een collega', minuten: 15,
    reden: 'de routetoets geeft het tijdelijk weg' }, 'een recht tijdelijk geven');
  const gid = gegeven.id || (gegeven.recht && gegeven.recht.id);
  assert.ok(gid, 'het gegeven recht heeft een id: ' + JSON.stringify(gegeven).slice(0, 200));
  const metRecht = await moet('rechten', {}, 'de graaf met een open recht');
  assert.ok(metRecht.actief.some(a => a.id === gid), 'het staat in de graaf, van wie en waarom');
  await moet('recht/introk', { id: gid, reden: 'de routetoets ruimt het meteen op' }, 'intrekken');

  const kaal = await api('recht/nood', { recht: soort, reden: 'kort' });
  assert.notEqual(kaal.status, 200, 'de nooddeur eist een volledige reden');

  const nood = await moet('recht/nood', { recht: soort,
    reden: 'De routetoets breekt het glas om te bewijzen dat dit in het journaal komt.' },
  'het glas breken');
  const id = nood.id || (nood.recht && nood.recht.id) || nood.toekenning;
  assert.ok(id, 'de nooddeur geeft een id terug: ' + JSON.stringify(nood).slice(0, 200));

  const open = await moet('rechten', {}, 'de graaf na de nooddeur');
  assert.ok(open.nood >= 1, 'de graaf telt de nooddeur apart');

  await moet('recht/introk', { id, reden: 'de routetoets ruimt op' }, 'intrekken');
  const dicht = await moet('rechten', {}, 'de graaf na intrekken');
  assert.equal(dicht.actief.filter(a => a.id === id).length, 0, 'het ingetrokken recht is weg');
});

test('9. een mandaat zonder einddatum is geen mandaat', async () => {
  const zonder = await api('mandaat', { van: 'a', aan: 'b', terrein: 'command', reden: 'de routetoets' });
  assert.equal(zonder.status, 400, 'zonder tot-datum wordt het geweigerd');
  assert.match(String(zonder.body.error || ''), /einddatum|overdracht/i, zonder.body.error);

  const tot = new Date(Date.now() + 3600 * 1000).toISOString();
  const met = await moet('mandaat', { van: 'a', aan: 'b', terrein: 'command', tot,
    reden: 'de routetoets legt een tijdelijk mandaat neer' }, 'een mandaat met einddatum');
  assert.ok(met && typeof met === 'object', 'het mandaat komt terug');
});

test('10. het agent-toezicht: stoppen, grenzen zetten en hervatten', async () => {
  const naam = 'toetsagent';
  const gestopt = await moet('agent/stop', { naam, reden: 'de routetoets stopt hem' }, 'stoppen');
  assert.equal(gestopt.gestopt, true, 'de agent staat stil');

  const grens = await moet('agent/rechten', { naam, mag: ['rit-vast-hervatten'],
    reden: 'de routetoets bakent af' }, 'grenzen zetten');
  assert.deepEqual(grens.mag, ['rit-vast-hervatten'], 'de bevoegdheid staat er precies zo');

  const lijst = await moet('agents', {}, 'de agentlijst');
  assert.ok(lijst.agents.some(a => a.naam === naam), 'de agent staat in de lijst');

  const hervat = await moet('agent/hervat', { naam, reden: 'de routetoets zet hem weer aan' }, 'hervatten');
  assert.equal(hervat.gestopt, false, 'de agent loopt weer');
});
