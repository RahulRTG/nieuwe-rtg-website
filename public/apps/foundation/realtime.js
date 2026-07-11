/* Live-verbinding via Server-Sent Events voor de RTFoundation-lesapp. */
function verbind(code, role, token, handlers) {
  let es = null, dicht = false;
  function open() {
    if (dicht) return;
    const url = '/api/foundation/les/' + encodeURIComponent(code) + '/stream?role=' + role +
      (token ? '&token=' + encodeURIComponent(token) : '');
    es = new EventSource(url);
    for (const [event, fn] of Object.entries(handlers)) {
      es.addEventListener(event, e => { try { fn(JSON.parse(e.data)); } catch (err) {} });
    }
    es.onerror = () => { /* EventSource verbindt zelf opnieuw */ };
  }
  open();
  return { sluit() { dicht = true; if (es) es.close(); } };
}
window.KlasLive = { verbind };
