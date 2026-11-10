/* CIVILIS-opvang, de aanbiederskant: capaciteit, acceptatie en aankomst.
   Afgesplitst van opvang.js op de 10 KB-grens; alle opslag en beelden blijven
   eigendom van de hoofdmodule. */
'use strict';

module.exports = (ctx, eigen) => {
  const { nu, schoon, audit, save } = ctx;
  const { beschermzaak, voorzieningen, reserveringen, voorzieningVan,
    reserveringVan, capaciteitVers, reserveBeeld, voorzieningBeeld, verval,
    partnerOpCode, stopVoorZaak, tijd } = eigen;

  function partnerLijst(code) {
    const g = partnerOpCode(code); if (!g.ok) return g;
    return { ok: true,
      voorzieningen: voorzieningen().filter(v => v.partnerId === g.p.id).map(voorzieningBeeld),
      reserveringen: reserveringen().filter(r => r.partnerId === g.p.id).map(verval).map(reserveBeeld) };
  }

  function capaciteit(code, b) {
    b = b || {};
    const g = partnerOpCode(code); if (!g.ok) return g;
    const v = voorzieningVan(b.voorzieningId);
    if (!v || v.partnerId !== g.p.id) return { status: 404, error: 'Deze voorziening hoort niet bij uw organisatie.' };
    const beschikbaar = Math.floor(Number(b.beschikbaar));
    if (!Number.isInteger(beschikbaar) || beschikbaar < 0 || beschikbaar > 10000) {
      return { status: 400, error: 'Beschikbaarheid is een geheel aantal plaatsen vanaf nul.' };
    }
    const geldigTot = String(b.geldigTot || '');
    const ms = Date.parse(geldigTot);
    if (!Number.isFinite(ms) || ms <= tijd() || ms > tijd() + 24 * 3600000) {
      return { status: 400, error: 'Capaciteit moet een vervaltijd in de komende 24 uur hebben.' };
    }
    v.capaciteit = { beschikbaar, geldigTot: new Date(ms).toISOString(), at: nu(), door: g.p.id };
    audit('partner:' + g.p.id, 'opvang.capaciteit', v.id, String(beschikbaar));
    save();
    return { ok: true, voorziening: voorzieningBeeld(v) };
  }

  function besluit(code, b) {
    b = b || {};
    const g = partnerOpCode(code); if (!g.ok) return g;
    const r = reserveringVan(b.id);
    if (!r || r.partnerId !== g.p.id) return { status: 404, error: 'Deze aanvraag hoort niet bij uw organisatie.' };
    verval(r);
    if (r.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag staat niet meer op aangevraagd.' };
    const z = beschermzaak.vind(r.zaakId);
    if (!z || !z.toestemming || z.ingetrokken || z.deurIngetrokken ||
        String(z.toestemming.ontvanger).toLowerCase() !== String(g.p.naam).toLowerCase()) {
      stopVoorZaak(r.zaakId, 'toestemming staat niet meer');
      return { status: 409, error: 'De toestemming staat niet meer. De aanvraag is gestopt.' };
    }
    if (b.accepteer !== true) {
      const reden = schoon(b.reden, 240);
      if (reden.length < 5) return { status: 400, error: 'Noem de reden van weigering, zodat er een alternatief kan worden gezocht.' };
      r.status = 'geweigerd'; r.weigering = { reden, at: nu(), door: g.p.id };
      z.civilisRoute = { fase: 'alternatief_nodig', bijgewerkt: nu() };
      audit('partner:' + g.p.id, 'opvang.geweigerd', r.codenaam, reden);
      save();
      return { ok: true, reservering: reserveBeeld(r), melding: 'Geweigerd. De zaakverantwoordelijke zoekt een alternatief.' };
    }
    const v = voorzieningVan(r.voorzieningId);
    if (!v || !v.actief || !capaciteitVers(v) || v.capaciteit.beschikbaar < 1) {
      return { status: 409, error: 'Er is geen actuele beschikbare plaats. Werk eerst de capaciteit bij.' };
    }
    v.capaciteit.beschikbaar -= 1;
    r.status = 'geaccepteerd'; r.geaccepteerdOp = nu(); r.geldigTot = v.capaciteit.geldigTot;
    z.civilisRoute = { fase: 'plek_bevestigd', bijgewerkt: nu() };
    (z.stappen = z.stappen || []).push({ stand: z.stand,
      tekst: 'De opvangaanbieder heeft een plaats bevestigd.', door: 'partner:' + g.p.id, at: nu() });
    audit('partner:' + g.p.id, 'opvang.geaccepteerd', r.codenaam, r.id);
    save();
    return { ok: true, reservering: reserveBeeld(r), melding: 'Geaccepteerd door de aanbieder; geldig tot de vermelde tijd.' };
  }

  function aankomst(code, b) {
    b = b || {};
    const g = partnerOpCode(code); if (!g.ok) return g;
    const r = reserveringVan(b.id);
    if (!r || r.partnerId !== g.p.id) return { status: 404, error: 'Deze reservering hoort niet bij uw organisatie.' };
    verval(r);
    if (r.status !== 'geaccepteerd') return { status: 409, error: 'Alleen een geldige geaccepteerde reservering kan aankomst krijgen.' };
    const z = beschermzaak.vind(r.zaakId);
    if (!z || !z.toestemming || z.ingetrokken || z.deurIngetrokken) {
      stopVoorZaak(r.zaakId, 'toestemming staat niet meer');
      return { status: 409, error: 'De toestemming staat niet meer. De reservering is gestopt.' };
    }
    r.status = 'aangekomen'; r.aankomst = { at: nu(), door: g.p.id };
    z.civilisRoute = { fase: 'aangekomen', bijgewerkt: nu() };
    audit('partner:' + g.p.id, 'opvang.aangekomen', r.codenaam, r.id);
    save();
    return { ok: true, reservering: reserveBeeld(r) };
  }

  return { partnerLijst, capaciteit, besluit, aankomst };
};
