/* RTG Stadsweefsel, deel "inspraak": de inwoner en de controleur.

   Twee dingen die allebei NA het besluit komen kijken, en die allebei de neiging
   hebben te verdwijnen zodra een platform efficiënt wordt:

   1. CONSULTATIE -- de stad vraagt bewoners iets, per gebied. Wie in de zone
      woont waar het over gaat, telt apart mee; de rest ook, maar zichtbaar
      anders. Dat onderscheid is het hele punt: een raadpleging over een plein
      waarin de stem van iemand aan de andere kant van de stad even zwaar telt
      als die van de buurman, meet iets anders dan ze belooft.
   2. En wat daarna komt -- nagaan of het heeft opgeleverd wat het beloofde --
      staat in ./rekenkamer.js.

   PRIVACY. Een reactie hangt aan een codenaam, één per bewoner per raadpleging,
   en de vrije tekst gaat niet de AI-dataset in. Er wordt geteld hoeveel mensen
   iets vinden en uit welke zone ze komen -- nooit wie wat vond. De zone komt
   uit wat het lid zelf kiest; er wordt geen woonadres opgezocht, want dit
   systeem hoort niet te weten waar iemand woont.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

const DAG = 86400000;

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo } = ctx;

  const raadplegingen = () => { if (!Array.isArray(d().weefselRaadpleging)) d().weefselRaadpleging = []; return d().weefselRaadpleging; };
  const raadpleging = (id) => raadplegingen().find(r => r.id === String(id || '')) || null;
  const loopt = (r) => r.open && r.tot > nu();

  function raadplegingMaak({ vraag, toelichting, gebied, dagen, opties, besluitId, wie }) {
    const v = schoon(vraag, 160);
    if (!v) return { status: 400, error: 'Wat wil de stad vragen?' };
    const g = gebied ? geo.gebied(gebied) : null;
    if (gebied && !g) return { status: 404, error: 'Onbekend gebied.' };
    const keuzes = (Array.isArray(opties) ? opties : []).map(o => schoon(o, 40)).filter(Boolean).slice(0, 6);
    if (keuzes.length < 2) return { status: 400, error: 'Geef minstens twee antwoordmogelijkheden.' };
    const n = Number(dagen) > 0 ? Math.min(Math.round(Number(dagen)), 120) : 21;
    const r = {
      id: 'R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      vraag: v, toelichting: schoon(toelichting, 500) || null,
      gebied: g ? g.id : null, gebiedNaam: g ? g.naam : 'de hele stad',
      opties: keuzes, besluitId: schoon(besluitId, 20) || null,
      reacties: [], open: true, at: nu(), tot: nu() + n * DAG, door: schoon(wie, 60) || 'kantoor'
    };
    raadplegingen().unshift(r);
    if (raadplegingen().length > 500) raadplegingen().length = 500;
    save();
    return { ok: true, raadpleging: publiek(r) };
  }

  /* Reageren. Eén per codenaam: wie zich bedenkt, verandert zijn eigen reactie
     in plaats van er een tweede bij te zetten. De zone die het lid opgeeft
     bepaalt of hij "uit het gebied" telt; klopt die niet, dan is dat een
     onnauwkeurigheid die we accepteren -- de andere kant (het woonadres
     opzoeken) is een privacyprijs die deze vraag niet waard is. */
  function reageer({ raadplegingId, codenaam, keuze, tekst, zone }) {
    const r = raadpleging(raadplegingId);
    if (!r) return { status: 404, error: 'Onbekende raadpleging.' };
    if (!loopt(r)) return { status: 400, error: 'Deze raadpleging is gesloten.' };
    const cn = String(codenaam || '').trim();
    if (!cn) return { status: 401, error: 'Log opnieuw in.' };
    const k = schoon(keuze, 40);
    if (!r.opties.includes(k)) return { status: 400, error: 'Kies een van de antwoorden: ' + r.opties.join(', ') + '.' };
    const z = zone ? (geo.gebied(zone) || geo.opNaam(zone, 'zone')) : null;
    const eerder = r.reacties.find(x => x.codenaam === cn);
    const rec = eerder || { codenaam: cn, at: nu() };
    rec.keuze = k;
    rec.tekst = schoon(tekst, 300) || null;
    rec.zone = z ? z.id : null;
    rec.gewijzigdAt = eerder ? nu() : null;
    // woont hij in het gebied waar het over gaat?
    rec.uitGebied = !r.gebied || (z ? (z.id === r.gebied || geo.binnen(r.gebied, z.id)) : false);
    if (!eerder) r.reacties.push(rec);
    save();
    return { ok: true, jouwReactie: { keuze: rec.keuze, uitGebied: rec.uitGebied, gewijzigd: !!eerder } };
  }

  /* De uitslag. Twee tellingen naast elkaar: iedereen, en alleen wie in het
     gebied woont. Ze staan er allebei omdat ze allebei iets betekenen en omdat
     het verschil ertussen zelf informatie is. */
  function uitslag(r) {
    const per = {}, perGebied = {};
    for (const o of r.opties) { per[o] = 0; perGebied[o] = 0; }
    for (const x of r.reacties) { per[x.keuze]++; if (x.uitGebied) perGebied[x.keuze]++; }
    const inGebied = r.reacties.filter(x => x.uitGebied).length;
    return { reacties: r.reacties.length, uitHetGebied: inGebied, allen: per, alleenGebied: perGebied,
      let_op: r.gebied && !inGebied ? 'Niemand die reageerde gaf ' + r.gebiedNaam + ' als zijn zone op; de gebiedstelling staat daarom op nul.' : null };
  }

  function publiek(r, codenaam) {
    const eigen = codenaam ? r.reacties.find(x => x.codenaam === codenaam) : null;
    return { id: r.id, vraag: r.vraag, toelichting: r.toelichting, gebied: r.gebied, gebiedNaam: r.gebiedNaam,
      opties: r.opties, besluitId: r.besluitId, open: loopt(r), at: r.at, tot: r.tot,
      uitslag: uitslag(r),
      jouwReactie: eigen ? { keuze: eigen.keuze, uitGebied: eigen.uitGebied } : null };
  }

  function sluit({ raadplegingId, wie }) {
    const r = raadpleging(raadplegingId);
    if (!r) return { status: 404, error: 'Onbekende raadpleging.' };
    if (!r.open) return { status: 400, error: 'Die is al gesloten.' };
    r.open = false; r.geslotenDoor = schoon(wie, 60) || 'kantoor'; r.geslotenAt = nu();
    save();
    return { ok: true, raadpleging: publiek(r) };
  }

  /* Het rekenkameronderzoek staat in ./rekenkamer.js: dat kijkt achteraf en
     voegt geen gegeven toe, dit vraagt vooraf en verzamelt er juist een. */
  const { onderzoek, jaarbeeld } = require('./rekenkamer')(ctx);

  return {
    raadplegingen, raadpleging, uitslag, publiek, loopt,
    api: {
      weefselRaadplegingen: ({ codenaam, alleenOpen } = {}) => {
        const rij = raadplegingen().filter(r => !alleenOpen || loopt(r));
        return { status: 200, aantal: rij.length, raadplegingen: rij.slice(0, 50).map(r => publiek(r, codenaam)) };
      },
      weefselRaadplegingMaak: raadplegingMaak,
      weefselRaadplegingSluit: sluit,
      weefselReageer: reageer,
      weefselOnderzoek: onderzoek,
      weefselJaarbeeld: jaarbeeld
    }
  };
};
