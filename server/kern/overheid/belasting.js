/* Overheid-domein "belasting": de Belastingdienst (aangifte inkomstenbelasting,
   demo met twee schijven en een heffingskorting) en de Dienst Toeslagen. Inclusief
   de rekenhulp, het betalen van een aanslag (via de geld-drempel van Rahul, want
   het pad bevat "betaal") en lokale invulhulp voor de aangifte. Krijgt de gedeelde
   ctx van kern/overheid/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, jaar, id, ref, schoon, eur, seed, bericht, IB, TOESLAGEN } = ctx;
  /* LAAT GEBONDEN, en dat is hier geen stijl. `aangifteAdvies` haalt bedragen
     uit vrije tekst en raakt geen opslag aan; test/lokaal-eerst.test.js bouwt
     deze module daarvoor bewust zonder `db`. Het contract weigert terecht een
     db zonder data, dus zou een declaratie bij het bouwen dat pad breken --
     terwijl het niets bewaart. Wie wel bewaart, krijgt dezelfde weigering
     alsnog, op zijn eerste aanraking. */
  let _eigen = null;
  const eigen = () => (_eigen || (_eigen = require('../eigencollectie')({
    db, domein: 'kern/overheid/belasting', bezit: { rijkAanslagen: 'lijst', rijkToeslagen: 'lijst' } })));

  function berekenIB(inkomen, aftrek, ingehouden) {
    const belastbaar = Math.max(0, eur(inkomen) - Math.max(0, eur(aftrek)));
    const belasting = belastbaar <= IB.schijf
      ? belastbaar * IB.tarief1
      : IB.schijf * IB.tarief1 + (belastbaar - IB.schijf) * IB.tarief2;
    const teVoldoen = Math.max(0, belasting - IB.heffingskorting);
    // loonheffing die al is ingehouden; bij niets ingevuld schatten we ~32%
    const alBetaald = ingehouden == null || ingehouden === '' ? Math.round(eur(inkomen) * 0.32) : Math.max(0, eur(ingehouden));
    const saldo = eur(teVoldoen - alBetaald); // >0 = bijbetalen, <0 = teruggaaf
    return { belastbaar, belasting: eur(belasting), heffingskorting: IB.heffingskorting, teVoldoen: eur(teVoldoen), ingehouden: alBetaald, saldo };
  }
  function aangifteDoe(sess, codenaam, data) {
    seed();
    data = data || {};
    const inkomen = eur(data.inkomen);
    if (inkomen <= 0) return { status: 400, error: 'Vul je bruto jaarinkomen in.' };
    if (inkomen > 100000000) return { status: 400, error: 'Dat inkomen is te hoog om te verwerken.' };
    const b = berekenIB(inkomen, data.aftrek, data.ingehouden);
    // één aangifte per jaar; opnieuw indienen overschrijft de vorige
    const j = jaar();
    let a = eigen().bak('rijkAanslagen').find(x => x.key === sess.key && x.jaar === j);
    if (!a) { a = { id: id(), ref: ref('IB'), key: sess.key, codenaam, jaar: j, at: nu() }; eigen().bak('rijkAanslagen').unshift(a); }
    Object.assign(a, { inkomen, aftrek: Math.max(0, eur(data.aftrek)), ...b, betaald: a.betaald || false, ingediend: nu() });
    eigen().zetBak('rijkAanslagen', eigen().bak('rijkAanslagen').slice(0, 40000));
    bericht(sess.key, 'Belastingdienst', 'Aanslag inkomstenbelasting ' + j,
      a.saldo > 0 ? 'Je moet € ' + a.saldo + ' bijbetalen. Betaal via MijnOverheid.' :
      a.saldo < 0 ? 'Je krijgt € ' + Math.abs(a.saldo) + ' terug.' : 'Je aangifte komt uit op nul: niets te betalen of terug te ontvangen.', 'belasting');
    save();
    return { ok: true, aanslag: publiekeAanslag(a) };
  }
  function publiekeAanslag(a) {
    return { ref: a.ref, jaar: a.jaar, inkomen: a.inkomen, aftrek: a.aftrek, belastbaar: a.belastbaar,
      belasting: a.belasting, heffingskorting: a.heffingskorting, teVoldoen: a.teVoldoen, ingehouden: a.ingehouden,
      saldo: a.saldo, betaald: !!a.betaald, at: a.ingediend || a.at };
  }
  function mijnAanslagen(key) {
    seed();
    return { ok: true, aanslagen: eigen().bak('rijkAanslagen').filter(a => a.key === key).slice(0, 20).map(publiekeAanslag) };
  }
  function aanslagBetaal(key, r) {
    const a = eigen().bak('rijkAanslagen').find(x => x.ref === String(r || '') && x.key === key);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (a.saldo <= 0) return { status: 409, error: 'Voor deze aanslag hoef je niets te betalen.' };
    if (a.betaald) return { status: 409, error: 'Deze aanslag is al betaald.' };
    a.betaald = true; a.betaaldAt = nu();
    bericht(key, 'Belastingdienst', 'Betaling ontvangen', 'Je betaling van € ' + a.saldo + ' voor de aanslag ' + a.jaar + ' is ontvangen.', 'belasting');
    save();
    return { ok: true, aanslag: publiekeAanslag(a) };
  }

  function toeslagBereken(soort, inkomen) {
    const t = TOESLAGEN[soort]; if (!t) return 0;
    if (eur(inkomen) >= t.grens) return 0;
    return Math.max(0, eur(t.max - eur(inkomen) * t.af));
  }
  function toeslagAanvraag(sess, codenaam, data) {
    seed();
    data = data || {};
    const soort = TOESLAGEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies een geldige toeslag.' };
    const inkomen = eur(data.inkomen);
    if (inkomen < 0) return { status: 400, error: 'Vul je jaarinkomen in.' };
    if (eigen().bak('rijkToeslagen').some(x => x.key === sess.key && x.soort === soort && x.status !== 'gestopt' && x.status !== 'afgewezen'))
      return { status: 409, error: 'Je hebt al een aanvraag voor ' + TOESLAGEN[soort].label + ' lopen.' };
    const maandbedrag = eur(toeslagBereken(soort, inkomen));
    const t = { id: id(), ref: ref('TS'), key: sess.key, codenaam, soort, soortLabel: TOESLAGEN[soort].label,
      inkomen, maandbedrag, status: maandbedrag > 0 ? 'aangevraagd' : 'geen recht', at: nu() };
    eigen().bak('rijkToeslagen').unshift(t);
    eigen().zetBak('rijkToeslagen', eigen().bak('rijkToeslagen').slice(0, 40000));
    bericht(sess.key, 'Dienst Toeslagen', 'Aanvraag ' + t.soortLabel,
      maandbedrag > 0 ? 'Je aanvraag is ontvangen. Voorlopige berekening: € ' + maandbedrag + ' per maand. Een medewerker beoordeelt hem.'
        : 'Op basis van je inkomen is er geen recht op ' + t.soortLabel + '.', 'toeslag');
    save();
    return { ok: true, toeslag: publiekeToeslag(t) };
  }
  function publiekeToeslag(t) { return { ref: t.ref, soort: t.soort, soortLabel: t.soortLabel, inkomen: t.inkomen, maandbedrag: t.maandbedrag, status: t.status, at: t.at }; }
  function mijnToeslagen(key) { seed(); return { ok: true, toeslagen: eigen().bak('rijkToeslagen').filter(t => t.key === key).slice(0, 30).map(publiekeToeslag) }; }
  function toeslagenLijst(filter) {
    seed(); filter = filter || {};
    let list = eigen().bak('rijkToeslagen');
    list = filter.status ? list.filter(t => t.status === filter.status) : list.filter(t => t.status === 'aangevraagd');
    return { ok: true, toeslagen: list.slice(0, 200).map(t => ({ ...publiekeToeslag(t), aanvrager: t.codenaam })) };
  }
  function toeslagBeslis(actor, r, data) {
    data = data || {};
    const t = eigen().bak('rijkToeslagen').find(x => x.ref === String(r || ''));
    if (!t) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const besluit = ['toegekend', 'afgewezen', 'in behandeling'].includes(data.besluit) ? data.besluit : null;
    if (!besluit) return { status: 400, error: 'Kies een geldig besluit.' };
    t.status = besluit; t.besluit = { door: actor || 'rijk', at: nu() };
    if (t.key) bericht(t.key, 'Dienst Toeslagen', 'Besluit ' + t.soortLabel,
      besluit === 'toegekend' ? 'Je toeslag van € ' + t.maandbedrag + ' per maand is toegekend.' :
      besluit === 'afgewezen' ? 'Je aanvraag is afgewezen.' : 'Je aanvraag is in behandeling genomen.', 'toeslag');
    save();
    return { ok: true, toeslag: publiekeToeslag(t) };
  }

  /* Invulhulp bij de aangifte: leest alleen expliciet genoemde bedragen. Dat is
     lokale extractie, geen reden om financiële tekst naar een model te sturen.
     Doet niets automatisch · het lid controleert en dient zelf in. */
  function regelAangifte(tekst) {
    const t = String(tekst || '');
    const num = re => { const m = t.match(re); return m ? eur(m[1].replace(/[.\s]/g, '')) : 0; };
    const alle = (t.match(/\d[\d.\s]{2,}/g) || []).map(x => eur(x.replace(/[.\s]/g, '')));
    let inkomen = num(/(?:verdien|inkomen|salaris|bruto)[^\d]{0,12}(\d[\d.\s]{2,})/i);
    // aftrek staat vaak vóór of ná het trefwoord ("3200 aftrek" of "aftrek 3200")
    let aftrek = num(/(?:aftrek|hypotheek|zorgkosten|gift)[^\d]{0,14}(\d[\d.\s]{2,})/i)
      || num(/(\d[\d.\s]{2,})[^\d]{0,10}(?:aftrek|hypotheek|zorgkost|gift)/i);
    if (!inkomen && alle.length) inkomen = Math.max.apply(null, alle);
    if (!aftrek && alle.length > 1) aftrek = [...alle].sort((a, b) => b - a)[1];
    return { inkomen, aftrek };
  }
  async function aangifteAdvies(tekst) {
    const val = regelAangifte(tekst);
    return { ok: true, ...val, bron: 'regel', ai: false };
  }

  return { berekenIB, aangifteDoe, mijnAanslagen, aanslagBetaal, toeslagAanvraag, mijnToeslagen, toeslagenLijst, toeslagBeslis, regelAangifte, aangifteAdvies };
};
