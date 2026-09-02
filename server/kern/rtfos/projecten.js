/* Foundation OS, deel "projecten": het centrale object van de uitvoering.

   Een project hangt altijd aan EEN stad en (bijna altijd) aan EEN
   partnerstichting. Dat is geen administratieve smaak: het bepaalt wie de
   vrijwilligers aanstuurt, wie de persoonsgegevens ziet en wie aansprakelijk
   is -- de vier afspraken uit het partnerdossier. Een project zonder stad zou
   die hele keten losknippen.

   DE STATUSKETEN IS EEN KETEN, GEEN KEUZELIJST. Van "idee" naar "actief"
   springen betekent: een project dat nooit beoordeeld is, geeft geld uit. De
   toegestane overgangen staan daarom als tabel, en alles wat er niet in staat
   wordt geweigerd met de reden erbij.

   GOEDKEUREN DOET EEN ANDER DAN AANVRAGEN. Vierogen op het project zelf, niet
   alleen op de betaling: wie het project indient, kan het niet zelf
   goedkeuren, ook niet als hij daar op papier de bevoegdheid voor heeft. En
   boven de goedkeuringslimiet van de eigen rol moet het landelijke bestuur
   eraan te pas komen -- hetzelfde getal als bij de uitgaven, uit dezelfde
   functie (basis.js: limietVan), zodat de twee nooit uit elkaar lopen. */

const STATUS = ['idee', 'aanvraag', 'beoordeling', 'goedgekeurd', 'actief',
  'gepauzeerd', 'afgerond', 'afgekeurd', 'gestopt'];

// Wat mag na wat. Een lege lijst is een eindpunt.
const KETEN = {
  idee: ['aanvraag', 'gestopt'],
  aanvraag: ['beoordeling', 'gestopt'],
  beoordeling: ['goedgekeurd', 'afgekeurd', 'aanvraag'],
  goedgekeurd: ['actief', 'gestopt'],
  actief: ['gepauzeerd', 'afgerond', 'gestopt'],
  gepauzeerd: ['actief', 'gestopt', 'afgerond'],
  afgerond: [], afgekeurd: ['aanvraag'], gestopt: []
};

/* De soorten werk die RTF doet, met de module waar ze onder vallen. Staat die
   module uit in een stad, dan kan het project daar niet worden aangemaakt --
   dat is wat "modules per stad" moet betekenen om iets waard te zijn. */
const SOORTEN = {
  jongeren: 'youth_programs', huiswerk: 'youth_programs', sport: 'youth_programs',
  maaltijden: 'food_distribution', voedsel: 'food_distribution',
  kleding: 'clothing_distribution', schoolspullen: 'clothing_distribution',
  ouderen: 'elderly_support', eenzaamheid: 'elderly_support',
  vervoer: 'transport_support', taal: 'city_projects', schuldhulp: 'city_projects',
  werk: 'city_projects', digitaal: 'city_projects', noodfonds: 'emergency_fund',
  evenement: 'events', ondernemers: 'business_sponsorships',
  /* Duurzaamheid als eigen soort werk, onder de stadsprojecten. Het Klimaatfonds
     toonde tot nu toe alleen VRAGEN uit het Living Lab (soort 'duurzaam' daar);
     wat ontbrak was de andere helft -- het werk dat eruit voortkomt, en dus iets
     om een gift aan vast te zetten. Onder city_projects en niet onder een eigen
     modulevlag: een stad die stadsprojecten aan heeft staan, kan dit werk doen. */
  duurzaam: 'city_projects', overig: 'city_projects'
};

module.exports = (ctx) => {
  const { nu, rid, schoon, naarCenten, euro, S, audit, wie, rolIn, magRecht, poort, stadVan, limietVan, save } = ctx;

  const vind = id => S().projecten.find(p => p.id === String(id || '')) || null;
  const beeld = p => ({ id: p.id, stad: p.stad, stadNaam: (stadVan(p.stad) || {}).naam || null,
    partnerId: p.partnerId, naam: p.naam, soort: p.soort, doelgroep: p.doelgroep, doel: p.doel,
    van: p.van, tot: p.tot, budget: euro(p.budgetCenten), financiering: p.financiering,
    leider: p.leiderNaam, status: p.status, besluit: p.besluit || null,
    activiteiten: (p.activiteiten || []).slice(0, 50), indicatoren: p.indicatoren || [],
    risicos: p.risicos || [], vrijwilligers: (p.vrijwilligers || []).length,
    deelnemersUniek: Number(p.deelnemersUniek) || 0, bewijs: (p.bewijs || []).slice(0, 30),
    rapportages: (p.rapportages || []).slice(0, 20), at: p.at });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    return { ok: true, statussen: STATUS, keten: KETEN, soorten: Object.keys(SOORTEN),
      projecten: S().projecten.filter(p => p.stad === g.stad.id).map(beeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const soort = String(b.soort || 'overig');
    const vlag = SOORTEN[soort];
    if (!vlag) return { status: 400, error: 'Kies een soort (' + Object.keys(SOORTEN).join(', ') + ').' };
    const g = poort(w, b.stad, 'project.beheren', vlag);
    if (!g.ok) return g;
    const naam = schoon(b.naam, 120);
    if (naam.length < 3) return { status: 400, error: 'Hoe heet dit project?' };
    const budget = naarCenten(b.budget === undefined ? 0 : b.budget);
    if (budget === null) return { status: 400, error: 'Wat is het budget? Nul mag ook.' };
    if (S().projecten.length >= 20000) return { status: 400, error: 'Het projectregister zit vol.' };
    let partnerId = schoon(b.partnerId, 20) || null;
    if (partnerId) {
      const pt = S().partners.find(x => x.id === partnerId);
      if (!pt || pt.stad !== g.stad.id) return { status: 400, error: 'Die partnerstichting hoort niet bij deze stad.' };
      if (pt.status !== 'actief') return { status: 400, error: 'Deze partner staat op "' + pt.status + '"; alleen een actieve partner draagt een project.' };
    }
    const p = { id: rid(), stad: g.stad.id, partnerId, naam, soort, vlag,
      doelgroep: schoon(b.doelgroep, 120), doel: schoon(b.doel, 400),
      van: schoon(b.van, 10) || null, tot: schoon(b.tot, 10) || null,
      budgetCenten: budget, financiering: schoon(b.financiering, 60) || 'nog onbekend',
      leiderKey: w.key, leiderNaam: schoon(b.leider, 60) || w.key,
      status: 'idee', besluit: null, activiteiten: [], indicatoren: [], risicos: [],
      vrijwilligers: [], deelnemersUniek: 0, bewijs: [], rapportages: [], at: nu() };
    S().projecten.push(p);
    audit(w.key, 'project.maak', naam, 'stad ' + g.stad.naam + ', budget ' + euro(budget));
    save();
    return { ok: true, project: beeld(p) };
  }

  function zet(req, id, b) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'project.beheren', p.vlag);
    if (!g.ok) return g;
    b = b || {};
    if (p.status === 'afgerond' || p.status === 'gestopt') {
      return { status: 400, error: 'Een afgerond of gestopt project wijzigt niet meer.' };
    }
    for (const veld of ['naam', 'doelgroep', 'financiering']) if (b[veld] !== undefined) p[veld] = schoon(b[veld], 120);
    if (b.doel !== undefined) p.doel = schoon(b.doel, 400);
    if (b.leider !== undefined) p.leiderNaam = schoon(b.leider, 60);
    for (const d of ['van', 'tot']) if (b[d] !== undefined) p[d] = schoon(b[d], 10) || null;
    if (b.budget !== undefined) {
      const c = naarCenten(b.budget);
      if (c === null) return { status: 400, error: 'Wat is het budget?' };
      /* Een budgetverhoging na goedkeuring is een nieuw besluit, geen wijziging:
         anders keurt de stad 2.000 euro goed en staat er de volgende dag 40.000.
         Het project valt terug op beoordeling. */
      if (c > p.budgetCenten && ['goedgekeurd', 'actief', 'gepauzeerd'].includes(p.status)) {
        p.status = 'beoordeling';
        p.besluit = null;
        audit(w.key, 'project.herbeoordeling', p.naam, 'budget omhoog naar ' + euro(c));
      }
      p.budgetCenten = c;
    }
    if (Array.isArray(b.risicos)) p.risicos = b.risicos.map(x => schoon(x, 160)).filter(Boolean).slice(0, 20);
    save();
    return { ok: true, project: beeld(p) };
  }

  /* De statusovergang staat in ./projecten-besluit.js: dat is de plek waar de
     keten, de vierogen en de goedkeuringslimiet samenkomen, en dit bestand liep
     tegen de 10 KB van keuringsregel 13. */
  const besluit = require('./projecten-besluit')(ctx, { vind, beeld, STATUS, KETEN });

  const werk = require('./projecten-werk')(ctx, { vind, beeld });

  return { lijst, maak, zet, status: besluit.status, vind, beeld, activiteit: werk.activiteit,
    indicatorZet: werk.indicatorZet, bewijsMaak: werk.bewijsMaak, rapportage: werk.rapportage,
    deelnemers: werk.deelnemers, STATUS, KETEN, SOORTEN };
};
module.exports.STATUS = STATUS;
module.exports.KETEN = KETEN;
module.exports.SOORTEN = SOORTEN;
