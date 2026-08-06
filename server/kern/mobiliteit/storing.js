/* Mobility OS (deelmodule): de storing en de teruggave. Een vervoerder meldt
   dat een dienst te laat was of uitviel, en iedereen met een kaartje in dat
   venster krijgt automatisch geld terug. De controle door de conducteur staat
   in ./kaartje-gebruik.

   DE VERTRAGING KOMT VAN DE VERVOERDER, NIET VAN ONS. Wij hebben live posities
   maar geen dienstregeling per halte, dus "hoeveel te laat" kunnen wij niet
   berekenen -- en een teruggave op een geraden getal is erger dan geen
   teruggave. De vervoerder meldt het zelf, met een venster en een oorzaak. Dat
   is ook eerlijk andersom: het is zijn dienst die uitviel, en zijn afdracht die
   eraf gaat. */

// zo veel krijgt een reiziger terug, per zwaarte van de storing
const TERUGGAVE = {
  vertraging: { deel: 0.5, naam: 'vertraging' },
  uitval: { deel: 1, naam: 'uitgevallen rit' }
};
const STORING_MAX_UREN = 24;      // een venster langer dan een dag is geen storing

module.exports = (ctx) => {
  const { db, save, id, schoon, nu, pay, findSupplier, notify, logActivity, ensureKaartjes } = ctx;

  function ensureStoringen() {
    if (!Array.isArray(db.data.mobStoringen)) db.data.mobStoringen = [];
  }

  /* Een storing melden. Alleen de vervoerder zelf, over zijn eigen lijn: een
     melding is hier een betalingsverplichting, geen mededeling. */
  function storingMeld(supplier, actor, body = {}) {
    ensureStoringen();
    const zaak = findSupplier(supplier.code);
    const lijn = (zaak && (zaak.lijnen || []).find(l => l.id === schoon(body.lijnId, 40))) || null;
    if (!lijn) return { status: 404, error: 'U rijdt die lijn niet.' };
    const soort = TERUGGAVE[schoon(body.soort, 20)] ? schoon(body.soort, 20) : null;
    if (!soort) return { status: 400, error: 'Kies een soort: ' + Object.keys(TERUGGAVE).join(', ') };

    const van = new Date(schoon(body.van, 25) || nu());
    const tot = new Date(schoon(body.tot, 25) || nu());
    if (isNaN(van) || isNaN(tot)) return { status: 400, error: 'Geef een venster op met geldige tijden.' };
    if (tot <= van) return { status: 400, error: 'Het venster eindigt niet na zijn begin.' };
    if (tot - van > STORING_MAX_UREN * 3600 * 1000)
      return { status: 400, error: 'Een venster van meer dan ' + STORING_MAX_UREN + ' uur is geen storing; meld hem per dag.' };

    const s = { id: id('st'), vervoerder: supplier.code, lijnId: lijn.id, lijnNaam: lijn.naam,
      soort, oorzaak: schoon(body.oorzaak, 200) || null,
      van: van.toISOString(), tot: tot.toISOString(),
      gemeldDoor: schoon(actor, 60) || 'personeel', gemeld: nu(), verwerkt: null };
    db.data.mobStoringen.push(s);
    save();
    logActivity(supplier.code, actor, 'meldde een ' + TERUGGAVE[soort].naam + ' op ' + lijn.naam);
    return { ok: true, storing: storingBeeld(s) };
  }

  const storingBeeld = s => ({ id: s.id, vervoerder: s.vervoerder, lijnId: s.lijnId, lijnNaam: s.lijnNaam,
    soort: s.soort, oorzaak: s.oorzaak, van: s.van, tot: s.tot, gemeld: s.gemeld,
    verwerkt: s.verwerkt || null });

  const storingLijst = supplier => {
    ensureStoringen();
    return { ok: true, storingen: db.data.mobStoringen.filter(s => s.vervoerder === supplier.code)
      .slice(-40).reverse().map(storingBeeld), soorten: TERUGGAVE };
  };

  /* De teruggave uitvoeren. Bewust een aparte, EENMALIGE stap en geen
     automatische lus bij het lezen: geld verplaatsen hoort een besluit te zijn
     met een moment en een naam eronder, en een storing die twee keer wordt
     verwerkt betaalt twee keer uit. `verwerkt` staat op de storing, niet op het
     kaartje, want de storing is wat een keer mag gebeuren. */
  async function storingTeruggave(supplier, actor, body = {}) {
    ensureStoringen();
    ensureKaartjes();
    const s = db.data.mobStoringen.find(x => x.id === schoon(body.id, 40) && x.vervoerder === supplier.code);
    if (!s) return { status: 404, error: 'Storing niet gevonden.' };
    if (s.verwerkt) return { status: 409, error: 'Deze storing is al verwerkt op ' + s.verwerkt.at.slice(0, 16).replace('T', ' ') + '.' };

    const deel = TERUGGAVE[s.soort].deel;
    const vanMs = new Date(s.van).getTime(), totMs = new Date(s.tot).getTime();
    // wie had een kaartje voor DEZE lijn dat in het venster geldig was?
    const geraakt = db.data.mobKaartjes.filter(k => k.vervoerder === s.vervoerder &&
      // een abonnement hangt niet aan een lijn maar aan een lijstje lijnen
      (k.product === 'abonnement' ? (k.lijnen || []).includes(s.lijnId) : k.lijnId === s.lijnId) &&
      !(k.terugbetaald && k.terugbetaald.volledig) &&
      new Date(k.geldigVan).getTime() <= totMs && new Date(k.geldigTot).getTime() >= vanMs);

    const gedaan = [], mislukt = [];
    for (const k of geraakt) {
      /* NOOIT meer terug dan de kaartprijs. Een reiziger die eerder 50% kreeg
         voor een vertraging en daarna nog eens 100% voor uitval, kreeg anders
         anderhalf keer zijn geld -- en dat gaat van de vervoerder af, die het
         niet ziet. Er wordt daarom naar een DOEL gerekend (welk deel hoort deze
         reiziger in totaal terug te hebben) en alleen het verschil geboekt. */
      const alGegeven = (k.terugbetaald && k.terugbetaald.centen) || 0;
      /* De basis van een teruggave is wat DEZE reis kostte. Voor een los
         kaartje is dat de kaartprijs; voor een abonnement de DAGPRIJS -- een
         maandkaarthouder de helft van zijn maand teruggeven omdat de bus een uur
         te laat was, is geen compensatie maar een weggevertje, en het komt van
         de vervoerder af. */
      const basis = k.product === 'abonnement' ? (k.dagPrijs || Math.round(k.prijs / (k.dagen || 30))) : k.prijs;
      const doel = Math.round(basis * deel);
      const centen = doel - alGegeven;
      if (centen <= 0) continue;                  // deze reiziger heeft al genoeg terug
      const b = await pay.boekAsync({ van: 'partner:' + s.vervoerder, naar: 'lid:' + k.codenaam, centen,
        soort: 'ovteruggave', oms: 'Teruggave ' + TERUGGAVE[s.soort].naam + ' · ' + s.lijnNaam });
      /* Een mislukte boeking slaat DEZE reiziger over en niet de hele ronde --
         maar hij verdwijnt niet. Stil overslaan zou de manager laten denken dat
         iedereen betaald is (LAT.md regel 5); daarom komt hij met reden terug
         in het antwoord, zodat de storing opnieuw verwerkt kan worden. */
      if (b.error) { mislukt.push({ codenaam: k.codenaam, centen, reden: b.error }); continue; }
      /* `volledig` bepaalt of het kaartje ook vervalt. Bij uitval is de rit niet
         gereden en is het geld helemaal terug; bij vertraging is het een
         vergoeding en blijft de reiziger gewoon meerijden. */
      k.terugbetaald = { at: nu(), centen: doel, laatste: centen, storing: s.id, soort: s.soort,
        // een abonnement vervalt NOOIT door een storingsteruggave: er zijn nog dagen over
        volledig: k.product !== 'abonnement' && doel >= k.prijs };
      gedaan.push({ codenaam: k.codenaam, centen });
      notify(k.key, { icon: 'ticket', title: 'RTG OV',
        body: 'Uw reis op ' + s.lijnNaam + ' had een ' + TERUGGAVE[s.soort].naam + '. U krijgt automatisch geld terug.',
        scope: 'ov' });
    }
    /* Alleen een ronde waarin niets mislukte telt als verwerkt. Anders is de
       storing "afgehandeld" terwijl er mensen niet betaald zijn, en juist die
       stand mag niet vast komen te staan. */
    if (!mislukt.length)
      s.verwerkt = { at: nu(), door: schoon(actor, 60) || 'personeel', aantal: gedaan.length,
        centen: gedaan.reduce((n, g) => n + g.centen, 0) };
    save();
    logActivity(supplier.code, actor, 'verwerkte de teruggave voor ' + s.lijnNaam +
      ' (' + gedaan.length + ' reizigers' + (mislukt.length ? ', ' + mislukt.length + ' mislukt' : '') + ')');
    return { ok: true, storing: storingBeeld(s), terugbetaald: gedaan.length,
      centen: gedaan.reduce((n, g) => n + g.centen, 0), deel, mislukt,
      uitleg: mislukt.length
        ? mislukt.length + ' teruggave(n) lukten niet (' + mislukt[0].reden + '); de storing staat nog open, verwerk hem opnieuw.'
        : (gedaan.length ? 'Iedereen met een geldig kaartje in dat venster kreeg ' + Math.round(deel * 100) + '% terug.'
          : 'Er was in dat venster niemand die nog geld terug moest krijgen.') };
  }
  return { TERUGGAVE, ensureStoringen, storingMeld, storingLijst, storingTeruggave, storingBeeld };
};
