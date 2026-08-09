/* De health timeline: wat er in de tijd met u gebeurd is, op een rij.

   HIJ BEZIT NIETS, net als de dagcoach en kern/life.js. Elke regel komt uit een
   laag die het lid al had; er wordt hier niets vastgelegd en niets afgeleid.
   Dat is geen bescheidenheid maar de enige vorm die klopt: een tijdlijn die zelf
   ging bewaren, wordt een tweede dossier naast de lagen waar het vandaan kwam
   (LAT.md regel 4) -- en juist bij gezondheid is een tweede dossier dat uit de
   pas loopt het probleem dat je wilt vermijden.

   WAT ER DAAROM NIET IN STAAT:
   - Verbanden. "Uw slaap werd slechter na die behandeling" is een medische
     uitspraak, en die doet RTG niet (kern/zorgniveau.js). De tijdlijn zet dingen
     naast elkaar; wat dat betekent, bepaalt u met iemand die u kent.
   - Een gezondheidsscore over de tijd. Er is geen getal dat "hoe het met u gaat"
     samenvat, en een lijn door verzonnen punten is een grafiek van niets.
   - Wat u niet zelf heeft. Er staat alleen in wat in uw eigen lagen zit; er
     wordt nergens iets opgehaald wat u niet al kon zien.

   ELKE REGEL DRAAGT ZIJN HERKOMST. Niet als versiering: het verschil tussen "u
   vulde dit zelf in", "uw toestel mat het" en "uw behandelaar legde het vast" is
   bij terugkijken het hele verhaal. */

const dagVan = d => new Date(d).toISOString().slice(0, 10);
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/* Waar een regel vandaan komt en waar het lid hem terugvindt. Enige plek waar
   een soort een naam en een bestemming krijgt. */
const SOORTEN = {
  zorg: { naam: 'Zorg', naar: '/apps/app.html' },
  verzorging: { naam: 'Verzorging', naar: '/apps/app.html' },
  meting: { naam: 'Dagmetingen', naar: '/apps/life.html' },
  doel: { naam: 'Doelen', naar: '/apps/doelen.html' },
  toestel: { naam: 'Toestellen', naar: '/apps/life.html' }
};

module.exports = ({ kern }) => {
  /* Zelfde vorm als kern/life.js en kern/dagcoach.js: elke laag apart, en een
     kapotte laag wordt gemeld en niet als leegte getoond (regel 5). Bij een
     tijdlijn weegt dat extra: een gat leest hier als "toen gebeurde er niets". */
  function lees(naam, fn) {
    if (typeof fn !== 'function') return { fout: 'De laag ' + naam + ' is niet aangesloten.' };
    try { return { waarde: fn() }; } catch (e) { return { fout: 'De laag ' + naam + ' gaf een fout.' }; }
  }

  function tijdlijnVoor(key, codenaam, nu = new Date()) {
    const vandaag = dagVan(nu);
    const rijen = [];
    const storingen = [];
    const zet = r => rijen.push({ ...r, ...SOORTEN[r.soort] });

    /* ---- afspraken: zorg en verzorging, alleen wat al GEWEEST is ----
       Wat nog komt staat in de dagcoach en op Life; een tijdlijn die de toekomst
       meeneemt, is een agenda die zich voordoet als geschiedenis. */
    const zorg = lees('Zorg', kern.careMijn && (() => kern.careMijn(key)));
    const verz = lees('Verzorging', kern.verzorgingLeden && (() => kern.verzorgingLeden.mijn(codenaam)));
    if (zorg.fout) storingen.push(zorg.fout);
    if (verz.fout) storingen.push(verz.fout);
    for (const b of ((zorg.waarde && zorg.waarde.boekingen) || []).filter(b => b.datum <= vandaag)) {
      zet({ soort: 'zorg', op: b.datum, wat: b.behandelingNaam,
        waar: b.aanbiederNaam, herkomst: 'behandelaar' });
    }
    for (const a of ((verz.waarde && verz.waarde.afspraken) || []).filter(a => a.datum <= vandaag)) {
      zet({ soort: 'verzorging', op: a.datum, wat: a.behandeling, waar: a.salon, herkomst: 'zelf' });
    }

    /* ---- doelen: begin, streefdatum en of het gehaald is ---- */
    const dl = lees('Doelen', kern.doelenVan && (() => kern.doelenVan(key, nu)));
    if (dl.fout) storingen.push(dl.fout);
    for (const d of (dl.waarde && dl.waarde.doelen) || []) {
      const begon = (d.nulmeting && d.nulmeting.op) || (d.gemaakt || '').slice(0, 10);
      if (begon) zet({ soort: 'doel', op: begon, wat: 'Begonnen: ' + d.titel, waar: d.reden || '', herkomst: 'zelf' });
      if (d.gehaald && d.gehaaldOp) {
        zet({ soort: 'doel', op: d.gehaaldOp, wat: 'Gehaald: ' + d.titel, waar: '', herkomst: 'zelf' });
      }
    }

    /* ---- toestellen: gekoppeld en ingetrokken ----
       Dit hoort in een gezondheidstijdlijn omdat het uitlegt WAAROM er in een
       bepaalde periode wel of geen metingen staan. */
    const t = lees('Toestellen', kern.toestellenVan && (() => kern.toestellenVan(key)));
    if (t.fout) storingen.push(t.fout);
    for (const x of (t.waarde && t.waarde.toestellen) || []) {
      if (x.gekoppeldOp) {
        zet({ soort: 'toestel', op: dagVan(x.gekoppeldOp), wat: x.naam + ' gekoppeld',
          waar: 'schrijft dagmetingen weg', herkomst: 'zelf' });
      }
    }

    /* ---- metingen door een BEHANDELAAR ----
       De dagmetingen die het lid zelf invult staan er met opzet NIET in: dat
       zijn er honderden en ze maken van een tijdlijn een logboek. Wat een
       behandelaar vastlegde is wel een gebeurtenis -- er stond een mens bij. */
    const mt = lees('Metingen', kern.metingenVan && (() => kern.metingenVan(key, nu)));
    const hist = lees('Metingen-historie', kern.metingenHistorie
      && (() => kern.metingenHistorie(key, { bron: 'behandelaar' })));
    if (mt.fout) storingen.push(mt.fout);
    if (hist.fout) storingen.push(hist.fout);
    const onderwerpen = (mt.waarde && mt.waarde.onderwerpen) || {};
    for (const r of hist.waarde || []) {
      const def = onderwerpen[r.onderwerp] || {};
      zet({ soort: 'meting', op: r.op, wat: def.label || r.onderwerp,
        waar: r.waarde + (def.eenheid ? ' ' + def.eenheid : '') + (r.door ? ', door ' + r.door : ''),
        herkomst: 'behandelaar' });
    }

    rijen.sort((a, b) => (b.op || '').localeCompare(a.op || ''));

    /* Op maand gegroepeerd, nieuwste eerst. Een platte lijst van honderd regels
       leest niemand terug; een maandkop maakt er een verhaal van. */
    const maanden = [];
    for (const r of rijen) {
      const sleutel = (r.op || '').slice(0, 7);
      let m = maanden.find(x => x.maand === sleutel);
      if (!m) {
        const [jaar, mnd] = sleutel.split('-');
        m = { maand: sleutel, label: (MAANDEN[Number(mnd) - 1] || sleutel) + ' ' + jaar, regels: [] };
        maanden.push(m);
      }
      m.regels.push(r);
    }

    return {
      ok: true, vandaag, maanden, aantal: rijen.length,
      leeg: !rijen.length,
      uitleg: 'Alles hier komt uit een laag die u al had; deze tijdlijn legt zelf niets vast. '
        + 'Er staan geen verbanden in en geen score: dingen naast elkaar zetten is iets anders '
        + 'dan zeggen wat ze betekenen.',
      storingen
    };
  }

  return { tijdlijnVoor };
};

module.exports.SOORTEN = SOORTEN;
