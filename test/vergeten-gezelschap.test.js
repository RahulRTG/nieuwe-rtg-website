/* VERGETEN, maar dan voor iedereen.

   test/vergeten.test.js veegt door de hele database en is streng, maar hij doet
   dat voor EEN lid: een RTG-lid van middelbare leeftijd zonder gezin. Alles wat
   alleen bestaat voor een Lifestyle- of Business-lid ligt daarmee buiten beeld --
   niet omdat het is uitgezonderd, maar omdat er nooit iemand van dat soort is
   verwijderd.

   Dat is geen theoretisch verschil. Een hogere pas krijgt andere dingen: een
   aanmeldingsdossier waar een mens ja tegen zei, contacten met leden die hij
   heeft aangesproken, een andere plek in de gids. Elk daarvan is een tak waar
   zijn sleutel in kan blijven hangen.

   Deze test verwijdert daarom EEN LID PER PAS en veegt na elk daarvan opnieuw.
   Wat overblijft staat met tak en al in de foutmelding.

   Draai los: node --experimental-sqlite --test test/vergeten-gezelschap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const { bouwGezelschap } = require('./gezelschap');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CODE = 'VERGEETALLEN9';

/* Takken die een verwijderd lid met NAAM mogen blijven noemen, met de reden.
   Elk hiervan is een keuze die elders is vastgelegd; ze staan hier zodat je ze
   ziet in plaats van dat ze stil door de mazen glippen. */
const MAG_BLIJVEN = new Map([
  ['inzagelog', 'auditlog: geen naam, alleen een account-id dat nergens meer op slaat (AVG art. 17 lid 3)'],
  ['giftcards', 'de kaart vertegenwoordigt geld van de zaak; de koper is eruit gehaald'],
  ['supplierNotifications', 'de administratie van de zaak; de codenaam is vervangen door (verwijderd)'],
  ['lidmaatschapBetalingen', 'fiscale bewaarplicht van 7 jaar (AVG art. 17 lid 3 sub b); staat met grond en al in server/bewaartermijnen.js'],

  /* HET HANDELINGSSPOOR, en met opzet NIET blanco vrijgesteld.

     Waarom het mag blijven: het is dezelfde afweging als bij het inzagejournaal
     hierboven. Een auditspoor dat verdwijnt zodra de betrokkene erom vraagt, is
     geen auditspoor meer -- en juist daarom staan er codenamen in en geen
     namen. Na wissing wijst `user-42` naar een account dat niet meer bestaat.
     De grond staat in server/bewaarbeleid.js (tak 'handelingLog', grond
     'audit') en het doel in VERWERKINGSREGISTER.md.

     Waarom het toch niet blanco is: een tak die je helemaal overslaat, ziet
     nooit meer iets. Zet iemand hier later een naam, een e-mailadres of een
     codenaam in -- bijvoorbeeld door de body alsnog mee te loggen -- dan zwijgt
     een blanco uitzondering daarover. `alleen: ['sleutel']` laat precies het ene
     door dat hier hoort te staan en houdt de rest tegen. */
  ['handelingLog', { alleen: ['sleutel'],
    waarom: 'auditspoor: alleen de pseudonieme sleutel, die na wissing nergens meer op slaat ' +
      '(AVG art. 17 lid 3; bewaartermijn in server/bewaarbeleid.js, tak handelingLog)' }]
]);

/* Elke uitzondering hierboven moet ook ECHT ergens vastgelegd zijn. Een tak die
   alleen in een test als "mag blijven" is afgevinkt, is een uitzondering die
   niemand kan navertellen -- en precies zo verdwijnt een belofte. */
const BELEID = require('../server/bewaartermijnen').BELEID || [];

test('wat mag blijven staan, staat ook in het bewaarbeleid', () => {
  const wettelijk = MAG_BLIJVEN.get('lidmaatschapBetalingen');
  assert.ok(wettelijk, 'de wettelijke uitzondering staat benoemd');
  const regel = BELEID.find(r => r.tak === 'lidmaatschapBetalingen');
  assert.ok(regel, 'en hij staat in server/bewaartermijnen.js, niet alleen hier');
  assert.equal(regel.grond, 'wettelijk', 'met de juiste grond');
  assert.ok(regel.dagen > 6 * 365, 'en een termijn die bij de fiscale bewaarplicht past');

  /* Hetzelfde voor het handelingsspoor. Dat het mag blijven staan is hierboven
     een regel in een Map; dat het ook echt een TERMIJN heeft, is wat voorkomt
     dat "auditspoor" een woord wordt waarmee je iets voor altijd bewaart. */
  const audit = BELEID.find(r => r.tak === 'handelingLog');
  assert.ok(audit, 'het handelingsspoor staat in het bewaarbeleid, niet alleen in deze test');
  assert.equal(audit.grond, 'audit');
  assert.ok(audit.dagen > 0 && audit.dagen <= 2 * 365,
    'met een eindige termijn -- een auditspoor zonder einde is een permanent dossier');
});

test('vergetelheid werkt voor elke pas, niet alleen voor een RTG-lid', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vga-'));
  /* RTG_STORE=json om dezelfde reden als in vergeten.test.js: dan kan de bezem
     rechtstreeks lezen wat er op schijf staat, zonder een databaseschema te
     kennen dat met elke functie kan veranderen. */
  const { child, base } = await startServer({ env: {
    SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE, RTG_STORE: 'json' } });
  try {
    const office = await fetch(base + '/api/office/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE }) })
      .then(r => r.json());
    assert.ok(office.token, 'het kantoor kan binnen');

    // het publiek zonder het genre-deel: we verwijderen er drie, geen zeventig
    const g = await bouwGezelschap(base, { genres: false });
    const post = g.post;

    /* Elk lid laat eerst sporen na. Niet uitputtend -- dat kan niet met ruim
       honderdvijftig takken -- maar wel in de hoeken die per pas verschillen. */
    for (const naam of ['rtg', 'lifestyle', 'business']) {
      const lid = g.passen[naam];
      const t = lid.token;
      await post('/api/salon/plaats', { tekst: 'Een woord van ' + lid.naam + '.' }, t);
      await post('/api/zorgprofiel/zet', { allergenen: ['noten'], deel: true }, t);
      await post('/api/wallet/voeg', { soort: 'klantenkaart', titel: 'Kaart ' + lid.naam, code: 'K-' + naam }, t);
      await post('/api/fluister', { q: 'onthoud dat ' + lid.naam + ' bij het raam zit' }, t);
      await post('/api/cv/save', { cv: { headline: 'Iets van ' + lid.naam, skills: ['zeilen'] } }, t);
    }
    /* En het verkeer tussen de passen, want dat maakt contacten aan: een hoger
       lid dat een RTG-lid aanspreekt legt een regel vast in db.data.contacts.
       Precies zo'n tak die je pas ziet als je een HOGER lid verwijdert. */
    const salonPost = await post('/api/salon/plaats', { tekst: 'Hallo van Rita.' }, g.passen.rtg.token);
    const pid = (salonPost.body.post && salonPost.body.post.id) != null ? salonPost.body.post.id : salonPost.body.id;
    for (const hoger of ['lifestyle', 'business']) {
      const r = await post('/api/dm', { postId: pid, text: 'Dag Rita.' }, g.passen[hoger].token);
      assert.equal(r.status, 200, hoger + ' spreekt het RTG-lid aan (anders bewijst de rest niets)');
    }

    await new Promise(r => setTimeout(r, 600));

    // ---- en dan een voor een verwijderen, met de bezem erachteraan ----
    for (const naam of ['rtg', 'lifestyle', 'business']) {
      const lid = g.passen[naam];
      const weg = await post('/api/privacy/delete', {}, lid.token);
      assert.equal(weg.status, 200, naam + ': de verwijderroute meldt succes');

      const na = await post('/api/state', {}, lid.token);
      assert.ok(na.status >= 400, naam + ': de sessie is beeindigd');

      await new Promise(r => setTimeout(r, 700));
      const bestand = path.join(TMP, 'db.json');
      assert.ok(fs.existsSync(bestand), 'er staat een databasebestand');
      const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));

      const raak = [];
      for (const [tak, waarde] of Object.entries(data)) {
        const vrij = MAG_BLIJVEN.get(tak);
        if (typeof vrij === 'string') continue;          // blanco vrijgesteld
        const tekst = JSON.stringify(waarde == null ? null : waarde);
        if (!tekst) continue;
        let wat = [];
        if (lid.key && tekst.includes('"' + lid.key + '"')) wat.push('sleutel');
        if (lid.codenaam && tekst.includes(lid.codenaam)) wat.push('codenaam');
        if (tekst.includes(lid.naam) || tekst.includes(lid.email)) wat.push('NAAM/E-MAIL');
        /* Gedeeltelijk vrijgesteld: alleen wat er met reden hoort te staan valt
           weg, al het andere blijft een fout. */
        if (vrij && Array.isArray(vrij.alleen)) wat = wat.filter(w => !vrij.alleen.includes(w));
        if (wat.length) raak.push(tak + ' (' + wat.join(' + ') + ')');
      }
      assert.deepEqual(raak, [],
        'na het verwijderen van het ' + naam.toUpperCase() + '-lid staat het nog in deze takken; ' +
        'elke tak hier is een plek waar het recht op vergetelheid niet is nagekomen:\n  ' + raak.join('\n  '));
    }
  } finally { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
