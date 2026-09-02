/* Expliciete bevoegdheden voor het AI-stuur.

   Een route die nieuw aan RTG wordt toegevoegd, komt hier NIET vanzelf bij.
   Dat is de beveiligingsgrens: een nieuw POST-pad is pas AI-bedienbaar nadat
   iemand het doel en de impact heeft beoordeeld en het hieronder bewust als
   `direct` of `voorstel` heeft opgenomen.

   DRIE NIVEAUS, EN WAAROM HET ER GEEN TWEE MEER ZIJN. Er stond hier eerst
   `direct` tegenover `voorstel`, en `direct` betekende "uitsluitend lezen OF een
   kleine, omkeerbare handeling zonder externe gevolgen". Dat is niet een niveau
   maar twee: scripts/gezagsnoemer.js kon die trede daarom niet afbeelden op de
   gedeelde noemer en meldde hem als ONBEPAALD -- een woord in de laag waaruit de
   AI kiest dat twee verschillende dingen zegt over wat de machine zelfstandig
   doet. De eigenaar heeft besloten te splitsen (EXECUTIE.md blok 2).

     lezen      de machine leest en verandert niets
     klein      een kleine, omkeerbare handeling zonder externe gevolgen
     voorstel   wijzigt gegevens, deelt informatie, boekt, publiceert of beweegt
                geld, en vereist een eenmalig servervoorstel dat de gebruiker
                buiten het model bevestigt

   DE SPLITSING VERANDERT GEEN BEVOEGDHEID, en dat is met opzet: `lezen` en
   `klein` samen zijn exact de oude `direct`-lijst, en alleen `voorstel` vraagt
   nog steeds een menselijke bevestiging. Wat hij WEL deed is vijf routes
   blootleggen die in de lezen-lijst stonden en helemaal niet lezen:
   /api/mediaos/stuur en /volg (zetten de smaak en het volgen van een lid),
   /api/leerstof/oefen en /antwoord (schrijven de oefenstand) en /api/bijles/vraag
   (roept een model aan en kost geld). Die staan nu onder `klein`, waar ze horen.

   Alles wat niet genoemd is blijft dicht, ook als de ingelogde gebruiker de
   onderliggende route zelf wel mag. */

const { staatVan } = require('../../lib/vervalstaat');
const { bodemVoorPad } = require('../frictie/bodem');

/* De drie lijsten wonen in ./beleid-lijsten.js: dit bestand draagt het besluit,
   dat bestand draagt de paden. Zie de kop daar voor waarom die naad daar zit. */
const { LEZEN, KLEIN, VOORSTEL } = require('./beleid-lijsten');
function raakt(lijst, pad) {
  return Array.isArray(lijst) && lijst.some(re => re.test(pad));
}

/* DE BEWIJSPOORT -- proof-aware routing (PROOF.md par. 8).

   De allowlist hierboven zegt wat een mens ooit heeft goedgekeurd. Deze poort
   zegt wat vandaag nog te vertrouwen is: staat de vervalstaat van een route op
   GESCHORST (een bewijscel is gezakt -- het bewijs zegt zelf dat het niet
   klopt), dan biedt het stuur die actie helemaal niet aan.

   Dat is de omkering die deze laag onderscheidt. Niet: de AI probeert iets en
   de beveiliging houdt hem misschien tegen. Maar: een onbewezen handeling
   staat niet in de lijst waaruit de AI kiest. De schorspoort
   (server/middleware/schorspoort.js) blijft eronder staan als vangnet voor het
   echte verzoek; beide lezen dezelfde ene waarheid (server/lib/vervalstaat.js).

   ALLEEN GESCHORST SLUIT, en dat is een bewuste grens. `verzwakt` draagt op
   dit moment vrijwel elke route (er is bijna altijd een schakel ongemeten);
   daarop sluiten zou de hele AI-laag dichtzetten en dat is precies de vorm van
   "veiligheid" die mensen uitzetten. Geschorst is geen ontbrekend bewijs maar
   TEGENSPREKEND bewijs, en dat is een ander ding.

   Het stuur roept intern altijd met POST aan (zie server/kern/stuur.js), dus
   dat is de methode waarop we de staat opzoeken. */
/* DE SCHAAL WOONT HIER, en wordt nergens anders overgeschreven. Hij stond als
   losse tekenreeksen door dit bestand heen, en drie lezers (../stuur.js,
   ./plan.js, ./mandaat.js) schreven diezelfde woorden nog eens over -- TAKEN.md
   4.55. Als bevroren object is hij op te halen, zodat een hernoeming hier een
   fout elders geeft in plaats van een tak die nooit meer vuurt. */
const NIVEAUS = Object.freeze({
  verboden: 'verboden', lezen: 'lezen', klein: 'klein', voorstel: 'voorstel'
});

function beleidVoor(pad, wereld) {
  const w = String(wereld || '');
  if (!Object.prototype.hasOwnProperty.call(LEZEN, w)) {
    return { niveau: NIVEAUS.verboden, reden: 'Het AI-stuur mist een geldige, servergekozen rol.' };
  }
  /* DE BODEM VAN HET HUIS -- kern/frictie/bodem.js, en dit is de tweede lezer.

     De allowlist hierboven is een besluit dat ooit per pad genomen is. Dat is
     kwetsbaar op precies een manier: wie er een pad bij zet, neemt dat besluit
     opnieuw, alleen en zonder dat iets meekijkt. De bodem is de lijst grenzen
     die NIET per pad heronderhandeld mag worden -- een KYC-besluit, een
     pasbesluit, geld dat het huis verlaat -- en hij komt uit dezelfde bron als
     de frictiemotor die RTG Command gebruikt.

     DE TWEE SCHALEN ZIJN NIET DEZELFDE LENGTE, en scripts/gezag.js zegt met
     zoveel woorden dat ze daarom niet op elkaar af te beelden zijn zonder een
     besluit. Hier staat dat besluit:

         direct   de machine doet het alleen            -> auto
         voorstel de machine bereidt voor, mens tekent  -> assist
         verboden de machine zit er niet aan            -> hand

     HIJ KAN ALLEEN VERZWAREN. Er is geen tak die een pad soepeler maakt dan de
     allowlist hem al had, en dat is de dragende eigenschap van deze koppeling:
     een contextmodel dat frictie kan WEGHALEN is een manier om om een
     vergunningplicht of een merkregel heen te komen. Toevoegen mag, weghalen
     niet. Zie de kop van kern/frictie/bodem.js voor waarom dat geen theorie is:
     FOUNDATION.md heeft dezelfde afweging al een keer gemaakt en er bewust geen
     EXECUTE_LOW_RISK van gemaakt. */
  const bodem = bodemVoorPad(pad);
  if (bodem && bodem.minimum === 'hand') {
    return { niveau: NIVEAUS.verboden, wereld: w, bodem: bodem.id,
      reden: bodem.reden + ' Deze handeling doet een mens zelf; het stuur biedt hem niet aan.',
      bron: bodem.bron };
  }

  const opDeLijst = raakt(LEZEN[w], pad) ? NIVEAUS.lezen
    : raakt(KLEIN[w], pad) ? NIVEAUS.klein
    : (raakt(VOORSTEL[w], pad) ? NIVEAUS.voorstel : null);
  if (!opDeLijst) {
    return { niveau: NIVEAUS.verboden, wereld: w,
      reden: 'Deze actie staat niet op de expliciete AI-allowlist voor ' + w + '.' };
  }
  const staat = staatVan('POST', pad);
  if (staat && staat.staat === 'geschorst') {
    return { niveau: NIVEAUS.verboden, wereld: w, vervalstaat: 'geschorst',
      reden: 'Het bewijs achter deze actie is gezakt; hij is geschorst tot een hermeting slaagt. ' +
        'Het AI-stuur kiest niet uit onbewezen handelingen.' };
  }
  /* Een bodem op `assist` betekent: nooit zonder menselijke bevestiging. In de
     taal van het stuur is dat `voorstel`. Vandaag verschuift dit niets -- geen
     van de bodempaden staat op een LEZEN- of KLEIN-lijst -- en dat is het punt: het was
     tot nu toe waar bij toeval, en het is nu waar bij constructie. Wie morgen
     /api/bank/sepa op zo'n lijst zet, krijgt hier een voorstel terug in
     plaats van een stille uitvoering. */
  const niveau = bodem && bodem.minimum === 'assist' && opDeLijst !== NIVEAUS.voorstel ? NIVEAUS.voorstel : opDeLijst;
  return { niveau, wereld: w,
    ...(niveau !== opDeLijst ? { bodem: bodem.id, reden: bodem.reden, bron: bodem.bron } : {}),
    ...(staat ? { vervalstaat: staat.staat } : {}) };
}

function toegestanePaden(paden, wereld) {
  return (paden || []).filter(p => beleidVoor(p, wereld).niveau !== NIVEAUS.verboden);
}

/* DIRECT blijft bestaan als de VERENIGING van lezen en klein: bestaande
   aanroepers die "mag de AI dit zonder bevestiging" vragen, hoeven niet te
   veranderen en krijgen exact het oude antwoord. test/stuur-niveaus.test.js
   houdt vast dat die vereniging gelijk is aan de lijst van voor de splitsing. */
const DIRECT = Object.freeze(Object.fromEntries(
  Object.keys(LEZEN).map(w => [w, LEZEN[w].concat(KLEIN[w] || [])])));

module.exports = { LEZEN, KLEIN, DIRECT, VOORSTEL, NIVEAUS, beleidVoor, toegestanePaden };
