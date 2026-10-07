/* DE VRIJGAVEPOORT AAN DE GELDHANDELINGEN, OP EEN ECHTE SERVER.

   De poort zelf is elders beproefd (test/vrijgave.test.js, -lokaal, -rangorde).
   Hier gaat het om de HAKEN: zit de poort op de plek waar een lid of een zaak
   met een BESTAANDE sessie langs de echte API nieuw geld laat bewegen, en houdt
   hij zich aan de twee beloften van de eigenaar:

     1. een noodstop houdt NIEUW werk tegen, met de veilige code van de poort en
        zonder dat er iets beweegt;
     2. uitzetten beschadigt de geschiedenis niet (een herhaling met dezelfde
        sleutel krijgt het bewaarde antwoord, ook tijdens de noodstop), en weer
        AANZETTEN speelt niets opnieuw af (dezelfde sleutel boekt geen tweede
        keer).

   De haken, per capability:
     geld.opwaarderen           POST /api/pay/oplaad          (kern/pay/opladen.js laadOp)
     geld.intern_saldo          POST /api/pay/stuur           (de idem-laag van RTG Pay)
                                POST /api/supplier/pay/in     (de kascode-claim, kern/pay/kas-claim.js)
     geld.lid_iban_uitbetaling  POST /api/pay/terug           (kern/pay/terug.js, naast de bevoegdheid)
     geld.partnerafrekening     POST /api/supplier/pay/uitbetaal (kern/pay/partner-uitbetaal.js)

   De stand wordt omgezet langs de ECHTE deur van het kantoor: uitzetten zonder
   passkey, weer aanzetten met de ceremonie (test/kantoorpasskey.js). Lokaal
   begint elke capability zonder vastgelegde stand op `sandbox`
   (server/kern/vrijgave/lokaal.js), en de rail is hier de demo-aanbieder van
   Magnaat Test -- een rail zonder echt geld. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { kantoorPasskey } = require('./kantoorpasskey');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-hooks-'));
let srv, base, baas, lid, sup, pk;
const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const saldo = async (token) => (await api('/api/pay/overzicht', {}, token)).body.saldo;
const zaakSaldo = async () => (await api('/api/supplier/pay/overzicht', {}, sup.token)).body.saldo;
const gezond = async () => (await (await fetch(base + '/api/pay/gezond')).json()).klopt;

async function zet(id, stand, reden) {
  const activeert = ['enabled', 'sandbox', 'shadow'].includes(stand);
  const extra = activeert ? await pk.ceremonie(pk.sleutel, '/api/office/boardroom/bevestig/opties', { actie: 'eigenaar-vrijgave' }, baas) : {};
  const r = await api('/api/office/vrijgave/stand', { id, stand, reden: reden || 'proef van de haken', ...extra }, baas);
  assert.equal(r.status, 200, id + ' -> ' + stand + ': ' + JSON.stringify(r.body));
  return r.body;
}
const dicht = (r, capability) => {
  assert.ok(r.status === 503 || r.status === 403, 'geweigerd en niet ' + r.status + ': ' + JSON.stringify(r.body));
  assert.equal(r.body.capability, capability, 'de weigering noemt de capability: ' + JSON.stringify(r.body));
  assert.ok(['tijdelijk-uit', 'compliance-ontbreekt', 'niet-geautoriseerd', 'provider-niet-beschikbaar', 'bestaat-niet-voor-dit-product'].includes(r.body.code),
    'een veilige code van de poort: ' + r.body.code);
  assert.doesNotMatch(String(r.body.error), /disabled|emergency|dossier|besluit|stand/i, 'de klanttekst lekt configuratie');
};

test.before(async () => {
  /* B3 is vastgelegd in deze toetswereld: zonder B3 is de IBAN-uitbetaling van
     een lid altijd dicht (toets 4 laat dat ook zien door hem in te trekken). */
  require('../scripts/lib/proefvrijgave').standMetBesluiten(TMP, ['emoney.b3']);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  baas = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(baas, 'de eigenaar is ingelogd');
  pk = kantoorPasskey(base);
  pk.sleutel = await pk.zet(baas, 'Imran');
  const d = await api('/api/login', { tier: 'rtg' });
  lid = { token: d.body.token, codenaam: (await api('/api/pay/overzicht', {}, d.body.token)).body.codenaam };
  baas = baas;
  const s = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body;
  sup = { token: s.token, code: s.state.supplier.code };
  assert.equal((await api('/api/pay/oplaad', { centen: 100000, idem: 'start' }, lid.token)).status, 200);
});
test.after(() => { stop(srv && srv.child); fs.rmSync(TMP, { recursive: true, force: true }); });

test('1 geld.opwaarderen: noodstop weigert een nieuwe oplading, een herhaling krijgt het bewaarde antwoord, heraanzetten speelt niets af', async () => {
  const eerst = await api('/api/pay/oplaad', { centen: 2000, idem: 'op-1' }, lid.token);
  assert.equal(eerst.status, 200, JSON.stringify(eerst.body));
  const s0 = await saldo(lid.token);
  await zet('geld.opwaarderen', 'emergency_disabled', 'noodstop op opladen in de proef');
  const nieuw = await api('/api/pay/oplaad', { centen: 2000, idem: 'op-2' }, lid.token);
  dicht(nieuw, 'geld.opwaarderen');
  const herhaal = await api('/api/pay/oplaad', { centen: 2000, idem: 'op-1' }, lid.token);
  assert.equal(herhaal.status, 200, 'het bewaarde antwoord komt terug, ook tijdens de noodstop: ' + JSON.stringify(herhaal.body));
  assert.equal(herhaal.body.herhaald, true);
  assert.equal(await saldo(lid.token), s0, 'tijdens de noodstop bewoog er iets');
  await zet('geld.opwaarderen', 'sandbox', 'noodstop op opladen voorbij');
  const weer = await api('/api/pay/oplaad', { centen: 2000, idem: 'op-1' }, lid.token);
  assert.equal(weer.body.herhaald, true, 'heraanzetten voerde de oude oplading opnieuw uit');
  assert.equal(await saldo(lid.token), s0, 'heraanzetten boekte iets bij');
  const na = await api('/api/pay/oplaad', { centen: 2000, idem: 'op-2' }, lid.token);
  assert.equal(na.status, 200, 'wat geweigerd was, liet niets achter en mag nu gewoon: ' + JSON.stringify(na.body));
  assert.equal(await saldo(lid.token), s0 + 2000);
  assert.equal(await gezond(), true);
});

test('2 geld.intern_saldo: een betaling aan een ander lid en een kassa-afrekening stoppen, de herhaling niet', async () => {
  const baasCode = (await api('/api/pay/overzicht', {}, baas)).body.codenaam;
  const eerst = await api('/api/pay/stuur', { aan: baasCode, centen: 500, idem: 'st-1' }, lid.token);
  assert.equal(eerst.status, 200, JSON.stringify(eerst.body));
  const [a0, b0, z0] = [await saldo(lid.token), await saldo(baas), await zaakSaldo()];
  await zet('geld.intern_saldo', 'emergency_disabled', 'noodstop op het interne saldo');
  dicht(await api('/api/pay/stuur', { aan: baasCode, centen: 500, idem: 'st-2' }, lid.token), 'geld.intern_saldo');
  const herhaal = await api('/api/pay/stuur', { aan: baasCode, centen: 500, idem: 'st-1' }, lid.token);
  assert.equal(herhaal.status, 200); assert.equal(herhaal.body.herhaald, true);
  /* De kascode: een nieuwe claim gaat niet door, en de code blijft van het lid. */
  const code = (await api('/api/pay/kascode', { maxCenten: 5000 }, lid.token)).body.code;
  dicht(await api('/api/supplier/pay/in', { code, centen: 1200, idem: 'kas-1' }, sup.token), 'geld.intern_saldo');
  /* Opladen staat ook dicht: de poort van de idem-laag (het interne saldo) gaat
     voor de eigen poort van opladen, en zegt dus welke laag hem tegenhield. */
  dicht(await api('/api/pay/oplaad', { centen: 1000, idem: 'op-dicht' }, lid.token), 'geld.intern_saldo');
  assert.deepEqual([await saldo(lid.token), await saldo(baas), await zaakSaldo()], [a0, b0, z0], 'tijdens de noodstop bewoog er iets');
  await zet('geld.intern_saldo', 'sandbox', 'noodstop op het interne saldo voorbij');
  assert.equal((await api('/api/pay/stuur', { aan: baasCode, centen: 500, idem: 'st-1' }, lid.token)).body.herhaald, true);
  const kas = await api('/api/supplier/pay/in', { code, centen: 1200, idem: 'kas-1' }, sup.token);
  assert.equal(kas.status, 200, 'de code die tijdens de noodstop geweigerd werd, werkt daarna nog: ' + JSON.stringify(kas.body));
  assert.equal(await saldo(baas), b0, 'heraanzetten speelde de oude betaling af');
  assert.equal(await gezond(), true);
});

test('3 geld.lid_iban_uitbetaling: noodstop en een ingetrokken B3 sluiten de terugstorting, de herhaling niet', async () => {
  const IBAN = 'NL91ABNA0417164300';
  assert.equal((await api('/api/pay/oplaad', { centen: 20000, idem: 'baas-start' }, baas)).status, 200);
  const rek = await api('/api/pay/rekening', { iban: IBAN, naam: 'R. Eigenaar' }, baas);
  assert.equal(rek.status, 200, JSON.stringify(rek.body));
  const eerst = await api('/api/pay/terug', { centen: 1000, idem: 'tr-1' }, baas);
  assert.equal(eerst.status, 200, JSON.stringify(eerst.body));
  const s0 = await saldo(baas);
  await zet('geld.lid_iban_uitbetaling', 'emergency_disabled', 'noodstop op terugstorten');
  dicht(await api('/api/pay/terug', { centen: 1000, idem: 'tr-2' }, baas), 'geld.lid_iban_uitbetaling');
  const herhaal = await api('/api/pay/terug', { centen: 1000, idem: 'tr-1' }, baas);
  assert.equal(herhaal.status, 200); assert.equal(herhaal.body.herhaald, true);
  assert.equal(await saldo(baas), s0);
  await zet('geld.lid_iban_uitbetaling', 'sandbox', 'noodstop op terugstorten voorbij');
  /* Het besluit B3 INTREKKEN (zonder passkey: intrekken is uitzetten) sluit hem
     ook -- een stand die aan staat, maakt een ontbrekend besluit niet goed. */
  const weg = await api('/api/office/vrijgave/besluit', { besluit: 'emoney.b3', intrekken: true, reden: 'B3 ingetrokken in de proef' }, baas);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));
  const zonderB3 = await api('/api/pay/terug', { centen: 1000, idem: 'tr-3' }, baas);
  dicht(zonderB3, 'geld.lid_iban_uitbetaling');
  assert.equal(zonderB3.body.code, 'compliance-ontbreekt');
  assert.equal((await api('/api/pay/terug', { centen: 1000, idem: 'tr-1' }, baas)).body.herhaald, true);
  assert.equal(await saldo(baas), s0, 'heraanzetten of intrekken liet geld bewegen');
});

test('4 geld.partnerafrekening: de uitbetaling van een zaak stopt, de herhaling niet', async () => {
  const rek = await api('/api/supplier/pay/rekening', { iban: 'NL91 ABNA 0417 1643 00', naam: 'Toetszaak' }, sup.token);
  assert.equal(rek.status, 200, JSON.stringify(rek.body));
  const code = (await api('/api/pay/kascode', { maxCenten: 5000 }, lid.token)).body.code;
  assert.equal((await api('/api/supplier/pay/in', { code, centen: 3000, idem: 'kas-2' }, sup.token)).status, 200);
  const eerst = await api('/api/supplier/pay/uitbetaal', { idem: 'ub-1' }, sup.token);
  assert.equal(eerst.status, 200, JSON.stringify(eerst.body));
  const code2 = (await api('/api/pay/kascode', { maxCenten: 5000 }, lid.token)).body.code;
  assert.equal((await api('/api/supplier/pay/in', { code: code2, centen: 3000, idem: 'kas-3' }, sup.token)).status, 200);
  const z0 = await zaakSaldo();
  await zet('geld.partnerafrekening', 'emergency_disabled', 'noodstop op partnerafrekeningen');
  dicht(await api('/api/supplier/pay/uitbetaal', { idem: 'ub-2' }, sup.token), 'geld.partnerafrekening');
  const herhaal = await api('/api/supplier/pay/uitbetaal', { idem: 'ub-1' }, sup.token);
  assert.equal(herhaal.status, 200); assert.equal(herhaal.body.herhaald, true);
  assert.equal(await zaakSaldo(), z0, 'tijdens de noodstop ging er geld van de zaak af');
  await zet('geld.partnerafrekening', 'sandbox', 'noodstop op partnerafrekeningen voorbij');
  assert.equal((await api('/api/supplier/pay/uitbetaal', { idem: 'ub-1' }, sup.token)).body.herhaald, true);
  assert.equal(await zaakSaldo(), z0, 'heraanzetten speelde de oude uitbetaling af');
  assert.equal(await gezond(), true);
});

test('5 de tweede handtekening: een partnerafrekening via Connect vraagt er een, en een dichte poort laat niets achter', async () => {
  /* Op deze server is Connect dicht (geen bewijs, geen besluit, geen rail): de
     aanvraag wordt geweigerd VOORDAT er een handtekening wordt aangevraagd. */
  const lijf = { id: 'afr-hook-0001', partner: sup.code, account: 'acct_proefhaak1', centen: 1000 };
  const c = await pk.ceremonie(pk.sleutel, '/api/office/boardroom/bevestig/opties', { actie: 'connect.afrekening' }, baas);
  const r = await api('/api/office/connect/afrekening', { ...lijf, ...c }, baas);
  assert.equal(r.status, 503, JSON.stringify(r.body));
  const open = await api('/api/office/bank/handtekening/open', {}, baas);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  assert.equal(open.body.aanvragen.filter(a => a.actie === 'connect.afrekening').length, 0, 'een geweigerde aanvraag liet een handtekening open');
  assert.deepEqual((await api('/api/office/connect/afrekeningen', {}, baas)).body.afrekeningen, []);
});

test('6 de claimwegen buiten de idem-laag: verzilveren en vastleggen stoppen, intrekken en vrijgeven lopen door', async () => {
  const baasCode = (await api('/api/pay/overzicht', {}, baas)).body.codenaam;
  const t1 = await api('/api/pay/tegoed/koop', { centen: 1500, aan: baasCode, idem: 'tg-1' }, lid.token);
  assert.equal(t1.status, 200, JSON.stringify(t1.body));
  const t2 = await api('/api/pay/tegoed/koop', { centen: 1500, aan: baasCode, idem: 'tg-2' }, lid.token);
  assert.equal(t2.status, 200, JSON.stringify(t2.body));
  const vooraf = async (idem) => {
    const code = (await api('/api/pay/kascode', { maxCenten: 5000 }, lid.token)).body.code;
    const r = await api('/api/supplier/pay/vooraf', { code, maxCenten: 2000, idem }, sup.token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.reservering;
  };
  const r1 = await vooraf('vf-1'), r2 = await vooraf('vf-2');
  const [a0, b0, z0] = [await saldo(lid.token), await saldo(baas), await zaakSaldo()];
  await zet('geld.intern_saldo', 'emergency_disabled', 'noodstop tijdens claims');
  dicht(await api('/api/pay/tegoed/verzilver', { id: t1.body.tegoed.id, idem: 'vz-1' }, baas), 'geld.intern_saldo');
  dicht(await api('/api/supplier/pay/vastleg', { reservering: r1, centen: 1000, idem: 'vl-1' }, sup.token), 'geld.intern_saldo');
  assert.deepEqual([await saldo(baas), await zaakSaldo()], [b0, z0], 'een nieuw effect ging door de noodstop');
  /* AFWIKKELING: wat terug moet naar wie het betaalde, gaat terug. */
  const intrek = await api('/api/pay/tegoed/terug', { id: t2.body.tegoed.id, intrekken: true, idem: 'ti-1' }, lid.token);
  assert.equal(intrek.status, 200, 'intrekken is afwikkeling en loopt door: ' + JSON.stringify(intrek.body));
  assert.equal(await saldo(lid.token), a0 + 1500, 'het ingetrokken tegoed kwam terug bij de koper');
  const vrij = await api('/api/supplier/pay/vrijgeef', { reservering: r2 }, sup.token);
  assert.equal(vrij.status, 200, 'een reservering vrijgeven loopt door: ' + JSON.stringify(vrij.body));
  await zet('geld.intern_saldo', 'sandbox', 'noodstop tijdens claims voorbij');
  const vz = await api('/api/pay/tegoed/verzilver', { id: t1.body.tegoed.id, idem: 'vz-1' }, baas);
  assert.equal(vz.status, 200, 'het tegoed bleef bruikbaar: ' + JSON.stringify(vz.body));
  const vl = await api('/api/supplier/pay/vastleg', { reservering: r1, centen: 1000, idem: 'vl-1' }, sup.token);
  assert.equal(vl.status, 200, 'de reservering bleef vast te leggen: ' + JSON.stringify(vl.body));
  assert.equal(await saldo(baas), b0 + 1500);
  assert.equal(await gezond(), true);
});
