/* Magnaat: DE KETEN -- wie wat besloot, en wat de volgende erft.

   ./storing.js weet WAT er stuk is en wat dat de maand kost. Dit bestand weet
   WIE eraan gezeten heeft. Dat is een andere vraag met een ander leven: de
   storing verdwijnt zodra hij verholpen is, de keten hoort dan juist compleet te
   zijn -- dat is het moment waarop hij iets te vertellen heeft.

   ================== WAAROM DIT BESTAAT ==================

   Tot nu toe was een storing een TOESTAND: koeling B staat open sinds maand 104.
   Wie hem gevonden had, wie hem had doorgegeven en wie er geld aan uitgaf, stond
   nergens. Daardoor was de organisatie een verzameling losse schermen: de
   vakkracht meldde iets aan niemand, en de eigenaar zag een storing die uit de
   lucht kwam vallen.

   Met deze laag praat de organisatie via haar HANDELINGEN en niet via een chat:

     Rahul constateerde -> Rahul escaleerde -> Anna besloot -> monteur herstelde
     -> de maandrekening droeg de kosten

   Er is geen bericht voor nodig en geen scene. Wat de een deed, staat op het
   scherm van de ander -- omdat het waar is, niet omdat er een melding is
   verstuurd.

   ================== EEN LIJST, TWEE LEZINGEN ==================

   De besluiten staan op de VESTIGING (`v.besluiten`) en niet op de storing, en
   dat is met opzet: een storing wordt opgeruimd zodra hij verholpen is
   (./storing.js `ruim`), en dan zou de keten precies verdwijnen op het moment
   dat hij af is. De zaak blijft.

   Er is er dus EEN lijst, en de twee dingen die een scherm wil weten zijn er
   allebei een LEZING van en geen tweede voorraad:

     vanStoring(v, s)   de keten van DIT incident -- voor het zaakscherm
     sinds(v, maand, h) wat er sinds jouw vorige dienst besloten is, en niet
                        door jou -- de overdracht naar de volgende ploeg

   Zou de keten ook nog eens op de storing staan, dan zijn er twee waarheden die
   uiteen kunnen lopen. Dezelfde afweging als in ../loopbaan-profiel.js: een
   lezing, geen register.

   ================== WELKE LAAG DIT IS ==================

   AUDIT, en niet de andere twee (par. 0f punt 3, ./rush-nalaten.js):

     telemetrie    de STAND van de storing. Leeft op de vestiging, kent geen
                   verleden. Dat is ./storing.js.
     audit         WIE WAT BESLOOT. Dat is dit bestand: het leeft in het potje,
                   is afgekapt op LENGTE, en gaat weg als de partij weg is.
     geschiedenis  wat later nog iets over een MENS zegt. Overleeft het potje,
                   eist een tweede mens, en komt hoogstens een keer per soort.
                   Dat blijft ../loopbaan-noteren.js, en dit voedt hem niet.

   Een audit die alles bewaart is geen audit maar een bak; vandaar LENGTE. En
   een besluit dat hier landt wordt daarmee GEEN geschiedenis -- die drempel
   staat in ./rush-nalaten.js en is niet verplaatst.

   ================== EN ER STAAT EEN HANDLE IN, GEEN NAAM ==================

   `wie` is de spelersleutel en niet de codenaam. Vertalen doet het BEELD
   (../dienst-beeld.js doet het al zo), want dat is de plek waar bekend is wie er
   kijkt. Zou de naam hier al vastgelegd worden, dan draagt de audit een tweede
   kopie van iets dat de kluis beheert -- en die kopie veroudert. */
'use strict';

/* Hoeveel besluiten een zaak onthoudt. Zoals bij ./beheer.js en de dienstlog:
   ruim genoeg voor een incident dat maanden sleept, te klein om een bak te
   worden. Een koelstoring die van open naar workaround naar open naar
   gerepareerd gaat, kost er vier. */
const LENGTE = 16;

const lijst = (v) => (v.besluiten = v.besluiten || []);

/* EEN BESLUIT VASTLEGGEN. Alleen wat de VOLGENDE erft telt als besluit: iets
   dat de stand verzet (`staat`), iets dat de storing oplost (`lost`), of een
   melding die de verantwoordelijkheid verplaatst.

   `overzetten` staat er daarom NIET in, en dat is geen omissie. Wie de waar
   overzet redt wat er vanavond ligt; morgen ligt er weer wat in en de wereld is
   geen millimeter verschoven. Zou hij hier landen, dan staat de keten binnen
   drie maanden vol met dertig regels "de waar overgezet" en is de ene regel die
   ertoe doet -- wie het meldde -- niet meer te vinden. */
function noteer(v, feit) {
  if (!v || !feit || !feit.optie) return null;
  const rij = lijst(v);
  const f = { maand: feit.maand, wie: feit.wie || null, rol: feit.rol || null,
    soort: feit.soort, optie: feit.optie, deed: feit.deed || feit.optie };
  /* HET BEDRAG STAAT ER PAS ACHTERAF IN, en dat is precies het verschil met de
     knop. `gevolg` op de knop zegt "onderhoudskosten" en noemt geen getal, want
     dan verraadt de beste keuze zichzelf. Hier is het gebeurd: wat het WERKELIJK
     kostte hoort in een audit, anders is "financieel geland" een bewering. */
  if (feit.spoed > 0) f.spoed = Math.round(feit.spoed);
  rij.unshift(f);
  if (rij.length > LENGTE) rij.length = LENGTE;
  return f;
}

/* DE KETEN VAN DIT INCIDENT, oudste eerst -- want een keten lees je van voren.
   Begrensd op `sinds`: een koeling die vorig jaar al eens stuk was, is een ander
   incident dan deze, ook al heet hij hetzelfde. */
function vanStoring(v, s) {
  if (!v || !s) return [];
  return lijst(v).filter(f => f.soort === s.soort && f.maand >= s.sinds)
    .slice().reverse();
}

/* WAT ER SINDS JOUW VORIGE DIENST IS BESLOTEN, en niet door jou.

   Dit is de overdracht: je komt binnen en de wereld is verschoven terwijl je er
   niet was. Zonder `behalve` zou je je eigen besluit van gisteravond als nieuws
   terugkrijgen, en dan is een overdracht een echo. */
function sinds(v, maand, behalve) {
  if (!v) return [];
  return lijst(v).filter(f => f.maand >= maand && f.wie !== behalve)
    .slice().reverse();
}

module.exports = { LENGTE, noteer, vanStoring, sinds, lijst };
