/* Guest OS (deellaag van ./bezorgen.js): DE PROMOTIECODE aan de ledenkant
   (deur eten.kortingscode; de grenzen zelf staan in kern/eten/kortingscode.js).

   DE REM OP RADEN: een mislukte code telt in de huisbrede emmer
   (tooManyTries/noteFailedTry in server/server.js) per lid EN per adres --
   tien per lid, dertig per adres, daarna vijf minuten dicht. Een verzoek
   zonder code telt nergens mee en wordt nergens door geremd.

   DE CLAIM gaat VOOR de bestelling: atomair, een rekening telt een keer, en
   gaat de bestelling daarna niet door, dan komt het gebruik terug (behalve als
   deze rekening hem al eerder had). */
'use strict';

module.exports = ({ kern, korting }) => {
  const lidVan = req => (req.session && req.session.key) || null;
  const emmers = req => ['eten-korting:lid:' + (lidVan(req) || req.ip), 'eten-korting:ip:' + req.ip];
  const geremd = (req, res) => !!(req.body || {}).kortingscode && emmers(req).some(e => kern.tooManyTries(res, e));
  function telMislukt(req, uit) {
    if (!uit || uit.blokkadeCode !== 'kortingscode') return;
    const [lid, ip] = emmers(req);
    kern.noteFailedTry(lid, req.ip, 10);
    kern.noteFailedTry(ip, req.ip, 30);
  }
  /* Geeft { geefTerug } of null (dan is het antwoord al verstuurd). */
  async function claimVoor(req, res, s, voorbeeld, rek, handle) {
    const k = voorbeeld._korting;
    if (!k) return { geefTerug: async () => null };
    const c = await korting.claim({ zaak: s.code, korting: k, lidKey: lidVan(req) || handle, rekeningId: rek.id });
    if (!c.ok) {
      res.status(409).json({ error: korting.UITLEG[c.reden], code: 'kortingscode', reden: c.reden });
      return null;
    }
    return { geefTerug: async () => (c.herhaald ? null : korting.laat({ zaak: s.code, code: k.code, rekeningId: rek.id })) };
  }
  return { lidVan, geremd, telMislukt, claimVoor };
};
