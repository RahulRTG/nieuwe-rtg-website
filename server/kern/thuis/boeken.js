/* RTG Thuis, deel "boeken": zoeken met filters, de transparante prijsopbouw
   (0% servicekosten voor leden -- dat is het "beter dan Airbnb"), instant
   boeken of aanvragen, het annuleringsbeleid, check-in met keyless deurcode
   en check-uit met een geplande uitbetaling. Nooit de belofte dat een
   betaling al verwerkt is. Krijgt de gedeelde ctx. */
module.exports = (ctx) => {
  const { save, crypto, schoon, huizen, boekingen, TYPES, ANNULERING, geldigeDatum,
    nachten, vrij, nu, reiswijzer, ratingVan, gastScore, superhost, hostNaam } = ctx;

  const publiek = h => ({ id: h.id, titel: h.titel, plaats: h.plaats, land: h.land, type: h.type,
    typeLabel: TYPES[h.type] || h.type, beschrijving: h.beschrijving, prijs: h.prijs, schoonmaak: h.schoonmaak,
    borg: h.borg, maxGasten: h.maxGasten, slaapkamers: h.slaapkamers, bedden: h.bedden, badkamers: h.badkamers,
    voorzieningen: h.voorzieningen || [], instant: !!h.instant, keyless: !!h.keyless, minNachten: h.minNachten,
    kortingWeek: h.kortingWeek, kortingMaand: h.kortingMaand, annulering: h.annulering,
    annuleringTekst: ANNULERING[h.annulering], huisregels: h.huisregels, visual: h.visual,
    host: hostNaam(h.host), hostZaak: String(h.host).startsWith('zaak:'),
    superhost: superhost(h.host), rating: ratingVan(h.id) });

  /* De prijsopbouw, transparant: nachten x prijs, week-/maandkorting,
     schoonmaak, en 0% servicekosten (expliciet als regel, dat is het punt). */
  function prijsVoor(h, n) {
    const basis = Math.round(h.prijs * n * 100) / 100;
    const kortingPct = n >= 28 ? h.kortingMaand : n >= 7 ? h.kortingWeek : 0;
    const korting = Math.round(basis * kortingPct) / 100;
    const totaal = Math.round((basis - korting + h.schoonmaak) * 100) / 100;
    return { nachten: n, perNacht: h.prijs, basis, kortingPct, korting, schoonmaak: h.schoonmaak,
      serviceKosten: 0, serviceTekst: '0% servicekosten voor leden -- bij RTG betaal je wat de host vraagt',
      borg: h.borg, totaal };
  }

  function zoek(codenaam, f) {
    f = f || {};
    const q = schoon(f.plaats, 60).toLowerCase();
    const van = geldigeDatum(f.van) ? f.van : null, tot = geldigeDatum(f.tot) ? f.tot : null;
    const gasten = Math.max(1, Math.round(Number(f.gasten) || 1));
    let lijst = Object.values(huizen()).filter(h => h.live && h.host !== codenaam);
    if (q) lijst = lijst.filter(h => h.plaats.toLowerCase().includes(q) || h.titel.toLowerCase().includes(q) || String(h.land || '').toLowerCase() === q);
    if (TYPES[f.type]) lijst = lijst.filter(h => h.type === f.type);
    if (f.instant === true) lijst = lijst.filter(h => h.instant);
    if (Number(f.maxPrijs) > 0) lijst = lijst.filter(h => h.prijs <= Number(f.maxPrijs));
    for (const v of (Array.isArray(f.voorzieningen) ? f.voorzieningen : [])) lijst = lijst.filter(h => (h.voorzieningen || []).includes(v));
    lijst = lijst.filter(h => h.maxGasten >= gasten);
    if (van && tot && van < tot) lijst = lijst.filter(h => vrij(h.id, van, tot));
    // superhosts en goed beoordeelde huizen eerst, dan op prijs
    const score = h => (superhost(h.host) ? 2 : 0) + (ratingVan(h.id).sterren || 0) / 5;
    lijst.sort((a, b) => score(b) - score(a) || a.prijs - b.prijs);
    return { ok: true, huizen: lijst.slice(0, 60).map(h => {
      const uit = publiek(h);
      if (van && tot && van < tot) uit.prijsopbouw = prijsVoor(h, nachten(van, tot));
      return uit;
    }) };
  }

  function detail(id, van, tot) {
    const h = huizen()[id];
    if (!h || !h.live) return { status: 404, error: 'Dit huis bestaat niet (meer).' };
    const uit = publiek(h);
    if (geldigeDatum(van) && geldigeDatum(tot) && van < tot) {
      uit.beschikbaar = vrij(id, van, tot);
      uit.prijsopbouw = prijsVoor(h, nachten(van, tot));
    }
    if (h.land && reiswijzer) { const w = reiswijzer(h.land); if (!w.error) uit.reiswijzer = w; }
    return { ok: true, huis: uit };
  }

  function boek(codenaam, data) {
    data = data || {};
    const h = huizen()[String(data.id || '')];
    if (!h || !h.live) return { status: 404, error: 'Dit huis bestaat niet (meer).' };
    if (h.host === codenaam || (h.coHosts || []).includes(codenaam)) return { status: 400, error: 'Je eigen huis boeken hoeft niet -- je hebt de sleutel al.' };
    const van = data.van, tot = data.tot;
    if (!geldigeDatum(van) || !geldigeDatum(tot) || van >= tot) return { status: 400, error: 'Kies een geldige periode.' };
    if (van < new Date().toISOString().slice(0, 10)) return { status: 400, error: 'De aankomstdatum ligt in het verleden.' };
    const n = nachten(van, tot);
    if (n < h.minNachten) return { status: 400, error: 'Dit huis vraagt minimaal ' + h.minNachten + ' nacht(en).' };
    const gasten = Math.round(Number(data.gasten) || 1);
    if (gasten < 1 || gasten > h.maxGasten) return { status: 400, error: 'Dit huis is voor maximaal ' + h.maxGasten + ' gasten.' };
    if (!vrij(h.id, van, tot)) return { status: 409, error: 'Deze periode is (deels) al bezet; kies andere datums.' };
    const b = {
      ref: 'RTG-T-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      huisId: h.id, titel: h.titel, plaats: h.plaats, land: h.land, host: h.host, gast: codenaam,
      van, tot, gasten, prijsopbouw: prijsVoor(h, n),
      bericht: schoon(data.bericht, 300),
      status: h.instant ? 'bevestigd' : 'aangevraagd',
      deurcode: h.keyless ? String(crypto.randomInt(100000, 1000000)) : null,
      betaling: 'De betaling loopt via RTG Pay bij bevestiging; er is nog niets afgeschreven.',
      berichten: [], at: nu()
    };
    boekingen().unshift(b);
    if (boekingen().length > 20000) boekingen().length = 20000;
    save();
    const uit = { ok: true, boeking: gastZicht(b) };
    if (h.land && reiswijzer) { const w = reiswijzer(h.land); if (!w.error) uit.reiswijzer = w; }
    return uit;
  }

  /* De deurcode is er alleen voor de gast, vanaf 3 dagen voor aankomst (of na
     check-in) -- niet eerder, en nooit voor iemand anders. */
  function gastZicht(b) {
    const kopie = Object.assign({}, b);
    const dichtbij = new Date(b.van) - Date.now() <= 3 * 86400000;
    if (!(b.status === 'ingecheckt' || (b.status === 'bevestigd' && dichtbij))) kopie.deurcode = null;
    kopie.host = hostNaam(b.host); // een zaak-host toont zijn zaaknaam
    delete kopie.berichten;
    return kopie;
  }

  function beslis(hostCodenaam, ref, akkoord) {
    const b = boekingen().find(x => x.ref === String(ref || ''));
    const h = b && huizen()[b.huisId];
    if (!b || !h || !ctx.magBeheren(h, hostCodenaam)) return { status: 404, error: 'Deze aanvraag is er niet (meer).' };
    if (b.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al behandeld.' };
    b.status = akkoord ? 'bevestigd' : 'afgewezen';
    save();
    return { ok: true, boeking: gastZicht(b) };
  }

  // annuleren volgens het beleid van het huis; terugPct is registratief
  function annuleer(codenaam, ref) {
    const b = boekingen().find(x => x.ref === String(ref || ''));
    if (!b || b.gast !== codenaam) return { status: 404, error: 'Deze boeking is er niet.' };
    if (!['aangevraagd', 'bevestigd'].includes(b.status)) return { status: 409, error: 'Deze boeking is niet meer te annuleren.' };
    const h = huizen()[b.huisId];
    const dagenVooraf = Math.floor((new Date(b.van) - Date.now()) / 86400000);
    const beleid = h ? h.annulering : 'flex';
    let terugPct = 0;
    if (b.status === 'aangevraagd') terugPct = 100;
    else if (beleid === 'flex') terugPct = dagenVooraf >= 1 ? 100 : 50;
    else if (beleid === 'gemiddeld') terugPct = dagenVooraf >= 5 ? 100 : 50;
    else terugPct = dagenVooraf >= 7 ? 50 : 0;
    b.status = 'geannuleerd';
    b.terugPct = terugPct;
    save();
    return { ok: true, ref: b.ref, terugPct, beleid: ANNULERING[beleid] };
  }

  function checkin(codenaam, ref) {
    const b = boekingen().find(x => x.ref === String(ref || ''));
    if (!b || b.gast !== codenaam) return { status: 404, error: 'Deze boeking is er niet.' };
    if (b.status !== 'bevestigd') return { status: 409, error: 'Deze boeking is niet klaar voor check-in.' };
    b.status = 'ingecheckt';
    save();
    return { ok: true, boeking: gastZicht(b) };
  }
  function checkuit(codenaam, ref) {
    const b = boekingen().find(x => x.ref === String(ref || ''));
    if (!b || (b.gast !== codenaam && b.host !== codenaam)) return { status: 404, error: 'Deze boeking is er niet.' };
    if (b.status !== 'ingecheckt') return { status: 409, error: 'Er is niemand ingecheckt.' };
    b.status = 'uitgecheckt';
    b.uitbetaling = { status: 'gepland', naar: 'de RTG Bank-rekening van de host', bedrag: b.prijsopbouw.totaal };
    save();
    return { ok: true, boeking: gastZicht(b), review: 'Jullie kunnen elkaar nu allebei een review geven.' };
  }

  return { thuisZoek: zoek, thuisDetail: detail, thuisBoek: boek, thuisBeslis: beslis,
    thuisAnnuleer: annuleer, thuisCheckin: checkin, thuisCheckuit: checkuit, thuisGastZicht: gastZicht, thuisPubliek: publiek };
};
