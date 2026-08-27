/* Mobility OS (deelmodule): de toewijzing. Welk voertuig en welke chauffeur
   krijgen deze opdracht?

   NIET "DE DICHTSTBIJZIJNDE". Dat is het antwoord op een makkelijkere vraag.
   Een wagen die twee minuten dichterbij staat maar geen rolstoelplank heeft,
   op 9% accu staat, of vandaag al zijn negende rit rijdt terwijl een collega
   er twee had, is niet de beste keuze -- en bij ons is dat geen smaak maar
   beleid: een platform dat werk oneerlijk verdeelt, verdient aan de chauffeur
   die het hardst duwt.

   DRIE LAGEN, IN DEZE VOLGORDE.
   1. HARDE GRENZEN. Papieren, capaciteit, rolstoel, categorie, gebied,
      energie. Wie hier zakt komt niet in de rangschikking -- niet met een
      lagere score, maar helemaal niet. Een vergunning die verlopen is, is
      geen minpuntje.
   2. WEGING. De rest is een som van factoren met een gewicht. De gewichten
      staan per stad en per vervoerder in te stellen, want IJmuiden is
      Amsterdam niet.
   3. UITLEG. Elke kandidaat draagt zijn eigen rekensom mee: welke factor
      hoeveel punten gaf en waarom. Een dispatcher die niet snapt waarom de
      automaat wagen 4 koos, gaat handmatig toewijzen, en dan is de motor een
      dure decoratie. Dat is dezelfde regel als bij de schoolsignalen: geen
      score zonder natrekbare uitleg. */

const STANDAARD_GEWICHTEN = {
  nabijheid: 30,          // hoe dicht staat de wagen bij de reiziger
  aankomsttijd: 20,       // verwachte aanrijtijd
  eerlijk: 15,            // wie had vandaag het minste werk
  beoordeling: 10,        // wat vinden reizigers ervan
  energie: 10,            // accu of tank
  vervolgkans: 5,         // eindigt de rit waar de chauffeur toch heen wilde
  kosten: 10              // wat kost deze inzet
};

// harde grenzen die niet per stad verschillen
const MAX_AANRIJ_MIN = 25;       // verder dan dit is geen toewijzing maar een belofte
const MIN_ENERGIE_PCT = 15;

module.exports = (ctx) => {
  const { db, save, schoon, haversine, etaMinutes, assetGeschikt, assetInzetbaar, assetBeeld, opslag } = ctx;

  /* De standaardgewichten komen er EEN keer in, bij het aanmaken; daarna zijn
     ze gewoon te wijzigen. Dit stond eerder als "bestaat de collectie al?", en
     dat is precies de vraag die het opslagcontract nu zelf beantwoordt -- dus
     hangt het zaaien eraan in plaats van aan een voorwaarde die altijd onwaar
     zou zijn geworden. */
  const ensureMatching = () => opslag.bak('mobMatching', (kaart) => {
    kaart.standaard = Object.assign({}, STANDAARD_GEWICHTEN);
    kaart.steden = {};
    kaart.vervoerders = {};
  });

  /* De gewichten voor deze plek. Fijnste wint, net als bij het
     moduleregister: vervoerder boven stad boven de standaard. Een gewicht dat
     op een niveau ontbreekt valt terug op het niveau erboven, zodat je een
     enkele knop kunt bijstellen zonder de hele tabel over te schrijven. */
  function matchGewichten(waar = {}) {
    ensureMatching();
    const m = opslag.bak('mobMatching');
    return Object.assign({}, STANDAARD_GEWICHTEN, m.standaard || {},
      (waar.stad && m.steden[waar.stad]) || {},
      (waar.vervoerder && m.vervoerders[waar.vervoerder]) || {});
  }

  function matchGewichtenZet(body = {}) {
    ensureMatching();
    const m = opslag.bak('mobMatching');
    const gew = {};
    for (const [k, v] of Object.entries(body.gewichten || {})) {
      if (!Object.prototype.hasOwnProperty.call(STANDAARD_GEWICHTEN, k)) return { status: 400, error: 'Onbekende factor: ' + k };
      if (!Number.isFinite(v) || v < 0 || v > 100) return { status: 400, error: 'Gewicht van ' + k + ' moet tussen 0 en 100 liggen.' };
      gew[k] = Math.round(v);
    }
    if (!Object.keys(gew).length) return { status: 400, error: 'Geef minstens een factor op.' };
    const stad = schoon(body.stad, 40), vervoerder = schoon(body.vervoerder, 20);
    if (vervoerder) m.vervoerders[vervoerder] = Object.assign(m.vervoerders[vervoerder] || {}, gew);
    else if (stad) m.steden[stad] = Object.assign(m.steden[stad] || {}, gew);
    else m.standaard = Object.assign(m.standaard || {}, gew);
    save();
    return { ok: true, gewichten: matchGewichten({ stad, vervoerder }), niveau: vervoerder ? 'vervoerder' : (stad ? 'stad' : 'standaard') };
  }

  // hoeveel ritten heeft deze chauffeur vandaag al gehad? (de eerlijkheidsfactor)
  function ritenVandaag(vervoerder) {
    const vanaf = new Date(); vanaf.setHours(0, 0, 0, 0);
    const telling = new Map();
    for (const o of opslag.bak('mobOpdrachten') || []) {
      if (o.vervoerder !== vervoerder || !o.chauffeur) continue;
      if (new Date(o.gemaakt).getTime() < vanaf.getTime()) continue;
      telling.set(o.chauffeur, (telling.get(o.chauffeur) || 0) + 1);
    }
    return telling;
  }

  const punt = (deel, gewicht) => Math.round(Math.max(0, Math.min(1, deel)) * gewicht);

  /* Rangschik de vloot voor deze opdracht. `pool` is een lijst
     { asset, chauffeur, beoordeling, gepland } die de dispatch aanlevert;
     matching hoeft dus niets van roosters of accounts te weten.

     Geeft ALTIJD ook de afgewezen kandidaten terug, met hun reden. Zonder dat
     staat er "geen wagen beschikbaar" op het scherm terwijl er zes op de stoep
     staan, en gaat iemand de motor uitzetten. */
  function matchRangschik(opdracht, pool, waar = {}) {
    const gew = matchGewichten(Object.assign({ vervoerder: opdracht.vervoerder }, waar));
    const telling = ritenVandaag(opdracht.vervoerder);
    const maxRitten = Math.max(1, ...telling.values(), 1);
    const eisen = { reizigers: opdracht.reizigers, bagage: opdracht.bagage,
      rolstoel: opdracht.eisen && opdracht.eisen.rolstoel, categorie: opdracht.categorie,
      ritsoort: opdracht.ritsoort, gebied: opdracht.stad };

    const goed = [], afgewezen = [];
    for (const k of pool) {
      const a = k.asset;
      const inzet = assetInzetbaar(a, waar);
      if (!inzet.inzetbaar) { afgewezen.push({ assetId: a.id, naam: a.naam || a.categorie, redenen: inzet.redenen }); continue; }
      const geschikt = assetGeschikt(a, eisen);
      if (!geschikt.geschikt) { afgewezen.push({ assetId: a.id, naam: a.naam || a.categorie, redenen: geschikt.redenen }); continue; }

      const meters = a.loc ? haversine(a.loc, opdracht.van) : null;
      if (meters == null) { afgewezen.push({ assetId: a.id, naam: a.naam || a.categorie, redenen: ['geen bekende positie'] }); continue; }
      const aanrij = etaMinutes(meters, 'driving');
      if (aanrij > MAX_AANRIJ_MIN) {
        afgewezen.push({ assetId: a.id, naam: a.naam || a.categorie, redenen: ['aanrijtijd ' + aanrij + ' min is meer dan het maximum van ' + MAX_AANRIJ_MIN] });
        continue;
      }

      const km = meters / 1000;
      const gedaan = telling.get(k.chauffeur) || 0;
      const energie = Number.isFinite(a.energieNiveau) ? a.energieNiveau : 100;
      const beoordeling = Number.isFinite(k.beoordeling) ? k.beoordeling : 4.5;
      const gepland = Number.isFinite(k.gepland) ? k.gepland : 0;
      // eindigt deze rit in de buurt van waar de chauffeur toch heen moest?
      const vervolg = k.wilNaar && opdracht.naar ? haversine(k.wilNaar, opdracht.naar) : null;

      const factoren = [
        { naam: 'nabijheid', punten: punt(1 - Math.min(1, km / 15), gew.nabijheid), max: gew.nabijheid,
          uitleg: Math.round(km * 10) / 10 + ' km van de reiziger' },
        { naam: 'aankomsttijd', punten: punt(1 - Math.min(1, aanrij / MAX_AANRIJ_MIN), gew.aankomsttijd), max: gew.aankomsttijd,
          uitleg: 'aanrijtijd ongeveer ' + aanrij + ' min' },
        { naam: 'eerlijk', punten: punt(1 - (gedaan / maxRitten), gew.eerlijk), max: gew.eerlijk,
          uitleg: gedaan + ' rit(ten) vandaag; de drukste collega staat op ' + maxRitten },
        { naam: 'beoordeling', punten: punt((beoordeling - 3) / 2, gew.beoordeling), max: gew.beoordeling,
          uitleg: 'beoordeling ' + beoordeling.toFixed(1) },
        { naam: 'energie', punten: punt((energie - MIN_ENERGIE_PCT) / (100 - MIN_ENERGIE_PCT), gew.energie), max: gew.energie,
          uitleg: energie + '% energie' },
        { naam: 'vervolgkans', punten: punt(vervolg == null ? 0.5 : 1 - Math.min(1, vervolg / 20000), gew.vervolgkans), max: gew.vervolgkans,
          uitleg: vervolg == null ? 'geen voorkeursrichting opgegeven' : 'eindigt ' + Math.round(vervolg / 1000) + ' km van de gewenste richting' },
        { naam: 'kosten', punten: punt(1 - Math.min(1, gepland / 5), gew.kosten), max: gew.kosten,
          uitleg: gepland + ' rit(ten) al ingepland' }
      ];
      const score = factoren.reduce((s, f) => s + f.punten, 0);
      const maxScore = factoren.reduce((s, f) => s + f.max, 0) || 1;
      goed.push({ assetId: a.id, naam: a.naam || a.categorie, chauffeur: k.chauffeur,
        asset: assetBeeld ? assetBeeld(a, waar) : null,
        aanrijMin: aanrij, afstandM: meters,
        score: Math.round((score / maxScore) * 100), factoren });
    }
    goed.sort((x, y) => y.score - x.score || x.aanrijMin - y.aanrijMin);
    return { ok: true, kandidaten: goed, afgewezen, gewichten: gew, eisen };
  }

  return { STANDAARD_GEWICHTEN, MAX_AANRIJ_MIN, ensureMatching, matchGewichten, matchGewichtenZet, matchRangschik };
};
