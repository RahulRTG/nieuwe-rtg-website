/* ============================================================================
   DE LADDER ONDER EEN NEIGING -- hoe hard is "dit lid houdt van Japans eten"?

   DIT BESTAND VOEGT GEEN ZESDE ZEKERHEIDSLADDER TOE, en dat is de eerste zin
   omdat het de scherpste grens is die deze laag raakt. AFSPRAAK.md zegt het
   zonder marge: er komt geen zesde uitkomst- of zekerheidsladder bij. Dit huis
   heeft er al vijf (GEZAGSNOEMER.json telt 5 schalen op 21 treden,
   CONTROLPLANE.md acht uitkomsten, kern/identiteit/vertrouwen.js vijf
   assurance-standen, de vervalstaten, de schaduwmodi).

   Dus wordt de BESTAANDE ladder van BESTUUR.md hergebruikt, letterlijk:

       onbekend -> vermoed -> gemeten -> bewezen

   Diezelfde vier staan al in kern/objectlaag/pagina.js, kern/command/
   gezondheid.js, kern/kosten/soorten.js, kern/identiteit/sessievelden.js en
   kern/stuur/gevolgcontract/woorden.js. Ze betekenen hier hetzelfde als daar:
   hoe goed is deze bewering onderbouwd. Dat een van die vijf plekken de ladder
   nog een keer declareert is een bestaande dubbeling en geen reden om er een
   zesde bij te zetten.

   EN ER KOMT GEEN `zekerheid: 0.94`. Het voorstel vroeg om een confidence per
   voorkeur, en dat is precies wat INT-04 verbiedt: `confidence` is hier niet
   meetbaar, en vermenigvuldigen met een verzonnen getal is erger dan het
   weglaten. Een kommagetal suggereert een meting die niemand heeft gedaan --
   0,94 tegenover 0,91 is een verschil dat nergens vandaan komt. Een trede is
   wel te verantwoorden, want elke trede heeft een GROND die je kunt navertellen.
   `neigingen()` geeft daarom een graad en nooit een score.

   ------------------------------------------------------------------------
   DRIE GRONDEN, EN DE TREDE VOLGT UIT DE GROND

     gezegd     het lid heeft het met zoveel woorden gezegd of aangetikt: "ik
                eet geen vlees", of de keuze uit de openingsvraag. Dit is het
                sterkste bewijs dat voor een voorkeur BESTAAT -- een voorkeur
                wordt immers geconstitueerd door wat iemand wil, niet door wat
                wij over hem afleiden. Trede: bewezen.
     gekozen    het lid heeft het meermaals GEKOZEN zonder het te zeggen (drie
                keer een Japans restaurant). Dat is geteld gedrag. Trede:
                gemeten vanaf DREMPEL keer, daaronder vermoed.
     afgeleid   een enkele gebeurtenis, of een gevolgtrekking. Trede: vermoed.

   ------------------------------------------------------------------------
   DE TIJD HAALT TREDEN WEG, EN HIJ RAAKT NIET ALLES

   Het probleem dat het voorstel terecht aanwijst: je verleden blijft je
   toekomst bepalen. Een interesse die twaalf maanden nergens terugkomt, hoort
   niet meer even zwaar te wegen.

   Maar verval mag NIET over de hele linie, en dat is het belangrijkste besluit
   in dit bestand. Wat het lid ZELF heeft gezegd, vervalt niet door tijd. RTG
   vergeet niet wat je hem verteld hebt omdat er een half jaar voorbij is; hij
   vergeet wat hij zelf heeft GERADEN. Alleen het lid haalt een uitspraak weg,
   en daar is ./neiging.js `vergeet()` voor.

   Draai je dat om, dan krijg je het gedrag waar mensen terecht boos van worden:
   je vertelt een systeem eenmalig dat je geen alcohol drinkt, en een half jaar
   later staat de wijnarrangement-suggestie er weer, omdat een teller is
   afgelopen. Dat is geen dataminimalisatie maar vergeetachtigheid op de
   verkeerde helft.

   De twee termijnen zijn BESLUITEN met een reden, geen metingen -- en dat staat
   er liever zo dan als een getal dat wetenschappelijk oogt:

     AFGELEID_DAGEN 90   een enkele gebeurtenis is het dunste wat we hebben.
                         Komt hij een kwartaal lang niet terug, dan was het een
                         voorval en geen patroon, en zakt hij naar onbekend --
                         dat wil zeggen: hij telt niet meer mee.
     GEKOZEN_DAGEN 180   geteld gedrag mag een seizoenswisseling overleven. Wie
                         's winters niet naar het strand gaat, houdt in maart
                         nog steeds van het strand. Twee seizoenen zonder
                         herhaling is wel een signaal, en dan zakt hij een trede.

   ------------------------------------------------------------------------
   WAT DIT BESTAND NIET DOET

   - Het leest geen db en kent geen lid. Alles hier is puur, zodat de regels te
     beproeven zijn zonder server -- en zodat er geen tweede plek ontstaat die
     iets over een mens weet.
   - Het beslist niets over ZICHTBAARHEID. Welke trede genoeg is om iets op een
     scherm te laten zien, hoort bij de lezer en niet bij de ladder; een ladder
     die ook de drempel zet, wordt stilletjes beleid. */
'use strict';

/* De ladder van BESTUUR.md, oplopend. Hergebruikt en niet uitgebreid. */
const GRADEN = Object.freeze(['onbekend', 'vermoed', 'gemeten', 'bewezen']);

/* De gesloten lijst gronden. Gesloten, want een vierde grond zonder trede is
   precies hoe een ladder stilletjes een vijfde trede krijgt. */
const GRONDEN = Object.freeze(['gezegd', 'gekozen', 'afgeleid']);

/* Vanaf hoeveel keer is herhaald gedrag GEMETEN in plaats van VERMOED. Drie,
   want twee is een toeval dat zich een keer herhaalt en pas de derde keer een
   gewoonte wordt. Ook dit is een besluit en geen meting. */
const DREMPEL = 3;

const AFGELEID_DAGEN = 90;
const GEKOZEN_DAGEN = 180;
const DAG = 24 * 60 * 60 * 1000;

const trede = graad => GRADEN.indexOf(graad);
const zakken = (graad, stappen) => GRADEN[Math.max(0, trede(graad) - stappen)];

/* De trede die alleen uit de GROND volgt, nog zonder tijd. */
function beginGraad(grond, aantal) {
  if (grond === 'gezegd') return 'bewezen';
  if (grond === 'gekozen') return (Number(aantal) || 1) >= DREMPEL ? 'gemeten' : 'vermoed';
  if (grond === 'afgeleid') return 'vermoed';
  /* Een onbekende grond levert geen middenklasse op maar de laagste trede. Wie
     dat omdraait, laat een tikfout in een aanroeper een bewering versterken. */
  return 'onbekend';
}

/* Hoeveel treden de tijd weghaalt. `gezegd` staat er met opzet niet in. */
function tijdverval(grond, laatst, nu) {
  if (grond === 'gezegd') return 0;
  const t = Date.parse(laatst), n = Date.parse(nu);
  /* Een onleesbare datum is geen reden om te laten zakken: dan weten we het
     niet, en niet-weten mag nooit als bewijs tegen het lid werken. */
  if (!Number.isFinite(t) || !Number.isFinite(n) || n < t) return 0;
  const dagen = (n - t) / DAG;
  const venster = grond === 'afgeleid' ? AFGELEID_DAGEN : GEKOZEN_DAGEN;
  return Math.floor(dagen / venster);
}

/* DE ENIGE PLEK WAAR EEN GRAAD ONTSTAAT. Alles loopt hierdoorheen, zodat de
   regel "gezegd vervalt niet" op EEN plek staat en niet bij elke lezer. */
function graadVan({ grond, aantal, laatst, nu }) {
  const begin = beginGraad(grond, aantal);
  if (begin === 'onbekend') return 'onbekend';
  return zakken(begin, tijdverval(grond, laatst, nu));
}

/* Telt deze neiging nog mee? `onbekend` betekent hier: hij heeft zichzelf
   opgeheven. Hij blijft wel STAAN -- zie ./neiging.js, want stil verdwijnen is
   iets anders dan zichtbaar niet meer meetellen. */
const telt = graad => trede(graad) > trede('onbekend');

module.exports = { GRADEN, GRONDEN, DREMPEL, AFGELEID_DAGEN, GEKOZEN_DAGEN,
  beginGraad, tijdverval, graadVan, telt, trede };
