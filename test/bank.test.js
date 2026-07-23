/* RTG Bank: de eigen bank op het RTG Pay-grootboek, met de 3-standen knop van de
   boardroom (partner -> hybride -> eigen). Getest: de leden-bank die pas open gaat
   als de boardroom hem live zet + akkoord (opt-in) die de eerste rekening opent;
   een geldig IBAN; storten dat langs de knop clearet; de vier-ogen-autorisatie op
   het opschalen; de nood-fallback (noodstop en automatisch); sparen met rente; de
   wallet-brug; passen, krediet, incasso, zakelijk en de AI-bankier; en de
   sluitcontrole die na alles nog klopt.
   Draai los: node --experimental-sqlite --test test/bank.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bank-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
// kantoor-aanroep (/api/office/...) met een naam erbij (voor de vier-ogen: aanvrager vs bevestiger)
const oapi = (pad, body, nm) => api('office/' + pad, { ...(body || {}), naam: nm || 'boardroom' }, office.token);

function ibanGeldig(iban) {
  const her = iban.slice(4) + iban.slice(0, 4);
  const num = her.replace(/[A-Z]/g, ch => ch.charCodeAt(0) - 55);
  let rest = 0; for (const dgt of num) rest = (rest * 10 + Number(dgt)) % 97;
  return rest === 1;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-BANK-1' } });
  base = srv.base;
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  const ov = await api('bank/overzicht', {}, l.token);
  lid = { token: l.token };
  assert.equal(ov.status, 200, 'het lid ziet zijn bankoverzicht (ook als de bank nog dicht is)');
  const o = await (await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KANTOOR-BANK-1' }) })).json();
  office = { token: o.token };
  assert.ok(office.token, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

// zet de bank in de eigen-stand via de vier-ogen-flow (aanvraag + bevestiging)
async function naarEigen() {
  let r = await oapi('bank/draai', {}, 'Aïsha');            // partner -> (auth) hybride
  if (r.body.needsAuth) await oapi('bank/autoriseer/bevestig', { id: r.body.autorisatie.id }, 'Bram');
  r = await oapi('bank/draai', {}, 'Aïsha');                // hybride -> (auth) eigen
  if (r.body.needsAuth) await oapi('bank/autoriseer/bevestig', { id: r.body.autorisatie.id }, 'Bram');
}
async function naarPartner() { await oapi('bank/modus', { modus: 'partner' }, 'Aïsha'); } // afschalen mag direct

test('leden-bank: dicht tot de boardroom hem live zet; akkoord (opt-in) opent de eerste rekening', async () => {
  const dicht = await api('bank/overzicht', {}, lid.token);
  assert.equal(dicht.body.online, false, 'zolang de bank dicht is: online=false');
  assert.equal((await api('bank/rekening/open', { soort: 'betaal' }, lid.token)).status, 403, 'acties zijn geweigerd zolang de bank dicht is');
  assert.equal((await oapi('bank/leden', { aan: true }, 'RTG')).body.ledenAan, true, 'de boardroom zet de leden-bank live');
  const akk = await api('bank/akkoord', {}, lid.token);
  assert.equal(akk.status, 200);
  assert.ok(/^NL\d{2}RTGB\d{10}$/.test(akk.body.rekening.iban), 'akkoord opent meteen een betaalrekening');
  const ov = await api('bank/overzicht', {}, lid.token);
  assert.equal(ov.body.online, true); assert.equal(ov.body.akkoord, true);
  assert.ok(ov.body.rekeningen.length >= 1, 'de rekening staat in het overzicht');
});

test('een rekening openen levert een geldig IBAN; storten clearet in partner-stand via de kaart', async () => {
  const open = await api('bank/rekening/open', { soort: 'betaal', naam: 'Dagelijks' }, lid.token);
  assert.equal(open.status, 200);
  const iban = open.body.rekening.iban;
  assert.ok(/^NL\d{2}RTGB\d{10}$/.test(iban) && ibanGeldig(iban), 'geldig IBAN (mod-97, RTG-bankcode)');
  const stort = await api('bank/storten', { iban, centen: 5000, idem: 's1' }, lid.token);
  assert.equal(stort.body.via, 'kaart', 'in partner-stand loopt storten via de kaart-naad');
  assert.equal(stort.body.saldoCenten, 5000);
  assert.equal((await api('bank/storten', { iban, centen: 5000, idem: 's1' }, lid.token)).body.herhaald, true, 'dubbeltik boekt niet dubbel');
  lid.iban = iban;
});

test('de knop schakelt via VIER OGEN op het opschalen; afschalen mag direct', async () => {
  const aanvraag = await oapi('bank/draai', {}, 'Aïsha');
  assert.equal(aanvraag.body.needsAuth, true, 'opschalen wacht op een tweede persoon');
  const id = aanvraag.body.autorisatie.id;
  assert.equal((await oapi('bank/autoriseer/bevestig', { id }, 'Aïsha')).status, 403, 'dezelfde persoon mag niet bevestigen');
  const bevest = await oapi('bank/autoriseer/bevestig', { id }, 'Bram');
  assert.equal(bevest.body.operationeel, true);
  assert.equal(bevest.body.modus, 'hybride', 'na bevestiging staat de knop een slag verder');
  await naarEigen(); // door naar eigen
  const stort = await api('bank/storten', { iban: lid.iban, centen: 10000, idem: 's2' }, lid.token);
  assert.equal(stort.body.via, 'eigen', 'in de eigen-stand emitteert de bank zelf');
  assert.equal((await oapi('bank/modus', { modus: 'partner' }, 'Aïsha')).body.modus, 'partner', 'terug naar partner mag direct (afschalen)');
});

test('nood-fallback: noodstop laat alles weer via de kaart clearen; drie mislukkingen tript automatisch', async () => {
  await naarEigen();
  assert.equal((await oapi('bank/nood', { reden: 'test' }, 'RTG')).body.nood.actief, true, 'noodstop gezet');
  const iban = (await api('bank/rekening/open', { soort: 'betaal' }, lid.token)).body.rekening.iban;
  const stort = await api('bank/storten', { iban, centen: 4000, idem: 'n1' }, lid.token);
  assert.equal(stort.body.via, 'kaart', 'in nood clearet zelfs de eigen-stand via de kaart-rails');
  assert.equal((await oapi('bank/herstel', {}, 'RTG')).body.nood.actief, false, 'herstel wist de nood');
  // automatisch: drie mislukte clearings melden -> nood
  await oapi('bank/mislukking', {}, 'monitor'); await oapi('bank/mislukking', {}, 'monitor');
  const derde = await oapi('bank/mislukking', {}, 'monitor');
  assert.equal(derde.body.nood, true, 'na drie mislukkingen staat de bank automatisch in nood');
  await oapi('bank/herstel', {}, 'RTG');
  await naarPartner();
});

async function nieuweRekening(soort, centen) {
  const iban = (await api('bank/rekening/open', { soort }, lid.token)).body.rekening.iban;
  if (centen) await api('bank/storten', { iban, centen, idem: 'f' + iban }, lid.token);
  return iban;
}

test('sparen met rente: 1,5% per jaar wordt als echte boeking bijgeschreven', async () => {
  const spaar = await nieuweRekening('spaar', 100000);
  const ronde = await oapi('bank/rente', { dagen: 365 }, 'RTG');
  assert.equal(ronde.body.bijgeschrevenCenten, 1500, '1,5% van 1000 euro = 15 euro');
  assert.equal((await api('bank/rekening', { iban: spaar }, lid.token)).body.rekening.saldoCenten, 101500);
});

test('de brug met RTG Pay: van de wallet naar de bank, beide grootboeken blijven sluiten', async () => {
  await api('pay/oplaad', { centen: 3000, idem: 'w1' }, lid.token);
  const brug = await api('bank/van-wallet', { iban: lid.iban, centen: 2000 }, lid.token);
  assert.equal(brug.status, 200);
  assert.equal((await oapi('bank/gezond', {}, 'RTG')).body.sluit.klopt, true, 'de som van alle bank-saldi is nul');
});

test('interne overboeking + het kantoor ziet de bank met de nieuwe regie-velden', async () => {
  const naar = await nieuweRekening('zakelijk', 0);
  assert.equal((await api('bank/overboek', { vanIban: lid.iban, naarIban: naar, centen: 3000 }, lid.token)).status, 200);
  const o = await oapi('bank', {}, 'RTG');
  assert.equal(o.body.regie.modi.length, 3);
  assert.equal(o.body.regie.ledenAan, true, 'de leden-bank staat live in het bord');
  assert.equal(o.body.gezondheid.sluit.klopt, true);
  assert.equal((await fetch(base + '/api/office/bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'zonder inlog dicht');
});

test('passen: uitgeven, betalen binnen de daglimiet, en bevriezen blokkeert', async () => {
  const iban = await nieuweRekening('betaal', 50000);
  const pas = (await api('bank/pas/uitgeven', { iban, soort: 'debit' }, lid.token)).body.pas;
  assert.ok(/•••• •••• •••• \d{4}/.test(pas.nummer), 'de pas toont alleen gemaskeerd');
  assert.equal((await api('bank/pas/betaal', { id: pas.id, centen: 3000 }, lid.token)).body.saldoCenten, 47000);
  await api('bank/pas/limiet', { id: pas.id, euro: 10 }, lid.token);
  assert.equal((await api('bank/pas/betaal', { id: pas.id, centen: 2000 }, lid.token)).status, 429, 'boven de daglimiet weigert de pas');
  await api('bank/pas/bevries', { id: pas.id, aan: true }, lid.token);
  assert.equal((await api('bank/pas/betaal', { id: pas.id, centen: 100 }, lid.token)).status, 423, 'een bevroren pas betaalt niet');
});

test('krediet: het lid vraagt aan, het kantoor keurt goed en stort, het lid lost af', async () => {
  const iban = await nieuweRekening('betaal', 0);
  const id = (await api('bank/krediet/aanvraag', { iban, euro: 5000, looptijdMnd: 24 }, lid.token)).body.krediet.id;
  assert.ok((await oapi('bank/krediet', {}, 'RTG')).body.aanvragen.some(k => k.id === id), 'de aanvraag staat op het kantoorbord');
  assert.equal((await oapi('bank/krediet/besluit', { id, akkoord: true }, 'RTG')).body.krediet.status, 'goedgekeurd');
  assert.equal((await api('bank/rekening', { iban }, lid.token)).body.rekening.saldoCenten, 500000, 'de hoofdsom staat op de rekening');
  assert.equal((await api('bank/krediet/aflossing', { id, centen: 100000 }, lid.token)).body.krediet.restCenten, 400000);
});

test('terugkerende betaling + incassoronde, en een zakelijke bulkbetaling', async () => {
  const van = await nieuweRekening('betaal', 60000);
  const naar = await nieuweRekening('spaar', 0);
  await api('bank/terugkerend/zet', { vanIban: van, naarIban: naar, centen: 10000, interval: 'maand', oms: 'Sparen' }, lid.token);
  assert.ok((await oapi('bank/incasso', { tot: Date.now() + 35 * 86400000 }, 'RTG')).body.uitgevoerd >= 1, 'de incassoronde voert de vaste betaling uit');
  const a = await nieuweRekening('betaal', 0), b = await nieuweRekening('betaal', 0);
  const bulk = await api('bank/bulk', { vanIban: van, posten: [{ naarIban: a, centen: 5000 }, { naarIban: b, centen: 8000 }] }, lid.token);
  assert.equal(bulk.body.geboekt, 2, 'beide posten in één opdracht geboekt');
});

test('de AI-bankier geeft advies over de eigen rekeningen (adviseert, beslist niet)', async () => {
  const adv = await api('bank/advies', { vraag: 'Hoe kan ik beter sparen?' }, lid.token);
  assert.equal(adv.status, 200);
  assert.ok(Array.isArray(adv.body.tips) && adv.body.tips.length >= 1 && adv.body.antwoord.length > 0);
});

test('Pay draait op de eigen bank: een saldotekort in de wallet komt van de betaalrekening', async () => {
  await nieuweRekening('betaal', 20000); // ruim dekking op de bank
  const voor = (await api('bank/overzicht', {}, lid.token)).body.totaalCenten;
  const wallet = (await api('pay/overzicht', {}, lid.token)).body.saldo || 0;
  // een uitgave groter dan het walletsaldo dwingt autolaad af; het tekort (3000)
  // hoort exact van de eigen bank te komen, niet afgerond via de kaart-naad
  const bedrag = wallet + 3000;
  const l2 = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'lifestyle' }) })).json();
  const ontvanger = (await api('pay/overzicht', {}, l2.token)).body.codenaam;
  const r = await api('pay/stuur', { aan: ontvanger, centen: bedrag, idem: 'bankdek1' }, lid.token);
  assert.equal(r.status, 200, 'de betaling slaagt met autolaad');
  assert.equal(r.body.bijgeladen, 3000, 'exact het tekort bijgeladen (de kaart-naad rondt af, de bank niet)');
  const na = (await api('bank/overzicht', {}, lid.token)).body.totaalCenten;
  assert.equal(voor - na, 3000, 'het tekort kwam van de eigen bankrekeningen (eigen rails)');
});

test('Rahul-drempel: bankpaden die geld bewegen komen eerst terug als voorstel (428)', async () => {
  const doe = await api('member/doe', { pad: '/api/bank/overboek', body: { vanIban: lid.iban, naarIban: lid.iban, centen: 100 } }, lid.token);
  assert.equal(doe.status, 428, 'een bank-geldpad komt eerst terug als voorstel');
  assert.equal(doe.body.bevestigNodig, true, 'geen directe uitvoering: eerst bevestigen');
});

test('RTFoundation: in de eigen-stand gaat de 30%-afdracht door het eigen grootboek', async () => {
  await naarPartner();
  await naarEigen();
  // een business-lid betaalt zijn open maandbijdrage
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'business' }) })).json();
  const st = (await api('state', {}, l.token)).body.state;
  const abo = (st.invoices || []).find(i => /maandbijdrage|lidmaatschap|jaarbijdrage/i.test(i.desc || '') && i.status === 'open');
  assert.ok(abo, 'er staat een open abonnementsfactuur klaar');
  const voor = (await oapi('bank/gezond', {}, 'RTG')).body.foundationCenten || 0;
  const betaald = await api('pay', { invoiceId: abo.id }, l.token);
  assert.equal(betaald.status, 200);
  // de afdracht staat nu als echte boeking op de foundation-tegenrekening
  const g = (await oapi('bank/gezond', {}, 'RTG')).body;
  assert.equal(g.foundationCenten - voor, Math.round(betaald.body.foundation * 100), 'exact het teruggemelde foundation-deel, via het eigen grootboek');
  assert.equal(g.sluit.klopt, true, 'de sluitcontrole blijft kloppen');
  await naarPartner();
});

let noraIban = null; // ook gebruikt door de CSV-test (eigendomscontrole)
test('salarisrun uit de klokuren: het voorstel matcht op de lid-koppeling en de run betaalt uit', async () => {
  // Nora Prins (personeel bij Sal de Mar, gekoppeld aan een RTG-account) geeft
  // akkoord en krijgt haar eigen betaalrekening
  const nl = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'nora@rtg.example', password: 'werk' }) })).json();
  assert.ok(nl.token, 'Nora logt in met haar RTG-account');
  await api('bank/akkoord', {}, nl.token);
  const nOv = await api('bank/overzicht', {}, nl.token);
  noraIban = (nOv.body.rekeningen.find(r => r.soort === 'betaal') || {}).iban;
  assert.ok(noraIban, 'Nora heeft een betaalrekening');

  // de manager boekt klokcorrecties: Nora en Mateo werkten allebei 2 uur deze
  // maand (vergeten te klokken); bij een maandgrens klemt de test naar vandaag
  const roster = await api('supplier/roster', { code: 'KIKUNOI' });
  const mateo = roster.body.staff.find(x => x.role === 'manager');
  const nora = roster.body.staff.find(x => x.name === 'Nora Prins');
  const mgr = (await api('supplier/login', { code: 'KIKUNOI', staffId: mateo.id, pin: '1234' })).body.token;
  const nu = new Date();
  let inAt = new Date(nu.getTime() - 3 * 3600000);
  const maandStart = new Date(nu.getFullYear(), nu.getMonth(), 1, 0, 1);
  if (inAt < maandStart) inAt = maandStart;
  const uitAt = new Date(inAt.getTime() + 2 * 3600000);
  const c1 = await api('staff/klok/correctie', { staffId: nora.id, in: inAt.toISOString(), uit: uitAt.toISOString() }, mgr);
  assert.equal(c1.status, 200, 'de manager boekt een klokcorrectie');
  await api('staff/klok/correctie', { staffId: mateo.id, in: inAt.toISOString(), uit: uitAt.toISOString() }, mgr);
  // een gewone medewerker mag dat niet
  const staf = (await api('supplier/login', { code: 'KIKUNOI', staffId: nora.id, pin: '5678' })).body.token;
  assert.ok((await api('staff/klok/correctie', { staffId: nora.id, in: inAt.toISOString(), uit: uitAt.toISOString() }, staf)).status >= 400, 'de klokcorrectie is manager-only');

  // het voorstel: dezelfde uren en hetzelfde uurloon als het fiscale bord
  const v = await oapi('bank/salaris/voorstel', { zaak: 'KIKUNOI' }, 'RTG');
  assert.equal(v.status, 200);
  const rNora = v.body.regels.find(r => r.naam === 'Nora Prins');
  assert.ok(rNora, 'Nora staat in het voorstel');
  assert.equal(rNora.iban, noraIban, 'gematcht op haar eigen betaalrekening (lid-koppeling)');
  assert.ok(rNora.uren >= 2, 'de gecorrigeerde uren tellen mee');
  assert.equal(rNora.brutoCenten, Math.round(rNora.uren * v.body.uurloon * 100), 'bruto = uren x het uurloon van de zaak');
  assert.ok(v.body.zonderRekening.some(z => z.naam === mateo.name), 'wie geen lid-koppeling heeft staat eerlijk in het niet-uitbetaalbare lijstje');

  // de run: het kantoor betaalt vanaf een gedekte zakelijke rekening (van een
  // vers lid; de rtg-persona zit hierboven al aan zijn rekeningen-plafond)
  const l2 = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'lifestyle' }) })).json();
  const cn = (await api('pay/overzicht', {}, l2.token)).body.codenaam;
  const zak = await oapi('bank/rekening/open', { codenaam: cn, soort: 'zakelijk' }, 'RTG');
  const zakIban = zak.body.rekening.iban;
  await api('bank/storten', { iban: zakIban, centen: 100000, idem: 'sal-dek' }, l2.token);
  const run = await oapi('bank/salaris/run', { zaak: 'KIKUNOI', vanIban: zakIban }, 'RTG');
  assert.equal(run.status, 200);
  assert.equal(run.body.totaalCenten, v.body.totaalCenten, 'de run betaalt exact het voorstel uit');
  const af = await api('bank/afschrift', { iban: noraIban }, nl.token);
  assert.ok(af.body.regels.some(r => r.soort === 'salaris' && !r.af), 'het salaris staat als bijschrijving op Nora’s afschrift');
});

test('afschrift-export: het lid downloadt zijn eigen rekening als CSV; andermans rekening blijft dicht', async () => {
  // POST met het token in de Authorization-header: nooit een token in een URL
  const csv = (iban, token) => fetch(base + '/api/bank/afschrift.csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify({ iban })
  });
  const r = await csv(lid.iban, lid.token);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/csv/);
  const regels = (await r.text()).trim().split('\n');
  assert.ok(regels[0].includes('datum;af/bij;bedrag'), 'nette NL-kopregel');
  assert.ok(regels.length >= 2, 'de boekingen staan erin');
  // zonder token dicht, en andermans rekening dicht (eigendomscontrole)
  assert.equal((await csv(lid.iban, null)).status, 401);
  const vreemd = await csv(noraIban, lid.token);
  assert.ok(vreemd.status === 403 || vreemd.status === 404, 'andermans afschrift is niet te downloaden');
});
