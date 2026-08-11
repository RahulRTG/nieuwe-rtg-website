/* RTG Werk OS (deellaag): WAAROM loopt dit project achter?

   "Dit project loopt achter. Waarom?" is de vraag waar een dashboard normaal
   ophoudt en een mens begint met gokken. Deze laag beantwoordt hem, en de hele
   waarde zit in wat hij WEIGERT te doen.

   1. DE OORZAAK WORDT GEMETEN, NIET GERADEN. Elke bevinding hieronder is een
      getal uit de administratie met de rijen erbij. Er zit geen taalmodel
      tussen: de zinnen komen uit dezelfde code die het getal uitrekent, want
      een verklaring die iets anders zegt dan het cijfer waar hij op leunt, is
      precies wat iemand leert om geen van beide te geloven.
   2. HET GEDEELDE PATROON KOMT UIT kern/command/oorzaak.js, dat er al was. Die
      module zoekt zelf het veld dat de gevallen het strakst clustert -- "acht
      van de tien late taken staan op naam van dezelfde persoon" -- en zegt het
      als hij NIETS vindt dat bijna alles verklaart. Dat is beter dan een
      relatietabel die na twee maanden het verkeerde aanwijst, en het is dezelfde
      meting die RTG Command gebruikt. Er komt hier geen tweede naast.
   3. WAT DIT HUIS NIET WEET, STAAT ER ALS NIET GEMETEN. Het voorbeeld dat bij
      deze vraag altijd genoemd wordt is "de leverancier wacht" -- en dat is
      precies iets wat hier NERGENS staat: een project kent geen leverancier, en
      een taak kent geen externe blokkade. Die regel verzinnen zou de rest van
      dit antwoord waardeloos maken. Hij staat dus met naam bij `nietGemeten`,
      met wat er zou moeten bestaan om hem wel te kunnen meten.
   4. VOORTGANG WORDT NIET OPNIEUW UITGEREKEND. `voortgang()` uit
      bedrijf/project.js is de bron; twee plekken die hetzelfde percentage
      berekenen, lopen uiteen (LAT-regel 4). */
'use strict';

const { groepeer } = require('../kern/command/oorzaak');

/* Wat er over een project NIET te meten valt, met de reden. Deze lijst is geen
   disclaimer maar een werklijst: zodra een van deze dingen wel wordt
   vastgelegd, hoort hij hier weg en als bevinding terug. */
const NIET_GEMETEN = [
  { wat: 'een leverancier of externe partij die het project ophoudt',
    reden: 'een project kent in deze laag geen leverancier, en een taak kent geen externe blokkade -- alleen "wacht op" naar een ANDERE taak' },
  { wat: 'de reden waarom een taak stilstaat',
    reden: 'er wordt geen doorlooptijd per kolom bijgehouden; dat zou een meting per verplaatsing vragen die er niet is' },
  { wat: 'of het team te klein is',
    reden: 'er is geen capaciteit per mens vastgelegd, alleen geschreven uren achteraf' }
];

/* Welke velden van een late taak mogen een oorzaak zijn. Bewust kort: de titel
   en de datum clusteren niets, ze verdelen alleen. */
const OORZAAKVELDEN = ['wie', 'kolom', 'prioriteit'];

/* HET PATROON, EN WAAROM DIT TWEE VRAGEN ZIJN.

   kern/command/oorzaak.js zoekt het veld dat de gevallen het STRAKST CLUSTERT,
   en slaat daarbij een veld over waarin alle gevallen dezelfde waarde hebben --
   in zijn eigen context (een storingslijst groeperen) onderscheidt zo'n veld
   immers niets. Hier is dat juist het sterkste signaal dat er is: als alle tien
   de late taken op naam van dezelfde persoon staan, is dat het antwoord.

   Dus twee vragen, in deze volgorde, en allebei gemeten: staat er een veld waar
   ALLES hetzelfde is, en zo niet, wat clustert het strakst? De gedeelde module
   wordt daarvoor niet verbouwd -- hij beantwoordt de tweede vraag prima, en zijn
   gedrag veranderen zou de operator van RTG Command meeslepen. */
function patroonVan(gevallen) {
  for (const veld of OORZAAKVELDEN) {
    const waarden = new Set(gevallen.map(t => String(t[veld] || '')));
    if (waarden.size === 1 && [...waarden][0] && gevallen.length > 1) {
      return 'alle ' + gevallen.length + ' delen dezelfde ' + veld + ': "' + [...waarden][0] + '"';
    }
  }
  const grp = groepeer(gevallen.map(t => ({
    rij: OORZAAKVELDEN.reduce((o, k) => Object.assign(o, { [k]: t[k] || '' }), {}) })));
  const grootste = (grp.groepen || [])[0];
  return grootste && grootste.aantal > 1
    ? grootste.aantal + ' van de ' + gevallen.length + ' delen dezelfde ' + grp.veld + ': "' + grootste.waarde + '"'
    : 'geen gedeeld patroon: deze taken hebben geen veld gemeen dat ze samen verklaart';
}

module.exports = (sctx) => {
  const { app, dag, werkPoort, eigenVeld } = sctx;

  app.post('/api/bedrijf/project/waarom', (req, res) => {
    const g = werkPoort(req, res, 'project'); if (!g) return;
    const p = eigenVeld(sctx.PROJECTEN(g.w), String(req.body.projectId || ''));
    if (!p) return res.status(404).json({ error: 'Dat project kennen we niet.' });

    const taken = sctx.takenVan(g.w, p.id);
    const v = sctx.voortgang(g.w, p);
    const bevindingen = [];

    /* 1. Taken over hun deadline, met het gedeelde patroon erbij. `groepeer`
       zegt zelf of hij een oorzaak vond; vindt hij niets, dan staat dat er. */
    const teLaat = taken.filter(t => t.kolom !== 'klaar' && t.deadline && t.deadline < dag());
    if (teLaat.length) {
      bevindingen.push({ wat: 'taken over hun deadline', aantal: teLaat.length, van: taken.length,
        patroon: patroonVan(teLaat),
        rijen: teLaat.slice(0, 8).map(t => ({ id: t.id, titel: t.titel, deadline: t.deadline, wie: t.wie })) });
    }

    /* 2. Taken die wachten op iets dat niet af is. Dit is de enige echte
       afhankelijkheid die deze laag KENT, en hij is hard: de wachtOp-lijst is
       bij het aanmaken op cirkels gecontroleerd. */
    const open = new Set(taken.filter(t => t.kolom !== 'klaar').map(t => t.id));
    const geblokkeerd = taken.filter(t => t.kolom !== 'klaar' && (t.wachtOp || []).some(x => open.has(x)));
    if (geblokkeerd.length) {
      bevindingen.push({ wat: 'taken die wachten op werk dat nog niet af is', aantal: geblokkeerd.length,
        patroon: 'dit is de enige afhankelijkheid die deze laag kent: een taak die op een ANDERE taak wacht',
        rijen: geblokkeerd.slice(0, 8).map(t => ({ id: t.id, titel: t.titel,
          wachtOp: (t.wachtOp || []).filter(x => open.has(x)).length })) });
    }

    /* 3. Budget. Kosten = geschreven uren maal het uurtarief van dit project;
       geen schatting en geen prognose. Zonder budget is er niets om aan te
       toetsen, en dan staat er geen percentage in plaats van een nul. */
    if (v.budgetCenten) {
      const pct = Math.round(v.kostenCenten / v.budgetCenten * 100);
      bevindingen.push({ wat: 'budget', aantal: pct, eenheid: '% van het budget verbruikt',
        patroon: v.overBudget
          ? 'er is ' + (v.overBudget / 100) + ' euro meer geschreven dan begroot'
          : 'binnen budget: ' + (v.kostenCenten / 100) + ' van ' + (v.budgetCenten / 100) + ' euro',
        rijen: [] });
    }

    /* 4. Mijlpalen waarvan de datum voorbij is en die niet gehaald zijn. */
    const gemist = (p.mijlpalen || []).filter(m => !m.gehaald && m.datum && m.datum < dag());
    if (gemist.length) {
      bevindingen.push({ wat: 'mijlpalen waarvan de datum voorbij is', aantal: gemist.length,
        patroon: 'een mijlpaal wordt afgevinkt door een mens; deze staan nog open',
        rijen: gemist.map(m => ({ naam: m.naam, datum: m.datum })) });
    }

    /* 5. Wat een mens zelf als risico noteerde. Apart gehouden van de metingen
       hierboven: dat is een verwachting en geen waarneming, en door elkaar
       getoond krijgt het geheel de hardheid van het zwakste deel. */
    const risicos = (p.risicos || []).map(r => ({ wat: r.wat, kans: r.kans, eigenaar: r.eigenaar }));

    const eindVoorbij = p.eind && p.eind < dag() && p.status === 'loopt';
    res.json({ ok: true,
      project: { id: p.id, naam: p.naam, status: p.status, eind: p.eind, eindVoorbij: !!eindVoorbij },
      voortgang: { deel: v.deel, taken: v.taken, klaar: v.klaar, let: v.let },
      bevindingen,
      genoteerdeRisicos: risicos,
      nietGemeten: NIET_GEMETEN,
      let: bevindingen.length
        ? 'Elke bevinding is geteld uit de administratie, en het patroon is gemeten met dezelfde module die RTG Command gebruikt -- niet met een tabel die zegt wat wat verklaart. Wat hieronder bij nietGemeten staat, is geen voorbehoud maar een werklijst: zolang het er staat, kan dit antwoord die oorzaak niet zien.'
        : 'Er is niets gevonden dat dit project ophoudt. Dat is een uitslag en geen geruststelling: kijk bij nietGemeten wat deze laag sowieso niet kan zien.' });
  });

  return { PROJECTNIETGEMETEN: NIET_GEMETEN };
};
