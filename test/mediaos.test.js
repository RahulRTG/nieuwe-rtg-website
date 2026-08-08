/* De Media OS: één mediawereld over Klankwerk (muziek), Theater (video),
   Clips (korte video) en Podium (live) heen. Wat hier bewezen moet worden is
   vooral wat de laag NIET doet: geen tweede administratie naast de vier
   domeinen, geen stil weggelaten stuk, geen verzonnen cijfer en geen betaald
   abonnement dat meelift op een gratis volgknop.
   Draai los: node --experimental-sqlite --test test/mediaos.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, maker, kijker, kale, office;
let clipId, trackId, uitgaveId, videoId, kanaalId, makerNaam, kijkerNaam;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mediaos-'));
// een minimale, geldige webm-kop; het Theater weigert alles wat geen video is
const WEBM = Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(600, 7)]);

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'mos' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}
const codenaamVan = async (token) => ((await api('/api/state', {}, token)).body.state || {}).user.codename;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  maker = await lid('Maker'); kijker = await lid('Kijker'); kale = await lid('Kale');
  assert.ok(maker && kijker && kale, 'drie leden zijn ingelogd');
  makerNaam = await codenaamVan(maker); kijkerNaam = await codenaamVan(kijker);
  assert.ok(makerNaam && kijkerNaam, 'beiden hebben een codenaam');

  // werk van de maker: een korte video, en een uitgegeven muziekstuk eronder
  clipId = (await api('/api/clips/maak', { titel: 'Haven bij zonsopgang', duurS: 20, mbGeschat: 4 }, maker)).body.id;
  trackId = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Middernacht', klaar: true }, maker);
  const u = await api('/api/muziek/uitgeven', { id: trackId, toelichting: 'Eerste stuk' }, maker);
  assert.equal(u.status, 200, 'het stuk is uitgegeven');
  uitgaveId = u.body.uitgave.id;
  // en de clip draagt dat eigen stuk als geluid: de enige echte brug track <-> clip
  const g = await api('/api/clips/geluid', { id: clipId, soort: 'muziek', muziek: trackId }, maker);
  assert.equal(g.status, 200, 'de clip draagt het eigen stuk als geluid');

  /* En een video in het Theater, want dat is de vierde vorm en de enige die
     hier ECHT afspeelt (bereik-streaming). Een kanaal gaat pas open na een
     mens bij het kantoor -- die regel geldt ook als de Media OS erboven hangt. */
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  kanaalId = (await api('/api/theater/kanaal/aanmeld',
    { naam: 'Atelier Vega', genre: 'ambacht', bio: 'Handwerk in beeld.' }, maker)).body.kanaal.id;
  assert.equal((await api('/api/office/theater/beslis', { id: kanaalId, besluit: 'goedgekeurd' }, office)).status, 200);
  videoId = (await api('/api/theater/video/maak', { titel: 'De werkbank', omschrijving: 'Een middag hout.', duurS: 74 }, maker)).body.id;
  const up = await fetch(base + '/api/theater/upload/' + videoId, {
    method: 'POST', headers: { 'Content-Type': 'video/webm', Authorization: 'Bearer ' + maker }, body: WEBM });
  assert.equal(up.status, 200, 'de bytes staan op de kaart');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de deur: zonder inlog niets, en een gast komt er niet in', async () => {
  assert.equal((await api('/api/mediaos/wereld', {})).status, 401, 'zonder token: 401');
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.ok(gast, 'er is een gasttoken');
  const r = await api('/api/mediaos/wereld', {}, gast);
  assert.equal(r.status, 403, 'een gast krijgt 403');
  assert.match(r.body.error, /voor leden/);
});

test('2. één catalogus, drie standen: elke vorm komt in zijn eigen stand terug', async () => {
  const flow = await api('/api/mediaos/wereld', { modus: 'flow' }, kijker);
  assert.equal(flow.status, 200);
  const clip = flow.body.stukken.find(s => s.id === 'clip:' + clipId);
  assert.ok(clip, 'de clip staat in FLOW, met het universele id clip:<id>');
  assert.equal(clip.vorm, 'clip');
  assert.equal(clip.maker.codenaam, makerNaam, 'op codenaam, nooit op naam');
  /* Een clip speelt WEL in dit scherm, maar niet langs RTG: de bytes staan op
     het toestel van de maker. Daarom draagt hij alles wat de gedeelde
     clipdeler nodig heeft om hem te tonen zoals de maker hem bedoelde. */
  assert.equal(clip.spelen.soort, 'p2p');
  assert.equal(clip.spelen.bron, '/apps/clips.html', 'en waar een scherm zonder die laag hem alsnog kan kijken');
  assert.match(clip.spelen.reden, /RTG heeft die bytes niet/);
  assert.equal(clip.online, true, 'de maker is net actief geweest');
  assert.deepEqual(clip.ondertitels, []);
  assert.equal(clip.knip, null);
  assert.ok(!flow.body.stukken.some(s => s.vorm === 'track'), 'FLOW bevat geen muziek');

  const muziek = await api('/api/mediaos/wereld', { modus: 'muziek' }, kijker);
  const track = muziek.body.stukken.find(s => s.id === 'track:' + uitgaveId);
  assert.ok(track, 'de uitgave staat in MUZIEK');
  assert.equal(track.spelen.soort, 'motor', 'muziek speelt op het toestel zelf, er reist geen bestand');
  assert.ok(!muziek.body.stukken.some(s => s.vorm === 'clip'), 'MUZIEK bevat geen clips');

  const alles = await api('/api/mediaos/wereld', { modus: 'alles' }, kijker);
  assert.ok(alles.body.stukken.some(s => s.id === 'clip:' + clipId), 'ALLES bevat de clip');
  assert.ok(alles.body.stukken.some(s => s.id === 'track:' + uitgaveId), 'ALLES bevat de uitgave');
  assert.ok(alles.body.einde, 'de wereld heeft een expliciet einde (geen oneindige feed)');
});

test('2b. de video-kant: onderwerp uit het kanaal, streamen uit het Theater, eigen werk als eigen', async () => {
  const kijk = await api('/api/mediaos/wereld', { modus: 'kijk' }, kijker);
  const v = kijk.body.stukken.find(s => s.id === 'video:' + videoId);
  assert.ok(v, 'de video staat in KIJK');
  assert.equal(v.onderwerp, 'ambacht', 'het genre van het kanaal is het onderwerp waarop u kunt bijsturen');
  assert.equal(v.spelen.soort, 'stream');
  assert.equal(v.spelen.bron, '/api/theater/kijk/' + videoId, 'kijken loopt langs het Theater zelf, niet langs een tweede route');
  assert.equal(v.mijn, false, 'niet van de kijker');
  assert.equal(v.volgIk, false, 'nog geen abonnement op dit kanaal');

  const eigen = await api('/api/mediaos/wereld', { modus: 'kijk' }, maker);
  const mijn = eigen.body.stukken.find(s => s.id === 'video:' + videoId);
  assert.equal(mijn.mijn, true, 'voor de maker is het zijn eigen werk');
  assert.equal(mijn.waarom, 'Van uzelf.');

  /* Een kaart zonder bytes hoort NIET in een wereld met een speelknop. Dit is
     de enige plek waar dat te zien is, want alleen het eigen kanaal toont
     zulke kaarten. */
  const leeg = await api('/api/theater/video/maak', { titel: 'Nog niets erop', duurS: 10 }, maker);
  assert.equal(leeg.status, 200);
  const na = await api('/api/mediaos/wereld', { modus: 'kijk' }, maker);
  assert.ok(!na.body.stukken.some(s => s.id === 'video:' + leeg.body.id), 'een lege kaart staat niet in de wereld');
  await api('/api/theater/verwijder', { id: leeg.body.id }, maker);
});

test('2c. volgen zet nu ook het Theaterkanaal, in het domein zelf', async () => {
  const v = await api('/api/mediaos/volg', { codenaam: makerNaam }, kijker);
  assert.equal(v.status, 200);
  assert.deepEqual(v.body.in.sort(), ['clips', 'theater'], 'beide gratis volgrelaties, in één knop');
  const zaal = await api('/api/theater/zaal', {}, kijker);
  assert.ok((zaal.body.abonnementen || []).some(x => x.id === videoId),
    'het Theater zelf zet de video nu onder abonnementen -- daar staat de waarheid');
  const w = await api('/api/mediaos/wereld', { modus: 'kijk' }, kijker);
  const s = w.body.stukken.find(x => x.id === 'video:' + videoId);
  assert.equal(s.volgIk, true);
  assert.equal(s.band, 0, 'wie u volgt staat vooraan');
});

test('3. een bron die dicht is, valt niet stil weg maar staat erbij met reden', async () => {
  // het Podium eist 18+ en verificatie; dit lid heeft dat niet
  const podium = await api('/api/podium/kanalen', {}, kijker);
  assert.equal(podium.status, 403, 'het Podium weigert dit lid');
  assert.ok(podium.body.error, 'met een reden');
  const w = await api('/api/mediaos/wereld', { modus: 'kijk' }, kijker);
  const buiten = w.body.buiten.find(b => b.vorm === 'live');
  assert.ok(buiten, 'de wereld meldt dat de live-bron buiten staat');
  assert.equal(buiten.reden, podium.body.error, 'met exact de reden van het Podium zelf');
  /* Maar alleen in de stand waar live IN zit. Onder FLOW hoort die melding niet
     te staan -- daar gaat het over clips, en een dichte deur van een ander
     domein noemen stuurt de lezer de verkeerde kant op. */
  const flow = await api('/api/mediaos/wereld', { modus: 'flow' }, kijker);
  assert.deepEqual(flow.body.buiten, [], 'FLOW noemt de live-deur niet');
});

test('4. volgen schrijft in het domein zelf, niet in een tweede lijst', async () => {
  const v = await api('/api/mediaos/volg', { codenaam: makerNaam }, kijker);
  assert.equal(v.status, 200);
  assert.deepEqual(v.body.in.sort(), ['clips', 'theater'], 'één knop, twee gratis volgrelaties');
  // het bewijs staat in het domein: de clips-feed zelf zegt nu volgIk
  const feed = await api('/api/clips/feed', {}, kijker);
  const c = feed.body.clips.find(x => x.id === clipId);
  assert.equal(c.volgIk, true, 'Clips houdt de volgrelatie vast, de Media OS niet');
  assert.match(v.body.let, /kost een maandbedrag/, 'een betaald livekanaal lift niet mee op de gratis volgknop');

  const uit = await api('/api/mediaos/volg', { codenaam: makerNaam, aan: false }, kijker);
  assert.equal(uit.status, 200);
  const feed2 = await api('/api/clips/feed', {}, kijker);
  assert.equal(feed2.body.clips.find(x => x.id === clipId).volgIk, false, 'ontvolgen komt ook in het domein aan');
  const zaal2 = await api('/api/theater/zaal', {}, kijker);
  assert.equal((zaal2.body.abonnementen || []).length, 0, 'en het Theaterkanaal is ook echt weer los');
  await api('/api/mediaos/volg', { codenaam: makerNaam }, kijker);
});

test('5. volgen van iemand zonder volgbaar werk weigert, en zegt waarom', async () => {
  const kaleNaam = await codenaamVan(kale);
  const r = await api('/api/mediaos/volg', { codenaam: kaleNaam }, kijker);
  assert.equal(r.status, 409, 'geen clip en geen kanaal: geen volgrelatie om te zetten');
  assert.match(r.body.error, /nog niets/);
  assert.equal((await api('/api/mediaos/volg', { codenaam: 'bestaat-niet-xyz' }, kijker)).status, 404);
  assert.equal((await api('/api/mediaos/volg', { codenaam: makerNaam }, maker)).status, 400, 'uzelf volgen hoeft niet');
});

test('6. bij elk stuk staat waarom het er staat, en wie u volgt komt vooraan', async () => {
  const w = await api('/api/mediaos/wereld', { modus: 'flow' }, kijker);
  const clip = w.body.stukken.find(s => s.id === 'clip:' + clipId);
  assert.equal(clip.band, 0, 'een gevolgde maker staat in de eerste band');
  assert.equal(clip.waarom, 'U volgt ' + makerNaam + '.', 'de uitleg noemt de echte reden');
  assert.match(w.body.uitleg, /geen hitlijst/, 'er is geen volgorde op populariteit');
  const eigen = await api('/api/mediaos/wereld', { modus: 'flow' }, maker);
  assert.equal(eigen.body.stukken.find(s => s.id === 'clip:' + clipId).waarom, 'Van uzelf.');
});

test('7. de regelaars sturen echt bij: minder zakt, nooit valt eruit -- geteld', async () => {
  const minder = await api('/api/mediaos/stuur', { richting: 'minder', maker: makerNaam }, kijker);
  assert.equal(minder.status, 200);
  const w1 = await api('/api/mediaos/wereld', { modus: 'flow' }, kijker);
  const c1 = w1.body.stukken.find(s => s.id === 'clip:' + clipId);
  assert.equal(c1.band, 3, 'minder zet het stuk achteraan');
  assert.match(c1.waarom, /minder/, 'en zegt dat ook');

  const nooit = await api('/api/mediaos/stuur', { richting: 'nooit', maker: makerNaam }, kijker);
  assert.equal(nooit.status, 200);
  const w2 = await api('/api/mediaos/wereld', { modus: 'flow' }, kijker);
  assert.ok(!w2.body.stukken.some(s => s.id === 'clip:' + clipId), 'nooit haalt het stuk uit de wereld');
  const weg = w2.body.weggelaten.find(x => x.id === 'clip:' + clipId);
  assert.ok(weg, 'maar het verdwijnt niet stil: het staat in weggelaten');
  assert.equal(weg.reden, 'u wilt niets van ' + makerNaam);

  const terug = await api('/api/mediaos/stuur', { richting: 'reset', maker: makerNaam }, kijker);
  assert.equal(terug.status, 200);
  const w3 = await api('/api/mediaos/wereld', { modus: 'flow' }, kijker);
  assert.ok(w3.body.stukken.some(s => s.id === 'clip:' + clipId), 'reset draait het terug');
  assert.equal((await api('/api/mediaos/stuur', { richting: 'meer' }, kijker)).status, 400, 'meer zonder doel is geen opdracht');
  assert.equal((await api('/api/mediaos/stuur', { richting: 'hoger' }, kijker)).status, 400, 'onbekende richting weigert');
});

test('8. de stuk-hub verbindt alleen wat er echt ligt: dezelfde maker, hetzelfde geluid', async () => {
  const h = await api('/api/mediaos/stuk', { id: 'track:' + uitgaveId }, kijker);
  assert.equal(h.status, 200);
  assert.equal(h.body.stuk.titel, 'Middernacht');
  assert.equal(h.body.gebruiktAls.length, 1, 'één korte video draagt dit stuk als geluid');
  assert.equal(h.body.gebruiktAls[0].id, 'clip:' + clipId, 'en dat is precies die clip');
  assert.ok(h.body.verwant.flow.some(x => x.id === 'clip:' + clipId), 'ander werk van dezelfde maker staat erbij');
  assert.equal((await api('/api/mediaos/stuk', { id: 'clip' }, kijker)).status, 400, 'een id zonder vorm is geen id');
  assert.equal((await api('/api/mediaos/stuk', { id: 'video:bestaatniet' }, kijker)).status, 404);
});

test('9. één maker, één profiel: alle vormen bij elkaar, met één volgstand', async () => {
  const p = await api('/api/mediaos/maker', { codenaam: makerNaam }, kijker);
  assert.equal(p.status, 200);
  assert.equal(p.body.aantallen.muziek, 1);
  assert.equal(p.body.aantallen.flow, 1);
  assert.equal(p.body.volg.aan, true, 'de kijker volgt hem (uit stap 4)');
  assert.equal(p.body.volg.clips, true);
  assert.equal(p.body.volg.theater, true, 'en op het Theaterkanaal van dezelfde maker');
  assert.equal(p.body.aantallen.video, 1, 'zijn video hoort bij hetzelfde profiel');
  assert.equal(p.body.maker.zelf, false);
  const zelf = await api('/api/mediaos/maker', { codenaam: makerNaam }, maker);
  assert.equal(zelf.body.maker.zelf, true);
  assert.equal((await api('/api/mediaos/maker', { codenaam: 'niemand-xyz' }, kijker)).status, 404);
});

test('10. de bibliotheek bewaart een id; een weggehaald stuk staat als verdwenen', async () => {
  assert.equal((await api('/api/mediaos/bewaar', { id: 'onzin' }, kijker)).status, 400, 'geen geldig id');
  const b = await api('/api/mediaos/bewaar', { id: 'clip:' + clipId }, kijker);
  assert.equal(b.status, 200);
  assert.equal(b.body.aantal, 1);
  const bieb = await api('/api/mediaos/bieb', {}, kijker);
  assert.equal(bieb.body.stukken.length, 1);
  assert.equal(bieb.body.stukken[0].id, 'clip:' + clipId);

  // de maker haalt zijn clip weg: de bibliotheek liegt daar niet overheen
  assert.equal((await api('/api/clips/weg', { id: clipId }, maker)).status, 200);
  const na = await api('/api/mediaos/bieb', {}, kijker);
  assert.equal(na.body.stukken.length, 0);
  assert.equal(na.body.verdwenen.length, 1, 'het bewaarde stuk staat als verdwenen');
  assert.match(na.body.uitleg, /weggehaald/);
  const uit = await api('/api/mediaos/bewaar', { id: 'clip:' + clipId, aan: false }, kijker);
  assert.equal(uit.body.aantal, 0);
});

test('11. het makersbord telt alleen wat er echt geteld wordt, en zegt wat niet', async () => {
  const b = await api('/api/mediaos/bord', {}, maker);
  assert.equal(b.status, 200);
  assert.equal(b.body.werk.muziek.stukken, 1, 'één uitgave');
  assert.equal(b.body.werk.flow.stukken, 0, 'de clip is net weggehaald');
  assert.equal(b.body.werk.video.stukken, 1, 'één video');
  assert.equal(b.body.werk.video.kanaal, 'Atelier Vega');
  assert.equal(b.body.werk.video.status, 'goedgekeurd');
  assert.equal(b.body.relatie.theaterVolgers, 1, 'de kijker volgt zijn kanaal (uit toets 12 komt clips erbij)');
  assert.equal(b.body.geld.podiumVerdiendCenten, 0);
  assert.ok(b.body.nietGeteld.length >= 3, 'wat niet geteld wordt, staat met naam op het bord');
  assert.ok(b.body.nietGeteld.some(x => /kijktijd/.test(x)));
});

test('11c. nieuw werk wekt de volgers die dat soort aan hebben staan -- en niemand anders', async () => {
  /* De andere kant van de meldingsvoorkeur. De kijker volgt de maker (uit
     toets 2c/4) en zet zijn voorkeur op ALLEEN muziek. Dan geeft de maker een
     tweede stuk uit: dat moet aankomen. Daarna maakt hij een clip: die mag
     juist NIET aankomen, want daar heeft de kijker niet om gevraagd. Zonder
     dat tweede deel toetst dit alleen "er komt iets binnen". */
  const melding = async (token) => (await api('/api/privacy/export', {}, token)).body.notifications || [];
  await api('/api/mediaos/meldingen', { codenaam: makerNaam, soorten: ['muziek'] }, kijker);
  const voor = (await melding(kijker)).length;

  const t2 = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: t2, naam: 'Ochtendlicht', klaar: true }, maker);
  assert.equal((await api('/api/muziek/uitgeven', { id: t2 }, maker)).status, 200);
  const na = await melding(kijker);
  assert.equal(na.length, voor + 1, 'er is precies één melding bijgekomen');
  assert.equal(na[0].title, 'RTG Media');
  assert.match(na[0].body, new RegExp(makerNaam + ': nieuwe muziek -- "Ochtendlicht"'));

  const clip = await api('/api/clips/maak', { titel: 'Stil straatje', duurS: 8, mbGeschat: 1 }, maker);
  assert.equal(clip.status, 200);
  assert.equal((await melding(kijker)).length, voor + 1, 'een clip wekt hem niet: daar vroeg hij niet om');

  /* En de maker wordt nooit over zijn eigen werk gewekt. Dat is geen dode
     regel: het Theater laat een maker zich wél op zijn eigen kanaal
     abonneren, en dan staat hij dus in zijn eigen volgerslijst. Zonder de
     uitzondering in wekken.js krijgt hij hieronder zijn eigen uitgave terug. */
  assert.equal((await api('/api/theater/abonneer', { kanaalId, aan: true }, maker)).status, 200);
  const t3 = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: t3, naam: 'Eigen echo', klaar: true }, maker);
  assert.equal((await api('/api/muziek/uitgeven', { id: t3 }, maker)).status, 200);
  assert.ok(!(await melding(maker)).some(n => n.title === 'RTG Media'), 'geen melding over je eigen werk');
  await api('/api/theater/abonneer', { kanaalId, aan: false }, maker);
  await api('/api/clips/weg', { id: clip.body.id }, maker);
});

test('11d. een lege stand zegt wat er komt en waarom hij leeg is', async () => {
  /* De kale gebruiker ziet in FLOW niets: er is geen clip van iemand anders.
     Dan hoort er geen leeg raster te staan maar uitleg -- wat hier komt,
     waarom het er nu niet is, en een stap die echt bestaat. */
  const flow = await api('/api/mediaos/wereld', { modus: 'flow' }, kale);
  assert.equal(flow.body.stukken.length, 0);
  assert.ok(flow.body.leeg, 'een lege stand draagt uitleg');
  assert.equal(flow.body.leeg.reden, 'niets');
  assert.match(flow.body.leeg.wat, /toestel van de maker/, 'en zegt waarom dat zo werkt');
  /* En NIET de reden van een andere stand: het Podium staat voor dit lid dicht
     (geen geverifieerd paspoort), maar live hoort niet in FLOW. Een scherm dat
     vriendelijk de verkeerde deur aanwijst, stuurt iemand de verkeerde kant op. */
  assert.ok(!/paspoort/.test(flow.body.leeg.waarom), 'geen deur van een andere stand erbij gehaald');
  assert.ok(flow.body.leeg.stappen.length >= 1, 'met een stap die echt bestaat');
  for (const st of flow.body.leeg.stappen) {
    assert.match(st.pad, /^\/apps\/[a-z]+\.html$/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', st.pad)), st.pad + ' bestaat als scherm');
  }

  // en zodra er iets staat, verdwijnt de lege stand
  const muziek = await api('/api/mediaos/wereld', { modus: 'muziek' }, kale);
  assert.ok(muziek.body.stukken.length > 0, 'muziek staat er wel: die stand vult de eigen klankmotor');
  assert.equal(muziek.body.leeg, null, 'dan hoort er geen lege stand te staan');
});

test('11e. de drie redenen van een lege stand, elk apart', () => {
  /* De keuze tussen die redenen is pure rekenkunde en hoort los getoetst: via
     de route krijg je er hooguit een te pakken, want de andere twee vragen een
     wereld die je in dezelfde installatie niet tegelijk hebt. */
  const { legeStand } = require('../server/kern/mediaos/leeg');
  const dichtLive = [{ vorm: 'live', vormNaam: 'Live', reden: 'Activeer eerst uw paspoort.' }];

  const niets = legeStand('flow', dichtLive, [], ['clip']);
  assert.equal(niets.reden, 'niets', 'een dichte bron van een ANDERE stand telt hier niet');
  assert.ok(!/paspoort/.test(niets.waarom));

  const deur = legeStand('kijk', dichtLive, [], ['video', 'live']);
  assert.equal(deur.reden, 'deur');
  assert.match(deur.waarom, /Live: Activeer eerst uw paspoort\./, 'met de reden van het domein zelf');

  const ikzelf = legeStand('flow', dichtLive, [{ id: 'clip:a', reden: 'u wilt niets van X' }], ['clip']);
  assert.equal(ikzelf.reden, 'ikzelf', 'uw eigen regelaars gaan voor: die kunt u zelf terugdraaien');
  assert.match(ikzelf.waarom, /1 stuk\)/);
  assert.equal(legeStand('flow', dichtLive, [{}, {}], ['clip']).waarom.includes('2 stukken'), true);
});

test('11f. de stand MUZIEK is nooit leeg op een demo-installatie, en het speelt echt', async () => {
  /* Van de vier vormen is muziek de enige die dit huis ZELF kan opwekken: een
     uitgave is geen bestand maar een rij getallen die het toestel uitrekent.
     Daarom staan er vijf geseede stukken (server/seed/media.js) en de andere
     drie standen niet -- een geseede clip zou eeuwig "maker offline" zijn.

     Deze toets kijkt of ze er staan EN of ze klinken: een uitgave zonder noten
     is een kaart met een knop die niets doet. */
  const w = await api('/api/mediaos/wereld', { modus: 'muziek' }, kale);
  const namen = w.body.stukken.map(x => x.titel);
  for (const naam of ['Avondlicht', 'Kade bij nacht', 'Ochtendrust', 'Zonsopgang boven de baai', 'Late vergadering']) {
    assert.ok(namen.includes(naam), naam + ' staat in de stand MUZIEK');
  }
  const avond = w.body.stukken.find(x => x.titel === 'Avondlicht');
  assert.equal(avond.spelen.soort, 'motor');
  const speel = await api('/api/muziek/uitgave', { id: avond.spelen.bron }, kale);
  assert.equal(speel.status, 200);
  const kanalen = speel.body.uitgave.kanalen || [];
  assert.ok(kanalen.length >= 4, 'er zitten echte kanalen in (' + kanalen.length + ')');
  const gevuld = kanalen.filter(k => (k.stappen || []).length || (k.noten || []).length);
  assert.equal(gevuld.length, kanalen.length, 'en elk kanaal draagt stappen of noten -- anders klinkt er niets');
  assert.equal(speel.body.uitgave.stappen, 16 * speel.body.uitgave.maten);

  // de tempo's verschillen per stijl; vijf keer hetzelfde getal zou een tabel zijn die niet leest
  const bpms = new Set(w.body.stukken.filter(x => /Avondlicht|Kade|Ochtendrust|Zonsopgang|Late verg/.test(x.titel))
    .map(x => Number((x.meta.match(/^(\d+) slagen/) || [])[1])));
  assert.ok(bpms.size >= 3, 'de stukken staan niet allemaal op hetzelfde tempo (' + [...bpms].join(',') + ')');

  // en in productie begint het huis leeg: demo-inhoud hoort daar niet
  const versProces = require('child_process').execFileSync(process.execPath,
    ['-e', 'process.env.NODE_ENV="production"; delete process.env.RTG_DEMO;' +
      ' console.log(require("' + path.join(__dirname, '..', 'server', 'seed').replace(/\\/g, '/') + '")().muziekUitgaven.lijst.length)'],
    { encoding: 'utf8' }).trim();
  assert.equal(versProces, '0', 'in productie staat er geen geseede muziek');
});

test('11b. Rahul kan hier zelf aan draaien: de paden staan op zijn kaart', async () => {
  /* Het AI-stuur (kern/stuur.js) leest de router en houdt geen eigen lijst bij,
     dus een nieuw domein valt er vanzelf onder -- MITS het geen werk-pad is en
     niet op de verbodslijst staat. Dat is precies wat "Rahul als mediacurator"
     mogelijk maakt: "zet eens iets anders op" is een gewone aanroep met de
     inlog en de rechten van het lid zelf. Deze toets legt dat vast, want het
     is een bewering over gedrag en niet over een lijst. */
  const kaart = await api('/api/member/doe/kaart', {}, kijker);
  assert.equal(kaart.status, 200);
  for (const pad of ['/api/mediaos/wereld', '/api/mediaos/stuur', '/api/mediaos/volg', '/api/mediaos/stuk']) {
    assert.ok(kaart.body.paden.includes(pad), pad + ' staat op de kaart van het stuur');
  }
});

test('12. meldingen per maker: één keer volgen, zelf kiezen waarvoor', async () => {
  const m = await api('/api/mediaos/meldingen', { codenaam: makerNaam, soorten: ['muziek', 'live', 'onzin'] }, kijker);
  assert.equal(m.status, 200);
  assert.deepEqual(m.body.soorten, ['muziek', 'live'], 'een verzonnen soort wordt weggegooid, niet overgenomen');
  assert.match(m.body.let, /wekt de volgers/, 'en het antwoord zegt wat er met die voorkeur gebeurt');
  // toets 10 haalde de clip weg; zonder volgbaar werk is er niets om aan te haken
  const nieuw = await api('/api/clips/maak', { titel: 'Tweede clip', duurS: 12, mbGeschat: 2 }, maker);
  assert.equal(nieuw.status, 200);
  const v = await api('/api/mediaos/volg', { codenaam: makerNaam }, kijker);
  assert.equal(v.status, 200, 'nu is er weer werk om te volgen');
  assert.deepEqual(v.body.meldingen, ['muziek', 'live'], 'de keuze blijft staan over het volgen heen');
  assert.equal((await api('/api/mediaos/meldingen', { soorten: ['muziek'] }, kijker)).status, 400, 'zonder maker geen voorkeur');
});
