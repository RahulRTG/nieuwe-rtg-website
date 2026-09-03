/* WELKE COLLECTIES GEEN EFFECT KUNNEN DRAGEN -- en waarom precies die.

   Los van ./effectcollecties.js omdat het het tegenovergestelde is: dat bestand
   zegt wat een collectie BETEKENT, dit zegt waarom een collectie niets kan
   betekenen. Allebei zijn ze een oordeel, maar ze schuiven om verschillende
   redenen -- de eerste groeit als iemand een collectie nakijkt, de tweede alleen
   als er iets fundamenteels aan een collectie verandert.

   Ze staan hier ook omdat ze de duurste lessen van deze laag dragen: allebei de
   lijsten komen uit een fout die echt is gemaakt, en allebei de fouten zagen er
   bij het schrijven volkomen redelijk uit. */
'use strict';

/* VASTLEGGING IS GEEN EFFECT, en dit stond hier eerst wél -- met schade.

   `securityLog`, `commandJournaal`, `kantoorAudit` en `supplierActivity` waren
   ingedeeld als BEVEILIGING_VERZWAKKEN en SCHRIJVEN_ANDERMANS. Dat leest logisch
   ("het spoor waarop een incident wordt uitgezocht") en het is fout: een
   append-only spoor VERZWAKT niets, het legt vast. En omdat vrijwel elke
   geauditeerde route erin schrijft, kreeg /api/adres/zoek -- een adres opzoeken --
   het effect BEVEILIGING_VERZWAKKEN en viel hij dicht.

   Een classificatie die van de AUDIT een gevaar maakt, straft precies de routes
   die hun werk netjes noteren. scripts/idemproef-route.js wist dit al en noemt
   deze vier met naam: "vastlegging (geldt niet als werk)". Die lijst is hier
   overgenomen als een verbod, zodat niemand ze opnieuw indeelt.

   WAT DIT NIET BETEKENT: dat je ongestraft in het journaal mag schrijven. De
   INTEGRITEIT ervan is een echt belang -- daar hangt kern/incidentcontrole-
   bescherm.js zijn zegel aan. Maar dat is een eigenschap van de KETEN en niet
   van elke route die er een regel bij zet. Wie het journaal wil beschermen,
   beschermt de keten en niet iedereen die hem gebruikt. */
const VASTLEGGING = Object.freeze(['securityLog', 'commandJournaal', 'kantoorAudit', 'supplierActivity']);

/* EN EEN GRABBELTON IS OOK GEEN EFFECT. `techniek` stond hier als
   BEVEILIGING_VERZWAKKEN -- "de schakelaars, zekeringen en incidentstand" -- en
   dat klopt voor een deel van wat er in zit. Maar db.data.techniek is een BAK:
   vier onverwante padfamilies schrijven erin (/api/adres, /api/command,
   /api/techniek, /api/doos), en de proef ziet alleen de naam op het hoogste
   niveau. Een adres opzoeken kreeg daardoor het effect BEVEILIGING_VERZWAKKEN
   en viel dicht.

   DE MEETREGEL DIE ERUIT VOLGT: een collectie kan alleen een effect dragen als
   IEDEREEN die erin schrijft dat effect heeft. Wordt zij door onverwante
   families geraakt, dan zegt haar naam te weinig. ISOLATIEPROEF.json meet die
   spreiding per ingedeelde collectie, zodat de volgende die er een bij zet ziet
   waar hij aan begint.

   De schakelaars zijn hierdoor NIET onbeschermd: /api/techniek/ draagt een
   VERKLAARDE regel in ./effectregister.js, en dat is de juiste plek -- daar
   hangt het effect aan het PAD en niet aan een gedeelde bak. */
const GRABBELTON = Object.freeze(['techniek']);

module.exports = { VASTLEGGING, GRABBELTON };
