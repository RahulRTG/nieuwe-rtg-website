/* Kern-module "rendezvous": Rendez-vous -- de besloten AI-datingapp van de
   Lifestyle Pass. Leden zetten een discreet profiel op met hun wensen en de
   locaties waar zij openstaan voor een jetset-date. Twee leden die elkaar leuk
   vinden (wederzijdse like) hebben een match; Rahul stelt dan een date voor op een
   locatie die beiden hebben aangegeven of voor openstaan. De pool bestaat alleen
   uit Lifestyle- en Business-leden -- exclusief en op codenaam (privacy by design:
   echte namen blijven in de kluis). Rahul BELOOFT nooit een reservering; hij stelt
   voor en De Rechterhand regelt het pas als het rond is. Gedeelde context vanuit
   server.js.

   DE POORT. Rendez-vous eist hetzelfde als Vonk: een echt account, een door RTG
   geverifieerd paspoort en 18 of ouder (kern/ontmoetpoort.js). Dat stond hier
   lang NIET -- er was alleen een pas-eis op de route, waardoor de exclusieve app
   losser was dan de brede. De pas-eis (Lifestyle of Business) blijft op de route
   waar hij hoort; de leeftijd en de identiteit horen hier, want de kern is wat
   elke ingang passeert. */
module.exports = ({ db, save, crypto, liveCodename, anthropic, notify, accounts, leeftijdVan, tableZet, handleVanPin }) => {
  const nu = () => new Date().toISOString();
  const { ontmoetPoort } = require('./ontmoetpoort').maakOntmoetpoort({ accounts, leeftijdVan });
  const mag = key => ontmoetPoort(key, 'Rendez-vous');
  /* De Presence Graph. Zuivere functies over wat een lid zelf intikte; dit
     bestand geeft er GEEN reisbron aan mee, en dat is de grens zelf en niet een
     controle erop -- zie de kop van ./rendezvous-aanwezig.js. */
  const AW = require('./rendezvous-aanwezig');
  /* Private Availability: dezelfde code als Vonks Blind Availability
     (./beschikbaar.js). Een ritme in dagdelen; alleen de doorsnede komt eruit,
     en pas bij een wederzijdse match. */
  const B = require('./beschikbaar');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const lijstUit = (v, max, elk) => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => schoon(x, elk || 40)).filter(Boolean).slice(0, max || 12);

  function R() {
    if (!db.data.rendezvous || typeof db.data.rendezvous !== 'object') db.data.rendezvous = { profielen: {}, likes: {}, passes: {} };
    const r = db.data.rendezvous;
    for (const v of ['profielen', 'likes', 'passes']) if (!r[v] || typeof r[v] !== 'object') r[v] = {};
    return r;
  }
  const codenaam = key => (liveCodename ? liveCodename(key) : '') || 'Een lid';
  // overlap van twee locatielijsten, hoofdletterongevoelig, met de oorspronkelijke schrijfwijze
  function gedeeld(a, b) {
    const bl = (b || []).map(x => x.toLowerCase());
    return (a || []).filter(x => bl.includes(x.toLowerCase()));
  }

  function rvProfielGet(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const p = r.profielen[key] || { aan: false, over: '', zoekt: '', wensen: [], locaties: [] };
    /* Alles wat we van u weten staat hier, ook de aanwezigheid: ONTMOETEN.md
       par. 2.1 eist dat een lid het kan zien en kan wissen. */
    return { status: 200, codenaam: codenaam(key), rooster: B.rooster(),
      profiel: { aan: !!p.aan, over: p.over || '', zoekt: p.zoekt || '', wensen: p.wensen || [],
        locaties: p.locaties || [], thuis: p.thuis || '', aanwezig: AW.schoonAanwezig(p.aanwezig, schoon),
        beschikbaar: B.schoonBeschikbaar(p.beschikbaar) } };
  }
  function rvProfiel(key, b) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const p = r.profielen[key] || { at: nu() };
    if (b.aan !== undefined) p.aan = b.aan === true;
    if (b.over !== undefined) p.over = schoon(b.over, 600);
    if (b.zoekt !== undefined) p.zoekt = schoon(b.zoekt, 300);
    if (b.wensen !== undefined) p.wensen = lijstUit(b.wensen, 12, 40);
    if (b.locaties !== undefined) p.locaties = lijstUit(b.locaties, 12, 40);
    if (b.thuis !== undefined) p.thuis = schoon(b.thuis, 40);
    // de lijst wordt VERVANGEN, niet aangevuld; zie de kop van ./rendezvous-aanwezig.js
    if (b.aanwezig !== undefined) p.aanwezig = AW.schoonAanwezig(b.aanwezig, schoon);
    if (b.beschikbaar !== undefined) p.beschikbaar = B.schoonBeschikbaar(b.beschikbaar);
    p.bij = nu();
    r.profielen[key] = p; save();
    return { status: 200, ok: true };
  }

  // wie mag ik zien: andere leden met een actief profiel, niet ikzelf, niet weggeveegd
  function matchesVan(key) {
    const r = R();
    const mijn = r.likes[key] || {};
    const mij = r.profielen[key] || { locaties: [] };
    const uit = [];
    for (const t of Object.keys(mijn)) {
      if (r.likes[t] && r.likes[t][key] && r.profielen[t]) {
        const g = gedeeld(mij.locaties, r.profielen[t].locaties);
        const samen = AW.overlapTussen(mij, r.profielen[t]);
        // waar u tegelijk bent gaat voor op waar u allebei weleens komt
        uit.push({ id: t, codenaam: codenaam(t), gedeeldeLocaties: g, samen,
          // pas hier, na de wederzijdse like: een dagdeel of niets
          wanneer: B.zin(mij.beschikbaar, r.profielen[t].beschikbaar),
          voorstel: (samen[0] && samen[0].stad) || g[0] || null, sinds: mijn[t] });
      }
    }
    uit.sort((a, b) => String(b.sinds).localeCompare(String(a.sinds)));
    return uit;
  }
  function rvMatches(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    return { status: 200, matches: matchesVan(key) };
  }
  /* Alles weghalen wat u over uw aanwezigheid heeft opgegeven, in een handeling.
     ONTMOETEN.md par. 2.1 eist dat een lid ziet wat er van hem bekend is en het
     kan wissen; "zet elk venster los terug op leeg" is dat niet. Dit raakt
     alleen de aanwezigheid -- uw profiel, uw matches en uw gesprekken blijven. */
  function rvAanwezigWis(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const p = r.profielen[key];
    if (p) { p.aanwezig = []; p.thuis = ''; p.bij = nu(); save(); }
    return { status: 200, ok: true, aanwezig: [], thuis: '' };
  }

  // Together: twee eenzijdige verklaringen, "samen" is de projectie erover
  const samen = require('./rendezvous-samen')({ R, mag, codenaam, nu, save });
  const ontdek = require('./rendezvous-ontdek')({ R, AW, B, mag, codenaam, gedeeld, save, notify, nu,
    partnerVan: samen.rvPartnerVan });
  // The Table, Moment en Encounter (een tweezijdige ja, twee momenten)
  const kring = require('./rendezvous-kring')({ R, mag, codenaam, schoon, nu, save, crypto, notify, handleVanPin });
  const { rvDate } = require('./rendezvous-date')({ R, AW, B, mag, codenaam, schoon, matchesVan, anthropic });
  // Arrange It: Rahul stelt samen, beiden keuren goed, De Rechterhand regelt
  const arrange = require('./rendezvous-arrange')({ R, AW, B, mag, codenaam, schoon, nu, save,
    matchesVan, tableZet, notify });
  return { rvProfielGet, rvProfiel, ...ontdek, ...kring, rvMatches, rvDate, rvAanwezigWis,
    rvArrange: arrange.rvArrange, rvAkkoord: arrange.rvAkkoord,
    rvSamen: samen.rvSamen, rvSamenZet: samen.rvSamenZet };
};
