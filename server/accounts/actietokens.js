/* Accounts, deel "actietokens": de DOEL-GEBONDEN tokens (2FA-bewijs 'inlog2'
   en 'tech2', e-mailbevestiging 'verify-email', 'mailwissel',
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
   besluit van de eigenaar). Een wachtwoordwijziging, een herstel of "alle
   sessies sluiten" zet `sessies_vanaf`, en dat betekent: wat ik eerder uitgaf,
   telt niet meer. De herkeuring liet zien wat er gebeurde zolang dit niet gold:
   een inlog2- of tech2-bewijs van VOOR een wachtwoordwijziging gaf erna, met een
   geldige code of herstelcode, gewoon een werkend token. Wie het oude wachtwoord
   kende, kwam dus binnen op een bewijs dat hij vlak voor de wijziging had
   gehaald. Per doel:

     inlog2, tech2      het bewijs van stap een is het OUDE wachtwoord; een
                        tweede factor maakt dat niet weer geldig;
     sso-overdracht     een overdracht van voor de grens hoort bij een inlog
                        die de grens juist ongedaan maakte;
     mailwissel         wie zijn wachtwoord wijzigt OMDAT er iemand meekeek,
                        wil niet dat diens openstaande adreswissel nog doorgaat;
     verify-email       de minst gevaarlijke, en toch mee: de link bevestigt
                        een adres namens het account, en "wat ik eerder uitgaf,
                        telt niet meer" kent geen uitzondering per doel. Een
                        nieuwe link vraagt het lid zelf aan (/api/auth/resend).

   De vergelijking zelf staat in ./sessiegrens.js, dezelfde als voor een
   sessietoken: er is maar EEN opvatting van de grens. */
'use strict';
const crypto = require('crypto');
const kluis = require('./kluis');
const { veiligGelijk } = require('../kern/util');
const { voorGrens } = require('./sessiegrens');

/* DE OUDE VORM: EEN TOKEN ZONDER UITGIFTEMOMENT.

   Het lichaam was `id.doel.exp.nonce`; het uitgiftemoment komt er als VIJFDE
   deel achter, zodat de lezer van de oude vorm niets verandert aan wat hij
   leest. Een token van voor de uitrol heeft geen vijfde deel, en wat ermee
   gebeurt is een keuze per doel, met de kosten erbij:

     DICHT voor de inlogbewijzen (inlog2, tech2, sso-overdracht). Ze leven vijf
     minuten of een minuut en zitten in een open tabblad. Weigeren kost op zijn
     hoogst een nieuwe inlog, en een bewijs van een tweede stap waarvan niet
     vast te stellen is of het van voor of na de grens is, bewijst niets.

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
      return u;
    } catch (e) { return null; }
  }

  return { issueActionToken, verifyActionToken };
}

module.exports = { maakActieTokens };
