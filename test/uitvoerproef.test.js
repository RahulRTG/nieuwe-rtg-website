/* DE UITVOER-SCHAKEL: LEKT HET ANTWOORD VAN EEN DOORLAAT?

   WAT ER MIS WAS. weegAntwoord() in scripts/lib/rolproef.js geeft bij een 2xx
   meteen `lek: null` terug -- de lekmerkers draaien dus alleen over
   WEIGERINGEN. In BEWIJSMATRIX.json was OUTPUT daardoor 0 van 3987 routes
   bewezen: van geen enkele route lag vast dat het antwoord geen gegevens van
   iemand anders bevat.

   WAT DEZE TOETS BEWAAKT, en de tweede helft is hier het echte werk:

     1. een kanarie van een ANDER account in een 2xx-antwoord is een lek;
     2. je EIGEN gegevens in je eigen antwoord zijn dat NIET -- anders slaat de
        proef af op /api/auth/mij en zet iemand hem binnen een week uit;
     3. een geheim veld (wachtwoordhash, sessietoken) is altijd een lek, ook van
        jezelf;
     4. alles wat geen 2xx is, is hier ONGEMETEN en niet groen: weigeringen zijn
        het werk van ACL en INPUT, en een tweede oordeel daarover zou een tweede
        waarheid zijn.

   Draai los: node --test test/uitvoerproef.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const u = require('../scripts/lib/uitvoerproef');

const kanaries = u.maakKanaries('77');

test('maakKanaries levert waarden die door validatie komen en toch uniek zijn', () => {
  assert.match(kanaries.email, /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, 'moet een geldig e-mailadres zijn');
  assert.match(kanaries.telefoon, /^06\d{8}$/, 'moet een geldig 06-nummer zijn');
  assert.ok(kanaries.naam.length >= 6, 'een te korte naam zou toevallig ergens in een antwoord staan');
});

test('een kanarie van een ander in een 2xx-antwoord is een lek', () => {
  for (const veld of ['naam', 'email', 'telefoon']) {
    const uit = u.weegUitvoer(200, { lijst: [{ iets: kanaries[veld] }] }, kanaries);
    assert.equal(uit.gemeten, true);
    assert.ok(uit.lek, 'de kanarie in het veld ' + veld + ' hoort een lek te zijn');
  }
  // ook door een tekstantwoord heen, niet alleen JSON
  assert.ok(u.weegUitvoer(200, 'Beste ' + kanaries.naam + ', ...', kanaries).lek);
  // en ongeacht hoofdletters, want een naam komt vaak anders gespeld terug
  assert.ok(u.weegUitvoer(200, { a: kanaries.email.toUpperCase() }, kanaries).lek);
});

test('je eigen gegevens zijn geen lek: geen vals alarm op /api/auth/mij', () => {
  /* Precies het antwoord dat de proef onbruikbaar zou maken als de lekmerkers
     blind over een doorlaat gingen: een eigen profiel met een eigen naam,
     e-mailadres en telefoonnummer erin. */
  const eigen = { naam: 'Rahul Ramdas', email: 'ikzelf@voorbeeld.nl', telefoon: '0612345678', codenaam: 'PAARSE-VOS' };
  const uit = u.weegUitvoer(200, eigen, kanaries);
  assert.equal(uit.gemeten, true, 'het is wel gemeten');
  assert.equal(uit.lek, null, 'maar eigen gegevens zijn geen lek');
});

test('een geheim veld is een lek zonder kanarie, maar naam EN waarde moeten kloppen', () => {
  assert.ok(u.weegUitvoer(200, { password_hash: 'scrypt$16384$8$1$abcdefghijklmnop' }, kanaries).lek,
    'de veldnaam die dit huis echt gebruikt');
  assert.ok(u.weegUitvoer(200, { token: 'a1b2c3d4e5f60718293a4b5c' }, kanaries).lek, 'een hex-token');
  assert.ok(u.weegUitvoer(200, { api_key: 'AbC123dEf456GhI789jKl012' }, kanaries).lek, 'een base64-sleutel');
  assert.equal(u.weegUitvoer(200, { ok: true, aantal: 3 }, kanaries).lek, null, 'een gewoon antwoord blijft schoon');
});

/* DE ZEVEN VALSE ALARMEN, ALS VASTE TOETS. De eerste volledige ronde over 3074
   routes gaf acht bevindingen en zeven waren vals: `sleutel` staat in de
   gedeelde merkerlijst omdat het "geheime sleutel" kan betekenen, maar in dit
   huis is het net zo vaak de key van een datastructuur. Deze toets houdt vast
   dat die niet terugkomen -- een proef met zeven op acht vals wordt uitgezet. */
test('geen vals alarm op een veldnaam met een gewone waarde', () => {
  for (const lijf of [{ sleutel: 'sociaal' }, { sleutel: 'week' }, { sleutel: 'basissalaris' },
    { pin: '1234' }, { token: 'kort' }, { hash: 'abc' }]) {
    assert.equal(u.weegUitvoer(200, lijf, kanaries).lek, null,
      JSON.stringify(lijf) + ' is geen geheim maar een gewone waarde');
  }
});

test('lijktGeheim: lang en niet-talig wel, een woord niet', () => {
  assert.equal(u.lijktGeheim('sociaal'), false, 'te kort');
  assert.equal(u.lijktGeheim('basissalarisregeling'), false, 'lang maar gewoon een woord');
  assert.equal(u.lijktGeheim('a1b2c3d4e5f60718'), true, 'hex van 16');
  assert.equal(u.lijktGeheim('scrypt$16384$8$1$zoutenhash'), true, 'scrypt-vorm');
  assert.equal(u.lijktGeheim('AbC123dEf456GhI789jKl012'), true, 'base64 met cijfers en letters');
});

/* De woordenlijst hoort op EEN plek te staan. Loopt de gedeelde merker uit
   rolproef.js uit de pas met de lijst hier, dan meet OUTPUT iets anders dan ACL
   en is er stilletjes een tweede waarheid ontstaan. */
test('de veldnamenlijst blijft dezelfde als de gedeelde lekmerker', () => {
  assert.ok(u.GEHEIMMERKER, 'de gedeelde geheim-veld-merker bestaat nog');
  for (const woord of ['password', 'secret', 'token', 'sleutel', 'hash', 'pin', 'wachtwoord']) {
    assert.ok(u.GEHEIMWOORDEN.test(woord), woord + ' hoort in beide lijsten te staan');
    assert.ok(u.GEHEIMMERKER.re.test('{"' + woord + '":"eenlangewaardehier"}'),
      woord + ' hoort ook de gedeelde merker te raken');
  }
});

test('alles wat geen 2xx is, is ONGEMETEN en niet groen', () => {
  for (const status of [400, 401, 403, 404, 409, 429, 500, 0]) {
    const uit = u.weegUitvoer(status, { error: 'nee' }, kanaries);
    assert.equal(uit.gemeten, false, status + ' hoort ongemeten te zijn (dat is ACL/INPUT hun werk)');
  }
  /* En een weigering die WEL een kanarie bevat blijft hier ongemeten -- niet
     omdat het geen lek is, maar omdat rolproef dat al weegt. Twee oordelen over
     hetzelfde antwoord is een tweede waarheid. */
  assert.equal(u.weegUitvoer(403, { naam: kanaries.naam }, kanaries).gemeten, false);
});

test('draaiUitvoerproef: schoon, lek en ongemeten komen elk in het register', async () => {
  const routes = [
    { method: 'POST', pad: '/api/schoon', rol: 'member' },
    { method: 'POST', pad: '/api/lek', rol: 'member' },
    { method: 'POST', pad: '/api/dicht', rol: 'member' }
  ];
  const post = async (pad) => {
    if (pad === '/api/schoon') return { status: 200, data: { ok: true } };
    if (pad === '/api/lek') return { status: 200, data: { wie: kanaries.email } };
    return { status: 403, data: { error: 'nee' } };
  };
  const uit = await u.draaiUitvoerproef({ post, routes, tokenVoor: () => 'tok',
    lijfVoor: () => ({}), kanaries });

  assert.equal(uit.perRoute['POST /api/schoon'].uitvoer, 'schoon');
  assert.equal(uit.perRoute['POST /api/lek'].uitvoer, 'GEZAKT');
  assert.equal(uit.perRoute['POST /api/dicht'].uitvoer, 'poort', 'nooit een 2xx = ongemeten, geen groen');
  assert.equal(uit.gemeten, 2, 'twee routes gaven werkelijk een antwoord om te wegen');
  assert.equal(uit.bevindingen.lekken.length, 1);
  assert.match(uit.bevindingen.lekken[0], /e-mailadres van een ander/);
});

test('draaiUitvoerproef: een verlopen token wordt eenmaal opnieuw gehaald', async () => {
  let ingelogd = false;
  const post = async () => (ingelogd ? { status: 200, data: { ok: true } } : { status: 401, data: {} });
  const uit = await u.draaiUitvoerproef({
    post, routes: [{ method: 'POST', pad: '/api/x', rol: 'member' }],
    tokenVoor: () => 'tok', lijfVoor: () => ({}), kanaries,
    hernieuw: async () => { ingelogd = true; return true; }
  });
  assert.equal(uit.hernieuwd, 1);
  assert.equal(uit.perRoute['POST /api/x'].uitvoer, 'schoon',
    'zonder de tweede poging zou een verlopen token als ongemeten wegvallen');
});
