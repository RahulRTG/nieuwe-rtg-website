/* Rendez-vous, deelbestand "arrange": ARRANGE IT.

   De knop waar de app op uitkomt (ONTMOETEN.md par. 2.5). Meer hoeft een lid
   niet te doen: Rendez-vous weet inmiddels waar u allebei bent
   (./rendezvous-aanwezig), wanneer u allebei kunt (./beschikbaar) en wat u
   zoekt. Rahul stelt daarvan een ontmoeting samen, beiden keuren goed, en pas
   dan gaat het naar De Rechterhand.

   DE DRIEDELING IS HIER LETTERLIJK CODE, geen belofte in een prompt:

     Rahul denkt        `arrange()` zet een voorstel klaar
     de leden kiezen    `akkoord()`, twee keer, door twee mensen
     De Rechterhand     pas daarna, en die BOEKT -- wij niet

   ER STAAT GEEN ZAAKNAAM IN HET VOORSTEL, en dat is geen tekortkoming maar de
   merkregel uit CLAUDE.md: nooit een echt hotel- of restaurantmerk opvoeren als
   bevestigde partner, en nooit doen alsof er iets geboekt is. Het voorstel
   beschrijft de SETTING -- een diner, een borrel, een tentoonstelling met een
   glas erna -- plus de stad, de dagen en het dagdeel. Welke zaak het wordt,
   regelt De Rechterhand, en dat is precies waar het verschil met Vonk zit: daar
   kiest de software een tafel, hier kiest een mens hem.

   WAT ER BIJ TWEE AKKOORDEN GEBEURT. Er verschijnt bij ALLEBEI een gelegenheid
   in hun eigen Rechterhand-dossier (kern/rechterhand/table.js), met de status dat
   De Rechterhand hem oppakt. Er wordt niets gereserveerd, niets afgeschreven en
   niets bevestigd -- dat zou precies de claim zijn die hier niet gemaakt mag
   worden.

   EEN AKKOORD IS INTREKBAAR ZOLANG DE ANDER NOG NIET AKKOORD IS, en het voorstel
   vervalt zodra iemand zijn aanwezigheid of beschikbaarheid wijzigt waardoor de
   grond eronder wegvalt. Een voorstel dat over een verlopen weekend gaat, moet
   niet blijven staan alsof het nog kan.

   GEEN AANSPORING. Geen "de ander wacht", geen teller, geen herinnering.
   LIFE.md par. 4.1. */
module.exports = (ctx) => {
  const { R, AW, B, mag, codenaam, schoon, nu, save, matchesVan, tableZet, notify } = ctx;

  /* Drie settings, en geen enkele is een zaak. Bewust niet alleen eten: een
     tentoonstelling met een glas erna is een andere eerste ontmoeting dan een
     diner, en dat verschil is het halve product. */
  const SETTINGS = [
    { id: 'diner', label: 'een diner' },
    { id: 'borrel', label: 'een borrel' },
    { id: 'cultuur', label: 'een tentoonstelling met een glas erna' }
  ];
  const setting = id => SETTINGS.find(s => s.id === id);

  // een paar heeft een sleutel die niet van de volgorde afhangt
  const paar = (a, b) => [a, b].sort().join('|');
  function V() { const r = R(); if (!r.voorstellen || typeof r.voorstellen !== 'object') r.voorstellen = {}; return r.voorstellen; }

  /* Wat er nog van klopt. Een voorstel leunt op aanwezigheid en beschikbaarheid;
     verandert daar iets waardoor de stad of het dagdeel niet meer bestaat, dan
     is het voorstel niet meer geldig. Zo blijft er nooit een afspraak staan over
     een weekend dat allang voorbij is. */
  function nogGeldig(v, mij, zij) {
    if (!v) return false;
    if (v.stad) {
      const samen = AW.overlapTussen(mij, zij);
      if (!samen.some(s => s.stad.toLowerCase() === String(v.stad).toLowerCase() && s.tot >= v.van)) return false;
    }
    if (v.dagdeel) {
      const s = B.samenValt(mij.beschikbaar, zij.beschikbaar);
      if (!s || s.slot !== v.dagdeel) return false;
    }
    return true;
  }

  function stel(key, targetKey, gewenst) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const m = matchesVan(key).find(x => x.id === targetKey);
    if (!m) return { status: 400, error: 'Dit is (nog) geen wederzijdse match.' };
    const r = R();
    const mij = r.profielen[key] || {}, zij = r.profielen[targetKey] || {};
    const sl = paar(key, targetKey);
    let v = V()[sl];
    if (v && !nogGeldig(v, mij, zij)) v = null;      // de grond eronder is weg

    if (!v) {
      const samen = AW.overlapTussen(mij, zij);
      const dagdeel = B.samenValt(mij.beschikbaar, zij.beschikbaar);
      const s = setting(gewenst) || SETTINGS[0];
      v = { id: sl, setting: s.id, settingLabel: s.label,
        stad: (samen[0] && samen[0].stad) || m.gedeeldeLocaties[0] || '',
        van: (samen[0] && samen[0].van) || null, tot: (samen[0] && samen[0].tot) || null,
        dagdeel: dagdeel ? dagdeel.slot : null, dagdeelLabel: dagdeel ? dagdeel.label : null,
        akkoord: {}, at: nu() };
      V()[sl] = v; save();
    } else if (gewenst && setting(gewenst) && gewenst !== v.setting) {
      // van setting wisselen zet de akkoorden terug: je keurt niet iets anders goed
      v.setting = gewenst; v.settingLabel = setting(gewenst).label; v.akkoord = {}; v.at = nu(); save();
    }
    return { status: 200, voorstel: uit(v, key, targetKey), settings: SETTINGS.map(x => ({ ...x })) };
  }

  const uit = (v, key, targetKey) => ({
    setting: v.setting, settingLabel: v.settingLabel, stad: v.stad, van: v.van, tot: v.tot,
    dagdeel: v.dagdeel, dagdeelLabel: v.dagdeelLabel,
    ikAkkoord: !!v.akkoord[key], anderAkkoord: !!v.akkoord[targetKey],
    tekst: zin(v), bijRechterhand: !!v.bijRechterhand
  });

  function zin(v) {
    const d = [v.settingLabel, v.stad ? 'in ' + v.stad : null,
      v.van && v.tot ? '(' + v.van + ' t/m ' + v.tot + ')' : null,
      v.dagdeelLabel ? 'op ' + v.dagdeelLabel : null].filter(Boolean).join(' ');
    return d.charAt(0).toUpperCase() + d.slice(1) + '.';
  }

  function akkoord(key, targetKey, ja) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const m = matchesVan(key).find(x => x.id === targetKey);
    if (!m) return { status: 400, error: 'Dit is (nog) geen wederzijdse match.' };
    const r = R();
    const mij = r.profielen[key] || {}, zij = r.profielen[targetKey] || {};
    const v = V()[paar(key, targetKey)];
    if (!v) return { status: 409, error: 'Er ligt nog geen voorstel.' };
    if (!nogGeldig(v, mij, zij)) return { status: 409, error: 'Dit voorstel klopt niet meer; laat Rahul een nieuw voorstel doen.' };

    if (ja === false) { delete v.akkoord[key]; save(); return { status: 200, ok: true, voorstel: uit(v, key, targetKey) }; }
    v.akkoord[key] = nu();

    if (v.akkoord[targetKey] && !v.bijRechterhand) {
      /* Twee akkoorden. Er komt bij allebei een gelegenheid in het eigen
         Rechterhand-dossier te staan. Nadrukkelijk NIET gereserveerd: de notitie
         zegt dat De Rechterhand hem oppakt, want dat is wat er waar is. */
      v.bijRechterhand = nu();
      for (const [wie, met] of [[key, targetKey], [targetKey, key]]) {
        try {
          tableZet(wie, { naam: 'Rendez-vous met ' + codenaam(met), datum: v.van || '',
            locatie: v.stad || '', notitie: schoon(zin(v) + ' De Rechterhand regelt de reservering en bevestigt.', 300) });
        } catch (e) {}
        try { notify(wie, { title: 'Rendez-vous', body: 'U bent er allebei uit. De Rechterhand regelt het en bevestigt bij u.', scope: 'lifestyle' }); } catch (e) {}
      }
      save();
    }
    save();
    return { status: 200, ok: true, voorstel: uit(v, key, targetKey) };
  }

  return { rvArrange: stel, rvAkkoord: akkoord };
};
