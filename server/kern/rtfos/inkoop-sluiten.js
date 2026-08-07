/* Foundation OS, deel "inkoop-sluiten": de verdeling en de overgang naar geld.

   TWEE DINGEN GEBEUREN HIER, EN ZE ZIJN ALLEBEI DE MOEITE VAN EEN EIGEN BESTAND
   WAARD:

   1. DE VERDELING SLUIT TOT DE CENT. Het stukdeel is exact (prijs maal aantal),
      maar de BIJKOMENDE KOSTEN -- transport, handling -- gaan naar rato en die
      delen zelden rond: tien euro transport over drie steden geeft resten. Die
      gaan met de grootste-rest-methode naar de grootste rest, tot de som precies
      klopt. Er staat een CONTROLE achter die de hele boeking afbreekt als het
      niet klopt: een verdeling die niet sluit hoort te stoppen, niet te worden
      weggeschreven (LAT.md regel 5).

      Dit is een reparatie: eerst werd het hele totaal naar rato verdeeld met een
      grootste-rest-lus erachter, en die lus was dode code -- ieders deel was
      per constructie prijs maal aantal en dus altijd rond. De rest zit in de
      bijkomende kosten, en dus zit de restverdeling daar nu ook.

   2. SLUITEN IS GEEN BETALING MAAR EEN BESTELLING. Per stad ontstaat een gewone
      uitgave-aanvraag (geld-uitgaven.js: boekAanvraag), die daarna door de vier
      ogen en de goedkeuringslimiet van DIE stad moet. Zou de inkoop zijn eigen
      boekingen schrijven, dan was hij de achterdeur om de goedkeuringsladder
      heen -- en dat is precies wat een inkoopmodule wordt zodra niemand erop
      let. Steden die om welke reden dan ook geen aanvraag krijgen, komen
      met naam terug in `mislukt`; stil overslaan zou hier het duurst zijn.

   Afgesplitst uit inkoop.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { centen, euro, S, audit, wie, poort, stadVan, save } = ctx;
  const { vind, beeld, totaalStuks, boekAanvraag } = eigen;

  /* Sluiten. Hier wordt de definitieve stukprijs vastgelegd en het totaal
     verdeeld -- centnauwkeurig, met de grootste-rest-methode. Elke stad krijgt
     daarna een gewone uitgave-aanvraag die door haar eigen goedkeuring moet. */
  function sluit(req, id, b) {
    b = b || {};
    const i = vind(id);
    if (!i) return { status: 404, error: 'Deze inkoop bestaat niet.' };
    const w = wie(req);
    const g = poort(w, i.openerStad, 'geld.beheren');
    if (!g.ok) return g;
    if (i.status !== 'open') return { status: 400, error: 'Deze inkoop is al gesloten.' };
    if ((i.deelnames || []).length < 2) {
      return { status: 400, error: 'Er doet maar een stad mee. Dat is geen gezamenlijke inkoop; bestel het via de eigen uitgaven van die stad.' };
    }
    const perStuk = centen(b.perStuk === undefined ? euro(i.indicatieCenten) : b.perStuk);
    if (perStuk === null || perStuk === 0) return { status: 400, error: 'Wat is de definitieve prijs per stuk?' };
    /* De bijkomende kosten: transport, handling, een eenmalige opstartfee. Die
       horen bij de order en niet bij een stuk, en ZIJ zijn de reden dat er
       uberhaupt een restverdeling nodig is -- zie hieronder. */
    const extra = centen(b.extra === undefined ? 0 : b.extra);
    if (extra === null) return { status: 400, error: 'Wat zijn de bijkomende kosten? Nul mag ook.' };
    const stuks = totaalStuks(i);
    const totaal = perStuk * stuks + extra;

    /* DE VERDELING, EN WAAROM DE RESTVERDELING HIER PAS ECHT IETS DOET.

       De eerste versie verdeelde het HELE totaal naar rato met een
       grootste-rest-lus erachter. Dat zag er zorgvuldig uit en het was dode
       code: het totaal is per constructie perStuk x stuks, en ieders deel is
       dus perStuk x zijn aantal -- altijd een rond getal, nooit een rest. De
       lus kon niet bijten, en een toets die hem probeerde te betrappen, ging
       over zijn eigen rekensom struikelen (LAT.md regel 2: een mutatie die
       niet bijt, is een bevinding).

       Wat WEL rest geeft, zijn de bijkomende kosten: tien euro transport over
       drie steden gaat niet op. Die gaan hier naar rato van het aantal, en de
       centen die overblijven naar de grootste rest, tot de som exact klopt.
       Het stukdeel is exact en de rest is eerlijk verdeeld. */
    const stukDeel = i.deelnames.map(d => ({ d, stuk: perStuk * d.aantal, exact: (extra * d.aantal) / stuks }));
    let som = 0;
    for (const r of stukDeel) { r.deelExtra = Math.floor(r.exact); som += r.deelExtra; }
    stukDeel.sort((a, b2) => (b2.exact - b2.deelExtra) - (a.exact - a.deelExtra));
    for (let k = 0; k < extra - som; k++) stukDeel[k % stukDeel.length].deelExtra += 1;
    for (const r of stukDeel) r.d.deelCenten = r.stuk + r.deelExtra;
    const controle = i.deelnames.reduce((s, d) => s + d.deelCenten, 0);
    if (controle !== totaal) {
      // Kan niet, en juist daarom staat het er: een verdeling die niet sluit,
      // hoort te stoppen en niet te worden weggeschreven.
      return { status: 500, error: 'De verdeling sluit niet (' + controle + ' van ' + totaal + ' cent). Er is niets geboekt.' };
    }

    // per stad een gewone aanvraag; die loopt door de vier ogen van die stad
    const mislukt = [];
    for (const d of i.deelnames) {
      const p = S().projecten.find(x => x.id === d.projectId);
      if (!p) { mislukt.push(d.stad + ': project bestaat niet meer'); continue; }
      const r = boekAanvraag(w, p, { bedrag: euro(d.deelCenten), bronId: d.bronId,
        omschrijving: 'gezamenlijke inkoop: ' + i.wat + ' (' + d.aantal + ' ' + i.eenheid +
          (extra ? ', incl. aandeel bijkomende kosten' : '') + ')',
        leverancier: i.leverancier, uitInkoop: i.id });
      if (r.ok) d.uitgaveId = r.uitgave.id;
      else mislukt.push(((stadVan(d.stad) || {}).naam || d.stad) + ': ' + r.error);
    }
    i.definitiefCenten = perStuk;
    i.extraCenten = extra;
    i.status = 'gesloten';
    audit(w.key, 'inkoop.gesloten', i.wat, stuks + ' ' + i.eenheid + ', ' + euro(totaal) + ' euro over ' + i.deelnames.length + ' steden');
    save();
    return { ok: true, inkoop: beeld(i), mislukt,
      melding: 'Gesloten op ' + euro(perStuk) + ' euro per ' + i.eenheid.replace(/s$/, '') +
        (extra ? ' plus ' + euro(extra) + ' euro bijkomende kosten naar rato' : '') +
        '. Elke stad heeft nu een eigen uitgave-aanvraag die daar nog goedgekeurd moet worden.' +
        (mislukt.length ? ' Let op: ' + mislukt.length + ' stad(en) kregen geen aanvraag.' : '') };
  }

  function status(req, id, naar) {
    const i = vind(id);
    if (!i) return { status: 404, error: 'Deze inkoop bestaat niet.' };
    const w = wie(req);
    const g = poort(w, i.openerStad, 'geld.beheren');
    if (!g.ok) return g;
    const st = String(naar || '');
    if (!['geleverd', 'afgeblazen'].includes(st)) return { status: 400, error: 'Een gesloten inkoop gaat naar geleverd of afgeblazen.' };
    if (st === 'geleverd' && i.status !== 'gesloten') return { status: 400, error: 'Er is nog niets besteld: deze inkoop staat op "' + i.status + '".' };
    i.status = st;
    audit(w.key, 'inkoop.status', i.wat, st);
    save();
    return { ok: true, inkoop: beeld(i) };
  }

  return { sluit, status };
};
