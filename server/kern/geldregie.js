/* Kern-module "geldregie": RTG bepaalt de geldkant van het platform, vanuit
   de boardroom en binnen het model van de voorwaarden.

   - PASPRIJZEN: de maandbijdragen van de passen, volgens de ladder in
     kern/pasladder.js. De gratis app is en blijft gratis (vast 0); RTG stelt de
     RTG Pass en Business Lite in, maar nooit onder de bodem van hun trede; de
     Business Pass en de Lifestyle Pass zijn contractueel en dragen alleen een
     "vanaf". De bedragen zijn ex btw en 30% gaat naar de RTFoundation; het
     publieke endpoint voedt o.a. de voorwaardenpagina, dus wat de boardroom zet
     is meteen overal het geldende bedrag.
   - PARTNERVERGOEDING: nul, en dat is een eigenschap van het product en geen
     instelling (kern/commercie/vergoeding.js). Wat RTG wel in rekening brengt
     zijn benoemde diensten -- betaaldienst, bemiddeling, tickets, inrichting --
     en die heten nergens meer "commissie".
   - KORTINGEN: het RTG-ledenvoordeel per genre. RTG legt bij (zelfde patroon
     als het punten-tegoed): het lid betaalt minder, de zaak houdt het volle
     bedrag; zo blijft de nettoprijzen-belofte intact.

   maakGeldregie(state) volgt het vaste kern-patroon. */

const ladder = require('./pasladder');
const vergoeding = require('./commercie/vergoeding');

const PCT_KORTING_MAX = 50;     // ledenvoordeel, in procenten
const PAS_MAX_CENTEN = 10000000; // 100.000 euro per maand als bovengrens

function maakGeldregie({ db, save }) {
  const rond = n => Math.round(n * 100) / 100;
  function d() {
    if (!db.data.geldregie || typeof db.data.geldregie !== 'object')
      db.data.geldregie = { pasprijzen: {}, commissies: { standaard: {}, perZaak: {} }, kortingen: {} };
    const g = db.data.geldregie;
    if (!g.pasprijzen) g.pasprijzen = {};
    if (!g.commissies) g.commissies = { standaard: {}, perZaak: {} };
    if (!g.commissies.standaard) g.commissies.standaard = {};
    if (!g.commissies.perZaak) g.commissies.perZaak = {};
    if (!g.kortingen) g.kortingen = {};
    return g;
  }

  /* ---- pasprijzen: de ladder, met per trede een bodem ----
     De lijst zelf staat in kern/pasladder.js; hier wordt hij alleen gevuld met
     wat de boardroom heeft gezet. Zo kan er geen tweede lijst treden ontstaan,
     en kan een bodem niet op de ene plek 150 en op de andere 15000 zijn.

     Een CONTRACTUELE trede (Business, Lifestyle) krijgt geen `maandCenten` maar
     een `vanafCenten`. Dat onderscheid is het hele punt: `maandCenten` is een
     bedrag dat afgerekend wordt, `vanafCenten` is een ondergrens die getoond
     wordt. Wie ze door elkaar haalt, zet een niet-afgesproken bedrag op een
     factuur -- zie de kop van kern/pasprijs.js. */
  function pasprijzen() {
    const g = d();
    const passen = {};
    for (const t of ladder.treden()) {
      const gezet = g.pasprijzen[t.id];
      const rij = { naam: t.naam, voor: t.voor, beschikbaar: t.beschikbaar, exBtw: true };
      if (t.vast) { rij.maandCenten = t.bodemCenten; rij.vast = true; }
      else if (t.contractueel) {
        rij.contractueel = true;
        rij.opMaat = true;                       // de oude naam; schermen kennen hem zo
        rij.vanafCenten = t.bodemCenten;
        rij.rtfDeel = 0.30;
        rij.rtfVanafCenten = Math.round(t.bodemCenten * 0.30);
      } else {
        const centen = Number.isFinite(gezet) ? gezet : t.standaardCenten;
        rij.maandCenten = centen;
        rij.bodemCenten = t.bodemCenten;
        rij.rtfCenten = Math.round(centen * 0.30);
      }
      passen[t.id] = rij;
    }
    return { status: 200, passen };
  }
  function pasprijsZet(data) {
    const pas = String(data.pas || '');
    const centen = Math.round(Number(data.euro) * 100);
    /* De keuring staat in de ladder, niet hier: de boardroom, de API en een
       latere zelfbedieningspagina horen dezelfde zin te geven. Alles wat een
       bedrag afwijst -- vast, contractueel, onbekend, onder de bodem -- komt
       daar vandaan. */
    const bezwaar = ladder.keurCenten(pas, centen);
    if (bezwaar) return { status: 400, error: bezwaar };
    if (centen > PAS_MAX_CENTEN)
      return { status: 400, error: 'Geef een bedrag van hoogstens 100.000 euro per maand.' };
    d().pasprijzen[pas] = centen;
    save();
    return { status: 200, ok: true, pas, maandCenten: centen };
  }

  /* ---- partnervergoeding: NUL, en dat is geen instelling ----
     De generieke commissieknop is weg (20 augustus 2026). Hij stond op 12
     procent standaard, tot 30 procent per genre of per zaak, terwijl de
     partnervoorwaarden 0% beloofden en twee schermen hard "EUR 0,00" printten.
     Vier antwoorden op een vraag. De reden en de vier vergoedingssoorten die er
     WEL zijn, staan in kern/commercie/vergoeding.js.

     commissieVoor blijft bestaan omdat de aanroepers hem kennen; hij geeft nu
     altijd nul. Zo hoeft geen enkele beller te weten dat dit is veranderd, en
     kan er ook geen beller achterblijven die nog een oud tarief leest. */
  function commissieVoor(s) {
    if (!s) return null;
    return vergoeding.commissieVoor(s);
  }
  function commissieZet() {
    return { status: 400, error: vergoeding.waaromGeenCommissie() };
  }

  /* ---- kortingen: het RTG-ledenvoordeel per genre (RTG legt bij) ---- */
  function kortingZet(data) {
    const genre = String(data.genre || '');
    if (!db.data.supplierTypes[genre]) return { status: 404, error: 'Dit genre bestaat niet.' };
    const pct = Number(data.pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > PCT_KORTING_MAX)
      return { status: 400, error: 'Geef een percentage tussen 0 en ' + PCT_KORTING_MAX + '.' };
    if (pct === 0) delete d().kortingen[genre]; else d().kortingen[genre] = pct;
    save();
    return { status: 200, ok: true, genre, pct };
  }
  // het voordeel op een bedrag (euro's) bij deze zaak; 0 als er geen regel staat
  function ledenvoordeelVoor(s, bedrag) {
    if (!s || !Number.isFinite(bedrag) || bedrag <= 0) return 0;
    const pct = d().kortingen[s.type];
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    return rond(bedrag * pct / 100);
  }

  /* ---- de betaaldienst: transactiekosten, DIRECT bij de ondernemer ----
     Geen verzamelfactuur achteraf: elke kassabetaling via RTG Pay verrekent
     de kosten van de betaaldienst meteen op de rekening van de zaak, als
     eigen grootboekregel naast de ontvangst. RTG stelt het tarief (vaste
     voet + percentage) vanuit de boardroom; het lid merkt er niets van. */
  function betaaldienst() {
    const t = d().betaaldienst || {};
    return { vastCenten: Number.isFinite(t.vastCenten) ? t.vastCenten : 10,
      pct: Number.isFinite(t.pct) ? t.pct : 1 };
  }
  function betaaldienstZet(data) {
    const vast = Math.round(Number(data.vastCenten));
    const pct = Number(data.pct);
    if (!Number.isFinite(vast) || vast < 0 || vast > 1000) return { status: 400, error: 'De vaste voet is 0 tot 1000 centen.' };
    if (!Number.isFinite(pct) || pct < 0 || pct > 5) return { status: 400, error: 'Het percentage is 0 tot 5.' };
    d().betaaldienst = { vastCenten: vast, pct: Math.round(pct * 100) / 100 };
    save();
    return { status: 200, ok: true, ...d().betaaldienst };
  }
  // de kosten voor een kassabetaling van dit aantal centen (nooit meer dan het bedrag)
  function betaaldienstKosten(centen) {
    const c = Math.round(Number(centen) || 0);
    if (c <= 0) return 0;
    const t = betaaldienst();
    return Math.min(c, t.vastCenten + Math.round(c * t.pct / 100));
  }

  /* ---- de AI-inkoopkosten: de basis onder de bundelprijzen ----
     Wat capaciteit RTG werkelijk kost, per 1000 credits. Alleen de boardroom
     weet dat, want alleen daar is bekend wat er wordt betaald. Staat er niets,
     dan is er GEEN bundelprijs -- en dat is een antwoord, geen fout
     (kern/commercie/bundelprijs.js). */
  function aiInkoop() {
    const t = d().aiInkoop || {};
    return { inkoopCentenPer1000: Number.isFinite(t.inkoopCentenPer1000) ? t.inkoopCentenPer1000 : null };
  }
  function aiInkoopZet(data) {
    const c = Math.round(Number((data || {}).centenPer1000));
    if (!Number.isFinite(c) || c < 0 || c > 100000)
      return { status: 400, error: 'Geef de inkoopkosten in centen per 1000 credits (0 tot 100.000).' };
    d().aiInkoop = { inkoopCentenPer1000: c };
    save();
    return { status: 200, ok: true, ...aiInkoop() };
  }

  /* ---- het boardroom-overzicht: alles op een bord ---- */
  function overzicht() {
    const g = d();
    return { status: 200,
      pasprijzen: pasprijzen().passen,
      kortingen: g.kortingen,
      betaaldienst: betaaldienst(),
      aiInkoop: aiInkoop(),
      aiBundels: require('./commercie/bundelprijs').lijst(aiInkoop()),
      /* Geen commissietabel meer: er valt niets te zetten. Wat er wel is, zijn
         de benoemde vergoedingssoorten -- de boardroom hoort te kunnen lezen
         wat RTG een partner in rekening brengt en waarvoor. */
      partnervergoeding: { overOmzet: vergoeding.PARTNER_COMMISSIE, uitleg: vergoeding.waaromGeenCommissie() },
      vergoedingssoorten: vergoeding.soorten(),
      genres: Object.entries(db.data.supplierTypes).map(([id, t]) => ({ id, label: t.label, icon: t.icon })),
      zaken: db.data.suppliers.map(s => ({ code: s.code, naam: s.name, genre: s.type, rate: commissieVoor(s) })) };
  }

  return { geldPasprijzen: pasprijzen, geldPasprijsZet: pasprijsZet, geldCommissieZet: commissieZet,
    geldKortingZet: kortingZet, geldOverzicht: overzicht, ledenvoordeelVoor, commissieVoor,
    geldBetaaldienst: betaaldienst, geldBetaaldienstZet: betaaldienstZet, betaaldienstKosten,
    geldAiInkoop: aiInkoop, geldAiInkoopZet: aiInkoopZet };
}

module.exports = { maakGeldregie };
