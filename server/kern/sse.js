/* De realtime-afleverlaag als een maak…(state)-fabriek: de lijst open SSE-
   verbindingen, de korte terugspeelbuffer per ontvanger en het afleveren van
   events die op de bus verschijnen. Uit server.js gelicht zodat de staat
   (clients + buffer + id-teller) op één plek zit en los te overzien is.

   Gedrag is identiek aan de oude inline-versie: de fabriek geeft dezelfde
   `sseClients`-array en `sseBuffer`-Map terug, zodat de routes (die er push/
   splice op doen) en het onderhoudslus in server.js er ongewijzigd op werken.

   Betrouwbaarheid: persoonlijke events (dm, snap, belsignaal) krijgen een
   oplopend id en worden kort bewaard per ontvanger. Verbreekt een verbinding
   even, dan stuurt EventSource bij herstel zijn laatste id mee (Last-Event-ID)
   en spelen we de gemiste events opnieuw af. */
const SSE_BUFFER_TTL = 2 * 60 * 1000; // twee minuten terugspelen is ruim genoeg

function maakSse({ bus }) {
  const sseClients = [];       // { tier, res, key?, sup?, office? }
  const sseBuffer = new Map(); // key -> [{ id, event, data, at }]
  let _sseMs = 0, _sseSeq = 0;

  // Monotone, sorteerbare event-id (milliseconde * 1000 + volgnummer binnen die ms).
  function nextSseId() {
    const t = Date.now();
    if (t > _sseMs) { _sseMs = t; _sseSeq = 0; } else { _sseSeq++; }
    return _sseMs * 1000 + _sseSeq;
  }

  function bufferEvent(key, id, event, data) {
    const nu = Date.now();
    let lijst = sseBuffer.get(key);
    if (!lijst) { lijst = []; sseBuffer.set(key, lijst); }
    lijst.push({ id, event, data, at: nu });
    // opschonen: hooguit 50 per ontvanger en niets ouder dan de TTL
    const vers = lijst.filter(e => nu - e.at < SSE_BUFFER_TTL);
    sseBuffer.set(key, vers.slice(-50));
  }

  function speelOpnieuw(res, key, sinds) {
    const lijst = sseBuffer.get(key);
    if (!lijst || !sinds) return;
    for (const e of lijst) if (e.id > sinds) sseSend(res, e.event, e.data, e.id);
  }

  function sseSend(res, event, data, id) {
    if (id != null) res.write('id: ' + id + '\n');
    res.write('event: ' + event + '\n');
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  }

  // Een event van de bus afleveren aan alle passende open verbindingen; voor
  // persoonlijke events ook in de terugspeelbuffer leggen.
  function leverSse(m) {
    if (m.doel === 'key' && m.id) bufferEvent(m.match, m.id, m.event, m.data);
    for (const c of sseClients) {
      let raak = false;
      if (m.doel === 'key') raak = c.key === m.match;
      else if (m.doel === 'sup') raak = c.sup === m.match;
      else if (m.doel === 'office') raak = !!c.office;
      else if (m.doel === 'tier') raak = m.match.includes(c.tier);
      if (raak) sseSend(c.res, m.event, m.data, m.doel === 'key' ? m.id : undefined);
    }
  }

  // Periodiek onderhoud: verlopen buffers opruimen zodat het geheugen niet
  // langzaam volloopt bij veel unieke ontvangers.
  function ruimBuffer() {
    const nu = Date.now();
    for (const [k, lijst] of sseBuffer) {
      const vers = lijst.filter(e => nu - e.at < SSE_BUFFER_TTL);
      if (!vers.length) sseBuffer.delete(k); else if (vers.length !== lijst.length) sseBuffer.set(k, vers);
    }
  }

  bus.subscribe('sse', leverSse);

  return { sseClients, sseBuffer, nextSseId, bufferEvent, speelOpnieuw, leverSse, sseSend, ruimBuffer, SSE_BUFFER_TTL };
}

module.exports = { maakSse, SSE_BUFFER_TTL };
