/* DE TWEE NADEN TUSSEN HET WEEFSEL EN DE LAGEN ERBOVEN.

   `TAKEN.md` 5.15 noemde drie halve naden tussen het stadsweefsel en wat erop
   staat. Bij het nalopen bleek de CODE er voor alle drie te staan -- maar twee
   ervan waren nergens beproefd, en in dit huis is dat hetzelfde als: we weten
   het niet. De derde (een melding zonder GPS die een straatnaam noemt) staat
   wel vast, in `test/stadsweefsel.test.js`.

   Wat hier wordt vastgelegd:

     1  De gemeente sluit de ZAAK als zij haar eigen melding afhandelt. Anders
        blijft er werk op de veldlijst staan voor iets wat al gedaan is, en
        blijft een tweede melder zijn melding als open zien.
     2  Een Stadsdoos die AANHOUDEND zwijgt wordt een echte werkorder. De
        toestandsklus die zichzelf uit de vloot schrijft, verdwijnt zodra de
        doos terugkomt -- prima voor een haperende verbinding, waardeloos voor
        een kastje zonder stroom, want dan draagt er niets kosten of historie.

   Waarom op MODULE-niveau en niet door de server heen: allebei hangen ze aan
   de KLOK (een etmaal stilte) of aan een besluit van een ambtenaar. Door de
   server heen zou de eerste een uitgebreide gemeente-inlog vragen en de tweede
   helemaal niet te meten zijn zonder een dag te wachten. De twee modules zijn
   fabrieken op een gedeelde ctx, precies zoals kern-fiscaal.test.js dat
   gebruikt, dus de klok en de vloot zijn hier gewoon invoer.

   Draai los: node --experimental-sqlite --test test/weefselnaden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakVeldwerk = require('../server/kern/stad/veldwerk');
const maakMeldingen = require('../server/kern/gemeente/meldingen');

const UUR = 60 * 60 * 1000;

/* ---------------------------------------------------------------------------
   1. De gemeente sluit de zaak
   --------------------------------------------------------------------------- */

// het kleinste gemeente-domein dat meld() en meldingZet() nodig hebben
function gemeenteOpstelling(weefsel) {
  const db = { data: { gemeenteMeldingen: [] } };
  let n = 0;
  const ctx = {
    db, save: () => {}, anthropic: null, nu: () => Date.now(),
    id: () => 'id' + (++n), ref: (p) => p + '-' + (++n),
    schoon: (s, max) => String(s == null ? '' : s).slice(0, max),
    seed: () => {}, deGemeente: () => null,
    publiekeMelding: (m) => ({ ...m }),
    notify: null, notifySupplier: null, sseToSupplier: null,
    weefsel,
    CATS: { verlichting: 'Verlichting', overig: 'Overig' },
    PLOEG: { verlichting: 'Techniek', overig: 'Algemeen' },
    MELD_STATUS: ['nieuw', 'in behandeling', 'opgelost', 'afgewezen']
  };
  return { db, mod: maakMeldingen(ctx) };
}

test('1. de gemeente handelt haar melding af en de zaak in het weefsel gaat mee dicht', () => {
  const gesloten = [];
  const weefsel = {
    weefselMeld: () => ({ ok: true, zaak: { ref: 'Z-1', id: 'zaak-1' }, duplicaat: false }),
    weefselZaakKlaar: (id, wie, waarom) => { gesloten.push({ id, wie, waarom }); return { ok: true }; }
  };
  const { mod } = gemeenteOpstelling(weefsel);

  const m = mod.meld({ key: 'k1' }, 'Blauwe Reiger',
    { categorie: 'verlichting', tekst: 'lantaarn uit op de kade', lat: 52.1, lng: 4.3 });
  assert.equal(m.ok, true);
  assert.equal(m.melding.zaak, 'Z-1', 'de zaakverwijzing komt mee terug naar de melding');
  const ref = m.melding.ref;

  // onderweg gebeurt er nog niets met de zaak: alleen de eindstand telt
  mod.meldingZet('Nadia', ref, { status: 'in behandeling', update: 'ploeg onderweg' });
  assert.deepEqual(gesloten, [], 'in behandeling sluit niets');

  mod.meldingZet('Nadia', ref, { status: 'opgelost' });
  assert.equal(gesloten.length, 1, 'opgelost bij de gemeente sluit de zaak in de stad');
  assert.equal(gesloten[0].id, 'zaak-1');
  assert.equal(gesloten[0].wie, 'Nadia', 'op naam van de ambtenaar, niet op naam van "systeem"');
  assert.match(gesloten[0].waarom, /gemeente/, 'en met de reden erbij, zodat het spoor leesbaar blijft');
});

test('2. afgewezen sluit hem ook, en een melding zonder zaak sluit niets', () => {
  const gesloten = [];
  /* Afgewezen is net zo goed een EINDE: het probleem gaat niet alsnog door een
     ploeg opgelost worden, dus de zaak hoort niet als werk te blijven staan. */
  const metZaak = {
    weefselMeld: () => ({ ok: true, zaak: { ref: 'Z-2', id: 'zaak-2' }, duplicaat: false }),
    weefselZaakKlaar: (id) => { gesloten.push(id); return { ok: true }; }
  };
  const a = gemeenteOpstelling(metZaak);
  const afgewezen = a.mod.meld({ key: 'k9' }, 'Rode Vos',
    { categorie: 'verlichting', tekst: 'lamp brandt overdag', lat: 52.1, lng: 4.3 });
  a.mod.meldingZet('Nadia', afgewezen.melding.ref, { status: 'afgewezen' });
  assert.deepEqual(gesloten, ['zaak-2'], 'afwijzen sluit de zaak net zo goed');
  gesloten.length = 0;

  const weefsel = {
    weefselMeld: () => ({ error: 'Waar is het? Geef een gebied of een positie binnen de stad.' }),
    weefselZaakKlaar: (id) => { gesloten.push(id); return { ok: true }; }
  };
  const { mod } = gemeenteOpstelling(weefsel);

  /* Deze melding LANDT NIET in het weefsel -- geen positie en geen straatnaam.
     Dat staat als `zaakFout` op de melding (stil overslaan zou betekenen dat
     niemand weet waarom hij buiten de stadszaken valt), en afhandelen mag dan
     gewoon: het meldrecht van een inwoner hangt niet af van een zijtak. */
  const m = mod.meld({ key: 'k1' }, 'Grijze Wolf', { categorie: 'overig', tekst: 'rommel bij de brug' });
  assert.equal(m.ok, true, 'de melding gaat door, ook als het weefsel hem niet plaatst');
  assert.match(m.melding.zaakFout, /Waar is het/, 'en de reden staat op de melding');
  assert.equal(m.melding.zaak, undefined, 'er is geen zaak');

  mod.meldingZet('Nadia', m.melding.ref, { status: 'opgelost' });
  assert.deepEqual(gesloten, [], 'zonder zaak valt er niets te sluiten, en dat is geen fout');
});

test('3. een weefsel dat bij het sluiten ontploft trekt de afhandeling niet omver', () => {
  /* De gemeente mag haar eigen dossier altijd afhandelen. Viel dit om, dan zou
     een storing in een ZIJTAK een ambtenaar beletten zijn werk af te ronden --
     precies de afhankelijkheid die de kop van meldingen.js afwijst. */
  const weefsel = {
    weefselMeld: () => ({ ok: true, zaak: { ref: 'Z-9', id: 'zaak-9' }, duplicaat: false }),
    weefselZaakKlaar: () => { throw new Error('weefsel onbereikbaar'); }
  };
  const { mod, db } = gemeenteOpstelling(weefsel);
  const m = mod.meld({ key: 'k1' }, 'Stille Das', { categorie: 'verlichting', tekst: 'lamp stuk', lat: 52.1, lng: 4.3 });

  const r = mod.meldingZet('Nadia', m.melding.ref, { status: 'opgelost' });
  assert.equal(r.ok, true, 'de afhandeling gaat gewoon door');
  assert.equal(db.data.gemeenteMeldingen[0].status, 'opgelost', 'en de status staat er echt op');
});

/* ---------------------------------------------------------------------------
   2. Een doos die aanhoudend zwijgt wordt echt werk
   --------------------------------------------------------------------------- */

/* De vloot en de klok zijn hier invoer. `laatsteContact` is een tijdstip, dus
   "al een etmaal stil" is gewoon een getal -- geen wachttijd in de toets. */
function veldOpstelling({ dozen, werkorders }) {
  const gemaakt = [];
  const lijst = (werkorders || []).slice();
  const opslag = {}; // een STABIELE opslag: klaarStore() schrijft erin terug
  const ctx = {
    d: () => opslag, save: () => {}, seintje: () => {},
    schoon: (s, max) => String(s == null ? '' : s).slice(0, max),
    nu: () => Date.now(),
    nodes: () => dozen,
    ONLINE_MS: 15 * 60 * 1000,
    alerts: () => [],
    weefsel: {
      weefselWerklijst: () => ({ werkorders: lijst }),
      weefselWerkorderMaak: (w) => { gemaakt.push(w); lijst.push({ ...w, id: 'wo' + lijst.length, plaats: null }); return { ok: true }; },
      weefselWerkorderKlaar: () => ({ ok: true, zaakGesloten: null })
    }
  };
  return { mod: maakVeldwerk(ctx), gemaakt };
}
const doos = (serial, urenStil, extra) => ({
  serial, naam: 'Stadsdoos ' + serial, zone: 'Marina', actief: true,
  objectId: 'obj-' + serial, laatsteContact: Date.now() - urenStil * UUR, ...(extra || {})
});

test('4. een doos die een etmaal zwijgt krijgt een echte werkorder; eentje die even hapert niet', () => {
  const { mod, gemaakt } = veldOpstelling({
    dozen: { a: doos('SD-A', 30), b: doos('SD-B', 1), c: doos('SD-C', 0) }
  });
  const w = mod.api.stadWerk();
  assert.equal(w.status, 200);

  assert.equal(gemaakt.length, 1, 'precies EEN doos is lang genoeg stil');
  assert.equal(gemaakt[0].objectId, 'obj-SD-A');
  assert.equal(gemaakt[0].soort, 'storing');
  assert.equal(gemaakt[0].ploeg, 'techniek', 'en hij komt bij de ploeg die er iets mee kan');
  assert.match(gemaakt[0].omschrijving, /SD-A/, 'met de doos erin, zodat de veldploeg weet waar hij heen moet');

  /* De haperende doos staat er WEL als toestandsklus (hij is offline), maar
     zonder werkorder -- die verdwijnt vanzelf als hij terugkomt. Dat verschil
     is met opzet zichtbaar in de sleutel. */
  const sleutels = w.klussen.map(k => k.sleutel);
  assert.ok(sleutels.includes('doos:SD-B'), 'de haperende doos staat als toestandsklus op de lijst');
  assert.ok(!sleutels.includes('doos:SD-C'), 'een doos die net nog contact had staat er niet op');
  assert.ok(w.klussen.some(k => k.werkorder), 'en de stille doos staat er als werkorder bij');
});

test('5. er komt er maar EEN per doos, hoe vaak de lijst ook wordt opgehaald', () => {
  /* Dit is de scherpste van de twee. De werklijst wordt bij elke tik van de
     veld-app opgehaald; zou hij elke keer een werkorder bijschrijven, dan
     staat er na een nacht een stapel van honderden voor hetzelfde kastje --
     met kosten en uren die allemaal echt lijken. */
  const { mod, gemaakt } = veldOpstelling({ dozen: { a: doos('SD-A', 30) } });
  for (let i = 0; i < 5; i++) mod.api.stadWerk();
  assert.equal(gemaakt.length, 1, 'vijf keer kijken maakt niet vijf werkorders');
});

test('6. een doos die al een openstaande werkorder heeft krijgt er geen tweede', () => {
  // en dat geldt ook voor werk dat er buiten deze laag om al lag: gepland
  // onderhoud op hetzelfde object is ook een reden om niets bij te schrijven
  const { mod, gemaakt } = veldOpstelling({
    dozen: { a: doos('SD-A', 30) },
    werkorders: [{ id: 'wo-bestaand', objectId: 'obj-SD-A', soort: 'onderhoud', prioriteit: 'normaal',
      omschrijving: 'jaarlijkse controle', plaats: 'Marina' }]
  });
  mod.api.stadWerk();
  assert.equal(gemaakt.length, 0, 'er lag al werk op dit object');
});

test('7. een doos zonder objectId of uit dienst blijft buiten het weefsel', () => {
  /* Een doos die niet als OBJECT in het weefsel staat, kan er ook geen
     werkorder aan hangen -- die zou nergens aan vastzitten en dus geen
     historie of kosten kunnen dragen. En een doos uit dienst is geen storing
     maar een besluit. */
  const { mod, gemaakt } = veldOpstelling({
    dozen: {
      a: { ...doos('SD-A', 30), objectId: null },
      b: { ...doos('SD-B', 30), actief: false }
    }
  });
  const w = mod.api.stadWerk();
  assert.equal(gemaakt.length, 0, 'geen van beide levert een werkorder op');
  assert.ok(w.klussen.some(k => k.sleutel === 'doos:SD-A'), 'de doos zonder object staat er wel gewoon als klus');
  assert.ok(!w.klussen.some(k => k.sleutel === 'doos:SD-B'), 'een doos uit dienst staat er helemaal niet');
});
