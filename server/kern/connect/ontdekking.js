/* ============================================================================
   DE ONTDEKKING -- een PROJECTIE met etiketten, geen objecttype.

   Het voorstel noemt dertien contentsoorten (video, verhaal, fotoreeks,
   podcast, cursus, quiz, challenge, experiment, project, simulatie, discussie,
   live sessie, vraag) en wil er een universele laag overheen. De verleiding is
   daar een `Ontdekking` van te maken met een vaste set velden waar elk
   brondomein zich naar voegt.

   DAT IS GEMETEN EN HET MAG NIET. CONNECTLUS.json, deel B: over 18 domeinen met
   iets ontdekbaars staan er 0 van 496 velden in ALLE domeinen, 0 in zelfs maar
   de helft, en 87,9% in precies EEN. Platformbreed is dat 71% (OBJECTMODEL.json),
   dus deze domeinen zijn MINDER verwant dan een willekeurige doorsnede van dit
   huis. Dezelfde uitslag als bij `Asset`, `Koopbaar`, `Moment` en `Manier`, en
   dezelfde uitweg: een projectie met een klein aantal etiketten, per aanroep
   samengesteld door het brondomein zelf. De waarheid blijft waar hij hoort --
   in de app die hem beheert -- en deze laag voegt alleen toe wat nergens stond.

   ZEVEN ETIKETTEN, EN ZES ZIJN VERPLICHT:

     onderwerp   waar dit over gaat, in een woord. Verplicht.
     soort       wat de mens ziet. Verplicht, en het is de TAAL van de bron:
                 deze laag heeft geen lijst van dertien soorten, want dan zou
                 zij ze kennen en dat is precies het objecttype dat er niet is.
     titel       verplicht.
     ingang      waar de mens zelf heen gaat. Verplicht, en het is een PAD en
                 nooit een handeling -- deze laag voert niets uit. Letterlijk
                 dezelfde regel als kern/knelpunt/aanvoer.js.
     werkwoorden wat je hier kunt doen, verklaard via ./lus.js. Verplicht.
     herkomst    welk domein dit heeft gezegd. Verplicht -- REIZEN.md: het maakt
                 niet uit waar een onderdeel vandaan komt, het maakt wel uit dat
                 RTG dat weet.
     dektNiet    wat dit NIET is of niet leert. Verplicht, en dat is de les van
                 openingen-kaart.js: de gevaarlijkste lezer is niet degene die
                 een leegte voor een gat aanziet, maar degene die aanbod leest
                 als "hiermee ben ik er".

   En een zevende die NOOIT wordt verzonnen:
     zekerheid   `null` tenzij de bron zelf zegt hoe hard dit is. `null` leest
                 als "niet nagegaan" en nooit als "klopt". AR-herkenning,
                 gegenereerde leerstof en een uitleg van een vreemde zijn alle
                 drie onzeker op een andere manier; een laag die daar een
                 standaardwaarde voor bedenkt, maakt schijnzekerheid.

   TWEE DINGEN KUNNEN HIER STRUCTUREEL NIET, en dat is iets anders dan verboden:

   1. EEN GETAL OP EEN MENS OF OP EEN DING. `score`, `rang`, `gewicht`,
      `populariteit`, `relevantie` worden GEWEIGERD met het veld erbij. Een
      projectie die een score mag dragen, is binnen een jaar een ranglijst --
      en de mixer die erop sorteert hoeft er dan niets voor te doen.
   2. EEN GEGEVEN OVER DE MENS. `leeftijd`, `postcode`, `geslacht`, `inkomen`,
      `bsn`, `email` en wat erop lijkt worden geweigerd. Zoals `vondsten()` de
      mens niet KRIJGT, draagt een ontdekking hem niet MEE. Dat maakt een
      geschiktheidstoets hier onmogelijk in plaats van af te leren.

   Weigeren betekent hier: de hele ontdekking valt af, met de reden. Niet het
   veld eruit strippen en de rest doorlaten -- dan denkt de bron dat hij het
   heeft meegestuurd, en de volgende versie stuurt er twee.
   ========================================================================== */
'use strict';

const lus = require('./lus');
const kring = require('./kring');

/* Velden die een oordeel of een rangorde dragen. Ruim, en dat is de goede kant:
   een onterecht geweigerd veld kost een bron een hernoeming, een doorgelaten
   score kost de laag zijn belofte. */
const GEEN_CIJFER = ['score', 'rang', 'ranking', 'gewicht', 'populariteit', 'relevantie',
  'sterren', 'rating', 'niveau', 'punten', 'trending', 'viraal'];

/* Velden over de MENS. Dezelfde gedachte als de actor-weigering in
   kern/envelop.js: wat op een persoonsgegeven lijkt, komt er niet in. */
const GEEN_MENS = ['leeftijd', 'geboren', 'geboortedatum', 'postcode', 'adres', 'geslacht',
  'inkomen', 'bsn', 'email', 'telefoon', 'naam', 'achternaam', 'nationaliteit', 'religie',
  'gezondheid', 'diagnose'];

const VERPLICHT = ['onderwerp', 'soort', 'titel', 'ingang', 'herkomst', 'dektNiet', 'kring'];

/* EEN ontdekking projecteren. Geeft `{ ok, ontdekking }` of `{ ok:false, reden }`
   -- nooit een uitzondering, want een bron die een veld te veel stuurt hoort dat
   te LEZEN en niet om te vallen. */
function projecteerOntdekking(rec) {
  const r = rec && typeof rec === 'object' ? rec : {};

  for (const veld of Object.keys(r)) {
    const k = veld.toLowerCase();
    if (GEEN_CIJFER.includes(k)) return { ok: false, veld,
      reden: 'Een ontdekking draagt geen "' + veld + '". Deze laag rangschikt niet en zet geen cijfer op ' +
        'iets of iemand; wat er in plaats daarvan komt is de REDEN waarom dit hier staat (kern/connect/mixer.js).' };
    if (GEEN_MENS.includes(k)) return { ok: false, veld,
      reden: 'Een ontdekking draagt geen "' + veld + '". Gegevens over de mens komen deze laag niet in -- ' +
        'niet om te filteren en niet om te tonen. Wat een bron van iemand EIST, hoort zichtbaar in het aanbod ' +
        'zelf te staan en wordt hier nooit toegepast.' };
  }

  for (const veld of VERPLICHT) {
    if (!String(r[veld] == null ? '' : r[veld]).trim()) {
      return { ok: false, veld, reden: 'Een ontdekking zonder "' + veld + '" bestaat niet. ' +
        (veld === 'dektNiet' ? 'Een bron die niet zegt wat hij NIET dekt, laat de lezer denken dat hij er is.'
          : veld === 'kring' ? 'Een bron zegt zelf hoe ver zijn aanbod reikt; raden zou hier of een lek of een stilte opleveren.'
          : 'Zie de kop van kern/connect/ontdekking.js.') };
    }
  }

  const ingang = String(r.ingang);
  /* Een PAD, geen handeling. Een bron die hier een POST-route zet, laat deze
     laag iets aanvragen -- en alles wat een derde raakt is maximaal
     klaarzetten (COMMERCE.md par. 3, APPSTORE.md grens 5). */
  if (!/^\/[^\s]*$/.test(ingang)) return { ok: false, veld: 'ingang',
    reden: 'De ingang is een pad binnen RTG (beginnend met /), en nooit een handeling of een externe koppeling. ' +
      'Deze laag brengt een mens ergens heen; aanvragen doet hij daar zelf.' };

  const v = lus.verklaar(r.werkwoorden);
  if (!v.werkwoorden.length) return { ok: false, veld: 'werkwoorden',
    reden: 'Een ontdekking waar je niets mee kunt, is geen ontdekking. Verklaar minstens een werkwoord' +
      (v.geweigerd.length ? '; geweigerd: ' + v.geweigerd.map(g => g.werkwoord).join(', ') + '.' : '.') };

  /* GEEN STANDAARDKRING. Hier stond `kring.kring(r.kring) ? r.kring :
     STANDAARD`, en dat viel dicht op `alleenIk` -- veilig, en fout. Een bron
     die zijn bereik vergeet te noemen, leverde dan ontdekkingen die NIEMAND te
     zien kreeg, zonder dat er iets klaagde: precies de stille non-bezorging
     waar kern/ontvanger.js over gaat. Dichtvallen is het juiste GEDRAG en de
     verkeerde PLEK -- de bron hoort te horen dat hij het niet heeft gezegd. */
  if (!kring.kring(r.kring)) return { ok: false, veld: 'kring',
    reden: 'Deze kring bestaat niet. Een bron zegt zelf hoe ver zijn aanbod reikt; kies uit: ' +
      kring.KRINGEN.map(x => x.id).join(', ') + '.' };
  const k = String(r.kring);

  return { ok: true, ontdekking: {
    onderwerp: String(r.onderwerp).trim().slice(0, 80),
    soort: String(r.soort).trim().slice(0, 40),
    titel: String(r.titel).trim().slice(0, 160),
    ingang,
    herkomst: String(r.herkomst).trim().slice(0, 60),
    dektNiet: String(r.dektNiet).trim().slice(0, 240),
    kring: k,
    werkwoorden: v.werkwoorden,
    bevestigtEenMens: v.bevestigtEenMens,
    /* Nooit verzonnen. `null` is een uitslag: deze bron heeft er niets over
       gezegd, en dat is iets anders dan "het klopt". */
    zekerheid: r.zekerheid == null ? null : String(r.zekerheid).slice(0, 120),
    /* De sleutel waarop naklank en dossier hangen. Hij komt van de BRON en
       draagt zijn herkomst, zodat twee domeinen nooit dezelfde sleutel geven. */
    id: String(r.herkomst).trim().slice(0, 60) + ':' + String(r.id || ingang).slice(0, 80)
  } };
}

/* Een LIJST projecteren. Wat afvalt, valt niet stil af: `geweigerd` komt terug
   met de reden, zodat een bron die zijn vorm verandert dat merkt in plaats van
   langzaam uit de lijst te verdwijnen (LAT-regel 5). */
function projecteerAlle(lijst, herkomst) {
  const uit = [], geweigerd = [];
  for (const rec of Array.isArray(lijst) ? lijst : []) {
    const r = projecteerOntdekking(Object.assign({ herkomst }, rec));
    if (r.ok) uit.push(r.ontdekking);
    else geweigerd.push({ titel: String((rec || {}).titel || '').slice(0, 60), veld: r.veld, reden: r.reden });
  }
  return { ontdekkingen: uit, geweigerd };
}

module.exports = { projecteer: projecteerOntdekking, projecteerAlle, GEEN_CIJFER, GEEN_MENS, VERPLICHT };
