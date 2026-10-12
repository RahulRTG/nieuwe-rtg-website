/* LUISTEREN OP DE LIVESTROOM VAN EEN ZAAK, ZONDER OP DE KLOK TE WACHTEN.

   Een toets die wil zeggen dat een signaal NIET aankomt, kan niet wachten "tot
   het er is". Hij wachtte daarom een vaste 300 ms voor en 1200 ms na de
   handeling -- een gok die onder belasting te kort is (scripts/klokwacht.js).

   In plaats daarvan twee bakens die wel aankomen:
   - VOOR de handeling: het `hello` dat de stroom stuurt zodra de verbinding in
     de lijst staat (routes/supplier/stroom.js). Daarna mist hij niets meer.
   - NA de handeling: een zaakbreed signaal dat de toets zelf veroorzaakt
     (`baken`). De bus publiceert na de commit van elk verzoek, het baken komt
     pas na het antwoord op de handeling, en op EEN verbinding komen berichten
     op volgorde aan. Wat de handeling seinde, is dus binnen vóór het baken --
     of het komt niet.

   Het baken moet een signaal zijn dat de handeling zelf nooit geeft, anders
   telt hij het hare mee. De toetsen hier gebruiken het weghalen van een
   onbestaand bezorgproduct door de manager: `sync` met scope `bezorg`, geen
   logregel en geen teamsignaal (dat laatste toetsen ze juist). */
'use strict';
/* De stroom gaat open met een eenmalig ticket en nooit met de sessie in het
   adres (kern/sessiestroom.js): ?token= krijgt 401. */
const { stroomAdres } = require('./helper');

const BAKEN = /"scope":"bezorg"/g;

function maakLuister(H, bakenTok) {
  const baken = () => fetch(H + '/api/supplier/bezorg/product', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bakenTok() },
    body: JSON.stringify({ weg: true, id: 'baken-bestaat-niet' }) });
  return async function luister(tok, doe, { ms = 15000 } = {}) {
    const ac = new AbortController();
    const r = await fetch(await stroomAdres(H, '/api/supplier/stream', tok, { stroom: 'zaak' }), { signal: ac.signal });
    const lezer = r.body.getReader();
    let tekst = '';
    const lees = (async () => {
      try { for (;;) { const { value, done } = await lezer.read(); if (done) break; tekst += Buffer.from(value).toString(); } } catch (e) { /* afgebroken */ }
    })();
    const tel = () => (tekst.match(BAKEN) || []).length;
    const tot = async (wat, pred) => {
      const eind = Date.now() + ms;
      for (;;) {
        if (pred()) return;
        if (Date.now() > eind) { ac.abort(); throw new Error('de stroom gaf geen ' + wat + ' binnen ' + ms + ' ms: ' + tekst.slice(0, 300)); }
        await new Promise(z => setImmediate(z));
      }
    };
    await tot('hello', () => /event: hello/.test(tekst));
    const voor = tel();
    await doe();
    const b = await baken();
    if (b.status !== 200) { ac.abort(); throw new Error('het baken kon niet worden gezet: ' + b.status + ' ' + (await b.text())); }
    await tot('baken', () => tel() > voor);
    ac.abort(); await lees;
    return tekst;
  };
}

module.exports = { maakLuister };
