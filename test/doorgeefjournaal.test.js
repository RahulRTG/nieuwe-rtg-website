/* HET DOORGEEFJOURNAAL: zien wat er binnenkwam en wat de deur uitging.

   WAAROM DIT ER IS. In een nacht gingen drie dingen mis die allemaal ONZICHTBAAR
   faalden: de sleutels verzonnen zichzelf opnieuw, de herstel-link lag op straat,
   en de sms met de herstelcode viel stil op de grond terwijl het antwoord
   `tweestaps: true` meldde. Bij alle drie was "wat gebeurde er eigenlijk?" niet
   te beantwoorden zonder in de code te duiken.

   WAT DEZE TOETSEN BEWAKEN, in volgorde van belang:

   1. Er komt NOOIT een persoon in het journaal. Geen naam, geen e-mailadres,
      geen telefoonnummer, geen token. Het huis draait op codenamen, en een
      logboek is geen achterdeur om die regel heen. Dit is de bewering die het
      zwaarst weegt: een journaal dat lekt is erger dan geen journaal.
   2. Een MISLUKKING valt op. Dat is het hele punt.
   3. Het journaal mag nooit iets breken -- ook niet als er iets misgaat in het
      journaal zelf. De meting mag niet de storing worden. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakDoorgeefjournaal, padVorm, bestemmingVorm } = require('../server/kern/doorgeefjournaal');

const versDb = () => ({ data: {} });

test('een uitgaand bericht draagt de soort en het domein, nooit de persoon', () => {
  const db = versDb();
  const j = maakDoorgeefjournaal({ db, save: () => {} });
  j.journaalBuiten({ wat: 'post/outbox', naar: 'jamie.de.vries@voorbeeld.nl' });
  j.journaalBuiten({ wat: 'post/outbox', naar: 'sms:+31612345678' });

  const alles = JSON.stringify(j.journaalLees({}).regels);
  assert.ok(!alles.includes('jamie.de.vries'), 'het adres hoort er niet in te staan: ' + alles.slice(0, 200));
  assert.ok(!alles.includes('+31612345678'), 'en het telefoonnummer ook niet: ' + alles.slice(0, 200));
  assert.ok(alles.includes('voorbeeld.nl'), 'het domein mag wel: daaraan zie je of de post ergens heen kan');
  assert.ok(alles.includes('sms'), 'en dat het een sms was ook, anders zie je niet DAT hij is gestuurd');
});

test('een pad gaat er in vorm in, zonder nummers die naar iemand leiden', () => {
  assert.equal(padVorm('/api/lid/42/pas'), '/api/lid/:id/pas');
  assert.equal(padVorm('/api/doos/a1b2c3d4e5f60718/stand'), '/api/doos/:sleutel/stand');
  assert.equal(bestemmingVorm('iemand@rtg.example'), 'mail:rtg.example');
  assert.equal(bestemmingVorm('sms:+31612345678'), 'sms');
});

test('een mislukking valt op, en dat is het hele punt', () => {
  const db = versDb();
  const j = maakDoorgeefjournaal({ db, save: () => {} });
  j.journaalBinnen({ wat: '/api/iets', methode: 'POST', status: 200 });
  j.journaalBinnen({ wat: '/api/iets', methode: 'POST', status: 500, mislukt: true });
  j.journaalBuiten({ wat: 'post/smtp', naar: 'x@y.nl', mislukt: true, reden: 'verbinding geweigerd' });

  const beeld = j.journaalBeeld();
  assert.equal(beeld.mislukt, 2, 'twee mislukkingen horen geteld te worden: ' + JSON.stringify(beeld));
  assert.equal(beeld.uitMislukt, 1, 'en apart hoeveel er UITGAAND misging, want daar zat de storing van vannacht');

  const alleen = j.journaalLees({ alleenMislukt: true });
  assert.equal(alleen.regels.length, 2, 'filteren op mislukt hoort alleen de mislukkingen te geven');
});

test('wat bewaard blijft is wat je morgen nog wilt weten', () => {
  const db = versDb();
  const j = maakDoorgeefjournaal({ db, save: () => {} });
  j.journaalBinnen({ wat: '/api/lijstje', methode: 'GET', status: 200 });      // gewoon gelukt: niet bewaren
  j.journaalBinnen({ wat: '/api/schrijf', methode: 'POST', status: 200 });     // schrijvend: bewaren
  j.journaalBinnen({ wat: '/api/lijstje', methode: 'GET', status: 500, mislukt: true }); // mislukt: bewaren
  j.journaalBuiten({ wat: 'post/outbox', naar: 'x@y.nl' });                    // uitgaand: bewaren

  assert.equal(j.journaalLees({}).regels.length, 4, 'het venster toont alles');
  const bewaard = j.journaalLees({ bron: 'bewaard' });
  assert.equal(bewaard.regels.length, 3,
    'een geslaagde GET is morgen niemand iets waard; de rest wel: ' + JSON.stringify(bewaard.regels.map(r => r.wat)));
});

test('het journaal mag nooit een verzoek breken', () => {
  const haak = require('../server/journaalhaak');
  haak.zet(() => { throw new Error('het journaal is stuk'); });
  assert.doesNotThrow(() => haak.meld({ richting: 'in', wat: '/api/iets' }),
    'een kapot journaal mag de aanroeper niet meenemen; dan is de meting zelf de storing');
  haak.zet(null);
});

test('zonder aangemeld journaal doet melden gewoon niets', () => {
  const haak = require('../server/journaalhaak');
  haak.zet(null);
  assert.doesNotThrow(() => haak.meld({ richting: 'uit', wat: 'post/outbox' }),
    'in een script of een toets is er geen journaal, en dat hoort geen fout te zijn');
});

/* DE BEDRADING, niet alleen de kern. De toetsen hierboven dekken het journaal
   zelf; deze dekt de draden ernaartoe: komt er echt iets in als er verkeer is,
   en is het via de boardroom te lezen? Dat was de hele vraag -- een journaal dat
   je niet kunt lezen, lost niets op. */
test('verkeer landt in het journaal en is via de boardroom te lezen', async () => {
  const { startServer, stop, kantoorAlsPersoon } = require('./helper');
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const post = async (pad, body, tok) => {
    const r = await fetch(srv.base + pad, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {})
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    // verkeer maken: iets schrijvends, iets dat post stuurt, en iets dat faalt
    await post('/api/auth/register', { name: 'Journaal Lid', email: 'journaallid@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    await post('/api/auth/forgot', { email: 'journaallid@x.nl' });
    await post('/api/dit-pad-bestaat-niet', {});

    const kantoor = await kantoorAlsPersoon(srv.base);
    assert.ok(kantoor, 'een kantoorsessie als de eigenaar');
    const j = await post('/api/office/journaal', { max: 200 }, kantoor);
    assert.equal(j.status, 200, 'het journaal hoort leesbaar te zijn: ' + JSON.stringify(j.body).slice(0, 160));

    const paden = (j.body.regels || []).map(r => r.wat);
    assert.ok(paden.some(x => x === '/api/auth/register'),
      'een schrijvend verzoek hoort erin te staan. Gevonden: ' + paden.slice(0, 12).join(', '));
    assert.ok(paden.some(x => String(x).startsWith('post/')),
      'de post die de deur uitging hoort erin te staan -- juist die kant ontbrak. Gevonden: ' + paden.slice(0, 12).join(', '));

    const fouten = await post('/api/office/journaal', { alleenMislukt: true }, kantoor);
    assert.ok((fouten.body.regels || []).length >= 1,
      'een verzoek dat faalde hoort terug te vinden zijn onder de mislukkingen');

    // en het journaal lekt niets, ook niet via deze weg
    const alles = JSON.stringify(j.body);
    assert.ok(!alles.includes('journaallid@x.nl'),
      'het adres van het lid hoort NERGENS in het journaal te staan: ' + alles.slice(0, 200));

    /* HET BEELD IS EEN SAMENVATTING VAN DEZELFDE LIJST, geen tweede telling.
       Het bestaat zodat een scherm elke paar seconden kan kijken zonder de hele
       lijst op te halen; loopt het uiteen, dan kijkt dat scherm naar iets
       anders dan waar het naartoe klikt. Deze deur werd door geen enkele toets
       geopend, terwijl juist hier twee tellingen uit elkaar kunnen lopen. */
    const beeld = await post('/api/office/journaal/beeld', {}, kantoor);
    assert.equal(beeld.status, 200, 'het beeld hoort leesbaar te zijn: ' + JSON.stringify(beeld.body).slice(0, 160));
    assert.equal(typeof beeld.body.mislukt, 'number', 'het getal dat telt staat erin');
    assert.ok(beeld.body.mislukt >= 1, 'de mislukking van hierboven telt mee in het beeld');
    assert.equal(beeld.body.venster + beeld.body.bewaard >= (j.body.regels || []).length, true,
      'het beeld telt minstens wat de lijst toont: ' + beeld.body.venster + '/' + beeld.body.bewaard);
    assert.equal(beeld.body.in + beeld.body.uit, beeld.body.venster,
      'in en uit samen zijn het hele venster en geen derde categorie');

    const dicht = await post('/api/office/journaal/beeld', {});
    assert.equal(dicht.status, 401, 'zonder boardroomsessie blijft ook het beeld dicht');
  } finally { stop(srv.child); }
});
