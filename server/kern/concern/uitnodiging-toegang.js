/* CONCERN (deelmodule): DE CODE VAN EEN UITNODIGING als credential
   (workos.concern_uitnodiging, RELEASEKANDIDAAT.md B9).

   Afgesplitst van ./uitnodiging.js zodat die onder de 10 kB blijft; de naad is
   inhoudelijk: daar staat WAT een uitnodiging is, hier HOE haar code een deur
   opent. CU.<32 hex> (128 bit, ../bearercode.js), alleen als hash op de
   uitnodiging, constant-time gezocht, met issuer/doel/scope, een vervaltijd
   gelijk aan de uitnodiging en max_gebruik 1. De transactie loopt op de hele
   `concern`-collectie en zet de takken via ./opslag.js onder() op de werkkopie,
   zodat een claim en het dienstverband dat eruit volgt in EEN commit landen. */
'use strict';

const DOEL = 'concern-uitnodiging-accepteren';
const SCOPE = Object.freeze(['concern.dienstverband.accepteren']);
const VORM = /^CU\.[0-9A-F]{32}$/i;

module.exports = ({ crypto, opslag, bewerkCollectie, nu }) => {
  const bearer = require('../bearercode')({ crypto, namespace: 'workos.concern_uitnodiging', nu });
  const bak = () => opslag.tak('uitnodigingen');
  // een kale code van voor de migratie hoort niet op schijf te blijven staan
  const schoonOud = () => { for (const u of Object.values(bak())) if (u && 'code' in u) delete u.code; };
  const vindCode = (code) => VORM.test(String(code || '').trim())
    ? bearer.vind(Object.values(bak()), code, u => u && u.toegang && u.toegang.code_hash) : null;
  const transactie = (werk) => typeof bewerkCollectie === 'function'
    ? bewerkCollectie('concern', w => opslag.onder(w, () => { schoonOud(); return werk(); }))
    : { status: 503, error: 'Accepteren, intrekken en roteren vragen een collectietransactie die in deze server ontbreekt.' };
  // uitgeven en roteren: de vorige code wordt ingetrokken, de kale nieuwe gaat alleen terug naar de aanroeper
  function geefCode(u, door) {
    if (u.toegang) bearer.intrekken(u.toegang, door || 'werkgever', 'vervangen door een nieuwe code');
    const g = bearer.maak({ prefix: 'CU', issuer: 'rtg.concern.werkgever', doel: DOEL, scope: SCOPE,
      onderwerp: { soort: 'concern-uitnodiging', id: u.id, entiteit: u.entiteit },
      geldigMs: Date.parse(u.geldigTot + 'T23:59:59Z') - Date.parse(nu()), maxGebruik: 1 });
    g.toegang.rotatie = ((u.toegang && Number(u.toegang.rotatie)) || 0) + 1;
    u.toegang = g.toegang;
    return g.code;
  }
  // null = de code mag deze uitnodiging openen; anders de reden van bearercode, plus 'onbekend' bij een vreemd onderwerp
  const reden = (u) => !u || !u.toegang || !u.toegang.onderwerp || u.toegang.onderwerp.id !== u.id
    ? 'onbekend' : bearer.reden(u.toegang, { doel: DOEL, scope: SCOPE });
  return { vindCode, transactie, geefCode, schoonOud, reden, gebruik: t => bearer.gebruik(t),
    intrekken: (t, door, waarom) => bearer.intrekken(t, door, waarom), publiek: bearer.publiek, DOEL, SCOPE };
};
