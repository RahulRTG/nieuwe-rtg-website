/* HET IDEM-REGISTER, deel "tweede lid" -- de schrijfroutes waar een ANDER lid
   de uitkomst ziet: Pulse, De Salon en de concepten van RTMail.

   GEVONDEN DOOR DE TESTWERELD (18 oktober 2026). De voltooiproef liet op elk
   van deze schermen een dubbeltik of een afgebroken-en-opnieuw-verstuurd
   verzoek lopen, en zag bij de ANDERE partij twee keer hetzelfde:
     - De Salon (scripts/lib/voltooi/wereldlaag.js): een dubbeltik op
       "plaatsen" gaf twee identieke posts;
     - Pulse (scripts/lib/voltooi/pulse.js): een reactie die de client opgaf en
       opnieuw stuurde, stond er twee keer;
     - RTMail (scripts/lib/voltooi/rtmail.js): een dubbeltik op "concept
       bewaren" gaf twee concepten, en wie er een weggooide hield de tweede.
   Geen van deze routes had een verklaring, dus de idem-poort liet ze door.
   Elke regel is op de handler nagelezen.

   zelfdeVerzoek: een woordelijk gelijk verzoek binnen het venster is een
   dubbeltik -- dezelfde tekst plaatsen, dezelfde reactie, hetzelfde concept,
   dezelfde post weghalen, dezelfde stemming zetten.
   nietIdempotent: waarderen en bewaren op Pulse zijn een SCHAKELAAR (een tik
   zet aan, de volgende tik zet uit). Twee tikken zijn daar twee handelingen;
   ze ontdubbelen zou de tweede tik stil opslikken. Het Pulse-bericht zelf
   heeft daarnaast al een rem van tien seconden per lid. */
'use strict';

const zelfde = { zelfdeVerzoek: true };
const SLEUTELS = {
  'POST /api/salon/plaats': zelfde,
  'POST /api/salon/reageer': zelfde,
  'POST /api/salon/weg': zelfde,
  'POST /api/member/pulse/post': zelfde,
  'POST /api/member/pulse/reactie': zelfde,
  'POST /api/member/pulse/weg': zelfde,
  'POST /api/member/wauw/stemming/zet': zelfde,
  'POST /api/member/pulse/like': { nietIdempotent: true,
    waarom: 'een waardering is een schakelaar: de tweede tik haalt hem weg, en dat is een tweede handeling en geen dubbeltik' },
  'POST /api/member/pulse/bewaar': { nietIdempotent: true,
    waarom: 'bewaren is een schakelaar: de tweede tik haalt het bericht van de plank, en dat is een tweede handeling en geen dubbeltik' },
  'POST /api/member/rtmail/concept/bewaar': zelfde,
  'POST /api/member/rtmail/concept/weg': zelfde,
  'POST /api/member/rtmail/concept/verstuur': zelfde
};

module.exports = { SLEUTELS };
