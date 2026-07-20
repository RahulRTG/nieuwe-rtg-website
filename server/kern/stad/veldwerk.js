/* RTG Stad, deel "veldwerk": de werklijst voor de medewerkers die BUITEN
   werken (de Stadsdoos veld-app). De lijst schrijft zichzelf uit de staat van
   de stad: elke offline Stadsdoos wordt een onderhoudsklus en elke
   bord-waarschuwing een domein-klus, allebei met een stabiele sleutel. Een
   klaargemelde klus (met naam, voor het auditlog) blijft een paar uur stil,
   zodat de lijst buiten rustig blijft terwijl de oorzaak wordt opgelost; komt
   het probleem daarna terug, dan komt de klus vanzelf terug. Krijgt de
   gedeelde ctx van kern/stad/index.js. */
module.exports = (ctx) => {
  const { d, save, schoon, nu, nodes, ONLINE_MS, alerts, seintje } = ctx;

  const DEMPER_MS = 4 * 60 * 60 * 1000;      // klaargemeld = vier uur stil
  const BEWAAR_MS = 7 * 24 * 60 * 60 * 1000; // oude klaarmeldingen ruimen zichzelf op

  function klaarStore() {
    if (!d().stadKlaar || typeof d().stadKlaar !== 'object') d().stadKlaar = {};
    const s = d().stadKlaar;
    for (const [k, v] of Object.entries(s)) if (nu() - v.at > BEWAAR_MS) delete s[k];
    return s;
  }

  // de klussen zoals de stad ze NU voorschrijft (nog zonder de demper)
  function ruweKlussen() {
    const uit = [];
    for (const n of Object.values(nodes())) {
      if (!n.actief || nu() - (n.laatsteContact || 0) < ONLINE_MS) continue;
      uit.push({ sleutel: 'doos:' + n.serial, soort: 'onderhoud', zone: n.zone,
        omschrijving: n.naam + ' (' + n.serial + ') is offline; controleer stroom, netwerk en de doos zelf.' });
    }
    for (const a of alerts())
      uit.push({ sleutel: 'alert:' + a.domein, soort: a.domein, zone: null, omschrijving: a.tekst });
    return uit;
  }

  function werklijst() {
    const klaar = klaarStore();
    const open = ruweKlussen().filter(k => !(klaar[k.sleutel] && nu() - klaar[k.sleutel].at < DEMPER_MS));
    return { status: 200, klussen: open,
      klaargemeld: Object.entries(klaar).sort((a, b) => b[1].at - a[1].at).slice(0, 8)
        .map(([sleutel, v]) => ({ sleutel, wie: v.wie, notitie: v.notitie, at: v.at })) };
  }

  function klaarMeld({ sleutel, wie, notitie }) {
    const k = String(sleutel || '');
    const klus = ruweKlussen().find(x => x.sleutel === k);
    if (!klus) return { status: 404, error: 'Die klus staat niet (meer) op de lijst.' };
    klaarStore()[k] = { wie: schoon(wie, 60) || 'veld', notitie: schoon(notitie, 140) || null, at: nu() };
    save(); seintje();
    return { ok: true, sleutel: k, omschrijving: klus.omschrijving, wie: schoon(wie, 60) || 'veld' };
  }

  return { api: { stadWerk: werklijst, stadWerkKlaar: klaarMeld } };
};
