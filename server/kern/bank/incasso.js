/* RTG Bank, deel "incasso": terugkerende betalingen en machtigingen (incasso). Een
   lid zet een vaste overboeking klaar (huur, sparen, een abonnement) die per week of
   maand automatisch loopt; de incassoronde voert alles uit wat aan de beurt is. Net
   als de renteronde: idempotent op de klok (een uitvoering zet de volgende datum
   vooruit, dus twee keer draaien op dezelfde dag boekt niet dubbel). Krijgt de
   gedeelde ctx van kern/bank/index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, nu, d, boek, rekMeta } = ctx;

  const DAG_MS = 86400000;
  const INTERVAL = { week: 7 * DAG_MS, maand: 30 * DAG_MS };
  function reeks() { if (!Array.isArray(d().bankTerugkerend)) d().bankTerugkerend = []; return d().bankTerugkerend; }
  const publiek = t => ({ id: t.id, vanIban: t.vanIban, naarIban: t.naarIban, centen: t.centen, interval: t.interval,
    oms: t.oms, actief: t.actief, volgendeAt: t.volgendeAt, laatsteAt: t.laatsteAt || null, mislukt: t.mislukt || 0 });

  function zet({ vanIban, naarIban, centen, interval, oms, codenaam }) {
    const m = rekMeta(vanIban);
    if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) return { status: 404, error: 'De bronrekening bestaat niet.' };
    if (!rekMeta(naarIban)) return { status: 404, error: 'De tegenrekening bestaat niet.' };
    if (!INTERVAL[interval]) return { status: 400, error: 'Kies per week of per maand.' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < 1 || c > 100000000) return { status: 400, error: 'Dat bedrag kan niet.' };
    const t = { id: 'TK' + crypto.randomBytes(5).toString('hex').toUpperCase(), vanIban, naarIban, codenaam: m.codenaam,
      centen: c, interval, oms: schoon(oms, 120) || 'Vaste betaling', actief: true, volgendeAt: nu() + INTERVAL[interval], laatsteAt: null, mislukt: 0 };
    reeks().unshift(t);
    if (reeks().length > 50000) reeks().pop();
    save();
    return { ok: true, terugkerend: publiek(t) };
  }
  function lijst(codenaam) {
    const c = String(codenaam || '').trim();
    return { ok: true, terugkerend: reeks().filter(t => t.codenaam === c).map(publiek) };
  }
  function stop({ id, codenaam }) {
    const t = reeks().find(x => x.id === id);
    if (!t || (codenaam && t.codenaam !== String(codenaam).trim())) return { status: 404, error: 'Deze vaste betaling bestaat niet.' };
    t.actief = false;
    save();
    return { ok: true, id, actief: false };
  }
  /* De incassoronde: voer alles uit wat aan de beurt is. Met { nu: t } of
     { vooruitMs } kan het kantoor (of een test) de klok vooruitzetten. */
  function ronde({ tot } = {}) {
    const grens = Number.isFinite(tot) ? tot : nu();
    let uitgevoerd = 0, mislukt = 0, bedrag = 0;
    for (const t of reeks()) {
      if (!t.actief) continue;
      let veiligheid = 0;
      while (t.volgendeAt <= grens && veiligheid++ < 500) {
        const b = boek({ van: t.vanIban, naar: t.naarIban, centen: t.centen, soort: 'incasso', oms: t.oms });
        if (b.error) { t.mislukt = (t.mislukt || 0) + 1; mislukt++; if (t.mislukt >= 5) t.actief = false; break; }
        t.laatsteAt = t.volgendeAt; t.volgendeAt += INTERVAL[t.interval]; t.mislukt = 0;
        uitgevoerd++; bedrag += t.centen;
      }
    }
    save();
    return { ok: true, uitgevoerd, mislukt, bedragCenten: bedrag };
  }

  return { bankTerugkerendZet: zet, bankTerugkerend: lijst, bankTerugkerendStop: stop, bankIncassoRonde: ronde };
};
