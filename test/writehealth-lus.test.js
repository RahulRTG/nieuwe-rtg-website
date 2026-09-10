/* ============================================================================
   DE SCHRIJFPOORT MAG ZIJN EIGEN GESLOTEN TOESTAND NIET ALS NIEUWE STORING
   LEZEN.

   Gemeten in de 100M-ronde van 9 september 2026: de poort sloot 89 keer, en
   45 van die sluitingen droegen als reden "collectietransactie: De gedeelde
   PostgreSQL-opslag is nog niet schrijfbaar". Dat is geen oorzaak maar een
   GEVOLG -- die fout ontstaat juist doordat de poort al dicht staat. 44 van
   de 45 vonden dan ook plaats terwijl de poort al gesloten was.

   Wat dat kost is niet dat de poort dubbel dichtgaat (dicht is dicht), maar
   dat de OORZAAK wordt overschreven. Wie na afloop vraagt waarom het huis
   geen schrijfacties meer aannam, leest het symptoom van zijn eigen sluiting
   in plaats van de mutatie buiten de requestcontext die hem sloot. Een
   storing die zijn eigen echo als diagnose toont, is niet te repareren.

   DEZE TOETS BEWAAKT DRIE DINGEN TEGELIJK, en de laatste twee zijn er zodat
   de reparatie de veiligheid niet stiekem versoepelt:

     1. een gevolg van de gesloten poort overschrijft de oorzaak niet;
     2. de poort blijft dicht -- fail-closed is het punt van deze laag;
     3. datzelfde gevolg dat als EERSTE binnenkomt (poort nog open) sluit hem
        wel degelijk. Anders zou de reparatie een echte storing wegfilteren.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../server/db/state');
const maakGrens = require('../server/db/postgres-verzoeken');

/* Een grens met een motor die niets doet maar wel antwoordt. De toets stuurt
   `ongezond` rechtstreeks aan: dit gaat over de toestandsmachine, niet over
   HTTP. `slot` voert direct uit, zodat er geen wachtrij tussen zit. */
function grensMaken() {
  state.setRuweData({ bewijs: [] });
  const motor = {
    pool: { query: async () => ({ rows: [{ ok: 1 }] }) },
    laadAlles: async () => ({ bewijs: [] }),
    commitVerzoek: async () => ({ geschreven: 0 }),
    openstaandeWijzigingen: () => []
  };
  return maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
}

/* Precies de fout die collectie-postgres.js gooit zodra de opslag niet
   schrijfbaar is. Hij draagt PG_ONGEZOND omdat hij UIT die toestand volgt. */
function gevolgFout() {
  return Object.assign(new Error('De gedeelde PostgreSQL-opslag is nog niet schrijfbaar.'),
    { code: 'PG_ONGEZOND' });
}

test('een gevolg van de gesloten poort overschrijft de oorzaak niet', () => {
  const grens = grensMaken();
  grens.gestart();
  assert.equal(grens.stand().writeHealthy, true, 'de poort hoorde open te staan na gestart()');

  // de ECHTE oorzaak: een mutatie buiten een requestcontext
  grens.ongezond(new Error('mutatie buiten requestcontext'), 'achtergrond');
  const oorzaak = grens.stand();
  assert.equal(oorzaak.writeHealthy, false);
  assert.match(oorzaak.reden, /achtergrond/, 'de oorspronkelijke oorzaak stond niet in de reden');

  // en nu de echo daarvan, precies zoals in de 100M-ronde
  grens.ongezond(gevolgFout(), 'collectietransactie');

  const na = grens.stand();
  assert.equal(na.writeHealthy, false, 'de poort moet dicht blijven -- fail-closed');
  assert.equal(na.reden, oorzaak.reden,
    'een gevolg van de gesloten poort overschreef de oorspronkelijke oorzaak');
});

test('de echo wordt geteld, zodat de lus zichtbaar is zonder externe waarnemer', () => {
  const grens = grensMaken();
  grens.gestart();
  grens.ongezond(new Error('mutatie buiten requestcontext'), 'achtergrond');
  assert.equal(grens.stand().gevolgen, 0, 'nog geen echo geteld');
  grens.ongezond(gevolgFout(), 'collectietransactie');
  grens.ongezond(gevolgFout(), 'collectietransactie');
  assert.equal(grens.stand().gevolgen, 2,
    'de onderdrukte gevolgen horen geteld te worden in plaats van te verdwijnen');
});

test('dezelfde fout sluit de poort WEL als hij als eerste binnenkomt', () => {
  const grens = grensMaken();
  grens.gestart();
  assert.equal(grens.stand().writeHealthy, true);

  // geen eerdere sluiting: dit IS hier de oorzaak, en dan telt hij gewoon
  grens.ongezond(gevolgFout(), 'collectietransactie');

  const na = grens.stand();
  assert.equal(na.writeHealthy, false,
    'een niet-schrijfbare opslag bij een OPEN poort moet hem sluiten -- anders is de reparatie een versoepeling');
  assert.match(na.reden, /collectietransactie/);
});

test('een andere, echte storing overschrijft wel -- alleen de eigen echo niet', () => {
  const grens = grensMaken();
  grens.gestart();
  grens.ongezond(new Error('mutatie buiten requestcontext'), 'achtergrond');
  grens.ongezond(new Error('connection terminated unexpectedly'), 'flush');
  assert.match(grens.stand().reden, /flush/,
    'een zelfstandige storing is geen echo en hoort de stand wel bij te werken');
});

test('na herstel telt de echo weer vanaf nul', async () => {
  const grens = grensMaken();
  grens.gestart();
  grens.ongezond(new Error('mutatie buiten requestcontext'), 'achtergrond');
  grens.ongezond(gevolgFout(), 'collectietransactie');
  assert.equal(grens.stand().gevolgen, 1);
  await grens.herstelNu();
  const na = grens.stand();
  assert.equal(na.writeHealthy, true, 'de poort ging niet open na een geslaagd herstel');
  assert.equal(na.gevolgen, 0, 'de teller van onderdrukte gevolgen liep door over een herstel heen');
});
