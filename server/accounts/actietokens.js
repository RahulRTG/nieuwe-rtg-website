/* Accounts, deel "actietokens": de DOEL-GEBONDEN tokens (2FA-bewijs 'inlog2',
   'tech2' en 'werk2', e-mailbevestiging 'verify-email', 'mailwissel',
   'sso-overdracht'). Afgesplitst uit ./tokens.js -- niet alleen voor de
   modulegrootte, maar omdat een actietoken een andere KLASSE is dan een
   sessietoken en dat verschil nu ook in de bestandsindeling staat
   (RTG-V1-RELEASE blocker 1).

   DOMEINSCHEIDING: een actietoken tekent met een per-DOEL afgeleide sleutel
   (kluis.sleutelVoor('actie:'+purpose)), niet met de sessiesleutel
   (kluis.sign = S.SECRET). Zo accepteert de sessieverifier (./tokens.js
   verifyToken, op S.SECRET) een actietoken nooit, en verifyActionToken voor doel
   A nooit een token voor doel B. De factory krijgt van ./tokens de gedeelde
   onderdelen (getUserById, de strikte tokenvorm, de intrekkingslijst), zodat er
   maar EEN opvatting bestaat van wat een token is en wanneer het is ingetrokken.

   EN ELK ACTIETOKEN VERVALT BIJ DE SESSIEGRENS, net als een sessie (RTG-V1 N12,
   besluit van de eigenaar). Wie `sessies_vanaf` zet, en waarom, staat in
   ./sessiegrens.js; bij een wachtwoordwijziging en een herstel betekent het:
   wat ik eerder uitgaf, telt niet meer. ("Sluit alle andere sessies" zet de
   grens niet en raakt een actietoken dus ook niet.) De herkeuring liet zien
   wat er gebeurde zolang dit niet gold:
   een inlog2- of tech2-bewijs van VOOR een wachtwoordwijziging gaf erna, met een
   geldige code of herstelcode, gewoon een werkend token. Wie het oude wachtwoord
   kende, kwam dus binnen op een bewijs dat hij vlak voor de wijziging had
   gehaald. Per doel:

     inlog2, tech2,     het bewijs van stap een is het OUDE wachtwoord; een
     werk2              tweede factor maakt dat niet weer geldig;
     sso-overdracht     een overdracht van voor de grens hoort bij een inlog
                        die de grens juist ongedaan maakte;
     mailwissel         wie zijn wachtwoord wijzigt OMDAT er iemand meekeek,
                        wil niet dat diens openstaande adreswissel nog doorgaat;
     verify-email       de minst gevaarlijke, en toch mee: de link bevestigt
                        een adres namens het account, en de grens kent geen
                        uitzondering per doel. Een nieuwe link vraagt het lid
                        zelf aan (/api/auth/resend).

   De vergelijking zelf staat in ./sessiegrens.js, dezelfde als voor een
   sessietoken: een opvatting van de grens voor sessie- en actietokens.

   EN EEN UITGEZET ACCOUNT HEEFT GEEN GELDIG ACTIETOKEN (RTG-V1 N20, besluit van
   de eigenaar), met dezelfde opvatting van "uitgezet" als een sessie
   (./sessiegrens.js uitgezet). De herkeuring van N12 zag dat alle vijf de doelen
   bij een account op non-actief de gebruiker teruggaven. Per doel:

     inlog2, tech2,     het sessietoken dat de deur daarna uitgaf, viel al bij
     sso-overdracht     verifyToken af, maar de deur meldde succes, verbruikte
                        bij inlog2 en tech2 de code (een herstelcode is dan
                        weg) en legde bij inlog2 en sso een inlog vast; nu 401
                        en blijft de code heel;
     mailwissel         een openstaande wissel zette het inlogadres van een
                        uit dienst gemeld account om;
     verify-email       de link bevestigde een adres namens dat account.

   Geen van de vijf is een herstelweg: het wachtwoordherstel loopt over een
   gehashte code (./herstel.js) en niet over een actietoken. Een geweigerd token
   wordt niet ingetrokken: zet de organisatie het account weer aan, dan werkt
   het tot zijn eigen exp, zoals een sessietoken. "Sluit alle andere sessies"
   blijft hier bewust buiten (RTG-V1 N21). */
'use strict';
const crypto = require('crypto');
const kluis = require('./kluis');
const { veiligGelijk } = require('../kern/util');
const { voorGrens, uitgezet } = require('./sessiegrens');
const { doelGeldig } = require('./tokenvorm');

/* DE OUDE VORM: EEN TOKEN ZONDER UITGIFTEMOMENT.

   Het lichaam was `id.doel.exp.nonce`; het uitgiftemoment komt er als VIJFDE
   deel achter, zodat de lezer van de oude vorm niets verandert aan wat hij
   leest. Een token van voor de uitrol heeft geen vijfde deel, en wat ermee
   gebeurt is een keuze per doel, met de kosten erbij:

     DICHT voor de inlogbewijzen (inlog2, tech2, werk2, sso-overdracht). Ze
     leven vijf minuten of een minuut en zitten in een open tabblad. Werk2 is
     nieuw (N19) en had nooit een oude vorm. Weigeren kost op zijn
     hoogst een nieuwe inlog, en een bewijs van een tweede stap waarvan niet
     vast te stellen is of het van voor of na de grens is, bewijst niets. Draaien
     oude en nieuwe knopen tijdens een uitrol naast elkaar (het trio), dan kan
     dat in dat venster meer dan een inlog kosten: rol niet gemengd uit.

     ALS MOMENT 0 voor de mailboxlinks (verify-email drie dagen, mailwissel een
     etmaal), precies zoals ./tokens.js een sessietoken zonder uitgiftemoment
     behandelt: de link valt af zodra er ooit een grens is gezet en werkt
     anders tot zijn eigen exp. Dicht zou elke link die rond de uitrol in een
     mailbox ligt breken, zonder dat het lid kan zien waarom, terwijl moment 0
     de grens al volledig handhaaft: elke grens die NA de uitgifte is gezet,
     ligt boven 0. Er komt dus geen tweede grens (een uitroldatum) bij.

   Een doel dat hier niet staat, valt onder dicht: een nieuw doel geeft vanaf
   de eerste dag een uitgiftemoment uit en heeft geen oude vorm te dragen. */
const OUDE_VORM_ALS_MOMENT_NUL = new Set(['verify-email', 'mailwissel']);

function maakActieTokens({ getUserById, strikt, isIngetrokken }) {
  function actieSleutel(purpose) { return kluis.sleutelVoor('actie:' + String(purpose || '')); }

  function issueActionToken(userId, purpose, ttlMs) {
    /* Een doel dat zelf een getal is of een punt bevat, kan voor een tijdveld
       van een sessietoken doorgaan: nooit uitgeven (./tokenvorm.js). */
    if (!doelGeldig(purpose)) throw new Error('ongeldig doel voor een actietoken');
    /* De nonce maakt twee uitgiftes in dezelfde ms afzonderlijk intrekbaar. Het
       uitgiftemoment komt van dezelfde klok als dat van een sessietoken. */
    const nu = Date.now();
    const body = userId + '.' + purpose + '.' + (nu + ttlMs) + '.' +
      crypto.randomBytes(16).toString('base64url') + '.' + nu;
    const sig = kluis.signMet(actieSleutel(purpose), body);
    if (!sig) throw new Error('issueActionToken: geen afgeleide sleutel');
    return Buffer.from(body).toString('base64url') + '.' + sig;
  }

  function verifyActionToken(token, purpose) {
    token = strikt(token);   // zelfde strikte vorm als een sessietoken
    if (!token) return null;
    try {
      const [b64, sig] = String(token).split('.');
      if (!b64 || !sig) return null;
      const body = Buffer.from(b64, 'base64url').toString();
      // controleer met de per-doel sleutel: een sessie- of ander-doel-token valt af
      const verwacht = kluis.signMet(actieSleutel(purpose), body);
      if (!verwacht || !veiligGelijk(verwacht, sig)) return null;
      const [id, p, exp, , uitgegeven] = body.split('.');
      if (p !== purpose || !Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return null;
      /* trekInActie is anders een gebaar: het token staat dan wel op de lijst,
         maar niemand kijkt ernaar (aanvalsronde 2, punt 14). */
      if (isIngetrokken(token)) return null;
      if (uitgegeven === undefined && !OUDE_VORM_ALS_MOMENT_NUL.has(purpose)) return null;
      const u = getUserById(Number(id));
      if (voorGrens(u, uitgegeven)) return null;
      /* En een uitgezet account, net als bij een sessietoken (RTG-V1 N20). */
      if (uitgezet(u)) return null;
      return u;
    } catch (e) { return null; }
  }

  return { issueActionToken, verifyActionToken };
}

module.exports = { maakActieTokens };
