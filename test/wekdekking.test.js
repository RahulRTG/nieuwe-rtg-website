/* DE WEKDEKKING: houdt het besluit de code bij, en houdt de code het besluit bij?

   scripts/wekdekking.js zegt vandaag `zonderUitspraak: 0`. Op een nul rust hier
   een belofte -- namelijk dat er geen zevende publiek domein stil kan
   verschijnen -- en BEWIJSMACHINE.md par. 5a zegt wat je met zo'n nul moet
   doen: laten zien dat de meter ook een niet-nul zou hebben gevonden.

   Toets 1 doet dat door het REGISTER te muteren in plaats van de code: haal een
   domein uit de besluitenlijst en de meter hoort hem als onbesproken te melden.

   Toets 4 bewaakt de valkuil die dit register bijna zelf opleverde:
   `creator.volgers` is een GETAL over een extern platform en geen relatie met
   RTG-leden. Een meter die het woord `volgers` zoekt, ziet daar een
   volgerslijst en bedraadt een wekhaak die niemand wekt -- nul meldingen ziet
   er hetzelfde uit als nul volgers. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'scripts/lib/wekbesluit.js');
const METER = path.join(WORTEL, 'scripts/wekdekking.js');

/* Verse meting: beide modules uit de require-cache, want ze dragen state uit
   het bestand dat we net hebben aangepast. */
function vers() {
  delete require.cache[require.resolve(REGISTER)];
  delete require.cache[require.resolve(METER)];
  return require(METER).meet();
}

function metVervangenRegister(wijzig, doe) {
  const oud = fs.readFileSync(REGISTER, 'utf8');
  try { fs.writeFileSync(REGISTER, wijzig(oud)); return doe(); }
  finally { fs.writeFileSync(REGISTER, oud); delete require.cache[require.resolve(REGISTER)]; delete require.cache[require.resolve(METER)]; }
}

test('1. zelfijking: een domein uit het register halen laat de meter uitslaan', () => {
  const voor = vers();
  assert.equal(voor.gemeten.zonderUitspraak, 0, 'vandaag heeft elk publiek domein een uitspraak');

  const na = metVervangenRegister(
    (src) => src.replace(/\{ domein: 'kern\/galerij'[\s\S]*?\},\n/, ''),
    () => vers());
  assert.equal(na.gemeten.zonderUitspraak, 1, 'zonder zijn besluit is kern/galerij onbesproken');
  assert.ok(na.zonderUitspraak.includes('kern/galerij'), 'en hij wordt bij naam genoemd');
});

test('2. een moment zonder aanleiding wordt gemeld, en een verzonnen aanleiding ook', () => {
  const voor = vers();
  /* DIT GETAL STOND OP 1 EN IS NU 0, en dat verschil is de hele opbrengst van
     deze meter. `salon.post_uitgelicht` was een belofte zonder oorzaak --
     `featured` werd nergens gezet behalve in de seed -- en kern/salon/
     uitlichten.js heeft die handeling gebouwd. De toets is daarop bijgewerkt en
     niet andersom: hij zakte toen de reparatie landde, precies zoals hij hoort. */
  assert.equal(voor.gemeten.momentZonderAanleiding, 0,
    'elk publiek moment heeft een aanleiding die in zijn bron staat');

  const na = metVervangenRegister(
    (src) => src.replace("aanleiding: 'momentVoorClub'", "aanleiding: 'zzDezeTekstBestaatNiet'"),
    () => vers());
  assert.equal(na.gemeten.momentZonderAanleiding, 1, 'een aanleiding die nergens staat, telt mee');
  assert.equal(na.zonderAanleiding[0].gebeurtenis, 'stadion.wedstrijd_gepland');
});

test('3. een aanleiding die alleen in commentaar staat, telt niet', () => {
  /* De meter leest de GEWRONGEN bron. Zonder die wringer zou een aanleiding
     "bewijsbaar" zijn doordat iemand hem in een uitleg heeft genoemd. */
  const na = metVervangenRegister(
    (src) => src.replace("aanleiding: 'momentVoorClub'", "aanleiding: 'het wedstrijdprogramma met uitslagen'"),
    () => vers());
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/sportclub/sportief.js'), 'utf8');
  assert.ok(bron.includes('het wedstrijdprogramma met uitslagen'), 'die tekst staat er wel degelijk, in de kop van het bestand');
  assert.equal(na.gemeten.momentZonderAanleiding, 1, 'maar hij telt niet als aanleiding');
});

test('4. `volgers` als GETAL is geen volgrelatie', () => {
  const r = vers();
  const creator = r.perDomein.find(d => d.domein === 'kern/creator');
  assert.equal(creator.volgrelatie, null,
    'kern/creator.js draagt `volgers` als bereikgetal van een extern platform, niet als relatie met RTG-leden');
  const salon = r.perDomein.find(d => d.domein === 'kern/salon');
  assert.ok(salon.volgrelatie && salon.volgrelatie.length,
    'De Salon heeft er wel een: volgersVan() op volgtLid, en die geeft ledensleutels');
});

test('5. stil en niet vragen geen wekweg -- alleen moment doet dat', () => {
  const r = vers();
  const namen = new Set(r.zonderWekweg.concat(r.zonderVolgers, r.zonderAanleiding).map(x => x.gebeurtenis));
  const { BESLUITEN } = require('../scripts/lib/wekbesluit');
  for (const b of BESLUITEN) {
    if (b.klasse === 'moment') continue;
    assert.ok(!namen.has(b.gebeurtenis),
      b.gebeurtenis + ' is ' + b.klasse + ' en hoort nergens als ontbrekende wekweg te staan');
  }
});
