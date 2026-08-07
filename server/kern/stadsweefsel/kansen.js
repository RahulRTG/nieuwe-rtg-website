/* RTG Stadsweefsel, deel "kansen": onderwijs, werk en de lokale economie.

   Een stad wordt niet slimmer van efficiëntere lantaarnpalen. Ze wordt slimmer
   als inwoners makkelijker leren, werken en ondernemen. Die laag stond hier al
   -- alleen in stukken die elkaar niet kenden: vacatures bij de partners, de
   Beroepen-Bibliotheek bij de RTFoundation, panden nergens, en het werk aan de
   openbare ruimte in het weefsel.

   Dit deel maakt er verbindingen van, en het BOUWT MET OPZET GEEN NIEUWE
   REGISTERS voor dingen die al bestaan:

   - de vacatures komen uit kern/werk (dezelfde lijst die de leden-app toont),
     hier alleen op de kaart gelegd: hoeveel werk is er in welke wijk;
   - de beroepen komen uit de Beroepen-Bibliotheek (200 beroepen, en per beroep
     duizenden gratis leer-apps). Een tekort wordt zo meteen een LEERPAD in
     plaats van een cijfer in een rapport;
   - de bedrijven zijn de bestaande partners met hun eigen locatie;
   - het aankomende werk komt uit de onderhoudsplanning en de contracten.

   Wat WEL nieuw is, is de economische staat van een pand: leeg of in gebruik,
   hoeveel vierkante meter, welke huur. Het pand zelf is een object in het
   register (het staat ergens, het heeft een eigenaar en een conditie); dat het
   leegstaat is geen technische toestand maar een economische, en die woont
   hier. Dat is geen tweede waarheid maar een tweede vraag over hetzelfde ding.

   PRIVACY: hier komen bedrijven en beroepen langs, geen werkzoekenden. Er
   wordt geteld waar het WERK is, nooit wie er zoekt. Een stad die bijhoudt wie
   er in welke wijk werkloos is, bouwt iets anders dan een kansenlaag.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon, coordPaar } = require('../util');

module.exports = (ctx) => {
  const { d, save, nu, geo, obj, zkn, werk, ond, sim } = ctx;

  /* De naden naar de rest van het huis, laat gebonden: server.js hangt ze er
     na het opstarten aan. Zonder bron geeft deze laag eerlijk nul terug in
     plaats van te doen alsof er geen werk en geen bedrijven zijn. */
  let vacatureBron = null, bedrijfBron = null, beroepBron = null;
  function bronnenKoppel({ vacatures, bedrijven, beroepen }) {
    if (typeof vacatures === 'function') vacatureBron = vacatures;
    if (typeof bedrijven === 'function') bedrijfBron = bedrijven;
    if (typeof beroepen === 'function') beroepBron = beroepen;
  }
  const bronnenStaat = () => ({ vacatures: !!vacatureBron, bedrijven: !!bedrijfBron, beroepen: !!beroepBron });

  // alles wat een positie heeft, krijgt hier zijn plek in de stad; wat buiten
  // de stad ligt telt niet mee (en dat is geen fout, dat is een andere stad)
  function inStad(lijst) {
    const uit = [];
    for (const x of lijst || []) {
      const p = x.loc ? coordPaar(x.loc.lat, x.loc.lng) : null;
      if (!p) continue;
      const plek = geo.plaats(p.lat, p.lng);
      if (!plek.binnenStad) continue;
      uit.push({ ...x, gebied: plek.gebiedId, zone: plek.zone.id, zoneNaam: plek.zone.naam });
    }
    return uit;
  }
  const vacatures = () => (vacatureBron ? inStad(vacatureBron()) : []);
  const bedrijven = () => (bedrijfBron ? inStad(bedrijfBron()) : []);

  /* Waar is het werk? Per wijk geteld, met de beroepen erbij. Dit is de vraag
     die een wethouder stelt en die nergens te beantwoorden was, terwijl alle
     gegevens er lagen. */
  function werkKaart() {
    const rij = vacatures();
    const perWijk = {};
    for (const v of rij) {
      const wijk = geo.pad(v.gebied).find(g => g.niveau === 'wijk');
      const naam = wijk ? wijk.naam : 'onbekend';
      const r = perWijk[naam] || (perWijk[naam] = { wijk: naam, gebied: wijk ? wijk.id : null, vacatures: 0, bedrijven: 0, functies: {} });
      r.vacatures++;
      r.functies[v.func] = (r.functies[v.func] || 0) + 1;
    }
    for (const b of bedrijven()) {
      const wijk = geo.pad(b.gebied).find(g => g.niveau === 'wijk');
      const naam = wijk ? wijk.naam : 'onbekend';
      const r = perWijk[naam] || (perWijk[naam] = { wijk: naam, gebied: wijk ? wijk.id : null, vacatures: 0, bedrijven: 0, functies: {} });
      r.bedrijven++;
    }
    return Object.values(perWijk).sort((a, b) => b.vacatures - a.vacatures);
  }

  /* Van tekort naar leerpad. De functietekst van een vacature wordt tegen de
     200 beroepen uit de Beroepen-Bibliotheek gelegd; wat matcht, krijgt het
     aantal openstaande plekken en de wereld waarin het te leren valt.

     BEWUST GEEN SLIMME MATCHING. Een woordvergelijking die "Lasser" in
     "ervaren lasser (mig/mag)" herkent, is uitlegbaar; een AI die functietitels
     interpreteert, geeft een lijst die niemand kan narekenen en die bij elke
     modelwissel verandert. Wat niet matcht staat apart, zodat het gat zichtbaar
     is in plaats van weggewerkt. */
  function tekorten() {
    const rij = vacatures();
    const lijst = beroepBron ? beroepBron() : [];
    const per = {};
    const zonder = [];
    for (const v of rij) {
      const tekst = String(v.func || '').toLowerCase();
      let match = null;
      for (const b of lijst) {
        const naam = b.beroep.toLowerCase();
        if (!tekst.includes(naam)) continue;
        if (!match || naam.length > match.beroep.length) match = b;
      }
      if (!match) { zonder.push(v.func); continue; }
      const r = per[match.beroep] || (per[match.beroep] = { beroep: match.beroep, wereld: match.wereld,
        wereldLabel: match.wereldLabel, open: 0, bedrijven: new Set(), zones: new Set() });
      r.open++;
      r.bedrijven.add(v.bedrijf);
      r.zones.add(v.zoneNaam);
    }
    return {
      beroepen: Object.values(per).map(r => ({ beroep: r.beroep, wereld: r.wereld, wereldLabel: r.wereldLabel,
        open: r.open, bedrijven: [...r.bedrijven], zones: [...r.zones],
        leren: 'De Beroepen-Bibliotheek heeft een gratis leerpad voor ' + r.beroep + ' (wereld: ' + r.wereldLabel + ').' }))
        .sort((a, b) => b.open - a.open),
      zonderBeroep: [...new Set(zonder)].slice(0, 20)
    };
  }

  /* De ondernemerskant -- panden, leegstand, hinder, opdrachten en drukte --
     staat in ./ondernemers.js; dit bestand gaat over werk en beroepen. */
  const { panden, leegstand, pandZet, hinder, opdrachten, drukte } = require('./ondernemers')(ctx, bedrijven);

  function beeld() {
    obj.zorgObjecten();
    const t = tekorten();
    return { status: 200,
      bronnen: bronnenStaat(),
      werk: { vacatures: vacatures().length, bedrijven: bedrijven().length, perWijk: werkKaart() },
      tekorten: t.beroepen.slice(0, 10), zonderBeroep: t.zonderBeroep,
      leegstand: leegstand().slice(0, 20),
      opdrachten: opdrachten().slice(0, 10),
      hinder: hinder().slice(0, 10),
      let_op: !vacatureBron ? 'De vacaturebron is niet gekoppeld; de werkcijfers staan daarom op nul en niet op "geen werk".'
        : 'Vacatures en bedrijven komen uit het platform zelf; hier wordt geteld waar het WERK is, nooit wie er zoekt.' };
  }

  return {
    bronnenKoppel, werkKaart, tekorten, leegstand, hinder, opdrachten, panden,
    api: {
      weefselKansen: beeld,
      weefselTekorten: () => ({ status: 200, ...tekorten(), bronnen: bronnenStaat() }),
      weefselLeegstand: () => ({ status: 200, aantal: leegstand().length, panden: leegstand() }),
      weefselPandZet: pandZet,
      weefselHinder: ({ gebied } = {}) => ({ status: 200, aantal: hinder({ gebied }).length, hinder: hinder({ gebied }) }),
      weefselOpdrachten: () => ({ status: 200, opdrachten: opdrachten() }),
      weefselDrukte: drukte
    }
  };
};
