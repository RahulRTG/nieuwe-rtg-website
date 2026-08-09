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
/* De vier-ogen op het OPSCHALEN vraagt twee ECHTE personen. Vroeger stonden hier
   twee verzonnen namen in de body ('Aïsha' vraagt aan, 'Bram' bevestigt) op een
   en dezelfde gedeelde kantoorcode -- en dat was precies het theater dat de
   securityronde heeft opgeruimd: aanvrager en bevestiger kwamen allebei uit
   req.body.naam, dus een sessie kon beide rollen spelen. Opschalen zit nu achter
   de boardroomdeur en de identiteit komt uit de sessie. Deze twee tokens zijn
   dus geen testdecor maar de kern van wat de knop beschermt. */
let baas, tweede;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bank-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
// kantoor-aanroep (/api/office/...): de gewone bankschermen draaien op de
// gedeelde kantoorcode; dat mag, want kijken en beheren is kantoorwerk.
const oapi = (pad, body, nm) => api('office/' + pad, { ...(body || {}), naam: nm || 'boardroom' }, office.token);
/* Maar OPSCHALEN niet. Die vijf routes (draai, modus, operationeel en de twee
   autoriseer-knoppen) zitten achter de boardroomdeur en lezen de identiteit uit
   de sessie. Vandaar een aparte helper met een persoonstoken. */
const bapi = (pad, body, token) => api('office/' + pad, body || {}, token);

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

  /* En nu twee personen voor de vier-ogen. De eerste is de eigenaar: hij logt in
     op zijn EIGEN account en stapt daarmee de backoffice in, dus zijn sessie
     draagt een identiteit (user-N) in plaats van een gedeelde code. */
  const eig = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  assert.ok(eig.token, 'de eigenaar logt in op zijn eigen account');
  baas = (await api('account/start', { rol: 'kantoor' }, eig.token)).body.token;
  assert.ok(baas, 'en staat met dat account in de backoffice');

  /* De tweede is een ander mens: een gewoon lid dat van de eigenaar
     boardroom-toegang krijgt. Dat is de enige manier om aan een tweede
     identiteit te komen -- en dat is precies de bedoeling van de deur. */
  const u = Date.now().toString().slice(-8);
  const reg = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tweede Paar Ogen', email: 'ogen' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }) })).json();
  assert.ok(reg.token, 'het tweede lid is geregistreerd');
  const cn = (await api('state', {}, reg.token)).body.state.user.codename;
  const geef = await bapi('boardroom/toegang/geef', { codenaam: cn }, baas);
  assert.equal(geef.status, 200, 'de eigenaar geeft boardroom-toegang: ' + JSON.stringify(geef.body).slice(0, 140));
  const kop = await api('account/koppel', { soort: 'kantoor', code: 'KANTOOR-BANK-1' }, reg.token);
  assert.equal(kop.status, 200, 'het tweede lid koppelt de kantoorrol: ' + JSON.stringify(kop.body).slice(0, 140));
  tweede = (await api('account/start', { rol: 'kantoor' }, reg.token)).body.token;
  assert.ok(tweede, 'en staat als tweede persoon in de backoffice');

  /* DE VERGUNNING VASTLEGGEN, en dat is sinds de bevoegdheidslaag geen decor.
     Wat RTG zelf mag hangt niet aan de drie-standen-knop maar aan wat er is
     vastgelegd (kern/bevoegdheid.js): zonder vergunning clearen de eigen rails
     niet en is krediet uit eigen boek dicht. Deze opstelling doet alsof RTG de
     vergunning heeft, zodat de rest van dit bestand de BANK toetst en niet de
     grendel. De grendel zelf heeft zijn eigen toets verderop, die hem weghaalt
     en terugzet. */
  const verg = await bapi('bank/vergunning', { soort: 'bank', nummer: 'NL-TOETS-1',
    entiteit: 'RTG Bank N.V.', landen: ['NL'] }, baas);
  assert.equal(verg.status, 200, 'de vergunning is vastgelegd: ' + JSON.stringify(verg.body).slice(0, 140));
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

// zet de bank in de eigen-stand via de vier-ogen-flow (aanvraag + bevestiging)
async function naarEigen() {
  let r = await bapi('bank/draai', {}, baas);              // partner -> (auth) hybride
  if (r.body.needsAuth) await bapi('bank/autoriseer/bevestig', { id: r.body.autorisatie.id }, tweede);
  r = await bapi('bank/draai', {}, baas);                  // hybride -> (auth) eigen
  if (r.body.needsAuth) await bapi('bank/autoriseer/bevestig', { id: r.body.autorisatie.id }, tweede);
}
async function naarPartner() { await bapi('bank/modus', { modus: 'partner' }, baas); } // afschalen mag direct

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
  /* De gedeelde kantoorcode komt er niet eens in: die is geen persoon, en met
     een aanvrager zonder identiteit is vier ogen een woord en geen regel. */
  assert.equal((await oapi('bank/draai', {}, 'Aïsha')).status, 403, 'de gedeelde code schaalt niets op');

  const aanvraag = await bapi('bank/draai', {}, baas);
  assert.equal(aanvraag.body.needsAuth, true, 'opschalen wacht op een tweede persoon');
  const id = aanvraag.body.autorisatie.id;
  assert.equal((await bapi('bank/autoriseer/bevestig', { id }, baas)).status, 403, 'dezelfde persoon mag niet bevestigen');
  const bevest = await bapi('bank/autoriseer/bevestig', { id }, tweede);
  assert.equal(bevest.body.operationeel, true);
  assert.equal(bevest.body.modus, 'hybride', 'na bevestiging staat de knop een slag verder');
  await naarEigen(); // door naar eigen
  const stort = await api('bank/storten', { iban: lid.iban, centen: 10000, idem: 's2' }, lid.token);
  assert.equal(stort.body.via, 'eigen', 'in de eigen-stand emitteert de bank zelf');
  assert.equal((await bapi('bank/modus', { modus: 'partner' }, baas)).body.modus, 'partner', 'terug naar partner mag direct (afschalen)');
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

/* DE NAAD TUSSEN BOEKING EN RAIL. Hier stond niets, en dat was precies het
   probleem: sepaUit belde de payout in een try met een lege catch eronder, dus
   een mislukte rail gaf een geslaagd antwoord terug, het geld stond van de
   rekening af op extern:sepa, en het grootboek sloot netjes. De sluitcontrole
   kan dat per definitie niet vinden -- de tegenboeking klopt immers.

   Deze toets bewijst de BEDRADING (dat sepaUit echt een betaalopdracht maakt en
   indient, en dat de reconciliatie hem ziet); het gedrag bij een mislukkende
   rail staat in test/betaalopdracht.test.js, want een rail die weigert is in een
   draaiende server niet eerlijk uit te lokken. */
test('een uitgaande SEPA levert een betaalopdracht op die het kantoor kan volgen', async () => {
  await api('bank/storten', { iban: lid.iban, centen: 50000, idem: 'sepa-dek' }, lid.token);
  const voor = (await oapi('bank/gezond', {}, 'RTG')).body;

  const uit = await api('bank/sepa', { iban: lid.iban, centen: 12500, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Ontvanger', oms: 'Huur', idem: 'sepa-1' }, lid.token);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.overgemaakt, 12500);
  assert.ok(uit.body.opdrachtId, 'het antwoord draagt de opdracht die eraan hangt');
  assert.equal(uit.body.opdrachtStatus, 'INGEDIEND',
    'aangenomen door de rail, maar NIET afgewikkeld -- dat weet alleen de webhook');

  // het kantoor ziet de opdracht, met de boeking eraan gekoppeld
  const lijst = await oapi('bank/opdrachten', { limit: 10 }, 'RTG');
  assert.equal(lijst.status, 200);
  const mijne = lijst.body.opdrachten.find(o => o.id === uit.body.opdrachtId);
  assert.ok(mijne, 'de opdracht staat op het kantoorbord');
  assert.equal(mijne.soort, 'sepa-uit');
  assert.equal(mijne.centen, 12500);
  assert.equal(mijne.bestemming, 'NL91ABNA0417164300');
  assert.ok(mijne.ledgerRef, 'met de boeking waar hij bij hoort');
  assert.ok(mijne.settlementRef, 'en de referentie die de rail teruggaf');

  /* De reconciliatie: geboekt maar buiten RTG nog niet rond. Dit getal staat
     NAAST de sluitcontrole en meet iets anders -- beide moeten kloppen. */
  const na = (await oapi('bank/gezond', {}, 'RTG')).body;
  assert.equal(na.sluit.klopt, true, 'het grootboek sluit nog steeds');
  assert.equal(na.railOpen, (voor.railOpen || 0) + 1, 'er staat een opdracht meer open');
  assert.equal(na.railOpenCenten, (voor.railOpenCenten || 0) + 12500, 'voor precies dit bedrag');
  assert.equal(na.railMislukt, 0, 'en niets is mislukt');
  assert.ok(na.railOudsteAt > 0, 'met een leeftijd, zodat een blijvende storing opvalt');

  // dubbeltik: dezelfde idem-sleutel maakt geen tweede opdracht
  const weer = await api('bank/sepa', { iban: lid.iban, centen: 12500, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Ontvanger', oms: 'Huur', idem: 'sepa-1' }, lid.token);
  assert.equal(weer.body.herhaald, true);
  const na2 = (await oapi('bank/gezond', {}, 'RTG')).body;
  assert.equal(na2.railOpen, na.railOpen, 'geen tweede opdracht voor dezelfde tik');
});

/* DE PAYOUT-WEBHOOK. Tot deze ronde kende /api/betaal/webhook alleen INKOMEND
   geld: een uitgaande SEPA bleef daardoor voor altijd op INGEDIEND staan. Het
   scherpste geval is niet de geslaagde payout maar de MISLUKTE -- dan staat het
   geld van de klant af en komt het nergens aan, en "MISLUKT" opschrijven zonder
   terug te boeken is hetzelfde gat als voorheen, alleen een dag later. */
test('een mislukte payout komt via de webhook binnen en brengt het geld terug', async () => {
  const voorSaldo = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening.saldoCenten;
  const voorGezond = (await oapi('bank/gezond', {}, 'RTG')).body;

  const uit = await api('bank/sepa', { iban: lid.iban, centen: 3000, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Ontvanger', oms: 'Mislukkende overboeking', idem: 'sepa-faal' }, lid.token);
  assert.equal(uit.status, 200);
  const opdracht = (await oapi('bank/opdrachten', { limit: 20 }, 'RTG')).body
    .opdrachten.find(o => o.id === uit.body.opdrachtId);
  assert.equal(opdracht.status, 'INGEDIEND');
  assert.ok(opdracht.settlementRef, 'de rail gaf een referentie terug');
  const tarief = opdracht.tariefCenten;
  const naSepa = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening.saldoCenten;
  assert.equal(naSepa, voorSaldo - 3000 - tarief, 'het geld is van de rekening af');

  // de provider meldt dat de payout is mislukt (dezelfde route, ruwe body)
  const evt = { id: 'evt_payout_1', type: 'payout.failed',
    data: { object: { id: opdracht.settlementRef, failure_message: 'account_closed' } } };
  const hook = await fetch(base + '/api/betaal/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evt) });
  assert.equal(hook.status, 200, 'de provider krijgt 200, anders blijft hij herhalen');

  /* De webhook antwoordt meteen en werkt daarna af (hij mag de provider niet
     laten wachten), dus wachten op de uitkomst en niet op een vaste tijd. */
  let eind = null;
  for (let i = 0; i < 40 && !eind; i++) {
    const l = await oapi('bank/opdrachten', { limit: 20 }, 'RTG');
    const o = l.body.opdrachten.find(x => x.id === uit.body.opdrachtId);
    if (o && o.status !== 'INGEDIEND') eind = o;
    else await new Promise(r => setTimeout(r, 25));
  }
  assert.ok(eind, 'de webhook heeft de opdracht afgehandeld');
  assert.equal(eind.status, 'TERUGGEBOEKT', 'niet alleen MISLUKT: het geld is teruggeboekt');

  const naHook = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening.saldoCenten;
  assert.equal(naHook, voorSaldo, 'het volledige bedrag staat terug, tarief incluis');
  const naGezond = (await oapi('bank/gezond', {}, 'RTG')).body;
  assert.equal(naGezond.sluit.klopt, true, 'en het grootboek sluit nog steeds');
  assert.equal(naGezond.railOpen, voorGezond.railOpen, 'de reconciliatie is terug op zijn oude stand');
  assert.equal(naGezond.railZonderTerugboeking, 0, 'er staat geen geld af zonder bestemming');

  // het lid ziet de teruggang op zijn afschrift; een stille correctie bestaat niet
  const af = await api('bank/afschrift', { iban: lid.iban }, lid.token);
  assert.ok(af.body.regels.some(r => r.soort === 'sepa-terug' && !r.af),
    'de teruggeboeking staat als bijschrijving op het afschrift');
});

test('een payout-webhook die wij niet kennen verandert niets en valt niet om', async () => {
  const voor = (await oapi('bank/gezond', {}, 'RTG')).body;
  const evt = { id: 'evt_payout_2', type: 'payout.paid', data: { object: { id: 'po_vanIemandAnders' } } };
  const r = await fetch(base + '/api/betaal/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evt) });
  assert.equal(r.status, 200);
  const na = (await oapi('bank/gezond', {}, 'RTG')).body;
  assert.equal(na.railOpen, voor.railOpen);
  assert.equal(na.sluit.klopt, true);
});

/* DE BEVOEGDHEIDSLAAG. Dit huis had vijf assen waarop een functie dicht kan, en
   die gaan allemaal over WIE de gebruiker is of wat de beheerder uitzette. Deze
   zesde gaat over iets anders: of RTG de handeling zelf mag verrichten. Het
   verschil is niet academisch -- zonder deze laag kon je met twee klikken en een
   tweede paar ogen in een stand komen waarin het huis zich als betaaldienst
   gedraagt, en stond "we hebben het gebouwd" gelijk aan "we mogen het".

   Deze toets haalt de vergunning weg die test.before heeft vastgelegd, kijkt wat
   er dan dichtgaat, en zet hem terug. */
test('zonder vastgelegde vergunning gaat dicht wat RTG niet zelf mag -- met de reden, niet met een lege lijst', async () => {
  assert.equal((await bapi('bank/vergunning', { soort: '' }, baas)).status, 200, 'de vergunning is ingetrokken');

  // 1. wat software is, blijft gewoon open: dat is rekenen op eigen gegevens
  assert.equal((await api('bank/overzicht', {}, lid.token)).status, 200, 'de bank-app blijft zichtbaar');
  assert.equal((await api('bank/inzichten', {}, lid.token)).status, 200, 'uitgaven-inzichten blijven open');
  assert.equal((await api('bank/vastelasten', {}, lid.token)).status, 200, 'de vaste-lasten-radar blijft open');

  // 2. wat een partner voor ons doet blijft open zolang die rail draait
  const sepa = await api('bank/sepa', { iban: lid.iban, centen: 200, naarIban: 'NL91ABNA0417164300', idem: 'verg-1' }, lid.token);
  assert.equal(sepa.status, 200, 'SEPA loopt via de partnerrail en blijft dus open');

  // 3. maar krediet uit eigen boek niet: dat doet geen partner voor ons
  const kr = await api('bank/krediet', {}, lid.token);
  assert.equal(kr.status, 503, 'krediet uit eigen boek is dicht');
  assert.equal(kr.body.reden, 'bevoegdheid', 'en niet als "de beheerder zette het uit"');
  assert.equal(kr.body.vermogen, 'KREDIET_EIGEN_BOEK');
  assert.equal(kr.body.nodig, 'bank', 'het antwoord zegt WAT ervoor nodig is');
  assert.match(kr.body.error, /vergunning/i, 'in een zin die een mens begrijpt');

  // 4. en de eigen rails gaan niet draaien: de knop weigert het opschalen
  const op = await bapi('bank/operationeel', { aan: true }, baas);
  if (op.body.needsAuth) await bapi('bank/autoriseer/bevestig', { id: op.body.autorisatie.id }, tweede);
  const draai = await bapi('bank/draai', {}, baas);
  const bevestig = draai.body.needsAuth
    ? await bapi('bank/autoriseer/bevestig', { id: draai.body.autorisatie.id }, tweede)
    : draai;
  assert.equal(bevestig.status, 409, 'opschalen naar de eigen rails wordt geweigerd: ' + JSON.stringify(bevestig.body).slice(0, 120));
  assert.match(bevestig.body.error, /vergunning/i);
  assert.equal((await oapi('bank', {}, 'RTG')).body.regie.modus, 'partner', 'en de stand is niet verschoven');

  // 5. de matrix vertelt het kantoor precies waar de grens loopt
  const m = await oapi('bank/bevoegdheid', {}, 'RTG');
  assert.equal(m.status, 200);
  assert.equal(m.body.vergunning, null, 'er ligt niets');
  const op_ = id => m.body.regels.find(r => r.id === id);
  assert.equal(op_('INZICHTEN').mag, true);
  assert.equal(op_('SEPA_UIT').mag, true);
  assert.equal(op_('SEPA_UIT').via, 'partner', 'open, maar via de partner en niet op eigen kracht');
  assert.equal(op_('KREDIET_EIGEN_BOEK').mag, false);
  assert.equal(op_('KREDIET_EIGEN_BOEK').nodig, 'bank');

  // 6. een te LAGE vergunning is geen vergunning
  await bapi('bank/vergunning', { soort: 'betaalinstelling', nummer: 'PI-1', landen: ['NL'] }, baas);
  const kr2 = await api('bank/krediet', {}, lid.token);
  assert.equal(kr2.status, 503, 'een betaalinstelling mag nog geen krediet uit eigen boek verstrekken');
  assert.equal(kr2.body.bevoegdheidReden, 'rang', 'en de reden is de rang, niet "hij ontbreekt"');

  // 7. een VERLOPEN vergunning telt niet, ook al staat hij er
  await bapi('bank/vergunning', { soort: 'bank', nummer: 'NL-OUD', landen: ['NL'], tot: '2020-01-01' }, baas);
  const kr3 = await api('bank/krediet', {}, lid.token);
  assert.equal(kr3.status, 503, 'een verlopen vergunning is geen vergunning');
  assert.equal(kr3.body.bevoegdheidReden, 'verlopen');

  // terugzetten zoals test.before hem had, zodat de rest van dit bestand klopt
  assert.equal((await bapi('bank/vergunning', { soort: 'bank', nummer: 'NL-TOETS-1',
    entiteit: 'RTG Bank N.V.', landen: ['NL'] }, baas)).status, 200);
  assert.equal((await api('bank/krediet', {}, lid.token)).status, 200, 'en dan mag krediet weer');
});

/* HYBRIDE MAG GEEN SLUIPROUTE ZIJN. In de hybride stand clearen de eigen rails
   EN de kaart-rails naast elkaar. Kijkt de bevoegdheidslaag dan naar de kaart
   ("er is toch een partner"), dan is hybride precies de stand waarin je alles
   mag wat je op eigen kracht niet mag -- en hybride is de stand waar de knop je
   als eerste brengt. Daarom telt in hybride de EIGEN kant: de strengste wint. */
test('in de hybride stand telt de eigen rail, niet de partner die er ook nog is', async () => {
  // een betaalinstelling: genoeg om de knop te mogen draaien, te weinig om
  // klantgeld aan te houden (dat vraagt een bankvergunning)
  assert.equal((await bapi('bank/vergunning', { soort: 'betaalinstelling', nummer: 'PI-2', landen: ['NL'] }, baas)).status, 200);
  await naarPartner();

  const op = await bapi('bank/operationeel', { aan: true }, baas);
  if (op.body.needsAuth) await bapi('bank/autoriseer/bevestig', { id: op.body.autorisatie.id }, tweede);
  const draai = await bapi('bank/draai', {}, baas);
  if (draai.body.needsAuth) await bapi('bank/autoriseer/bevestig', { id: draai.body.autorisatie.id }, tweede);
  assert.equal((await oapi('bank', {}, 'RTG')).body.regie.modus, 'hybride', 'de knop staat op hybride');

  const m = await oapi('bank/bevoegdheid', {}, 'RTG');
  assert.equal(m.body.rail, 'eigen', 'in hybride kijken we naar de eigen rail, ook al draait de kaart mee');
  const regel = id => m.body.regels.find(r => r.id === id);
  assert.equal(regel('SEPA_UIT').mag, true, 'SEPA mag: een betaalinstelling is daarvoor toereikend');
  assert.equal(regel('SEPA_UIT').via, 'eigen', 'en dan op eigen kracht, niet via de partner');
  assert.equal(regel('KLANTGELD').mag, false, 'klantgeld aanhouden niet: dat vraagt een bankvergunning');
  assert.equal(regel('KLANTGELD').reden, 'rang');

  // en dat is geen papieren uitslag: de route gaat ook echt dicht
  const stort = await api('bank/storten', { iban: lid.iban, centen: 1000, idem: 'hyb-1' }, lid.token);
  assert.equal(stort.status, 503, 'storten is dicht want dat is klantgeld aanhouden');
  assert.equal(stort.body.bevoegdheidReden, 'rang');

  // terug naar de stand waarin de rest van dit bestand draait
  await naarPartner();
  assert.equal((await bapi('bank/vergunning', { soort: 'bank', nummer: 'NL-TOETS-1',
    entiteit: 'RTG Bank N.V.', landen: ['NL'] }, baas)).status, 200);
  assert.equal((await api('bank/storten', { iban: lid.iban, centen: 1000, idem: 'hyb-2' }, lid.token)).status, 200,
    'met de bankvergunning terug mag storten weer');
});
