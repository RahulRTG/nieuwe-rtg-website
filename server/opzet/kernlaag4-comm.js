/* DE KERN SAMENSTELLEN -- deel 4, de communicatiekern.

   Geknipt uit ./kernlaag4.js omdat dat bestand over de leesgrens van dit huis
   ging, en dit het stuk was met de duidelijkste naad: alles hieronder hoort bij
   kern/comm en niets anders. Het wordt vanuit kernlaag4 aangeroepen op de plek
   waar het stond, want de volgorde is inhoudelijk en niet toevallig -- na
   kern.berichten, voor kern.care.

   Wat `kern` en `hulp` zijn: zie de kop van ./kernlaag1.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, anthropic, crypto, db, findSupplier, rtmail, save } = hulp;

/* ---------------------- RTG Communication Core ----------------------
   Een gespreksmodel voor het hele platform (kern/comm). Elke module die een
   gesprek nodig heeft -- een rit, een bestelling, een klas, een ticket --
   vraagt het hier aan in plaats van een zevende berichtenvoorraad te bouwen:

       kern.comm.gesprekMaak({ soort: 'ride', deelnemers: [a, b],
                               meta: { sleutel: 'rit:RT-1941' } })

   NA kern.berichten gemount, want de AI-laag van de Berichten-app wordt
   hergebruikt: dezelfde drie taken (samenvatten, opstellen, afspraken) op de
   draad van de kern. Een tweede AI-laag zou een tweede plek zijn waar de regel
   "de AI stelt op, de mens verstuurt" gehandhaafd moet worden. */
/* WIE ER AAN TAFEL MAG ZITTEN (kern/comm/wie.js). Een deelnemer was tot nu toe
   altijd een lid; sinds hier ook een zaak, een collega of het kantoor in een
   gesprek kan zitten, moet de kern twee dingen weten die hij zelf niet kan
   opzoeken: hoe zo'n deelnemer HEET en op welke SSE-stroom hij luistert. Beide
   komen hier binnen, zodat kern/comm niets weet van de leverancierskast of de
   personeelstabel.

   De naam van een medewerker komt alleen terug als hij ECHT bij die zaak hoort.
   Zonder die vergelijking zou 'mens:AB12:7' de naam van teamlid 7 opleveren,
   welk bedrijf dat ook is -- een sleutel verzinnen was dan een manier om de
   personeelstabel af te lopen. */
const commActorNaam = require('../kern/comm/wie').maakNaam({
  codenaamVan: kern.codenaamVan,
  zaakNaam: (code) => { const z = findSupplier(code); return z ? z.name : null; },
  mensNaam: (code, id) => {
    try {
      const s = accounts.getStaffById(id);
      return s && String(s.supplier_code || '').toUpperCase() === String(code).toUpperCase() ? s.name : null;
    } catch (e) { return null; }
  }
});
/* HET ACTORMODEL KENT NIET ALLE SLEUTELS DIE DIT HUIS HEEFT. `wie.js` leest
   'zaak:', 'mens:' en 'gezin:'; de sociale laag en de spellen dragen een
   RTF-profiel als 'rtf:<gezinscode>:<profielId>'. Dat laatste komt uit
   ontleed() als NULL -- terecht, want gokken wat een onbekende ruimte betekent
   is precies wat daar niet hoort te gebeuren -- en dan heette de afzender in
   een gesprek "Onbekend". Dat viel op toen de potjechat er kwam: twee
   gezinsprofielen die samen dammen zagen elkaars berichten zonder naam.

   De brug staat HIER, op de plek waar de twee woordenboeken elkaar raken, en
   niet in wie.js: `codenaamVan` is de functie die beide werelden al kent.
   Alleen de weergave gaat hierlangs -- wie ergens IN mag hangt aan de
   deelnemerslijst en verandert hier niet. */
const commNaam = (sleutel) => commActorNaam(sleutel) || (kern.codenaamVan ? kern.codenaamVan(sleutel) : null) || null;
kern.comm = require('../kern/comm').maakComm({ db, save, crypto,
  codenaamVan: kern.codenaamVan, naamVan: commNaam,
  sein: require('../kern/comm/wie').maakSein({ sseToCustomer: hulp.sseToCustomer,
    sseToSupplier: hulp.sseToSupplier, sseToOffice: hulp.sseToOffice }) });
kern.commBronnen = require('../kern/comm/bronnen').maakBronnen({ db,
  codenaamVan: kern.codenaamVan,
  /* convOf wordt pas later in de opbouw gezet (server.js); daarom hier op het
     moment van AANROEPEN opgehaald en niet nu vastgelegd -- anders staat er
     voor altijd undefined in. */
  convOf: (id) => (kern.convOf ? kern.convOf(id) : []),
  overheid: kern.overheid, rtmail });
/* De brug voor de priveberichten: de sociale laag en haar routes schrijven
   sinds de verhuizing IN de kern (kern/comm/dm.js), met de oude geschiedenis
   die er per paar eenmalig bij wordt gehaald. Zo is er nog maar een plek waar
   deze gesprekken staan. */
kern.commDm = require('../kern/comm/dm').maakCommDm({ db, save, comm: kern.comm, dmSleutel: kern.dmSleutel });
/* En dezelfde brug voor de collegaberichten op de werkvloer (kern/comm/
   collega.js). Die kon pas verhuizen sinds een deelnemer ook een mens BINNEN
   EEN ZAAK kan zijn; routes/staff/collega.js schrijft er sindsdien in, met
   dezelfde antwoordvorm zodat de PDA en de zaak-app niets merken. */
kern.commCollega = require('../kern/comm/collega').maakCommCollega({ db, save, comm: kern.comm });
/* En het gastcontact: de lijn tussen een lid en een zaak, per afdeling
   (kern/comm/gast.js). Het eerste gesprek waarin een codenaam en een bedrijf
   samen zitten, en daarmee het gesprek waarvoor het actormodel is gemaakt. */
kern.commGast = require('../kern/comm/gast').maakCommGast({ db, save, comm: kern.comm });
/* En de sollicitatiechat (kern/comm/werk.js): werkgever tegenover sollicitant,
   waarbij die sollicitant een lid kan zijn OF een profiel binnen een RTF-gezin.
   De laatste van de vier grote voorraden. */
kern.commWerk = require('../kern/comm/werk').maakCommWerk({ db, save, comm: kern.comm });
kern.commAi = require('../kern/berichten/ai')({
  // de kern gooit als een gesprek niet van jou is; de AI-laag verwacht null
  draad: (mijKey, gesprekId) => { try { return kern.comm.draad(mijKey, gesprekId); } catch (e) { return null; } },
  anthropic });
};
