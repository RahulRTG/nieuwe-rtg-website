/* Luchthaven, deelbestand "grond": het platform (de draai per vertrekkende
   kist), de toren (baanklaring: de mens in de toren beslist), de bagagekelder
   (de kofferketen met vermist en gevonden), de security-filters met live
   wachttijden. De cockpit met signalen en de AI-operations staan in
   ./cockpit.js; die kijken en adviseren. Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { save, anthropic, nu, schoon, vandaag, L, seed, vluchten, vind, actief, catVan,
    draaiTakenVoor, draaiRond, vipRond, publiek,
    GATES, STANDS, HELIPADS, BANEN, CATEGORIEEN, DRAAI_TAKEN, KOFFER_KETEN, VIP_SOORTEN, VIP_PROTOCOL } = ctx;

  /* ---------- het platform: de draai per vertrekkende kist ---------- */
  function draaiTaak(actor, vid, taak) {
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!draaiTakenVoor(v).includes(taak)) return { status: 400, error: 'Deze platformtaak hoort niet bij een ' + catVan(v) + ' (' + draaiTakenVoor(v).join(', ') + ').' };
    if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
    if (v.draai[taak]) return { status: 409, error: 'Deze taak is al afgevinkt.' };
    v.draai[taak] = { door: actor || 'platform', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v), rond: draaiRond(v) };
  }

  /* ---------- de toren: baanklaring (de mens in de toren beslist) ---------- */
  function torenKlaring(actor, vid, baan) {
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (v.klaring) return { status: 409, error: 'Deze vlucht heeft al klaring (baan ' + v.klaring.baan + ').' };
    if (v.status !== 'boarding') return { status: 409, error: 'Klaring volgt pas als de kist aan het boarden is.' };
    // een helikopter krijgt klaring op een helipad, al het andere op een baan
    const keuze = catVan(v) === 'helikopter' ? HELIPADS : BANEN;
    if (!keuze.includes(baan)) return { status: 400, error: 'Kies voor een ' + catVan(v) + ' een klaring op: ' + keuze.join(', ') + '.' };
    v.klaring = { baan, door: actor || 'toren', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v) };
  }

  /* ---------- de bagagekelder: de kofferketen ---------- */
  function bagage(filter) {
    seed(); filter = filter || {};
    let lijst = L().koffers;
    if (KOFFER_KETEN.includes(filter.status) || filter.status === 'vermist') lijst = lijst.filter(k => k.status === filter.status);
    return { ok: true, keten: KOFFER_KETEN, koffers: lijst.slice(0, 200).map(k => {
      const v = vind(k.vluchtId);
      return { tag: k.tag, vlucht: v ? v.nummer : '?', codenaam: k.codenaam, status: k.status, band: k.band };
    }) };
  }
  function bagageZet(actor, tag, status) {
    const k = L().koffers.find(x => x.tag === String(tag || '').toUpperCase());
    if (!k) return { status: 404, error: 'Koffer niet gevonden.' };
    if (status === 'vermist') {
      if (k.status === 'opgehaald') return { status: 409, error: 'Deze koffer is al opgehaald.' };
      k.status = 'vermist'; save();
      return { ok: true, koffer: { tag: k.tag, status: k.status } };
    }
    if (k.status === 'vermist' && status === 'op-band') { k.status = 'op-band'; save(); return { ok: true, koffer: { tag: k.tag, status: k.status }, gevonden: true }; }
    if (!KOFFER_KETEN.includes(status)) return { status: 400, error: 'Onbekende kofferstatus.' };
    /* 'vermist' staat bewust BUITEN de keten, dus indexOf geeft -1 en dan laten
       allebei de grendels hieronder los: 'ingecheckt' (naar = 0) haalt zowel
       `0 <= -1` als `0 > -1 + 1` niet. Een vermiste koffer sprong zo terug naar
       het begin van de keten en verdween uit de vermisttelling -- het probleem
       weg van het bord in plaats van van de band. De enige bedoelde terugweg
       staat een regel hierboven: vermist -> op-band, met gevonden:true. */
    if (!KOFFER_KETEN.includes(k.status))
      return { status: 409, error: 'Deze koffer staat als ' + k.status + ' geregistreerd; die kan alleen terug via de band als hij gevonden is.' };
    const van = KOFFER_KETEN.indexOf(k.status), naar = KOFFER_KETEN.indexOf(status);
    if (naar <= van) return { status: 409, error: 'De bagageketen draait niet achteruit.' };
    if (naar > van + 1) return { status: 409, error: 'Stap voor stap: na ' + k.status + ' komt ' + KOFFER_KETEN[van + 1] + '.' };
    k.status = status;
    save();
    return { ok: true, koffer: { tag: k.tag, status: k.status } };
  }

  /* ---------- security: de filters met live wachttijden ---------- */
  function securityZet(actor, fid, data) {
    data = data || {};
    const f = L().security.find(x => x.id === String(fid || ''));
    if (!f) return { status: 404, error: 'Filter niet gevonden.' };
    if (typeof data.open === 'boolean') f.open = data.open;
    if (data.wachtMinuten != null) {
      const w = Math.round(Number(data.wachtMinuten));
      if (!Number.isFinite(w) || w < 0 || w > 180) return { status: 400, error: 'Wachttijd in minuten (0-180).' };
      f.wachtMinuten = w;
    }
    save();
    return { ok: true, filter: { id: f.id, naam: f.naam, open: f.open, wachtMinuten: f.wachtMinuten } };
  }

  /* De cockpit en de AI-operations staan in ./cockpit.js: die kijken over dit
     werk heen en veranderen niets. Elk signaal daar komt uit twee dingen
     tegelijk en is daarom nergens te zien zolang je de lijsten los bekijkt. */
  const { cockpit, luchtAI } = require('./cockpit')(ctx);

  return { draaiTaak, torenKlaring, bagage, bagageZet, securityZet, cockpit, luchtAI };
};
