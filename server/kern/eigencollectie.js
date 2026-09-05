/* ============================================================================
   EEN EIGEN COLLECTIE -- de lichte vorm van een opslagcontract.

   WAAROM DIT ER PAS NU IS, EN NIET BIJ HET EERSTE CONTRACT.

   Negen domeinen kregen hun eigen opslagcontract, met de hand geschreven:
   payroll, concern, veiligheid, mobiliteit, command, en de vier die het
   levensdossier delen. Bij elk daarvan is een gedeelde klasse OVERWOGEN en
   afgeslagen, met steeds dezelfde reden: DEVELOPERCLOUD.md par. 2 en de meting
   in OBJECTMODEL.json zeggen dat een gedeeld type gevonden moet worden in de
   domeinen en niet eroverheen verklaard. Drie vormen uit negen domeinen -- losse
   collecties, een wortel met takken, een dossier per lid -- was te weinig bewijs.

   Nu is er meer. Van de 372 rechtstreekse schrijvers die er nog zijn, zitten er
   199 ALLEEN in hun map. Daarvan schrijven er 158 precies EEN collectie, en 127
   schrijven alleen collecties die niemand anders schrijft. De staart is dus
   overweldigend een vorm: een bestand, een collectie, exclusief van hem.

   Voor die vorm is een handgeschreven contract met een register en een
   doctrine-kop pure ceremonie: je zou 127 bestanden krijgen die elk een lijst
   van een dragen. Dit bestand is wat die 127 wel nodig hebben, en het is
   afgeleid uit de negen die er al staan -- niet bedacht.

   WAT HET WEL DEKT: een module die zijn eigen collecties op het hoogste niveau
   van db.data bezit, met een vaste vorm (lijst of kaart).

   WAT HET NIET DEKT, en waar de handgeschreven contracten voor blijven:
     - een wortel met takken eronder (kern/concern, kern/veiligheid);
     - een dossier per lid waarvan meerdere domeinen elk andere VELDEN bezitten
       (kern/levensdossier);
     - een domein dat schrijft in een collectie die een ander bezit
       (kern/command bedient de schakelkast van server/functies);
     - een laag die collecties leest waarvan de naam pas uit configuratie komt
       (kern/command/register.js, de bronnen van kern/levensgraaf).
   Wie een van die vier tegenkomt, schrijft een contract en gebruikt dit niet.

   EN TWEE DIE ER PAS BIJ DE STAART UIT KWAMEN. De 122 kandidaten van de
   afbouwronde leverden twaalf bestanden op die hier niet in passen, en ze
   vielen in maar twee soorten -- dus staan ze hier, met hun aantal, in plaats
   van dat de volgende ze opnieuw ontdekt:

     - EEN LEESPAD DAT NIETS MAG SCHEPPEN. `bak()` maakt de collectie altijd
       aan. Dat mag niet vanuit een read-only HTTP- of SSE-verzoek: een lege
       standaard zou dan een onbevestigde opslagmutatie worden. Daarom bestaat
       daarnaast `kijk()`: dezelfde eigenaars- en vormcontrole, maar afwezig
       blijft afwezig en levert alleen een vluchtige lege waarde op. De eigenaar
       kiest tussen lezen en schrijven; dat verschil kan een opslagcontract niet
       veilig raden.
     - EEN GETAL OF EEN STRING (drie keer: factuurTeller, doosSeq,
       balieSteunZout). Een teller of een zout is geen collectie; wie hem als
       kaart declareert, liegt over zijn vorm. De handgeschreven contracten
       hebben hier `teller()` voor (kern/command/opslag.js). Drie gevallen is te
       weinig om die vorm hierheen te tillen -- zie de kop hierboven over
       gevonden worden in plaats van eroverheen verklaard.

   DE DECLARATIE STAAT BIJ DE EIGENAAR EN NIET IN EEN MIDDENREGISTER. Dat is met
   opzet: een centrale lijst van vierhonderd collecties is binnen een jaar de
   volgende plek die uit de pas loopt met de code (BEWIJSMACHINE.md over een
   register dat naast de code leeft). Wie een collectie bezit, zegt dat op zijn
   eigen plek. Dat NIEMAND ANDERS hem ook opeist, wordt gecontroleerd door
   keuringsregel 54, die alle declaraties in server/ verzamelt en zakt op een
   dubbele.
   ========================================================================== */
'use strict';

const LEEG = { lijst: () => [], kaart: () => ({}) };

/* De vormcontrole. Bewust dezelfde als in de negen handgeschreven contracten:
   dit stond daar negen keer, en de ene deed het met Array.isArray terwijl de
   andere typeof === 'object' gebruikte. */
const klopt = (soort, w) => soort === 'lijst'
  ? Array.isArray(w)
  : (w && typeof w === 'object' && !Array.isArray(w));

/* `bezit` is een kaart van collectienaam naar 'lijst' of 'kaart'.
   `domein` is de naam die in een foutmelding komt te staan, zodat duidelijk is
   WIE er iets probeerde wat niet mag. */
module.exports = function maakEigen({ db, domein, bezit }) {
  if (!db || !db.data) throw new Error('eigencollectie: zonder db.data is er niets om te bewaren');
  if (!domein) throw new Error('eigencollectie: zonder domeinnaam zegt een fout niet wie hem maakte');
  if (!bezit || typeof bezit !== 'object' || !Object.keys(bezit).length) {
    throw new Error('eigencollectie (' + domein + '): een eigenaar zonder collecties bezit niets. ' +
      'Zet op wat je bezit, met per collectie "lijst" of "kaart".');
  }
  for (const [naam, soort] of Object.entries(bezit)) {
    if (soort !== 'lijst' && soort !== 'kaart') {
      throw new Error('eigencollectie (' + domein + '): "' + naam + '" heeft soort "' + soort +
        '"; dat moet "lijst" of "kaart" zijn. Een andere vorm vraagt een eigen contract -- zie de kop.');
    }
  }

  function eis(naam) {
    const soort = bezit[naam];
    if (!soort) {
      throw new Error('eigencollectie (' + domein + '): "' + naam + '" staat niet in wat dit domein ' +
        'bezit. Een collectie die nergens is opgeschreven, kan niemand verhuizen -- zet hem erbij, ' +
        'of hoort hij bij een ander?');
    }
    return soort;
  }

  /* DE ENIGE PLEK WAAR EEN COLLECTIE VAN DIT DOMEIN ONTSTAAT. `zaai` draait
     alleen bij het AANMAKEN; wat er dan in hoort is domeinkennis en blijft dus
     bij de aanroeper. */
  function bak(naam, zaai) {
    const soort = eis(naam);
    if (!klopt(soort, db.data[naam])) {
      db.data[naam] = LEEG[soort]();
      if (typeof zaai === 'function') zaai(db.data[naam]);
    }
    return db.data[naam];
  }

  /* LEZEN ZONDER SCHEPPEN. Een ontbrekende collectie betekent voor een
     projectie een lege verzameling, maar schrijft die lege standaard niet terug.
     Een BESTAANDE verkeerde vorm is geen lege verzameling: die blijft een harde
     fout, zodat beschadigde securitydata nooit als afwezig wordt geïnterpreteerd. */
  function kijk(naam) {
    const soort = eis(naam);
    if (!Object.prototype.hasOwnProperty.call(db.data, naam)) return LEEG[soort]();
    if (!klopt(soort, db.data[naam])) {
      throw new Error('eigencollectie (' + domein + '): bestaande collectie "' + naam +
        '" heeft niet de verklaarde vorm ' + soort + '; weigeren om haar als leeg te lezen.');
    }
    return db.data[naam];
  }

  /* Een collectie VERVANGEN, voor wie kapt op een maximum of een rij opnieuw
     opbouwt. Dezelfde eigenaars- en vormcontrole als bak(); zonder die twee zou
     dit de achterdeur zijn. */
  function zetBak(naam, waarde) {
    const soort = eis(naam);
    if (!klopt(soort, waarde)) {
      throw new Error('eigencollectie (' + domein + '): "' + naam + '" hoort een ' + soort +
        ' te zijn; er werd iets anders neergezet.');
    }
    db.data[naam] = waarde;
    return waarde;
  }

  return { bak, kijk, zetBak, bezit, domein };
};

module.exports.LEEG = LEEG;
