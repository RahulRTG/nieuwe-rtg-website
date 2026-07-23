/* RTG Podium: het eigen live-kanaal. Strikt 18+ met geverifieerd paspoort
   (makers en kijkers), een kanaal gaat pas open na menselijke goedkeuring
   door kantoor, kijken/chatten/cadeautjes/abonnementen via RTG Pay, en de
   maker blokkeert; iedereen kan melden. Draai los:
   node --experimental-sqlite --test test/podium.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, office;
let seq = 0;

// een lid met (optioneel) geverifieerd paspoort; geboren stuurt de leeftijd
async function nieuwLid(geboren, verifieer = true) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', {
    name: 'Lid ' + seq, email: 'p' + u + '@x.nl', phone: '06' + u, password: 'geheim123',
    geboortedatum: geboren || '1990-05-05', geslacht: 'v', tier: 'business', pasApp: 'business'
  });
  const token = reg.body.token;
  const st = await api(base, '/api/state', {}, token);
  const codename = st.body.state.user.codename;
  await api(base, '/api/verify/upload', { image: PNG }, token);
  await api(base, '/api/verify/selfie', { image: PNG }, token);
  const pend = await api(base, '/api/office/verifications', {}, office);
  const mij = (pend.body.pending || []).find(p => p.codename === codename);
  const key = 'user-' + mij.id;
  if (verifieer) await api(base, '/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, geslacht: 'v' }, office);
  return { token, codename, key };
}

let maker, kijker, derde, kanaalId;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-podium-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  maker = await nieuwLid('1988-03-03');
  kijker = await nieuwLid('1995-07-07');
  derde = await nieuwLid('1992-01-01');
});
test.after(() => stop(srv && srv.child));

test('1. de poort: zonder geverifieerd paspoort of onder de 18 blijft het Podium dicht', async () => {
  const groen = await nieuwLid('1990-05-05', false);          // niet geverifieerd
  const r1 = await api(base, '/api/podium/kanalen', {}, groen.token);
  assert.equal(r1.status, 403);
  assert.equal(r1.body.mag, false);
  const r2 = await api(base, '/api/podium/kanaal/aanmeld', { naam: 'Test' }, groen.token);
  assert.equal(r2.status, 403, 'ook een kanaal aanmelden kan niet zonder paspoort');
  const jong = await nieuwLid('2010-01-01', true);            // geverifieerd maar minderjarig
  const r3 = await api(base, '/api/podium/kanalen', {}, jong.token);
  assert.equal(r3.status, 403, 'onder de 18 blijft het Podium dicht, ook met paspoort');
  assert.ok(/18/.test(r3.body.error));
});

test('2. een kanaal gaat pas open nadat een mens van kantoor het goedkeurt', async () => {
  const aan = await api(base, '/api/podium/kanaal/aanmeld', { naam: 'Avond met Vega', genre: 'lifestyle', bio: 'Muziek en verhalen.' }, maker.token);
  assert.equal(aan.status, 200);
  assert.equal(aan.body.kanaal.status, 'wacht');
  kanaalId = aan.body.kanaal.id;
  // nog niet zichtbaar en nog niet live te zetten
  const lijst = await api(base, '/api/podium/kanalen', {}, kijker.token);
  assert.ok(!(lijst.body.kanalen || []).some(k => k.id === kanaalId), 'een wachtend kanaal staat niet in de zaal');
  const live = await api(base, '/api/podium/live', { aan: true }, maker.token);
  assert.equal(live.status, 403, 'live zetten kan pas na goedkeuring');
  assert.ok(/kantoor/i.test(live.body.error), 'de reden noemt kantoor: een mens beslist');
  // kantoor ziet de aanvraag en keurt goed
  const wacht = await api(base, '/api/office/podium', {}, office);
  assert.ok((wacht.body.wacht || []).some(k => k.id === kanaalId));
  const ok = await api(base, '/api/office/podium/beslis', { id: kanaalId, besluit: 'goedgekeurd' }, office);
  assert.equal(ok.status, 200);
  const lijst2 = await api(base, '/api/podium/kanalen', {}, kijker.token);
  assert.ok((lijst2.body.kanalen || []).some(k => k.id === kanaalId), 'na goedkeuring staat het kanaal in de zaal');
});

test('3. live: kijker komt binnen, chat komt aan en het WebRTC-doorgeefluik werkt', async () => {
  const live = await api(base, '/api/podium/live', { aan: true, titel: 'Vrijdagavond' }, maker.token);
  assert.equal(live.status, 200);
  assert.ok(live.body.kanaal.live);
  const kijk = await api(base, '/api/podium/kijk', { id: kanaalId }, kijker.token);
  assert.equal(kijk.status, 200);
  assert.equal(kijk.body.kanaal.live.titel, 'Vrijdagavond');
  // de maker ziet de kijker (op codenaam, nooit op echte naam)
  const mijn = await api(base, '/api/podium/mijn', {}, maker.token);
  assert.ok((mijn.body.kanaal.kijkerLijst || []).some(x => x.codenaam === kijker.codename));
  assert.ok(!JSON.stringify(mijn.body).includes('Lid '), 'nergens een echte naam in het kanaalbeeld');
  // chat en signalering
  const chat = await api(base, '/api/podium/chat', { id: kanaalId, tekst: 'Goedenavond!' }, kijker.token);
  assert.equal(chat.status, 200);
  const kijk2 = await api(base, '/api/podium/kijk', { id: kanaalId }, kijker.token);
  assert.ok((kijk2.body.chat || []).some(r => r.tekst === 'Goedenavond!'));
  const sig = await api(base, '/api/podium/signaal', { id: kanaalId, kind: 'answer', payload: { sdp: 'x' } }, kijker.token);
  assert.equal(sig.status, 200, 'kijker -> maker signaal is een doorgeefluik');
  const sig2 = await api(base, '/api/podium/signaal', { id: kanaalId, doelKey: kijker.key, kind: 'offer', payload: { sdp: 'y' } }, maker.token);
  assert.equal(sig2.status, 200, 'maker -> kijker signaal is een doorgeefluik');
});

test('3b. de relay-boom: kijkers dragen elkaar door, zodat er onbeperkt kunnen kijken', async () => {
  // de bron draagt maar een handvol (FANOUT) directe kijkers; daarna wordt een
  // kijker de ouder van de volgende. 'kijker' (uit test 3) is al kind van de bron.
  const extra = [];
  for (let i = 0; i < 5; i++) extra.push(await nieuwLid('1994-04-04'));
  const ouders = [];
  for (const v of extra) {
    const r = await api(base, '/api/podium/kijk', { id: kanaalId }, v.token);
    assert.equal(r.status, 200);
    ouders.push(r.body.ouder);
  }
  assert.ok(ouders.includes('bron'), 'de eerste kijkers hangen direct aan de bron');
  const kindIdx = ouders.findIndex(o => o && o !== 'bron');
  assert.notEqual(kindIdx, -1, 'zodra de bron vol is, wordt een kijker de ouder van de volgende - zo groeit de boom onbeperkt');
  const kind = extra[kindIdx];
  const allen = [kijker, ...extra];
  const ouder = allen.find(a => a.key === ouders[kindIdx]);
  assert.ok(ouder, 'de toegewezen ouder is een gewone kijker, geen vreemde');

  // het doorgeefluik loopt nu langs de boom: de ouder biedt zijn kind aan, het kind antwoordt terug
  const sigO = await api(base, '/api/podium/signaal', { id: kanaalId, doelKey: kind.key, kind: 'offer', payload: { sdp: 'relay' } }, ouder.token);
  assert.equal(sigO.status, 200, 'een kijker mag de stream doorgeven aan zijn eigen kind');
  const sigA = await api(base, '/api/podium/signaal', { id: kanaalId, kind: 'answer', payload: { sdp: 'ok' } }, kind.token);
  assert.equal(sigA.status, 200, 'het kind antwoordt vanzelf zijn eigen ouder');
  // maar naar een vreemde (niet je ouder, niet je kind) mag het niet
  const vreemde = allen.find(a => a.key !== kind.key && a.key !== ouder.key);
  const sigX = await api(base, '/api/podium/signaal', { id: kanaalId, doelKey: vreemde.key, kind: 'offer', payload: {} }, kind.token);
  assert.equal(sigX.status, 403, 'signaleren naar een vreemde die niet je eigen kind is, kan niet');

  // valt de ouder weg, dan wordt de wees automatisch opnieuw onder een nieuwe ouder gehangen
  await api(base, '/api/podium/weg', { id: kanaalId }, ouder.token);
  const her = await api(base, '/api/podium/kijk', { id: kanaalId }, kind.token);
  assert.equal(her.status, 200);
  assert.notEqual(her.body.ouder, ouders[kindIdx], 'de wees hangt na het vertrek van zijn ouder onder een nieuwe ouder');
  // ruim de extra kijkers weer op zodat de latere tests hun eigen zaal houden
  for (const v of extra) await api(base, '/api/podium/weg', { id: kanaalId }, v.token);
});

test('4. cadeautjes lopen echt via RTG Pay: vaste bedragen, saldo bij de maker', async () => {
  const fout = await api(base, '/api/podium/cadeau', { id: kanaalId, cadeau: 'jacht', idem: 'x1' }, kijker.token);
  assert.equal(fout.status, 400, 'alleen de vaste cadeaucatalogus, geen vrije bedragen');
  const roos = await api(base, '/api/podium/cadeau', { id: kanaalId, cadeau: 'roos', idem: 'x2' }, kijker.token);
  assert.equal(roos.status, 200);
  assert.equal(roos.body.regel.cadeau.centen, 500);
  const zelfde = await api(base, '/api/podium/cadeau', { id: kanaalId, cadeau: 'roos', idem: 'x2' }, kijker.token);
  assert.equal(zelfde.status, 200, 'dubbeltikken met dezelfde idem-sleutel boekt niet dubbel');
  const mijn = await api(base, '/api/podium/mijn', {}, maker.token);
  assert.equal(mijn.body.kanaal.verdiend, 500, 'de maker verdient de roos een keer');
  const pay = await api(base, '/api/pay/overzicht', {}, maker.token);
  assert.equal(pay.body.saldo, 500, 'het geld staat echt in de RTG Pay-wallet van de maker');
});

test('5. abonnement: betaald via RTG Pay en de sleutel tot een abonnee-uitzending', async () => {
  await api(base, '/api/podium/kanaal/zet', { abbCenten: 900 }, maker.token);
  const abb = await api(base, '/api/podium/abonneer', { id: kanaalId, idem: 'a1' }, kijker.token);
  assert.equal(abb.status, 200);
  assert.ok(abb.body.tot, 'het abonnement heeft een einddatum (30 dagen)');
  // alleen-abonnees-uitzending: de abonnee komt binnen, een ander niet
  await api(base, '/api/podium/live', { aan: false }, maker.token);
  await api(base, '/api/podium/live', { aan: true, titel: 'Alleen abonnees', alleenAbonnees: true }, maker.token);
  const dicht = await api(base, '/api/podium/kijk', { id: kanaalId }, derde.token);
  assert.equal(dicht.status, 403, 'zonder abonnement blijft een abonnee-uitzending dicht');
  const open = await api(base, '/api/podium/kijk', { id: kanaalId }, kijker.token);
  assert.equal(open.status, 200);
  const mijn = await api(base, '/api/podium/mijn', {}, maker.token);
  assert.equal(mijn.body.kanaal.abonnees, 1);
  assert.equal(mijn.body.kanaal.verdiend, 500 + 900);
});

test('6. veiligheid in de zaal: de maker blokkeert en een melding landt bij kantoor', async () => {
  const blok = await api(base, '/api/podium/blokkeer', { id: kanaalId, key: kijker.key }, maker.token);
  assert.equal(blok.status, 200);
  const chat = await api(base, '/api/podium/chat', { id: kanaalId, tekst: 'hallo?' }, kijker.token);
  assert.equal(chat.status, 403, 'een geblokkeerde kijker kan niet meer chatten');
  const kijk = await api(base, '/api/podium/kijk', { id: kanaalId }, kijker.token);
  assert.equal(kijk.status, 403, 'en komt de zaal niet meer in');
  const meld = await api(base, '/api/podium/meld', { id: kanaalId, reden: 'Ongepast gedrag in de chat' }, derde.token);
  assert.equal(meld.status, 200);
  const kantoor = await api(base, '/api/office/podium', {}, office);
  assert.ok((kantoor.body.meldingen || []).some(m => /Ongepast/.test(m.reden)), 'de melding ligt bij een mens van kantoor');
});
