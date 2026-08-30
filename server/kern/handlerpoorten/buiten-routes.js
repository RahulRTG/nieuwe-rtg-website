/* ============================================================================
   DE POORT PER ROUTE -- HANDGELEZEN, WAAR GEEN VORM HEM VINDT.

   Deel van ./buiten.js; zie de kop daar voor de drie soorten blindheid en voor
   het verschil met de publieke lijst. Hier alleen de routes zelf.

   Er blijft een rest waar geen enkele detectievorm bij kan, en niet door
   slordigheid: de poort staat INLINE in de handler, zonder de vorm van een
   poort. `rtf.verifieerProfiel(req.body.code, req.body.token)` krijgt geen `req`
   en geen `res` maar twee velden uit het lichaam; een vorm die dat vangt, vangt
   elke functie met twee argumenten.

   Voor die routes is er maar een eerlijke weg: iemand leest de handler en
   schrijft op wat hij ziet. Elke regel hier is gelezen op 30 augustus 2026, in
   de bewoording van die handler.
   ========================================================================== */
'use strict';

const ROUTEPOORTEN = {
  /* De gezinsprofielcontrole, inline: rtf.verifieerProfiel(code, token). */
  'POST /api/rtf/apply/chat': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'rtf.verifieerProfiel(code, token), plus de chat moet van dit profiel zijn' },
  'POST /api/rtf/apply/chat/send': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'dezelfde controle als /apply/chat' },
  'POST /api/rtf/solliciteer': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'rtf.verifieerProfiel(code, token), met een rem per IP ervoor' },
  'POST /api/rtf/talent/interesse': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'rtf.verifieerProfiel(code, token), geen gast, en 16 jaar of ouder' },
  'POST /api/rtf/talent/mijn': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'rtf.verifieerProfiel(code, token)' },

  /* De raadcode van een partner, via metPartner(). */
  'POST /api/rtf/partner/stem': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'stadsraad.vindCode(code); 404 op een onbekende raadcode' },
  'POST /api/rtf/partner/besluit-start': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'dezelfde raadcode' },
  'POST /api/rtf/partner/besluit-sluit': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'dezelfde raadcode' },

  /* Uitnodigingen en activatielinks: het geheim IS de sleutel. */
  'POST /api/foundation/school/personeel/uitnodiging/bekijk': { toegang: 'OBJECT_SCOPED', veld: 'uitnodiging',
    wat: 'zoekUitnodiging(uitnodiging); 404 op ongeldig, gebruikt of verlopen' },
  'POST /api/foundation/school/personeel/uitnodiging/accepteer': { toegang: 'OBJECT_SCOPED', veld: 'uitnodiging',
    wat: 'dezelfde uitnodiging, plus de persoon moet nog niet actief zijn' },
  'POST /api/foundation/school/personeel/inlog/accepteer': { toegang: 'OBJECT_SCOPED', veld: 'inlog',
    wat: 'het inloggeheim SCHOOL.hash; de school komt uit het eerste deel' },
  'POST /api/foundation/school/school/activeren': { toegang: 'OBJECT_SCOPED', veld: 'activatie',
    wat: 'de activatiecode CODE.hash uit de registratiebalie' },
  'POST /api/foundation/school/personeel/inloglink': { toegang: 'OBJECT_SCOPED', veld: 'schoolCode',
    wat: 'schoolCode plus een e-mailadres dat in die school bestaat; de link gaat naar de schoolmail' },

  /* Apparaten: de sleutel zit in een eigen kop of in het lichaam. */
  'POST /api/toestel/meting': { toegang: 'SERVICE_TO_SERVICE',
    wat: 'de toestelsleutel uit de kop x-rtg-toestel; 401 zonder' },

  /* Een overdrachtsbewijs dat eenmalig geldig is. */
  'POST /api/sso/wissel': { toegang: 'OBJECT_SCOPED', veld: 'sso',
    wat: 'accounts.verifyActionToken(sso, OVERDRACHT), en daarna ingetrokken' },

  /* ---- DE DEUREN ZELF, en waarom ze hier staan en niet op de publieke lijst.

     Dit is een fout die ik heb gemaakt en die keuringsregel 28 terugwees. Ik zette
     /api/login en de andere inlogroutes op scripts/lib/publiekeroutes.js, omdat er
     bij het inloggen nog geen sessie is. Die regel antwoordde: "staat op de
     publieke lijst maar heeft inmiddels een eigen poort -- haal de uitzondering
     weg", en zij heeft gelijk.

     Een inlogroute is niet "publiek, want zonder poort". De POORT IS DE
     WACHTWOORDCONTROLE. Wie de gegevens niet heeft, komt er niet door; dat is
     precies wat een deur doet. PUBLIC betekent iets anders -- er staat niets
     tussen, en dat is een besluit. Die twee door elkaar halen is exact de fout
     waar de kop van dit bestand voor waarschuwt.

     De klasse is dus AUTHENTICATED: de identiteit wordt hier VASTGESTELD in
     plaats van verondersteld. ---- */
  'POST /api/login': { toegang: 'AUTHENTICATED',
    wat: 'de tweede voordeur: een pas of (met RTG_DEMO) een demo-tier, met een rem per IP' },
  'POST /api/office/login': { toegang: 'AUTHENTICATED',
    wat: 'veiligGelijk(code, OFFICE_CODE) met een rem per IP; de code is de geloofsbrief' },
  'POST /api/supplier/login': { toegang: 'AUTHENTICATED',
    wat: 'leverancierscode, en met staffId ook de personeelscontrole' },
  'POST /api/supplier/mijn/login': { toegang: 'AUTHENTICATED',
    wat: 'accounts.findByLogin + verifyPassword, met een rem per IP' },
  'POST /api/techniek/inloggen': { toegang: 'AUTHENTICATED',
    wat: 'findByLogin + wachtwoord; antwoordt met opzet op elke fout hetzelfde' },
  'POST /api/staff': { toegang: 'AUTHENTICATED',
    wat: 'de personeelscode, of (met RTG_DEMO) een demo-inlog' },
  'POST /api/auth/reset': { toegang: 'OBJECT_SCOPED', veld: 'token',
    wat: 'accounts.findByReset(token) plus de tweede stap van de telefoon; de link IS de sleutel' },
  'POST /api/betaal/webhook/adyen': { toegang: 'SERVICE_TO_SERVICE',
    wat: 'webhookPoort: Adyen bewijst bezit met een HMAC over de melding' },
  'POST /api/aanmeld/zeg': { toegang: 'OBJECT_SCOPED', veld: 'id',
    wat: 'het gespreks-id uit het lichaam; zonder bestaand gesprek is er niets, plus een rem per IP' }
};

module.exports = { ROUTEPOORTEN };
