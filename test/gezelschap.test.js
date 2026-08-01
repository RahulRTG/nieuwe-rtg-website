/* HET GEZELSCHAP: kan iedereen elkaar bereiken -- en wie juist niet?

   Het proefpubliek (test/gezelschap.js) zet alle passen neer, alle RTF-leeftijden
   en een lid per genre. Deze test doet er twee dingen mee.

   1. IEDEREEN BEREIKT IEDEREEN. Niet steekproefsgewijs maar volledig: elk lid
      plaatst iets in De Salon en elk ander lid reageert er prive op. Bij elf
      leden zijn dat honderdtien echte berichten. Dat lijkt overdreven tot je
      bedenkt wat een gat hier betekent: een lid dat voor precies een pas of een
      genre onbereikbaar is, merkt niemand -- er faalt niets, er komt alleen
      nooit antwoord.

   2. EN DE BESCHERMDE LAAG BLIJFT DICHT. Dat is de andere helft en de
      belangrijkste: kinderen t/m 15 zijn met opzet NIET bereikbaar. Die grens is
      geen instelling maar principe (foundation/gezinshulp.js: isBeschermd), en
      een test die alleen "iedereen kan elkaar bereiken" afdwingt zou groen staan
      op een systeem waarin dat ook voor een kind van zeven geldt. Daarom wordt
      hier van BEIDE kanten geduwd.

   Draai los: node --experimental-sqlite --test test/gezelschap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const { bouwGezelschap, ALLE_GENRES } = require('./gezelschap');
const fs = require('fs'); const os = require('os'); const path = require('path');

const CODE = 'GEZELSCHAP99';

test('het hele gezelschap staat er, en iedereen bereikt iedereen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gez-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const office = await fetch(base + '/api/office/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE }) })
      .then(r => r.json());
    assert.ok(office.token, 'het kantoor kan binnen');

    const g = await bouwGezelschap(base);
    const post = g.post;

    // ---- de passen, en hoe ze ontstonden ----
    assert.equal(g.passen.rtg.pas, 'rtg');
    assert.equal(g.passen.lifestyle.pas, 'lifestyle', 'Lifestyle bestaat, via een menselijk akkoord');
    assert.equal(g.passen.business.pas, 'business', 'Business ook');
    for (const naam of ['rtg', 'lifestyle', 'business']) {
      const s = await post('/api/state', {}, g.passen[naam].token);
      const st = s.body.state || s.body;
      assert.equal(st.user.tier, g.passen[naam].pas, naam + ' draait echt op die pas');
    }

    // ---- de RTF-leeftijden ----
    assert.deepEqual(Object.keys(g.gezin.leden).sort(), ['jong', 'kind', 'mini', 'tiener', 'volw'],
      'elke RTF-leeftijdslaag is bezet');

    // ---- de genres ----
    assert.ok(g.genres.length >= 5, 'er staan partners in meerdere genres: ' + g.genres.join(', '));
    for (const genre of g.genres) {
      assert.ok(g.perGenre[genre] && g.perGenre[genre].token, 'genre ' + genre + ' heeft een lid');
      assert.ok(g.perGenre[genre].partner, 'en een partner om iets bij te doen');
    }
    /* Eerlijk melden wat er NIET bezet is. Dit is bewust geen fout: de kern kent
       31 genres en de demo-data vult er een deel. Maar het hoort zichtbaar te
       zijn, want een leeg genre is een hoek waar geen enkele controle komt. */
    console.log('genres met een partner: ' + g.genres.length + '; uit de aanmeldingslijst nog leeg (' +
      g.genresZonderPartner.length + '/' + ALLE_GENRES.length + '): ' + (g.genresZonderPartner.join(', ') || 'geen'));

    // ---- 1. WIE BEREIKT WIE ----
    // elk lid zet eerst iets in De Salon, zodat er iets is om op te reageren
    for (const lid of g.allen) {
      const p = await post('/api/salon/plaats', { tekst: 'Hallo, hier is ' + lid.naam + '.' }, lid.token);
      assert.equal(p.status, 200, lid.naam + ' kan in De Salon posten: ' + JSON.stringify(p.body));
      lid.postId = (p.body.post && p.body.post.id) != null ? p.body.post.id : p.body.id;
      assert.ok(lid.postId != null, lid.naam + ' heeft een post-id');
    }
    const dm = (van, naar) => post('/api/dm',
      { postId: naar.postId, text: 'Dag ' + naar.naam + ', van ' + van.naam }, van.token);

    /* De genre-leden dragen allemaal een RTG Pass, dus onderling geldt de
       eenvoudige regel: gelijke pas, vrij verkeer. Hier wordt dat volledig
       afgerekend -- elk genre-lid naar elk ander genre-lid. Een genre dat voor
       de rest onbereikbaar zou zijn, valt hier op en nergens anders: er faalt
       niets, er komt alleen nooit antwoord. */
    const rtgLeden = [g.passen.rtg, ...Object.values(g.perGenre)];
    const stil = [];
    let heen = 0;
    for (const van of rtgLeden) {
      for (const naar of rtgLeden) {
        if (van === naar) continue;
        const r = await dm(van, naar);
        if (r.status === 200) heen++;
        else stil.push(van.naam + ' -> ' + naar.naam + ' (' + r.status + ': ' + (r.body.error || '') + ')');
      }
    }
    assert.deepEqual(stil, [], 'deze leden konden elkaar niet bereiken:\n  ' + stil.join('\n  '));
    assert.equal(heen, rtgLeden.length * (rtgLeden.length - 1),
      'alle ' + rtgLeden.length + ' RTG-leden (elke pas-genre-combinatie) bereiken elkaar');

    /* En dan de regel die NIET "iedereen bereikt iedereen" is, en dat ook niet
       hoort te zijn (kern/lid.js: canEngage). Een gast kan helemaal niet
       aanspreken; een RTG-lid alleen andere RTG-leden -- tenzij het hogere lid
       hem eerst aansprak. Lifestyle en Business bereiken iedereen.

       Dit staat hier omdat een test die alleen "iedereen bereikt iedereen"
       afdwingt, groen zou blijven op een systeem dat die hele laag had laten
       vallen. De grens hoort net zo hard vast te liggen als de bereikbaarheid. */
    const gastDm = await dm(g.passen.gast, g.passen.rtg);
    assert.equal(gastDm.status, 403, 'zonder pas spreek je niemand aan');

    const omhoog = await dm(g.passen.rtg, g.passen.lifestyle);
    assert.equal(omhoog.status, 403, 'RTG spreekt een hoger lid niet uit zichzelf aan');

    for (const hoger of [g.passen.lifestyle, g.passen.business]) {
      const omlaag = await dm(hoger, g.passen.rtg);
      assert.equal(omlaag.status, 200, hoger.naam + ' bereikt een RTG-lid wel');
      const heenTerug = await dm(hoger, g.passen.business === hoger ? g.passen.lifestyle : g.passen.business);
      assert.equal(heenTerug.status, 200, hoger.naam + ' bereikt ook het andere hogere lid');
    }

    /* DE DEUR DIE OPENGAAT. De foutmelding belooft het met zoveel woorden:
       "tenzij dit lid u eerst heeft aangesproken". Lifestyle heeft hierboven
       net een DM aan Rita gestuurd, dus vanaf nu hoort zij terug te kunnen. */
    const terug = await dm(g.passen.rtg, g.passen.lifestyle);
    assert.equal(terug.status, 200,
      'nadat een hoger lid haar aansprak, mag een RTG-lid terugpraten (kreeg ' +
      terug.status + ': ' + (terug.body.error || '') + ')');

    // ---- 2. EN DE BESCHERMDE LAAG BLIJFT DICHT ----
    /* Een lid dat niet aan dit gezin gekoppeld is, komt er niet in -- ook niet
       met de gezinscode in de hand. En er is geen endpoint dat een kind
       persoonlijk aanspreekt: berichten gaan naar het gezin, nooit naar een
       kind. Dat is precies de bedoeling. */
    const indringer = g.passen.business;
    const dicht = await post('/api/rtf/bericht', { code: g.gezin.code, tekst: 'hoi Kaya' }, indringer.token);
    assert.equal(dicht.status, 403,
      'een niet-gekoppeld lid komt het gezin niet in (kreeg ' + dicht.status + ')');

    const raar = await post('/api/rtf/bericht', { code: 'ZZZZZZ', tekst: 'hoi' }, indringer.token);
    assert.ok(raar.status >= 400, 'en een verzonnen gezinscode ook niet');

    /* De drie beschermde lagen staan als beschermd geregistreerd; dat is de
       grens waar de rest van de code op leunt. */
    for (const groep of ['mini', 'kind', 'tiener']) {
      assert.equal(g.gezin.leden[groep].rol, 'kind', groep + ' is een kindprofiel en dus beschermd');
    }
  } finally { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
