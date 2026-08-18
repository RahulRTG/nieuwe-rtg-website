/* HET REISAANBOD: van een leeg reisbureau naar een reis in het dossier.

   DE KETEN DIE HIER GEMETEN WORDT was tot nu toe doorgeknipt. Het reisbureau
   LAS db.data.partnerTrips en niets in het hele huis SCHREEF daar ooit iets in:
   de seed was de enige bron, en die begint zonder RTG_DEMO leeg. Op een echte
   installatie betekende dat een reisbureau met nul reizen, een boek() die op
   elke aanvraag 404 gaf, en een reisdossier dat dus nooit iets te schrijven
   kreeg. Een scherm dat aanbod belooft met een bak die niemand kan vullen is
   een belofte die de code niet waarmaakt (LAT-regel 6).

   Deze toets draait daarom ZONDER RTG_DEMO -- de stand van een echte server --
   en loopt de hele keten: leeg -> het kantoor stelt een reis samen -> het lid
   ziet hem en vraagt hem aan -> de reisadviseur bevestigt -> hij staat als
   bevestigd in het dossier van dat lid. Zakt hij, dan is de keten weer stuk.

   Draai: npm test -- --bestanden=reisaanbod */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const CODE = 'RTG-REIS-TEST';

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
/* Een lid dat zijn gegevens al heeft ingevuld. Dat laatste hoort erbij: een
   reis aanvragen betrekt een derde partij, dus de gegevenspoort vraagt eerst om
   telefoon en adres (428, kern/gegevenspoort.js). Zonder die stap meet deze
   toets die poort in plaats van het reisaanbod. Invullen gaat langs de gewone
   weg -- het inrichten uit de onboarding, precies zoals een nieuw lid het doet. */
async function versLid(P, naam) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld: ' + JSON.stringify(r.body).slice(0, 140));
  const ingericht = await P('/api/onboarding/inricht', { velden: {
    telefoon: '0612345678', adres: 'Proefstraat 1', postcode: '1000 AA', plaats: 'Proefdorp', land: 'NL'
  } }, r.body.token);
  assert.equal(ingericht.status, 200, 'het inrichten lukt: ' + JSON.stringify(ingericht.body).slice(0, 160));
  return r.body.token;
}

const REIS = {
  titel: 'Lissabon, lange weekend', bestemming: 'Lissabon', netto: 640,
  dates: '4 dagen · doorlopend', desc: 'Een stadsappartement in Alfama, met de tram naar Belem.',
  includes: ['Vlucht en transfers', 'Appartement, 3 nachten'], visual: 'v-lissabon'
};

test('van een leeg reisbureau naar een bevestigde reis in het dossier', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ra-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE, RTG_DEMO: '' } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Wender');
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    assert.ok(kantoor, 'de kantoorcode werkt');

    // 1. LEEG, en dat is de stand van een echte server
    assert.deepEqual((await P('/api/reisbureau', {}, lid)).body.reizen, [],
      'het reisbureau begint leeg');
    assert.deepEqual((await P('/api/office/reisaanbod', {}, kantoor)).body.reizen, [],
      'en het kantoor ziet dat ook zo');

    /* En aanvragen kan dan niet. Dit is precies wat er stond zolang er geen
       schrijver was: elk lid, elke reis, altijd 404 -- ook voor een lid dat
       zijn gegevens netjes heeft ingevuld en dus niet op de gegevenspoort
       stuit. */
    const kaal = await P('/api/reisbureau/boek', { tripId: 'lissabon-lang-weekend' }, lid);
    assert.equal(kaal.status, 404, 'zonder aanbod valt er niets aan te vragen: ' +
      JSON.stringify(kaal.body).slice(0, 160));

    // 2. HET KANTOOR STELT EEN REIS SAMEN
    const gezet = await P('/api/office/reisaanbod/zet', REIS, kantoor);
    assert.equal(gezet.status, 200, JSON.stringify(gezet.body).slice(0, 200));
    assert.equal(gezet.body.nieuw, true, 'het is een nieuwe reis');
    const id = gezet.body.reis.id;
    assert.ok(id && /^[a-z0-9-]+$/.test(id), 'met een leesbare sleutel: ' + id);

    /* 3. HET LID ZIET HEM, tegen de nettoprijs. Dat is de belofte van het
       reisbureau: leden reizen zonder opslag. */
    const aanbod = (await P('/api/reisbureau', {}, lid)).body.reizen || [];
    assert.equal(aanbod.length, 1, 'één reis in de catalogus: ' + JSON.stringify(aanbod).slice(0, 200));
    assert.equal(aanbod[0].titel, REIS.titel);
    assert.equal(aanbod[0].bestemming, REIS.bestemming);
    assert.equal(aanbod[0].prijs, REIS.netto, 'de nettoprijs, zonder opslag');
    assert.deepEqual(aanbod[0].inbegrepen, REIS.includes);

    // 4. EN VRAAGT HEM AAN. Aanvragen, niet boeken: dat is wat het is.
    const aangevraagd = await P('/api/reisbureau/boek',
      { tripId: id, personen: 2, vertrek: '2026-10-09' }, lid);
    assert.equal(aangevraagd.status, 200, JSON.stringify(aangevraagd.body).slice(0, 200));
    const ref = aangevraagd.body.aanvraag ? aangevraagd.body.aanvraag.ref : aangevraagd.body.ref;
    assert.ok(ref, 'met een kenmerk: ' + JSON.stringify(aangevraagd.body).slice(0, 200));

    /* Het staat meteen in zijn dossier, maar als AANVRAAG. Het huis mag nooit
       zekerder lijken dan de werkelijkheid. */
    const naAanvraag = (await P('/api/state', {}, lid)).body.state;
    assert.ok(naAanvraag.trip, 'de reis staat in zijn dossier');
    assert.equal(naAanvraag.trip.dest, REIS.bestemming);
    assert.match(String(naAanvraag.trip.items ? naAanvraag.trip.items.map(i => i.label).join(' ') : ''),
      /aanvraag/i, 'en staat er als aanvraag bij: ' + JSON.stringify(naAanvraag.trip).slice(0, 220));

    /* 5. EN NIET WEG ONDER HET LID VANDAAN. Een reis met een open aanvraag
       verdwijnt niet uit het aanbod; die aanvraag moet eerst af. */
    const wegPoging = await P('/api/office/reisaanbod/weg', { id }, kantoor);
    assert.equal(wegPoging.status, 409, 'weghalen kaatst af zolang er een aanvraag open staat');
    assert.match(wegPoging.body.error, /aanvra/i, wegPoging.body.error);

    // 6. DE REISADVISEUR BEVESTIGT, en pas dan heet het bevestigd
    const bevestigd = await P('/api/office/reisbureau/bevestig', { ref, door: 'Reisbalie' }, kantoor);
    assert.equal(bevestigd.status, 200, JSON.stringify(bevestigd.body).slice(0, 200));
    const naBesluit = (await P('/api/state', {}, lid)).body.state;
    assert.ok(naBesluit.trip, 'de reis staat nog in het dossier');
    assert.doesNotMatch(String(naBesluit.trip.items ? naBesluit.trip.items.map(i => i.label).join(' ') : ''),
      /aanvraag/i, 'en niet meer als aanvraag: ' + JSON.stringify(naBesluit.trip).slice(0, 220));

    // 7. daarna kan de reis wel uit het aanbod
    assert.equal((await P('/api/office/reisaanbod/weg', { id }, kantoor)).status, 200,
      'zonder open aanvragen kan hij weg');
    assert.deepEqual((await P('/api/reisbureau', {}, lid)).body.reizen, [],
      'en dan is het aanbod weer leeg');
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

test('het aanbod is kantoorwerk, en de invoer wordt nagerekend', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ra2-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE, RTG_DEMO: '' } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Yfke');
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;

    // een lid stelt geen reizen samen, ook niet met een geldige pas
    assert.equal((await P('/api/office/reisaanbod/zet', REIS, lid)).status, 401,
      'een lid komt niet aan het aanbod');
    assert.equal((await P('/api/office/reisaanbod', {})).status, 401,
      'en zonder inlog al helemaal niet');

    // de invoer wordt nagerekend: een reis zonder titel, bestemming of prijs
    // is geen reis, en dat hoort een nette fout te zijn
    for (const [wat, invoer] of [
      ['zonder titel', { bestemming: 'Porto', netto: 500 }],
      ['zonder bestemming', { titel: 'Iets moois', netto: 500 }],
      ['zonder prijs', { titel: 'Iets moois', bestemming: 'Porto' }],
      ['met een lege prijs', { titel: 'Iets moois', bestemming: 'Porto', netto: '' }],
      ['met een onleesbare prijs', { titel: 'Iets moois', bestemming: 'Porto', netto: 'gratis' }],
      ['met een negatieve prijs', { titel: 'Iets moois', bestemming: 'Porto', netto: -20 }]
    ]) {
      const r = await P('/api/office/reisaanbod/zet', invoer, kantoor);
      assert.equal(r.status, 400, wat + ' hoort een nette fout te geven, kreeg ' + r.status);
      assert.ok(r.body.error && r.body.error.length > 10, wat + ': met uitleg erbij');
    }

    /* Bijwerken laat staan wat je niet meestuurt. Een kantoor dat alleen de
       prijs aanpast hoort niet de hele beschrijving opnieuw te typen -- en een
       leeg veld mag de tekst niet stilletjes wissen. */
    const eerst = (await P('/api/office/reisaanbod/zet', REIS, kantoor)).body.reis;
    const bij = await P('/api/office/reisaanbod/zet', { id: eerst.id, netto: 690 }, kantoor);
    assert.equal(bij.status, 200, JSON.stringify(bij.body).slice(0, 160));
    assert.equal(bij.body.nieuw, false, 'bijwerken maakt geen tweede reis');
    const na = (await P('/api/office/reisaanbod', {}, kantoor)).body.reizen[0];
    assert.equal(na.netto, 690, 'de nieuwe prijs staat er');
    assert.equal(na.titel, REIS.titel, 'en de titel is niet gewist');
    assert.deepEqual(na.includes, REIS.includes, 'net zomin als wat er inbegrepen is');
    assert.equal((await P('/api/reisbureau', {}, lid)).body.reizen.length, 1,
      'en er staat nog steeds één reis in de catalogus');

    /* EN EEN ONTBREKENDE PRIJS WORDT GEEN NUL. Number(null) is 0, dus een reis
       zonder prijs kwam er eerst als GRATIS in te staan -- zonder melding, en
       zichtbaar voor elk lid. Een uitdrukkelijke 0 mag wel: dat is een keuze. */
    assert.ok(!((await P('/api/office/reisaanbod', {}, kantoor)).body.reizen || [])
      .some(function(r){ return r.titel === 'Iets moois'; }), 'geen halve reis blijven staan');
    const gratis = await P('/api/office/reisaanbod/zet',
      { titel: 'Met de complimenten', bestemming: 'Porto', netto: 0 }, kantoor);
    assert.equal(gratis.status, 200, 'nul mag, als iemand het bewust invult');

    // een onbekende reis bijwerken of weghalen is een nette 404
    assert.equal((await P('/api/office/reisaanbod/zet', { id: 'bestaatniet', netto: 10 }, kantoor)).status, 404);
    assert.equal((await P('/api/office/reisaanbod/weg', { id: 'bestaatniet' }, kantoor)).status, 404);
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
