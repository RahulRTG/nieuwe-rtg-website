/* Domein "supplier" (deelmodule): retail/mode. Draait op de gedeelde kern.
   De merk-backoffice (manager) en de winkelvloer (elke medewerker) delen dezelfde
   supplierAuth. */
module.exports = (kern) => {
  const { app, express, db, supplierAuth, managerOnly, logActivity, sseToOffice, facturatie,
    retailState, RETAIL_MATEN, RETAIL_SEIZOENEN, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
    voorraadZoek, klantProfiel, zetKlantMaten, voegKlantnotitie, legApart, paskamerBreng, stuurStyling,
    retailVerkoop, retailVerkoopTerug, retailAnnuleer, retailBon, ANNULEERGRONDEN } = kern;

/* ================= RETAIL / MODE (kern/retail.js) =================
   Merk-backoffice (manager) + winkelvloer (elke medewerker). De PDA logt in als
   staflid van het merk en gebruikt dezelfde supplierAuth. */
function eisRetail(req, res) {
  const caps = db.capsVan(req.supplier);
  if (!caps.includes('retail')) { res.status(409).json({ error: 'Dit is geen mode-/retailpartner.' }); return false; }
  return true;
}
// volledige retail-toestand (catalogus, voorraad, clienteling, analytics)
app.post('/api/supplier/retail', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  res.json({ retail: retailState(req.supplier), maten: RETAIL_MATEN, seizoenen: RETAIL_SEIZOENEN });
});
// collectie toevoegen/wijzigen/verwijderen (manager)
app.post('/api/supplier/retail/collectie', supplierAuth, (req, res) => {
  if (!eisRetail(req, res) || !managerOnly(req, res)) return;
  const r = zetCollectie(req.supplier, req.body); if (r.error) return res.status(r.status).json({ error: r.error }); res.json(r);
});
// artikel met varianten toevoegen/wijzigen/verwijderen (manager)
app.post('/api/supplier/retail/artikel', supplierAuth, express.json({ limit: '2mb' }), (req, res) => {
  if (!eisRetail(req, res) || !managerOnly(req, res)) return;
  const r = zetArtikel(req.supplier, req.body); if (r.error) return res.status(r.status).json({ error: r.error });
  sseToOffice('sync', { scope: 'orders' }); res.json(r);
});
// voorraad van een variant bijstellen (ontvangst/correctie; elke medewerker)
app.post('/api/supplier/retail/voorraad', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  const r = pasVoorraad(req.supplier, String(req.body.vsku || ''), req.body.delta, req.body.absoluut);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'zette voorraad ' + req.body.vsku + ' op ' + r.voorraad); res.json(r);
});
// een drop live zetten (manager): de wachtlijst gaat af
app.post('/api/supplier/retail/drop/release', supplierAuth, (req, res) => {
  if (!eisRetail(req, res) || !managerOnly(req, res)) return;
  const r = releaseDrop(req.supplier, String(req.body.artikelId || '')); if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'releasede een drop (' + r.bericht + ' op de wachtlijst)'); res.json(r);
});
// voorraad opzoeken op de vloer (naam/sku/kleur/maat)
app.post('/api/supplier/retail/zoek', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  res.json({ resultaten: voorraadZoek(req.supplier, req.body.q, req.body.drempel) });
});
// clienteling: het klantprofiel erbij pakken (maten, verlanglijst, historie, notities)
app.post('/api/supplier/retail/klant', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  const key = String(req.body.key || '');
  if (!key) return res.status(400).json({ error: 'Geef een klant (codenaam-sleutel).' });
  res.json({ klant: klantProfiel(req.supplier, key) });
});
app.post('/api/supplier/retail/klant/maten', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  const r = zetKlantMaten(req.supplier, String(req.body.key || ''), req.body.maten, req.body.voorkeuren);
  if (r.error) return res.status(r.status).json({ error: r.error }); res.json(r);
});
app.post('/api/supplier/retail/klant/notitie', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  const r = voegKlantnotitie(req.supplier, String(req.body.key || ''), req.body.tekst, req.actor.name);
  if (r.error) return res.status(r.status).json({ error: r.error }); res.json(r);
});
// een variant apart leggen voor een klant
app.post('/api/supplier/retail/apart', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  const r = legApart(req.supplier, String(req.body.key || ''), String(req.body.vsku || ''), req.actor.name);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'legde ' + r.apart.artikelNaam + ' (' + r.apart.maat + ') apart'); res.json(r);
});
// een paskamerverzoek afhandelen (maat gebracht)
app.post('/api/supplier/retail/paskamer/breng', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  const r = paskamerBreng(req.supplier, String(req.body.id || ''), req.body.paskamer, req.actor.name);
  if (r.error) return res.status(r.status).json({ error: r.error }); res.json(r);
});
// een stylingvoorstel naar de app van de klant sturen
app.post('/api/supplier/retail/styling', supplierAuth, (req, res) => {
  if (!eisRetail(req, res)) return;
  const r = stuurStyling(req.supplier, String(req.body.key || ''), req.body, req.actor.name);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'stuurde een stylingvoorstel'); res.json(r);
});
// mobiele kassa op de vloer: verkoop varianten (voorraad daalt, historie groeit)
app.post('/api/supplier/retail/verkoop', supplierAuth, async (req, res) => {
  if (!eisRetail(req, res)) return;
  const r = retailVerkoop(req.supplier, req.body, req.actor);
  if (r.error) return res.status(r.status).json({ error: r.error });
  // RTG Pay: het totaal staat pas na de verkoop vast (serverprijzen), dus
  // eerst boeken, dan innen; ketst de code af, dan draait de verkoop terug.
  if (r.sale.method === 'rtgpay') {
    /* TWEE DRAGERS, EEN INNING (kern/pay/kasinnen.js) -- zie de kassa. De
       winkelvloer nam alleen de code van zes tekens, en dat was geen besluit
       maar de helft van een verhuizing. */
    const p = await kern.kasInnen({
      supplierCode: req.supplier.code, supplierNaam: req.supplier.name,
      code: req.body.payCode, centen: Math.round(r.sale.total * 100),
      idem: r.sale.id
    });
    if (p.error) { retailVerkoopTerug(req.supplier, r.sale); return res.status(p.status || 400).json({ error: p.error }); }
    r.sale.betaler = p.van;
  }
  logActivity(req.supplier.code, req.actor, 'verkocht ' + r.sale.items.reduce((n, i) => n + i.qty, 0) + ' stuk(s) · € ' + r.sale.total);

  // automatische factuur voor beide partijen (koper gekoppeld via codenaam)
  facturatie.boekMetCodenaam({
    soort: 'verkoop', verkoperCode: req.supplier.code, verkoperNaam: req.supplier.name,
    koper: { naam: req.body.codenaam || r.sale.betaler || 'Klant' },
    regels: (r.sale.items || []).map(i => ({ omschrijving: i.naam || i.name || 'Artikel', aantal: i.qty, stuk: i.price || i.prijs })),
    methode: r.sale.method || 'contant', ref: r.sale.id
  }, req.body.codenaam || r.sale.betaler || (r.sale.klant && r.sale.klant.codenaam)).catch(() => {});
  res.json(r);
});

/* EEN KASSABON TERUGDRAAIEN. Geen wisknop: er komt een TEGENBOEKING bij en de
   bon blijft staan (kern/retail/annulering.js). De grond komt uit een gesloten
   lijst -- een vrij tekstveld levert binnen een maand vijftien spellingen van
   dezelfde reden op, en dan valt er niets meer te tellen.

   ALLEEN EEN MANAGER. Een medewerker slaat aan; terugdraaien raakt de omzet en
   de btw-aangifte, en dat is werk van de leiding. Geld terug gaat NIET langs
   deze deur: dat wordt klaargezet in kern/commerce/retour.js en een mens drukt.
   Deze route raakt de voorraad en de boeking, en meer niet. */
app.post('/api/supplier/retail/annuleer', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const b = req.body || {};
  const r = retailAnnuleer(req.supplier, String(b.saleId || ''), {
    grond: String(b.grond || ''), toelichting: String(b.toelichting || ''),
    door: (req.actor && req.actor.name) || 'Manager'
  });
  if (r.error) return res.status(r.status || 400).json(r);
  logActivity(req.supplier.code, req.actor, 'draaide kassabon ' + r.bon.id + ' terug (' + r.bon.geannuleerd.grond + ') · € ' + r.bon.total);
  res.json(r);
});

/* De gronden en een bon opvragen: zodat een scherm de lijst niet hoeft na te
   maken en kan tonen wat er met een bon is gebeurd. */
app.post('/api/supplier/retail/bon', supplierAuth, (req, res) =>
  res.json({ ok: true, gronden: ANNULEERGRONDEN, bon: retailBon(req.supplier, String((req.body || {}).saleId || '')) }));

};
