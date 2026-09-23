'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* EEN SLEUTELBESTAND IN DE DATAMAP: lezen, of als EERSTE publiceren.

   Deze vorm woonde in server/lib/zegel.js, en daar alleen. Dezelfde race stond
   op vier andere plekken (de identiteitskluis en de tokenondertekening in
   server/accounts, lifestyle.key, foundation.key en geheugen.key), en op 23
   september 2026 viel er in CI opnieuw een server om in
   test/eigenaar-wedloop.test.js -- nu met `RangeError: Invalid key length` bij
   het versleutelen, omdat een tweede proces vault.key las terwijl het eerste
   hem nog aan het schrijven was. Een reparatie die op een plek woont en op vijf
   nodig is, is geen reparatie maar een uitzondering. test/sleutel-wedloop.test.js
   houdt vast dat elke sleutelschrijver onder server/ hierlangs gaat.

   EEN SLEUTEL PUBLICEREN, EN DAT IS IETS ANDERS DAN HEM SCHRIJVEN.

   In server/lib/zegel.js stond `existsSync` gevolgd door `writeFileSync`. Dat is kijken-dan-doen
   over PROCESSEN, en in de vloot (server/vloot.js) komen er vier tegelijk op
   dezelfde datamap:

     1 proces A: existsSync -> false, begint te schrijven
     2 proces B: existsSync -> TRUE  (het bestand bestaat, de inhoud nog niet)
     3 proces B: leest leeg, en createPrivateKey gooit
        error:1E08010C:DECODER routines::unsupported

   Dat is geen hypothese: op 15 september 2026 viel er in CI een servergroep op
   om, in test/eigenaar-wedloop.test.js -- een toets die over het eigenaars-
   ACCOUNT gaat en deze fout dus bij toeval vond. test/zegel-wedloop.test.js
   lokt hem gericht uit.

   WAAROM link() EN NIET rename(). De voor de hand liggende reparatie is
   volledig naar een tijdelijk bestand schrijven en dat hernoemen. Die is wel
   atomair, maar de LAATSTE schrijver wint -- en dan draagt elk proces een
   andere sleutel en verifieert het ene de tokens van het andere niet meer. Er
   valt dan niets meer om; er klopt alleen niets meer, en dat faalt stiller dan
   de wedloop zelf. link() faalt met EEXIST in plaats van te overschrijven, dus
   de EERSTE schrijver wint en iedereen leest daarna dezelfde sleutel.

   EN HIJ REGENEREERT NOOIT STIL. Staat er iets dat niet te lezen is, dan gooit
   deze functie met de naam van het bestand erbij. Een onleesbare sleutel
   vervangen zou elk bestaand token ongeldig maken zonder dat iemand erom
   vroeg -- dat is een besluit van een mens, niet van een opstartpad. */
function publiceer(pad, inhoud) {
  /* De datamap kan nog niet bestaan: een verse installatie, of een toets die de
     sleutel opvraagt voordat een server de map heeft gemaakt. In CI zakte
     test/pragmavolgorde.test.js daarop zodra de scherfindeling veranderde --
     dan was er toevallig nog geen eerdere toets die de map had aangemaakt. */
  fs.mkdirSync(path.dirname(pad), { recursive: true });
  const tmp = pad + '.' + process.pid + '.tmp';
  /* DE MAP HOORT ER TE ZIJN, OOK ALS NIEMAND HEM AL MAAKTE. De oude schrijvers
     deden mkdir voordat ze schreven; bij de verhuizing hierheen viel dat weg, en
     dat zag niemand zolang er altijd al een server was opgestart. Een aanroeper
     buiten init() (test/pragmavolgorde.test.js op een verse checkout) kreeg dan
     ENOENT op het tijdelijke bestand. mkdir met recursive is zelf veilig tegen
     een wedloop: een tweede proces dat hem ook maakt, krijgt geen fout. */
  fs.mkdirSync(path.dirname(pad), { recursive: true });
  fs.writeFileSync(tmp, inhoud, { mode: 0o600 });
  try {
    fs.linkSync(tmp, pad);
  } catch (e) {
    /* EEXIST is de normale uitkomst van een verloren wedloop: een ander proces
       was ons voor, en we lezen hieronder gewoon zijn sleutel. Elke andere fout
       betekent dat er NIET atomair gepubliceerd kon worden, en dan hoort het
       opstarten hardop te stoppen: stil terugvallen op een gewone schrijfactie
       zet de wedloop terug die deze functie juist weghaalt. */
    if (e.code !== 'EEXIST') {
      try { fs.unlinkSync(tmp); } catch (e2) { /* opruimen mag de fout niet maskeren */ }
      throw new Error('de sleutel ' + path.basename(pad) + ' kon niet atomair worden gepubliceerd: ' +
        (e && e.message || e));
    }
  }
  try { fs.unlinkSync(tmp); } catch (e) { /* het tijdelijke bestand is klaar met zijn werk */ }
}

/* Lees wat er staat, of publiceer en lees dan wat er staat -- want bij een
   verloren wedloop is dat de sleutel van een ander proces en niet de onze. */
function leesOfPubliceer(pad, maak, lees) {
  if (!fs.existsSync(pad)) publiceer(pad, maak());
  return lees(pad);
}

/* Een willekeurige sleutel van `lengte` bytes. Een bestaand bestand met een
   andere lengte is geen sleutel, en wordt NOOIT stil vervangen: de gegevens die
   met de oude zijn versleuteld, zijn dan voor altijd weg. Dat is een besluit van
   een mens en niet van een opstartpad. */
function sleutel(pad, lengte) {
  const n = lengte || 32;
  const k = leesOfPubliceer(pad, () => crypto.randomBytes(n), (p) => fs.readFileSync(p));
  if (k.length !== n) {
    throw new Error('het sleutelbestand ' + path.basename(pad) + ' bevat ' + k.length + ' bytes in plaats van ' + n +
      '. Het wordt met opzet NIET vervangen: dan is alles wat ermee versleuteld is onleesbaar. ' +
      'Zet het terug uit een reservekopie, of verwijder het bewust om een nieuwe sleutel te laten maken.');
  }
  return k;
}

/* De sleutels van de identiteitskluis en de tokenondertekening: eerst uit de
   omgeving (een gedeelde secret manager, want meerdere instances MOETEN dezelfde
   sleutel dragen), en pas als terugval uit de datamap -- gelezen of als eerste
   gepubliceerd. Dit woonde als loadKey in server/accounts/index.js; hier is het
   beproefbaar zonder een database op te zetten. */
function uitOmgevingOfBestand(pad, omgevingsnaam) {
  const env = omgevingsnaam ? process.env[omgevingsnaam] : null;
  if (env) return /^[0-9a-fA-F]{64}$/.test(env) ? Buffer.from(env, 'hex') : crypto.createHash('sha256').update(env).digest();
  return sleutel(pad, 32);
}

module.exports = { publiceer, leesOfPubliceer, sleutel, uitOmgevingOfBestand };
