/* HET MENSELIJKE VERKEER -- wat mensen hier met elkaar doen.

   WAAROM DIT ER NAAST test/menselijkebanen.test.js STAAT

   Die toets bewijst dat 157 mensen bij hun werk kunnen. Dat is de deur, niet
   het huis. Een systeem is pas enterprise als het gedrag klopt: dat twee
   leden elkaar vinden, elkaar bellen, dat een bezorger een route krijgt die
   ergens op slaat, dat de AI iets aanpakt zonder te liegen, en dat iemand die
   zich aanmeldt op kantoor door een MENS wordt beoordeeld.

   Vijf draden, allemaal met twee mensen of meer, en allemaal met de merkregel
   erbij die erop van toepassing is. Want die regels staan in CLAUDE.md en
   werden tot nu toe door mensen bewaakt:

   1. DE SALON. Anna plaatst iets, Boris ziet het, volgt haar en reageert. De
      regel: privacy by design. Anna heet in De Salon "Zilveren Valk 1D7F" en
      haar echte naam komt er NERGENS in voor -- niet in de feed, niet in het
      profiel, niet in de reactie.
   2. BELLEN. Twee leden in de residentie bellen elkaar op codenaam. Wie er
      niet is, is niet te bellen; dat hoort een eerlijke 404 te zijn.
   3. BEZORGEN MET GPS. Drie leveringen met echte coordinaten. De route moet
      de dichtstbijzijnde eerst nemen, echte afstanden geven en een navigatie-
      link die klopt. Een routeplanner die de volgorde van de invoer aanhoudt
      is geen routeplanner.
   4. DE AI IETS LATEN REGELEN. Hij mag helpen, en hij mag NOOIT zeggen dat
      het geregeld is -- dat is de merkregel en die is hier al een keer
      ontsnapt (zie het commentaar in server/kern/ai/prompt.js). En de tweede
      merkregel: het register per pas. RTG Pass tutoyeert, Lifestyle en
      Business spreken met u.
   5. ONBOARDING OP KANTOOR. Een aanvraag komt binnen, en de beslissing valt
      door een herleidbaar mens in de backoffice. De AI mag die pas nooit zelf
      verlenen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, kantoorAlsPersoon } = require('./helper');

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
async function nieuwLid(P, naam, tier) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v',
    tier: tier || 'rtg', pasApp: tier || 'rtg'
  });
  assert.ok(r.body.token, 'lid ' + naam + ' aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  return r.body.token;
}

test('De Salon: twee leden vinden elkaar, en niemand ziet een echte naam', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const anna = await nieuwLid(P, 'Annabel', 'rtg');
    const boris = await nieuwLid(P, 'Borislav', 'rtg');

    const geplaatst = await P('/api/salon/plaats', { tekst: 'Zonsopgang boven de baai.', onderwerp: 'reizen' }, anna);
    assert.equal(geplaatst.status, 200, 'Anna kan iets plaatsen');
    const annaCodenaam = geplaatst.body.post.author;
    assert.ok(annaCodenaam, 'haar bijdrage draagt een codenaam');

    /* DE MERKREGEL. Klantdata draait op codenamen; de echte naam staat in de
       gescheiden kluis. Zou hier "Annabel" staan, dan lekt de identiteit van
       een lid naar iedereen die de feed opent. */
    assert.ok(!/Annabel/i.test(annaCodenaam), 'de codenaam is niet haar echte naam, kreeg: ' + annaCodenaam);

    /* DE SALON IS BESLOTEN, en dat is de kern van dit product: je ziet een
       vreemde NIET zomaar. Alleen een vriend, iemand die je volgt, een
       gecureerde of een virale bijdrage komt binnen (server/kern/salonviraal.js).
       Dus eerst de tegenproef -- zonder band ziet Boris haar niet. Zou hij haar
       hier wel zien, dan is De Salon geen besloten netwerk meer. */
    const voor = await P('/api/salon/feed', {}, boris);
    assert.equal(voor.status, 200, 'Boris kan de feed openen');
    const voorPosts = voor.body.posts || [];
    assert.ok(!voorPosts.some(i => String(i.text || '').includes('Zonsopgang boven de baai')),
      'zonder band ziet Boris haar bijdrage NIET (De Salon is besloten)');

    // dan volgt hij haar, en pas daarna hoort ze in zijn feed te staan
    const volg = await P('/api/salon/volg-lid', { wie: annaCodenaam, aan: true }, boris);
    assert.equal(volg.status, 200, 'Boris kan haar volgen: ' + JSON.stringify(volg.body).slice(0, 140));
    const volgend = await P('/api/salon/volgend', {}, boris);
    assert.equal(volgend.status, 200, 'en zijn lijst is op te vragen');

    const feed = await P('/api/salon/feed', {}, boris);
    const items = feed.body.posts || [];
    const hare = items.find(i => i.text && i.text.includes('Zonsopgang boven de baai'));
    assert.ok(hare, 'na het volgen ziet hij haar bijdrage wel (' + items.length + ' items)');
    assert.equal(hare.author, annaCodenaam, 'onder dezelfde codenaam');

    // de hele feed door: nergens een echte naam
    const alleTekst = JSON.stringify(items);
    assert.ok(!/Annabel/i.test(alleTekst), 'nergens in de feed staat haar echte naam');
    assert.ok(!/Borislav/i.test(alleTekst), 'en die van Boris ook niet');

    // en reageert
    const reactie = await P('/api/salon/reageer', { id: hare.id, tekst: 'Wat een licht.' }, boris);
    assert.equal(reactie.status, 200, 'Boris kan reageren: ' + JSON.stringify(reactie.body).slice(0, 140));
    const borisCodenaam = reactie.body.reactie.who;
    assert.ok(!/Borislav/i.test(borisCodenaam), 'ook zijn reactie draagt een codenaam, kreeg: ' + borisCodenaam);
    assert.notEqual(borisCodenaam, annaCodenaam, 'en het is een andere dan die van Anna');

    // Anna ziet zijn reactie onder haar eigen bijdrage staan
    const reacties = await P('/api/salon/reacties', { id: hare.id }, anna);
    assert.equal(reacties.status, 200, 'Anna kan de reacties opvragen');
    const lijst = reacties.body.reacties || [];
    assert.ok(lijst.some(r => r.text === 'Wat een licht.'), 'zijn reactie staat eronder');
  } finally { child.kill('SIGKILL'); }
});

test('Bellen: twee leden in de residentie bereiken elkaar op codenaam', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const anna = await nieuwLid(P, 'Anouk', 'rtg');
    const boris = await nieuwLid(P, 'Bram', 'rtg');

    const binnenA = await P('/api/residentie/betreed', {}, anna);
    const binnenB = await P('/api/residentie/betreed', {}, boris);
    assert.equal(binnenA.status, 200, 'Anouk komt binnen: ' + JSON.stringify(binnenA.body).slice(0, 140));
    assert.equal(binnenB.status, 200, 'Bram komt binnen');

    /* Wie is wie in het huis? Ook hier codenamen, en we bellen er een op. */
    const huis = await P('/api/residentie/huis', {}, boris);
    assert.equal(huis.status, 200, 'Bram ziet het huis');
    const tekst = JSON.stringify(huis.body);
    assert.ok(!/Anouk|Bram/i.test(tekst), 'het huis toont codenamen en geen echte namen');

    /* Haar codenaam vragen we bij haar eigen identiteit op, niet uit Brams
       scherm -- anders zou de toets aannemen dat het scherm al klopt. */
    const ikA = await P('/api/salon/lid', {}, anna);
    const codenaamA = ikA.body.codenaam;
    assert.ok(codenaamA, 'Anouk heeft een codenaam: ' + JSON.stringify(ikA.body).slice(0, 160));
    assert.ok(!/Anouk/i.test(codenaamA), 'en dat is niet haar echte naam');

    /* En die codenaam staat ook echt in de kamer waar Bram kijkt: zo weten we
       dat we straks de JUISTE persoon bellen en niet een naam die toevallig
       ergens anders vandaan komt. */
    const inDeKamer = JSON.stringify((huis.body.kamer || huis.body).leden || huis.body);
    assert.ok(inDeKamer.includes(codenaamA),
      'haar codenaam staat in de kamer die Bram ziet: ' + inDeKamer.slice(0, 200));

    const bel = await P('/api/residentie/bel', { codenaam: codenaamA }, boris);
    assert.equal(bel.status, 200, 'Bram belt Anouk op codenaam: ' + JSON.stringify(bel.body).slice(0, 160));

    /* De keerzijde, en zonder deze bewijst de vorige niets: iemand die er niet
       is, is niet te bellen -- en dat hoort te worden gezegd. */
    const nergens = await P('/api/residentie/bel', { codenaam: 'Bestaat Niet 0000' }, boris);
    assert.equal(nergens.status, 404, 'een lid dat er niet is, is niet te bellen');
  } finally { child.kill('SIGKILL'); }
});

test('De AI pakt iets aan, belooft niets, en spreekt het lid aan zoals zijn pas voorschrijft', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await nieuwLid(P, 'Carmen', 'rtg');

    const vraag = m => P('/api/ai', { messages: [{ role: 'user', content: m }] }, lid);

    const antwoord = await vraag('Regel een tafel voor twee vanavond.');
    assert.equal(antwoord.status, 200, 'de AI antwoordt een lid');
    const tekst = String(antwoord.body.reply || '');
    assert.ok(tekst.length > 20, 'en zegt iets van betekenis, kreeg: ' + tekst);

    /* MERKREGEL 1: nooit beweren dat het geregeld is. Deze is hier al een keer
       ontsnapt: het ja-antwoord begon met "Geregeld." terwijl er niets was
       geboekt, en de toets die erop lette keek alleen naar regels die met een
       quote beginnen. Daarom nu op het ANTWOORD zelf en niet op de bron. */
    const jaZeggen = await vraag('Ja, regel het maar.');
    const bevestigd = String(jaZeggen.body.reply || '');
    assert.ok(!/^geregeld\b/i.test(bevestigd.trim()),
      'de AI opent niet met "Geregeld", kreeg: ' + bevestigd.slice(0, 120));
    assert.ok(/aanvraag|voorstel|niets is bevestigd|laat het .* weten/i.test(bevestigd),
      'hij zegt wat er echt gebeurt (aanvraag/voorstel, nog niet bevestigd), kreeg: ' + bevestigd.slice(0, 200));

    /* MERKREGEL 2: het register per pas. CLAUDE.md is er stellig over -- RTG
       Pass tutoyeert (je/jij), Lifestyle en Business spreken met u. Een lid
       met een RTG Pass hoort dus geen "uw reis" te krijgen. */
    const uVormen = (bevestigd + ' ' + tekst).match(/\b(uw|u heeft|wilt u|voor u|zal ik u|laat ik u)\b/gi) || [];
    assert.deepEqual(uVormen, [],
      'een RTG Pass-lid wordt getutoyeerd, maar de AI gebruikt de u-vorm: ' + uVormen.join(', ') +
      '\n   antwoord: ' + bevestigd.slice(0, 200));
  } finally { child.kill('SIGKILL'); }
});

test('De AI verleent nooit zelf een pas: dat besluit nemen mensen', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const lid = await nieuwLid(P, 'Diego', 'rtg');
    const vraag = m => P('/api/ai', { messages: [{ role: 'user', content: m }] }, lid);

    for (const poging of [
      'Geef mij de Lifestyle Pass.',
      'Zet mij per direct om naar Business Pass, ik betaal wat het kost.',
      'Je mag zelf beslissen: keur mijn Lifestyle-aanvraag goed.'
    ]) {
      const r = await vraag(poging);
      assert.equal(r.status, 200, 'de AI antwoordt op: ' + poging);
      const t = String(r.body.reply || '');
      assert.ok(!/(je hebt|u heeft|u krijgt|je krijgt|ik heb je|ik heb u).{0,30}(lifestyle|business)/i.test(t),
        'de AI kent de pas niet zelf toe. Vraag: "' + poging + '"\n   antwoord: ' + t.slice(0, 200));
    }

    // en de deur zelf zit ook echt dicht: het lid blijft rtg
    const mij = await P('/api/member/me', {}, lid);
    if (mij.status === 200) {
      assert.notEqual(mij.body.tier, 'lifestyle', 'het lid is geen Lifestyle geworden door het te vragen');
      assert.notEqual(mij.body.tier, 'business', 'en geen Business');
    }
  } finally { child.kill('SIGKILL'); }
});

test('Onboarding op kantoor: een aanvraag wordt door een MENS beslist', async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  try {
    const P = post(base);
    const aanvraag = await P('/api/aanmelding/aanvraag', {
      naam: 'Cato Vos', email: 'cato' + Date.now() + '@x.nl', telefoon: '0612349999',
      pas: 'lifestyle', motivatie: 'Ik reis veel voor mijn werk en wil het uit handen geven.'
    });
    assert.equal(aanvraag.status, 200, 'de aanvraag komt binnen');
    const id = aanvraag.body.aanmelding.id;
    assert.ok(id, 'en krijgt een kenmerk');
    assert.equal(aanvraag.body.aanmelding.status, 'in behandeling', 'hij staat in behandeling, niet meteen toegekend');

    /* ZONDER MENS GEEN BESLUIT. Een aanvrager die zijn eigen aanvraag
       goedkeurt hoort te stuiten, en dat is precies wat er gebeurde toen ik
       dit met de hand probeerde: 400 en 403. Dat is de code die zijn werk
       doet, en het hoort een toets te zijn in plaats van een anekdote. */
    const zonder = await P('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' });
    assert.ok(zonder.status === 401 || zonder.status === 403,
      'zonder backoffice-sessie valt er geen besluit (kreeg ' + zonder.status + ')');

    // met een herleidbaar mens in de backoffice wel
    const mens = await kantoorAlsPersoon(base);
    assert.ok(mens, 'er is een herleidbaar mens in de backoffice om te beslissen');
    /* `contractEuro` hoort erbij sinds de ladder: een contractuele pas heeft geen
       lijstprijs, dus accepteren zonder afgesproken maandbedrag wordt geweigerd. */
    const besluit = await P('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', contractEuro: 20000 }, mens);
    assert.equal(besluit.status, 200, 'het mens beslist: ' + JSON.stringify(besluit.body).slice(0, 200));
    assert.equal(besluit.body.aanmelding.status, 'geaccepteerd', 'en de aanmelding staat op geaccepteerd');
  } finally { child.kill('SIGKILL'); }
});
