/* De maandfactuur betalen uit het eigen RTG Pay-saldo -- de derde betaalweg,
   naast de kaart (routes/member/betalen.js) en de munten (betalen-munt.js).

   De wallet kon alles betalen behalve het eigen lidmaatschap: de kassa, een
   pakket, een Klompje -- maar het belangrijkste terugkerende geldmoment van
   het huis liep verplicht over de kaart. Deze module dicht die naad met wat
   er al staat, en voegt bewust GEEN nieuwe geldweg toe:

   - de afschrijving loopt via pay.huisIn (lid -> huisrekening), met de
     idempotentie en de autolaad die daar al wonen; de idem-sleutel is hier
     deterministisch (wie + factuurnummer), dus een herhaald verzoek boekt
     nooit dubbel;
   - de afwikkeling loopt via settleFactuur (kern/settlement.js), DEZELFDE
     als voor de kaart- en muntbevestigingen. Daardoor gelden ook hier de
     bedragcontrole (te weinig = deelbetaling, factuur blijft open) en de
     30%-afdracht aan de RTFoundation, zonder dat die regels ergens een
     tweede keer staan.

   De betaalkern wordt pas na deze module gebouwd (kernlaag), vandaar payVan
   als late binding -- hetzelfde draadje als payOplaadAfronden in de
   settlement. */
function maakFactuurSaldo({ db, accounts, settleFactuur, payVan, broadcastSync }) {
  const bezig = new Set();

  async function factuurSaldo({ own, accountId, wie, tier, codenaam, invoiceId }) {
    // dezelfde zekering als het kaartpad (routes/member/betalen.js): een
    // factuurbetaling die de boardroom stilzette, loopt ook hier niet door
    const zPay = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.betalingen;
    if (zPay && zPay.aan === false) return { status: 503, error: 'Betalen is tijdelijk uitgeschakeld.' };
    const pay = payVan && payVan();
    if (!pay) return { status: 503, error: 'De betaalkern is nog niet wakker; probeer het zo weer.' };
    const md = own ? accounts.getMemberState(accountId) : db.data;
    const inv = md && (md.invoices || []).find(i => i.id === String(invoiceId || ''));
    if (!inv) return { status: 404, error: 'Factuur niet gevonden.' };
    if (inv.status === 'paid') return { status: 409, error: 'Deze factuur is al betaald.' };
    // wat er nog openstaat: het gevraagde bedrag min wat er al als
    // deelbetaling binnenkwam (de muntweg kan een factuur half vullen)
    const centen = Math.round((inv.bijdrage || 0) * 100) - Math.round(inv.deelbetaald || 0);
    if (centen < 1) return { status: 409, error: 'Op deze factuur staat niets meer open.' };
    /* Twee gelijktijdige verzoeken lezen allebei "open" voordat de eerste
       heeft geboekt; de idem-sleutel vangt herhalingen, dit slot vangt de
       race binnen het proces (zelfde vorm als de in-vlucht-map van directpay). */
    const slot = wie + ':' + inv.id;
    if (bezig.has(slot)) return { status: 409, error: 'Deze betaling loopt al.' };
    bezig.add(slot);
    try {
      const b = await pay.huisIn({
        vanCodenaam: codenaam, centen,
        oms: 'RTG factuur ' + inv.id,
        idem: wie + ':inv-saldo:' + inv.id
      });
      if (b.error) return b;
      await settleFactuur(
        { soort: 'factuur', wie, invoiceId: inv.id, own, accountId },
        { id: 'pay:' + b.boeking, centen: b.centen, hoe: 'Betaald uit RTG Pay-saldo' });
      if (broadcastSync && tier) broadcastSync([tier], 'payments');
      return { ok: true, betaald: b.centen, bijgeladen: b.bijgeladen || 0 };
    } finally { bezig.delete(slot); }
  }

  return { factuurSaldo };
}

module.exports = { maakFactuurSaldo };
