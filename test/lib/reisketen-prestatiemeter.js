/* Alleen browserwaarnemers en steekproefpercentielen; geen productcode,
   transportvervanging, prestatienorm of zelfstandig bewijsregister. */
'use strict';
function verdeling(rijen) {
  const n = rijen.filter(Number.isFinite).sort((a, b) => a - b);
  if (!n.length) return { n: 0, status: 'NIET_GEMETEN' };
  const p = q => n[Math.max(0, Math.ceil(n.length * q) - 1)];
  return { n: n.length, methode: 'nearest-rank', p50: p(.5), p95: p(.95), p99: p(.99), min: n[0], max: n.at(-1) };
}
/* De teller begint bij de echte klik; eindpunt vereist een vervangen bronkaart,
   dezelfde ref/versie, bruikbare acties en twee rAF's. DOM+frame is geen garantie
   dat een kaart onder de vouw zichtbaar is. */
function waarnemer(verwacht) {
  const meter = window.__reisPrestatie = { klaar: null, paints: {}, lcp: null, langeFrames: [], ondersteund: [] };
  let doel = verwacht, begin = 0, vorige = null, wacht = true, gepland = false;
  function observe(type, verwerk) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    new PerformanceObserver(l => l.getEntries().forEach(verwerk)).observe({ type, buffered: true });
    meter.ondersteund.push(type);
  }
  observe('paint', e => { meter.paints[e.name] = e.startTime; });
  observe('largest-contentful-paint', e => { meter.lcp = e.startTime; });
  observe('long-animation-frame', e => meter.langeFrames.push({ start: e.startTime, duur: e.duration, blokkeert: e.blockingDuration }));
  if (!meter.ondersteund.includes('long-animation-frame')) {
    observe('longtask', e => meter.langeFrames.push({ start: e.startTime, duur: e.duration, blokkeert: Math.max(0, e.duration - 50) }));
  }
  function kaart() { return document.querySelector('[data-reiscontract="' + doel.ref + '"]'); }
  function geldig() {
    const k = kaart(), h = document.querySelector('#reisKeten'), knop = h?.querySelector('[data-keten-actie="ververs"]');
    return k && k !== vorige && k.getClientRects().length && !knop?.disabled &&
      k.querySelector('[data-keten-status]')?.textContent === 'aangeboden' &&
      k.textContent.includes('Offerte ' + doel.versie + ' · ') && k.textContent.includes(doel.voorwaarden) &&
      k.querySelector('[data-keten-actie="akkoord"]')?.disabled === false;
  }
  function kijk() {
    if (!wacht || gepland || !geldig()) return;
    gepland = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      gepland = false;
      if (!wacht || !geldig()) return;
      const eind = performance.now();
      const api = performance.getEntriesByType('resource').filter(r => new URL(r.name).pathname === '/api/reisbureau/keten' && r.startTime >= begin).at(-1);
      if (!api || !api.responseEnd) return;
      meter.klaar = { begin, eind, documentTotDomFrameMs: eind, klikTotDomFrameMs: eind - begin,
        verzoekTotAntwoordMs: api.responseEnd - api.startTime,
        requestTotAntwoordMs: api.requestStart > 0 ? api.responseEnd - api.requestStart : null,
        antwoordTotDomFrameMs: eind - api.responseEnd, decodedBytes: api.decodedBodySize,
        encodedBytes: api.encodedBodySize, transferBytes: api.transferSize,
        versie: doel.versie, bronkaartVervangen: true };
      wacht = false;
    }));
  }
  meter.arm = volgend => { doel = volgend; vorige = kaart(); meter.klaar = null; wacht = false; };
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-keten-actie="ververs"]')) return;
    begin = performance.now(); wacht = true;
  }, true);
  new MutationObserver(kijk).observe(document, { childList: true, subtree: true, attributes: true });
}
module.exports = { verdeling, waarnemer };
