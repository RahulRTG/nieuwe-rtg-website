/* RTG Shared Assets, deelbestand "aanvraag-betaal": stap 3 en 4 van de
   aanvraag (./aanvraag.js) -- na goedkeuring betalen via de betaalwaarheid,
   de tickets pas na een definitieve betaling en precies een keer, en herroepen
   dat alleen zegt wat waar is. Apart van ./aanvraag.js om de 10 kB. */
'use strict';
const tijdzone = require('../tijdzone');

module.exports = (ctx, { lijst, publiek, SOORT }) => {
  const { ticketsVoor, geefTicketsUit, save, crypto, notify, betaalWaarheid, nu, objectVan, ticketWaarde, kasAdd, binnenBedenktijd,
    bezetVan, UREN_PER_TICKET, JAREN_GELDIG, BEDENKTIJD_DAGEN, TICKETS_PER_OBJECT } = ctx;

  /* Stap 4: de tickets, precies een keer, alleen na een definitieve betaling. */
  function maakTickets(x) {
    if (x.status === 'betaald') return;
    const vervalt = new Date(); vervalt.setUTCFullYear(vervalt.getUTCFullYear() + JAREN_GELDIG);
    const tickets = [];
    for (let i = 0; i < x.aantal; i++) tickets.push({ id: crypto.randomBytes(4).toString('hex'),
      ref: 'RTG-SA-' + crypto.randomBytes(3).toString('hex').toUpperCase(), assetId: x.assetId, assetNaam: x.assetNaam,
      key: x.key, codenaam: x.codenaam, tier: x.tier, smaak: x.smaak, prijs: x.prijs, urenPerJaar: UREN_PER_TICKET,
      at: nu(), vervaltOp: vervalt.toISOString().slice(0, 10), akkoord: x.akkoord, status: 'actief', uitstap: null,
      feeJaar: tijdzone.jaarIn(), aanvraagId: x.id, betalingId: x.betalingId });
    geefTicketsUit(tickets);
    const a = objectVan(x.assetId);
    if (x.smaak === 'asset' && a) kasAdd(a.id, (x.prijs - ticketWaarde(a)) * 100 * x.aantal);
    x.status = 'betaald'; x.ticketIds = tickets.map(t => t.id); x.betaaldAt = nu();
    save();
    notify(x.key, { icon: 'betalen', title: 'Welkom in de pool van ' + x.assetNaam, scope: 'assets',
      body: x.aantal + ' ticket(s) staan klaar. U heeft ' + BEDENKTIJD_DAGEN + ' dagen bedenktijd.' });
  }
  if (betaalWaarheid) betaalWaarheid.registreerAfhandeling(SOORT, async (w) => {
    const x = lijst().find(y => y.id === (w.context && w.context.aanvraagId));
    if (!x) throw new Error('De aanvraag bij deze betaling bestaat niet.');
    if (x.status === 'goedgekeurd' || x.status === 'betaling-loopt') maakTickets(x);
  });

  /* `idem`: een sleutel per betaalpoging van het scherm. Een lopende of geslaagde
     betaling start nooit opnieuw; alleen na een weigering mag een nieuwe poging. */
  async function betaal(sess, id, idem) {
    const x = lijst().find(y => y.id === String(id || '') && y.key === sess.key);
    if (!x) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (x.status === 'betaald') return { ok: true, aanvraag: publiek(x), herhaald: true };
    if (!['goedgekeurd', 'betaling-loopt'].includes(x.status)) return { status: 409, error: x.status === 'aangevraagd' ? 'Een mens van RTG beoordeelt deze aanvraag nog; betalen kan daarna.' : 'Deze aanvraag kan niet (meer) betaald worden.' };
    if (!betaalWaarheid) return { status: 503, error: 'De betaalwaarheid is niet aangesloten; er is niets afgeschreven.' };
    // de pool is 300: tickets en lopende betalingen van anderen tellen mee, en vol is vol VOOR er geld gaat
    const loopt = lijst().filter(y => y !== x && y.assetId === x.assetId && y.status === 'betaling-loopt').reduce((n, y) => n + y.aantal, 0);
    if (x.aantal > TICKETS_PER_OBJECT - bezetVan(x.assetId).length - loopt) return { status: 409, error: 'Uitverkocht sinds uw aanvraag. Er is niets afgeschreven; zet u op de wachtlijst.' };
    const vorige = x.betalingId && betaalWaarheid.van(x.betalingId);
    const opnieuw = !vorige || ['GEWEIGERD', 'GEANNULEERD'].includes(vorige.status);
    let w = vorige;
    try {
      if (opnieuw) w = betaalWaarheid.maak({ actor: 'asset:' + x.key, soort: SOORT, bronRef: x.id,
        idem: SOORT + ':' + x.id + ':' + (typeof idem === 'string' && idem ? idem.slice(0, 80) : 'eerste'),
        centen: x.totaalCenten, valuta: 'eur', context: { aanvraagId: x.id } });
    } catch (e) { return { status: 409, error: e.message }; }
    x.betalingId = w.id; x.status = x.status === 'goedgekeurd' ? 'betaling-loopt' : x.status; save();
    try { await betaalWaarheid.begin(w.id, { omschrijving: 'RTG Shared Assets · ' + x.assetNaam }); }
    catch (e) { return { status: 502, betalingId: w.id, error: 'De betaling gaf geen uitsluitsel. Betaal niet opnieuw: RTG zoekt het na met dezelfde sleutel.' }; }
    const r = betaalWaarheid.van(w.id) || {};
    if (x.status === 'betaald') return { ok: true, aanvraag: publiek(x) };
    if (r.status === 'GEWEIGERD' || r.status === 'GEANNULEERD') {
      x.status = 'goedgekeurd'; save();
      return { status: 402, betalingId: w.id, error: 'De betaling is niet gelukt. Er is niets afgeschreven en er is geen ticket.' };
    }
    return { status: 402, pending: true, betalingId: w.id, error: r.status === 'CONTROLE_NODIG' ? 'De betaling ligt bij RTG ter controle. Betaal niet opnieuw.' : 'De betaling wacht op bevestiging; uw tickets komen pas daarna.' };
  }

  /* De stand van DEZE terugbetaling, niet van de hele betaling: bij meer tickets
     onder een betaling zegt "gedeeltelijk terugbetaald" niets over dit ticket.
     De reden draagt het ticket-id en wijst zo de eigen opdracht aan. */
  const redenVan = (t) => 'Herroeping ticket ' + t.id + ' ' + t.assetNaam;
  function terugStand(t) {
    const r = t.betalingId && betaalWaarheid && betaalWaarheid.van(t.betalingId);
    const op = r && (r.terugbetaalOpdrachten || []).find(o => o.reden === redenVan(t).slice(0, 120));
    return op ? op.status : null;
  }
  function rondAf(t) {
    const a = objectVan(t.assetId);
    t.status = 'herroepen'; t.uitstap = { waarde: t.prijs, at: nu(), soort: 'herroeping' };
    if (t.smaak === 'asset' && a) kasAdd(a.id, -(t.prijs - ticketWaarde(a)) * 100);
    save();
    return { ok: true, terug: t.prijs, ticket: t, let: 'De koopsom van € ' + t.prijs + ' is terugbetaald.' };
  }
  /* Een terugbetaling die later bevestigd wordt (webhook, veegronde) rondt de
     herroeping af zodra het lid kijkt. */
  function bijwerken(key) {
    for (const t of ticketsVoor(key)) if (t.status === 'herroep-loopt' && terugStand(t) === 'BEVESTIGD') rondAf(t);
  }

  /* Herroepen: een open aanvraag sluiten, of een betaald ticket binnen de
     bedenktijd terugbetalen via de betaalwaarheid. Alleen wat waar is. */
  async function assetHerroep(sess, codenaam, idIn) {
    const id = String(idIn || '');
    const x = lijst().find(y => y.id === id && y.key === sess.key);
    if (x) {
      if (!['aangevraagd', 'goedgekeurd'].includes(x.status)) return { status: 409, error: 'Deze aanvraag is niet meer open.' };
      x.status = 'ingetrokken'; save();
      return { ok: true, aanvraag: publiek(x), let: 'De aanvraag is gesloten. Er was niets afgeschreven.' };
    }
    const t = ticketsVoor(sess.key).find(y => y.id === id && ['actief', 'herroep-loopt'].includes(y.status));
    if (!t) return { status: 404, error: 'Ticket niet gevonden.' };
    if (t.status === 'herroep-loopt') {
      const s = terugStand(t);
      if (s === 'BEVESTIGD') return rondAf(t);
      if (s === 'CONTROLE_NODIG') return { status: 409, error: 'De terugbetaling ligt bij RTG ter controle; er is nog niets teruggekomen. Uw ticket blijft staan tot dat besloten is.' };
    } else if (!binnenBedenktijd(t)) return { status: 409, error: 'De bedenktijd van ' + BEDENKTIJD_DAGEN + ' dagen is voorbij. Uitstappen kan (voor de Asset-smaak) via de wachtlijst of de terugkoop.' };
    if (!t.betalingId || !betaalWaarheid) return { status: 409, error: 'Bij dit ticket hoort geen bevestigde betaling; er valt niets terug te betalen. Het kantoor kijkt ernaar.' };
    try { await betaalWaarheid.terugbetalen(t.betalingId, { centen: t.prijs * 100, reden: redenVan(t), idem: 'herroep-' + t.id }); }
    catch (e) {
      // staat de opdracht vast maar antwoordde de bank niet, dan loopt hij; anders is hij niet gestart
      if (!terugStand(t)) return { status: 409, error: 'De terugbetaling is niet gestart: ' + String(e && e.message || e) + ' Uw ticket blijft staan.' };
    }
    const s = terugStand(t);
    if (s === 'BEVESTIGD') return rondAf(t);
    if (s === 'CONTROLE_NODIG') { t.status = 'herroep-loopt'; save(); return { status: 409, error: 'De terugbetaling ligt bij RTG ter controle; er is nog niets teruggekomen.' }; }
    t.status = 'herroep-loopt'; save();
    return { ok: true, pending: true, ticket: t, let: 'De terugbetaling van € ' + t.prijs + ' loopt; u hoort het zodra de bank haar bevestigt.' };
  }

  return { betaal, assetHerroep, bijwerken };
};
