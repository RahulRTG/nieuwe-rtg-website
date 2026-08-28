/* De RTFoundation-kant: veiligheid, de gezinsdeur en de gastrol.

   De stichting richt zich op gezinnen en dus op minderjarigen. De laag die
   daar het zwaarst weegt -- blokkeren, deblokkeren en melden -- was tot nu toe
   nooit vanuit de RTF-app aangeroepen. Datzelfde geldt voor de wiskant van het
   leren, de school-apps en de spelborden, en voor de rol die het makkelijkst
   over het hoofd wordt gezien: de GAST (een oppas of familielid), die overal
   mag meelezen maar bijna nergens mag schrijven.

   Drie dingen krijgen hier een eigen assertie, omdat ze precies andersom
   kunnen uitpakken dan je op het eerste gezicht zou denken:

   1. BLOKKEREN WERKT BEIDE KANTEN OP, maar DEBLOKKEREN maar EEN kant. Wie zelf
      deblokkeert is er nog niet als de ander hem ook heeft geblokkeerd -- en
      dat hoort zo: je kunt jezelf niet terugpraten in andermans contacten.
   2. BLOKKEREN GOOIT EEN BESTAANDE VRIENDSCHAP METEEN WEG. Niet "verbergen",
      echt weg, aan allebei de kanten.
   3. DE GAST MAG WEL EEN FORMULIER INVULLEN. Antwoorden is geen bewerken; dat
      is een bewuste uitzondering op de schrijfregel en geen gaatje.

   Draai los:
   node --test test/rtf-veilig.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const post = (pad, body) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const soc = (pad, body) => post('/api/rtf/social' + pad, body);

/* Een gezin met een beheerder (ouder), een tiener van 16+ en een oppas. De
   tiener is 'jong' zodat hij zelf in de vriendenlaag mag; een beschermd profiel
   (15-) kan dat bewust niet, en dat staat al in test/beschermd.test.js. */
async function gezin(naam) {
  const g = (await post('/api/foundation/gezin/maak', { gezinsnaam: naam, naam: 'Ouder ' + naam, pin: '1234' })).body;
  const kind = (await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token,
    naam: 'Tiener ' + naam, rol: 'gezinslid', groep: 'jong' })).body;
  const kidToken = (await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id })).body.token;
  const oppas = (await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token,
    naam: 'Oppas ' + naam, rol: 'gast' })).body;
  const gastToken = (await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: oppas.profiel.id })).body.token;
  const conn = (await soc('/connections', { code: g.code, token: kidToken })).body;
  return { code: g.code, ouder: g.token, kid: kidToken, gast: gastToken, handle: conn.me, codenaam: conn.codename };
}

let A, B;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfv-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP }, wachtPad: '/api/foundation/health' });
  base = srv.base;
  A = await gezin('Alfa');
  B = await gezin('Beta');
  assert.ok(A.handle && B.handle, 'beide tieners hebben een handle');
  assert.notEqual(A.handle, B.handle);
});
test.after(() => stop(srv && srv.child));

// de twee tieners echt met elkaar verbinden (verzoek + akkoord)
async function verbind() {
  const v = await soc('/connect', { code: A.code, token: A.kid, key: B.handle });
  assert.ok([200, 409].includes(v.status), 'verzoek verstuurd: ' + JSON.stringify(v.body).slice(0, 120));
  const a = await soc('/respond', { code: B.code, token: B.kid, key: A.handle, action: 'accept' });
  // 404 betekent: er stond geen verzoek open, want ze waren al verbonden
  assert.ok([200, 404].includes(a.status), 'B accepteert: ' + JSON.stringify(a.body).slice(0, 120));
  const na = (await soc('/connections', { code: A.code, token: A.kid })).body;
  return (na.connections || []).some(c => c.key === B.handle);
}

test('1. blokkeren werkt beide kanten op en gooit de vriendschap meteen weg', async () => {
  const verbonden = await verbind();
  assert.ok(verbonden, 'de twee tieners zijn eerst echt vrienden');

  const blok = await soc('/block', { code: A.code, token: A.kid, key: B.handle });
  assert.equal(blok.status, 200);

  const naA = (await soc('/connections', { code: A.code, token: A.kid })).body;
  const naB = (await soc('/connections', { code: B.code, token: B.kid })).body;
  assert.ok(!(naA.connections || []).some(c => c.key === B.handle), 'bij A is de vriendschap weg');
  assert.ok(!(naB.connections || []).some(c => c.key === A.handle), 'en bij B ook -- niet verborgen, echt weg');

  // en het werkt beide kanten op: B kan A ook niet meer bereiken
  const dm = await soc('/dm/send', { code: B.code, token: B.kid, toKey: A.handle, text: 'hoi' });
  assert.equal(dm.status, 403, 'B komt niet meer bij A binnen, ook al blokkeerde A en niet B');

  // opnieuw verbinding zoeken loopt ook dood
  const opnieuw = await soc('/connect', { code: B.code, token: B.kid, key: A.handle });
  assert.equal(opnieuw.status, 403, 'een nieuw verzoek is geen omweg om het blok heen');
});

test('2. deblokkeren heft maar EEN kant op', async () => {
  // B blokkeert nu ook A; er liggen twee blokken over elkaar
  assert.equal((await soc('/block', { code: B.code, token: B.kid, key: A.handle })).status, 200);

  // A trekt zijn eigen blok in
  assert.equal((await soc('/unblock', { code: A.code, token: A.kid, key: B.handle })).status, 200);

  // maar dat van B staat er nog, dus de deur blijft dicht
  const nog = await soc('/connect', { code: A.code, token: A.kid, key: B.handle });
  assert.equal(nog.status, 403, 'A kan zichzelf niet terugpraten in de contacten van B');

  // pas als B ook deblokkeert kan het weer
  assert.equal((await soc('/unblock', { code: B.code, token: B.kid, key: A.handle })).status, 200);
  assert.ok(await verbind(), 'daarna kunnen ze opnieuw vrienden worden');
});

test('3. melden: altijd een doel, nooit opmaak, en op codenaam', async () => {
  const leeg = await soc('/report', { code: A.code, token: A.kid, reden: 'zomaar' });
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /Wie wil je melden/i);

  const melding = await soc('/report', { code: A.code, token: A.kid, key: B.handle,
    reden: '<b>pesten</b> in de chat' });
  assert.equal(melding.status, 200);

  // een gast meldt niet namens het gezin
  const gast = await soc('/report', { code: A.code, token: A.gast, key: B.handle, reden: 'test' });
  assert.equal(gast.status, 403);
  assert.match(gast.body.error, /oppas|familielid/i);
});

test('4. verhalen: plaatsen, zien en bekijken binnen de vriendenlaag', async () => {
  const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const zet = await soc('/story/post', { code: A.code, token: A.kid, foto, tekst: 'Vandaag' });
  assert.equal(zet.status, 200, 'het verhaal staat er: ' + JSON.stringify(zet.body).slice(0, 140));

  /* HIER STOND EEN TOETS DIE NIET KON ZAKKEN. De lijst mocht leeg zijn, het id
     werd dan 'bestaatniet', en het bekijken werd afgerekend met
     `[200, 403, 404].includes(status)` -- dus "B ziet het verhaal", "B mag er
     niet bij" en "het verhaal bestaat niet" gaven alle drie een groen vinkje.
     Terwijl A en B aan het eind van toets 2 juist weer vrienden zijn: het
     verhaal HOORT er te staan en B HOORT het te mogen openen. Dat is nu de
     bewering. */
  const lijst = await soc('/stories', { code: B.code, token: B.kid });
  assert.equal(lijst.status, 200);
  assert.ok(Array.isArray(lijst.body.stories), 'de verhalenlijst is een lijst');

  const eerste = lijst.body.stories[0];
  assert.ok(eerste && eerste.id, 'het verhaal van A staat in de lijst van B: de vriendenlaag draagt het door');
  const kijk = await soc('/story/view', { code: B.code, token: B.kid, id: eerste.id });
  assert.equal(kijk.status, 200, 'en B mag het openen: ' + kijk.status + ' ' + JSON.stringify(kijk.body).slice(0, 120));
  assert.equal(kijk.body.tekst, 'Vandaag', 'met de inhoud die A erin zette');

  /* DE TEGENPROEF, want zonder deze bewijst het bovenstaande alleen dat de deur
     opengaat en niet dat hij ergens dichtzit. Een derde gezin dat met niemand
     verbonden is, ziet het verhaal niet en kan het ook niet openen. */
  const C = await gezin('Gamma');
  const vreemd = await soc('/stories', { code: C.code, token: C.kid });
  assert.equal(vreemd.status, 200);
  assert.equal((vreemd.body.stories || []).some(s => s.id === eerste.id), false,
    'een gezin buiten de vriendenlaag ziet het verhaal niet staan');
  const stiekem = await soc('/story/view', { code: C.code, token: C.kid, id: eerste.id });
  assert.ok([403, 404].includes(stiekem.status),
    'en het id kennen is niet genoeg om het te openen (kreeg ' + stiekem.status + ')');

  // en zonder gezinstoken kom je er sowieso niet in
  assert.equal((await soc('/stories', { code: A.code, token: 'verzonnen' })).status, 403);
  assert.equal((await soc('/story/view', { code: A.code, token: 'verzonnen', id: 'x' })).status, 403);
});

test('5. de dm-lijst vraagt een ECHTE verbinding, niet alleen een codenaam', async () => {
  assert.ok(await verbind(), 'A en B zijn (weer) verbonden');
  const dm = await soc('/dm', { code: A.code, token: A.kid, withKey: B.handle });
  assert.equal(dm.status, 200, JSON.stringify(dm.body).slice(0, 140));
  assert.ok(Array.isArray(dm.body.messages), 'er komt een berichtenlijst terug');
  assert.ok(dm.body.codename, 'met de CODENAAM van de ander, niet zijn echte naam');

  // een codenaam waarmee geen verbinding bestaat geeft geen chatgeschiedenis
  const vreemd = await soc('/dm', { code: A.code, token: A.kid, withKey: 'rtf:XXXXXX:0000dead' });
  assert.equal(vreemd.status, 403);
  assert.match(vreemd.body.error, /nog niet verbonden/i);

  assert.equal((await soc('/dm', { code: A.code, token: 'verzonnen', withKey: B.handle })).status, 403);
  const gast = await soc('/dm', { code: A.code, token: A.gast, withKey: B.handle });
  assert.equal(gast.status, 403, 'een oppas leest de chats van het gezin niet mee');
});

test('6. de kantoordrive van het gezin: de gast leest mee, maar schrijft niet', async () => {
  const drive = (pad, body, token) => post('/api/rtf/kantoorpakket' + pad,
    Object.assign({ code: A.code, token: token || A.ouder }, body || {}));

  const mk = await drive('/maak', { soort: 'tekst', titel: 'Vakantieplan' });
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 140));
  const id = mk.body.id;

  assert.equal((await drive('/bewaar', { id, inhoud: { tekst: 'Eerste opzet.' } })).status, 200);
  assert.equal((await drive('/bewaar', { id, inhoud: { tekst: 'Tweede opzet.' } })).status, 200);

  const versies = await drive('/versies', { id });
  assert.equal(versies.status, 200);
  assert.ok(versies.body.versies.length >= 1);
  const terug = await drive('/terug', { id, nr: 0 });
  assert.equal(terug.status, 200);
  assert.equal(terug.body.inhoud.tekst, 'Eerste opzet.');
  assert.equal((await drive('/ster', { id, aan: true })).body.ster, true);

  /* De gast leest NIET zomaar mee: een document in de gezinsdrive is eerst van
     de maker alleen. Pas als die het uitdrukkelijk met de gezinskring deelt
     (/gezin) mag de rest erbij -- en dan nog steeds alleen lezen. Dat is
     strenger dan "het gezin deelt alles", en dat hoort ook zo. */
  assert.equal((await drive('/versies', { id }, A.gast)).status, 403, 'ongedeeld is ongedeeld, ook binnen het gezin');
  assert.equal((await drive('/gezin', { id, rechten: 'lezen' })).status, 200, 'de maker deelt het met de kring');
  assert.equal((await drive('/versies', { id }, A.gast)).status, 200, 'nu mag de oppas de geschiedenis inzien');
  // ...maar bewerken blijft dicht
  assert.equal((await drive('/terug', { id, nr: 0 }, A.gast)).status, 403);
  assert.equal((await drive('/ster', { id, aan: false }, A.gast)).status, 403);

  // en het gezin ernaast komt er helemaal niet in
  const vreemd = await post('/api/rtf/kantoorpakket/versies', { code: B.code, token: B.ouder, id });
  assert.notEqual(vreemd.status, 200, 'gezin B kan het vakantieplan van gezin A niet inzien');

  /* Het formulier is de bewuste uitzondering: ANTWOORDEN is geen bewerken, dus
     een oppas of familielid mag wel invullen. De uitslag is weer alleen voor
     wie het formulier beheert. */
  const f = await drive('/maak', { soort: 'formulier', titel: 'Wie gaat mee?' });
  const fid = f.body.id;
  assert.equal((await drive('/gezin', { id: fid, rechten: 'lezen' })).status, 200, 'het formulier gaat de kring in');
  const vulGast = await drive('/vul', { id: fid, antwoorden: ['Ik rijd wel'] }, A.gast);
  assert.equal(vulGast.status, 200, 'de oppas mag antwoorden');
  assert.equal((await drive('/uitslag', { id: fid }, A.gast)).status, 403, 'maar de uitslag is niet van hem');
  assert.equal((await drive('/uitslag', { id: fid })).status, 200, 'het gezin ziet hem wel');
});

test('7. leren: een lijst weggooien en de eigen schrijfsels', async () => {
  const leer = (actie, body, token) => post('/api/rtf/leren/' + actie,
    Object.assign({ code: A.code, token: token || A.kid }, body || {}));

  const mk = await leer('lijst-maak', { naam: 'Franse woorden',
    paren: [{ v: 'la mer', a: 'de zee' }, { v: 'le pain', a: 'het brood' }] });
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 140));
  const id = mk.body.id;
  assert.ok(id, 'de lijst is aangemaakt');

  // een lijst van iemand anders gooi je niet weg
  const vreemd = await post('/api/rtf/leren/lijst-weg', { code: B.code, token: B.kid, id });
  assert.notEqual(vreemd.status, 200, 'de tiener van gezin B raakt de lijst van A niet aan');
  assert.ok(((await leer('lijsten', {})).body.lijsten || []).some(l => l.id === id), 'de lijst staat er nog');

  assert.equal((await leer('lijst-weg', { id })).status, 200);
  assert.ok(!((await leer('lijsten', {})).body.lijsten || []).some(l => l.id === id), 'nu is hij weg');

  const schrijf = await leer('schrijfsels', {});
  assert.equal(schrijf.status, 200);
  assert.ok(Array.isArray(schrijf.body.schrijfsels), 'de schrijfsels zijn een lijst, ook als er niets staat');
  assert.equal((await leer('schrijfsels', {}, 'verzonnen')).status, 403);
});

test('8. de school-apps: installeren en weghalen doet het gezin zelf', async () => {
  const mijn = await post('/api/rtf/school/mijn', { code: A.code, token: A.kid });
  assert.equal(mijn.status, 200);

  const weg = await post('/api/rtf/school/weg', { code: A.code, token: A.kid, id: 'bestaatniet' });
  assert.ok([200, 400, 404].includes(weg.status), 'weghalen antwoordt netjes: ' + weg.status);

  const gast = await post('/api/rtf/school/weg', { code: A.code, token: A.gast, id: 'x' });
  assert.equal(gast.status, 403);
  assert.match(gast.body.error, /oppas|familielid/i);
});

test('9. de spelborden: scores tellen per speler, opgeven kan alleen je eigen potje', async () => {
  const spel = (actie, body, token) => post('/api/rtf/spel/' + actie,
    Object.assign({ code: A.code, token: token || A.kid }, body || {}));

  assert.equal((await spel('sneek-score', { punten: 120 })).status, 200);
  const sneek = await spel('sneek-bord', {});
  assert.equal(sneek.status, 200);
  assert.ok(sneek.body, 'er komt een scorebord terug');

  assert.equal((await spel('arcade-score', { spel: 'tetris', punten: 4200 })).status, 200);
  const arcade = await spel('arcade-bord', { spel: 'tetris' });
  assert.equal(arcade.status, 200);

  // opgeven van een potje dat niet bestaat is geen 500
  const op = await spel('opgeven', { id: 'bestaatniet' });
  assert.ok([400, 403, 404].includes(op.status), 'opgeven antwoordt netjes: ' + op.status);

  // een gast speelt niet mee
  assert.equal((await spel('sneek-score', { punten: 999999 }, A.gast)).status, 403);
  assert.equal((await spel('arcade-bord', { spel: 'tetris' }, A.gast)).status, 403);
});

test('10. de bibliothecaris kiest geen partij', async () => {
  const r = await post('/api/rtf/geloof/ai', { code: A.code, token: A.kid,
    vraag: 'Ik wil iets lezen over stilte en aandacht.' });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal((await post('/api/rtf/geloof/ai', { code: A.code, token: 'verzonnen', vraag: 'x' })).status, 403);
});

/* De sollicitatiechat van een RTF-gezinslid. De gelukkige weg (echt
   solliciteren op een openstaande vacature) staat elders; wat hier telt is de
   DEUR: de chat is van EEN profiel van EEN gezin, en iedereen daarbuiten krijgt
   hem niet te zien -- ook niet met een geldig gezinstoken van een ander gezin. */
test('11. de sollicitatiechat hoort bij een profiel, niet bij een gezinscode', async () => {
  assert.equal((await post('/api/rtf/apply/chat', { code: A.code, token: 'verzonnen', id: 'x' })).status, 403);
  assert.equal((await post('/api/rtf/apply/chat/send', { code: A.code, token: 'verzonnen', id: 'x', text: 'hoi' })).status, 403);

  const onbekend = await post('/api/rtf/apply/chat', { code: A.code, token: A.kid, id: 'bestaatniet' });
  assert.equal(onbekend.status, 404);
  assert.match(onbekend.body.error, /niet gevonden/i);

  const sturen = await post('/api/rtf/apply/chat/send', { code: B.code, token: B.kid, id: 'bestaatniet', text: 'hoi' });
  assert.equal(sturen.status, 404, 'ook sturen loopt dood op een chat die niet van jou is');
});
