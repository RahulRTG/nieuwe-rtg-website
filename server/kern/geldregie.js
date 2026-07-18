/* Kern-module "geldregie": RTG bepaalt de geldkant van het platform, vanuit
   de boardroom en binnen het model van de voorwaarden.

   - PASPRIJZEN: de maandbijdragen van de passen. De gratis app is en blijft
     gratis (vast 0), de Business Pass is prijs op maat; RTG stelt de RTG Pass
     en de Lifestyle Pass in. De bedragen zijn ex btw en 30% gaat naar de
     RTFoundation; het publieke endpoint voedt o.a. de voorwaardenpagina, dus
     wat de boardroom zet is meteen overal het geldende bedrag.
   - COMMISSIES: de interne partnervergoeding (s.rate). Leden reizen op
     nettoprijzen (voorwaarden), dus dit raakt het lid nooit; het is de
     afspraak tussen RTG en de zaak. Standaard per genre, met per zaak een
     eigen afspraak die voorgaat.
   - KORTINGEN: het RTG-ledenvoordeel per genre. RTG legt bij (zelfde patroon
     als het punten-tegoed): het lid betaalt minder, de zaak houdt het volle
     bedrag; zo blijft de nettoprijzen-belofte intact.

   maakGeldregie(state) volgt het vaste kern-patroon. */

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

  /* ---- pasprijzen: gratis vast, business op maat, de rest stelt RTG in ---- */
  function pasprijzen() {
    const g = d();
    const rtg = Number.isFinite(g.pasprijzen.rtg) ? g.pasprijzen.rtg : 6500;
    const lifestyle = Number.isFinite(g.pasprijzen.lifestyle) ? g.pasprijzen.lifestyle : 2000000;
    const rij = pas => ({ maandCenten: pas, exBtw: true, rtfCenten: Math.round(pas * 0.30) });
    return { status: 200,
      passen: {
        gratis: { naam: 'Gratis app', maandCenten: 0, vast: true },
        rtg: { naam: 'RTG Pass', ...rij(rtg) },
        lifestyle: { naam: 'Lifestyle Pass', ...rij(lifestyle) },
        business: { naam: 'Business Pass', opMaat: true, rtfDeel: 0.30 }
      } };
  }
  function pasprijsZet(data) {
    const pas = String(data.pas || '');
    if (pas === 'gratis') return { status: 400, error: 'De gratis app blijft gratis; dat bedrag staat vast.' };
    if (pas === 'business') return { status: 400, error: 'De Business Pass is prijs op maat; dat spreekt u per klant af.' };
    if (pas !== 'rtg' && pas !== 'lifestyle') return { status: 400, error: 'Kies de RTG Pass of de Lifestyle Pass.' };
    const centen = Math.round(Number(data.euro) * 100);
    if (!Number.isFinite(centen) || centen < 0 || centen > PAS_MAX_CENTEN)
      return { status: 400, error: 'Geef een bedrag tussen 0 en 100.000 euro per maand.' };
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

  /* ---- het boardroom-overzicht: alles op een bord ---- */
  function overzicht() {
    const g = d();
    return { status: 200,
      pasprijzen: pasprijzen().passen,
      kortingen: g.kortingen,
      commissies: { standaard: g.commissies.standaard, perZaak: g.commissies.perZaak },
      genres: Object.entries(db.data.supplierTypes).map(([id, t]) => ({ id, label: t.label, icon: t.icon })),
      zaken: db.data.suppliers.map(s => ({ code: s.code, naam: s.name, genre: s.type, rate: commissieVoor(s) })) };
  }

  return { geldPasprijzen: pasprijzen, geldPasprijsZet: pasprijsZet, geldCommissieZet: commissieZet,
    geldKortingZet: kortingZet, geldOverzicht: overzicht, ledenvoordeelVoor, commissieVoor };
}

module.exports = { maakGeldregie };
