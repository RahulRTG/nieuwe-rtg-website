/* RTG Thuis, deel "extra": reviews twee kanten op (gast beoordeelt het huis,
   de host beoordeelt de gast), de wenslijst, berichten per boeking tussen
   host en gast, mijn reizen en het host-dashboard (inkomsten, bezetting,
   superhost). Krijgt de gedeelde ctx. */
module.exports = (ctx) => {
  const { save, schoon, huizen, boekingen, reviews, wensen, nu, nachten, raakt,
    ratingVan, gastScore, superhost, magBeheren } = ctx;

  /* Review na check-uit: de gast over het huis ('gast'), de host over de
     gast ('host'). Een keer per kant per boeking. */
  function review(codenaam, data) {
    data = data || {};
    const b = boekingen().find(x => x.ref === String(data.ref || ''));
    if (!b || b.status !== 'uitgecheckt') return { status: 404, error: 'Een review kan na het uitchecken.' };
    let richting = null;
    if (b.gast === codenaam) richting = 'gast';
    else if (b.host === codenaam || magBeheren(huizen()[b.huisId], codenaam)) richting = 'host';
    if (!richting) return { status: 403, error: 'Alleen de gast en de host van deze boeking.' };
    if (reviews().some(r => r.ref === b.ref && r.richting === richting)) return { status: 409, error: 'Deze review is al gegeven.' };
    const sterren = Math.round(Number(data.sterren));
    if (!(sterren >= 1 && sterren <= 5)) return { status: 400, error: 'Geef 1 tot 5 sterren.' };
    reviews().unshift({ ref: b.ref, huisId: b.huisId, gast: b.gast, richting, sterren,
      tekst: schoon(data.tekst, 400), door: codenaam, at: nu() });
    if (reviews().length > 50000) reviews().length = 50000;
    save();
    return { ok: true, richting, sterren };
  }

  function huisReviews(huisId) {
    return { ok: true, rating: ratingVan(huisId),
      reviews: reviews().filter(r => r.huisId === huisId && r.richting === 'gast').slice(0, 30)
        .map(r => ({ door: r.gast, sterren: r.sterren, tekst: r.tekst, at: r.at })) };
  }

  // de wenslijst (premium bij anderen, hier gewoon aan)
  function wensToggle(codenaam, huisId) {
    if (!huizen()[huisId]) return { status: 404, error: 'Dit huis bestaat niet.' };
    const w = wensen();
    w[codenaam] = (w[codenaam] || []).filter(x => x !== huisId).concat(
      (w[codenaam] || []).includes(huisId) ? [] : [huisId]).slice(-100);
    save();
    return { ok: true, wenslijst: w[codenaam] };
  }
  function wensLijst(codenaam) {
    const ids = wensen()[codenaam] || [];
    return { ok: true, huizen: ids.map(id => huizen()[id]).filter(h => h && h.live).map(ctx.thuisPubliek || (h => h)) };
  }

  // berichten per boeking: host en gast overleggen op de boeking zelf
  function bericht(codenaam, ref, tekst) {
    const b = boekingen().find(x => x.ref === String(ref || ''));
    if (!b) return { status: 404, error: 'Deze boeking is er niet.' };
    const mag = b.gast === codenaam || b.host === codenaam || magBeheren(huizen()[b.huisId], codenaam);
    if (!mag) return { status: 403, error: 'Alleen de gast en de host van deze boeking.' };
    const t = schoon(tekst, 400);
    if (!t) return { status: 400, error: 'Schrijf eerst een bericht.' };
    b.berichten = (b.berichten || []).concat({ van: codenaam, tekst: t, at: nu() }).slice(-60);
    save();
    return { ok: true, berichten: b.berichten };
  }
  function berichten(codenaam, ref) {
    const b = boekingen().find(x => x.ref === String(ref || ''));
    if (!b) return { status: 404, error: 'Deze boeking is er niet.' };
    const mag = b.gast === codenaam || b.host === codenaam || magBeheren(huizen()[b.huisId], codenaam);
    if (!mag) return { status: 403, error: 'Alleen de gast en de host van deze boeking.' };
    return { ok: true, berichten: b.berichten || [] };
  }

  function mijnReizen(codenaam) {
    return { ok: true, reizen: boekingen().filter(b => b.gast === codenaam).slice(0, 50).map(ctx.thuisGastZicht) };
  }

  /* Het host-dashboard: aanvragen die wachten, komende verblijven, inkomsten
     (afgeronde verblijven), bezetting komende 30 dagen en de superhost-stand. */
  function hostBord(codenaam) {
    const mijn = Object.values(huizen()).filter(h => magBeheren(h, codenaam));
    const ids = mijn.map(h => h.id);
    const alle = boekingen().filter(b => ids.includes(b.huisId));
    const inkomsten = Math.round(alle.filter(b => b.status === 'uitgecheckt').reduce((s, b) => s + b.prijsopbouw.totaal, 0) * 100) / 100;
    const van = new Date().toISOString().slice(0, 10), tot = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    let bezetteNachten = 0;
    for (const b of alle) if (['bevestigd', 'ingecheckt'].includes(b.status) && raakt(van, tot, b.van, b.tot))
      bezetteNachten += nachten(b.van < van ? van : b.van, b.tot > tot ? tot : b.tot);
    const capaciteit = Math.max(1, mijn.filter(h => h.live).length * 30);
    return { ok: true,
      huizen: mijn.length, live: mijn.filter(h => h.live).length,
      aanvragen: alle.filter(b => b.status === 'aangevraagd').map(ctx.thuisGastZicht).map(b => Object.assign(b, { gastRating: gastScore(b.gast) })),
      komend: alle.filter(b => ['bevestigd', 'ingecheckt'].includes(b.status)).slice(0, 20).map(ctx.thuisGastZicht),
      inkomstenTotaal: inkomsten, bezettingPct: Math.min(100, Math.round(bezetteNachten / capaciteit * 100)),
      superhost: superhost(codenaam),
      uitbetaling: 'Uitbetalingen staan gepland naar je RTG Bank-rekening; RTG houdt 0% in.' };
  }

  return { thuisReview: review, thuisHuisReviews: huisReviews, thuisWensToggle: wensToggle,
    thuisWensLijst: wensLijst, thuisBericht: bericht, thuisBerichten: berichten,
    thuisMijnReizen: mijnReizen, thuisHostBord: hostBord };
};
