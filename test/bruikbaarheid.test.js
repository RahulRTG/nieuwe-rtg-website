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

/* De beschermstand gaat MEE, zoals in het echt: zonder hem meet deze meter
   alleen wat de laag BELOOFT en niet wat er wordt afgedwongen -- en precies dat
   verschil hield een gebroken belofte een half jaar onzichtbaar. */
function meter() {
  const { maakBeschermstand } = require('../server/kern/beschermstand');
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  return maakBruikbaarheid({ isolatie: iso, functies, beschermstand: maakBeschermstand({ functies }) });
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

test('4. elk verhaal wijst naar paden die bestaan MET DEZE METHODE', () => {
  /* DE METHODE TELT MEE, en dat was een gat. Deze toets keek alleen of het PAD
     bestond, en de meter legde elk pad hard op POST. Een GET-route die als POST
     wordt gemeten krijgt een strenger antwoord dan de werkelijkheid -- de meter
     meldt dan een gat dat er niet is, en dat is precies wat een meter waardeloos
     maakt. Sinds de verhalen hun methode zelf dragen, hoort die er ook bij te
     worden nagekeken.

     MUTATIE die hem laat zakken: zet `GET /api/foundation/gezin/:code/gezondheid`
     om naar de POST-vorm. Het pad bestaat nog, de methode niet -- en deze toets
     zou daar vandaag groen op blijven. */
  const bestaat = new Map();
  for (const r of alleRoutes()) {
    if (typeof r.pad !== 'string') continue;
    const m = String(r.methode || r.method || 'POST').toUpperCase();
    if (!bestaat.has(r.pad)) bestaat.set(r.pad, new Set());
    bestaat.get(r.pad).add(m);
  }
  const { ontleedPad } = meter();
  const wezen = [];
  for (const v of VERHALEN) {
    for (const regel of v.paden) {
      const { methode, pad } = ontleedPad(regel);
      const m = bestaat.get(pad);
      if (!m) wezen.push(v.id + ' -> ' + regel + ' (pad bestaat niet)');
      else if (!m.has(methode)) wezen.push(v.id + ' -> ' + regel + ' (bestaat wel, maar als ' +
        [...m].join('/') + ')');
    }
  }
  assert.deepEqual(wezen, [],
    'deze verhalen wijzen naar iets dat niet bestaat: ' + wezen.join(', ') +
    ' -- zo\'n verhaal staat altijd op "werkt niet" of juist te streng, en zegt niets');
});

test('6. geen verhaal bestaat alleen uit GET-paden', () => {
  /* DE TWEELINGREGEL VAN TOETS 4. `besluit()` laat een GET in beide vallen door
     (kern/isolatie/besluit.js en kern/beschermstand.js laten GET altijd langs),
     dus een verhaal dat alleen uit GET's bestaat staat onder ELKE stand op
     "werkt" -- en zegt daarmee precies evenveel als een verhaal naar een route
     die niet bestaat. Een verhaal dat niet kan zakken, meet niets.

     MUTATIE: haal /api/foundation/gezin/inloggen uit `kind-gezondheid-lezen`,
     zodat alleen de GET overblijft -> ZAKT. */
  const { ontleedPad } = meter();
  const blind = VERHALEN.filter(v =>
    v.paden.every(regel => /^(GET|HEAD|OPTIONS)$/.test(ontleedPad(regel).methode)));
  assert.deepEqual(blind.map(v => v.id), [],
    'deze verhalen bestaan alleen uit leesroutes en staan daarom onder elke stand op "werkt": ' +
    blind.map(v => v.id).join(', '));
});

test('7. het scherm van een lid krijgt geen rij uit een andere baan', () => {
  /* Zonder dit filter leest een lid op zijn EIGEN scherm "dan werkt niet meer:
     afrekenen aan de kassa" -- een zin over iemand anders zijn werk, op de plek
     waar hij besluit of hij zichzelf beschermt. Het filter hoort in de module en
     niet in de client: twee filters zijn twee waarheden.

     MUTATIE: haal het `banen`-argument weg in server/routes/isolatie.js, of laat
     meet() het negeren -> ZAKT met zaak-afrekenen erbij. */
  const { LEDENBANEN } = require('../server/kern/isolatie/bruikbaarheid');
  const uit = meter().overStanden(['isolatie'], { banen: LEDENBANEN }).isolatie;
  const vreemd = uit.rijen.filter(r => !LEDENBANEN.includes(r.wie));
  assert.deepEqual(vreemd.map(r => r.id + ' (' + r.wie + ')'), [],
    'deze rijen horen niet op het scherm van een lid: ' + vreemd.map(r => r.id).join(', '));

  /* En er blijft wél iets over -- een filter dat alles wegneemt, zou deze toets
     stil laten slagen. */
  assert.ok(uit.rijen.length > 20, 'het filter neemt te veel weg: ' + uit.rijen.length);
  assert.ok(uit.rijen.some(r => r.wie === 'gezin'), 'een gezinsverhaal hoort er wel bij te staan');
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

/* ---------------------------------------------------------------------------
   8. DE METER MEET OOK DE LAAG DIE ECHT HANDHAAFT.

   Dit is de scherpste toets van dit bestand, en hij bestaat omdat de meter een
   half jaar de verkeerde laag mat. `isolatie.besluit()` is de BESLUITLAAG: hij
   kent de leesset-redding en hij wordt afgedwongen in het AI-filter. De laag die
   in de HTTP-keten werkelijk iets tegenhoudt is `beschermstand.houdtTegen()`, en
   die kent die redding NIET.

   Gemeten onder huis=`beschermd`: `geld-lezen` -- een belofte met `moetHeel` --
   staat volgens de besluitlaag op WERKT en volgens de handhavende weg op WERKT
   NIET, want /api/pay/overzicht, /api/bank/afschrift en /api/bank/overzicht
   vallen alle drie dicht op de categorie "Geld". Het register meldde ondertussen
   `beloftesGezakt: []`.

   DEZE TOETS EIST NIET DAT DE TWEE GELIJK ZIJN. Dat zouden ze moeten worden, en
   dat is een besluit met een schaduwronde eronder (ISOLATIEPROEF.json). Hij eist
   dat het VERSCHIL WORDT GEMETEN -- een meter die maar een van de twee lagen
   kent, geeft groen licht boven een gat.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - `beschermstand` niet meegeven aan maakBruikbaarheid -> ZAKT (de tweede kolom
     is dan `null` en het verschil verdwijnt).
   - `belofteGezaktAfgedwongen` laten teruggeven op de besluitkolom -> ZAKT.
   ------------------------------------------------------------------------ */
test('8. de meter kent beide lagen, en het verschil is zichtbaar', () => {
  const { maakBeschermstand } = require('../server/kern/beschermstand');
  const functies = require('../server/functies');
  const uit = meter().overStanden(['beschermd']).beschermd;

  /* De tweede kolom bestaat en is geen null: "we hebben niet gekeken" mag hier
     niet als "het staat open" langskomen. */
  for (const r of uit.rijen) {
    assert.ok(r.afgedwongen !== null && r.afgedwongen !== undefined,
      r.id + ' heeft geen afgedwongen-kolom; dan meet deze meter alleen de belofte');
  }

  /* En hij zegt iets ANDERS dan de besluitkolom, want dat is de hele reden dat
     hij er is. Zou dit ooit gelijk worden, dan is dat goed nieuws -- maar dan
     hoort deze toets te worden herschreven met de meting erbij, niet stil
     geschrapt. */
  const verschil = uit.rijen.filter(r => r.stand !== r.afgedwongen);
  assert.ok(verschil.length > 0,
    'de twee lagen zeggen hetzelfde; als dat klopt is het gat gedicht en hoort deze toets te ' +
    'worden herschreven met de meting erbij');

  /* De belofte hangt aan wat er wordt AFGEDWONGEN. Vandaag zakt `geld-lezen`
     daar, en dat staat als schuldpunt in het register -- niet als groen vinkje. */
  const bs = maakBeschermstand({ functies });
  const dicht = ['/api/pay/overzicht', '/api/bank/afschrift', '/api/bank/overzicht']
    .filter(p => !!bs.houdtTegen(p, 'POST'));
  assert.deepEqual(dicht, ['/api/pay/overzicht', '/api/bank/afschrift', '/api/bank/overzicht'],
    'als deze drie niet meer dichtvallen op de handhavende weg, is de belofte geld-lezen echt ' +
    'gerepareerd -- werk dan dit bestand EN ISOLATIEPROEF.json bij in plaats van de toets te slopen');
  assert.ok(uit.belofteGezaktAfgedwongen.some(b => b.id === 'geld-lezen'),
    'de meter hoort dit als gebroken belofte te melden: ' + JSON.stringify(uit.belofteGezaktAfgedwongen));
});
