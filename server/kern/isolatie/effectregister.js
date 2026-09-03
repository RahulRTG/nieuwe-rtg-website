/* WELKE EFFECTEN EEN PAD DRAAGT -- de twee registers, los van de motor.

   Ze staan apart van ./effecten.js omdat ze een ander soort inhoud zijn: dat
   bestand is de grammatica (wat een effect IS, wat een stand sluit, hoe je
   weegt) en dit zijn de UITSPRAKEN. Grammatica verandert zelden en met een
   toets erbij; uitspraken groeien elke keer dat iemand een pad nakijkt. Ze bij
   elkaar houden betekent dat een gewone toevoeging het bestand blijft laten
   groeien tot het weer geknipt moet worden.

   De graden staan uitgelegd in ./effecten.js. In het kort: VERKLAARD is een
   regel die iemand met een grond heeft opgeschreven, PER_CATEGORIE is een
   VERMOEDEN afgeleid uit waar een functie woont -- en een vermoeden verliest het
   van een meting (zie ./leesset.js). */
'use strict';

/* KLEIN BEGONNEN EN MET EEN GROND PER REGEL: een register dat in één ronde
   volloopt met vermoedens, is een register dat niemand meer durft af te dwingen. */
const VERKLAARD = Object.freeze([
  { patroon: /^\/api\/(pay|bank)\//,            effecten: ['GELD_BEWEGEN'],
    grond: 'alles achter kern/pay/poort.js beweegt of legt een bedrag vast' },
  { patroon: /^\/api\/appstore\/.*\/(start|draai|uitvoer)/, effecten: ['DERDENCODE_UITVOEREN'],
    grond: 'APPSTORE.md: derdencode draait in de cel, en dat is het effect' },
  { patroon: /^\/api\/techniek\//,              effecten: ['BEVEILIGING_VERZWAKKEN', 'RECHT_VERLENEN'],
    grond: 'de techniekhoek zet standen, schakelaars en zekeringen' },
  { patroon: /(zekering|incident|schakel|bevoegdheid|machtiging)/i, effecten: ['BEVEILIGING_VERZWAKKEN'],
    grond: 'zelfde strekking, ongeacht waar het pad woont -- dit is precies wat een effectmodel moet doen' },
  { patroon: /^\/api\/rtgid\//,                 effecten: ['IDENTITEIT_WIJZIGEN'],
    grond: 'RTG iD is de identiteit zelf' },
  { patroon: /(webhook|apikey|sleutel|oauth|sso|scim|koppel)/i, effecten: ['VERTROUWENSRELATIE_AANGAAN'],
    grond: 'elk van deze maakt een blijvende relatie met iets buiten de sessie' },
  { patroon: /(upload|bestand|document|foto|beeld|pdf|import)/i, effecten: ['ONVERTROUWDE_BYTES'],
    grond: 'hier komen bytes binnen die niemand van ons heeft geschreven' },
  { patroon: /(export|uitdraai|dump|archief)/i, effecten: ['BULK_UITVOER'],
    grond: 'veel gegevens tegelijk naar buiten is een eigen effect, ook als elk stuk apart mocht' },
  /* DEZE REGEL DEKT EEN BLINDE VLEK VAN EEN ANDERE METER, en dat is de reden dat
     hij hier staat en niet bij de vermoedens. IDEMPROEF.json meet of een route
     een COLLECTIE beweegt en zegt zelf dat hij niet naar bestanden en uitgaande
     aanroepen kijkt (`nietGemeten: bestand,externe-aanroep`). /api/agenda/ai
     bewoog geen collectie en roept wel een model aan: dat kost geld en verlaat
     het huis. Zonder deze regel promoveert ./leesset.js zo'n pad tot bewezen
     lezer, en dan laat isolatie precies de duurste weg naar buiten open.

     WAT HIJ NIET VANGT, en dat hoort erbij: een pad dat een model aanroept
     zonder dat in zijn naam te zeggen. Deze regel leest de naam, niet de code.
     De echte bron zou de enige plek zijn waar elke modelaanroep langskomt
     (server/ai.js, zie KOSTEN.md), maar die kent geen routes -- die brug bestaat
     niet en het getal staat daarom als blinde vlek in ISOLATIEPROEF.json. */
  { patroon: /(^|\/)(ai|bijles|advies)(\/|$)/i, effecten: ['UITGAANDE_AANROEP'],
    grond: 'een pad dat zich ai, bijles of advies noemt roept een model aan; dat kost geld en ' +
      'verlaat het huis, en de opslagmeting ziet dat niet' }
]);

/* Wat een categorie uit de functiecatalogus VERMOEDELIJK doet. Uitdrukkelijk
   `vermoed`: de categorie zegt waar iets woont, en daaruit volgt hooguit een
   verwachting. Wie dit als verklaring leest, heeft de graad weggegooid. */
const PER_CATEGORIE = Object.freeze({
  'Toegang en identiteit':     ['RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN'],
  'Identiteit en veiligheid':  ['IDENTITEIT_WIJZIGEN'],
  'Betalen & verificatie':     ['GELD_BEWEGEN'],
  'Geld':                      ['GELD_BEWEGEN'],
  'Partners (leveranciers)':   ['SCHRIJVEN_ANDERMANS'],
  'Personeel & integraties':   ['SCHRIJVEN_ANDERMANS', 'VERTROUWENSRELATIE_AANGAAN'],
  'RTG-Backoffice':            ['SCHRIJVEN_ANDERMANS', 'BEVEILIGING_VERZWAKKEN']
});


module.exports = { VERKLAARD, PER_CATEGORIE };
