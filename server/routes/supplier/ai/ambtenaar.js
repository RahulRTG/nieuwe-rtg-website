/* Supplier-AI, deel "ambtenaar" (routes/supplier/ai): de rijks- en gemeentebalie
   die zaken via Rahul afhandelt. "ken RTG-TS-… toe", "wijs RTG-SB-… af", "verleen
   RTG-G-…", "zet RTG-M-… op opgelost", en een concrete briefing met referenties
   zodat de ambtenaar meteen kan door-acteren. Verbatim afgesplitst uit de grote
   /api/supplier/ai-handler; geeft { reply, did } terug of null als deze laag de
   vraag niet pakt (dan gaat de hoofd-handler verder met acties en vragen). */
module.exports = (kern) => function ambtenaar(s, q, req) {
  const O = kern.overheid, G = kern.gemeente;
  const rijkAmbt = O && O.magBehandelen && O.magBehandelen(s);
  const gemAmbt = G && G.magBehandelen && G.magBehandelen(s);
  if (!(rijkAmbt || gemAmbt)) return null;
  const R = (reply, did) => ({ reply, did: !!did });
  const wieAmbt = (req.actor && req.actor.name) || s.name;
  // let op: Nederlandse scheidbare werkwoorden ("ken … toe", "wijs … af")
  const goed = /(ken\b.*?\btoe|toeken|toekennen|keur\s+goed|goedkeur|verleen|honoreer|gegrond|toewijs|toewijzen|akkoord)/i.test(q);
  const af = /(wijs\b.*?\baf|afwijz|weiger|afkeur|ongegrond|afgewezen|afgekeurd)/i.test(q);
  const opgelost = /\b(opgelost|afgehandeld|gereed|klaar)\b/i.test(q);
  const mref = q.match(/RTG-([A-Za-z]{1,3})-[0-9A-Fa-f]{4,8}/);
  if (mref) {
    const refc = mref[0].toUpperCase(), t = mref[1].toUpperCase();
    let r = null, wat = '';
    if (rijkAmbt && t === 'TS') { r = O.toeslagBeslis(wieAmbt, refc, { besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' }); wat = 'toeslag'; }
    else if (rijkAmbt && t === 'SZ') { r = O.uitkeringBeslis(wieAmbt, refc, { besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' }); wat = 'uitkering'; }
    else if (rijkAmbt && t === 'SB') { r = O.subsidieBeslis(wieAmbt, refc, { besluit: goed ? 'toegekend' : af ? 'afgewezen' : 'in behandeling' }); wat = 'subsidie'; }
    else if (rijkAmbt && t === 'BZ') { r = O.bezwaarBeslis(wieAmbt, refc, { besluit: goed ? 'gegrond' : af ? 'ongegrond' : 'in behandeling' }); wat = 'bezwaar'; }
    else if (rijkAmbt && t === 'WM') { r = O.waterMeldingZet(wieAmbt, refc, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }); wat = 'watermelding'; }
    else if (gemAmbt && t === 'M') { r = G.meldingZet(wieAmbt, refc, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }); wat = 'melding'; }
    else if (gemAmbt && t === 'G') { r = G.vergunningBeslis(wieAmbt, refc, { besluit: goed ? 'verleend' : af ? 'geweigerd' : 'in behandeling' }); wat = 'vergunning'; }
    if (r && r.error) return R(r.error, false);
    if (r) return R('De ' + wat + ' ' + refc + ' is bijgewerkt.', true);
  } else if ((goed || af || opgelost) && /\b(eerste|eerstvolgende|volgende|deze|die)\b/i.test(q)) {
    // zonder ref: pak het eerste open item van het genoemde type
    const pak = (arr, doe, naam) => { if (!arr[0]) return R('Er staan geen ' + naam + ' open.', false); doe(arr[0].ref); return R(naam.replace(/en$/, '') + ' ' + arr[0].ref + ' is bijgewerkt.', true); };
    if (rijkAmbt && /toeslag/i.test(q)) return pak(O.toeslagenLijst({}).toeslagen, ref => O.toeslagBeslis(wieAmbt, ref, { besluit: goed ? 'toegekend' : 'afgewezen' }), 'toeslagen');
    if (rijkAmbt && /uitkering|\bww\b|bijstand|aow|kinderbijslag/i.test(q)) return pak(O.uitkeringenLijst({}).uitkeringen, ref => O.uitkeringBeslis(wieAmbt, ref, { besluit: goed ? 'toegekend' : 'afgewezen' }), 'uitkeringen');
    if (rijkAmbt && /bezwaar/i.test(q)) return pak(O.bezwarenLijst({}).bezwaren, ref => O.bezwaarBeslis(wieAmbt, ref, { besluit: goed ? 'gegrond' : 'ongegrond' }), 'bezwaren');
    if (rijkAmbt && /subsidie/i.test(q)) return pak(O.subsidiesLijst({}).subsidies, ref => O.subsidieBeslis(wieAmbt, ref, { besluit: goed ? 'toegekend' : 'afgewezen' }), 'subsidies');
    if (rijkAmbt && /watermelding|wateroverlast|verontreiniging/i.test(q)) return pak(O.waterMeldingenLijst({}).meldingen, ref => O.waterMeldingZet(wieAmbt, ref, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }), 'watermeldingen');
    if (gemAmbt && /vergunning/i.test(q)) return pak(G.vergunningenLijst({}).vergunningen, ref => G.vergunningBeslis(wieAmbt, ref, { besluit: goed ? 'verleend' : 'geweigerd' }), 'vergunningen');
    if (gemAmbt && /melding/i.test(q)) return pak(G.meldingenLijst({}).meldingen, ref => G.meldingZet(wieAmbt, ref, { status: opgelost ? 'opgelost' : af ? 'afgewezen' : 'in behandeling' }), 'meldingen');
  }
  // stemming openen/sluiten (rijk)
  if (rijkAmbt && /\bstemming|referendum\b/i.test(q) && /\b(sluit|dicht|stop)\b/i.test(q)) { O.verkiezingSluit(false); return R('De stemming is gesloten.', true); }
  if (rijkAmbt && /\bstemming|referendum\b/i.test(q) && /\b(open|heropen|start)\b/i.test(q)) { O.verkiezingSluit(true); return R('De stemming is heropend.', true); }
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
