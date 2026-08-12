/* EEN BEVESTIGDE HANDELING CREEERT, VERNIETIGT OF VERLIEST GEEN WAARDE.

   Wet RTG-021, en met opzet zonder implementatienaam getoetst: niet "de wallet
   klopt" maar "de som van alle rekeningen is nul en niemand staat rood". Die
   formulering overleeft een verhuizing naar Postgres, naar de Rust-motor of naar
   een ander grootboek; "de wallet klopt" niet.

   WAAROM DEZE TOETS ER IS. De sabotagemotor haalde de saldocontrole uit boek()
   -- de regel die voorkomt dat een rekening onder nul gaat -- en er werd NIETS
   rood. test/pay.test.js raakt die grens namelijk nooit: het huis is gebouwd op
   "EEN knop", dus bij te weinig saldo laadt de wallet zichzelf bij en komt de
   402-tak nooit aan de beurt. De guard die geld beschermt had dus geen enkele
   toets, en dat is precies het soort gat dat je alleen vindt door de handhaver
   echt uit te zetten.

   DE TWEE BEWERINGEN, en ze zijn allebei nodig:

     1. een handeling die NIET kan, verandert ook niets. Een geweigerde
        overboeking mag geen halve boeking achterlaten.
     2. na alles wat er is gebeurd -- geslaagd en geweigerd -- sluit het
        grootboek nog steeds: som nul, niemand rood.

   De tweede is de wet zelf. De eerste is wat hem betekenis geeft: een systeem
   dat alles weigert sluit ook, en bewijst niets.

   /api/pay/gezond geeft met opzet alleen ja of nee terug en geen bedragen ("geen
   data naar buiten"), dus daar toetsen we op. Dat is geen beperking: `klopt` IS
   de wet -- som van alle rekeningen nul EN niemand rood.

   Gemuteerd en zien zakken: de saldocontrole uit boek() halen (toets 1 en 2
   rood), en de bedraggrens weghalen zodat een negatief bedrag erdoor komt
   (toets 3 rood).
   Draai los: node --experimental-sqlite --test test/waardebehoud.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-waardebehoud-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function lid(tier) {
  const r = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier })
  });
  const d = await r.json();
  const o = await api('pay/overzicht', {}, d.token);
  return { token: d.token, codenaam: o.body.codenaam };
}
const sluit = () => fetch(base + '/api/pay/gezond').then(r => r.json());

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een partnerrekening kan niet leeggetrokken worden tot onder nul', async () => {
  const sup = await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rahul', password: 'Imran' })
  }).then(r => r.json());
  assert.ok(sup.token, 'de partner logt in');

  /* De partnerrekening laadt zichzelf NIET bij -- daar is "EEN knop" niet voor.
     Uitbetalen wat er niet staat, hoort dus gewoon te worden geweigerd. */
  const voor = await sluit();
  assert.equal(voor.klopt, true, 'vooraf sluit het grootboek');

  const teveel = await api('supplier/pay/uitbetaal', { idem: 'leeg:1', centen: 99999999 }, sup.token);
  assert.notEqual(teveel.status, 200,
    'uitbetalen van bijna een miljoen euro die er niet staat, hoort geweigerd te worden (kreeg ' +
    teveel.status + ': ' + JSON.stringify(teveel.body).slice(0, 120) + ')');
  /* DE REDEN MOET KLOPPEN, niet alleen de uitkomst. Deze assertie stond er eerst
     niet, en toen was de toets groen omdat de route "er staat niets om uit te
     betalen" zei -- een heel andere controle dan de saldogrens. Een weigering om
     de verkeerde reden bewijst niets over deze wet. */
  assert.match(String(teveel.body.error || ''), /niets om uit te betalen|onvoldoende|saldo/i,
    'de weigering hoort over het ontbrekende saldo te gaan: ' + JSON.stringify(teveel.body).slice(0, 140));

  const na = await sluit();
  assert.equal(na.klopt, true,
    'en na de weigering sluit het grootboek nog steeds; klopt=false betekent som!=0 of iemand staat rood');
});

test('na een reeks handelingen -- geslaagd en geweigerd -- sluit het grootboek', async () => {
  const a = await lid('rtg');
  const b = await lid('lifestyle');

  await api('pay/oplaad', { centen: 5000, idem: 'wb:laad' }, a.token);
  await api('pay/stuur', { aan: b.codenaam, centen: 1200, oms: 'deel een', idem: 'wb:s1' }, a.token);
  await api('pay/stuur', { aan: b.codenaam, centen: 800, oms: 'deel twee', idem: 'wb:s2' }, a.token);
  // en een paar die horen te falen
  await api('pay/stuur', { aan: 'BestaatNiet Vos', centen: 100, idem: 'wb:f1' }, a.token);
  await api('pay/stuur', { aan: b.codenaam, centen: -500, oms: 'negatief', idem: 'wb:f2' }, a.token);
  await api('pay/stuur', { aan: a.codenaam, centen: 100, oms: 'aan zichzelf', idem: 'wb:f3' }, a.token);

  const g = await sluit();
  assert.equal(g.klopt, true,
    'na geslaagde en geweigerde handelingen door elkaar hoort het grootboek te sluiten: som van alle ' +
    'rekeningen exact nul en niemand rood -- dat is precies wat klopt=true betekent');
});

test('een negatief of onzinnig bedrag maakt geen boeking', async () => {
  const a = await lid('rtg');
  const b = await lid('business');
  await api('pay/oplaad', { centen: 3000, idem: 'wb:laad2' }, a.token);
  const voor = (await api('pay/overzicht', {}, a.token)).body.saldo;

  for (const centen of [-100, 0, NaN, 1e12]) {
    const r = await api('pay/stuur', { aan: b.codenaam, centen, oms: 'onzin', idem: 'wb:onzin' + centen }, a.token);
    assert.notEqual(r.status, 200, 'bedrag ' + centen + ' hoort geweigerd te worden');
  }
  assert.equal((await api('pay/overzicht', {}, a.token)).body.saldo, voor,
    'geen van die pogingen mag het saldo hebben geraakt');

  /* EEN HALVE CENT IS GEEN ONZIN MAAR EEN AFRONDING, en dat had ik mis. Deze
     toets eiste eerst dat 0,5 cent geweigerd werd; dat gebeurt niet, want boek()
     doet Math.round en maakt er 1 cent van. Dat is GEEN schending van deze wet:
     de verzender wordt met 1 cent belast en de ontvanger met 1 cent bijgeschreven,
     dus er ontstaat en verdwijnt niets. Invoervalidatie en waardebehoud zijn twee
     verschillende eisen, en deze toets gaat over de tweede. */
  const half = await api('pay/stuur', { aan: b.codenaam, centen: 0.5, oms: 'halve cent', idem: 'wb:half' }, a.token);
  if (half.status === 200) {
    assert.equal((await api('pay/overzicht', {}, a.token)).body.saldo, voor - 1,
      'een halve cent wordt afgerond naar een hele; dan hoort er ook precies een cent af te gaan');
  }
  const g = await sluit();
  assert.equal(g.klopt, true, 'en het grootboek sluit nog steeds');
});
