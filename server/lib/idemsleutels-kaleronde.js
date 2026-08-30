/* ============================================================================
   IDEM-SLEUTELS -- DE KALE RONDE VAN 30 AUGUSTUS 2026.

   Deel van ./idemsleutels.js; zie de kop daar voor de vorm, de regels en waarom
   een verklaring op de NAAM van een route een gok is met een net gezicht.

   WAT DEZE ROUTES GEMEEN HEBBEN. De idemproef stuurt naast zijn gewone ronde een
   KALE ronde: twee woordelijk gelijke oproepen, geen idem-veld, geen header --
   de echte dubbeltik van een ongeduldige gebruiker. Honderdzestien routes deden
   daar het werk gewoon opnieuw. Van de routes hieronder is de handler nagelezen,
   en bij elk ervan staat er een veld in de body dat bepaalt WAT er ontstaat.
   Twee identieke verzoeken binnen het dubbeltikvenster zijn dan een dubbeltik.

   Het veld staat er per regel bij, en dat is geen versiering: het is waar een
   volgende lezer op moet controleren als de handler verandert.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- gelezen op 30 augustus 2026, uit de kale ronde van de idemproef ----

     Deze routes deden bij een woordelijk gelijke herhaling ZONDER sleutel het
     werk gewoon opnieuw. Van elk is de handler nagelezen -- niet de naam, want
     dat is precies de fout waar de kop van dit bestand voor waarschuwt en waar
     /api/muziek/maak hierboven het litteken van draagt.

     Bij deze staat er wel degelijk een veld in de body dat bepaalt WAT er
     ontstaat, en een tweede identiek verzoek binnen het dubbeltikvenster is dus
     een dubbeltik en geen tweede bedoeling. Het veld staat er per regel bij. */
  'POST /api/bedrijf/lid/aanmeld': { zelfdeVerzoek: true },            // naam + functie + afdeling
  'POST /api/bedrijf/project/maak': { zelfdeVerzoek: true },           // naam + werkvorm
  'POST /api/bedrijf/taak/maak': { zelfdeVerzoek: true },              // titel + projectId
  'POST /api/bedrijf/werkruimte/maak': { zelfdeVerzoek: true },        // naam + moeder
  'POST /api/festival/nieuw': { zelfdeVerzoek: true },                 // de naam van het festival
  'POST /api/foundation/gezin/agenda': { zelfdeVerzoek: true },        // titel + datum + tijd
  'POST /api/foundation/gezin/droom/maak': { zelfdeVerzoek: true },    // de tekst van de droom
  'POST /api/foundation/gezin/gezondheid/medicijn': { zelfdeVerzoek: true },  // naam van het medicijn
  'POST /api/foundation/gezin/klus': { zelfdeVerzoek: true },          // titel + sterren + voor wie
  'POST /api/foundation/les/maak': { zelfdeVerzoek: true },            // vak + docentnaam
  'POST /api/foundation/school/bezoeker/aanmeld': { zelfdeVerzoek: true },    // naam + organisatie
  'POST /api/foundation/school/leerling/aanmeld': { zelfdeVerzoek: true },    // naam + opleiding
  'POST /api/foundation/school/subsidie/zet': { zelfdeVerzoek: true },        // naam + verstrekker
  'POST /api/bank/pas/uitgeven': { zelfdeVerzoek: true },              // iban + soort + naam

  /* TWEE MET EEN ADDERTJE, en dat hoort erbij te staan. `klant/zet` en
     `repo/zet` heten `zet` maar doen `const id = req.body.klantId || rid(5)`:
     MET een id werken ze bij, ZONDER id maken ze er elke keer een nieuwe. De
     verklaring geldt dus vooral die tweede vorm -- en dat is precies de vorm
     waarin een dubbeltik een dubbele klant oplevert. */
  'POST /api/bedrijf/klant/zet': { zelfdeVerzoek: true },              // klantId of, zonder id, de naam
  'POST /api/bedrijf/repo/zet': { zelfdeVerzoek: true },               // repoId of, zonder id, de naam

  /* ---- tweede ronde twee: dezelfde kale ronde, de rest van de 116 ----

     AANMAAK EN OVERSCHRIJVING. Bij deze staat er een veld in de body dat bepaalt
     wat er ontstaat, of ze schrijven een waarde die bij een tweede identieke
     oproep precies hetzelfde is. In allebei de gevallen is een woordelijk gelijk
     verzoek binnen het venster een dubbeltik: bij de eerste soort scheelt dat een
     dubbel ding, bij de tweede een tweede schrijfactie met een tweede regel in
     het auditspoor -- en dat spoor hoort te zeggen hoe vaak een MENS op de knop
     drukte, niet hoe vaak het verzoek aankwam. */
  'POST /api/office/rendezvous/tafel/maak': { zelfdeVerzoek: true },   // genodigden + tijd
  'POST /api/supplier/gebouwpand/bhv': { zelfdeVerzoek: true },        // dag + opkomst
  'POST /api/supplier/gebouwplus/lead': { zelfdeVerzoek: true },       // naam + wens
  'POST /api/supplier/samenwerking/oproep': { zelfdeVerzoek: true },   // de oproep zelf
  'POST /api/rtgone/frictie': { zelfdeVerzoek: true },                 // de frictie zelf
  'POST /api/supplier/betaalverzoek': { zelfdeVerzoek: true },         // codename + bedrag
  'POST /api/pay/verzoek': { zelfdeVerzoek: true },                    // aan + totaalCenten
  'POST /api/supplier/giftcard/sell': { zelfdeVerzoek: true },         // bedrag
  'POST /api/supplier/staff/invite': { zelfdeVerzoek: true },          // naam + rol + functie

  /* De tien bureaus van de werkplek delen een vorm: `doe('atelier', 'ontwerpMaak',
     'body')` maakt uit de body een ontwerp of een collectie. Tien routes, een
     patroon, en bij alle tien draagt de body de titel. */
  'POST /api/werkplek/bureau/architect/maak': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/architect/project': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/atelier/maak': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/atelier/collectie': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/hardware/maak': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/hardware/serie': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/ideeen/maak': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/redactie/artikel/maak': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/studio/maak': { zelfdeVerzoek: true },
  'POST /api/werkplek/bureau/studio/collectie': { zelfdeVerzoek: true },
  'POST /api/office/hardware/serie': { zelfdeVerzoek: true },          // dezelfde vorm, kantoorkant

  /* Overschrijvingen: de tweede oproep zet dezelfde waarden. */
  'POST /api/office/boardroom/rahul/zet': { zelfdeVerzoek: true },     // karakter + verhaal
  'POST /api/foundation/gezin/oppasinfo': { zelfdeVerzoek: true },     // noodcontacten + info
  'POST /api/office/atelierweb/bewaar': { zelfdeVerzoek: true },       // het ontwerp
  'POST /api/office/merk/sjabloon': { zelfdeVerzoek: true },           // code + ontwerp
  'POST /api/site/bewaar': { zelfdeVerzoek: true },                    // het ontwerp
  'POST /api/supplier/site/bewaar': { zelfdeVerzoek: true },           // het ontwerp
  'POST /api/salon/bio': { zelfdeVerzoek: true },                      // de bio
  'POST /api/supplier/salon/bio': { zelfdeVerzoek: true },             // de bio
  'POST /api/gedachten/zet': { zelfdeVerzoek: true },
  'POST /api/metier/kaart': { zelfdeVerzoek: true },
  'POST /api/onboarding/paspoort': { zelfdeVerzoek: true },
  'POST /api/toestellen/koppel': { zelfdeVerzoek: true },
  'POST /api/supplier/horeca/venue/concept': { zelfdeVerzoek: true },  // de posities
  'POST /api/supplier/horeca/wijk/zet': { zelfdeVerzoek: true },       // wijkId + tafels
  'POST /api/supplier/horeca/rahul/grens': { zelfdeVerzoek: true },    // de grens in centen
  'POST /api/supplier/aanwezig/leeg': { zelfdeVerzoek: true },         // zet drie tellers op nul
  'POST /api/supplier/bezorg/terug': { zelfdeVerzoek: true },          // verwijdert de eigen rit
  'POST /api/techniek/fouten/wis': { zelfdeVerzoek: true },            // wist de storingslijst
  'POST /api/foundation/school/calamiteit': { zelfdeVerzoek: true },   // zet of heft het alarm

  /* ---- de laatste ronde: het kantoorbord en wat erop lijkt ----

     Schakelaars die een STAND zetten. Een tweede identieke tik zet dezelfde
     stand, en het ding blijft een -- maar er komt wel een tweede regel in het
     auditspoor van de afdelingen. Dat spoor hoort te zeggen hoe vaak een MENS op
     de knop drukte, en niet hoe vaak het verzoek aankwam. Vandaar dat ook deze
     dedupliceren. */
  /* /api/office/bank/nood EN /api/office/bank/herstel STONDEN HIER EN ZIJN ERAF
     (30 augustus 2026). Dit is dezelfde fout als bij ./idemsleutels-kaleronde-b.js
     bij /api/supplier/security, maar dan aan de HERSTELKANT -- en die had ik
     daar wel gezien en hier niet.

     De noodstop en het herstel dragen allebei een lijf dat leeg mag zijn (bij
     `nood` is `reden` optioneel, bij `herstel` staat er niets in). Twee keer
     drukken geeft dus twee keer dezelfde vingerafdruk, en de tweede druk werd
     opgeslikt met het antwoord van de eerste. Dat leest als "gelukt" terwijl er
     niets is gebeurd.

     Wat het kost: een tweede noodstop na een herstel zet de bank NIET stil, en
     een tweede herstel na een tweede noodstop haalt hem er NIET uit -- terwijl
     de knop wel "ok" zegt. test/bank.test.js liep er precies in: het herstel op
     regel 158 werd opgeslikt, de bank bleef in nood, en drie toetsen verderop
     ging de foundation-afdracht via de kaart in plaats van het eigen grootboek.
     Het duurde drie toetsen voordat het zichtbaar werd, en dat is nu juist het
     gevaarlijke: op een echte bank was het een stand die niemand terugdraait.

     Een noodknop en een herstelknop krijgen hier geen duplicaatlaag. Wie ze twee
     keer indrukt, meent het. */
  'POST /api/office/bank/leden': { zelfdeVerzoek: true },             // aan: true/false
  'POST /api/office/bank/operationeel': { zelfdeVerzoek: true },      // aan: true/false
  'POST /api/office/bank/instellingen': { zelfdeVerzoek: true },      // de instellingen zelf
  'POST /api/office/bank/autoriseer/annuleer': { zelfdeVerzoek: true },
  'POST /api/office/bank/rekening/bevries': { zelfdeVerzoek: true },  // iban + aan
  /* /api/office/bank/mislukking STOND HIER EN IS ERAF (30 augustus 2026).

     Ik gaf hem `zelfdeVerzoek` met de aantekening "reden + sleutel", en allebei
     die velden zijn OPTIONEEL. Drie mislukte clearings achter elkaar melden gaat
     in de praktijk met een leeg lijf, en dan is de vingerafdruk drie keer
     dezelfde: de teller kwam op 1 in plaats van 3 en de bank sloeg NIET
     automatisch in nood. Precies de fout waar de kop van ./idemsleutels.js voor
     waarschuwt -- twee keer `{}` naar een dobbelworp zijn twee worpen -- en
     test/bank.test.js zakte erop.

     De route ontdubbelt bovendien al zelf, en beter: kern.bankClearingMislukt()
     krijgt de sleutel van de mislukte CLEARING mee, en dat is het ding dat
     werkelijk een keer telt. Een tweede rem erboven die de sleutel niet eens
     ziet, kan alleen maar in de weg zitten. */
  'POST /api/command/agent/stop': { zelfdeVerzoek: true },            // naam + reden
  'POST /api/command/agent/hervat': { zelfdeVerzoek: true },          // naam + reden
  'POST /api/command/agent/rechten': { zelfdeVerzoek: true },         // naam + mag + reden
  'POST /api/appstore/wis-opslag': { zelfdeVerzoek: true },           // de sleutel
  'POST /api/supplier/mall/sync': { zelfdeVerzoek: true },            // de stand die gemeld wordt
  /* /api/supplier/horeca/folio/nacht STOND HIER EN IS ERAF (30 augustus 2026).

     De nachtrun ontdubbelt al zelf, en beter dan deze laag kan: hij houdt per
     folio bij welke NACHTEN er geboekt zijn en slaat over wat er al staat. Het
     antwoord vertelt dat ook -- `geboekt: 0, overgeslagen: 1`.

     Met een duplicaatregel erboven kreeg de tweede oproep het antwoord van de
     eerste terug: `geboekt: 1`. Er werd niets dubbel geboekt (daar zorgt de
     handler voor), maar het ANTWOORD loog over wat er gebeurd was, en een
     nachtrun die zegt dat hij een nacht boekte terwijl hij hem oversloeg, is
     precies het soort verschil dat een hotel pas op de rekening van de gast
     terugvindt. test/horeca-hotel-event.test.js zakte hierop.

     Dit is de derde van dezelfde soort in een ronde (na /api/office/bank/mislukking
     en het paar nood/herstel hierboven), en samen vormen ze een regel: EEN ROUTE
     DIE ZELF AL WEET DAT ZE HET AL GEDAAN HEEFT, KRIJGT HIER NIETS. Deze laag is
     er voor routes die dat niet weten. */
  'POST /api/member/lifestyle/gezondheid/dossier': { zelfdeVerzoek: true },
  'POST /api/member/rechterhand/maison/log': { zelfdeVerzoek: true }
,

  /* ---- de laatste twaalf uit de kale ronde, gelezen op 30 augustus 2026 ----

     Overschrijvingen: de tweede identieke oproep zet dezelfde waarde. */
  'POST /api/member/rtmail/bewaartermijn': { zelfdeVerzoek: true },   // doel + dagen + reden
  'POST /api/supplier/rtmail/bewaartermijn': { zelfdeVerzoek: true }, // zelfde route, zaakkant
  'POST /api/member/spel/sudoku-nieuw': { zelfdeVerzoek: true }       // niveau; overschrijft het lopende potje
};

module.exports = { SLEUTELS };
