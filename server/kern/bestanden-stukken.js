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

  async function klaar(key, uploadId) {
    const u = lopend.get(String(uploadId || ''));
    if (!u || u.key !== key) return { status: 404, error: 'Die upload loopt niet (meer); begin opnieuw.' };
    lopend.delete(String(uploadId));
    const dataUrl = 'data:' + u.mime + ';base64,' + u.stukken.join('');

    /* DE ONTSMETTER ZAT HIER NIET, EN DEZE WEG LIEP ER OMHEEN.

       Het scan-net in server.js loopt door elke verzoek-body en scant wat eruit
       ziet als een complete data-URL ("data:<mime>;base64,<...>"). Dat dekt alle
       gewone upload-plekken in een klap. Maar een STUK is geen data-URL: het is
       een kale base64-tekst zonder kop, en dus zag het net er niets in. Het
       geheel ontstaat pas hier, op de server, in een variabele -- en er is geen
       verzoek-body meer waar het net doorheen kan lopen.

       Wie een besmet bestand kwijt wilde, hoefde het dus alleen in stukken te
       sturen. Geen truc, geen kennis van het systeem nodig: de app doet dat
       vanzelf zodra een bestand boven de 8 MB uitkomt. Daarom hier, op het
       moment dat het bestand voor het eerst compleet is, dezelfde scan. */
    /* GEEN EIGEN SCAN HIER, EN DAT IS EEN BESLUIT.

       Het scan-net in server.js ziet deze weg niet: een los stuk is kale
       base64 zonder kop, dus geen data-URL, en het geheel ontstaat pas hier op
       de server. Ik heb er daarom eerst een scan bij gezet -- en toen bleek de
       mutatie niet te bijten. Terecht: de regels hieronder lopen door upload()
       en versieNieuw(), en die halen sinds deze ronde allebei dezelfde poort
       (./bestanden-poort.js) langs. Een tweede kopie van dezelfde regel is
       precies hoe twee plekken later uit elkaar gaan lopen.

       Wat hier dus WEL moet blijven staan: deze weg mag nooit langs upload() of
       versieNieuw() heen gaan schrijven. Zolang dat zo is, is de poort gedekt.
       test/upload-poort.test.js bewaakt dat van buitenaf. */

    // dezelfde weg als een kleine upload: alle grenzen, het quotum en de
    // Ontsmetter gelden gewoon
    return u.bid ? versieNieuw(key, u.bid, dataUrl)
      : await upload(key, { naam: u.naam, map: u.map, dataUrl });
  }

  return { bestandenUpStart: start, bestandenUpDeel: deel, bestandenUpKlaar: klaar };
}

module.exports = { maakStukken };
