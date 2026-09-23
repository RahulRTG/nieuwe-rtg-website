/* DE BELEIDSMOTOR, DE FEITEN -- wat er over deze aanroeper vaststaat.

   Leest dezelfde bronnen als de poorten, maar zelf: uit het token, en nooit uit
   iets dat een poort op het verzoek heeft gezet (req.eigenaar, de envelop). Zou
   de motor die lezen, dan vergelijkt de schaduw de poort met zichzelf.

   Elk feit is `true`, `false` of `undefined`. Dat laatste betekent: de bron kon
   niet antwoorden. Een gooiende bron wordt dus geen `false` -- anders klinkt een
   storing als een weigering.

   De feiten raken de identiteitskluis niet: een sessie, een account-id en twee
   lijsten sleutels. Er gaat geen naam in, en er gaat niets van hier naar een
   opslag (./index.js telt alleen). */
'use strict';

function maakFeiten({ sessionFor, accounts, eigenaar, boardroomWie, magBoardroom, balieBron }) {
  const probeer = (fn) => { try { return fn(); } catch (e) { return undefined; } };

  return function feitenVan(req) {
    const header = (req && typeof req.get === 'function' && req.get('authorization')) || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return { kantoorsessie: false, eigenaar: false, mensOpSessie: false, boardroomZetel: false, balieZetel: false };
    }
    const sess = probeer(() => sessionFor(token) || null);
    const kantoor = sess === undefined ? undefined : !!(sess && sess.role === 'office');
    /* Het eigen account van de eigenaar, zoals officeAuth hem toelaat: alleen als
       het token GEEN kantoorsessie is (een kantoorsessie wordt eerst gelezen). */
    const eig = kantoor === true ? false : probeer(() => {
      const u = accounts.verifyToken(token);
      return !!(u && eigenaar.isEigenaar(accounts, u));
    });
    const wie = probeer(() => boardroomWie(req));
    const zetel = (fn) => {
      if (wie === undefined) return undefined;
      if (typeof fn !== 'function') return undefined;   // bron nog niet gemonteerd
      return probeer(() => !!fn(wie));
    };
    return {
      kantoorsessie: kantoor,
      eigenaar: eig,
      mensOpSessie: kantoor === undefined ? undefined : !!(kantoor && sess.lidKey),
      boardroomZetel: zetel(magBoardroom),
      balieZetel: zetel(typeof balieBron === 'function' ? balieBron() : undefined)
    };
  };
}

module.exports = { maakFeiten };
