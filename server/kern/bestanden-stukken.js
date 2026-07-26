/* RTG Bestanden, deel drie: grote bestanden gaan in stukken. De globale
   JSON-grens is 8 MB, dus alles daarboven komt binnen als een reeks
   base64-stukken die hier tijdelijk in het geheugen wachten; bij 'klaar'
   wordt het geheel een keer gecontroleerd en via de gewone upload-weg
   (met quotum en al) weggeschreven. */

const MAX_STUK = 6 * 1024 * 1024;   // per stuk (base64-tekens), past ruim in de 8MB-body
const MAX_WACHT_MS = 10 * 60 * 1000; // een upload die 10 minuten stilvalt, ruimen we op

function maakStukken(basis, upload, versieNieuw) {
  const { crypto } = basis;
  const lopend = new Map(); // uploadId -> { key, naam, map, bid, mime, stukken, op }

  function veeg() {
    const grens = Date.now() - MAX_WACHT_MS;
    for (const [k, v] of lopend) if (v.op < grens) lopend.delete(k);
  }

  function start(key, { naam, map, id, mime }) {
    veeg();
    if ([...lopend.values()].filter(v => v.key === key).length >= 3) {
      return { status: 429, error: 'Er lopen al drie uploads; wacht tot er een klaar is.' };
    }
    const uploadId = 'up' + crypto.randomBytes(8).toString('hex');
    mime = String(mime || '');
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime)) mime = 'application/octet-stream';
    lopend.set(uploadId, { key, naam: String(naam || ''), map: map || null,
      bid: id ? String(id) : null, mime, stukken: [], op: Date.now() });
    return { uploadId, maxStuk: MAX_STUK };
  }

  function deel(key, uploadId, stuk) {
    const u = lopend.get(String(uploadId || ''));
    if (!u || u.key !== key) return { status: 404, error: 'Die upload loopt niet (meer); begin opnieuw.' };
    stuk = String(stuk || '');
    if (!stuk || stuk.length > MAX_STUK || /[^A-Za-z0-9+/=]/.test(stuk)) {
      return { status: 400, error: 'Dat stuk is niet leesbaar.' };
    }
    u.stukken.push(stuk); u.op = Date.now();
    // een simpele rem: meer dan 40 MB aan tekens wordt nooit een geldig bestand
    if (u.stukken.reduce((n, s) => n + s.length, 0) > 40 * 1024 * 1024) {
      lopend.delete(String(uploadId));
      return { status: 413, error: 'Dit wordt te groot; een bestand mag hooguit 15 MB zijn.' };
    }
    return { ok: true, stukken: u.stukken.length };
  }

  function klaar(key, uploadId) {
    const u = lopend.get(String(uploadId || ''));
    if (!u || u.key !== key) return { status: 404, error: 'Die upload loopt niet (meer); begin opnieuw.' };
    lopend.delete(String(uploadId));
    const dataUrl = 'data:' + u.mime + ';base64,' + u.stukken.join('');
    // dezelfde weg als een kleine upload: alle grenzen en het quotum gelden gewoon
    return u.bid ? versieNieuw(key, u.bid, dataUrl)
      : upload(key, { naam: u.naam, map: u.map, dataUrl });
  }

  return { bestandenUpStart: start, bestandenUpDeel: deel, bestandenUpKlaar: klaar };
}

module.exports = { maakStukken };
