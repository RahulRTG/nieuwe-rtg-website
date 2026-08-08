/* HET PODIUM ALS WERELDEN OP EEN MOTOR -- en wat er tussen die werelden NIET
   doorheen komt.

   Het Podium was een product achter een deur (geverifieerd paspoort, 18+). Dat
   maakte de voorziening onbruikbaar voor alles wat die deur niet nodig heeft --
   een schoolstream, een productlancering, een concert -- terwijl de techniek
   eronder voor al die dingen dezelfde is. Nu hoort een kanaal in precies EEN
   zone, en de zone draagt het beleid: wie kijkt, wie zendt, hoe er geld loopt,
   of hij in de gedeelde index staat, en welke wachtrij van het kantoor hem
   behandelt (kern/podium/zones.js).

   WAT HIER BEWEZEN MOET WORDEN is vooral het NIET. Een scheiding die alleen in
   de lijst zit, is geen scheiding: dan haalt een geraden id, een chatbericht of
   een profielkaart hem alsnog op. Elke toets hieronder probeert precies dat.

   En als eerste, want zonder die regel is de hele verhuizing onveilig: NIEMAND
   WINT OF VERLIEST TOEGANG. Wat achter de 18+-deur stond, staat daar nog.

   Draai los: node --experimental-sqlite --test test/podiumzones.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
let volwassen, tweede, jong, kaal;          // vier soorten leden
let beperktId, openId, eventId, beslotenId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-podiumzones-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
// een 1x1 png; de verificatie wil twee beelden zien voordat het kantoor mag beslissen
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function lid(naam, geboren, geverifieerd) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: naam, email: 'pz' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: geboren, geslacht: 'v', tier: 'business', pasApp: 'business' });
  const token = reg.body.token;
  assert.ok(token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 120));
  const st = await api('/api/state', {}, token);
  const codenaam = st.body.state.user.codename;
  if (geverifieerd) {
    await api('/api/verify/upload', { image: PNG }, token);
    await api('/api/verify/selfie', { image: PNG }, token);
    const pend = await api('/api/office/verifications', {}, office);
    const mij = (pend.body.pending || []).find(p => p.codename === codenaam);
    assert.ok(mij, 'de verificatie van ' + naam + ' staat bij het kantoor');
    await api('/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, geslacht: 'v' }, office);
  }
  return { token, codenaam };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'het kantoor is ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de zonelijst zegt per wereld of u erin mag, en waarom niet', async () => {
  kaal = await lid('Kaal lid', '1990-01-01', false);
  const r = await api('/api/podium/kanalen', { zone: 'open' }, kaal.token);
  assert.equal(r.status, 200, 'de open wereld vraagt geen paspoort');
  const zones = r.body.zones;
  assert.ok(Array.isArray(zones) && zones.length >= 5, 'alle werelden staan erbij');

  const beperkt = zones.find(z => z.id === 'beperkt');
  assert.equal(beperkt.kijken, false, 'zonder paspoort niet in de 18+-wereld');
  assert.match(beperkt.kijkReden, /paspoort/, 'met de reden erbij');
  const open = zones.find(z => z.id === 'open');
  assert.equal(open.kijken, true);

  /* De zakenwereld staat OPEN, maar niet voor iemand die nergens werkt: dat is
     een andere weigering dan "deze zone bestaat niet" en dan "u bent te jong".
     De reden hoort dat verschil te dragen, anders gaat iemand de verkeerde
     deur openzetten. */
  const zaak = zones.find(z => z.id === 'zaak');
  assert.ok(!zaak.dicht, 'de zakenwereld is er');
  assert.equal(zaak.kijken, false, 'maar niet voor wie nergens werkt');
  assert.match(zaak.kijkReden, /organisaties/);
  assert.equal(zaak.zenden, false);
  assert.match(zaak.zendReden, /organisatie waar u werkt/);
  assert.deepEqual(zaak.geld, [], 'en er loopt geen geld in een town hall');

  const handel = zones.find(z => z.id === 'handel');
  assert.ok(!handel.dicht, 'de verkoopwereld is er ook');
  assert.equal(handel.kijken, true);
  assert.ok(handel.geld.includes('verkoop'));
});

test('2. de 18+-wereld: eigen deur voor kijken EN zenden', async () => {
  volwassen = await lid('Volwassen maker', '1990-05-05', true);
  // 16 jaar: lid mag vanaf 15, dus dit is het echte geval van 'wel lid, te jong voor deze zone'
  jong = await lid('Jong lid', '2010-01-01', true);

  const dicht = await api('/api/podium/kanalen', { zone: 'beperkt' }, jong.token);
  assert.equal(dicht.status, 403, 'onder de 18 komt die wereld niet open');
  assert.match(dicht.body.error, /18/);
  const zendNiet = await api('/api/podium/kanaal/aanmeld', { naam: 'Te jong', zone: 'beperkt' }, jong.token);
  assert.equal(zendNiet.status, 403, 'en zenden evenmin');

  const aan = await api('/api/podium/kanaal/aanmeld', { naam: 'Late uren', zone: 'beperkt', bio: 'Voor volwassenen.' }, volwassen.token);
  assert.equal(aan.status, 200);
  beperktId = aan.body.kanaal.id;
  assert.equal(aan.body.kanaal.zone, 'beperkt', 'het kanaal draagt zijn zone');
  assert.equal((await api('/api/office/podium/beslis', { id: beperktId, besluit: 'goedgekeurd' }, office)).status, 200);
});

test('3. de scheiding houdt ook als je het id kent', async () => {
  /* Dit is de toets die telt. Een scheiding die alleen in de LIJST zit, is
     geen scheiding: wie het id heeft, haalt hem dan alsnog op via kijken,
     chatten of een cadeau. Alle vier de deuren worden hier geprobeerd. */
  const lijst = await api('/api/podium/kanalen', { zone: 'open' }, kaal.token);
  assert.ok(!(lijst.body.kanalen || []).some(k => k.id === beperktId), 'niet in een andere wereld te zien');

  const kijk = await api('/api/podium/kijk', { id: beperktId }, kaal.token);
  assert.equal(kijk.status, 403, 'en niet te openen met het id');
  assert.match(kijk.body.error, /paspoort/);

  const chat = await api('/api/podium/chat', { id: beperktId, tekst: 'hallo' }, kaal.token);
  assert.ok([403, 409].includes(chat.status), 'en er is niet in te praten');

  const cadeau = await api('/api/podium/cadeau', { id: beperktId, cadeau: 'roos' }, kaal.token);
  assert.equal(cadeau.status, 403, 'en er gaat geen geld heen');

  const meld = await api('/api/podium/meld', { id: beperktId, reden: 'test' }, kaal.token);
  assert.equal(meld.status, 403, 'zelfs melden vraagt eerst de deur van die wereld');
});

test('4. de 18+-wereld staat niet in de gedeelde index van de Media OS', async () => {
  /* De Media OS toont een maker over alle vormen heen. Een kanaal uit een zone
     die niet in de gedeelde index staat, hoort daar niet in te lekken -- ook
     niet bij iemand die er wel in mag. Wie 18+ wil, gaat naar die wereld. */
  /* De kijker hier is met opzet iemand die WEL door de 18+-deur mag: een
     geverifieerd lid van boven de achttien. Anders bewijst deze toets niets
     over de index -- dan houdt de gewone deur hem al tegen, en zou het lek
     zichtbaar blijven zodra iemand die deur wel open heeft. (Beproefd: de
     indexregel weghalen en kijken of deze toets zakt.) */
  const anderVolwassen = await lid('Ander volwassen lid', '1985-06-06', true);
  const deur = await api('/api/podium/kanalen', { zone: 'beperkt' }, anderVolwassen.token);
  assert.equal(deur.status, 200, 'deze kijker mag echt in de 18+-wereld');
  assert.ok((deur.body.kanalen || []).some(k => k.id === beperktId), 'en ziet het kanaal daar staan');

  const profiel = await api('/api/mediaos/maker', { codenaam: volwassen.codenaam }, anderVolwassen.token);
  assert.equal(profiel.status, 200);
  assert.equal(profiel.body.aantallen.live, 0, 'maar op de gedeelde profielkaart staat het niet');
  assert.equal(profiel.body.volg.live, null, 'en er hangt geen volgknop aan');

  const kaalProfiel = await api('/api/mediaos/maker', { codenaam: volwassen.codenaam }, kaal.token);
  assert.equal(kaalProfiel.body.aantallen.live, 0, 'en voor wie er niet in mag al helemaal niet');

  /* En de WERELD zelf, niet alleen de profielkaart: de Media OS leest de zones
     met een gedeelde index (kern/podium/kanaal.js, gedeeld()). Ook daar hoort
     een 18+-kanaal niet in te staan bij iemand die er wel in mag -- anders
     staat het alsnog tussen de muziek en de video's. */
  const wereld = await api('/api/mediaos/wereld', { modus: 'kijk' }, anderVolwassen.token);
  assert.equal(wereld.status, 200);
  assert.ok(!(wereld.body.stukken || []).some(s2 => s2.id === 'live:' + beperktId),
    'het 18+-kanaal staat niet in de gedeelde mediawereld');
  /* Voor de maker ZELF staat hij er wel: dat is zijn eigen kanaal, en zijn
     eigen werk verbergen voor hemzelf is geen scheiding maar een gebrek. */
  const eigen = await api('/api/mediaos/maker', { codenaam: volwassen.codenaam }, volwassen.token);
  assert.equal(eigen.body.aantallen.live, 1, 'de maker ziet zijn eigen kanaal wel');
});

test('5. de open wereld: geen paspoort nodig, en alleen cadeaus', async () => {
  tweede = await lid('Open maker', '1995-02-02', false);
  const aan = await api('/api/podium/kanaal/aanmeld', { naam: 'Zaterdagse les', zone: 'open', genre: 'muziek' }, tweede.token);
  assert.equal(aan.status, 200, 'zenden in de open wereld kan zonder paspoort');
  openId = aan.body.kanaal.id;
  await api('/api/office/podium/beslis', { id: openId, besluit: 'goedgekeurd' }, office);

  const lijst = await api('/api/podium/kanalen', { zone: 'open' }, kaal.token);
  assert.ok((lijst.body.kanalen || []).some(k => k.id === openId), 'en hij staat in die lijst');
  assert.deepEqual(lijst.body.geld, ['cadeau'], 'in deze wereld loopt alleen een cadeau');

  /* De maker zet WEL een abonnementsprijs -- anders zou een weigering ook
     kunnen betekenen "dit kanaal heeft nog geen prijs", en dan bewijst deze
     toets niets over de zone. (Beproefd: de zoneregel weghalen; zonder deze
     prijs bleef de toets staan.) */
  await api('/api/podium/kanaal/zet', { abbCenten: 900 }, tweede.token);
  const abb = await api('/api/podium/abonneer', { id: openId }, kaal.token);
  assert.equal(abb.status, 409, 'een abonnement bestaat hier niet');
  assert.match(abb.body.error, /In deze zone bestaat geen abonnement/,
    'en de reden is de ZONE, niet een ontbrekende prijs');
  const kaartje = await api('/api/podium/kaartje', { id: openId }, kaal.token);
  assert.equal(kaartje.status, 409, 'en een kaartje ook niet');
});

test('6. besloten: wie niet is uitgenodigd, ziet het kanaal niet eens bestaan', async () => {
  const maker = await lid('Coach', '1988-08-08', false);
  const aan = await api('/api/podium/kanaal/aanmeld', { naam: 'Coaching', zone: 'besloten' }, maker.token);
  assert.equal(aan.status, 200);
  beslotenId = aan.body.kanaal.id;
  await api('/api/office/podium/beslis', { id: beslotenId, besluit: 'goedgekeurd' }, office);

  const buiten = await api('/api/podium/kanalen', { zone: 'besloten' }, kaal.token);
  assert.equal(buiten.status, 200);
  assert.ok(!(buiten.body.kanalen || []).some(k => k.id === beslotenId), 'een vreemde ziet hem niet staan');
  const kijk = await api('/api/podium/kijk', { id: beslotenId }, kaal.token);
  assert.equal(kijk.status, 403);
  assert.match(kijk.body.error, /nodigt uit/);

  const nodig = await api('/api/podium/nodig', { id: beslotenId, codenaam: kaal.codenaam }, maker.token);
  assert.equal(nodig.status, 200, 'de maker nodigt uit op codenaam');
  const na = await api('/api/podium/kanalen', { zone: 'besloten' }, kaal.token);
  assert.ok((na.body.kanalen || []).some(k => k.id === beslotenId), 'daarna staat hij er wel');

  // en een vreemde kan niet zichzelf uitnodigen
  const zelf = await api('/api/podium/nodig', { id: beslotenId, codenaam: kaal.codenaam }, kaal.token);
  assert.equal(zelf.status, 403, 'alleen de maker nodigt uit');
});

test('7. events: zonder kaartje kom je er niet in, met kaartje wel', async () => {
  const maker = await lid('Zaalhouder', '1980-04-04', false);
  const aan = await api('/api/podium/kanaal/aanmeld', { naam: 'Concert', zone: 'evenement' }, maker.token);
  assert.equal(aan.status, 200);
  eventId = aan.body.kanaal.id;
  await api('/api/office/podium/beslis', { id: eventId, besluit: 'goedgekeurd' }, office);

  const zonder = await api('/api/podium/kijk', { id: eventId }, kaal.token);
  assert.equal(zonder.status, 403);
  assert.equal(zonder.body.kaartje, true, 'het antwoord zegt dat het aan een kaartje ligt');

  const geenPrijs = await api('/api/podium/kaartje', { id: eventId }, kaal.token);
  assert.equal(geenPrijs.status, 409, 'zonder kaartprijs valt er niets te kopen');
  await api('/api/podium/kanaal/zet', { kaartCenten: 1200 }, maker.token);

  const koop = await api('/api/podium/kaartje', { id: eventId, idem: 'k1' }, kaal.token);
  assert.equal(koop.status, 200, 'het kaartje loopt via RTG Pay: ' + JSON.stringify(koop.body).slice(0, 120));
  assert.ok(koop.body.tot, 'en het loopt af');
  const nogeens = await api('/api/podium/kaartje', { id: eventId, idem: 'k1' }, kaal.token);
  assert.equal(nogeens.status, 200, 'dezelfde idem koopt geen tweede kaartje');
  assert.equal(nogeens.body.tot, koop.body.tot);

  /* Met kaartje mag hij binnen -- en dat is 409 (niet live) in plaats van 403
     (mag niet), want dat is een heel ander antwoord. */
  const met = await api('/api/podium/kijk', { id: eventId }, kaal.token);
  assert.equal(met.status, 409, 'de deur is open; er is alleen nog niets te zien');
});
