/* Kern-module "geldregie": RTG bepaalt de geldkant van het platform, vanuit
   de boardroom en binnen het model van de voorwaarden.

   - PASPRIJZEN: de maandbijdragen van de passen, volgens de ladder in
     kern/pasladder.js. De gratis app is en blijft gratis (vast 0); RTG stelt de
     RTG Pass en Business Lite in, maar nooit onder de bodem van hun trede; de
     Business Pass en de Lifestyle Pass zijn contractueel en dragen alleen een
     "vanaf". De bedragen zijn ex btw en 30% gaat naar de RTFoundation; het
     publieke endpoint voedt o.a. de voorwaardenpagina, dus wat de boardroom zet
     is meteen overal het geldende bedrag.
   - COMMISSIES: de interne partnervergoeding (s.rate). Leden reizen op
     nettoprijzen (voorwaarden), dus dit raakt het lid nooit; het is de
     afspraak tussen RTG en de zaak. Standaard per genre, met per zaak een
     eigen afspraak die voorgaat.
   - KORTINGEN: het RTG-ledenvoordeel per genre. RTG legt bij (zelfde patroon
     als het punten-tegoed): het lid betaalt minder, de zaak houdt het volle
     bedrag; zo blijft de nettoprijzen-belofte intact.

   maakGeldregie(state) volgt het vaste kern-patroon. */

const ladder = require('./pasladder');

const PCT_COMMISSIE_MAX = 30;   // partnervergoeding, in procenten
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

  /* ---- commissies: standaard per genre, per zaak een eigen afspraak ---- */
  function commissieVoor(s) {
    if (!s) return null;
    const g = d();
    if (Number.isFinite(g.commissies.perZaak[s.code])) return g.commissies.perZaak[s.code];
    if (Number.isFinite(g.commissies.standaard[s.type])) return g.commissies.standaard[s.type];
    return Number.isFinite(s.rate) ? s.rate : 0.12;
  }
  function commissieZet(data) {
    const pct = Number(data.pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > PCT_COMMISSIE_MAX)
      return { status: 400, error: 'Geef een percentage tussen 0 en ' + PCT_COMMISSIE_MAX + '.' };
    const rate = Math.round(pct * 100) / 10000;
    const g = d();
    if (data.code) {
      const s = db.data.suppliers.find(x => x.code === String(data.code).toUpperCase());
      if (!s) return { status: 404, error: 'Deze zaak bestaat niet.' };
      g.commissies.perZaak[s.code] = rate;
      s.rate = rate;
      save();
      return { status: 200, ok: true, code: s.code, rate };
    }
    const genre = String(data.genre || '');
    if (!db.data.supplierTypes[genre]) return { status: 404, error: 'Dit genre bestaat niet.' };
    g.commissies.standaard[genre] = rate;
    // de standaard geldt meteen voor elke zaak van het genre zonder eigen afspraak
    for (const s of db.data.suppliers)
      if (s.type === genre && !Number.isFinite(g.commissies.perZaak[s.code])) s.rate = rate;
    save();
    return { status: 200, ok: true, genre, rate };
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

  /* ---- het boardroom-overzicht: alles op een bord ---- */
  function overzicht() {
    const g = d();
    return { status: 200,
      pasprijzen: pasprijzen().passen,
      kortingen: g.kortingen,
      betaaldienst: betaaldienst(),
      commissies: { standaard: g.commissies.standaard, perZaak: g.commissies.perZaak },
      genres: Object.entries(db.data.supplierTypes).map(([id, t]) => ({ id, label: t.label, icon: t.icon })),
      zaken: db.data.suppliers.map(s => ({ code: s.code, naam: s.name, genre: s.type, rate: commissieVoor(s) })) };
  }

  return { geldPasprijzen: pasprijzen, geldPasprijsZet: pasprijsZet, geldCommissieZet: commissieZet,
    geldKortingZet: kortingZet, geldOverzicht: overzicht, ledenvoordeelVoor, commissieVoor,
    geldBetaaldienst: betaaldienst, geldBetaaldienstZet: betaaldienstZet, betaaldienstKosten };
}

module.exports = { maakGeldregie };
