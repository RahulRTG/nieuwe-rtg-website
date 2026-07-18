/* Shared-assets (deelmodule): mijn tickets, een 24-uursblok boeken en de uitstap (terugkoop of overdracht).
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/assets.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notify, pay,
    TICKETS_PER_OBJECT, UREN_PER_TICKET, JAREN_GELDIG, BETALENDE_PASSEN, BEDENKTIJD_DAGEN,
    TERUGKOOP_VENSTER_DAGEN, SERVICE_FEE_PCT, OVERDRACHT_FEE_PCT, ONDERHOUD_DAGEN, PIEK_MAANDEN,
    ACCESS_FACTOR, ASSET_FACTOR, netjes,
    nu, vandaag, lijsten, objectVan, ticketWaarde, prijsAccessVan, prijsAssetVan, serviceFeeVan,
    actieveVan, bezetVan, magKopen, kasAdd, binnenBedenktijd } = ctx;
  function assetMijn(key) {
    lijsten();
    const jaar = new Date().getFullYear();
    const posities = db.data.sharedAssets.map(a => {
      const mijn = actieveVan(a.id).filter(t => t.key === key);
      const wachtend = db.data.assetTerugkoop.filter(v => v.assetId === a.id && v.key === key && v.status === 'aangevraagd');
      if (!mijn.length && !wachtend.length) return null;
      const gebruikt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === key && g.datum.slice(0, 4) === String(jaar)).length;
      return {
        assetId: a.id, naam: a.naam, icon: a.icon, soort: a.soort, entiteit: a.entiteit,
        tickets: mijn.length,
        access: mijn.filter(t => t.smaak === 'access').length,
        asset: mijn.filter(t => t.smaak === 'asset').length,
        dagenTegoed: Math.max(0, mijn.length - gebruikt),
        gebruiktDitJaar: gebruikt,
        vervaltOp: mijn.length ? mijn.map(t => t.vervaltOp).sort()[0] : null,
        ticketWaarde: ticketWaarde(a),
        serviceFee: serviceFeeVan(a),
        uitstapWaarde: mijn.filter(t => t.smaak === 'asset').length * ticketWaarde(a),
        assetTicketIds: mijn.filter(t => t.smaak === 'asset').map(t => t.id),
        herroepbaar: mijn.filter(binnenBedenktijd).map(t => ({ id: t.id, smaak: t.smaak, prijs: t.prijs })),
        terugkoopOnderweg: wachtend.map(v => ({ waarde: v.waarde, uiterlijk: v.uiterlijk })),
        gepland: db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === key && g.datum >= vandaag()).map(g => g.datum).sort().slice(0, 6)
      };
    }).filter(Boolean);
    return { ok: true, posities };
  }

  /* 24 uur boeken: een dag-tegoed van het jaar waarin de dag valt. Het object
     is een dag per keer voor een gezelschap, en hooguit de helft van je dagen
     valt in het piekseizoen (juli/augustus). */
  function assetGebruik(sess, assetIdIn, datumIn) {
    lijsten();
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const datum = String(datumIn || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < vandaag()) return { status: 400, error: 'Kies een dag vanaf vandaag.' };
    const mijn = actieveVan(a.id).filter(t => t.key === sess.key && t.vervaltOp >= datum);
    if (!mijn.length) return { status: 403, error: 'U heeft geen (geldige) tickets voor dit object.' };
    // een object, een gezelschap per dag: de dagclaim is poolbreed
    const claim = db.data.assetGebruik.find(g => g.assetId === a.id && g.datum === datum);
    if (claim && claim.key !== sess.key) return { status: 409, error: 'Die dag is al vergeven aan een ander pool-lid. Kies een andere dag.' };
    if (claim) return { status: 409, error: 'U heeft deze dag al geboekt.' };
    const jaar = datum.slice(0, 4);
    const gebruikt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === sess.key && g.datum.slice(0, 4) === jaar);
    if (gebruikt.length >= mijn.length) return { status: 400, error: 'Uw ' + mijn.length * UREN_PER_TICKET + ' uur voor ' + jaar + ' is geboekt; de teller reset op 1 januari.' };
    // piekregel: iedereen wil augustus, dus hooguit de helft van je dagen daar
    if (PIEK_MAANDEN.includes(datum.slice(5, 7))) {
      const piek = gebruikt.filter(g => PIEK_MAANDEN.includes(g.datum.slice(5, 7))).length;
      const max = Math.ceil(mijn.length / 2);
      if (piek >= max) return { status: 400, error: 'Piekseizoen: hooguit ' + max + ' van uw ' + mijn.length + ' dag(en) in juli/augustus, zodat iedereen in de pool aan de beurt komt.' };
    }
    const g = { id: crypto.randomBytes(4).toString('hex'), assetId: a.id, assetNaam: a.naam, key: sess.key, datum, at: nu() };
    db.data.assetGebruik.unshift(g);
    db.data.assetGebruik = db.data.assetGebruik.slice(0, 500000);
    save();
    notify(sess.key, { icon: a.icon, title: a.naam + ' staat voor u klaar', body: datum + ': uw 24 uur is vastgelegd. Het team neemt vooraf contact op.', scope: 'assets' });
    return { ok: true, gebruik: g, dagenTegoed: mijn.length - gebruikt.length - 1 };
  }

  /* Uitstappen (alleen de Asset-smaak), langs de trap:
     1. wachtlijst-koper aanwezig -> directe overdracht (verkoper ontvangt de
        ticketwaarde, koper betaalt ticketwaarde + 5% naar de poolkas);
     2. anders een terugkoopverzoek: RTG-kantoor betaalt uiterlijk binnen
        dertig dagen uit via een Tik, uit de poolkas. */
  async function assetUitstap(sess, codenaam, ticketIdIn) {
    lijsten();
    const t = db.data.assetTickets.find(x => x.id === String(ticketIdIn || '') && x.key === sess.key && x.status === 'actief');
    if (!t) return { status: 404, error: 'Ticket niet gevonden.' };
    if (t.smaak !== 'asset') return { status: 400, error: 'Access-tickets hebben geen restwaarde; ze lopen gewoon af. Binnen de bedenktijd kunt u wel herroepen.' };
    const a = objectVan(t.assetId);
    const waarde = ticketWaarde(a);
    const wi = db.data.assetWachtlijst.findIndex(w => w.assetId === a.id && w.key !== sess.key);
    if (wi >= 0) {
      // trap 1: de wachtlijst neemt over; het ticket verhuist met restlooptijd en al
      const koper = db.data.assetWachtlijst.splice(wi, 1)[0];
      const fee = netjes(waarde * OVERDRACHT_FEE_PCT);
      t.key = koper.key; t.codenaam = koper.codenaam; t.tier = koper.tier;
      t.akkoord = nu(); t.at = nu(); // nieuwe eigenaar, nieuwe bedenktijd
      kasAdd(a.id, fee * 100);
      save();
      try { await pay.stuur({ van: koper.codenaam, aanCodenaam: 'RTG Treasury', centen: (waarde + fee) * 100, oms: 'Overname Asset-ticket ' + a.naam + ' (incl. ' + Math.round(OVERDRACHT_FEE_PCT * 100) + '% overdracht)', idem: 'overname-' + t.id + '-' + koper.id, soort: 'tik' }); } catch (e) {}
      try { await pay.stuur({ van: 'RTG Treasury', aanCodenaam: codenaam, centen: waarde * 100, oms: 'Verkoop Asset-ticket ' + a.naam + ' via de wachtlijst', idem: 'uitstap-' + t.id + '-' + koper.id, soort: 'tik' }); } catch (e) {}
      notify(sess.key, { icon: '💰', title: 'Verkocht via de wachtlijst', body: a.naam + ': de Tik van € ' + waarde + ' staat in uw tegoed.', scope: 'assets' });
      notify(koper.key, { icon: a.icon, title: 'U bent aan de beurt: ' + a.naam, body: 'Het Asset-ticket is van u (€ ' + waarde + ' + € ' + fee + ' overdracht). Restlooptijd tot ' + t.vervaltOp + '.', scope: 'assets' });
      return { ok: true, soort: 'overdracht', waarde, naar: koper.codenaam };
    }
    // trap 2: terugkoop door RTG, uitbetaling binnen het venster door het kantoor
    const uiterlijk = new Date(Date.now() + TERUGKOOP_VENSTER_DAGEN * 86400000).toISOString().slice(0, 10);
    t.status = 'uitstap-aangevraagd';
    const v = { id: crypto.randomBytes(4).toString('hex'), ticketId: t.id, assetId: a.id, assetNaam: a.naam, key: sess.key, codenaam: schoon(codenaam, 40), waarde, at: nu(), uiterlijk, status: 'aangevraagd' };
    db.data.assetTerugkoop.unshift(v);
    db.data.assetTerugkoop = db.data.assetTerugkoop.slice(0, 50000);
    save();
    notify(sess.key, { icon: '⏳', title: 'Terugkoop aangevraagd: ' + a.naam, body: 'Er staat nu geen koper op de wachtlijst; RTG koopt terug en betaalt uiterlijk ' + uiterlijk + ' € ' + waarde + ' uit via een Tik.', scope: 'assets' });
    return { ok: true, soort: 'terugkoop-aangevraagd', waarde, uiterlijk, verzoek: v };
  }

  /* Hertaxatie door RTG-kantoor: de objectwaarde beweegt, en daarmee schuiven
     de ticketwaarde, de uitstapwaarde en de prijzen van beide smaken
     automatisch mee. De pool-leden krijgen er direct bericht van. */
  return { assetMijn, assetGebruik, assetUitstap };
};
