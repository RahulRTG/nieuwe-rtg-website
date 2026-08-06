/* ============================================================================
   FASE DRIE: DE GOVERNANCE-LAAG VAN DE STICHTING

   Dit is de laag waarop een stichting wordt afgerekend als het misgaat. Niet
   op wat ze deed, maar op of ze het BEVOEGD deed, of ze het kon LATEN ZIEN, en
   of ze had gekeken naar wat er mis kon gaan. Zes onderwerpen, elk met een
   grendel die de praktijkfout tegenhoudt:

     1. QUORUM. Onder de helft is er vergaderd en niet besloten -- en het
        antwoord noemt het getal, want "geweigerd" leert de secretaris niets.
     2. BELANGENVERSTRENGELING. Wie een belang heeft bij het punt, kan niet als
        stemmer worden geteld. Ook niet tegen: het gaat om deelname aan de
        stemming, niet om de richting.
     3. VASTGESTELDE NOTULEN. Een vergadering stelt zichzelf niet vast, en na
        vaststelling weigert alles wat wijzigt.
     4. BELEID. Een nieuwe versie WIST ALLE BEVESTIGINGEN. Dat voelt als werk
        weggooien en is het punt: een handtekening onder v1 dekt v2 niet.
     5. JAARVERSLAG. Publiceren kan niet zonder vaststelling, vaststellen niet
        zonder aangenomen besluit uit vastgestelde notulen -- en de cijfers zijn
        BEVROREN: wat er daarna in het systeem verandert, verandert het stuk niet.
     6. RISICO, HERKOMST, MELDCODE. "Beheerst" vraagt dekking; een grote gift
        staat stil tot er gekeken is; wegen en beslissen kan niet zonder overleg.

   MUTATIES (LAT.md regel 2): zie het einde van dit bestand en het commitbericht.

   Draai los: node --experimental-sqlite --test test/rtfos-governance.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfosgov-'));
const OFFICE_CODE = 'RTFOSGOV-KEURING';

let srv, BASE, LAND, TWEE, STAD, PROJECT, KEY_LAND, KEY_TWEE;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const os_ = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || LAND);

const overMorgen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');
  KEY_LAND = (await os_('ik')).body.key;

  STAD = (await os_('stad/maak', { naam: 'Haarlem' })).body.stad.id;
  await os_('stad/status', { id: STAD, status: 'actief' });
  for (const vlag of ['youth_programs', 'individual_cases', 'donations']) {
    await os_('stad/module', { id: STAD, vlag, aan: true });
  }
  const reg = await post('/api/auth/register', { name: 'Bestuur Haarlem', email: 'bh@rtfosgov.test',
    phone: '0612345699', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.body.token);
  TWEE = (await post('/api/account/start', { rol: 'kantoor' }, reg.body.token)).body.token;
  KEY_TWEE = (await os_('ik', {}, TWEE)).body.key;
  await os_('zetel', { stad: STAD, key: KEY_TWEE, naam: 'Bestuur Haarlem', rol: 'stadsbestuur' });

  const p = await os_('project/maak', { stad: STAD, naam: 'Taalcafe Schalkwijk', soort: 'taal',
    budget: 800, doelgroep: 'volwassenen' }, TWEE);
  PROJECT = p.body.project.id;
  await os_('project/status', { id: PROJECT, status: 'aanvraag' }, TWEE);
  await os_('project/status', { id: PROJECT, status: 'beoordeling' }, TWEE);
  await os_('project/status', { id: PROJECT, status: 'goedgekeurd' });
  await os_('project/status', { id: PROJECT, status: 'actief' });
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ------------------------------------------------------------------------- */
test('zonder quorum is er vergaderd en niet besloten, en het antwoord noemt het getal', async () => {
  const v = await os_('vergadering/maak', { soort: 'landelijk', datum: '2026-03-02', plaats: 'Haarlem', omvang: 5,
    agenda: ['jaarplan', 'begroting'] });
  assert.equal(v.status, 200);
  assert.equal(v.body.vergadering.quorum, 3, 'vijf bestuurders geeft een quorum van drie');
  assert.equal(v.body.vergadering.heeftQuorum, false, 'zonder presentielijst is er geen quorum');

  const zonder = await os_('vergadering/besluit', { id: v.body.vergadering.id, onderwerp: 'jaarplan', voor: [], tegen: [] });
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /0 van de 5/, 'het antwoord noemt niet hoeveel er waren');
  assert.match(zonder.body.error, /er zijn er 3 nodig/, 'het antwoord noemt niet hoeveel er nodig waren');

  // twee van de vijf is nog steeds te weinig
  await os_('vergadering/presentie', { id: v.body.vergadering.id, aanwezig: ['rahul', 'nadia'] });
  const tweeVanVijf = await os_('vergadering/besluit', { id: v.body.vergadering.id, onderwerp: 'jaarplan', voor: ['rahul', 'nadia'] });
  assert.equal(tweeVanVijf.status, 400);

  // drie wel
  await os_('vergadering/presentie', { id: v.body.vergadering.id, aanwezig: ['rahul', 'nadia', 'joost'], afwezig: ['tim', 'els'] });
  const wel = await os_('vergadering/besluit', { id: v.body.vergadering.id, onderwerp: 'jaarplan 2026',
    tekst: 'het jaarplan wordt vastgesteld', voor: ['rahul', 'nadia'], tegen: ['joost'] });
  assert.equal(wel.status, 200);
  assert.equal(wel.body.besluit.aangenomen, true, '2 voor tegen 1 tegen is aangenomen');

  /* Iemand die er niet was, kan niet hebben gestemd. Dat is geen formaliteit:
     zo ontstaan de stemmen die achteraf worden bijgeschreven. */
  const spook = await os_('vergadering/besluit', { id: v.body.vergadering.id, onderwerp: 'begroting',
    tekst: 'de begroting', voor: ['rahul', 'tim'] });
  assert.equal(spook.status, 400);
  assert.match(spook.body.error, /stond niet op de presentielijst/);
});

/* ------------------------------------------------------------------------- */
test('wie een belang heeft bij het punt, kan niet meestemmen -- ook niet tegen', async () => {
  const v = (await os_('vergadering/maak', { soort: 'landelijk', datum: '2026-04-06', omvang: 5 })).body.vergadering;
  await os_('vergadering/presentie', { id: v.id, aanwezig: ['rahul', 'nadia', 'joost'] });

  const voor = await os_('vergadering/besluit', { id: v.id, onderwerp: 'opdracht aan bureau Joost',
    tekst: 'de opdracht gaat naar het bureau van Joost', voor: ['rahul', 'nadia', 'joost'], belanghebbend: ['joost'] });
  assert.equal(voor.status, 400);
  assert.match(voor.body.error, /joost/i);
  assert.match(voor.body.error, /belanghebbend/);

  // ook tegenstemmen mag niet: het gaat om deelname, niet om de richting
  const tegen = await os_('vergadering/besluit', { id: v.id, onderwerp: 'opdracht aan bureau Joost',
    tekst: 'de opdracht', voor: ['rahul', 'nadia'], tegen: ['joost'], belanghebbend: ['joost'] });
  assert.equal(tegen.status, 400, 'een belanghebbende mocht tegenstemmen');

  // op onthouding wel
  const goed = await os_('vergadering/besluit', { id: v.id, onderwerp: 'opdracht aan bureau Joost',
    tekst: 'de opdracht', voor: ['rahul', 'nadia'], onthouding: ['joost'], belanghebbend: ['joost'] });
  assert.equal(goed.status, 200);
  assert.deepEqual(goed.body.besluit.belanghebbend, ['joost']);
});

/* ------------------------------------------------------------------------- */
test('een vergadering stelt zichzelf niet vast, en daarna ligt alles vast', async () => {
  const een = (await os_('vergadering/maak', { soort: 'landelijk', datum: '2026-05-04', omvang: 3 })).body.vergadering;
  await os_('vergadering/presentie', { id: een.id, aanwezig: ['rahul', 'nadia'] });
  await os_('vergadering/besluit', { id: een.id, onderwerp: 'huurcontract', tekst: 'akkoord', voor: ['rahul', 'nadia'] });

  const zelf = await os_('vergadering/vaststellen', { id: een.id, doorId: een.id });
  assert.equal(zelf.status, 400);
  assert.match(zelf.body.error, /eigen notulen niet vaststellen/);

  // een LATERE vergadering, maar zonder quorum stelt die ook niets vast
  const twee = (await os_('vergadering/maak', { soort: 'landelijk', datum: '2026-06-01', omvang: 3 })).body.vergadering;
  const zonderQ = await os_('vergadering/vaststellen', { id: een.id, doorId: twee.id });
  assert.equal(zonderQ.status, 400);
  assert.match(zonderQ.body.error, /geen quorum/);

  await os_('vergadering/presentie', { id: twee.id, aanwezig: ['rahul', 'nadia'] });
  const wel = await os_('vergadering/vaststellen', { id: een.id, doorId: twee.id });
  assert.equal(wel.status, 200);

  // en nu weigert alles wat de vastgestelde vergadering wijzigt
  const nogEenBesluit = await os_('vergadering/besluit', { id: een.id, onderwerp: 'nog iets', voor: ['rahul'] });
  assert.equal(nogEenBesluit.status, 400);
  assert.match(nogEenBesluit.body.error, /vastgesteld/);
  const agenda = await os_('vergadering/agenda', { id: een.id, punt: 'achteraf toegevoegd' });
  assert.equal(agenda.status, 400, 'een agendapunt kon achteraf nog in vastgestelde notulen');
  const presentie = await os_('vergadering/presentie', { id: een.id, aanwezig: ['rahul', 'nadia', 'joost'] });
  assert.equal(presentie.status, 400, 'de presentielijst kon achteraf nog worden bijgewerkt');
});

/* ------------------------------------------------------------------------- */
test('een nieuwe versie van een beleidsregel wist alle bevestigingen', async () => {
  const r = await os_('beleid/maak', { titel: 'Beeldmateriaal van kinderen', soort: 'privacy',
    tekst: 'Geen herkenbare foto van een minderjarige zonder schriftelijke toestemming van beide ouders.' });
  assert.equal(r.status, 200);
  const id = r.body.regel.id;

  const bevestig = await os_('beleid/bevestig', { id, stad: STAD }, TWEE);
  assert.equal(bevestig.status, 200);
  assert.equal(bevestig.body.regel.bevestigd.length, 1);
  assert.equal(bevestig.body.regel.open.length, 0, 'de stad staat nog open na bevestiging');

  // een stad kan een landelijke regel niet herschrijven
  const stadHerziet = await os_('beleid/herzien', { id, tekst: 'Foto maken mag gewoon, dat scheelt papierwerk.' }, TWEE);
  assert.equal(stadHerziet.status, 403);

  // dezelfde tekst is geen nieuwe versie -- dat zou alleen de bevestigingen wissen
  const zelfde = await os_('beleid/herzien', { id,
    tekst: 'Geen herkenbare foto van een minderjarige zonder schriftelijke toestemming van beide ouders.' });
  assert.equal(zelfde.status, 400);

  const v2 = await os_('beleid/herzien', { id,
    tekst: 'Geen herkenbare foto van een minderjarige zonder schriftelijke toestemming van beide ouders, ' +
      'en de toestemming vervalt na twee jaar.' });
  assert.equal(v2.status, 200);
  assert.equal(v2.body.regel.versie, 2);
  assert.equal(v2.body.regel.bevestigd.length, 0, 'de bevestiging van versie 1 stond nog onder versie 2');
  assert.equal(v2.body.regel.open.length, 1, 'de stad staat na de herziening niet opnieuw open');
  assert.match(v2.body.melding, /1 eerdere bevestiging/);
});

/* ------------------------------------------------------------------------- */
test('het jaarverslag heeft een besluit nodig, en de cijfers bevriezen', async () => {
  // een bron zodat er iets te rapporteren valt
  await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Buurtfonds Haarlem', bedrag: 500 });

  const j = await os_('jaarverslag/opstellen', { jaar: 2026, titel: 'Jaarverslag 2026',
    verhaal: 'Een jaar waarin het taalcafe op gang kwam.' });
  assert.equal(j.status, 200);
  const id = j.body.jaarverslag.id;
  const batenBevroren = j.body.jaarverslag.cijfers.totaal.batenEuro;
  assert.equal(batenBevroren, 500, 'de bevroren baten kloppen niet met wat er binnenkwam');

  // publiceren zonder vaststelling: nee
  const teVroeg = await os_('jaarverslag/publiceren', { id });
  assert.equal(teVroeg.status, 400);
  assert.match(teVroeg.body.error, /niet door het bestuur vastgesteld/);

  // vaststellen met een besluit uit NIET-vastgestelde notulen: ook nee
  const verg = (await os_('vergadering/maak', { soort: 'landelijk', datum: '2027-03-01', omvang: 3 })).body.vergadering;
  await os_('vergadering/presentie', { id: verg.id, aanwezig: ['rahul', 'nadia'] });
  const besluit = (await os_('vergadering/besluit', { id: verg.id, onderwerp: 'vaststelling jaarverslag 2026',
    tekst: 'het bestuur stelt het jaarverslag vast', voor: ['rahul', 'nadia'] })).body.besluit;
  const concept = await os_('jaarverslag/vaststellen', { id, besluitId: besluit.id });
  assert.equal(concept.status, 400);
  assert.match(concept.body.error, /nog niet zijn vastgesteld/);

  // notulen vaststellen in een volgende vergadering, dan kan het wel
  const verg2 = (await os_('vergadering/maak', { soort: 'landelijk', datum: '2027-04-05', omvang: 3 })).body.vergadering;
  await os_('vergadering/presentie', { id: verg2.id, aanwezig: ['rahul', 'nadia'] });
  await os_('vergadering/vaststellen', { id: verg.id, doorId: verg2.id });

  const vast = await os_('jaarverslag/vaststellen', { id, besluitId: besluit.id });
  assert.equal(vast.status, 200);

  /* EN NU HET PUNT: er komt geld binnen NA de vaststelling. Het jaarverslag mag
     niet meebewegen -- een verantwoording die met de database meeschuift is
     geen verantwoording. */
  await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Late gever', bedrag: 9000 });
  const naLezen = await os_('jaarverslagen');
  const nu = naLezen.body.jaarverslagen.find(x => x.id === id);
  assert.equal(nu.cijfers.totaal.batenEuro, batenBevroren,
    'het jaarverslag bewoog mee met een donatie die na de vaststelling binnenkwam');

  const pub = await os_('jaarverslag/publiceren', { id });
  assert.equal(pub.status, 200);

  // de ANBI-publicatie is openbaar, zonder inlog
  const open = await post('/api/rtfos/publiek/jaarverslagen', {});
  assert.equal(open.status, 200);
  assert.equal(open.body.jaarverslagen.length, 1);
  assert.equal(open.body.jaarverslagen[0].cijfers.totaal.batenEuro, batenBevroren);

  // een tweede verslag over hetzelfde jaar kan alleen met een reden
  const stil = await os_('jaarverslag/opstellen', { jaar: 2026 });
  assert.equal(stil.status, 400);
  assert.match(stil.body.error, /met een reden/);
});

/* ------------------------------------------------------------------------- */
test('een zwaar risico gaat niet op beheerst zonder maatregel, eigenaar en datum', async () => {
  const r = await os_('risico/meld', { stad: STAD, titel: 'Afhankelijk van een subsidie', categorie: 'financieel',
    kans: 4, impact: 5, omschrijving: 'Zeventig procent van de begroting komt uit een gemeentesubsidie.' }, TWEE);
  assert.equal(r.status, 200);
  assert.equal(r.body.risico.score, 20);
  assert.equal(r.body.risico.zwaar, true);
  const id = r.body.risico.id;

  const kaal = await os_('risico/zet', { id, status: 'beheerst' }, TWEE);
  assert.equal(kaal.status, 400);
  for (const woord of ['beheersmaatregel', 'eigenaar', 'herbeoordelingsdatum']) {
    assert.ok(kaal.body.error.includes(woord), 'het antwoord zegt niet dat ' + woord + ' ontbreekt');
  }

  // een datum in het verleden telt niet
  const oud = await os_('risico/zet', { id, status: 'beheerst', maatregel: 'Tweede geldstroom opbouwen via ondernemers.',
    eigenaar: 'penningmeester', herbeoordelenOp: '2020-01-01' }, TWEE);
  assert.equal(oud.status, 400);
  assert.match(oud.body.error, /in de toekomst/);

  const goed = await os_('risico/zet', { id, status: 'beheerst', maatregel: 'Tweede geldstroom opbouwen via ondernemers.',
    eigenaar: 'penningmeester', herbeoordelenOp: overMorgen(120) }, TWEE);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.risico.status, 'beheerst');

  // een licht risico mag wel gewoon beheerst worden zonder die drie
  const licht = await os_('risico/meld', { stad: STAD, titel: 'Printer valt uit', categorie: 'continuiteit',
    kans: 2, impact: 1 }, TWEE);
  const lichtGoed = await os_('risico/zet', { id: licht.body.risico.id, status: 'beheerst' }, TWEE);
  assert.equal(lichtGoed.status, 200, 'de grendel sloeg ook toe bij een licht risico');
});

/* ------------------------------------------------------------------------- */
test('een grote gift staat stil tot het landelijke bestuur de herkomst heeft beoordeeld', async () => {
  const groot = await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Onbekende weldoener',
    bedrag: 25000, projectId: PROJECT }, TWEE);
  assert.equal(groot.status, 200);
  assert.match(groot.body.melding || '', /staat stil/, 'een gift van 25.000 werd niet gemarkeerd');
  const bronId = groot.body.bron.id;

  const uit = await os_('uitgave/aanvraag', { projectId: PROJECT, bronId, bedrag: 100,
    omschrijving: 'lesmateriaal' }, TWEE);
  assert.equal(uit.status, 403, 'er kon uit een ongecontroleerde grote gift worden uitgegeven');
  assert.match(uit.body.error, /herkomstcontrole/);

  // een stad beoordeelt haar eigen grote gift niet
  const zelf = await os_('herkomst/beoordeel', { bronId, uitkomst: 'akkoord',
    herkomstGeld: 'verkoop van een woning' }, TWEE);
  assert.equal(zelf.status, 403);

  // en het landelijke bestuur moet echt antwoord geven op de vraag
  const leeg = await os_('herkomst/beoordeel', { bronId, uitkomst: 'akkoord' });
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /Waar komt dit geld vandaan/);

  // een gift met tegenprestatie is geen donatie
  const tegen = await os_('herkomst/beoordeel', { bronId, uitkomst: 'akkoord',
    herkomstGeld: 'verkoop van een bedrijfspand in 2025', tegenprestatie: true });
  assert.equal(tegen.status, 400);
  assert.match(tegen.body.error, /sponsoring/);

  const af = await os_('herkomst/beoordeel', { bronId, uitkomst: 'akkoord',
    herkomstGeld: 'verkoop van een bedrijfspand in 2025, notarisafschrift in het dossier' });
  assert.equal(af.status, 200);

  const naControle = await os_('uitgave/aanvraag', { projectId: PROJECT, bronId, bedrag: 100,
    omschrijving: 'lesmateriaal' }, TWEE);
  assert.equal(naControle.status, 200, 'na de controle kwam het geld nog steeds niet los');

  /* EEN SUBSIDIE VALT ER BUITEN, en dat is een besluit en geen omissie. Zijn
     herkomst staat per definitie vast (verstrekker, beschikking, voorwaarden --
     subsidies.js), en een controle die bij elke gemeentesubsidie afgaat wordt
     weggeklikt zonder lezen. Dan is de grendel er nog wel en het toezicht niet. */
  const subsidie = await os_('bron/maak', { stad: STAD, soort: 'subsidie', gever: 'Gemeente Haarlem',
    bedrag: 50000 }, TWEE);
  assert.equal(subsidie.status, 200);
  assert.equal(subsidie.body.melding, undefined, 'een subsidie werd als verdachte gift gemarkeerd');
  const subUit = await os_('uitgave/aanvraag', { projectId: PROJECT, bronId: subsidie.body.bron.id,
    bedrag: 200, omschrijving: 'zaalhuur' }, TWEE);
  assert.equal(subUit.status, 200, 'een gemeentesubsidie van 50.000 bleef staan voor een witwascontrole');

  // een kleine gift wordt niet gemarkeerd: de drempel moet ook de andere kant op werken
  const klein = await os_('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Buurvrouw', bedrag: 40 }, TWEE);
  const kleinUit = await os_('uitgave/aanvraag', { projectId: PROJECT, bronId: klein.body.bron.id, bedrag: 10,
    omschrijving: 'koffie' }, TWEE);
  assert.equal(kleinUit.status, 200, 'een gift van 40 euro werd ook geblokkeerd');
});

/* ------------------------------------------------------------------------- */
test('wegen en beslissen kan niet zonder overleg, en het gesprek overslaan niet zonder reden', async () => {
  const d = await os_('meldcode/open', { stad: STAD, betreft: 'kind uit de huiswerkklas, groep 7' }, TWEE);
  assert.equal(d.status, 200);
  const id = d.body.dossier.id;
  assert.equal(d.body.dossier.volgende, 'signaleren');

  await os_('meldcode/stap', { id, stap: 'signaleren',
    tekst: 'kwam drie weken achter elkaar zonder jas en zonder eten' }, TWEE);

  const teVroeg = await os_('meldcode/stap', { id, stap: 'wegen', tekst: 'lijkt me niet ernstig' }, TWEE);
  assert.equal(teVroeg.status, 400);
  assert.match(teVroeg.body.error, /overleggen/);
  assert.match(teVroeg.body.error, /niet alleen/);

  // overleggen zonder tegenpartij is geen overleg
  const alleen = await os_('meldcode/stap', { id, stap: 'overleggen', tekst: 'erover nagedacht' }, TWEE);
  assert.equal(alleen.status, 400);
  assert.match(alleen.body.error, /Met wie/);

  await os_('meldcode/stap', { id, stap: 'overleggen', metWie: 'aandachtsfunctionaris Nadia',
    tekst: 'overlegd, en anoniem besproken met Veilig Thuis' }, TWEE);

  // het gesprek overslaan mag, maar niet stil
  const stil = await os_('meldcode/stap', { id, stap: 'gesprek', overgeslagen: true, tekst: 'nvt' }, TWEE);
  assert.equal(stil.status, 400);
  assert.match(stil.body.error, /niet stilzwijgend/);
  const metReden = await os_('meldcode/stap', { id, stap: 'gesprek', overgeslagen: true,
    tekst: 'gesprek met de ouders zou de veiligheid van het kind op dit moment verslechteren' }, TWEE);
  assert.equal(metReden.status, 200);

  await os_('meldcode/stap', { id, stap: 'wegen', tekst: 'ernstig genoeg om te melden, geen acute onveiligheid' }, TWEE);

  // sluiten kan niet voor stap 5
  const voorbarig = await os_('meldcode/sluit', { id, uitkomst: 'geen_actie',
    afweging: 'we houden het in de gaten en kijken over een maand opnieuw' }, TWEE);
  assert.equal(voorbarig.status, 400);
  assert.match(voorbarig.body.error, /beslissen/);

  await os_('meldcode/stap', { id, stap: 'beslissen', tekst: 'hulp georganiseerd via de partner en gemeld' }, TWEE);

  // en een besluit zonder afweging in woorden is geen afweging
  const kaal = await os_('meldcode/sluit', { id, uitkomst: 'beide', afweging: 'ok' }, TWEE);
  assert.equal(kaal.status, 400);
  assert.match(kaal.body.error, /Schrijf de afweging op/);

  const dicht = await os_('meldcode/sluit', { id, uitkomst: 'beide',
    afweging: 'Er is hulp geregeld via de voedselbank en de school, en gemeld bij Veilig Thuis omdat het patroon aanhield.' }, TWEE);
  assert.equal(dicht.status, 200);

  /* NIEMAND KAN EEN DOSSIER WEGHALEN. Dat wordt hier niet getoetst met een
     mislukte poging maar met de bron: er bestaat geen route die het doet. Een
     toets die een niet-bestaande route aanroept en een 404 krijgt, meet dat de
     route niet bestaat -- en zou ook groen blijven bij een typefout in het pad. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', 'meldcode.js'), 'utf8');
  assert.equal(/\.splice\(|delete |filter\(m => m\.id !==/.test(bron), false,
    'er staat een verwijderende bewerking in meldcode.js');
});
