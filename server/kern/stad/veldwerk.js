/* RTG Stad, deel "veldwerk": de werklijst voor de medewerkers die BUITEN
   werken (de Stadsdoos veld-app). De lijst komt uit twee bronnen:

   1. WAT DE STAD ZELF VOORSCHRIJFT. Elke offline Stadsdoos is een
      onderhoudsklus, elke bord-waarschuwing een domein-klus. Die schrijven
      zichzelf uit de toestand en verdwijnen vanzelf als de toestand herstelt;
      een klaargemelde klus blijft daarom een paar uur stil (de demper), zodat
      de lijst rustig blijft terwijl de oorzaak wordt opgelost.
   2. DE WERKORDERS UIT HET STADSWEEFSEL. Elke zaak -- een bewonersmelding, een
      gemeentemelding, gepland onderhoud -- krijgt daar een werkorder, en die
      staan hier op dezelfde lijst. Die zijn NIET zelfschrijvend: ze blijven
      staan tot iemand ze klaarmeldt, en dat klaarmelden boekt de handeling in
      de onderhoudshistorie van het object en sluit de zaak.

   Het verschil tussen die twee is met opzet zichtbaar in de sleutel:
   'doos:'/'alert:' zijn toestandsklussen, 'melding:'/'werk:' zijn werkorders.
   Krijgt de gedeelde ctx van kern/stad/index.js. */
module.exports = (ctx) => {
  const { d, save, schoon, nu, nodes, ONLINE_MS, alerts, seintje, weefsel } = ctx;

  const DEMPER_MS = 4 * 60 * 60 * 1000;      // klaargemeld = vier uur stil
  const BEWAAR_MS = 7 * 24 * 60 * 60 * 1000; // oude klaarmeldingen ruimen zichzelf op

  function klaarStore() {
    if (!d().stadKlaar || typeof d().stadKlaar !== 'object') d().stadKlaar = {};
    const s = d().stadKlaar;
    for (const [k, v] of Object.entries(s)) if (nu() - v.at > BEWAAR_MS) delete s[k];
    return s;
  }

  // de sleutel van een werkorder: een zaak houdt zijn eigen sleutel, zodat een
  // melder en een veldploeg het over hetzelfde ding hebben
  const sleutelVan = (w) => (w.zaakId ? 'melding:' + w.zaakId : 'werk:' + w.id);

  // de werkorders van het weefsel, in de vorm van deze lijst
  function werkKlussen() {
    return weefsel.weefselWerklijst({}).werkorders.map(w => ({
      sleutel: sleutelVan(w), soort: w.soort === 'storing' ? (w.object ? w.object.soort : 'onderhoud') : w.soort,
      zone: w.plaats || null, prioriteit: w.prioriteit, werkorder: w.id,
      omschrijving: (w.zaakId ? 'Melding' : 'Werkorder') + (w.plaats ? ' (' + w.plaats + ')' : '') + ': ' + w.omschrijving
    }));
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
    uit.push(...werkKlussen());
    return uit;
  }

  function werklijst() {
    const klaar = klaarStore();
    const open = ruweKlussen().filter(k => !(klaar[k.sleutel] && nu() - klaar[k.sleutel].at < DEMPER_MS));
    return { status: 200, klussen: open,
      klaargemeld: Object.entries(klaar).sort((a, b) => b[1].at - a[1].at).slice(0, 8)
        .map(([sleutel, v]) => ({ sleutel, wie: v.wie, notitie: v.notitie, at: v.at })) };
  }

  /* Klaarmelden. Voor een toestandsklus is dat een demper; voor een werkorder
     is het het echte einde: de werkorder gaat dicht, de handeling landt in de
     onderhoudshistorie van het object, en als het de laatste werkorder van de
     zaak was, ziet de melder zijn melding als opgelost. */
  function klaarMeld({ sleutel, wie, notitie, kosten, uren }) {
    const k = String(sleutel || '');
    const klus = ruweKlussen().find(x => x.sleutel === k);
    if (!klus) return { status: 404, error: 'Die klus staat niet (meer) op de lijst.' };
    const naam = schoon(wie, 60) || 'veld';
    let zaakGesloten = null;
    if (klus.werkorder) {
      const r = weefsel.weefselWerkorderKlaar({ id: klus.werkorder, wie: naam, notitie, kosten, uren });
      if (r.error) return r;
      zaakGesloten = r.zaakGesloten;
    }
    klaarStore()[k] = { wie: naam, notitie: schoon(notitie, 140) || null, at: nu() };
    save(); seintje();
    return { ok: true, sleutel: k, omschrijving: klus.omschrijving, wie: naam, zaakGesloten };
  }

  return { api: { stadWerk: werklijst, stadWerkKlaar: klaarMeld } };
};
