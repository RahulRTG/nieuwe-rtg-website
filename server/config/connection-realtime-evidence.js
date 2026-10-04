/* Eén inhoudelijke keuring voor zowel de bewijsproducent als de uiteindelijke
   releaseverifier. Zo kan een evidence-signer een geldige, maar onvoldoende
   runnerwaarneming niet alsnog als geslaagde tweennetwerkproef verpakken. */
'use strict';

const HASH = /^[a-f0-9]{64}$/;
const VELDEN = Object.freeze(['distinctNetworkCount','networkASNsHashed',
  'turnCredentialsShortLived','relayCandidateA','relayCandidateB',
  'selectedPairRelayOnly','connected','bytesAToB','bytesBToA','disconnectedCleanly']);

function keurRealtimeWaarneming(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('de realtimewaarneming ontbreekt');
  const vreemd = Object.keys(o).filter(k => !VELDEN.includes(k));
  if (vreemd.length) throw new Error('de realtimewaarneming bevat onbekende velden');
  const netwerken = Array.isArray(o.networkASNsHashed) ? o.networkASNsHashed : [];
  const uniek = new Set(netwerken);
  if (!Number.isSafeInteger(o.distinctNetworkCount) || o.distinctNetworkCount < 2 ||
      o.distinctNetworkCount > 100 || netwerken.length !== o.distinctNetworkCount ||
      uniek.size !== o.distinctNetworkCount || !netwerken.every(v => HASH.test(String(v))))
    throw new Error('de proef liep niet over twee bewezen verschillende netwerken');
  for (const k of ['turnCredentialsShortLived','relayCandidateA','relayCandidateB',
    'selectedPairRelayOnly','connected','disconnectedCleanly'])
    if (o[k] !== true) throw new Error(k + ' is niet daadwerkelijk gemeten');
  for (const k of ['bytesAToB','bytesBToA'])
    if (!Number.isSafeInteger(o[k]) || o[k] < 65536 || o[k] > 100000000)
      throw new Error('er zijn geen bidirectionele payloadbytes via TURN gemeten');
  return true;
}

module.exports = { VELDEN, keurRealtimeWaarneming };
