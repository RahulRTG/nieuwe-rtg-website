/* Ontmoeting (deelmodule): de radar (wie is in de buurt en beschikbaar),
   de wederzijdse voorstellen en de activiteitkeuze met contracttekst.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/ontmoeting.js. */
module.exports = (ctx) => {
  const { db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice,
    connectieTussen, verbActief, zijnVrienden, codenaamVan, haversine,
    RADIUS_M, POS_TTL_MS, VOORSTEL_TTL_MS, MIN_LEEFTIJD, ACTIVITEITEN, ACT_IDS,
    lijsten, accountVanKey, memberState, geslachtVan, mag, staatAan, zet, pos, versePositie, id, nu, paar } = ctx;
  // late binding: de datelaag wordt na deze laag gemount; kies() maakt pas
  // per verzoek een date aan, dus tegen die tijd staat maakDate in de context.
  const maakDate = (...a) => ctx.maakDate(...a);
  function radar(key) {
    const mij = versePositie(key);
    if (!mij) return [];
    const nieuw = [];
    for (const c of db.data.connections) {
      if (!verbActief(c)) continue;
      if (c.a !== key && c.b !== key) continue;
      const ander = c.a === key ? c.b : c.a;
      if (!staatAan(ander)) continue;
      const m2 = mag(ander); if (!m2.ok) continue;
      const zij = versePositie(ander);
      if (!zij) continue;
      if (haversine(mij, zij) > RADIUS_M) continue;
      // is er al een open of lopend voorstel/afspraak? dan niets nieuws
      if (lopendVoorstel(key, ander) || lopendeDate(key, ander)) continue;
      const v = {
        id: id(), a: key, b: ander, at: nu(), status: 'open',
        vervalt: new Date(Date.now() + VOORSTEL_TTL_MS).toISOString(),
        keuzes: {}, dateId: null
      };
      db.data.ontmoetVoorstellen.unshift(v);
      db.data.ontmoetVoorstellen = db.data.ontmoetVoorstellen.slice(0, 4000);
      for (const k of [key, ander]) {
        sseToCustomer(k, 'sync', { scope: 'ontmoeting' });
        notify(k, { icon: '\u{1F31F}', title: 'Iemand in de buurt', body: 'Een connectie is vlakbij. Kies samen: Wandelen, Borrelen of Jetset.', scope: 'ontmoeting' });
      }
      nieuw.push(v.id);
    }
    return nieuw;
  }
  function lopendVoorstel(a, b) {
    return db.data.ontmoetVoorstellen.find(v => v.status === 'open' && paar(v.a, v.b) === paar(a, b) && !verlopenVoorstel(v));
  }
  function lopendeDate(a, b) {
    return db.data.ontmoetDates.find(d => ['wacht-op-tekenen', 'actief', 'noodgeval'].includes(d.status) && paar(d.a, d.b) === paar(a, b));
  }
  function verlopenVoorstel(v) { return v.vervalt && new Date(v.vervalt).getTime() < Date.now(); }

  /* ---- een keuze maken (of niets doen = afwijzen) ---- */
  function kies(key, voorstelId, keuze) {
    lijsten();
    const v = db.data.ontmoetVoorstellen.find(x => x.id === voorstelId);
    if (!v || (v.a !== key && v.b !== key)) return { status: 404, error: 'Voorstel niet gevonden.' };
    if (v.status !== 'open' || verlopenVoorstel(v)) { if (v.status === 'open') v.status = 'verlopen'; save(); return { status: 409, error: 'Dit voorstel is verlopen.' }; }
    if (keuze === 'afwijzen') {
      v.status = 'afgewezen'; save();
      const ander = v.a === key ? v.b : v.a;
      sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
      return { status: 200, ok: true, status2: 'afgewezen' };
    }
    if (!ACT_IDS.includes(keuze)) return { status: 400, error: 'Kies Wandelen, Borrelen of Jetset.' };
    v.keuzes[key] = keuze;
    const ander = v.a === key ? v.b : v.a;
    sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
    // pas matchen als allebei gekozen hebben
    if (v.keuzes[v.a] && v.keuzes[v.b]) {
      const gekozen = beslisActiviteit(v.keuzes[v.a], v.keuzes[v.b], geslachtVan(v.a), geslachtVan(v.b));
      v.status = 'gematcht'; v.activiteit = gekozen;
      const d = maakDate(v.a, v.b, gekozen, v.id);
      v.dateId = d.id;
      save();
      for (const k of [v.a, v.b]) {
        sseToCustomer(k, 'sync', { scope: 'ontmoeting' });
        notify(k, { icon: actIcon(gekozen), title: 'Het is een match', body: 'Jullie gaan ' + actLabel(gekozen).toLowerCase() + '. Teken het veiligheidscontract om te starten.', scope: 'ontmoeting' });
      }
      return { status: 200, ok: true, status2: 'gematcht', activiteit: gekozen, dateId: d.id };
    }
    save();
    return { status: 200, ok: true, status2: 'gekozen' };
  }

  // De kern van de regel: gelijk = dat; anders naar de vrouw; anders de rustigste.
  function beslisActiviteit(kA, kB, gA, gB) {
    if (kA === kB) return kA;
    const vrouwA = gA === 'v', vrouwB = gB === 'v';
    if (vrouwA && !vrouwB) return kA;
    if (vrouwB && !vrouwA) return kB;
    const rang = x => (ACTIVITEITEN.find(a => a.id === x) || { rust: 99 }).rust;
    return rang(kA) <= rang(kB) ? kA : kB;
  }
  const actLabel = x => (ACTIVITEITEN.find(a => a.id === x) || {}).label || x;
  const actIcon = x => (ACTIVITEITEN.find(a => a.id === x) || {}).icon || '\u{1F31F}';

  /* ---- het veiligheidscontract ---- */
  function contractTekst(activiteit) {
    return [
      'RTG Salon-ontmoeting, veiligheidsafspraak',
      '',
      'Jullie spreken af om samen te ' + actLabel(activiteit).toLowerCase() + '. Door te tekenen ga je akkoord met:',
      '1. RTG-kantoor mag jullie live-locatie zien vanaf de start tot de afspraak is afgerond. Alleen het RTG-veiligheidsteam, niet de andere deelnemer of derden.',
      '2. Druk je op de SOS-knop, dan mag RTG-kantoor meteen meeluisteren en meekijken via de camera van je telefoon en direct de hulpdiensten (112) inschakelen.',
      '3. De locatie wordt niet langer bewaard dan nodig voor jullie veiligheid en wordt na de afspraak gewist, tenzij er een incident is gemeld.',
      '4. Elk van beiden kan de afspraak op elk moment beeindigen; daarmee stopt ook het meekijken.',
      '',
      'Deze afspraak geldt alleen tussen jullie tweeen en RTG. Tekenen kan alleen als je 18 jaar of ouder bent met een geverifieerd paspoort.'
    ].join('\n');
  }
  return { radar, lopendVoorstel, lopendeDate, verlopenVoorstel, kies, beslisActiviteit, contractTekst, actLabel, actIcon };
};
