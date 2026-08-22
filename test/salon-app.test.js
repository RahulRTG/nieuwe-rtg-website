/* De Salon als volwaardige app (kern/salon/*, routes/member/salonapp.js).
   Wat hier bewezen wordt is precies wat er in deze ronde veranderde: leden
   kunnen zelf plaatsen, de muur van 60 posts is weg en vervangen door echte
   paginering, er zijn profielen en draadjes, en de AI stelt voor zonder ooit
   zelf te plaatsen.
   Draai los: node --test test/salon-app.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-salonapp-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 's' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-03-03', tier: 'rtg' }));
  const p = await json(await raw('/salon/lid', { wie: 'ik' }, r.token));
  return { token: r.token, codenaam: p.codenaam };
}

test('een lid plaatst zelf, met meerdere foto\'s en onderwerpen', async () => {
  const a = await lid();
  const punt = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const r = await json(await raw('/salon/plaats', {
    tekst: 'De ochtend boven de baai, stil. #ochtend #zee',
    plaats: 'Ibiza',
    media: [{ beeld: punt, alt: 'De baai bij zonsopkomst' }, { beeld: punt, alt: 'De kade' }]
  }, a.token));
  assert.ok(r.ok, r.error);
  assert.equal(r.post.media.length, 2, 'de karrousel houdt beide foto\'s');
  assert.ok(r.post.media.every(m => m.src && !m.src.startsWith('data:')), 'beeld gaat naar de mediastore, niet als base64 de database in');
  assert.deepEqual(r.post.onderwerpen, ['ochtend', 'zee']);
  assert.equal(r.post.vanMij, true);

  // een lege post is geen post
  const leeg = await json(await raw('/salon/plaats', { tekst: '   ' }, a.token));
  assert.ok(leeg.error, 'zonder tekst en zonder foto komt er niets in de Salon');
});

test('je eigen post staat altijd in je eigen profiel', async () => {
  const a = await lid();
  await raw('/salon/plaats', { tekst: 'Een eerste notitie in De Salon.' }, a.token);
  const p = await json(await raw('/salon/lid', { wie: 'ik' }, a.token));
  assert.ok(p.ok && p.ikZelf);
  assert.ok(p.posts >= 1, 'je eigen post is zichtbaar zonder dat iemand hem viraal maakt');
  assert.ok(p.raster.posts.some(x => x.text === 'Een eerste notitie in De Salon.'));
});

test('Mooi zet de gewenste stand expliciet en kan die ook weer terugzetten', async () => {
  const a = await lid();
  const geplaatst = await json(await raw('/salon/plaats', { tekst: 'Een moment om te bewaren.' }, a.token));
  const id = geplaatst.post.id;

  const aan = await json(await raw('/like', { postId: id, liked: true }, a.token));
  assert.equal(aan.likes, 1);
  let feed = await json(await raw('/salon/feed', {}, a.token));
  let post = feed.posts.find(p => p.id === id);
  assert.ok(post && post.liked && post.likes === 1, 'de feed leest dezelfde gekozen stand terug');

  const uit = await json(await raw('/like', { postId: id, liked: false }, a.token));
  assert.equal(uit.likes, 0);
  feed = await json(await raw('/salon/feed', {}, a.token));
  post = feed.posts.find(p => p.id === id);
  assert.ok(post && !post.liked && post.likes === 0, 'de tweede keuze zet Mooi weer uit');
});

test('de muur van 60 is weg: paginering loopt er straal doorheen', async () => {
  const a = await lid();
  for (let i = 0; i < 65; i++) await raw('/salon/plaats', { tekst: 'Notitie nummer ' + i + ' #reeks' }, a.token);

  const p1 = await json(await raw('/salon/lid', { wie: 'ik' }, a.token));
  assert.ok(p1.posts >= 65, 'post 1 wordt niet meer stilletjes weggeduwd door post 61, maar er zijn er ' + p1.posts);

  // blader door tot het einde en tel wat je onderweg krijgt
  let na = null, gezien = 0, bladzijden = 0;
  for (;;) {
    const f = await json(await raw('/salon/feed', { onderwerp: 'reeks', na }, a.token));
    assert.ok(f.ok, f.error);
    gezien += f.posts.length; bladzijden++;
    if (!f.meer || !f.volgende || bladzijden > 20) break;
    na = f.volgende;
  }
  assert.equal(gezien, 65, 'elke post uit de reeks komt precies een keer langs');
  assert.ok(bladzijden > 1, 'er is echt gebladerd, geen enkele grote lijst');
});

test('een lid volgen maakt zijn posts zichtbaar in de feed', async () => {
  const a = await lid(), b = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Iets wat alleen volgers zouden zien. #stilte' }, a.token));
  assert.ok(post.ok, post.error);

  const voor = await json(await raw('/salon/feed', { onderwerp: 'stilte' }, b.token));
  const zagIkHem = voor.posts.some(p => p.id === post.post.id);

  const v = await json(await raw('/salon/volg-lid', { wie: a.codenaam, aan: true }, b.token));
  assert.ok(v.ok && v.volgIk, 'B volgt A nu');

  const na = await json(await raw('/salon/feed', { onderwerp: 'stilte' }, b.token));
  assert.ok(na.posts.some(p => p.id === post.post.id), 'na het volgen staat de post in de feed van B' + (zagIkHem ? '' : ' (en daarvoor niet)'));

  // en het profiel van A telt B als volger
  const prof = await json(await raw('/salon/lid', { wie: a.codenaam }, b.token));
  assert.equal(prof.ikZelf, false);
  assert.ok(prof.volgers >= 1);
  assert.equal(prof.volgIk, true);
});

test('reageren, antwoorden en iemand noemen; de maker mag opruimen', async () => {
  const a = await lid(), b = await lid(), c = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Wie gaat er mee zondag?' }, a.token));
  const id = post.post.id;

  const r1 = await json(await raw('/salon/reageer', { id, tekst: 'Ik ben er.' }, b.token));
  assert.ok(r1.ok, r1.error);
  const r2 = await json(await raw('/salon/reageer', { id, tekst: 'Dan zie ik je daar @' + b.codenaam, op: r1.reactie.id }, c.token));
  assert.ok(r2.ok, r2.error);

  const lijst = await json(await raw('/salon/reacties', { id }, a.token));
  assert.equal(lijst.reacties.length, 1, 'antwoorden hangen onder de hoofdreactie, niet ernaast');
  assert.equal(lijst.reacties[0].antwoorden.length, 1);
  assert.equal(lijst.reacties[0].antwoorden[0].text.includes('@' + b.codenaam), true, 'de codenaam blijft leesbaar in de tekst');

  // de maker ruimt op onder zijn eigen post; een derde mag dat niet
  const mag = await json(await raw('/salon/reactie-weg', { id, reactieId: r1.reactie.id }, c.token));
  assert.ok(mag.error, 'C mag de reactie van B niet weghalen');
  const weg = await json(await raw('/salon/reactie-weg', { id, reactieId: r1.reactie.id }, a.token));
  assert.ok(weg.ok, weg.error);
});

test('de maker bepaalt wie mag reageren', async () => {
  const a = await lid(), b = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Even geen reacties graag.' }, a.token));
  const id = post.post.id;

  const stand = await json(await raw('/salon/reacties-van', { id, stand: 'niemand' }, a.token));
  assert.equal(stand.reactiesVan, 'niemand');

  const poging = await json(await raw('/salon/reageer', { id, tekst: 'Toch iets zeggen.' }, b.token));
  assert.ok(poging.error, 'met de deur dicht komt er niemand binnen');

  // en de maker zelf mag altijd onder zijn eigen post
  const eigen = await json(await raw('/salon/reageer', { id, tekst: 'Aanvulling van mezelf.' }, a.token));
  assert.ok(eigen.ok, eigen.error);

  // een ander kan de stand van jouw post niet zetten
  const inbraak = await json(await raw('/salon/reacties-van', { id, stand: 'iedereen' }, b.token));
  assert.ok(inbraak.error);
});

test('verbergen is prive, bewaren is prive, en drie melders halen een post uit de feed', async () => {
  const a = await lid(), b = await lid(), c = await lid(), d = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Iets waar niet iedereen blij van wordt. #twist' }, a.token));
  const id = post.post.id;
  for (const wie of [b, c, d]) await raw('/salon/volg-lid', { wie: a.codenaam, aan: true }, wie.token);

  // B verbergt: alleen voor B weg
  await raw('/salon/verberg', { id, aan: true }, b.token);
  const feedB = await json(await raw('/salon/feed', { onderwerp: 'twist' }, b.token));
  const feedC = await json(await raw('/salon/feed', { onderwerp: 'twist' }, c.token));
  assert.equal(feedB.posts.some(p => p.id === id), false, 'B ziet hem niet meer');
  assert.equal(feedC.posts.some(p => p.id === id), true, 'voor C verandert er niets');

  // bewaren ziet niemand anders
  await raw('/salon/bewaar', { id, aan: true }, c.token);
  const plankC = await json(await raw('/salon/feed', { bewaard: true }, c.token));
  const plankD = await json(await raw('/salon/feed', { bewaard: true }, d.token));
  assert.equal(plankC.posts.some(p => p.id === id), true);
  assert.equal(plankD.posts.some(p => p.id === id), false, 'de plank van C is niet die van D');

  // twee keer melden door dezelfde persoon telt een keer
  await raw('/salon/meld', { id, reden: 'ongepast' }, b.token);
  const nogmaals = await json(await raw('/salon/meld', { id, reden: 'nogmaals' }, b.token));
  assert.equal(nogmaals.al, true);
  await raw('/salon/meld', { id, reden: 'ongepast' }, c.token);
  const derde = await json(await raw('/salon/meld', { id, reden: 'ongepast' }, d.token));
  assert.equal(derde.verborgen, true, 'drie verschillende melders halen de post uit de feed');

  const naMelden = await json(await raw('/salon/feed', { onderwerp: 'twist' }, c.token));
  assert.equal(naMelden.posts.some(p => p.id === id), false);
});

test('onderwerpen worden geteld uit wat er echt gedeeld is', async () => {
  const a = await lid();
  for (let i = 0; i < 3; i++) await raw('/salon/plaats', { tekst: 'Aan tafel bij de haven #tafelen' }, a.token);
  const o = await json(await raw('/salon/onderwerpen', { limiet: 30 }, a.token));
  const rij = o.onderwerpen.find(x => x.naam === 'tafelen');
  assert.ok(rij && rij.aantal >= 3, 'het getal komt uit de posts zelf, niet uit de AI');
});

test('de AI stelt voor en plaatst nooit zelf; zonder AI een eerlijke 503', async () => {
  const a = await lid();
  const voor = await json(await raw('/salon/lid', { wie: 'ik' }, a.token));

  const r = await raw('/salon/ai/bijschrift', { steekwoorden: 'avond, haven, rust' }, a.token);
  const b = await r.json();
  if (process.env.ANTHROPIC_API_KEY) {
    assert.equal(r.status, 200);
    assert.ok(b.bijschrift && b.bijschrift.length > 0);
  } else {
    assert.equal(r.status, 503, 'zonder sleutel geen verzonnen antwoord maar een eerlijke 503');
    assert.ok(b.reden, 'en een uitleg waarom');
  }
  const na = await json(await raw('/salon/lid', { wie: 'ik' }, a.token));
  assert.equal(na.posts, voor.posts, 'een bijschrift vragen plaatst niets');

  /* Zonder woorden werkt de knop niet -- maar dat is een 400, geen 503.

     Hier stond 503 omdat de route elke niet-ok van de AI-laag als 503 doorgaf.
     "Je hebt niets ingevuld" is geen storing: een 503 laat een load balancer
     opnieuw proberen en telt in SLO.md als verbruikt foutbudget. De statuscode
     komt nu uit de AI-laag zelf (503 alleen als de assistent echt onbereikbaar
     is, 403 als het niet van jou is, anders 400). De 503 hierboven -- geen
     sleutel, dus de assistent IS er niet -- blijft dus staan. */
  const leeg = await raw('/salon/ai/bijschrift', { steekwoorden: '' }, a.token);
  assert.equal(leeg.status, 400, 'niets ingevuld is een invoerfout, geen storing');
});

test('de reactie-samenvatting kan alleen op je eigen post', async () => {
  const a = await lid(), b = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Een post met een gesprek eronder.' }, a.token));
  await raw('/salon/reageer', { id: post.post.id, tekst: 'Mooi.' }, b.token);
  const vreemd = await json(await raw('/salon/ai/reacties', { id: post.post.id }, b.token));
  assert.equal(vreemd.ok, false, 'het gesprek onder de post van een ander is niet het jouwe');

  const eigen = await json(await raw('/salon/ai/reacties', { id: post.post.id }, a.token));
  assert.equal(eigen.ok, true, 'de eigen reacties worden zonder model lokaal samengevat');
  assert.equal(eigen.bron, 'lokale-taal');
  assert.match(eigen.samenvatting, /positief/i);

  // waarover werkt ook zonder AI: de telling is het antwoord
  const w = await json(await raw('/salon/ai/waarover', {}, a.token));
  assert.equal(w.ok, true);
  assert.ok(Array.isArray(w.onderwerpen));
});

test('je eigen post mag weg, die van een ander niet; en een gast plaatst niet', async () => {
  const a = await lid(), b = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Deze haal ik zo weer weg.' }, a.token));
  const vreemd = await json(await raw('/salon/weg', { id: post.post.id }, b.token));
  assert.ok(vreemd.error, 'B kan de post van A niet verwijderen');
  const eigen = await json(await raw('/salon/weg', { id: post.post.id }, a.token));
  assert.ok(eigen.ok, eigen.error);

  const uitgelogd = await raw('/salon/plaats', { tekst: 'Zonder aanmelding.' });
  assert.equal(uitgelogd.status, 401);
});

test('inzicht is je eigen spiegel: cijfers wel, namen niet', async () => {
  const a = await lid(), b = await lid(), c = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Een avond die bleef hangen. #avond' }, a.token));
  const id = post.post.id;
  for (const wie of [b, c]) await raw('/salon/volg-lid', { wie: a.codenaam, aan: true }, wie.token);
  await raw('/salon/reageer', { id, tekst: 'Wat mooi.' }, b.token);
  await raw('/salon/bewaar', { id, aan: true }, b.token);
  await raw('/salon/bewaar', { id, aan: true }, c.token);

  const i = await json(await raw('/salon/inzicht', {}, a.token));
  assert.ok(i.ok, i.error);
  const rij = i.posts.find(r => r.id === id);
  assert.ok(rij, 'je eigen post staat in je overzicht');
  assert.equal(rij.reacties, 1);
  assert.equal(rij.bewaard, 2, 'twee leden bewaarden hem, en dat is te tellen');
  assert.ok(i.onderwerpen.some(o => o.onderwerp === 'avond'), 'de onderwerpen zijn die van jouw eigen posts');

  // geen namen bij de cijfers, en geen sleutels
  const tekst = JSON.stringify(i);
  assert.equal(tekst.includes(b.codenaam), false, 'wie iets bewaart blijft prive, ook nu er een cijfer bij staat');
  assert.equal(tekst.includes(c.codenaam), false);
  assert.equal(/"(authorKey|key|likedBy)"/.test(tekst), false, 'geen sleutels in het antwoord');

  // en het is echt JOUW spiegel: B ziet de post van A niet in zijn overzicht
  const iB = await json(await raw('/salon/inzicht', {}, b.token));
  assert.equal(iB.posts.some(r => r.id === id), false, 'er is geen ranglijst en geen inkijk in andermans cijfers');
});

test('archiveren haalt een post uit de etalage zonder hem weg te gooien', async () => {
  const a = await lid(), b = await lid();
  const post = await json(await raw('/salon/plaats', { tekst: 'Deze zet ik straks in het archief. #kast' }, a.token));
  const id = post.post.id;
  await raw('/salon/volg-lid', { wie: a.codenaam, aan: true }, b.token);
  const voor = await json(await raw('/salon/feed', { onderwerp: 'kast' }, b.token));
  assert.equal(voor.posts.some(p => p.id === id), true, 'eerst staat hij er gewoon');

  // een ander kan jouw post niet archiveren
  const inbraak = await json(await raw('/salon/archiveer', { id, aan: true }, b.token));
  assert.ok(inbraak.error, 'archiveren kan alleen de maker');

  const arch = await json(await raw('/salon/archiveer', { id, aan: true }, a.token));
  assert.equal(arch.gearchiveerd, true);

  const naB = await json(await raw('/salon/feed', { onderwerp: 'kast' }, b.token));
  assert.equal(naB.posts.some(p => p.id === id), false, 'uit de feed van anderen');
  const naA = await json(await raw('/salon/lid', { wie: 'ik' }, a.token));
  assert.equal(naA.raster.posts.some(p => p.id === id), false, 'en ook uit je eigen raster');

  // maar hij bestaat nog: in het archief, en in je inzicht met een merkteken
  const kast = await json(await raw('/salon/feed', { archief: true }, a.token));
  assert.equal(kast.posts.some(p => p.id === id), true, 'in het archief staat hij er wel');
  const i = await json(await raw('/salon/inzicht', {}, a.token));
  assert.equal(i.posts.find(r => r.id === id).gearchiveerd, true);

  // en terugzetten kan
  const terug = await json(await raw('/salon/archiveer', { id, aan: false }, a.token));
  assert.equal(terug.gearchiveerd, false);
  const weerA = await json(await raw('/salon/lid', { wie: 'ik' }, a.token));
  assert.equal(weerA.raster.posts.some(p => p.id === id), true, 'terug in je raster');
});

test('de bio is van jou, en de keuring geldt er net zo goed', async () => {
  const a = await lid();
  const g = await json(await raw('/salon/bio', { bio: 'Reist met een boek en een camera.', plaats: 'Ibiza' }, a.token));
  assert.ok(g.ok, g.error);
  const p = await json(await raw('/salon/lid', { wie: 'ik' }, a.token));
  assert.equal(p.bio, 'Reist met een boek en een camera.');
  assert.equal(p.plaats, 'Ibiza');
  assert.ok(p.codenaam && !/@|Lid \d/.test(p.codenaam), 'een profiel toont een codenaam, nooit een echte naam of e-mail');
});
