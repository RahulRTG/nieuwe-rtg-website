/* RTG Bank, deel "sparen": de spaarkant. Rente wordt per dag opgebouwd over het
   spaarsaldo tegen het tarief dat de boardroom zet (kern/bankregie), en als echte
   boeking bijgeschreven vanaf rtg:rente -- zo blijft het grootboek sluiten en is de
   rente-uitgave zichtbaar in de bank-gezondheid. Daarnaast spaardoelen (een potje
   met een doelbedrag) per rekening. Krijgt de gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, d, boek, rekeningen, rekMeta, saldoVan, bankregie, seintje } = ctx;

  const DAG_MS = 86400000;

  /* Een renteronde: schrijf over de verstreken hele dagen rente bij op elk
     spaarsaldo. Idempotent op de klok: twee keer draaien op dezelfde dag boekt
     niet dubbel (er zijn dan 0 nieuwe dagen). Met { dagen } kan het kantoor
     (of een test) een vast aantal dagen forceren. */
  function renteRonde({ dagen } = {}) {
    if (!Number.isFinite(d().bankRenteAt)) d().bankRenteAt = nu();
    const verstreken = Math.floor((nu() - d().bankRenteAt) / DAG_MS);
    const n = Number.isFinite(dagen) ? Math.max(0, Math.round(dagen)) : verstreken;
    if (n <= 0) { return { ok: true, dagen: 0, bijgeschrevenCenten: 0, rekeningen: 0 }; }
    const bp = bankregie.bankSpaarrenteBp();
    const dagFactor = (bp / 10000) * (n / 365);
    let totaal = 0, tel = 0;
    for (const m of Object.values(rekeningen())) {
      if (m.soort !== 'spaar') continue;
      const saldo = saldoVan(m.iban);
      if (saldo <= 0) continue;
      const rente = Math.round(saldo * dagFactor);
      if (rente < 1) continue;
      const b = boek({ van: 'rtg:rente', naar: m.iban, centen: rente, soort: 'rente', oms: 'Spaarrente ' + (bp / 100) + '% (' + n + ' dg)' });
      if (b.ok) { totaal += rente; tel++; seintje(m.codenaam); }
    }
    d().bankRenteAt += n * DAG_MS;
    save();
    return { ok: true, dagen: n, bijgeschrevenCenten: totaal, rekeningen: tel, tariefBp: bp };
  }

  // een spaardoel (potje met streefbedrag) op een spaarrekening zetten
  function spaardoelZet({ iban, euro, codenaam }) {
    const m = rekMeta(iban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De rekening bestaat niet.' };
    if (m.soort !== 'spaar') return { status: 400, error: 'Een spaardoel hoort bij een spaarrekening.' };
    const centen = Math.round(Number(euro) * 100);
    if (!Number.isFinite(centen) || centen < 0 || centen > 100000000) return { status: 400, error: 'Kies een doelbedrag tot 1 miljoen euro.' };
    m.doelCenten = centen;
    save();
    seintje(m.codenaam);
    const saldo = saldoVan(iban);
    return { ok: true, iban, doelCenten: centen, saldoCenten: saldo, pct: centen > 0 ? Math.min(100, Math.round(saldo / centen * 100)) : 0 };
  }

  // een indicatie van de rente per jaar op een bedrag (voor het scherm)
  function renteVoorbeeld(euro) {
    const centen = Math.round(Number(euro) * 100) || 0;
    const bp = bankregie.bankSpaarrenteBp();
    return { ok: true, tariefBp: bp, pct: bp / 100, perJaarCenten: Math.round(centen * bp / 10000) };
  }

  return { bankRenteRonde: renteRonde, bankSpaardoelZet: spaardoelZet, bankRenteVoorbeeld: renteVoorbeeld };
};
