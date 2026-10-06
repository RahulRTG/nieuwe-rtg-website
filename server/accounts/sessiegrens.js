/* Accounts, deel "sessiegrens": DE ENE OPVATTING VAN `sessies_vanaf`.

   Een wachtwoordwijziging (./users.js zetWachtwoordHash, ./herstel.js), een
   herstel en "alle sessies sluiten" (./users.js zetSessiegrens) zetten per
   account een moment. De betekenis is een zin: WAT IK EERDER UITGAF, TELT NIET
   MEER. Dat geldt voor een sessietoken (./tokens.js) en sinds RTG-V1 N12 ook
   voor een actietoken (./actietokens.js).

   WAAROM HIER EN NIET INLINE. De vergelijking stond in verifyToken. Een tweede
   kopie in de actietokens zou op een dag een ander antwoord geven op "vanaf
   wanneer telt een token niet meer" (LAT.md regel 4), en dat merkt niemand
   tot een token na een wachtwoordwijziging blijft werken.

   ONTBREEKT HET UITGIFTEMOMENT OF IS HET GEEN GETAL, dan geldt het als moment
   0: het token valt af zodra er ooit een grens is gezet. Dat is de kant
   waarheen een grens hoort te falen. Zonder die terugval maakt NaN elke
   vergelijking false, en dan laat de grens het token juist DOOR. */
'use strict';

function voorGrens(u, uitgegeven) {
  if (!u) return false;
  const t = Number(uitgegeven);
  return Number(u.sessies_vanaf || 0) > (Number.isFinite(t) ? t : 0);
}

module.exports = { voorGrens };
