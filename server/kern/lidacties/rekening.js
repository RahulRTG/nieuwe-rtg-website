/* Lidacties (deelmodule): "De rekening" -- betalen na het eten.

   De zaak laat bestellingen achteraf lopen (betaalMoment 'achteraf'), en aan
   het eind van het bezoek vraagt het lid de rekening op. Alle openstaande,
   achteraf-lopende bonnen bij die zaak worden dan als een rekening opgeteld en
   in een keer afgerekend, met een fooi over het geheel. Aan-de-balie-bonnen
   tellen niet mee (die worden aan de kassa voldaan) en vooraf-bonnen evenmin
   (die zijn al bij het plaatsen betaald).

   Verbatim afgesplitst van bestellen.js zodat beide modules in de 5-10 KB-band
   blijven; de gedeelde context komt een keer bij het opstarten binnen. */
module.exports = (ctx) => {
  const { save, findSupplier, ordersVanKlant, fooiUit, pasTegoedToe, verdienPunten,
    ledenvoordeelVoor, keuken, notifySupplier, sseToSupplier, sseToOffice } = ctx;

  function lopendeBonnen(session, code) {
    const s = findSupplier(code);
    if (!s) return { s: null, bonnen: [] };
    const bonnen = ordersVanKlant(session.key).filter(o =>
      o.supplierCode === s.code && !o.paid && o.betaalMoment === 'achteraf' && !o.aanBalie &&
      !['terugbetaald', 'geannuleerd', 'geweigerd'].includes(o.status));
    return { s, bonnen };
  }

  function rekeningVoor(session, body) {
    const { s, bonnen } = lopendeBonnen(session, body.supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    const subtotaal = bonnen.reduce((n, o) => n + (o.total || 0), 0);
    return {
      ok: true,
      rekening: {
        supplierCode: s.code, supplierName: s.name,
        aantal: bonnen.length,
        tafel: (bonnen.find(o => o.table) || {}).table || '',
        regels: bonnen.map(o => ({ ref: o.ref, at: o.at, total: o.total, items: (o.items || []).map(it => ({ name: it.name, qty: it.qty, price: it.price })) })),
        subtotaal
      }
    };
  }

  function betaalRekeningVoor(session, body) {
    const { s, bonnen } = lopendeBonnen(session, body.supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    if (!bonnen.length) return { status: 404, error: 'Er staat geen lopende rekening open bij deze zaak.' };
    const subtotaal = bonnen.reduce((n, o) => n + (o.total || 0), 0);
    const fooi = fooiUit(body, subtotaal);
    const nu = new Date().toISOString();
    let korting = 0, voordeel = 0;
    bonnen.forEach((o, i) => {
      // puntentegoed van het lid (RTG legt bij) en het ledenvoordeel per genre
      const k = pasTegoedToe(session.key, o.total);
      if (k) { o.puntenKorting = k; korting += k; }
      const v = ledenvoordeelVoor(s, o.total - k);
      if (v) { o.regieKorting = v; voordeel += v; }
      o.paid = true;
      o.paidAt = nu;
      o.rekeningVoldaan = true; // afgerekend als deel van een gezamenlijke rekening
      if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
      // de fooi voor het team komt een keer op de rekening (op de eerste bon)
      if (i === 0 && fooi) o.fooi = (o.fooi || 0) + fooi;
      verdienPunten(session.key, o.total - k - v, o.supplierName);
      // betaald = definitief: het keukenbrein boekt de ingredienten af
      try { keuken.boekVerkoopAf(s, o.items || [], 'rekening ' + o.ref); } catch (e) {}
    });
    save();
    const aantalItems = bonnen.reduce((n, o) => n + (o.items || []).reduce((m, it) => m + it.qty, 0), 0);
    const eerste = bonnen[0];
    notifySupplier(s.code, { icon: '\u{1F9FE}', title: 'Rekening voldaan', body: eerste.customerCodename + (eerste.table ? ' · ' + eerste.table : '') + ', ' + bonnen.length + ' bon(nen), ' + aantalItems + ' item(s), € ' + subtotaal + (fooi ? ' · \u{1F49B} fooi € ' + fooi : '') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
    return { ok: true, rekening: { supplierName: s.name, aantal: bonnen.length, subtotaal, fooi, puntenKorting: korting, regieKorting: voordeel, betaald: subtotaal + fooi, refs: bonnen.map(o => o.ref) } };
  }

  return { rekeningVoor, betaalRekeningVoor };
};
