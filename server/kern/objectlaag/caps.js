/* De objectlaag, deelbestand "caps": DE CATALOGUS. Elke cap die dit huis kent
   staat hier, en nergens anders.

   WAT EEN CAP IS. Niet een knop en niet een scherm, maar het antwoord op de
   vraag "wat kan ik met dit ding?" -- gesteld aan een PERSOON, een GROEP of een
   EVENT in plaats van aan een app. Dat is de omkering uit LIFE.md par. 2: een
   lid opent geen app maar iets uit zijn leven, en het platform laat zien wat
   daar bij hoort.

   EEN CAP IS EEN BELOFTE, EN DAAROM STAAT HIJ HIER. PLATFORM.md beschrijft wat
   er gebeurt als beloftes los komen te staan van de code: zeventien
   app-beschrijvingen beloofden functies die niet bestonden ("open deuren op
   afstand", "laat de sommelier alvast kiezen", "wij verzorgen inpakken en
   bezorgen"), en geen ervan had een route. Dat is precies de fout die een
   objectlaag kan HERHALEN op grote schaal: een cap 'reizen' bij een persoon
   voelt logisch, en zonder bestemming is het een leugen met een pijltje.

   Vandaar dat elke cap hier zijn BESTEMMING draagt, en dat
   test/objectlaag.test.js zakt zodra een bestemming niet bestaat als bestand.
   Een cap zonder werkende bestemming komt er niet in.

   HET PATROON IS NIET NIEUW. De leverancierskant draait al zo: 73 genres, een
   app, en de server bepaalt welke modules een zaak aanzet
   (kern/pda/modules.js). Wat daar `caps` heet voor een ZAAK, heet hier `caps`
   voor een OBJECT -- zelfde gedachte, andere kant van het platform. De les die
   daar in de kop staat geldt hier onverkort: de server bepaalt de lijst, het
   scherm schakelt erop, en niemand houdt aan twee kanten dezelfde waarheid bij.

   WAT HIER NIET IN HOORT. Een cap die iets DOET namens het lid. Alles hier
   wijst naar de app die het echte werk doet; klaarzetten en bevestigen is fase
   5 (LIFE.md par. 3). Er staat dus geen enkele cap in deze catalogus die een
   bericht stuurt, een uitnodiging verstuurt of iets betaalt. */
'use strict';

/* De catalogus. `naam` is wat het lid leest, `wat` legt uit waar het heen gaat,
   `link` is de bestemming en `app` de specialist die het echte werk doet.

   De volgorde in dit object is de volgorde op het scherm: praten eerst, dan
   samen doen, dan beheren. Een cap toevoegen is een regel hier plus een regel
   in de typemodule die hem kan aanzetten -- en nooit iets in het scherm. */
const CAPS = {
  // ---- persoon ----
  berichten: { naam: 'Bericht sturen', wat: 'Uw gesprek met deze codenaam in Berichten.',
    app: 'Berichten', link: '/apps/comm.html' },
  wbw: { naam: 'Wie betaalt wat', wat: 'Het lijstje dat u samen bijhoudt.',
    app: 'RTG Geld', link: '/apps/geld.html#wbw' },
  samengroep: { naam: 'Uw gedeelde genootschap', wat: 'De groep waar u allebei in zit.',
    app: 'Genootschap', link: '/apps/genootschap.html' },
  vonk: { naam: 'Uw match in Vonk', wat: 'Het gesprek en de tafel die daarbij hoort.',
    app: 'Vonk', link: '/apps/vonk.html' },
  rendezvous: { naam: 'Uw match in Rendez-vous', wat: 'De gedeelde plekken en het voorstel.',
    app: 'Rendez-vous', link: '/apps/rendezvous.html' },

  // ---- groep ----
  prikbord: { naam: 'Prikbord', wat: 'Wat er in deze groep geplaatst is.',
    app: 'Genootschap', link: '/apps/genootschap.html' },
  peiling: { naam: 'Peilingen', wat: 'De vragen die openstaan in deze groep.',
    app: 'Genootschap', link: '/apps/genootschap.html' },
  bijeenkomst: { naam: 'Bijeenkomsten', wat: 'Wat deze groep heeft gepland.',
    app: 'Genootschap', link: '/apps/genootschap.html' },
  uitvoer: { naam: 'Uitvoer', wat: 'Wat er uit deze groep is afgesproken.',
    app: 'Genootschap', link: '/apps/genootschap.html' },
  beheer: { naam: 'Beheer', wat: 'Leden, rollen en de regels van deze groep.',
    app: 'Genootschap', link: '/apps/genootschap.html' },

  // ---- event ----
  antwoord: { naam: 'Laten weten of u komt', wat: 'Ja, misschien of nee, in het genootschap.',
    app: 'Genootschap', link: '/apps/genootschap.html' },
  gastheer: { naam: 'U bent gastheer', wat: 'U kunt deze bijeenkomst wijzigen of afgelasten.',
    app: 'Genootschap', link: '/apps/genootschap.html' },
  vandegroep: { naam: 'De groep erachter', wat: 'Het genootschap waar deze bijeenkomst bij hoort.',
    app: 'Genootschap', link: '/apps/genootschap.html' }
};

/* Een cap naar de vorm die het scherm krijgt. `waarom` is verplicht en dat is
   met opzet: een cap staat er omdat er iets IS -- een match, een gedeeld
   lijstje, een rol -- en dat hoort het lid te kunnen lezen. Een cap zonder
   reden is een knop die er zomaar staat, en dan begint het raden.

   Een onbekende cap-id levert null en geen halve regel: een typemodule die een
   cap noemt die niet in de catalogus staat, hoort te verdwijnen en niet als
   naamloos blokje op het scherm te belanden. index.js filtert ze eruit en de
   toets zakt erop. */
function capVoor(id, waarom) {
  const c = CAPS[id];
  if (!c) return null;
  return { id, naam: c.naam, wat: c.wat, app: c.app, link: c.link, waarom: String(waarom || '') };
}

module.exports = { CAPS, capVoor };
