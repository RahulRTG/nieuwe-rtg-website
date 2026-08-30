/* ============================================================================
   DE SCHOOLWERELD -- vier objecten die aan elkaar hangen.

   Na de sleutelronde en de objectoogst stonden er 87 schoolroutes op 404, en
   de server zei zelf waarom: 36 keer "Dit gezin kennen we niet", 14 keer "Deze
   leerling staat niet in de administratie", 7 keer een klas, 7 keer een
   personeelslid. Vier dingen die niet los te maken zijn -- dat is wat een
   wereld onderscheidt van een sleutel.

   VIER DINGEN DIE DE ROUTES ZELF HEBBEN GECORRIGEERD, en ze staan hier omdat
   ze allemaal een aanname van mij waren:

   1. Een kind vraagt een GEBOORTEDATUM ("zodat de leeftijdspas automatisch
      klopt") en een eigen PINCODE. Allebei geweigerd tot ik ze meestuurde.
   2. Een klas maakt de LERAAR, niet de beheerder. De beheersleutel kreeg
      "Onbekende school of verkeerd personeel-token" -- en de handler zegt het
      met zoveel woorden: alleen een leraar maakt klassen.
   3. Een leraar ontstaat via een UITNODIGING die naar het schoolmailadres
      gaat. /school/personeel/aanmeld doet het in een keer en geeft buiten
      NODE_ENV=test een 410; die vlag aanzetten zou vijf stappen schelen en
      meteen een server meten die het product niet is.
   4. En de laatste kostte 36 routes: ik gaf `gezinscode` mee terwijl de poort
      `code` leest. De wereld stond al klaar en de routes bleven 404.

   DRIE SLEUTELS IN EEN LIJF, en dat kan omdat ze anders heten: de
   schoolpoorten lezen schoolCode met beheerToken of personeelToken, de
   gezinspoort leest code met token. Geen enkele schoolpoort kijkt naar `code`.
   Dat is geen toeval maar precies waarom een wereld hier werkt en een
   prefix-familie niet: dezelfde route-tak wordt door DRIE soorten mensen
   gebruikt, en het huis heeft ze uit elkaar gehouden met andere veldnamen.

   DE MUTATIE: geef `gezinscode` in plaats van `code` terug -> de derde toets
   zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { zetSchoolKlaar } = require('../scripts/lib/wereld-school');

test('zonder school- of gezinsleutel bouwt de wereld niets, met de reden erbij', async () => {
  const u = await zetSchoolKlaar({ post: async () => ({ status: 200, data: {} }), sleutels: {} });
  assert.equal(u.klaar, false);
  assert.match(u.reden, /ontbreekt/);
  assert.deepEqual(u.extra, {}, 'zonder sleutels hoort er niets meegestuurd te worden');
});

test('elke stap wordt gemeld, ook als hij niet lukt', async () => {
  const u = await zetSchoolKlaar({
    post: async () => ({ status: 400, data: { error: 'nee' } }),
    sleutels: { school: { schoolCode: 'S1', beheerToken: 'T1' }, gezin: { code: 'G1', token: 'T2' } },
    datamap: null
  });
  assert.equal(u.klaar, false);
  assert.ok(u.stappen.length >= 2, 'de stappen horen zichtbaar te zijn, niet stil te mislukken');
  for (const st of u.stappen) if (!st.ok) assert.ok(st.waarom, st.naam + ': een mislukte stap zonder reden');
});

test('de gezinsleutel gaat mee onder de naam die de POORT leest', async () => {
  const u = await zetSchoolKlaar({
    post: async () => ({ status: 200, data: { ok: true } }),
    sleutels: { school: { schoolCode: 'S1', beheerToken: 'T1' }, gezin: { code: 'G1', token: 'T2' } },
    datamap: null
  });
  assert.equal(u.extra.code, 'G1',
    'gezinVan() leest req.body.code; `gezinscode` meegeven liet 36 routes op 404 staan');
  assert.equal(u.extra.token, 'T2');
  assert.equal(u.extra.schoolCode, 'S1', 'en de schoolsleutel hoort er naast te blijven staan');
  assert.equal(u.extra.beheerToken, 'T1');
});

test('de wereld loopt niet om als een deur stukgaat', async () => {
  const u = await zetSchoolKlaar({
    post: async () => { throw new Error('stuk'); },
    sleutels: { school: { schoolCode: 'S1', beheerToken: 'T1' }, gezin: { code: 'G1', token: 'T2' } },
    datamap: null
  });
  assert.equal(u.klaar, false);
});

test('de snelle testdeuren worden NIET gebruikt', () => {
  const bron = String(zetSchoolKlaar);
  assert.ok(!/personeel\/aanmeld/.test(bron),
    '/school/personeel/aanmeld werkt alleen met NODE_ENV=test; die vlag maakt de server een andere server');
  assert.match(bron, /personeel\/uitnodig/, 'de echte weg loopt via een uitnodiging');
  assert.match(bron, /uitnodiging\/accepteer/);
});

/* ============================================================================
   EEN KIND IN EEN KLAS EN EEN LEERLING IN DE ADMINISTRATIE ZIJN TWEE DINGEN.

   Ik dacht eerst dat stap 8 dubbel was en gaf het gezinsprofiel-id door als
   leerlingId. Veertien routes bleven "Deze leerling staat niet in de
   administratie" geven -- terecht, want daar stond hij ook niet.

   Het zijn twee dingen in dit huis: een kind in een klas is een gezinsprofiel
   dat via een klascode is aangesloten; een leerling is een rij in de
   leerlingenlijst van de school, met een eigen id, een status (aanmelding,
   wachtlijst, ingeschreven) en een dossier dat jaren blijft staan. Ze zijn
   niet los te koppelen -- de aanmelding draagt gezinCode en profielId, zodat
   het dossier weet over wie het gaat -- en ze zijn ook niet hetzelfde.

   DE MUTATIE: zet extra.leerlingId weer op profielId -> deze toets zakt.
   ========================================================================== */
test('leerlingId is het administratie-id en niet het gezinsprofiel', async () => {
  let n = 0;
  const u = await zetSchoolKlaar({
    post: async (pad) => {
      n++;
      if (/leerling\/aanmeld/.test(pad)) return { status: 200, data: { ok: true, leerling: { id: 'ADM-1' } } };
      if (/profiel\/maak/.test(pad)) return { status: 200, data: { profiel: { id: 'PROF-9' } } };
      if (/klas\/maak/.test(pad)) return { status: 200, data: { klas: { code: 'K1' } } };
      if (/uitnodiging\/accepteer/.test(pad)) return { status: 200, data: { personeelToken: 'P1' } };
      return { status: 200, data: { ok: true } };
    },
    sleutels: { school: { schoolCode: 'S1', beheerToken: 'T1' }, gezin: { code: 'G1', token: 'T2' } },
    datamap: null
  });
  assert.equal(u.extra.profielId, 'PROF-9', 'het gezinsprofiel hoort mee te gaan');
  assert.notEqual(u.extra.leerlingId, 'PROF-9',
    'maar NIET als leerlingId -- daar staat hij niet in de administratie');
});
