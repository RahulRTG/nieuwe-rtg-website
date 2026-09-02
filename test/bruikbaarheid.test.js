/* WAT ER ONDER EEN STAND NOG WERKT -- de andere helft van de vraag.

   ISOLATIEPROEF.json telde alleen wat er DICHTGAAT, en dat is de helft die een
   verkeerd gevoel geeft: hoe meer er dicht is, hoe beter het lijkt. Een
   isolatiestand die niemand durft aan te zetten, beschermt niemand.

   DEZE METING VOND DRIE ECHTE FOUTEN IN HET ONTWERP, en dat is de reden dat ze
   bestaat. Onder `isolatie` stonden drie beloftes op "werkt niet":

     geld-lezen           een lid kon zijn eigen afschrift niet meer opvragen --
                          de eerste handeling van iemand die zijn account niet
                          vertrouwt. Oorzaak: de regel ^/api/(pay|bank)/ zegt
                          GELD_BEWEGEN, en die sloeg een GEMETEN lezer.
     zelf-beschermen      de knop waarmee een mens zich beschermt viel dicht
                          door de bescherming zelf.
     ontsluiten-aanvragen een stand zonder uitgang is een val, en een val zet
                          niemand aan.

   WAT DEZE TOETS BEWIJST:

   1. elke belofte (`moetHeel`) staat HEEL onder elke stand -- dat is de regel
      die de drie fouten hierboven had moeten vangen en nu vangt;
   2. de stand doet aantoonbaar iets: geld sturen gaat wel dicht. Anders meet
      deze toets alleen dat er niets gebeurt;
   3. de uitgang van de stand is nooit door de stand zelf te sluiten;
   4. de verhalen wijzen naar paden die BESTAAN -- een verhaal over een route die
      er niet is, staat altijd op "werkt niet" en zegt niets.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - EIGEN_UITGANG leegmaken in leesset.js          -> 1 en 3 ZAKKEN (RAAK).
   - de leesset-uitzondering uit besluit.js halen
     (de belofte "lezen loopt door")                 -> 1 ZAKT (RAAK).
   - BUITEN_DE_OPSLAG vervangen door alle effecten   -> 1 ZAKT (RAAK).
   - /api/pay/stuur uit het verhaal `geld-sturen`    -> 2 ZAKT (RAAK).

   Draai los: node --test test/bruikbaarheid.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const functies = require('../server/functies');
const maakIsolatie = require('../server/kern/isolatie');
const { maakBruikbaarheid, VERHALEN } = require('../server/kern/isolatie/bruikbaarheid');
const { alleRoutes } = require('../scripts/lib/routes');

function meter() {
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  return maakBruikbaarheid({ isolatie: iso, functies });
}

test('1. elke belofte staat heel onder elke stand', () => {
  const uit = meter().overStanden(['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie']);
  const gezakt = [];
  for (const [stand, v] of Object.entries(uit)) {
    for (const b of v.belofteGezakt) gezakt.push(stand + ': ' + b.id + ' (' + b.dicht.join(', ') + ')');
  }
  assert.deepEqual(gezakt, [],
    'deze beloftes zakken: ' + gezakt.join('; ') +
    ' -- een stand die zijn eigen belofte breekt, wordt niet gebruikt');
});

test('2. de stand doet aantoonbaar iets', () => {
  const uit = meter().overStanden(['normaal', 'beschermd', 'isolatie']);
  assert.equal(uit.normaal.werktNiet, 0, 'zonder stand hoort alles te werken');
  assert.ok(uit.beschermd.werktNiet + uit.beschermd.beperkt > 0,
    'de beschermstand hoort iets te sluiten, anders meet deze toets dat er niets gebeurt');

  const sturen = uit.isolatie.rijen.find(r => r.id === 'geld-sturen');
  assert.equal(sturen.stand, 'werkt niet', 'geld sturen hoort onder isolatie dicht te zitten');

  /* En isolatie is minstens zo streng als beschermd -- dat volgt uit de
     ordening, en als het hier niet zo uitkomt, klopt de ordening niet. */
  assert.ok(uit.isolatie.werkt <= uit.beschermd.werkt);
});

test('3. de uitgang is nooit door de stand zelf te sluiten', () => {
  const uit = meter().overStanden(['isolatie']).isolatie;
  for (const id of ['zelf-beschermen', 'ontsluiten-aanvragen']) {
    const r = uit.rijen.find(x => x.id === id);
    assert.equal(r.stand, 'werkt', id + ' moet onder isolatie heel blijven: een stand zonder uitgang is een val');
  }
});

test('4. elk verhaal wijst naar paden die bestaan', () => {
  const bestaat = new Set(alleRoutes().map(r => r.pad));
  const wezen = [];
  for (const v of VERHALEN) for (const p of v.paden) if (!bestaat.has(p)) wezen.push(v.id + ' -> ' + p);
  assert.deepEqual(wezen, [],
    'deze verhalen wijzen naar een route die niet bestaat: ' + wezen.join(', ') +
    ' -- zo\'n verhaal staat altijd op "werkt niet" en zegt niets');
});

/* ---------------------------------------------------------------------------
   5. WAT ER OPEN BLIJFT, WAT ER OOK GEBEURT.

   81 paden hebben geen functie in de catalogus en passeren de beschermstand
   ongemerkt. Dat getal las als 81 problemen en dat was het niet: 68 zijn de
   eigenaar-console (bewust buiten de functieschakelaars), 6 zijn de uitgang van
   deze laag zelf, 5 zijn rechten die een mens over zichzelf heeft, en 2 zijn
   overwogen en met opzet niet opengezet.

   De vijf rechten -- inzage, uitdraai, het inzagejournaal en het intrekken van
   toestemming -- horen niet dicht te vallen omdat er een incident loopt, en om
   twee redenen die allebei op zichzelf genoeg zijn. Juridisch schort je een
   AVG-recht niet op omdat het even slecht uitkomt. En inhoudelijk, wat hier
   zwaarder weegt: ze LEZEN of ze VERSMALLEN. Een beveiligingslaag die een
   versmalling tegenhoudt, werkt tegen zichzelf in.

   MUTATIES (LAT.md regel 2):
   - /api/privacy/delete aan RECHT_VAN_DE_MENS toevoegen -> 5 ZAKT bij het LADEN
     (de fail-fast in openpaden.js: bewust dicht en toch open is precies het gat
     dat je pas bij een incident vindt).
   - /api/toestemming/intrek uit RECHT_VAN_DE_MENS halen -> 5 ZAKT (RAAK).
   - EIGEN_UITGANG en RECHT_VAN_DE_MENS hetzelfde pad geven -> 5 ZAKT bij het laden.
   ------------------------------------------------------------------------ */
test('5. wat open blijft heeft een grond, en wat dicht blijft ook', () => {
  const openpaden = require('../server/kern/isolatie/openpaden');
  const leesset = require('../server/kern/isolatie/leesset');

  /* Elke open regel draagt een grond die iets ZEGT. Een lege grond, of een woord
     als "ok" of "nodig", is een vrijstelling die niemand kan betwisten.

     De drempel stond eerst op twintig tekens en dat was te streng: "de uitgang
     aanvragen" is een echte grond, alleen kort -- de vier ceremoniestappen leggen
     zichzelf uit in hun context. Een lengte-eis die legitiem korte gronden
     afkeurt, leert de volgende schrijver om er woorden bij te verzinnen, en dan
     meet hij precies niets meer. */
  const LEEG = /^(ok|nodig|ja|nee|tbd|todo|-+)$/i;
  for (const lijst of [openpaden.EIGEN_UITGANG, openpaden.RECHT_VAN_DE_MENS, openpaden.BEWUST_DICHT]) {
    for (const [pad, grond] of Object.entries(lijst)) {
      const g = String(grond).trim();
      assert.ok(g.length >= 10 && !LEEG.test(g) && g.includes(' '),
        pad + ' heeft geen echte grond: "' + grond + '"');
    }
  }

  /* De rechten staan werkelijk open onder isolatie, en de bewust-dichte niet. */
  for (const pad of Object.keys(openpaden.RECHT_VAN_DE_MENS)) {
    const u = leesset.magOnderIsolatie(pad, functies.functieVoorPad(pad));
    assert.equal(u.mag, true, pad + ' hoort open te blijven: ' + u.waarom);
    assert.equal(u.grond, 'RECHT_VAN_DE_MENS');
  }
  for (const pad of Object.keys(openpaden.BEWUST_DICHT)) {
    assert.equal(leesset.magOnderIsolatie(pad, functies.functieVoorPad(pad)).mag, false,
      pad + ' is bewust dicht en hoort dat te blijven');
  }

  /* HET INTREKKEN VAN TOESTEMMING IS DE SCHERPSTE VAN DE VIJF, en hij staat hier
     apart genoemd: hij VERSMALT wat er mag. Een stand die een versmalling
     tegenhoudt, werkt tegen zichzelf in -- en dat is precies het soort regel dat
     bij een refactor sneuvelt omdat hij contra-intuïtief oogt. */
  assert.ok(openpaden.RECHT_VAN_DE_MENS['/api/toestemming/intrek'],
    'toestemming intrekken maakt de verzameling wat mag KLEINER en hoort altijd te kunnen');
});
