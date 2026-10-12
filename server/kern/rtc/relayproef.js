/* De relayproef: bewijst dat een geconfigureerde TURN-URL ECHT bytes relayt.

   Twee allocaties (A en B) op dezelfde server, elk met hun eigen kortlevende
   credential; ieder zet een permissie voor het relayadres van de ander; daarna
   gaat er in beide richtingen minstens 64 KiB willekeurige data doorheen, en
   die moet byte voor byte (SHA-256) aankomen. Alleen dan is de uitslag `ok`.

   Wat deze proef NIET is: een TCP-connect, een DNS-lookup of het lezen van een
   omgevingsvariabele. Een server die geen authenticatie vraagt laat de proef
   ZAKKEN (`TURN_ZONDER_AUTH`) -- een open relais is geen gereed relais.

   De proef gooit nooit naar de aanroeper: elke fout wordt een uitslag met een
   reden, en een uitslag zonder `ok: true` is in elke laag erboven dicht. */
'use strict';

const crypto = require('node:crypto');
const turnclient = require('./turnclient');

const MIN_BYTES = 65536;
const BROK = 1024;

function transportVan(url) {
  if (url.schema === 'turns') return 'tls';
  return url.transport === 'tcp' ? 'tcp' : 'udp';
}

async function stroom(van, naar, totaal, timeoutMs) {
  const brokken = Math.ceil(totaal / BROK);
  const data = crypto.randomBytes(brokken * BROK);
  const verwacht = crypto.createHash('sha256').update(data).digest('hex');
  const ontvangen = new Map();
  const stop = naar.alloc.opData((afz, b) => {
    if (afz.ip !== van.alloc.relay.ip || afz.poort !== van.alloc.relay.poort || b.length !== BROK + 4) return;
    const i = b.readUInt32BE(0);
    if (i < brokken && !ontvangen.has(i)) ontvangen.set(i, b.subarray(4));
  });
  const einde = Date.now() + timeoutMs;
  try {
    for (let ronde = 0; ronde < 4 && ontvangen.size < brokken && Date.now() < einde; ronde++) {
      for (let i = 0; i < brokken; i++) {
        if (ontvangen.has(i)) continue;
        const kop = Buffer.alloc(4); kop.writeUInt32BE(i, 0);
        van.alloc.stuurNaar(naar.alloc.relay, Buffer.concat([kop, data.subarray(i * BROK, (i + 1) * BROK)]));
        if (i % 16 === 15) await new Promise(r => setImmediate(r));
      }
      const tot = Math.min(einde, Date.now() + 1500);
      while (ontvangen.size < brokken && Date.now() < tot) await new Promise(r => setTimeout(r, 25));
    }
  } finally { stop(); }
  if (ontvangen.size !== brokken) return { ok: false, bytes: ontvangen.size * BROK, reden: 'RELAY_DATA_ONVOLLEDIG' };
  const terug = Buffer.concat([...Array(brokken).keys()].map(i => ontvangen.get(i)));
  const gelijk = crypto.timingSafeEqual(crypto.createHash('sha256').update(terug).digest(), Buffer.from(verwacht, 'hex'));
  return gelijk ? { ok: true, bytes: terug.length } : { ok: false, bytes: terug.length, reden: 'RELAY_DATA_BESCHADIGD' };
}

/* url: uitkomst van config/turn.ontleedUrl (ok:true). credential(): levert
   telkens een vers { username, credential } -- dezelfde functie die /api/ice
   gebruikt, zodat de proef de echte uitgifte beproeft. */
async function proefUrl(url, credential, { timeoutMs = 8000, ca, bytes = MIN_BYTES, eisOpenbaarRelay = false } = {}) {
  const transport = transportVan(url);
  const basis = { url: url.url, transport, ok: false };
  const kanalen = [];
  const allocs = [];
  try {
    const maak = async () => {
      const kanaal = await turnclient.verbind({ transport, host: url.host, poort: url.poort,
        servername: url.host, ca, timeoutMs });
      kanalen.push(kanaal);
      const c = credential();
      const alloc = await turnclient.alloceer(kanaal, { gebruiker: c.username, wachtwoord: c.credential,
        timeoutMs, transport });
      allocs.push(alloc);
      return { kanaal, alloc };
    };
    const a = await maak(), b = await maak();
    /* In publieke productie moet het relais een OPENBAAR adres uitdelen: een
       relais dat 10.x of 127.x teruggeeft is voor een browser op 4G onbereikbaar,
       ook al slaagt de proef van binnenuit. */
    if (eisOpenbaarRelay && ![a, b].every(x => require('../../config/turn').openbareHost(x.alloc.relay.ip)))
      return { ...basis, reden: 'TURN_RELAY_ADRES_NIET_OPENBAAR' };
    await a.alloc.permissie(b.alloc.relay.ip);
    await b.alloc.permissie(a.alloc.relay.ip);
    const heen = await stroom(a, b, bytes, timeoutMs);
    if (!heen.ok) return { ...basis, reden: heen.reden, bytesAB: heen.bytes };
    const terug = await stroom(b, a, bytes, timeoutMs);
    if (!terug.ok) return { ...basis, reden: terug.reden, bytesAB: heen.bytes, bytesBA: terug.bytes };
    return { ...basis, ok: true, bytesAB: heen.bytes, bytesBA: terug.bytes };
  } catch (e) {
    return { ...basis, reden: /^TURN_/.test(String(e && e.code)) ? e.code : foutsoort(e) };
  } finally {
    for (const al of allocs) await al.vrijgeven();
    for (const k of kanalen) k.sluit();
  }
}

function foutsoort(e) {
  const c = String(e && e.code || '');
  if (/^(ENOTFOUND|EAI_AGAIN)$/.test(c)) return 'TURN_DNS_FOUT';
  if (/^(ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT)$/.test(c)) return 'TURN_NETWERK_FOUT';
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/.test(c)) return 'TURN_TLS_IDENTITEIT_ONGELDIG';
  if (/te lang|geen antwoord/.test(String(e && e.message))) return 'TURN_GEEN_ANTWOORD';
  return 'TURN_PROEF_FOUT';
}

module.exports = { proefUrl, MIN_BYTES, transportVan };
