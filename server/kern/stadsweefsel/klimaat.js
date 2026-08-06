/* RTG Stadsweefsel, deel "klimaat": water, hitte en droogte als eigen laag.

   RTG Stad mat "water" als een enkel getal in kubieke meters per uur. Voor een
   stad aan zee is dat te weinig om ook maar iets over te zeggen: grondwater,
   regen, rioolbelasting en waterstand bewegen niet samen, en juist het VERSCHIL
   ertussen is het signaal. Een riool dat vol staat bij droog weer is iets heel
   anders dan een riool dat vol staat tijdens een bui.

   Deze laag voegt vijf meetsoorten toe (regen, grondwater, riool, waterstand,
   hitte), legt RISICOZONES vast (laaggelegen gebied, hittestress, kade), en
   rekent KLIMAATSCENARIO'S door: wat gebeurt er bij extreme regen, een
   hittegolf, langdurige droogte of hoogwater -- welke objecten en welke
   gebieden staan dan als eerste onder druk.

   HET ANTWOORD IS EEN BEREKENING OP HET REGISTER, GEEN VOORSPELLING. Er zit
   geen hydrologisch model onder en dat wordt hier ook niet gesuggereerd. Wat
   het wel doet: het combineert wat de stad van zichzelf weet (waar liggen de
   putten, welk gemaal voert af, welke zone ligt laag, hoeveel schaduw staat
   er) tot een lijst waar je als eerste zou kijken. Dat is precies de lijst die
   tijdens een bui ontbreekt.

   De uitkomst gaat ook naar het gezamenlijke rampbeeld: bij een scenario dat
   opschaalt hoort de keten hetzelfde beeld te zien als de boardroom.
   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

/* De meetsoorten van deze laag, met hun eenheid en de drempels rustig ->
   verhoogd -> kritiek. Ze staan hier en niet bij de acht domeinen van RTG Stad,
   omdat die het BORD van de stad zijn (met regimes en een scenario-knop) en dit
   het geheugen en de risicokant is. */
const METERS = {
  regen: { label: 'Neerslag', eenheid: 'mm/u', drempels: [4, 15] },
  grondwater: { label: 'Grondwaterstand', eenheid: 'cm -mv', drempels: [80, 40], omgekeerd: true },
  riool: { label: 'Rioolbelasting', eenheid: '% vol', drempels: [60, 85] },
  waterstand: { label: 'Waterstand', eenheid: 'cm NAP', drempels: [80, 140] },
  hitte: { label: 'Gevoelstemperatuur', eenheid: 'gr C', drempels: [27, 35] }
};

/* De scenario's. Elk noemt welke meters hij opdrijft, welke objectsoorten als
   eerste in de knel komen en welk soort gebied extra kwetsbaar is. */
const SCENARIOS = {
  'extreme-regen': { label: 'Extreme regen', meters: ['regen', 'riool'], soorten: ['put', 'gemaal'],
    zoek: 'laag', gevolg: 'water op straat, riool boven capaciteit, kelders onder water' },
  hittegolf: { label: 'Hittegolf', meters: ['hitte'], soorten: ['boom', 'speeltoestel', 'halte'],
    zoek: 'hitte', gevolg: 'hittestress bij kwetsbare bewoners, asfaltschade, droogtestress bij bomen' },
  droogte: { label: 'Langdurige droogte', meters: ['grondwater'], soorten: ['boom', 'brug'],
    zoek: 'laag', gevolg: 'bomen in nood, funderingen en kades zetten zich, brandgevaar in het groen' },
  hoogwater: { label: 'Hoogwater', meters: ['waterstand'], soorten: ['gemaal', 'brug', 'transformator'],
    zoek: 'kade', gevolg: 'kades onder druk, gemalen op maximum, kans op uitval van laaggelegen infrastructuur' }
};
const KENMERKEN = ['laag', 'hitte', 'kade'];   // wat je van een gebied kunt vastleggen

module.exports = (ctx) => {
  const { d, save, nu, geo, obj, afh, tr } = ctx;

  const kenmerken = () => { if (!d().weefselKenmerk || typeof d().weefselKenmerk !== 'object') d().weefselKenmerk = {}; return d().weefselKenmerk; };
  const kenmerkenVan = (gebiedId) => kenmerken()[gebiedId] || [];

  /* De seed: welke zones liggen laag, welke zijn versteend, welke grenzen aan
     het water. In een echte stad komt dit uit hoogtekaarten en luchtfoto's; hier
     staat het als vastgelegde eigenschap, zodat de rest van de laag iets heeft
     om op te rekenen in plaats van te gokken. */
  function zorgKenmerken() {
    if (Object.keys(kenmerken()).length) return;
    const zet = (naam, lijst) => { const g = geo.opNaam(naam, 'zone'); if (g) kenmerken()[g.id] = lijst; };
    zet('Marina', ['kade', 'laag']);
    zet('Boulevard', ['kade', 'laag']);
    zet('Centrum', ['hitte']);
    zet('Bedrijvenkwartier', ['hitte']);
    zet('Oud-West', ['laag']);
    zet('Groenzone', []);
    save();
  }

  function kenmerkZet({ gebied, lijst }) {
    const g = geo.gebied(gebied);
    if (!g) return { status: 404, error: 'Onbekend gebied.' };
    const rij = (Array.isArray(lijst) ? lijst : []).map(String).filter(k => KENMERKEN.includes(k));
    kenmerken()[g.id] = rij;
    save();
    return { ok: true, gebied: g.id, naam: g.naam, kenmerken: rij, mogelijk: KENMERKEN };
  }

  // de stand van een meetsoort per zone, uit het geheugen van het weefsel
  function stand(sens) {
    zorgKenmerken();
    const M = METERS[sens];
    const uit = [];
    for (const z of geo.opNiveau('zone')) {
      const r = tr.reeks({ sens, gebied: z.id, laag: 'uur' });
      const laatste = r.punten.length ? r.punten[r.punten.length - 1] : null;
      const w = laatste ? laatste.gem : null;
      let niveau = 'stil';
      if (w != null) {
        const [a, b] = M.drempels;
        niveau = M.omgekeerd ? (w > a ? 'rustig' : w > b ? 'verhoogd' : 'kritiek')
          : (w < a ? 'rustig' : w < b ? 'verhoogd' : 'kritiek');
      }
      uit.push({ gebied: z.id, zone: z.naam, waarde: w, niveau, kenmerken: kenmerkenVan(z.id) });
    }
    return uit;
  }

  function beeld() {
    zorgKenmerken();
    const per = {};
    for (const sens of Object.keys(METERS)) per[sens] = { ...METERS[sens], zones: stand(sens) };
    const risico = geo.opNiveau('zone').map(z => ({ gebied: z.id, zone: z.naam, kenmerken: kenmerkenVan(z.id) }))
      .filter(x => x.kenmerken.length);
    return { status: 200, meters: per, risicozones: risico, kenmerken: KENMERKEN, scenarios: SCENARIOS,
      let_op: 'De metingen komen uit de eigen Stadsdozen; de risicozones zijn vastgelegde eigenschappen, geen hoogtemodel.' };
  }

  /* Een scenario doorrekenen. Drie lagen tegelijk: welke gebieden dragen het
     kenmerk dat erbij hoort, welke objecten van de betrokken soorten staan
     daar, en wat sleept er nog meer mee als een van die objecten uitvalt (via
     de afhankelijkheidsgraaf). Die derde laag is waar het interessant wordt:
     een gemaal dat wegvalt tijdens hoogwater is geen los ding. */
  function scenario({ naam, ernst }) {
    zorgKenmerken();
    const s = SCENARIOS[String(naam || '')];
    if (!s) return { status: 400, error: 'Kies een scenario: ' + Object.keys(SCENARIOS).join(', ') + '.' };
    const zwaar = String(ernst || 'normaal') === 'zwaar';
    const zones = geo.opNiveau('zone').filter(z => kenmerkenVan(z.id).includes(s.zoek));
    const geraakt = [];
    for (const z of zones) {
      for (const o of obj.zoek({ gebied: z.id })) {
        if (!s.soorten.includes(o.soort)) continue;
        const keten = zwaar ? afh.benedenstrooms(o.id).rij.length : 0;
        geraakt.push({ id: o.id, naam: o.naam, soort: o.soort, zone: z.naam, risico: o.risico,
          conditie: o.conditie, sleeptMee: keten,
          zorg: o.conditie >= 4 ? 'conditie ' + o.conditie + ': dit object staat er nu al slecht voor' : null });
      }
    }
    const kritiek = geraakt.filter(x => ['kritiek', 'hoog'].includes(x.risico));
    const metingen = s.meters.map(m => ({ meter: m, ...METERS[m],
      zones: stand(m).filter(x => x.niveau === 'verhoogd' || x.niveau === 'kritiek') }));
    return { status: 200, scenario: s.label, ernst: zwaar ? 'zwaar' : 'normaal',
      gevolg: s.gevolg, zones: zones.map(z => z.naam),
      geraakt: geraakt.sort((a, b) => b.sleeptMee - a.sleeptMee).slice(0, 100), aantal: geraakt.length,
      kritiek, nuVerhoogd: metingen,
      advies: klimaatAdvies(s, geraakt, kritiek, zones),
      let_op: 'Een berekening op het eigen register: welke objecten in welke risicozones als eerste onder druk staan. Geen weersverwachting en geen hydrologisch model.' };
  }

  function klimaatAdvies(s, geraakt, kritiek, zones) {
    const uit = [];
    if (!zones.length) return ['Geen enkele zone draagt het kenmerk "' + s.zoek + '"; leg dat eerst vast, anders rekent dit scenario over een lege stad.'];
    if (kritiek.length) uit.push(kritiek.length + ' kritiek of hoog-risico object(en) staan in de eerste ring: ' + kritiek.slice(0, 5).map(x => x.naam).join(', ') + '.');
    const slecht = geraakt.filter(x => x.conditie >= 4);
    if (slecht.length) uit.push(slecht.length + ' van de betrokken objecten heeft nu al conditie 4 of slechter; die zou ik vooraf nakijken.');
    const sleept = geraakt.filter(x => x.sleeptMee >= 5);
    if (sleept.length) uit.push(sleept[0].naam + ' sleept bij uitval ' + sleept[0].sleeptMee + ' andere objecten mee; dat is de zwaarste enkele afhankelijkheid in dit scenario.');
    if (!uit.length) uit.push('Er staan geen objecten van de betrokken soorten in de risicozones. Dat kan kloppen, of het register mist ze nog.');
    return uit;
  }

  // wat het rampbeeld hiervan wil weten: alleen de stand, geen persoonsgegevens
  function voorRampbeeld() {
    const zorgen = [];
    for (const sens of Object.keys(METERS))
      for (const z of stand(sens)) if (z.niveau === 'kritiek') zorgen.push({ meter: sens, zone: z.zone, waarde: z.waarde });
    return { meters: Object.keys(METERS).length, kritiek: zorgen, risicozones: geo.opNiveau('zone').filter(z => kenmerkenVan(z.id).length).length };
  }

  return {
    METERS, SCENARIOS, KENMERKEN, zorgKenmerken, stand, voorRampbeeld, kenmerkenVan,
    api: {
      weefselKlimaat: beeld,
      weefselKlimaatScenario: scenario,
      weefselKlimaatKenmerk: ({ gebied, lijst, wie }) => { void schoon(wie, 60); return kenmerkZet({ gebied, lijst }); }
    }
  };
};
