/* DE RTC-POORT: één server-side handhaver voor alle WebRTC-signaalroutes.

   De relaystand (kern/rtc/relaystand.js) zegt of realtime bellen mag bestaan.
   Een scherm dat de belknop verbergt is daarvoor geen grens -- de client is
   nooit de beveiligingsgrens. Deze poort hangt vóór elke router en weigert een
   signaal dat een gesprek OPENT of VOORTZET (ring, offer, answer, ice, ...)
   zolang de relaystand niet beschikbaar is.

   Ophangen, weigeren en vertrekken blijven altijd mogelijk: een gesprek dat
   niet meer mag, moet wel netjes kunnen eindigen.

   Bewust NIET in de lijst: /api/ontmoeten/signaal en
   /api/office/ontmoeting/signaal. Dat is het meekijkkanaal van een lopende
   SOS tijdens een ontmoeting (kern/ontmoeting/sos.js). Een veiligheidskanaal
   gaat niet dicht omdat een kwaliteitsafhankelijkheid wegvalt: de melding
   zelf loopt los van WebRTC, en het beeld is een poging bovenop. Dat is een
   uitgeschreven besluit en geen vergeten route; test/rtc-poort.test.js houdt
   beide lijsten vast. */
'use strict';

const relaystand = require('./relaystand');

const SIGNAALROUTES = Object.freeze([
  '/api/member/call',
  '/api/rtf/social/call',
  '/api/staff/call',
  '/api/meet/sein',
  '/api/service/bel',
  '/api/service/bel/signaal',
  '/api/office/service/gesprek/signaal',
  '/api/foundation/gezin/bel',
  '/api/foundation/school/bel',
  '/api/connection/vonk/call/start',
  '/api/connection/vonk/call/answer',
  '/api/connection/vonk/call/signal',
  '/api/connection/rendezvous/call/start',
  '/api/connection/rendezvous/call/answer',
  '/api/connection/rendezvous/call/signal',
  '/api/podium/signaal',
  '/api/theater/signaal',
  '/api/clips/signaal'
]);
const VEILIGHEIDSKANALEN = Object.freeze(['/api/ontmoeten/signaal', '/api/office/ontmoeting/signaal']);
const AFSLUITEND = Object.freeze(['hangup', 'decline', 'busy', 'leave', 'end', 'weg', 'ophangen', 'stop']);

function afsluitend(pad, lijf) {
  const b = lijf && typeof lijf === 'object' ? lijf : {};
  if (/\/call\/answer$/.test(pad)) return b.accept === false;
  return AFSLUITEND.includes(String(b.kind || ''));
}

function maakRtcPoort({ stand = () => relaystand.stand() } = {}) {
  const paden = new Set(SIGNAALROUTES);
  return function rtcPoort(req, res, next) {
    if (req.method !== 'POST' || !paden.has(req.path)) return next();
    if (afsluitend(req.path, req.body)) return next();
    let st = null;
    try { st = stand(); } catch (e) { st = null; }
    if (st && st.beschikbaar === true) return next();
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({ code: st && st.reden === 'RTC_KILL_SWITCH' ? 'KILL_SWITCH' : 'PROVIDER_NOT_READY',
      reden: st ? st.reden : 'PROVIDER_ONBEKEND',
      error: 'Bellen is nu niet beschikbaar: de verbinding via het RTG-relais is niet aantoonbaar gereed. Ophangen blijft mogelijk.' });
  };
}

/* De module IS de poort (zo hangt hij met één korte require in
   opzet/poortwachters.js), met de bouwstenen erop voor de toetsen. */
module.exports = Object.assign(maakRtcPoort(), { maakRtcPoort, SIGNAALROUTES, VEILIGHEIDSKANALEN, AFSLUITEND, afsluitend });
