/* ============================================================================
   DE PEILINGEN VAN DE GEGEVENSKAART -- staat dit gegeven er, ja, nee of niet
   vast te stellen?

   Geknipt uit ./gegevenskaart.js op de 10 kB-grens, en op de naad die er ook
   inhoudelijk een is: hiernaast staat WAT de kaart samenstelt, hier staat HOE
   hij het te weten komt. Die tweede lijst groeit met elk gegeven dat dit huis
   erbij krijgt; de eerste niet.

   DE REGEL DIE DEZE LAAG DRAAGT (MIJNRTG.md G6): hier wordt niets UITGEREKEND.
   Elke peiling vraagt het aan de laag die het gegeven bezit -- de kluis, het
   dossier, het sessieregister -- en geeft ja, nee of null terug. Er is met
   opzet geen peiling die bij twijfel "nee" zegt: een storing die als
   afwezigheid op het scherm komt, stelt een mens gerust op precies het moment
   dat dat niet mag.
   ========================================================================== */
'use strict';

function maakPeilingen({ accounts, sessieregister, toestellen, commercieel, inzagekaart }) {
  /* DE PEILINGEN. Elk geeft true, false of null terug -- en null draagt altijd
     een reden. Er is met opzet geen peiling die bij twijfel "nee" zegt. */
  return {
    'kluis:naam': (u) => !!(u && accounts.realNameOf(u)),
    'kluis:codenaam': (u) => !!(u && u.codename),
    'kluis:email': (u) => !!(u && accounts.emailOf(u)),
    'kluis:telefoon': (u) => !!(u && accounts.phoneOf(u)),
    'kluis:verificatie': (u) => !!(u && u.verified && u.verified !== 'unverified'),
    'dossier:geboortedatum': (u, md) => !!(md && md.geboren),
    'dossier:adres': (u, md) => !!(md && md.adres),
    'dossier:tweefactor': (u, md) => !!(md && md.tweefactor && md.tweefactor.aan),
    'dossier:facturen': (u, md) => !!(md && (md.invoices || []).length),
    sessies: (u, md, key) => (sessieregister ? sessieregister.vanLid(key).length > 0 : null),
    toestellen: (u, md, key) => (toestellen ? toestellen.lijst(key).length > 0 : null),
    post: (u, md, key) => (commercieel ? commercieel.standVan(key).soorten.some(s => s.aan) : null),
    inzage: (u, md, key) => (inzagekaart ? (inzagekaart(key).kaart || []).length > 0 : null)
  };
}

module.exports = { maakPeilingen };
