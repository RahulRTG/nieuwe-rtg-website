/* Ontmoeting (deelbestand): DE NOODKNOP EN HET MEEKIJKEN.

   Een SOS op een lopende afspraak, het afmelden ervan door het kantoor, en het
   WebRTC-signaalkanaal waarmee de meldkamer live kan meekijken.

   Apart van de rest van de afspraak-laag omdat dit het stuk is waar een lid op
   moet kunnen rekenen als het misgaat -- en omdat het als enige een kanaal naar
   het kantoorscherm opent. Wie hier iets verandert, verandert wat er op de
   meldkamer verschijnt; dat hoort niet tussen het maken van een afspraak te
   staan.

   Afgesplitst uit date.js toen die de 10 KB passeerde. */
const sosPositie = require('../sospositie');
module.exports = (sctx) => {
  const { db, nu, save, id, lijsten, dateVoor, codenaamVan, notify, sseToCustomer, sseToOffice } = sctx;

  function sos(key, dateId, bericht, lat, lng) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['actief', 'noodgeval'].includes(d.status)) return { status: 409, error: 'SOS kan alleen tijdens een lopende afspraak.' };
    const s = { id: id(), door: key, codenaam: codenaamVan(key), bericht: String(bericht || '').replace(/[<>]/g, '').slice(0, 200) || 'Noodsignaal', at: nu(), ok: null, camera: false };
    if (Number.isFinite(lat) && Number.isFinite(lng)) { s.lat = lat; s.lng = lng; d.posities[key] = { lat, lng, at: nu() }; }
    d.sos.unshift(s);
    d.status = 'noodgeval';
    save();
    // RTG-kantoor: rood alarm, mag meeluisteren/meekijken en 112 bellen (contract punt 2)
    sseToOffice('ontmoeting-sos', { dateId: d.id, sosId: s.id, codenaam: s.codenaam, bericht: s.bericht });
    sseToOffice('sync', { scope: 'ontmoeting' });
    // de andere deelnemer weet dat er een SOS loopt
    const ander = d.a === key ? d.b : d.a;
    sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
    notify(ander, { icon: '\u{1F6A8}', title: 'SOS', body: s.codenaam + ' heeft een noodsignaal gegeven. RTG-kantoor kijkt nu mee.', scope: 'ontmoeting' });
    sseToCustomer(key, 'sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true, sosId: s.id };
  }
  // RTG-kantoor handelt een SOS af
  function sosAf(dateId, sosId, door) {
    lijsten();
    const d = db.data.ontmoetDates.find(x => x.id === dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    const s = d.sos.find(x => x.id === sosId);
    if (!s) return { status: 404, error: 'SOS niet gevonden.' };
    s.ok = { door: String(door || 'RTG-kantoor').slice(0, 60), at: nu() };
    if (!d.sos.some(x => !x.ok) && d.status === 'noodgeval') d.status = 'actief';
    /* Was de afspraak al afgelopen terwijl deze SOS openstond, dan hield stop()
       de live-posities vast voor de meldkamer. Nu er niets meer openstaat, gaan
       ze weg -- de plek van de SOS zelf blijft bij de melding (N18). */
    if (DICHT[d.status] && !d.sos.some(x => !x.ok)) d.posities = {};
    save();
    for (const k of [d.a, d.b]) sseToCustomer(k, 'sync', { scope: 'ontmoeting' });
    sseToOffice('sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true };
  }
  /* WebRTC-signaal doorgeven (lid <-> kantoor) voor het live meekijken BIJ EEN
     SOS. Die laatste drie woorden stonden in het commentaar en nergens in de
     code: er werd alleen gecontroleerd dat de afspraak van de beller was. Elk
     lid met een willekeurige afspraak kon dus op elk moment een zelfgekozen
     payload het kantoorscherm op duwen -- een open kanaal naar de meldkamer
     zonder dat er iets aan de hand was, en precies het scherm waar men op
     hoort te vertrouwen als er wél iets is.

     Nu geldt wat er stond: alleen zolang er een SOS OPENSTAAT op deze
     afspraak. Is hij afgehandeld (elke melding heeft een .ok) dan valt het
     kanaal dicht, want dan is er niets meer om mee te kijken.

     En een grens op de payload. Dit gaat als SSE naar elk open kantoorscherm;
     zonder bovengrens is een handvol verzoeken genoeg om die schermen vol te
     duwen. Een WebRTC-signaal is een SDP of een ICE-kandidaat en past daar
     ruim binnen. */
  const SIGNAAL_MAX = 64 * 1024;
  function signaalNaarKantoor(key, dateId, payload) {
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    const openSos = Array.isArray(d.sos) && d.sos.some(x => !x.ok);
    if (!openSos) return { status: 409, error: 'Er loopt geen SOS op deze afspraak.' };
    let groot = 0;
    try { groot = JSON.stringify(payload == null ? '' : payload).length; } catch (e) { return { status: 400, error: 'Dit signaal kan ik niet lezen.' }; }
    if (groot > SIGNAAL_MAX) return { status: 413, error: 'Dit signaal is te groot.' };
    sseToOffice('ontmoeting-signaal', { dateId: d.id, van: key, codenaam: codenaamVan(key), payload });
    return { status: 200, ok: true };
  }
  function signaalNaarLid(dateId, naarKey, payload) {
    const d = dateVoor(naarKey, dateId);   // zelfde controle, met de lijsten()-borging (geen crash op een lege collectie)
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    sseToCustomer(naarKey, 'ontmoeting-signaal', { dateId, vanKantoor: true, payload });
    return { status: 200, ok: true };
  }

  /* VERGEET VERLOPEN SOS-POSITIES (NAVIGATIE.md N18), voor de bewaarveger. De
     plek van een SOS blijft zolang hij open is en 90 dagen na het afhandelen
     door het kantoor; het lid kan een SOS niet zelf intrekken, dus hier geldt
     alleen de termijn. Als vangnet gaan ook de live-posities weg van een
     afspraak die voorbij is en geen open SOS meer heeft. */
  const DICHT = { afgerond: 1, geannuleerd: 1 };
  function vergeetSosPosities(t) {
    let n = 0;
    for (const d of db.data.ontmoetDates || []) {
      if (!Array.isArray(d.sos)) continue;
      n += sosPositie.veeg(d.sos, { velden: ['lat', 'lng'], dicht: s => s.ok && s.ok.at, nu: t });
      if (DICHT[d.status] && !d.sos.some(x => !x.ok) && d.posities && Object.keys(d.posities).length) { d.posities = {}; n++; }
    }
    return n;
  }

  return { sos, sosAf, signaalNaarKantoor, signaalNaarLid, vergeetSosPosities };
};
