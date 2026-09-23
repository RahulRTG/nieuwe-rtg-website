/* INTREKKEN SLUIT WAT AL OPENSTAAT -- AUTHORITY.md fase 3.

   HET GAT. Een kantoorsessie leefde tot haar TTL (dertig dagen) door, wat er
   ook met de rechten van die mens gebeurde. De kantoorrol ontkoppelen, de
   boardroomtoegang intrekken, een baliezetel weghalen: alle drie schreven ze
   een lijst om, en de sessie waarmee iemand al binnen was bleef staan -- en
   daarmee de rest van het kantoor. `magBoardroom` en `magBalie` lezen live, dus
   die ene kamer ging wel dicht; de deur ernaartoe niet.

   DE VORM IS DIE VAN routes/member/toestellen.js, en er komt geen tweede
   intrekmechanisme bij: elke sessie draagt een `sid`, `accounts.trekInSessie`
   zet die op de intreklijst (duurzaam, en over de bus naar elke instantie), en
   `sessionFor` weigert haar bij het volgende verzoek. Hier komt alleen de vraag
   bij die er nog niet was: WELKE sessies zijn van deze mens?

   EN DE STROOM. Een open kantoorstroom (/api/office/stream) wist niet van welke
   sessie hij was. Nu wel: de verbinding draagt haar sid en wordt hier gesloten;
   en omdat een andere instantie haar eigen verbindingen heeft, controleert
   kern/sse.js voortaan bij elk bericht of de sessie nog geldt.

   WAT HIER NIET GEBEURT. De sessie van degene die intrekt blijft staan
   (`eigenSid`): wie zijn eigen zetel weghaalt, hoort het antwoord nog te lezen.
   En de GEDEELDE kantoorcode heeft geen mens om in te trekken -- die sessies
   dragen geen lidKey en zijn hier dus onzichtbaar. Dat is fase 2 (de code wordt
   een uitnodiging) en staat in AUTHORITY.md, niet in deze module. */
'use strict';

const { TOKEN_TTL_MS } = require('../sessies');

module.exports = function maakKantoorIntrekking({ sessions, sessionFor, accounts, sessieregister, sseClients, nu }) {
  const tijd = nu || Date.now;

  /* De sessie van wie nu intrekt: die blijft staan. Uit het token van dit
     verzoek, nooit uit iets wat het verzoek over zichzelf zegt. */
  function eigenSid(req) {
    const h = (req && typeof req.get === 'function' && req.get('authorization')) || '';
    const s = h.startsWith('Bearer ') && typeof sessionFor === 'function' ? sessionFor(h.slice(7)) : null;
    return (s && s.sid) || null;
  }

  /* Alle kantoorsessies van een mens, als sids. Een lezing over de levende Map:
     die draagt via de bus ook de sessies die op een andere instantie zijn
     gemaakt (kern/sessies.js, koppelBus). */
  function kantoorSidsVan(lidKey) {
    const uit = [];
    if (!lidKey || !sessions || typeof sessions.values !== 'function') return uit;
    for (const s of sessions.values()) {
      if (s && s.role === 'office' && s.lidKey === lidKey && s.sid) uit.push(s.sid);
    }
    return uit;
  }

  async function sluitKantoorVan(lidKey, req) {
    const behalve = eigenSid(req);
    const sids = kantoorSidsVan(lidKey).filter(sid => sid !== behalve);
    for (const sid of sids) {
      await accounts.trekInSessie(sid, tijd() + TOKEN_TTL_MS);
      try { if (sessieregister) sessieregister.sluit(sid); } catch (e) { /* het register is een lezer, geen poort */ }
    }
    if (sids.length && typeof accounts.wachtIntrekkingen === 'function') await accounts.wachtIntrekkingen();
    let stromen = 0;
    for (const c of (sseClients || []).slice()) {
      if (c && c.office && c.sid && sids.includes(c.sid)) {
        try { c.res.end(); } catch (e) { /* al dicht */ }
        const i = sseClients.indexOf(c);
        if (i >= 0) sseClients.splice(i, 1);
        stromen += 1;
      }
    }
    return { sessies: sids.length, stromen };
  }

  return { sluitKantoorVan, kantoorSidsVan };
};
