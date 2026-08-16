/* Supplier-AI, deel "ambtenaar" (routes/supplier/ai): de rijks- en gemeentebalie
   die zaken via Rahul afhandelt. "ken RTG-TS-… toe", "wijs RTG-SB-… af", "verleen
   RTG-G-…", "zet RTG-M-… op opgelost", en een concrete briefing met referenties
   zodat de ambtenaar meteen kan door-acteren. Verbatim afgesplitst uit de grote
   /api/supplier/ai-handler; geeft { reply, did } terug of null als deze laag de
   vraag niet pakt (dan gaat de hoofd-handler verder met acties en vragen).
   Mutaties worden hier alleen als exact API-voorstel beschreven; index.js laat
   ze door dezelfde eenmalige menselijke goedkeuring lopen als modeltools. */
module.exports = (kern) => function ambtenaar(s, q, req) {
  const O = kern.overheid, G = kern.gemeente;
  const rijkAmbt = O && O.magBehandelen && O.magBehandelen(s);
  const gemAmbt = G && G.magBehandelen && G.magBehandelen(s);
  if (!(rijkAmbt || gemAmbt)) return null;
  const R = (reply, did) => ({ reply, did: !!did });
  const V = (reply, pad, body) => ({ reply, did: false, actie: { pad, body } });
  // let op: Nederlandse scheidbare werkwoorden ("ken … toe", "wijs … af")
  const goed = /(ken\b.*?\btoe|toeken|toekennen|keur\s+goed|goedkeur|verleen|honoreer|gegrond|toewijs|toewijzen|akkoord)/i.test(q);
  const af = /(wijs\b.*?\baf|afwijz|weiger|afkeur|ongegrond|afgewezen|afgekeurd)/i.test(q);
  const opgelost = /\b(opgelost|afgehandeld|gereed|klaar)\b/i.test(q);
  const mref = q.match(/RTG-([A-Za-z]{1,3})-[0-9A-Fa-f]{4,8}/);
  if (mref) {
    const refc = mref[0].toUpperCase(), t = mref[1].toUpperCase();
    if (rijkAmbt && t === 'TS') return V('De toeslag ' + refc + ' wordt bijgewerkt.', '/api/overheid/toeslag/beslis', { ref: refc, besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' });
    if (rijkAmbt && t === 'SZ') return V('De uitkering ' + refc + ' wordt bijgewerkt.', '/api/overheid/uitkering/beslis', { ref: refc, besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' });
    if (rijkAmbt && t === 'SB') return V('De subsidie ' + refc + ' wordt bijgewerkt.', '/api/overheid/subsidie/beslis', { ref: refc, besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' });
    if (rijkAmbt && t === 'BZ') return V('Het bezwaar ' + refc + ' wordt bijgewerkt.', '/api/overheid/bezwaar/beslis', { ref: refc, besluit: goed ? 'gegrond' : af ? 'ongegrond' : 'in behandeling' });
    if (rijkAmbt && t === 'WM') return V('De watermelding ' + refc + ' wordt bijgewerkt.', '/api/overheid/water/melding/zet', { ref: refc, status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' });
    if (gemAmbt && t === 'M') return V('De melding ' + refc + ' wordt bijgewerkt.', '/api/gemeente/melding/zet', { ref: refc, status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' });
    if (gemAmbt && t === 'G') return V('De vergunning ' + refc + ' wordt bijgewerkt.', '/api/gemeente/vergunning/beslis', { ref: refc, besluit: goed ? 'verleend' : af ? 'geweigerd' : 'in behandeling' });
  } else if ((goed || af || opgelost) && /\b(eerste|eerstvolgende|volgende|deze|die)\b/i.test(q)) {
    // zonder ref: pak het eerste open item van het genoemde type
    const pak = (arr, pad, body, naam) => !arr[0] ? R('Er staan geen ' + naam + ' open.', false) :
      V(naam.replace(/en$/, '') + ' ' + arr[0].ref + ' wordt bijgewerkt.', pad, { ref: arr[0].ref, ...body });
    if (rijkAmbt && /toeslag/i.test(q)) return pak(O.toeslagenLijst({}).toeslagen, '/api/overheid/toeslag/beslis', { besluit: goed ? 'toegekend' : 'afgewezen' }, 'toeslagen');
    if (rijkAmbt && /uitkering|\bww\b|bijstand|aow|kinderbijslag/i.test(q)) return pak(O.uitkeringenLijst({}).uitkeringen, '/api/overheid/uitkering/beslis', { besluit: goed ? 'toegekend' : 'afgewezen' }, 'uitkeringen');
    if (rijkAmbt && /bezwaar/i.test(q)) return pak(O.bezwarenLijst({}).bezwaren, '/api/overheid/bezwaar/beslis', { besluit: goed ? 'gegrond' : 'ongegrond' }, 'bezwaren');
    if (rijkAmbt && /subsidie/i.test(q)) return pak(O.subsidiesLijst({}).subsidies, '/api/overheid/subsidie/beslis', { besluit: goed ? 'toegekend' : 'afgewezen' }, 'subsidies');
    if (rijkAmbt && /watermelding|wateroverlast|verontreiniging/i.test(q)) return pak(O.waterMeldingenLijst({}).meldingen, '/api/overheid/water/melding/zet', { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }, 'watermeldingen');
    if (gemAmbt && /vergunning/i.test(q)) return pak(G.vergunningenLijst({}).vergunningen, '/api/gemeente/vergunning/beslis', { besluit: goed ? 'verleend' : 'geweigerd' }, 'vergunningen');
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
