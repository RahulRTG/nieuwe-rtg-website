/* RTG Stadsweefsel, deel "indicatoren": van bedrijfsvoering naar bestuur.

   De rest van het weefsel beantwoordt operationele vragen: wat is er stuk, wie
   gaat erheen, wat hangt eraan. Een bestuurder stelt andere vragen: gaat het
   beter dan vorig jaar, welke wijk krijgt minder, wat kost dit domein, halen we
   onze afspraken. Dit deel rekent die uit.

   DRIE REGELS, EN DE EERSTE IS DE BELANGRIJKSTE.

   1. GEEN TECHNISCHE KPI ALS STEDELIJKE KPI. "99,9% van de sensoren online" is
      geen resultaat maar een randvoorwaarde; je kunt hem halen terwijl de stad
      slechter functioneert. De indicatoren hieronder gaan over doorlooptijd,
      kosten, herhaling en verschil tussen wijken -- dingen die een inwoner
      merkt. De vlootgezondheid staat op het technische bord en hoort daar.

   2. EEN INDICATOR DRAAGT ZIJN RICHTING. Bij elk getal staat of hoger beter is
      of slechter. Dat klinkt triviaal tot iemand een dashboard bouwt waarin
      "meer meldingen" groen kleurt omdat het een groter getal is.

   3. NIET GEMETEN IS NIET NUL. Een periode zonder afgeronde zaken heeft geen
      doorlooptijd; dan staat er null en 'geen meting', niet 0. Een gemiddelde
      over nul waarnemingen is de makkelijkste manier om een bestuur gerust te
      stellen met lucht.

   DE MEDIAAN, NIET HET GEMIDDELDE, voor doorlooptijd: een enkele zaak die een
   half jaar bleef liggen trekt een gemiddelde zo ver omhoog dat de gewone gang
   van zaken onzichtbaar wordt. Beide staan er, zodat het verschil zelf iets
   vertelt. Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */

const DAG = 86400000;

module.exports = (ctx) => {
  const { nu, geo, obj, zkn, werk, tr } = ctx;

  const uren = (ms) => Math.round(ms / 3600000 * 10) / 10;
  function mediaan(rij) {
    if (!rij.length) return null;
    const s = rij.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  const gem = (rij) => (rij.length ? rij.reduce((a, b) => a + b, 0) / rij.length : null);

  /* Het venster. Alles hieronder rekent over EEN periode, en de vorige periode
     van dezelfde lengte ligt er direct naast -- want een getal zonder
     vergelijking is een mening met decimalen. */
  function venster({ dagen, vanaf, tot }) {
    const eind = Number(tot) > 0 ? Number(tot) : nu();
    const n = Number(dagen) > 0 ? Math.round(Number(dagen)) : 30;
    const begin = Number(vanaf) > 0 ? Number(vanaf) : eind - n * DAG;
    return { begin, eind, lengte: eind - begin };
  }

  // de cijfers over EEN venster, eventueel voor EEN gebied
  function meet({ begin, eind }, gebied) {
    const inGebied = (g) => !gebied || g === gebied || geo.binnen(gebied, g);
    const zaken = zkn.lijst({ alles: true }).filter(z => z.at >= begin && z.at <= eind && inGebied(z.gebied));
    const klaar = zaken.filter(z => z.status === 'klaar' && z.klaarAt);
    const looptijden = klaar.map(z => z.klaarAt - z.at);
    const orders = werk.orders().filter(w => w.at >= begin && w.at <= eind && inGebied(w.gebied));
    const afgerond = orders.filter(w => w.status === 'klaar');

    const kostenPerDomein = {};
    for (const w of afgerond) {
      const o = w.objectId ? obj.object(w.objectId) : null;
      const dom = (o && obj.SOORTEN[o.soort] && obj.SOORTEN[o.soort].domein) || 'overig';
      kostenPerDomein[dom] = Math.round(((kostenPerDomein[dom] || 0) + (w.kosten || 0)) * 100) / 100;
    }
    const perCategorie = {};
    for (const z of zaken) {
      const r = perCategorie[z.categorie] || (perCategorie[z.categorie] = { aantal: 0, klaar: 0, looptijden: [] });
      r.aantal++;
      if (z.status === 'klaar' && z.klaarAt) { r.klaar++; r.looptijden.push(z.klaarAt - z.at); }
    }
    for (const r of Object.values(perCategorie)) {
      r.doorlooptijdUur = r.looptijden.length ? uren(mediaan(r.looptijden)) : null;
      delete r.looptijden;
    }
    // herhaling: objecten met meer dan een zaak in dit venster. Dat is het
    // signaal dat een symptoom wordt gerepareerd in plaats van een oorzaak.
    const perObject = {};
    for (const z of zaken) if (z.objectId) perObject[z.objectId] = (perObject[z.objectId] || 0) + 1;
    const herhaling = Object.entries(perObject).filter(([, n]) => n > 1)
      .map(([id, n]) => ({ object: (obj.object(id) || {}).naam || id, zaken: n }))
      .sort((a, b) => b.zaken - a.zaken);

    const metSla = afgerond.filter(w => w.herstelBinnenSla !== undefined);
    return {
      zaken: { geopend: zaken.length, gesloten: klaar.length,
        doorlooptijdMediaanUur: looptijden.length ? uren(mediaan(looptijden)) : null,
        doorlooptijdGemiddeldUur: looptijden.length ? uren(gem(looptijden)) : null,
        nogOpen: zaken.filter(z => zkn.open(z)).length, perCategorie },
      werk: { aangemaakt: orders.length, afgerond: afgerond.length,
        kosten: Math.round(afgerond.reduce((s, w) => s + (w.kosten || 0), 0) * 100) / 100,
        uren: Math.round(afgerond.reduce((s, w) => s + (w.uren || 0), 0) * 10) / 10,
        kostenPerDomein,
        slaHerstelPct: metSla.length ? Math.round(metSla.filter(w => w.herstelBinnenSla).length / metSla.length * 100) : null,
        slaGemeten: metSla.length },
      herhaling: herhaling.slice(0, 10),
      objecten: { storing: obj.zoek({ gebied, status: 'storing' }).length,
        aandacht: obj.zoek({ gebied }).filter(o => o.status !== 'uit-dienst' && o.conditie >= 4).length }
    };
  }

  /* De indicatoren zoals ze op een bestuurstafel horen: met een eenheid, met de
     richting die goed is, en met het vorige tijdvak ernaast. */
  function indicatoren(inv) {
    const v = venster(inv || {});
    const vorige = { begin: v.begin - v.lengte, eind: v.begin };
    const g = (inv && inv.gebied) || null;
    if (g && !geo.gebied(g)) return { status: 404, error: 'Onbekend gebied.' };
    const nuMeting = meet(v, g), toen = meet(vorige, g);

    const rij = [
      ['doorlooptijd', 'Doorlooptijd van een zaak (mediaan)', 'uur', 'lager',
        nuMeting.zaken.doorlooptijdMediaanUur, toen.zaken.doorlooptijdMediaanUur],
      ['open', 'Zaken die nog openstaan', 'stuks', 'lager', nuMeting.zaken.nogOpen, toen.zaken.nogOpen],
      ['gesloten', 'Opgeloste zaken', 'stuks', 'hoger', nuMeting.zaken.gesloten, toen.zaken.gesloten],
      ['kosten', 'Kosten van uitgevoerd werk', 'euro', 'lager', nuMeting.werk.kosten, toen.werk.kosten],
      ['sla', 'Werk binnen de afgesproken hersteltijd', '%', 'hoger', nuMeting.werk.slaHerstelPct, toen.werk.slaHerstelPct],
      ['herhaling', 'Objecten met meer dan een zaak', 'stuks', 'lager', nuMeting.herhaling.length, toen.herhaling.length],
      ['storing', 'Objecten in storing', 'stuks', 'lager', nuMeting.objecten.storing, null]
    ].map(([id, label, eenheid, richting, waarde, eerder]) => ({
      id, label, eenheid, beterIs: richting, waarde, eerder,
      verschil: (waarde == null || eerder == null) ? null : Math.round((waarde - eerder) * 10) / 10,
      beter: (waarde == null || eerder == null) ? null
        : (richting === 'lager' ? waarde <= eerder : waarde >= eerder),
      meting: waarde == null ? 'niet gemeten in dit tijdvak' : null
    }));

    return { status: 200, venster: { vanaf: v.begin, tot: v.eind, dagen: Math.round(v.lengte / DAG) },
      gebied: g ? { id: g, naam: geo.gebied(g).naam } : null,
      indicatoren: rij, detail: nuMeting,
      let_op: 'Technische beschikbaarheid (sensoren online) staat met opzet NIET tussen deze cijfers; die hoort op het technische bord.' };
  }

  /* Verschil tussen wijken. Dit is de vraag die het vaakst wordt overgeslagen
     en het meest zegt: een stadsgemiddelde kan prima zijn terwijl een wijk
     structureel achterloopt. */
  function perWijk(inv) {
    const v = venster(inv || {});
    const wijken = geo.opNiveau('wijk').map(w => {
      const m = meet(v, w.id);
      return { wijk: w.naam, gebied: w.id, geopend: m.zaken.geopend, gesloten: m.zaken.gesloten,
        doorlooptijdUur: m.zaken.doorlooptijdMediaanUur, kosten: m.werk.kosten,
        objectenInStoring: m.objecten.storing, aandacht: m.objecten.aandacht };
    });
    const gemeten = wijken.filter(w => w.doorlooptijdUur != null).map(w => w.doorlooptijdUur);
    const spreiding = gemeten.length >= 2 ? Math.round((Math.max(...gemeten) - Math.min(...gemeten)) * 10) / 10 : null;
    return { status: 200, venster: { vanaf: v.begin, tot: v.eind }, wijken,
      spreidingDoorlooptijdUur: spreiding,
      let_op: spreiding == null ? 'te weinig afgeronde zaken om wijken te vergelijken'
        : 'de spreiding is het verschil tussen de snelste en de traagste wijk; die hoort te krimpen' };
  }

  // de milieukant, uit het geheugen: wat deed de lucht, het geluid, het water
  function leefomgeving(inv) {
    const v = venster(inv || {});
    const dagen = Math.max(1, Math.round(v.lengte / DAG));
    const uit = {};
    for (const sens of ['lucht', 'geluid', 'water', 'energie']) {
      const t = tr.trend({ sens, gebied: (inv && inv.gebied) || null, dagen });
      uit[sens] = { nu: t.nu, eerder: t.eerder, richting: t.richting, verschilPct: t.verschilPct || null, reden: t.reden || null };
    }
    return { status: 200, dagen, leefomgeving: uit,
      let_op: 'Deze cijfers komen uit de eigen Stadsdozen; ze zijn geen wettelijke meting en geen erkende meetopstelling.' };
  }

  return {
    meet, venster,
    api: { weefselIndicatoren: indicatoren, weefselPerWijk: perWijk, weefselLeefomgeving: leefomgeving }
  };
};
