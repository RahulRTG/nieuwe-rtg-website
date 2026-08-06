/* RTG Stadsweefsel, deel "besluitvorming": van voorstel naar besluit.

   ./bestuur.js gaat over WIE er mag besluiten (de organen en het mandaat); dit
   gaat over HOE een besluit tot stand komt: indienen, adviseren, stemmen,
   sluiten. Die twee staan los omdat het mandaat bijna nooit verandert en de
   route naar een besluit juist de plek is waar een stad haar eigen gewoontes
   in kwijt wil.

   Twee dingen die hier hard staan. Een ADVIES bindt niemand, maar het staat wel
   naast het besluit in het openbare register -- juist zodat zichtbaar is als er
   tegen een advies in wordt besloten. En de UITSLAG wordt bij het sluiten
   uitgerekend en vastgelegd, niet bij elke weergave opnieuw: een uitslag die
   meebeweegt met de gegevens eronder, is over een jaar een andere uitslag dan
   die avond.

   Krijgt de gedeelde ctx plus de besluithelpers van ./bestuur.js. */
const { schoon } = require('../util');

module.exports = (ctx, H) => {
  const { save, crypto, nu, geo } = ctx;
  const { besluiten, besluit, orgaan, ORGAANSOORT, zorgOrganen, publiek } = H;

  /* Een voorstel indienen. Het draagt waar het over gaat (een project, een doel
     of een gebied), zodat het besluitenregister straks niet uit losse titels
     bestaat maar uit dingen die aan de stad vastzitten. */
  function voorstelIndienen({ orgaan: org, titel, toelichting, bedrag, projectId, doelId, gebied, wie }) {
    zorgOrganen();
    const o = orgaan(org);
    if (!o) return { status: 404, error: 'Onbekend orgaan: ' + Object.keys(ORGAANSOORT).join(', ') + ' (of een wijkraad).' };
    if (!ORGAANSOORT[o.soort].besluit)
      return { status: 400, error: (ORGAANSOORT[o.soort] || {}).label + ' neemt geen besluiten; dit orgaan ' + ORGAANSOORT[o.soort].uitleg + '.' };
    const t = schoon(titel, 120);
    if (!t) return { status: 400, error: 'Waar gaat het voorstel over?' };
    const g = gebied ? geo.gebied(gebied) : null;
    if (gebied && !g) return { status: 404, error: 'Onbekend gebied.' };
    const b = {
      id: 'B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      ref: 'B-' + new Date(nu()).getFullYear() + '-' + String(besluiten().length + 1).padStart(4, '0'),
      orgaan: o.id, orgaanNaam: o.naam, titel: t, toelichting: schoon(toelichting, 600) || null,
      bedrag: Number(bedrag) > 0 ? Math.round(Number(bedrag)) : null,
      projectId: schoon(projectId, 20) || null, doelId: schoon(doelId, 20) || null,
      gebied: g ? g.id : null, gebiedNaam: g ? g.naam : null,
      status: 'ingediend', stemmen: [], adviezen: [], uitslag: null,
      door: schoon(wie, 60) || 'kantoor', at: nu(), besletenAt: null
    };
    besluiten().unshift(b);
    if (besluiten().length > 5000) besluiten().length = 5000;
    save();
    return { ok: true, besluit: publiek(b) };
  }

  /* Een wijkraad ADVISEERT. Dat advies bindt niemand en dat staat er ook bij --
     maar het staat wel in het openbare register naast het besluit, en dat is
     precies waarvoor een wijkraad bestaat: het moet zichtbaar zijn als er tegen
     een advies in wordt besloten. */
  function adviesGeven({ besluitId, orgaan: org, standpunt, toelichting, wie }) {
    const b = besluit(besluitId);
    if (!b) return { status: 404, error: 'Onbekend besluit.' };
    if (b.status !== 'ingediend') return { status: 400, error: 'Dit besluit is al genomen; advies kan alleen daarvoor.' };
    const o = orgaan(org);
    if (!o) return { status: 404, error: 'Onbekend orgaan.' };
    if (ORGAANSOORT[o.soort].besluit) return { status: 400, error: 'Een besluitvormend orgaan stemt; adviseren doen de wijkraden, de rekenkamer en de ethische commissie.' };
    if (!['voor', 'tegen', 'aandacht'].includes(standpunt)) return { status: 400, error: 'Kies een standpunt: voor, tegen of aandacht.' };
    b.adviezen = b.adviezen.filter(a => a.orgaan !== o.id);
    b.adviezen.push({ orgaan: o.id, orgaanNaam: o.naam, standpunt, toelichting: schoon(toelichting, 400) || null,
      door: schoon(wie, 60) || 'kantoor', at: nu() });
    save();
    return { ok: true, besluit: publiek(b) };
  }

  /* Stemmen, per fractie. Een fractie stemt met haar zetels; wie niet stemt,
     stemt niet mee (er is geen stilzwijgende instemming). */
  function stem({ besluitId, fractie, voor, wie }) {
    const b = besluit(besluitId);
    if (!b) return { status: 404, error: 'Onbekend besluit.' };
    if (b.status !== 'ingediend') return { status: 400, error: 'Er is al besloten.' };
    const o = orgaan(b.orgaan);
    const naam = schoon(fractie, 60);
    if (o.soort === 'raad') {
      const f = (o.fracties || []).find(x => x.naam.toLowerCase() === naam.toLowerCase());
      if (!f) return { status: 400, error: 'Onbekende fractie. Kies: ' + (o.fracties || []).map(x => x.naam).join(', ') + '.' };
      b.stemmen = b.stemmen.filter(s => s.naam !== f.naam);
      b.stemmen.push({ naam: f.naam, zetels: f.zetels, voor: voor === true, door: schoon(wie, 60) || 'kantoor', at: nu() });
    } else {
      // het college stemt met koppen, niet met zetels
      if (!naam) return { status: 400, error: 'Wie stemt er?' };
      b.stemmen = b.stemmen.filter(s => s.naam !== naam);
      b.stemmen.push({ naam, zetels: 1, voor: voor === true, door: schoon(wie, 60) || 'kantoor', at: nu() });
    }
    save();
    return { ok: true, besluit: publiek(b) };
  }

  /* Sluiten: de uitslag wordt HIER uitgerekend en vastgelegd, en daarna niet
     meer opnieuw bepaald. Een uitslag die je bij elke weergave opnieuw
     uitrekent, verandert mee met de gegevens eronder -- en dan staat er over
     een jaar iets anders in het register dan wat er die avond is besloten. */
  function sluit({ besluitId, wie }) {
    const b = besluit(besluitId);
    if (!b) return { status: 404, error: 'Onbekend besluit.' };
    if (b.status !== 'ingediend') return { status: 400, error: 'Er is al besloten.' };
    if (!b.stemmen.length) return { status: 400, error: 'Er is niet gestemd.' };
    const o = orgaan(b.orgaan);
    const voor = b.stemmen.filter(s => s.voor).reduce((n, s) => n + s.zetels, 0);
    const tegen = b.stemmen.filter(s => !s.voor).reduce((n, s) => n + s.zetels, 0);
    const totaal = o.soort === 'raad' ? (o.zetels || voor + tegen) : b.stemmen.length;
    b.uitslag = { voor, tegen, uitgebracht: voor + tegen, totaal, meerderheidNodig: Math.floor(totaal / 2) + 1 };
    b.status = voor >= b.uitslag.meerderheidNodig ? 'aangenomen' : 'verworpen';
    b.beslotenAt = nu();
    b.beslotenDoor = schoon(wie, 60) || 'kantoor';
    // ging het tegen een advies in? Dat is het eerste wat een inwoner wil weten
    const tegenAdvies = b.adviezen.filter(a => (a.standpunt === 'tegen' && b.status === 'aangenomen') ||
      (a.standpunt === 'voor' && b.status === 'verworpen'));
    b.tegenAdvies = tegenAdvies.map(a => a.orgaanNaam);
    save();
    return { ok: true, besluit: publiek(b),
      let_op: tegenAdvies.length ? 'Dit besluit gaat in tegen het advies van ' + b.tegenAdvies.join(' en ') + '. Dat staat zo in het openbare register.' : null };
  }

  return { voorstelIndienen, adviesGeven, stem, sluit };
};
