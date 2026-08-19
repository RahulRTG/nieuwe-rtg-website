/* School (deelmodule): het ene overzicht van het gezin. Hoort bij
   school/ouderportaal.js (toestemming en afspraken), dat de lijsten via de
   context meegeeft.

   Een aanroep geeft alles wat er over dit gezin ligt: facturen, aanwezigheid,
   verlof, toestemmingen, afspraken en de vastgestelde rapporten. Het
   dagelijkse deel (rooster, huiswerk, cijfers, berichten) blijft in het
   bestaande `/school/mijn`, want dat is een andere vraag en een ander tempo.

   Openstaande bedragen staan er wel in, met de mededeling dat ze geen enkel
   gevolg hebben voor het onderwijs. Dat is geen geruststelling maar hoe het
   werkt. */
module.exports = (sctx) => {
  const { router, S, eigenVeld, K, gezinSessie, leerlingSleutel,
    toestemmingen: T, afspraken: A, openBedrag, mijnSleutels } = sctx;

  /* ---------- het portaal van het gezin ----------
     Een aanroep, alles wat er over ons ligt: facturen, aanwezigheid, verlof,
     toestemmingen, afspraken en de vastgestelde rapporten. */
  router.post('/school/portaal', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const mijn = s.beheerder ? mijnSleutels(s) : [leerlingSleutel(s.g.code, s.p.id)];
    const uit = { ok: true, facturen: [], aanwezigheid: [], toestemmingen: [], afspraken: [], vrijeMomenten: [], verlof: [], rapporten: [] };
    for (const sch of Object.values(S())) {
      const leerlingen = Object.values(sch.leerlingen || {}).filter(l => mijn.includes(l.sleutel));
      for (const f of (sch.facturen || [])) {
        if (!leerlingen.some(l => l.id === f.leerlingId)) continue;
        uit.facturen.push({ school: sch.naam, nummer: f.nummer, soort: f.soort, omschrijving: f.omschrijving,
          centen: f.centen, open: openBedrag(f), vervalt: f.vervalt, vrijwillig: !!f.vrijwillig, betaallink: f.betaallink || null });
      }
      for (const les of (sch.presentie || []).slice(0, 500)) for (const r of les.regels) if (mijn.includes(r.leerling))
        uit.aanwezigheid.push({ school: sch.naam, datum: les.datum, uur: les.uur, vak: les.vak, stand: r.stand, minuten: r.minuten, door: les.door });
      for (const t of T(sch)) for (const sleutel of mijn) {
        const k = t.klasCode ? eigenVeld(K(), t.klasCode) : null;
        if (k && !(k.leerlingen || []).some(l => l.sleutel === sleutel)) continue;
        const a = t.antwoorden[sleutel];
        uit.toestemmingen.push({ school: sch.naam, id: t.id, titel: t.titel, uitleg: t.uitleg, tot: t.tot,
          sleutel, antwoord: a ? a.antwoord : undefined, beantwoord: !!a });
      }
      for (const m of A(sch)) if (m.bezet && m.bezet.gezinCode === s.g.code)
        uit.afspraken.push({ school: sch.naam, datum: m.datum, tijd: m.tijd, minuten: m.minuten, leraar: m.leraar, plek: m.plek, kind: m.bezet.kind });
      /* En de momenten die nog VRIJ zijn in de klassen van dit gezin. Zonder
         deze lijst kon een ouder wel een moment boeken maar er geen een
         vinden: /afspraak/boek wil een momentId, en dat stond nergens waar een
         gezin bij kon. Alleen de vrije momenten, en alleen van de eigen klas
         -- wie er wel geboekt heeft, gaat een ander gezin niets aan. */
      for (const m of A(sch)) {
        if (m.bezet) continue;
        const k = eigenVeld(K(), m.klasCode || '');
        if (!k || !(k.leerlingen || []).some(l => mijn.includes(l.sleutel))) continue;
        uit.vrijeMomenten.push({ school: sch.naam, id: m.id, klas: k.naam, datum: m.datum, tijd: m.tijd,
          minuten: m.minuten, leraar: m.leraar, plek: m.plek });
      }
      for (const v of (sch.verlof || [])) if (mijn.includes(v.sleutel))
        uit.verlof.push({ school: sch.naam, van: v.van, tot: v.tot, soort: v.soort, status: v.status, besluitReden: v.besluitReden || null });
      for (const r of (sch.rapporten || [])) {
        if (!r.vastgesteld) continue;
        for (const rij of (r.leerlingen || [])) if (mijn.includes(rij.sleutel))
          uit.rapporten.push({ school: sch.naam, klas: r.klas, periode: r.periode, naam: rij.naam, gemiddelde: rij.gemiddelde, tekst: rij.tekst });
      }
    }
    uit.openTotaal = uit.facturen.reduce((n, f) => n + f.open, 0);
    uit.blokkeertOnderwijs = false;
    uit.uitleg = 'Openstaande bedragen hebben geen enkel gevolg voor het onderwijs. Rooster, huiswerk en cijfers staan in het gewone schooloverzicht.';
    uit.aanwezigheid = uit.aanwezigheid.slice(0, 200);
    uit.vrijeMomenten = uit.vrijeMomenten
      .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd)).slice(0, 60);
    res.json(uit);
  });
};
