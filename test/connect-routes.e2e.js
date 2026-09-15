/* DE TWEEENTWINTIG ROUTES VAN FOUNDATION CONNECT, tegen een echte server.

   test/connect.test.js beproeft de MODULES; deze toets beproeft de weg ernaartoe.
   Dat verschil is hier geen formaliteit en het is ook geen keuze: LAT.md zegt
   *geen nieuwe HTTP-route zonder minstens een treffer op een echte server in een
   gewone CI-toets* -- een nagemaakte app bewijst het handlergedrag en niet de
   MONTAGE of de DEUR. Die regel heeft een poort (test/routedekking.test.js,
   toets 6: elke route die de server registreert staat in DEKKING.json als
   aangeraakt), en die poort wees deze tweeentwintig meteen aan.

   WAAROM DE KETENPROEF DAAR NIET VOOR TELT. `npm run lusproef` raakt dezelfde
   routes op dezelfde manier, maar hij draait NIET in de gewone testronde -- hij
   is een ketenproef naast de suite, zoals tafelproef en ritproef. Een route die
   alleen door zo'n proef wordt geraakt, is voor de dekkingsmeter onzichtbaar, en
   dan staat de poort groen omdat er niets te zien is (de fout die de kop van
   routes/rtfos/index.js beschrijft, in een andere gedaante).

   DEZE TOETS IS DUS MET OPZET BREED EN ONDIEP: hij raakt elke deur een keer en
   laat het oordeel over gedrag aan de twee die daarvoor bestaan. Wat hij WEL
   scherp toetst, is het enige dat alleen hier te zien is -- dat de deuren
   werkelijk gemonteerd zijn, dat de ledendeur zonder token dicht zit en dat de
   gezinsdeur een geldig paar code+token eist. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

test('Foundation Connect: elke deur is gemonteerd, en geen enkele staat open', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-connect-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const lid = (await post('/api/login', { tier: 'rtg' })).body;
    assert.ok(lid.token, 'lid-inlog mislukt');

    /* DE ELF LEDENDEUREN. Elk met een lijf dat er echt doorheen komt, want een
       400 bewijst wel de montage maar niet dat de route iets DOET. */
    const ledenwegen = [
      ['/api/connect/ontdek', { vandaag: '2026-09-15' }],
      ['/api/connect/uitleg', { werkwoord: 'help', onderwerp: 'koken' }],
      ['/api/connect/horizon', {}],
      ['/api/connect/schuif', { schuif: 60 }],
      ['/api/connect/signaal', { onderwerp: 'koken', signaal: 'meer' }],
      ['/api/connect/open', { id: 'leerstof:x', onderwerp: 'koken', herkomst: 'leerstof' }],
      ['/api/connect/noteer', { trede: 'begrepen', onderwerp: 'koken' }],
      ['/api/connect/dossier', {}],
      ['/api/connect/naklank', { id: 'werk:1', soort: 'geleerd' }],
      ['/api/connect/naklank/tel', { id: 'werk:1' }],
      ['/api/connect/naklank/weg', { id: 'werk:1', soort: 'geleerd' }],
      ['/api/connect/kring', { huidig: 'alleenIk', kring: 'team' }],
      ['/api/connect/kring/keuzes', {}]
    ];
    for (const [pad, lijf] of ledenwegen) {
      /* ZONDER TOKEN EERST. Dit is de helft die alleen hier te zien is: een
         route kan perfect werken en toch open staan. */
      assert.equal((await post(pad, lijf)).status, 401, pad + ' hoort zonder inlog 401 te geven');
      const r = await post(pad, lijf, lid.token);
      assert.equal(r.status, 200, pad + ' hoort met inlog te werken (kreeg ' + r.status +
        ': ' + JSON.stringify(r.body).slice(0, 120) + ')');
    }

    /* DE NEGEN GEZINSDEUREN. Ze hangen aan `gezinsPoort` en niet aan `auth`, dus
       een ledentoken doet hier niets -- en dat is precies wat er misgaat als
       iemand de verkeerde poortwachter kopieert. */
    const gezin = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Proefgezin',
      naam: 'Papa', pin: '1234', bevoegdGezin: true, privacyAkkoord: true })).body;
    assert.ok(gezin.token, 'gezin aanmaken mislukt');
    const paar = { code: gezin.code, token: gezin.token };

    const gezinswegen = [
      ['/api/rtf/connect/ontdek', { vandaag: '2026-09-15' }],
      ['/api/rtf/connect/horizon', {}],
      ['/api/rtf/connect/signaal', { onderwerp: 'koken', signaal: 'meer' }],
      ['/api/rtf/connect/open', { id: 'leerstof:x', onderwerp: 'koken', herkomst: 'leerstof' }],
      ['/api/rtf/connect/noteer', { trede: 'begrepen', onderwerp: 'koken' }],
      ['/api/rtf/connect/dossier', {}],
      ['/api/rtf/connect/naklank', { id: 'werk:2', soort: 'geleerd' }],
      ['/api/rtf/connect/kring', { huidig: 'alleenIk', kring: 'team' }],
      ['/api/rtf/connect/kring/keuzes', {}]
    ];
    for (const [pad, lijf] of gezinswegen) {
      assert.equal((await post(pad, lijf)).status, 403, pad + ' hoort zonder gezin 403 te geven');
      /* EEN GELDIGE CODE MET EEN VERKEERD TOKEN: de code wijst het object aan,
         het token bewijst het. Zonder deze regel toetst de vorige alleen dat er
         iets in het lijf moet staan. */
      assert.equal((await post(pad, Object.assign({ code: gezin.code, token: 'nep' }, lijf))).status, 403,
        pad + ' hoort een verkeerd token te weigeren');
      const r = await post(pad, Object.assign({}, paar, lijf));
      assert.equal(r.status, 200, pad + ' hoort met een gezinsprofiel te werken (kreeg ' + r.status +
        ': ' + JSON.stringify(r.body).slice(0, 120) + ')');
    }

    /* EEN GASTPROFIEL KOMT ER NIET IN, en dat is geen detail: de naam
       `gezinsPoort` is in kern/handlerpoorten/buiten.js verklaard als "gasten
       eruit", en drie andere routes leunen op die lezing. Hier hoorde het ook
       inhoudelijk: elke deur bewaart iets van de mens zelf, en een gast heeft
       geen codenaam om dat aan te hangen. */
    const gast = (await post('/api/foundation/gezin/profiel/maak',
      Object.assign({ naam: 'Gast', rol: 'gast' }, paar))).body;
    if (gast && gast.profiel && gast.profiel.id) {
      const kies = (await post('/api/foundation/gezin/profiel/kies',
        { code: gezin.code, profielId: gast.profiel.id })).body;
      if (kies && kies.token) {
        const r = await post('/api/rtf/connect/ontdek', { code: gezin.code, token: kies.token });
        assert.equal(r.status, 403, 'een gastprofiel komt de Connect-deur niet door');
        assert.match(String(r.body.error || ''), /gezinsleden zelf/,
          'en hoort te horen waarom, niet alleen dat het niet mag');
      }
    }

    /* EN DE TWEE MOTOREN ZIJN DEZELFDE. Dit is de belofte van de tweede deur --
       dezelfde vorm en dezelfde reden als /api/knelpunt naast /api/rtf/knelpunt:
       een gezin mag nooit een ander antwoord kunnen krijgen dan een lid. Hier is
       dat te zien aan de STRUCTUUR van het antwoord; de inhoud verschilt terecht,
       want de twee hebben een eigen horizon. */
    const alsLid = (await post('/api/connect/ontdek', { vandaag: '2026-09-15' }, lid.token)).body;
    const alsGezin = (await post('/api/rtf/connect/ontdek', Object.assign({ vandaag: '2026-09-15' }, paar))).body;
    assert.deepEqual(Object.keys(alsLid).sort(), Object.keys(alsGezin).sort(),
      'de twee deuren geven een antwoord van dezelfde vorm');
    assert.deepEqual(alsLid.motoren.map(m => m.id), alsGezin.motoren.map(m => m.id),
      'en dezelfde acht motoren, in dezelfde volgorde');
  } finally {
    stop(srv);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
