/* VIER ECONOMISCHE WERELDEN, EN ZE LOPEN NIET IN ELKAAR OVER.

   Dit bestand is de correctie op een fout die in kern/kosten/ zat en die er
   redelijk uitzag: één nota van de hoster, verdeeld over ALLE gebruikers naar
   hun verbruik -- leden, zaken en de gezinnen van de RTFoundation door elkaar,
   in één pot. Dat rekent netjes en het klopt niet. De RTFoundation is geen
   kostenpost van RTG die je over gebruikers uitsmeert; het is een zelfstandige
   economische entiteit met een eigen vermogen, eigen begrotingen, eigen
   bestuur en een eigen verantwoording (kern/rtfos/geld*.js staat er al).

   Een gedeelde pot maakt drie dingen tegelijk kapot. Boekhoudkundig: kosten van
   de ene rechtspersoon landen in het resultaat van de andere. Juridisch: een
   subsidiegever die vraagt waar zijn geld heen ging, krijgt een antwoord waarin
   commerciële klanten voorkomen. En praktisch: één programmeerfout zet
   Foundation-kosten op de factuur van een bedrijf, en dat is niet met een
   creditnota te repareren.

   DUS VIER WERELDEN, EN DE WERELD IS EEN EIGENSCHAP VAN DE IDENTITEIT EN NIET
   VAN DE TRANSACTIE. Dat onderscheid is de hele grap. Wie de wereld per boeking
   laat meegeven, laat hem meegeven -- en dan bepaalt de aanroeper wat de grens
   is die hem had moeten tegenhouden.

     consument      particulieren. Wat zij kosten weet RTG precies; wat er
                    daarvan op een rekening komt is een aparte vraag.
     commercieel    ondernemingen. Hier zit de echte doorbelasting.
     rtg-intern     RTG zelf: het huis, zijn eigen diensten en het verbruik dat
                    geen eigenaar heeft. Deze wereld VERKOOPT infrastructuur aan
                    de andere drie, en dat maakt zichtbaar of een RTG-product op
                    zichzelf uit kan.
     rtfoundation   de stichting. Eigen vermogen, eigen begroting, eigen
                    bestuur. Kosten van deze wereld gaan NOOIT naar een
                    gebruiker van een andere.

   WAT HIER MET OPZET NIET STAAT. De lijst van economische identiteiten
   (vestiging, voertuig, apparaat, API-client, agent, project, afdeling,
   dochtermaatschappij) staat er niet als achttien soorten. Een soort zonder
   teller is een leeg vakje dat als dekking leest; ze komen erbij op het moment
   dat er iets is dat ze meet. Wat er nu is, meet op vier: lid, zaak, gezin en
   het huis. Zie ECONOMIE.md voor wat er nog niet is en waarom. */
'use strict';

const { ontleed, SOORTEN_DRAGER } = require('../kosten/haak');

const WERELDEN = [
  { id: 'consument', naam: 'Consumer Economy', dragers: ['lid'],
    factureerbaar: true,
    grond: 'Een particulier heeft een pas of een gratis account; wat hij kost weet RTG, wat hij betaalt staat in kern/kosten/beleidkaart.js.' },
  { id: 'commercieel', naam: 'Commercial Economy', dragers: ['zaak'],
    factureerbaar: true,
    grond: 'Een onderneming heeft een leverancierscontract. Verbruik dat daarbuiten valt is doorbelastbaar.' },
  { id: 'rtg-intern', naam: 'RTG Internal Economy', dragers: ['huis'],
    factureerbaar: false,
    grond: 'RTG zelf. Verbruik zonder eigenaar hoort hier, en deze wereld draagt de nota\'s van de infrastructuur.' },
  { id: 'rtfoundation', naam: 'RTFoundation Economy', dragers: ['gezin'],
    factureerbaar: false,
    grond: 'De stichting is een eigen rechtspersoon met een eigen vermogen (kern/rtfos/geld.js). Een gezin krijgt nooit een rekening; de stichting betaalt uit haar eigen begroting.' }
];

const OP_ID = new Map(WERELDEN.map(w => [w.id, w]));
/* Van dragersoort naar wereld. Afgeleid uit de tabel hierboven en niet als
   tweede lijstje ingetikt: twee plekken die hetzelfde bedoelen lopen uiteen, en
   dan zegt de firewall iets anders dan het overzicht over dezelfde gebruiker. */
const OP_DRAGER = new Map();
for (const w of WERELDEN) for (const d of w.dragers) {
  if (OP_DRAGER.has(d)) throw new Error('economie: dragersoort "' + d + '" hoort bij twee werelden; dan is er geen grens.');
  OP_DRAGER.set(d, w.id);
}

/* ELKE DRAGERSOORT HOORT BIJ PRECIES EEN WERELD, en dat wordt hier bij het laden
   nagerekend in plaats van bij het gebruiken opgevangen.

   Hier stond een terugval: een onbekende soort viel op 'rtg-intern' terug, de
   wereld die niets kan factureren. Verdedigbaar, en onbereikbaar -- ./haak.js
   normaliseert onbekende soorten zelf al naar 'huis'. Een mutatie liet zien wat
   dat betekent: die regel op 'consument' zetten (de wereld die WEL factureert)
   veranderde niets en zakte nergens op. Een veiligheidsregel waarvan de zakkende
   kant niet bestaat, is geen veiligheid maar een geruststelling.

   Wat wel echt mis kan gaan is dat er ooit een dragersoort bijkomt (een
   vestiging, een voertuig, een agent) zonder dat iemand hem een wereld geeft.
   Dan valt hij stil buiten de firewall. Deze controle vangt precies dat, op het
   moment dat het gebeurt: bij het opstarten, met de naam erbij. */
for (const soort of SOORTEN_DRAGER) {
  if (!OP_DRAGER.has(soort)) {
    throw new Error('economie: dragersoort "' + soort + '" heeft geen economische wereld. ' +
      'Zet hem in kern/economie/werelden.js; zonder wereld valt hij buiten de firewall.');
  }
}

function wereldVan(drager) { return OP_DRAGER.get(ontleed(drager).soort); }

const wereld = id => OP_ID.get(String(id || '')) || null;
const alle = () => WERELDEN.map(w => Object.assign({}, w));
const factureerbaar = id => !!(OP_ID.get(String(id || '')) || {}).factureerbaar;

/* De wereld waarin de nota's van de infrastructuur binnenkomen. Eén naam en
   geen letterlijke string door de code heen, want dit is de aanname die het
   hele verdeelmodel draagt: RTG koopt de machines en verkoopt het gebruik. */
const INFRA_WERELD = 'rtg-intern';

module.exports = { WERELDEN, wereld, wereldVan, alle, factureerbaar, INFRA_WERELD };
