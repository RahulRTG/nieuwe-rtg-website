/* De handhaver onder het Consent Center.

   Dat scherm zei van zichzelf: "dit register wordt met de hand bijgehouden;
   komt er ergens een nieuwe soort toestemming bij, dan verschijnt hij hier niet
   vanzelf". Dat was eerlijk, maar het is ook precies de vorm waar LAT.md regel
   6 voor waarschuwt: een belofte in tekst zonder iets dat hem vasthoudt. Dit
   bestand is dat iets.

   WAT HIJ DOET. Toestemming heeft in dit huis een herkenbare vorm: een rij met
   een `key` (van wie) en een `status: 'actief'` die later op gestopt of
   ingetrokken gaat. Deze toets zoekt die vorm in server/kern/ en eist dat ELKE
   module die hem heeft, hieronder staat -- met de consent-laag waar hij bij
   hoort, of met een reden waarom hij geen toestemming is. Een nieuwe laag die
   iemand erbij bouwt, zakt hier dus met naam en toenaam.

   WAT HIJ NIET DOET, en dat hoort er net zo hard bij. Hij kent maar EEN vorm.
   RTG iD gebruikt `ingetrokken: true` in plaats van een status, en die wordt
   hier niet gevonden -- die staat in het register omdat een mens hem erin heeft
   gezet. Een derde vorm die iemand morgen verzint, vindt hij ook niet. Dit is
   dus een net dat een gat kleiner maakt, geen deksel erop.
   Draai los: node --test test/consent-dekking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { LAGEN } = require('../server/kern/consent');

const KERN = path.join(__dirname, '..', 'server', 'kern');

/* Elke module met de toestemmingsvorm, en wat hij is. Wie hier een regel bij
   moet zetten, heeft net een nieuwe toestemming gebouwd -- en hoort dan ook te
   bedenken of hij op het toestemmingsscherm hoort. */
const DEKKING = {
  'care/leden.js': { laag: 'care-intake' },
  'care/vastleggen.js': { laag: 'care-vastlegging' },
  'care/wachtlijst.js': { laag: 'wachtlijst' },
  'toestellen.js': { laag: 'toestel' },
  'gastzorg.js': { laag: 'locatie' },
  'salon-claimcode.js': { reden: 'een tijdelijke aanbiedingsclaim; status bewaakt een bearer en is geen toestemming voor gegevensgebruik' },
  'rtgone-projecten.js': { reden: 'status actief beschrijft de levensloop van een projectintentie; er wordt geen toestemming voor gegevensgebruik vastgelegd' },
  'assets/winkel.js': { reden: 'een ticket op een object; geen toestemming maar bezit' }
};

function jsBestanden(map, prefix = '') {
  const uit = [];
  for (const naam of fs.readdirSync(map)) {
    const vol = path.join(map, naam);
    if (fs.statSync(vol).isDirectory()) uit.push(...jsBestanden(vol, prefix + naam + '/'));
    else if (naam.endsWith('.js')) uit.push([prefix + naam, vol]);
  }
  return uit;
}

/* De vorm: een aanmaak-literal met status 'actief' erin, en een `key` in
   dezelfde buurt (vier regels boven of onder). Bewust ruw: liever een module
   te veel aanwijzen -- die krijgt dan een regel met een reden -- dan een te
   weinig. */
function heeftToestemmingsvorm(bron) {
  /* Commentaar telt niet mee. Zonder deze regel wees de scan kern/consent.js
     zelf aan, omdat die in zijn kop UITLEGT welke vorm hier gezocht wordt --
     een meter die aanslaat op zijn eigen beschrijving. */
  const zonderUitleg = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const regels = zonderUitleg.split('\n');
  for (let i = 0; i < regels.length; i++) {
    if (!/status:\s*'actief'/.test(regels[i])) continue;
    const buurt = regels.slice(Math.max(0, i - 4), i + 5).join('\n');
    if (/\bkey\b/.test(buurt)) return true;
  }
  return false;
}

test('elke module met de toestemmingsvorm staat in het consent-register of heeft een reden', () => {
  const gevonden = jsBestanden(KERN)
    .filter(([, vol]) => heeftToestemmingsvorm(fs.readFileSync(vol, 'utf8')))
    .map(([rel]) => rel)
    .sort();

  assert.ok(gevonden.length >= 4, 'de scan vindt de bekende lagen nog (' + gevonden.join(', ') + ')');

  const onbekend = gevonden.filter(f => !DEKKING[f]);
  assert.deepEqual(onbekend, [],
    'nieuwe toestemming gevonden in: ' + onbekend.join(', ') +
    ' -- zet hem in kern/consent.js op het toestemmingsscherm, of hier met een reden waarom niet');

  // en andersom: geen dode regels in de dekkingslijst
  const dood = Object.keys(DEKKING).filter(f => !gevonden.includes(f));
  assert.deepEqual(dood, [], 'deze staan in de dekkingslijst maar bestaan niet meer: ' + dood.join(', '));
});

test('elke gedekte laag die hier een module heeft, staat ook echt in het register', () => {
  const idsInRegister = LAGEN.filter(l => l.gedekt).map(l => l.id);
  for (const [bestand, def] of Object.entries(DEKKING)) {
    if (!def.laag) continue;
    assert.ok(idsInRegister.includes(def.laag),
      bestand + ' wijst naar laag "' + def.laag + '", en die staat niet als gedekt in kern/consent.js');
  }
});

/* DE TWEEDE VORM, IN ROUTES/ (ARBEID.md par. 4 punt 7). De eerste scan kende
   alleen `status: 'actief'` in server/kern/, en daardoor zag hij niet dat een
   sollicitatie (naam, contact en cv naar een werkgever) en een anonieme
   werkinteresse nergens in het consentregister stonden: die rijen wonen in
   server/routes/ en beginnen op `nieuw` of `interesse`. Een rij met die stand
   en een persoonsverwijzing in de buurt is een OVERDRACHT aan een derde die op
   een besluit wacht; elke module met die vorm hoort hieronder, met de regel
   van NIET_GEDEKT die de lezer uitlegt waar het scherm ophoudt, of met een
   reden waarom het geen gegevens van een lid zijn. */
const ROUTES = path.join(__dirname, '..', 'server', 'routes');
const { NIET_GEDEKT } = require('../server/kern/consent-register');
const OVERDRACHT = {
  'member/werk.js': { nietGedekt: 'Een sollicitatie die u instuurde' },
  'supplier/werving/sollicitaties.js': { nietGedekt: 'Een sollicitatie die u instuurde' },
  'member/werk/talent.js': { nietGedekt: 'Anonieme werkinteresse vanuit de RTFoundation' },
  'member/partneraanmelding-aanvraag.js': { reden: 'de aanvraag van een ZAAK om partner te worden; er gaan geen gegevens van een lid naar een derde' }
};
function heeftOverdrachtsvorm(bron) {
  const zonderUitleg = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const regels = zonderUitleg.split('\n');
  for (let i = 0; i < regels.length; i++) {
    if (!/status:\s*'(nieuw|interesse)'/.test(regels[i])) continue;
    const buurt = regels.slice(Math.max(0, i - 4), i + 5).join('\n');
    if (/\bkey\b|\brtf:\s*\{|\bcontact\b/.test(buurt)) return true;
  }
  return false;
}

test('elke overdracht van persoonsgegevens aan een derde in routes/ staat verklaard', () => {
  const gevonden = jsBestanden(ROUTES)
    .filter(([, vol]) => heeftOverdrachtsvorm(fs.readFileSync(vol, 'utf8')))
    .map(([rel]) => rel).sort();
  assert.ok(gevonden.includes('member/werk/talent.js'), 'de scan vindt de bekende overdracht nog: ' + gevonden.join(', '));
  const onbekend = gevonden.filter(f => !OVERDRACHT[f]);
  assert.deepEqual(onbekend, [], 'nieuwe overdracht gevonden in: ' + onbekend.join(', ') +
    ' -- zet hem in kern/consent-register.js (LAGEN) of kern/consent-register-grens.js (NIET_GEDEKT) en hier met de verwijzing');
  const dood = Object.keys(OVERDRACHT).filter(f => !gevonden.includes(f));
  assert.deepEqual(dood, [], 'deze staan in de lijst maar hebben de vorm niet meer: ' + dood.join(', '));
  const namen = NIET_GEDEKT.map(n => n.naam);
  for (const [f, def] of Object.entries(OVERDRACHT)) {
    if (def.nietGedekt) assert.ok(namen.includes(def.nietGedekt), f + ' wijst naar "' + def.nietGedekt + '", en die regel staat niet in NIET_GEDEKT');
    else assert.ok(def.reden && def.reden.length > 20, f + ' heeft een reden nodig');
  }
  assert.equal(heeftOverdrachtsvorm("const e = { id, name, contact, status: 'nieuw' };"), true, 'de vorm wordt herkend');
  assert.equal(heeftOverdrachtsvorm("const e = { id, status: 'nieuw' };"), false, 'zonder persoon geen overdracht');
});

test('de scan kan een nieuwe laag ook echt vinden', () => {
  /* Regel 10: een meter die je niet hebt zien uitslaan, meet niets. Hier is de
     bekend-foute invoer: een verzonnen module met precies de vorm. Vindt de
     scan die niet, dan is de hele toets hierboven een gerust gevoel zonder
     grond. */
  const nep = "const r = { id: 'x', key, aanbiederId: a.id, status: 'actief', at: nu() };";
  assert.equal(heeftToestemmingsvorm(nep), true, 'de vorm wordt herkend');

  const zonderKey = "const r = { id: 'x', status: 'actief', at: nu() };";
  assert.equal(heeftToestemmingsvorm(zonderKey), false, 'zonder key is het geen toestemming van een lid');

  const zonderStatus = "const r = { id: 'x', key, at: nu() };";
  assert.equal(heeftToestemmingsvorm(zonderStatus), false);
});
