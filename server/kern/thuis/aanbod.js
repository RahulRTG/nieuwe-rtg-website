/* RTG Thuis, deel "aanbod": de host-kant. Een lid zet zijn huis live met
   alles erop en eraan (prijs, kortingen, borg, huisregels, keyless,
   annuleringsbeleid), beheert de kalender met blokkades, nodigt co-hosts
   uit en krijgt gratis AI-prijsadvies. Krijgt de gedeelde ctx. */
module.exports = (ctx) => {
  const { save, crypto, schoon, huizen, boekingen, TYPES, VOORZIENINGEN, ANNULERING,
    geldigeDatum, raakt, nu, landVind, ratingVan, superhost, magBeheren } = ctx;

  const getal = (v, min, max, std) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : std; };

  /* Een huis aanmaken of bijwerken. Alles gevalideerd; het land wordt uit de
     plaats/landtekst herkend zodat de Reiswijzer bij elke boeking meereist. */
  function huisZet(codenaam, data, id) {
    data = data || {};
    const bestaand = id ? huizen()[id] : null;
    if (id && !bestaand) return { status: 404, error: 'Dit huis bestaat niet.' };
    if (bestaand && !magBeheren(bestaand, codenaam)) return { status: 403, error: 'Alleen de host (of een co-host) beheert dit huis.' };
    if (!bestaand && Object.values(huizen()).filter(h => h.host === codenaam).length >= 10)
      return { status: 429, error: 'Maximaal 10 huizen per host.' };
    const titel = schoon(data.titel, 80), plaats = schoon(data.plaats, 60);
    if (!titel || !plaats) return { status: 400, error: 'Geef je huis een titel en een plaats.' };
    const type = TYPES[data.type] ? data.type : 'huis';
    const land = landVind(schoon(data.land, 40) || plaats) || (bestaand && bestaand.land) || null;
    const h = bestaand || { id: 'TH' + crypto.randomBytes(4).toString('hex').toUpperCase(), host: codenaam, coHosts: [], blokkades: [], gemaakt: nu() };
    Object.assign(h, {
      titel, plaats, land, type,
      beschrijving: schoon(data.beschrijving, 600),
      prijs: getal(data.prijs, 1, 100000, 100),
      schoonmaak: getal(data.schoonmaak, 0, 5000, 0),
      borg: getal(data.borg, 0, 5000, 0),
      maxGasten: Math.round(getal(data.maxGasten, 1, 20, 2)),
      slaapkamers: Math.round(getal(data.slaapkamers, 0, 20, 1)),
      bedden: Math.round(getal(data.bedden, 1, 40, 1)),
      badkamers: Math.round(getal(data.badkamers, 1, 20, 1)),
      voorzieningen: (Array.isArray(data.voorzieningen) ? data.voorzieningen : []).filter(v => VOORZIENINGEN.includes(v)).slice(0, VOORZIENINGEN.length),
      instant: data.instant === true,
      keyless: data.keyless === true,
      minNachten: Math.round(getal(data.minNachten, 1, 90, 1)),
      kortingWeek: Math.round(getal(data.kortingWeek, 0, 50, 0)),
      kortingMaand: Math.round(getal(data.kortingMaand, 0, 60, 0)),
      annulering: ANNULERING[data.annulering] ? data.annulering : 'flex',
      huisregels: schoon(data.huisregels, 300),
      visual: Math.round(getal(data.visual, 0, 7, 0)),
      live: data.live !== false
    });
    huizen()[h.id] = h;
    save();
    return { ok: true, huis: metStats(h) };
  }

  const metStats = h => Object.assign({}, h, { rating: ratingVan(h.id), superhost: superhost(h.host), annuleringTekst: ANNULERING[h.annulering] });

  function mijnHuizen(codenaam) {
    return { ok: true, huizen: Object.values(huizen()).filter(h => magBeheren(h, codenaam)).map(metStats) };
  }

  // kalenderblokkades: de host houdt datums vrij voor zichzelf (of onderhoud)
  function blokkeer(codenaam, id, van, tot, weg) {
    const h = huizen()[id];
    if (!h || !magBeheren(h, codenaam)) return { status: 404, error: 'Dit huis beheert u niet.' };
    if (weg) { h.blokkades = (h.blokkades || []).filter(b => !(b.van === van && b.tot === tot)); save(); return { ok: true, blokkades: h.blokkades }; }
    if (!geldigeDatum(van) || !geldigeDatum(tot) || van >= tot) return { status: 400, error: 'Kies een geldige periode (van voor tot).' };
    h.blokkades = (h.blokkades || []).filter(b => !raakt(van, tot, b.van, b.tot));
    h.blokkades.push({ van, tot });
    h.blokkades = h.blokkades.slice(-50);
    save();
    return { ok: true, blokkades: h.blokkades };
  }

  // co-hosts: iemand anders mag meebeheren (premium, gratis)
  function coHostZet(codenaam, id, wie, weg) {
    const h = huizen()[id];
    if (!h || h.host !== codenaam) return { status: 403, error: 'Alleen de hoofdhost beheert de co-hosts.' };
    const c = schoon(wie, 40);
    if (!c) return { status: 400, error: 'Wie wordt de co-host (codenaam)?' };
    h.coHosts = (h.coHosts || []).filter(x => x !== c);
    if (!weg) { if (h.coHosts.length >= 5) return { status: 429, error: 'Maximaal 5 co-hosts.' }; h.coHosts.push(c); }
    save();
    return { ok: true, coHosts: h.coHosts };
  }

  /* Het gratis AI-prijsadvies: kijkt naar vergelijkbare live huizen (zelfde
     plaats, anders zelfde type) en de eigen bezetting van de komende 30
     dagen, en zegt eerlijk waarom. Adviseert; de host beslist. */
  function slimmePrijs(codenaam, id) {
    const h = huizen()[id];
    if (!h || !magBeheren(h, codenaam)) return { status: 404, error: 'Dit huis beheert u niet.' };
    const rest = Object.values(huizen()).filter(x => x.id !== id && x.live);
    let verg = rest.filter(x => x.plaats.toLowerCase() === h.plaats.toLowerCase());
    let basis = 'huizen in ' + h.plaats;
    if (verg.length < 2) { verg = rest.filter(x => x.type === h.type); basis = 'huizen van het type ' + (TYPES[h.type] || h.type); }
    const vandaag = new Date(); const totDag = new Date(Date.now() + 30 * 86400000);
    const van = vandaag.toISOString().slice(0, 10), tot = totDag.toISOString().slice(0, 10);
    const bezet = boekingen().filter(b => b.huisId === id && ['bevestigd', 'ingecheckt'].includes(b.status) && raakt(van, tot, b.van, b.tot))
      .reduce((s, b) => s + Math.min(ctx.nachten(b.van < van ? van : b.van, b.tot > tot ? tot : b.tot), 30), 0);
    const bezetting = Math.min(100, Math.round(bezet / 30 * 100));
    if (!verg.length) return { ok: true, advies: h.prijs, bezettingPct: bezetting, uitleg: 'Nog geen vergelijkbare huizen om tegen af te zetten; houd uw eigen prijs aan en kijk over een paar weken opnieuw.' };
    const gem = verg.reduce((s, x) => s + x.prijs, 0) / verg.length;
    let advies = gem;
    let reden = 'het gemiddelde van ' + verg.length + ' ' + basis + ' is € ' + Math.round(gem);
    if (bezetting >= 70) { advies = gem * 1.1; reden += '; uw bezetting is hoog (' + bezetting + '%), dus er is ruimte omhoog'; }
    else if (bezetting <= 20) { advies = gem * 0.92; reden += '; uw bezetting is laag (' + bezetting + '%), dus iets scherper prijzen helpt'; }
    return { ok: true, advies: Math.max(1, Math.round(advies)), huidig: h.prijs, bezettingPct: bezetting,
      uitleg: 'Advies: ' + reden + '. Het advies is gratis en vrijblijvend; u beslist.' };
  }

  return { thuisHuisZet: huisZet, thuisMijnHuizen: mijnHuizen, thuisBlokkeer: blokkeer, thuisCoHost: coHostZet, thuisSlimmePrijs: slimmePrijs };
};
