/* Supplier-AI, deel "ambtenaar" (routes/supplier/ai): de rijks- en gemeentebalie
   die zaken via Rahul afhandelt. "ken RTG-TS-… toe", "wijs RTG-SB-… af", "verleen
   RTG-G-…", "zet RTG-M-… op opgelost", en een concrete briefing met referenties
   zodat de ambtenaar meteen kan door-acteren. Verbatim afgesplitst uit de grote
   /api/supplier/ai-handler; geeft { reply, did } terug of null als deze laag de
   vraag niet pakt (dan gaat de hoofd-handler verder met acties en vragen).
   Mutaties worden hier alleen als exact API-voorstel beschreven; index.js laat
   ze door dezelfde eenmalige menselijke goedkeuring lopen als modeltools.

   DE MACHINE KIEST NOOIT WIE HET WORDT (TAKEN.md 4.56).

   Hier stond een tak die zonder referentie "het eerste open item" pakte:
   *wijs de volgende toeslag af* koos `arr[0]` uit de lijst, en de mens
   bevestigde een al ingevulde beslissing met een tik. Uitvoeren deed deze laag
   niet -- dat doet ./stuur.js pas na een aparte bevestiging -- maar dat was het
   bezwaar ook niet. Het bezwaar is de VORM: bij een besluit over de aanvraag
   van een mens hoort een mens te kiezen OVER WIE het gaat.

   `kern/stadsweefsel/ainiveau.js` zei dat al: 'een vergunning of aanvraag
   afwijzen' staat daar op niveau 4, "nooit zonder een expliciete menselijke
   beslissing", en `magAutomatisch()` heet in zijn eigen commentaar "de enige
   plek die daar antwoord op geeft". Die functie werd op deze weg NOOIT
   aangeroepen -- de lijst was hier decoratie. Nu wel, en zijn reden staat in
   het antwoord in plaats van dat hij hier wordt overgeschreven.

   DE GRENS LOOPT OM DE AANVRAAG EN NIET OM HET WOORD "AFWIJZEN". Ook
   *ken de volgende toeslag toe* koos de ontvanger, en dat is dezelfde
   handeling met een andere uitkomst. Een MELDING blijft wel werken: dat is een
   waarneming over een ding (een lantaarnpaal, wateroverlast) en geen besluit
   over de aanvraag van een mens. Die afbakening staat hier omdat ze anders bij
   de eerste de beste uitbreiding stilzwijgend verschuift.

   Met een REFERENTIE (RTG-SB-1234) blijft alles gewoon: dan heeft de ambtenaar
   het dossier zelf aangewezen, en stelt deze laag het exacte voorstel samen dat
   hij daarna nog moet bevestigen. */
const { magAutomatisch } = require('../../../kern/stadsweefsel/ainiveau');

/* De handeling zoals ainiveau.js hem kent. Als tekenreeks overgeschreven zou hij
   een hernoeming daar overleven zonder een spoor -- vandaar dat het antwoord uit
   magAutomatisch() komt en niet uit een zin hier. */
const AANVRAAG_BESLUIT = 'vergunning-weigeren';

module.exports = (kern) => function ambtenaar(s, q, req) {
  const O = kern.overheid, G = kern.gemeente;
  const rijkAmbt = O && O.magBehandelen && O.magBehandelen(s);
  const gemAmbt = G && G.magBehandelen && G.magBehandelen(s);
  if (!(rijkAmbt || gemAmbt)) return null;
  const R = (reply, did) => ({ reply, did: !!did });
  const V = (reply, pad, body) => ({ reply, did: false, actie: { pad, body } });
  /* Wijst dit voorstel een aanvraag AF, dan reist de reden van ainiveau.js mee.
     De mens die bevestigt hoort te lezen waarom dit zijn beslissing is en niet
     die van de machine -- een tik op een ingevuld formulier is geen besluit. */
  const A4 = (reply, af2) => af2 ? reply + ' Dit is een afwijzing (' +
    magAutomatisch(AANVRAAG_BESLUIT).reden + '). Lees het dossier voor u bevestigt.' : reply;
  // let op: Nederlandse scheidbare werkwoorden ("ken … toe", "wijs … af")
  const goed = /(ken\b.*?\btoe|toeken|toekennen|keur\s+goed|goedkeur|verleen|honoreer|gegrond|toewijs|toewijzen|akkoord)/i.test(q);
  const af = /(wijs\b.*?\baf|afwijz|weiger|afkeur|ongegrond|afgewezen|afgekeurd)/i.test(q);
  const opgelost = /\b(opgelost|afgehandeld|gereed|klaar)\b/i.test(q);
  const mref = q.match(/RTG-([A-Za-z]{1,3})-[0-9A-Fa-f]{4,8}/);
  if (mref) {
    const refc = mref[0].toUpperCase(), t = mref[1].toUpperCase();
    if (rijkAmbt && t === 'TS') return V(A4('De toeslag ' + refc + ' wordt bijgewerkt.', af && !goed), '/api/overheid/toeslag/beslis', { ref: refc, besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' });
    if (rijkAmbt && t === 'SZ') return V(A4('De uitkering ' + refc + ' wordt bijgewerkt.', af && !goed), '/api/overheid/uitkering/beslis', { ref: refc, besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' });
    if (rijkAmbt && t === 'SB') return V(A4('De subsidie ' + refc + ' wordt bijgewerkt.', af && !goed), '/api/overheid/subsidie/beslis', { ref: refc, besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' });
    if (rijkAmbt && t === 'BZ') return V(A4('Het bezwaar ' + refc + ' wordt bijgewerkt.', af && !goed), '/api/overheid/bezwaar/beslis', { ref: refc, besluit: goed ? 'gegrond' : af ? 'ongegrond' : 'in behandeling' });
    if (rijkAmbt && t === 'WM') return V('De watermelding ' + refc + ' wordt bijgewerkt.', '/api/overheid/water/melding/zet', { ref: refc, status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' });
    if (gemAmbt && t === 'M') return V('De melding ' + refc + ' wordt bijgewerkt.', '/api/gemeente/melding/zet', { ref: refc, status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' });
    if (gemAmbt && t === 'G') return V(A4('De vergunning ' + refc + ' wordt bijgewerkt.', af && !goed), '/api/gemeente/vergunning/beslis', { ref: refc, besluit: goed ? 'verleend' : af ? 'geweigerd' : 'in behandeling' });
  } else if ((goed || af || opgelost) && /\b(eerste|eerstvolgende|volgende|deze|die)\b/i.test(q)) {
    /* ZONDER REFERENTIE PAKT DEZE LAAG GEEN DOSSIER MEER (TAKEN.md 4.56).
       Een besluit over de aanvraag van een mens staat op niveau 4; het antwoord
       komt uit ainiveau.js zelf, zodat er hier geen tweede versie van die regel
       ontstaat. */
    const oordeel = magAutomatisch(AANVRAAG_BESLUIT);
    const zelfKiezen = (naam) => R('Ik kies geen ' + naam + ' voor u uit: dit is een besluit over de ' +
      'aanvraag van een mens (' + oordeel.reden + '). Noem de referentie, bijvoorbeeld RTG-SB-1234, ' +
      'dan zet ik het exacte voorstel klaar.', false);
    if (rijkAmbt && /toeslag/i.test(q)) return zelfKiezen('toeslag');
    if (rijkAmbt && /uitkering|\bww\b|bijstand|aow|kinderbijslag/i.test(q)) return zelfKiezen('uitkering');
    if (rijkAmbt && /bezwaar/i.test(q)) return zelfKiezen('bezwaar');
    if (rijkAmbt && /subsidie/i.test(q)) return zelfKiezen('subsidie');
    if (gemAmbt && /vergunning/i.test(q)) return zelfKiezen('vergunning');
    /* Een MELDING is een waarneming over een ding en geen besluit over de
       aanvraag van een mens; die blijft dus werken. Zie de kop voor waarom die
       afbakening hier staat en niet in iemands hoofd. */
    const pak = (arr, pad, body, naam) => !arr[0] ? R('Er staan geen ' + naam + ' open.', false) :
      V(naam.replace(/en$/, '') + ' ' + arr[0].ref + ' wordt bijgewerkt.', pad, { ref: arr[0].ref, ...body });
    if (rijkAmbt && /watermelding|wateroverlast|verontreiniging/i.test(q)) return pak(O.waterMeldingenLijst({}).meldingen, '/api/overheid/water/melding/zet', { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }, 'watermeldingen');
    if (gemAmbt && /melding/i.test(q)) return pak(G.meldingenLijst({}).meldingen, '/api/gemeente/melding/zet', { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }, 'meldingen');
  }
  // stemming openen/sluiten (rijk)
  if (rijkAmbt && /\bstemming|referendum\b/i.test(q) && /\b(sluit|dicht|stop)\b/i.test(q)) return V('De stemming wordt gesloten.', '/api/overheid/verkiezing/sluit', { open: false });
  if (rijkAmbt && /\bstemming|referendum\b/i.test(q) && /\b(open|heropen|start)\b/i.test(q)) return V('De stemming wordt heropend.', '/api/overheid/verkiezing/sluit', { open: true });
  // een briefing met referenties (geen actie, maar wel concreet en handig)
  if (/\bbriefing|overzicht|samenvatting|wat (staat|ligt|wacht)|urgent|vat .* samen\b/i.test(q)) {
    if (rijkAmbt) {
      const sec = [
        ['Toeslagen', O.toeslagenLijst({}).toeslagen.map(x => x.ref + ' ' + x.soortLabel)],
        ['Uitkeringen', O.uitkeringenLijst({}).uitkeringen.map(x => x.ref + ' ' + x.soortLabel)],
        ['Bezwaren', O.bezwarenLijst({}).bezwaren.map(x => x.ref + ' tegen ' + x.tegen)],
        ['Subsidies', O.subsidiesLijst({}).subsidies.map(x => x.ref + ' ' + x.regelingLabel)],
        ['Watermeldingen', O.waterMeldingenLijst({}).meldingen.map(x => x.ref + ' ' + x.soortLabel)]
      ];
      const txt = 'Openstaand bij de rijksbalie:\n' + sec.map(([n, a]) => '· ' + n + ' (' + a.length + ')' + (a.length ? ': ' + a.slice(0, 4).join('; ') : '')).join('\n') +
        '\n\nZeg bijv. "ken RTG-TS-… toe" of "wijs RTG-SB-… af".';
      return R(txt, false);
    }
    const meld = G.meldingenLijst({}).meldingen.map(x => x.ref + ' ' + x.categorieLabel);
    const verg = G.vergunningenLijst({}).vergunningen.map(x => x.ref + ' ' + x.soortLabel);
    const txt = 'Openstaand bij de gemeentebalie:\n· Meldingen (' + meld.length + ')' + (meld.length ? ': ' + meld.slice(0, 4).join('; ') : '') +
      '\n· Vergunningen (' + verg.length + ')' + (verg.length ? ': ' + verg.slice(0, 4).join('; ') : '') +
      '\n\nZeg bijv. "zet RTG-M-… op opgelost" of "verleen RTG-G-…".';
    return R(txt, false);
  }
  return null;
};
