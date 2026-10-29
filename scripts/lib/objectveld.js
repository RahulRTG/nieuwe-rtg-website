/* Eén objectveldafleiding voor de contractgenerator en zijn kwaliteitsproef.
   Een handgelezen routepoort geldt uitsluitend voor de exacte methode + route.
   Dit beschrijft een objectveld; het bewijst geen runtime-autorisatie. */
'use strict';
const handlerpoorten = require('../../server/kern/handlerpoorten');

function objectVeldVan(rij, contracten = {}) {
  const t = rij.toegang || {};
  const uh = String(t.uitHandler || '');
  if (uh.startsWith('object: ') && uh.slice(8)) return uh.slice(8);
  const c = contracten[rij.route];
  if (c && c.toegang && c.toegang.objectVeld) return c.toegang.objectVeld;
  const hand = handlerpoorten.poortVanRouteHand(rij.route);
  if (hand && hand.toegang === 'OBJECT_SCOPED' && hand.veld) return hand.veld;
  const viaBewaker = (t.bewakers || []).map(n => handlerpoorten.veldVanBewaker(n)).find(Boolean);
  if (viaBewaker) return viaBewaker;
  return handlerpoorten.veldVanPad(String(rij.route || '').replace(/^[A-Z]+ /, ''));
}

module.exports = { objectVeldVan };
