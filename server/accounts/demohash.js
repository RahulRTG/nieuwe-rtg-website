/* DE DEMOSEED, EN WAAROM DIE GOEDKOPER MAG HASHEN.

   Afgesplitst uit ./wachtwoord.js, dat door deze uitleg vlak onder de 10 kB van
   keuringsregel 13 kwam. De naad is echt: daar staat wat een wachtwoord KOST en
   hoe een hash eruitziet, hier staat de ene uitzondering daarop, met de reden en
   de grendels eromheen. Een uitzondering hoort een eigen huis te hebben, zodat
   niemand hem per ongeluk voor de regel aanziet.
   De demostand zet bij een verse database 183 personeelsrijen neer (71 zaken,
   server/kern/staffseed.js en staffseed2.js). Elke rij kreeg een scrypt-hash op
   VOLLE kosten, synchroon, VOOR `listen`. Dat is 183 x ~115 ms = ruim twintig
   seconden waarin de server op 100% draait en niets aanneemt.

   Dat was geen theorie. test/zaakdoos.test.js wacht twintig seconden op
   /api/health en zakte op alle tien zijn toetsen met "kwam niet op"; nagemeten
   startte dezelfde server op N=16384 in 10 s en op N=32768 in 21 s. Het
   verhogen van de kosten -- op zichzelf goed -- duwde de opstart over die grens
   heen. En omdat elke toets een VERSE datamap krijgt, betaalde de hele
   toetsenreeks die twintig seconden per serverstart opnieuw.

   Het symptoom repareren zou zijn: de toets langer laten wachten. De oorzaak is
   dat er hier niets te beschermen valt. Deze wachtwoorden zijn de pincodes
   '1234' en '5678', ze staan LETTERLIJK in de repo, en een sleutelafleiding
   beschermt een geheim -- hier is er geen. Volle kosten betalen voor een
   openbare waarde is werk zonder opbrengst.

   DRIE GRENDELS, zodat dit geen achterdeur wordt:
     1. deze functie WEIGERT buiten de demostand. Geen RTG_DEMO=1, geen hash.
     2. de demostand is in productie al verboden (server/config/productie-
        lokaal.js weigert te starten met RTG_DEMO=1), dus deze hashes kunnen
        daar niet bestaan.
     3. de hash schrijft zijn eigen kosten mee, dus moetVernieuwen() ziet
        N < SCRYPT_N en waardeert hem op bij de eerste echte inlog.

   DEMO_N staat op de ondergrens die leesHash accepteert (1024): lager zou geen
   geldige hash meer zijn, en de rommel-faalt-dicht-regel hierboven zou hem
   terecht weigeren. */
'use strict';
const crypto = require('crypto');

const DEMO_N = 1024;

/* Een FABRIEK en geen los require, met opzet. De kostenparameters en het
   hashformaat wonen in ./wachtwoord.js, en die haalt deze module op -- zou het
   omgekeerd ook zo zijn, dan hadden we een kringverwijzing. Ze hier overschrijven
   zou nog erger zijn: twee plekken die weten hoe een hash eruitziet, en de
   zwakste wint zodra iemand er een gebruikt (LAT.md regel 4). */
module.exports = ({ scryptOpties, schrijfHash, SCRYPT_R, SCRYPT_P }) => {
  function hashDemoSync(pw) {
    if (process.env.RTG_DEMO !== '1')
      throw new Error('hashDemoSync bestaat alleen in de demostand (RTG_DEMO=1); gebruik hashPassword.');
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(pw), salt, 64, scryptOpties(DEMO_N, SCRYPT_R, SCRYPT_P));
    return schrijfHash(salt, hash, DEMO_N, SCRYPT_R, SCRYPT_P);
  }
  return { DEMO_N, hashDemoSync };
};
