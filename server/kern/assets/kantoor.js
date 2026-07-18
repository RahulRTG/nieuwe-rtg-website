/* Shared-assets (deelmodule): hertaxatie, het kantooroverzicht, terugkoop uitbetalen en de service-fees.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/assets.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notify, pay,
    TICKETS_PER_OBJECT, UREN_PER_TICKET, JAREN_GELDIG, BETALENDE_PASSEN, BEDENKTIJD_DAGEN,
    TERUGKOOP_VENSTER_DAGEN, SERVICE_FEE_PCT, OVERDRACHT_FEE_PCT, ONDERHOUD_DAGEN, PIEK_MAANDEN,
    ACCESS_FACTOR, ASSET_FACTOR, netjes,
    nu, vandaag, lijsten, objectVan, ticketWaarde, prijsAccessVan, prijsAssetVan, serviceFeeVan,
    actieveVan, bezetVan, magKopen, kasAdd, binnenBedenktijd } = ctx;
  function assetHertaxeer(assetIdIn, waardeIn, wie) {
    lijsten();
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const waarde = Math.round(Number(waardeIn));
    if (!(waarde >= 300000) || waarde > 1000000000) return { status: 400, error: 'Geef een taxatiewaarde tussen € 300.000 en € 1 miljard.' };
    const vorige = a.waarde;
    a.waarde = waarde;
    a.taxatie = { vorige, door: schoon(wie, 40) || 'RTG-kantoor', at: nu() };
    save();
    const leden = [...new Set(actieveVan(a.id).map(t => t.key))];
    const richting = waarde > vorige ? 'omhoog' : 'omlaag';
    for (const key of leden) {
      try { notify(key, { icon: a.icon, title: a.naam + ' is hertaxeerd', body: 'De ticketwaarde ging ' + richting + ' naar € ' + ticketWaarde(a) + '. Uw uitstapwaarde beweegt automatisch mee.', scope: 'assets' }); } catch (e) {}
    }
    return { ok: true, asset: { id: a.id, naam: a.naam, waarde: a.waarde, vorige, ticketWaarde: ticketWaarde(a), prijsAccess: prijsAccessVan(a), prijsAsset: prijsAssetVan(a) } };
  }

  /* ---- het kantoor: de pool besturen ---- */
  // het overzicht: verkoop, poolkas, wachtlijst, open terugkopen en de
  // restdagen die dit jaar extern verhuurd kunnen worden
  function assetKantoor() {
    lijsten();
    const jaar = String(new Date().getFullYear());
    return {
      ok: true,
      objecten: db.data.sharedAssets.map(a => {
        const bezet = bezetVan(a.id);
        const geboekt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.datum.slice(0, 4) === jaar).length;
        return {
          id: a.id, naam: a.naam, icon: a.icon, waarde: a.waarde, ticketWaarde: ticketWaarde(a),
          verkocht: bezet.length, access: bezet.filter(t => t.smaak === 'access').length, asset: bezet.filter(t => t.smaak === 'asset').length,
          kas: Math.round((db.data.assetKas[a.id] || 0) / 100),
          wachtenden: db.data.assetWachtlijst.filter(w => w.assetId === a.id).length,
          terugkoopOpen: db.data.assetTerugkoop.filter(v => v.assetId === a.id && v.status === 'aangevraagd').map(v => ({ id: v.id, codenaam: v.codenaam, waarde: v.waarde, uiterlijk: v.uiterlijk })),
          // wat er dit jaar nog te verhuren valt: 365 minus geboekt minus onderhoud
          restdagen: Math.max(0, 365 - geboekt - ONDERHOUD_DAGEN)
        };
      })
    };
  }
  // een terugkoop uitbetalen: de Tik gaat eruit, het ticket valt terug in de pool
  async function assetTerugkoopUit(verzoekIdIn, wie) {
    lijsten();
    const v = db.data.assetTerugkoop.find(x => x.id === String(verzoekIdIn || '') && x.status === 'aangevraagd');
    if (!v) return { status: 404, error: 'Terugkoopverzoek niet gevonden (of al uitbetaald).' };
    const t = db.data.assetTickets.find(x => x.id === v.ticketId);
    v.status = 'uitbetaald'; v.uitbetaaldAt = nu(); v.door = schoon(wie, 40) || 'RTG-kantoor';
    if (t) { t.status = 'uitgestapt'; t.uitstap = { waarde: v.waarde, at: nu(), soort: 'terugkoop' }; }
    kasAdd(v.assetId, -v.waarde * 100);
    save();
    try { await pay.stuur({ van: 'RTG Treasury', aanCodenaam: v.codenaam, centen: v.waarde * 100, oms: 'Terugkoop ' + v.assetNaam + ' (RTG Asset)', idem: 'terugkoop-' + v.id, soort: 'tik' }); } catch (e) {}
    notify(v.key, { icon: '💰', title: 'Terugkoop uitbetaald: ' + v.assetNaam, body: 'De Tik van € ' + v.waarde + ' staat in uw tegoed. Het ticket is terug in de pool.', scope: 'assets' });
    return { ok: true, waarde: v.waarde, verzoek: v };
  }
  // de jaarlijkse servicefee innen: per actief ticket een keer per jaar, naar de poolkas
  async function assetFeesInnen(wie) {
    lijsten();
    const jaar = new Date().getFullYear();
    let geind = 0, totaal = 0;
    for (const t of db.data.assetTickets) {
      if (t.status !== 'actief' || t.feeJaar === jaar) continue;
      const a = objectVan(t.assetId);
      if (!a) continue;
      const fee = serviceFeeVan(a);
      try {
        await pay.stuur({ van: t.codenaam, aanCodenaam: 'RTG Treasury', centen: fee * 100, oms: 'Servicefee ' + jaar + ' ' + a.naam, idem: 'fee-' + t.id + '-' + jaar, soort: 'tik' });
        t.feeJaar = jaar;
        kasAdd(a.id, fee * 100);
        geind++; totaal += fee;
      } catch (e) { /* volgende ronde opnieuw */ }
    }
    save();
    return { ok: true, geind, totaal, door: schoon(wie, 40) || 'RTG-kantoor' };
  }

  return { assetHertaxeer, assetKantoor, assetTerugkoopUit, assetFeesInnen };
};
