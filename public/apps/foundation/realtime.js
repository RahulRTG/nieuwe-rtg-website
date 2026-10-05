/* Live-verbinding via Server-Sent Events voor de RTFoundation-lesapp.
   De lessleutel staat nooit in het adres (B25): eerst een stroomticket via POST
   met de sleutel in de kop, en alleen dat eenmalige ticket gaat in de URL. Een
   ticket werkt een keer, dus bij elke herverbinding een nieuw. */
function verbind(code, role, token, handlers) {
  let es = null, dicht = false, wacht = null;
  function later() { if (!dicht && !wacht) wacht = setTimeout(() => { wacht = null; open(); }, 3000); }
  async function open() {
    if (dicht || !token) return;
    let r;
    try {
      r = await fetch('/api/foundation/les/stroomticket', { method: 'POST', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ code }) });
    } catch (e) { return later(); }
    if (r.status === 403 || r.status === 404 || r.status === 410) { dicht = true; return; }
    const d = r.ok ? await r.json().catch(() => null) : null;
    if (!d || !d.ticket || dicht) return later();
    es = new EventSource('/api/foundation/les/' + encodeURIComponent(code) + '/stream?role=' + role +
      '&ticket=' + encodeURIComponent(d.ticket));
    for (const [event, fn] of Object.entries(handlers)) {
      es.addEventListener(event, e => { try { fn(JSON.parse(e.data)); } catch (err) {} });
    }
    /* Zelf herverbinden zou HETZELFDE (al gebruikte) ticket opnieuw sturen en
       als geraden poging tellen; dus sluiten en met een nieuw ticket verder. */
    es.onerror = () => { if (es) es.close(); es = null; later(); };
  }
  open();
  return { sluit() { dicht = true; clearTimeout(wacht); if (es) es.close(); } };
}
window.KlasLive = { verbind };
