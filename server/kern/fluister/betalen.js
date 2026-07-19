/* Doe-laag, deel "betalen" (kern/fluister): bestellen bij een zaak en al het
   RTG Pay-verkeer: een Tik (geld sturen), een Klompje (betaalverzoek) en de
   openstaande verzoeken in een keer voldoen. Wat geld doet verlaten (bestel,
   tik, de klompjes betalen) zet eerst een voorstel klaar dat op "ja" wacht;
   een Klompje maken haalt niets van uw rekening en mag dus direct. Krijgt
   {q,p,klaar,key,codenaam,sess} en geeft klaar(...) of null. */
module.exports = (ctx) => {
  const { db, save, pay, acties, nu, eur } = ctx;

  // "bestel 2 sangria en 1 bravas bij Sunset Ibiza": eten en drinken
  // wordt direct afgerekend via RTG Pay, dus boven de drempel
  async function bestel({ q, p, klaar, sess }) {
    if (!(acties && acties.plaatsOrder && /^bestel\b/i.test(q))) return null;
    if (sess.tier === 'guest') return klaar('Bestellen via mij kan alleen met een lidmaatschap; als gast kan het via de Bestellen-tab.');
    const naam = (q.match(/\bbij\s+(.+?)[.?!]?\s*$/i) || [])[1];
    const s = naam && (db.data.suppliers || []).find(x => (x.name || '').toLowerCase().includes(naam.toLowerCase().trim()));
    if (!s) return klaar('Bij welke zaak? Zeg bijvoorbeeld: "bestel 2 sangria bij Sunset Ibiza".');
    // alleen het stuk voor "bij ..." telt als boodschappenlijst, anders
    // matcht de zaaknaam zelf per ongeluk een gerecht (Hierbas Sunset)
    const ql = q.toLowerCase().replace(/\bbij\s+.*$/, '');
    const items = [];
    for (const m of (s.menu || [])) {
      if (m.uitverkocht) continue;
      const w = (m.name || '').toLowerCase().split(/[^a-z0-9]+/).find(x => x.length > 3 && ql.includes(x));
      if (!w) continue;
      const qty = Math.min(20, Math.max(1, parseInt((ql.match(new RegExp('(\\d{1,2})\\s+(?:[a-z]+\\s+){0,2}?' + w)) || [])[1], 10) || 1));
      items.push({ id: m.id, qty, naam: m.name, prijs: Number(m.price) || 0 });
    }
    if (!items.length) return klaar('Wat mag het zijn bij ' + s.name + '? Op de kaart staat onder meer: ' + (s.menu || []).slice(0, 5).map(m => m.name).join(', ') + '.');
    const oms = items.map(i => i.qty + 'x ' + i.naam).join(', ');
    const totaal = items.reduce((a, i) => a + i.prijs * i.qty, 0);
    p.wacht = { soort: 'bestelling', supplierCode: s.code, items: items.map(i => ({ id: i.id, qty: i.qty })), oms, at: nu() };
    save();
    return klaar('Even checken: ' + oms + ' bij ' + s.name + ', samen ongeveer ' + eur(Math.round(totaal * 100)) + '. Ik plaats de bestelling en reken hem direct af via RTG Pay. Zeg "ja" en het staat in gang; "nee" en het gaat niet door.', false, true);
  }

  // "stuur 15 euro naar Noordelijke Ster": geld gaat nooit zonder "ja"
  async function tik({ q, p, klaar }) {
    if (!(pay && /\b(stuur|betaal|geef|tik)\b/i.test(q))) return null;
    const m = q.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)?\s+(?:naar|aan)\s+(.+?)[.?!]?\s*$/i);
    if (m) {
      const centen = Math.round(parseFloat(m[1].replace(',', '.')) * 100);
      if (!(centen > 0)) return klaar('Welk bedrag? Zeg bijvoorbeeld: "stuur 15 euro naar Noordelijke Ster".');
      const aan = m[2].trim();
      p.wacht = { soort: 'tik', centen, aan, at: nu() };
      save();
      return klaar('Even checken: ' + eur(centen) + ' aan ' + aan + ' sturen via een Tik? Zeg "ja" en ik maak het over; "nee" en het gaat niet door.', false, true);
    }
    return null;
  }

  // "vraag 20 euro aan Noordelijke Ster": een Klompje (betaalverzoek);
  // er verlaat geen geld uw rekening, dus dit mag direct
  async function vraagKlompje({ q, klaar, codenaam }) {
    if (!(pay && /\b(vraag|verzoek)\b/i.test(q))) return null;
    const m = q.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)?\s+(?:aan|van)\s+(.+?)[.?!]?\s*$/i);
    if (m) {
      const centen = Math.round(parseFloat(m[1].replace(',', '.')) * 100);
      const r = await pay.verzoekMaak({ van: codenaam, aan: [m[2].trim()], perCenten: centen, oms: 'Via Rahul' });
      if (r.error) return klaar('Dat lukt niet: ' + r.error);
      return klaar('Verzocht: ' + eur(centen) + ' aan ' + m[2].trim() + '. Het Klompje staat klaar; zodra er betaald is, ziet u het in de bel.', true);
    }
    return null;
  }

  // "wat moet ik nog betalen": openstaande betaalverzoeken aan mij,
  // en met een "ja" betaal ik ze in een keer (geld, dus met drempel)
  async function watBetalen({ q, p, klaar, codenaam }) {
    if (!(pay && /(wat (moet|heb) ik.*(betalen|open)|openstaande (verzoeken|betalingen)|staat er (nog )?(iets )?open)/i.test(q))) return null;
    const aanMij = pay.verzoekenVoor(codenaam).aanMij;
    if (!aanMij.length) return klaar('Er staan geen betaalverzoeken voor u open. Zo hoort het.');
    const totaal = aanMij.reduce((a, v) => a + v.centen, 0);
    p.wacht = { soort: 'klompjes', ids: aanMij.map(v => v.id), totaal, at: nu() };
    save();
    return klaar('Er staan ' + aanMij.length + ' verzoek(en) open, samen ' + eur(totaal) + ': ' + aanMij.map(v => eur(v.centen) + ' voor ' + v.van + (v.oms ? ' (' + v.oms + ')' : '')).join(', ') + '. Zeg "ja" en ik betaal ze alle ' + aanMij.length + '; "nee" en ze blijven staan.', false, true);
  }

  return { bestel, tik, vraagKlompje, watBetalen };
};
