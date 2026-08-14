/* Online betalen voor bezorgen en afhalen. De bestelling blijft de bestaande
   horecarekening; deze laag voegt alleen de provider-onafhankelijke waarheid
   en de vrijgavegrendel toe. Geen definitieve providerstand = geen keukenbon. */
'use strict';

module.exports = function betaalBuiten(ctx) {
  const { zaakVan, handleVan, horeca, orderlaag, naad } = ctx;
  const { app, auth, betaal, betaalWaarheid, geldgraaf, appUrl, save,
    sseToSupplier, gegevensStop } = ctx.kern;

  function geldschildVan(req, centen) {
    if (!geldgraaf || req.session.tier === 'guest') return {
      niveau: 'onbeschikbaar', icoon: '◷', titel: 'Geldschild voor leden',
      uitleg: 'Log in als lid om deze bestelling naast je eigen geldplanning te leggen.' };
    try {
      const c = geldgraaf.cockpit(req.session.key);
      const stil = Array.isArray(c.stil) ? c.stil : [];
      const vrij = c.cijfers && Number(c.cijfers.vrijCenten);
      const einde = c.cijfers && Number(c.cijfers.eindeMaandCenten);
      const onvolledig = stil.length > 0 || !Number.isFinite(vrij);
      const aandacht = !onvolledig && (centen > vrij || (c.uitzonderingen || []).some(x => x.niveau === 'klaarzetten'));
      return { niveau: onvolledig ? 'onvolledig' : aandacht ? 'aandacht' : 'rust',
        icoon: onvolledig ? '◷' : aandacht ? '!' : '✓',
        titel: onvolledig ? 'Beeld nog niet compleet' : aandacht ? 'Even bewust bekijken' : 'Past binnen je vrije ruimte',
        uitleg: onvolledig ? 'Niet alle geldbronnen zijn bereikbaar. RTG doet daarom geen stellige belofte.'
          : aandacht ? 'Je bevestigt altijd zelf; het Geldschild signaleert alleen.'
          : 'Na deze bestelling blijft er volgens de huidige geldbronnen vrije ruimte over.',
        // Toon alleen bedragen als alle bronnen compleet zijn. Een rekenkundig
        // getal uit een onvolledig beeld lijkt anders ten onrechte zekerheid.
        vrijNaCenten: !onvolledig && !aandacht && Number.isFinite(vrij) ? vrij - centen : null,
        eindeMaandNaCenten: !onvolledig && !aandacht && Number.isFinite(einde) ? einde - centen : null,
        vrijeRuimteCenten: !onvolledig && aandacht && Number.isFinite(vrij) ? Math.max(0, vrij) : null,
        verschilCenten: !onvolledig && aandacht && Number.isFinite(vrij) ? Math.max(0, centen - vrij) : null,
        bronnenCompleet: !onvolledig };
    } catch (e) {
      return { niveau: 'onvolledig', icoon: '◷', titel: 'Geldschild tijdelijk onvolledig',
        uitleg: 'Betalen blijft jouw keuze. Er wordt geen zekerheid verzonnen.' };
    }
  }

  function verrijkCheckout(req, uit) {
    const m = betaal.mogelijkheden();
    const online = m.rails.filter(x => ['stripe', 'mollie', 'adyen', 'demo'].includes(x.id));
    uit.betaling.keuzes = [{ id: 'ontvangst', label: uit.kanaal === 'bezorging'
      ? 'Betalen bij ontvangst' : 'Betalen bij afhalen', provider: null, echt: true }]
      .concat(online.map(x => ({ id: 'online-' + x.id, label: x.label,
        provider: x.id, echt: x.echt, demo: !x.echt })));
    const echtOnline = online.find(x => x.echt);
    uit.betaling.standaard = echtOnline ? 'online-' + echtOnline.id : 'ontvangst';
    uit.geldschild = geldschildVan(req, uit.totaalCenten);
    return uit;
  }

  function rekeningVan(zaakcode, rekeningId, handle) {
    const r = horeca.H(zaakcode).rekeningen[String(rekeningId || '')];
    return r && naad.isVan(r, handle) ? r : null;
  }

  function maakVrij(rek) {
    const tijd = (rek.bezorg && rek.bezorg.tijd) || (rek.afhaal && rek.afhaal.tijd) || null;
    for (const regel of (rek.regels || [])) {
      if (regel.bezorgkosten || regel.stand === 'uitgegeven' || regel.bevestiging === 'wacht') continue;
      if (!regel.vrijAt) regel.vrijAt = horeca.nu();
      if (tijd && !regel.serveerOm) regel.serveerOm = tijd;
    }
  }

  betaalWaarheid.registreerAfhandeling('horeca-bestelling', async (waarheid) => {
    const c = waarheid.context || {};
    const rek = rekeningVan(c.zaakcode, c.rekeningId, waarheid.actor);
    if (!rek) throw new Error('De horecarekening van deze betaling is niet gevonden.');
    if (!(rek.betalingen || []).some(x => x.waarheidId === waarheid.id)) {
      const open = horeca.openstaand(rek);
      if (open !== waarheid.centen) throw new Error('Het openstaande rekeningbedrag wijkt af van de bevestigde betaling.');
      rek.betalingen.push({ id: 'bw:' + waarheid.id, waarheidId: waarheid.id,
        providerId: waarheid.providerId, wijze: waarheid.provider === 'mollie' ? 'Mollie' :
          waarheid.provider === 'stripe' ? 'Stripe' : waarheid.provider === 'adyen' ? 'Adyen' : 'Demo',
        centen: waarheid.centen, at: horeca.nu() });
    }
    if (horeca.openstaand(rek) <= 0) rek.status = 'betaald';
    rek.betaalStatus = 'bevestigd';
    delete rek.betaalSlot;
    maakVrij(rek);
    orderlaag.audit(rek, { actor: waarheid.actor, bron: 'betaalwaarheid',
      wat: 'online-betaling', van: 'wacht', naar: 'bevestigd', reden: waarheid.provider });
    save();
    try { sseToSupplier(c.zaakcode, 'sync', { scope: 'horeca' }); } catch (e) {}
  });

  function bewaakRekening(rek) {
    if (!rek || !rek.betaalSlot) return null;
    const w = betaalWaarheid.van(rek.betaalSlot.betalingId);
    if (!w || ['GEWEIGERD', 'GEANNULEERD'].includes(w.status)) {
      delete rek.betaalSlot; save(); return null;
    }
    return { status: 409, code: 'betaling-loopt',
      error: 'Deze bestelling wacht al op een betaalbevestiging. Betaal niet opnieuw; bekijk eerst de actuele stand.' };
  }

  app.post('/api/gast/bezorg/betaling/start', auth, async (req, res) => {
    if (gegevensStop(req, res, 'bestelling')) return;
    const s = zaakVan(req, res); if (!s) return;
    const b = req.body || {};
    const handle = handleVan(req);
    const rek = rekeningVan(s.code, b.rekeningId, handle);
    if (!rek) return res.status(404).json({ error: 'Deze bestelling is niet van jou.', code: 'rekening-onbekend' });
    if (rek.status !== 'open') return res.status(409).json({ error: 'Deze bestelling is al afgerekend.', code: 'al-betaald' });
    if ((rek.regels || []).some(x => x.bevestiging === 'wacht'))
      return res.status(409).json({ error: 'Een medewerker controleert eerst je allergie of bestellimiet. Daarna kan online betalen veilig starten.', code: 'persoonlijke-controle' });
    const bestaandSlot = bewaakRekening(rek);
    if (bestaandSlot) return res.status(bestaandSlot.status).json(bestaandSlot);
    const open = horeca.openstaand(rek);
    if (open <= 0) return res.status(409).json({ error: 'Er staat niets meer open.', code: 'niets-open' });
    let w;
    try {
      w = betaalWaarheid.maak({ actor: handle, idem: String(b.idem || ''),
        soort: 'horeca-bestelling', bronRef: rek.id, supplierCode: s.code,
        centen: open, valuta: 'eur', context: { zaakcode: s.code, rekeningId: rek.id, kanaal: rek.kanaal } });
      rek.betaalSlot = { betalingId: w.id, centen: open, at: horeca.nu() };
      rek.betaalVoorkeur = 'online';
      save();
      const basis = appUrl(req);
      const uit = await betaalWaarheid.begin(w.id, { aanbieder: b.aanbieder,
        methode: b.aanbieder === 'mollie' ? 'ideal' : b.aanbieder === 'stripe' ? 'hosted' : 'online',
        omschrijving: (s.name + ' · bestelling ' + rek.id).slice(0, 120),
        returnUrl: basis + '/apps/bestellen.html?betaling=' + encodeURIComponent(w.id),
        webhookUrl: basis + '/api/betaal/webhook/mollie' });
      if (['GEWEIGERD', 'GEANNULEERD'].includes(uit.betaling.status)) delete rek.betaalSlot;
      save();
      return res.json(Object.assign({ ok: true, rekeningId: rek.id }, uit));
    } catch (e) {
      if (w && rek.betaalSlot && rek.betaalSlot.betalingId === w.id && !w.providerId) delete rek.betaalSlot;
      save();
      return res.status(502).json({ error: 'De betaling kon niet veilig starten. Je bestelling staat wel opgeslagen; er is niets dubbel afgeschreven.', code: 'provider-niet-bereikbaar' });
    }
  });

  app.post('/api/gast/bezorg/betaling/status', auth, async (req, res) => {
    const handle = handleVan(req);
    const w = betaalWaarheid.vanActor((req.body || {}).betalingId, handle);
    if (!w) return res.status(404).json({ error: 'Deze betaling is niet van jou.' });
    try {
      if (w.providerId && ['WACHT_OP_KLANT', 'IN_BEHANDELING'].includes(w.status)) {
        const p = await betaal.haalBetaling(w.provider, w.providerId);
        await betaalWaarheid.providerMelding({ eventId: 'controle:' + p.id + ':' + p.status,
          gebeurtenis: 'status.controle', aanbieder: p.aanbieder, providerId: p.id,
          status: p.status, referentie: p.referentie, bedrag: p.bedrag, valuta: p.valuta });
      }
    } catch (e) { /* de duurzame laatste stand blijft zichtbaar; nooit gokken */ }
    const vers = betaalWaarheid.van(w.id);
    return res.json({ ok: true, betaling: betaalWaarheid.publiek(vers) });
  });

  return { verrijkCheckout, bewaakRekening, maakVrij };
};
