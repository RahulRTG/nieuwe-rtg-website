/* RTG Thuis, deel "zakelijk": de COMMERCIELE TAK voor leveranciers.

   Een prive-host verhuurt zijn eigen huis: geen btw, geen commissie, en het
   lid betaalt 0% servicekosten. Een zaak die beroepsmatig verhuurt is iets
   anders, en dat moet je ook zo behandelen:
   - op een commerciele overnachting hoort logies-btw. Het percentage komt
     uit de landtabel die de Regelwacht bijhoudt, dus het klopt overal ter
     wereld en het blijft kloppen;
   - een zaak mag een portefeuille draaien in plaats van een enkel huis;
   - langverblijf (zakenreis, project, relocatie) rekent vanaf 28 nachten op
     een maandtarief in plaats van de nachtprijs;
   - een zakelijke gast kan op factuur boeken, met een kostenplaats erbij;
   - de zaak betaalt de gewone RTG-partnercommissie over haar omzet -- het
     lid nog steeds 0% servicekosten. Dat verschil staat aan beide kanten
     open en uitgerekend op het scherm.

   Wat we nooit doen: beweren dat er al betaald is. De prijsopbouw is
   transparant, de uitbetaling staat "gepland" en een factuur "volgt".
   Krijgt de gedeelde ctx van kern/thuis/index.js. */
module.exports = (ctx) => {
  const { save, schoon, huizen, boekingen, nachten, TYPES, LANDEN, findSupplier, hostNaam } = ctx;

  const getal = (v, min, max, std) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : std; };
  const isZaak = h => String((h && h.host) || '').startsWith('zaak:');
  const codeVan = h => String(h.host).slice(5);
  /* Commercieel = een zaak die de tak heeft aangezet. Een lid-host blijft
     altijd prive verhuren, ook als hij tien huizen heeft. */
  const commercieel = h => !!(h && h.zakelijk && h.zakelijk.aan && isZaak(h));

  /* Het logies-btw-tarief van het land, uit de landtabel van de Regelwacht.
     Kent het land geen logiestarief, dan rekenen we eerlijk met 0. */
  function logiesBtw(land) {
    const L = LANDEN && LANDEN[String(land || '')];
    const t = L && L.tarieven && Number(L.tarieven.logies);
    return Number.isFinite(t) ? Math.max(0, Math.min(30, t)) : 0;
  }
  const landNaam = land => ((LANDEN && LANDEN[String(land || '')]) || {}).naam || null;

  /* De partnercommissie van de zaak: hetzelfde tarief dat zij overal op het
     platform betaalt. Geen apart Thuis-tarief, geen verrassing. */
  function commissiePct(h) {
    const z = isZaak(h) && findSupplier && findSupplier(codeVan(h));
    const r = z && Number(z.rate);
    return Number.isFinite(r) ? Math.round(r * 1000) / 10 : 10;
  }

  /* ---------- het commerciele profiel van een huis ---------- */
  function zakelijkZet(hostVlag, id, data) {
    const h = huizen()[String(id || '')];
    if (!h || h.host !== hostVlag) return { status: 404, error: 'Dit huis beheert u niet.' };
    if (!isZaak(h)) return { status: 403, error: 'De commerciele tak is voor zaken. Een prive-host verhuurt zonder btw en zonder commissie.' };
    data = data || {};
    h.zakelijk = {
      aan: data.aan !== false,
      opFactuur: data.opFactuur === true,
      maandprijs: getal(data.maandprijs, 0, 200000, 0),
      doelgroep: schoon(data.doelgroep, 80),
      contact: schoon(data.contact, 80)
    };
    save();
    return { ok: true, huis: profiel(h) };
  }

  function profiel(h) {
    const pct = logiesBtw(h.land);
    return {
      id: h.id, titel: h.titel, plaats: h.plaats, land: h.land, landNaam: landNaam(h.land),
      type: h.type, typeLabel: TYPES[h.type] || h.type, prijs: h.prijs, live: !!h.live,
      zakelijk: Object.assign({ aan: false, opFactuur: false, maandprijs: 0, doelgroep: '', contact: '' }, h.zakelijk || {}),
      commercieel: commercieel(h),
      btwPct: pct,
      btwTekst: pct
        ? 'Logies-btw ' + pct + '% in ' + (landNaam(h.land) || 'dit land') + ', uit de landtabel die de Regelwacht bijhoudt.'
        : 'In dit land staat er geen apart logiestarief; er wordt geen btw op de overnachting gerekend.',
      commissiePct: commissiePct(h)
    };
  }

  /* ---------- de prijsopbouw van een commercieel verblijf ----------
     Bovenop de gewone opbouw (nachten, week-/maandkorting, schoonmaak,
     0% servicekosten): het maandtarief bij langverblijf en de logies-btw.
     Een prive-huis gaat hier ongewijzigd doorheen. */
  function zakelijkOpbouw(h, n, p) {
    if (!commercieel(h)) return p;
    const z = h.zakelijk;
    const uit = Object.assign({}, p);
    if (z.maandprijs > 0 && n >= 28) {
      const perNacht = Math.round(z.maandprijs / 30 * 100) / 100;
      uit.perNacht = perNacht;
      uit.basis = Math.round(perNacht * n * 100) / 100;
      uit.kortingPct = 0;
      uit.korting = 0;
      uit.langverblijf = { maandprijs: z.maandprijs, perNacht,
        tekst: 'Langverblijf: vanaf 28 nachten geldt het maandtarief van de zaak, niet de nachtprijs.' };
    }
    const excl = Math.round((uit.basis - uit.korting + uit.schoonmaak) * 100) / 100;
    const pct = logiesBtw(h.land);
    const btw = Math.round(excl * pct) / 100;
    uit.zakelijk = true;
    uit.exclBtw = excl;
    uit.btwPct = pct;
    uit.btw = btw;
    uit.btwTekst = pct
      ? 'Logies-btw ' + pct + '% (' + (landNaam(h.land) || h.land) + '), automatisch uit de landtabel.'
      : 'Geen logies-btw in dit land.';
    uit.opFactuur = !!z.opFactuur;
    uit.totaal = Math.round((excl + btw) * 100) / 100;
    return uit;
  }

  /* ---------- het commerciele bord van de zaak ----------
     Wat de zaak wil weten en wat de boekhouder van haar vraagt: omzet
     exclusief btw, de af te dragen logies-btw, de partnercommissie en wat
     er netto overblijft. Alleen afgeronde verblijven tellen mee. */
  function zakelijkBord(hostVlag) {
    const mijn = Object.values(huizen()).filter(h => h.host === hostVlag);
    const comm = mijn.filter(commercieel);
    const ids = comm.map(h => h.id);
    const klaar = boekingen().filter(b => ids.includes(b.huisId) && b.status === 'uitgecheckt');
    const som = (f) => Math.round(klaar.reduce((s, b) => s + (Number(f(b)) || 0), 0) * 100) / 100;
    const excl = som(b => (b.prijsopbouw || {}).exclBtw != null ? b.prijsopbouw.exclBtw : (b.prijsopbouw || {}).totaal);
    const btw = som(b => (b.prijsopbouw || {}).btw);
    const bruto = Math.round((excl + btw) * 100) / 100;
    const pct = mijn.length ? commissiePct(mijn[0]) : 10;
    const commissie = Math.round(excl * pct) / 100;
    const nachtenTotaal = klaar.reduce((s, b) => s + nachten(b.van, b.tot), 0);
    return {
      ok: true,
      zaak: hostNaam(hostVlag),
      portefeuille: { huizen: mijn.length, commercieel: comm.length, live: comm.filter(h => h.live).length },
      verblijven: klaar.length, nachten: nachtenTotaal,
      omzetExclBtw: excl, btwAfTeDragen: btw, omzetInclBtw: bruto,
      commissiePct: pct, commissie, nettoUitbetaling: Math.round((excl - commissie) * 100) / 100,
      opFactuur: klaar.filter(b => b.opFactuur).length,
      huizen: comm.map(profiel),
      uitleg: 'Het lid betaalt 0% servicekosten; de zaak draagt de logies-btw af en betaalt de gewone partnercommissie van ' + pct + '%. De uitbetaling staat gepland naar de zakelijke RTG Bank-rekening; er is nog niets overgemaakt.'
    };
  }

  /* ---------- de plek in de Mall ----------
     De Mall toont het commerciele verblijfsaanbod als een eigen verdieping:
     per stad de zaken die er verhuren, met hun vanaf-prijs. Boeken gebeurt
     gewoon in RTG Thuis, op codenaam en met dezelfde regels. */
  function mallAanbod() {
    const comm = Object.values(huizen()).filter(h => h.live && commercieel(h));
    const perStad = new Map();
    for (const h of comm) {
      const stad = h.plaats;
      if (!perStad.has(stad)) perStad.set(stad, []);
      perStad.get(stad).push({
        id: h.id, titel: h.titel, type: h.type, typeLabel: TYPES[h.type] || h.type,
        zaak: hostNaam(h.host), land: h.land, landNaam: landNaam(h.land),
        prijs: h.prijs, maandprijs: (h.zakelijk || {}).maandprijs || 0,
        maxGasten: h.maxGasten, slaapkamers: h.slaapkamers,
        doelgroep: (h.zakelijk || {}).doelgroep || null,
        opFactuur: !!(h.zakelijk || {}).opFactuur,
        btwPct: logiesBtw(h.land), visual: h.visual || 0
      });
    }
    const steden = [...perStad.entries()]
      .map(([stad, huizenLijst]) => ({
        stad, aantal: huizenLijst.length,
        vanaf: Math.min(...huizenLijst.map(x => x.prijs)),
        huizen: huizenLijst.sort((a, b) => a.prijs - b.prijs).slice(0, 12)
      }))
      .sort((a, b) => b.aantal - a.aantal || a.stad.localeCompare(b.stad));
    const particulier = Object.values(huizen()).filter(h => h.live && !commercieel(h)).length;
    return {
      ok: true, steden, aantal: comm.length, particulier,
      zaken: [...new Set(comm.map(h => hostNaam(h.host)))].length,
      pagina: '/apps/thuis.html',
      opmerking: 'De commerciele tak van RTG Thuis: zaken die beroepsmatig verhuren, met logies-btw en factuur. Naast dit aanbod staan ' + particulier + ' huizen van leden zelf, zonder btw. Voor het lid zijn beide 0% servicekosten.'
    };
  }

  return { thuisZakelijkZet: zakelijkZet, thuisZakelijkBord: zakelijkBord,
    thuisMallAanbod: mallAanbod, thuisCommercieel: commercieel,
    thuisZakelijkOpbouw: zakelijkOpbouw, thuisLogiesBtw: logiesBtw };
};
