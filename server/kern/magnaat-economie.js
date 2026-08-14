/* Magnaat Economische Motor v1.

   De motor is server-authoritatief, deterministisch en volledig synthetisch.
   Hij gebruikt dubbel boekhouden voor iedere geldstroom en verklaart welke
   reele economische regels een uitkomst veroorzaakten. RTG-opdrachten leveren
   operationele kwaliteit; ze maken nooit rechtstreeks gratis geld.

   Bedragen zijn gehele eurocenten. Een journaalpost wordt alleen verwerkt als
   debet exact gelijk is aan credit. Daardoor kunnen UI, tests en toekomstige
   exports dezelfde controleerbare bron gebruiken. */

const VERSIE = 1;
const STARTDATUM = '2027-01-01';
const MAX_HISTORIE = 180;
const MAX_JOURNAAL = 2500;

const SCHOKKEN = [
  { id: 'geen', naam: 'Normale marktdag', uitleg: 'Geen buitengewone verstoring.', vraag: 1, aanbod: 1, arbeid: 1 },
  { id: 'vraagpiek', naam: 'Internationale vraagpiek', uitleg: 'De vraag groeit sneller dan de beschikbare servicecapaciteit.', vraag: 1.28, aanbod: 1, arbeid: .94 },
  { id: 'leveranciersuitval', naam: 'Leveranciersuitval', uitleg: 'Een ketenpartner kan tijdelijk maar een deel van de bestellingen leveren.', vraag: 1.02, aanbod: .52, arbeid: 1 },
  { id: 'arbeidstekort', naam: 'Krappe arbeidsmarkt', uitleg: 'Vacatures zijn moeilijker te vullen en lonen staan onder opwaartse druk.', vraag: 1.04, aanbod: .94, arbeid: .43 }
];

const BEDRIJF_START = {
  rtg: {
    naam: 'RTG', personeel: 42, personeelDoel: 42, loonMaand: 385000,
    prijs: 12900, kwaliteit: 82, reputatie: 79, voorraad: 1200,
    bestelling: 620, basisProductiviteit: 15.5, vasteCapaciteit: 240,
    trainingDag: 450000, impactBp: 180, cash: 250000000
  },
  praktijk: {
    naam: 'Praktijkbedrijf', personeel: 18, personeelDoel: 18, loonMaand: 342500,
    prijs: 10900, kwaliteit: 68, reputatie: 61, voorraad: 520,
    bestelling: 280, basisProductiviteit: 14, vasteCapaciteit: 80,
    trainingDag: 125000, impactBp: 80, cash: 65000000
  }
};

const OPENINGSKAS = {
  huishoudens: 900000000,
  leverancier: 120000000,
  bank: 1200000000,
  overheid: 800000000,
  rtf: 50000000
};

const rond = n => Math.round(Number(n) || 0);
const begrens = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
const geld = n => rond(n);
const som = waarden => waarden.reduce((t, n) => t + rond(n), 0);

function datumOpDag(dag) {
  const datum = new Date(STARTDATUM + 'T12:00:00.000Z');
  datum.setUTCDate(datum.getUTCDate() + dag);
  return datum.toISOString().slice(0, 10);
}

function kopieBedrijf(id, bron) {
  return Object.assign({
    id, schuld: 0, omzetVandaag: 0, kostenVandaag: 0, winstVandaag: 0,
    verkopenVandaag: 0, capaciteitVandaag: 0, vraagVandaag: 0,
    productiviteit: bron.basisProductiviteit, benutting: 0, levergraad: 100
  }, bron);
}

module.exports = ({ wereldState, save = () => {} }) => {
  if (typeof wereldState !== 'function') throw new Error('Magnaat Economie vereist wereldState().');

  function nieuweState() {
    return {
      versie: VERSIE, startdatum: STARTDATUM, dag: 0, boekVolgorde: 0,
      rekeningen: {}, journaal: [], verwerkteBoekingen: {}, commandos: {},
      bedrijven: {
        rtg: kopieBedrijf('rtg', BEDRIJF_START.rtg),
        praktijk: kopieBedrijf('praktijk', BEDRIJF_START.praktijk)
      },
      macro: {
        beroepsbevolking: 80, leverancierPersoneel: 14, werkloosheid: 7.5,
        inflatie: 2.1, rente: 2.4, prijsindex: 100, bbpVandaag: 0,
        consumentenvertrouwen: 100, vraagIndex: 100, aanbodIndex: 100
      },
      werk: { aantal: 0, productiviteit: 0, service: 0, controle: 0, impact: 0, innovatie: 0, bronnen: [] },
      geforceerdeSchok: null, actieveSchok: SCHOKKEN[0],
      verklaringen: [], historie: [], audit: [],
      instellingen: {
        prijsElasticiteit: 1.35, vennootschapsbelastingBp: 2580,
        basisVraag: 920, eenhedenPerDienst: 1, inkoopPerEenheid: 2800
      },
      geinitialiseerd: false
    };
  }

  function state() {
    const wereld = wereldState();
    if (!wereld.economie || wereld.economie.versie !== VERSIE) wereld.economie = nieuweState();
    const e = wereld.economie;
    if (!e.geinitialiseerd) initialiseer(e);
    return e;
  }

  function rekening(e, code, actor, naam, soort, normaal) {
    if (!e.rekeningen[code]) e.rekeningen[code] = {
      code, actor, naam, soort, normaal: normaal || (['actief', 'kosten'].includes(soort) ? 'debet' : 'credit'),
      saldo: 0
    };
    return e.rekeningen[code];
  }

  function regel(rekeningCode, actor, naam, soort, kant, bedrag) {
    const r = { rekening: rekeningCode, actor, naam, soort, debet: 0, credit: 0 };
    r[kant] = geld(bedrag);
    return r;
  }

  function boek(e, sleutel, omschrijving, regels, labels = []) {
    sleutel = String(sleutel || '').slice(0, 160);
    if (!sleutel) throw new Error('Een economische boeking vereist een idempotentiesleutel.');
    if (e.verwerkteBoekingen[sleutel]) {
      return e.journaal.find(j => j.id === e.verwerkteBoekingen[sleutel]) || null;
    }
    const schoon = regels.filter(r => geld(r.debet) > 0 || geld(r.credit) > 0).map(r => Object.assign({}, r, {
      debet: geld(r.debet), credit: geld(r.credit)
    }));
    const debet = som(schoon.map(r => r.debet));
    const credit = som(schoon.map(r => r.credit));
    if (!schoon.length || debet !== credit) {
      throw new Error('Ongebalanceerde journaalpost geweigerd: ' + omschrijving + ' (' + debet + ' / ' + credit + ').');
    }
    for (const lijn of schoon) {
      const normaal = ['actief', 'kosten'].includes(lijn.soort) ? 'debet' : 'credit';
      const r = rekening(e, lijn.rekening, lijn.actor, lijn.naam, lijn.soort, normaal);
      r.saldo += lijn.debet - lijn.credit;
    }
    e.boekVolgorde += 1;
    const post = {
      id: 'MJ-' + String(e.dag).padStart(4, '0') + '-' + String(e.boekVolgorde).padStart(5, '0'),
      sleutel, dag: e.dag, datum: datumOpDag(e.dag), omschrijving,
      bedrag: Math.max(...schoon.map(r => Math.max(r.debet, r.credit))),
      debet, credit, regels: schoon, labels: labels.slice(0, 8)
    };
    e.journaal.unshift(post);
    if (e.journaal.length > MAX_JOURNAAL) e.journaal.length = MAX_JOURNAAL;
    e.verwerkteBoekingen[sleutel] = post.id;
    return post;
  }

  function openingspost(e, actor, naam, bedrag) {
    boek(e, 'opening:' + actor, 'Openingsbalans ' + naam, [
      regel(actor + '.kas', actor, 'Bank en kas', 'actief', 'debet', bedrag),
      regel(actor + '.eigen-vermogen', actor, 'Openingsvermogen', 'eigen-vermogen', 'credit', bedrag)
    ], ['opening']);
  }

  function initialiseer(e) {
    openingspost(e, 'rtg', 'RTG', e.bedrijven.rtg.cash);
    openingspost(e, 'praktijk', 'Praktijkbedrijf', e.bedrijven.praktijk.cash);
    for (const [actor, bedrag] of Object.entries(OPENINGSKAS)) openingspost(e, actor, actor, bedrag);
    e.geinitialiseerd = true;
    e.verklaringen.unshift({
      dag: 0, soort: 'fundament', titel: 'Economische wereld geopend',
      uitleg: 'Alle beginsaldi zijn dubbel geboekt. Vanaf nu ontstaat iedere euro uit een gebalanceerde transactie.'
    });
    neemMoment(e);
  }

  function saldo(e, code) {
    return e.rekeningen[code] ? rond(e.rekeningen[code].saldo) : 0;
  }

  function creditWaarde(e, code) {
    return Math.max(0, -saldo(e, code));
  }

  function kas(e, actor) {
    return Math.max(0, saldo(e, actor + '.kas'));
  }

  function legUit(e, soort, titel, uitleg, effect, bron) {
    e.verklaringen.unshift({ dag: e.dag, datum: datumOpDag(e.dag), soort, titel, uitleg, effect: effect || '', bron: bron || 'economische regel' });
    if (e.verklaringen.length > 120) e.verklaringen.length = 120;
  }

  function audit(e, actor, actie, detail) {
    e.audit.unshift({ dag: e.dag, datum: datumOpDag(e.dag), actor: String(actor || 'systeem').slice(0, 100), actie, detail: String(detail || '').slice(0, 400) });
    if (e.audit.length > 300) e.audit.length = 300;
  }

  function leen(e, bedrijf, bedrag, sleutel, actor) {
    bedrag = geld(bedrag);
    if (bedrag <= 0) return null;
    const b = e.bedrijven[bedrijf];
    const limiet = bedrijf === 'rtg' ? 500000000 : 150000000;
    const bestaand = creditWaarde(e, bedrijf + '.schuld');
    if (bestaand + bedrag > limiet) return { status: 400, error: 'De lening overschrijdt de synthetische kredietlimiet.' };
    boek(e, sleutel, 'Lening aan ' + b.naam, [
      regel('bank.leningen', 'bank', 'Uitstaande leningen', 'actief', 'debet', bedrag),
      regel('bank.depositos', 'bank', 'Gecreeerde deposito', 'schuld', 'credit', bedrag),
      regel(bedrijf + '.kas', bedrijf, 'Bank en kas', 'actief', 'debet', bedrag),
      regel(bedrijf + '.schuld', bedrijf, 'Bankschuld', 'schuld', 'credit', bedrag)
    ], ['krediet']);
    b.schuld = creditWaarde(e, bedrijf + '.schuld');
    audit(e, actor, 'lening', b.naam + ' leent ' + bedrag + ' cent');
    return { ok: true, bedrag, schuld: b.schuld };
  }

  function betaalStroom(e, sleutel, omschrijving, van, naar, bedrag, kostenRekening, opbrengstRekening, labels) {
    bedrag = Math.max(0, geld(bedrag));
    if (!bedrag) return null;
    return boek(e, sleutel, omschrijving, [
      regel(van + '.' + kostenRekening, van, omschrijving, 'kosten', 'debet', bedrag),
      regel(van + '.kas', van, 'Bank en kas', 'actief', 'credit', bedrag),
      regel(naar + '.kas', naar, 'Bank en kas', 'actief', 'debet', bedrag),
      regel(naar + '.' + opbrengstRekening, naar, omschrijving, 'opbrengsten', 'credit', bedrag)
    ], labels);
  }

  function zorgLiquiditeit(e, bedrijf, nodig) {
    const beschikbaar = kas(e, bedrijf);
    if (beschikbaar >= nodig) return 0;
    const buffer = bedrijf === 'rtg' ? 25000000 : 10000000;
    const bedrag = Math.max(buffer, nodig - beschikbaar + buffer);
    const lening = leen(e, bedrijf, bedrag, 'dag:' + e.dag + ':noodkrediet:' + bedrijf, 'automatische liquiditeitsregel');
    if (lening && lening.ok) {
      legUit(e, 'financiering', 'Liquiditeitsbuffer geactiveerd', 'De kas was lager dan de verwachte dagverplichtingen. De bank verstrekte krediet binnen de vooraf bepaalde limiet.', '+' + bedrag + ' cent kas', 'krediet- en liquiditeitsregel');
      return bedrag;
    }
    return 0;
  }

  function schokVoorDag(e) {
    if (e.geforceerdeSchok) {
      const gekozen = SCHOKKEN.find(s => s.id === e.geforceerdeSchok) || SCHOKKEN[0];
      e.geforceerdeSchok = null;
      return gekozen;
    }
    const patroon = { 3: 'vraagpiek', 6: 'leveranciersuitval', 9: 'arbeidstekort' };
    const cyclus = e.dag % 12;
    return SCHOKKEN.find(s => s.id === patroon[cyclus]) || SCHOKKEN[0];
  }

  function pasArbeidsmarktToe(e, b, schok) {
    const verschil = rond(b.personeelDoel - b.personeel);
    if (!verschil) return 0;
    if (verschil < 0) {
      const vertrek = Math.min(b.personeel, Math.abs(verschil));
      b.personeel -= vertrek;
      legUit(e, 'arbeid', b.naam + ' verkleint het team', 'Het ingestelde personeelsdoel ligt lager dan de bestaande bezetting.', '-' + vertrek + ' arbeidsplaatsen', 'personeelsbesluit');
      return -vertrek;
    }
    const loonFactor = begrens(b.loonMaand / 350000, .65, 1.35);
    const beschikbaar = Math.max(0, Math.floor(verschil * schok.arbeid * loonFactor));
    const hires = Math.min(verschil, beschikbaar || (schok.id === 'arbeidstekort' ? 0 : 1));
    b.personeel += hires;
    legUit(e, 'arbeid', b.naam + ' werft personeel', 'Beschikbaarheid en loonpositie bepalen hoeveel vacatures werkelijk worden gevuld.', '+' + hires + ' van ' + verschil + ' vacatures', 'arbeidsaanbod x relatieve beloning');
    return hires;
  }

  function aantrekkelijkheid(e, b) {
    const prijsFactor = Math.pow(11900 / Math.max(5000, b.prijs), e.instellingen.prijsElasticiteit);
    const kwaliteitFactor = begrens(b.kwaliteit / 72, .55, 1.5);
    const reputatieFactor = begrens(b.reputatie / 70, .6, 1.45);
    return prijsFactor * kwaliteitFactor * reputatieFactor;
  }

  function boekBedrijfsdag(e, b, verkoop, levering) {
    const dag = e.dag;
    const omzet = verkoop * b.prijs;
    const inkoop = levering * e.instellingen.inkoopPerEenheid;
    const loon = rond((b.loonMaand * b.personeel * (e.actieveSchok.id === 'arbeidstekort' ? 1.035 : 1)) / 30);
    const training = Math.min(b.trainingDag, kas(e, b.id));
    const impact = rond(omzet * b.impactBp / 10000);
    const rente = rond(creditWaarde(e, b.id + '.schuld') * e.macro.rente / 100 / 365);
    zorgLiquiditeit(e, b.id, inkoop + loon + training + impact + rente);

    betaalStroom(e, 'dag:' + dag + ':omzet:' + b.id, 'Verkoop diensten ' + b.naam, 'huishoudens', b.id, omzet, 'consumptie', 'omzet', ['vraag', 'omzet']);
    betaalStroom(e, 'dag:' + dag + ':inkoop:' + b.id, 'Inkoop capaciteit ' + b.naam, b.id, 'leverancier', Math.min(inkoop, kas(e, b.id)), 'inkoop', 'omzet', ['aanbod', 'keten']);
    betaalStroom(e, 'dag:' + dag + ':loon:' + b.id, 'Lonen ' + b.naam, b.id, 'huishoudens', Math.min(loon, kas(e, b.id)), 'loonkosten', 'looninkomen', ['arbeid']);
    betaalStroom(e, 'dag:' + dag + ':training:' + b.id, 'Opleiding en ontwikkeling ' + b.naam, b.id, 'rtf', Math.min(training, kas(e, b.id)), 'opleidingskosten', 'opleidingsopbrengsten', ['menselijk-kapitaal', 'rtf']);
    betaalStroom(e, 'dag:' + dag + ':impact:' + b.id, 'Maatschappelijke bijdrage ' + b.naam, b.id, 'rtf', Math.min(impact, kas(e, b.id)), 'impactkosten', 'bijdragen', ['impact', 'rtf']);
    betaalStroom(e, 'dag:' + dag + ':rente:' + b.id, 'Rente ' + b.naam, b.id, 'bank', Math.min(rente, kas(e, b.id)), 'rentekosten', 'renteopbrengsten', ['krediet']);

    const kostenVoorBelasting = inkoop + loon + training + impact + rente;
    const winstVoorBelasting = omzet - kostenVoorBelasting;
    const belasting = winstVoorBelasting > 0 ? rond(winstVoorBelasting * e.instellingen.vennootschapsbelastingBp / 10000) : 0;
    betaalStroom(e, 'dag:' + dag + ':belasting:' + b.id, 'Vennootschapsbelasting ' + b.naam, b.id, 'overheid', Math.min(belasting, kas(e, b.id)), 'belastingkosten', 'belastingopbrengsten', ['overheid', 'belasting']);

    b.omzetVandaag = omzet;
    b.kostenVandaag = kostenVoorBelasting + belasting;
    b.winstVandaag = omzet - b.kostenVandaag;
    b.verkopenVandaag = verkoop;
    b.schuld = creditWaarde(e, b.id + '.schuld');
  }

  function verwerkOverheid(e) {
    const werkenden = e.bedrijven.rtg.personeel + e.bedrijven.praktijk.personeel + e.macro.leverancierPersoneel;
    const werkloos = Math.max(0, e.macro.beroepsbevolking - werkenden);
    const uitkering = Math.min(kas(e, 'overheid'), werkloos * 5200);
    betaalStroom(e, 'dag:' + e.dag + ':uitkering', 'Sociale uitkeringen', 'overheid', 'huishoudens', uitkering, 'sociale-kosten', 'overdrachtsinkomen', ['arbeid', 'stabilisator']);
  }

  function berekenMarkt(e) {
    const schok = e.actieveSchok;
    const werk = e.werk;
    const werkBonus = werk.aantal ? begrens((werk.productiviteit + werk.service + werk.controle + werk.innovatie) / (werk.aantal * 100), 0, .22) : 0;
    const bedrijven = Object.values(e.bedrijven);
    bedrijven.forEach(b => pasArbeidsmarktToe(e, b, schok));

    const totaalAantrekkelijk = som(bedrijven.map(b => aantrekkelijkheid(e, b) * 100000)) / 100000 || 1;
    const macroVraag = begrens(e.macro.consumentenvertrouwen / 100, .65, 1.25);
    const totaleVraag = Math.max(100, rond(e.instellingen.basisVraag * schok.vraag * macroVraag));
    const leverancierCapaciteit = rond(1100 * schok.aanbod);

    for (const b of bedrijven) {
      const trainingsFactor = begrens(b.trainingDag / Math.max(1, b.personeel * 50000), 0, .22);
      b.productiviteit = Number((b.basisProductiviteit * (1 + trainingsFactor + werkBonus)).toFixed(2));
      b.capaciteitVandaag = Math.max(0, rond(b.personeel * b.productiviteit + b.vasteCapaciteit));
      b.vraagVandaag = Math.max(0, rond(totaleVraag * aantrekkelijkheid(e, b) / totaalAantrekkelijk));
    }

    const totaalBesteld = som(bedrijven.map(b => b.bestelling));
    for (const b of bedrijven) {
      const aandeel = totaalBesteld ? b.bestelling / totaalBesteld : .5;
      const levering = Math.min(b.bestelling, rond(leverancierCapaciteit * aandeel));
      b.voorraad += levering;
      b.levergraad = b.bestelling ? rond(levering / b.bestelling * 100) : 100;
      const verkoop = Math.min(b.vraagVandaag, b.capaciteitVandaag, b.voorraad);
      b.voorraad -= verkoop;
      b.benutting = b.capaciteitVandaag ? rond(verkoop / b.capaciteitVandaag * 100) : 0;
      const druk = b.benutting > 92 ? -2.2 : b.benutting < 62 ? .4 : .8;
      const serviceBonus = werk.aantal ? werk.service / (werk.aantal * 40) : 0;
      const controleBonus = werk.aantal ? werk.controle / (werk.aantal * 55) : 0;
      b.kwaliteit = Number(begrens(b.kwaliteit + druk + serviceBonus + controleBonus, 35, 98).toFixed(1));
      b.reputatie = Number(begrens(b.reputatie + (b.kwaliteit - 70) / 80, 25, 98).toFixed(1));
      boekBedrijfsdag(e, b, verkoop, levering);
    }

    const werkenden = e.bedrijven.rtg.personeel + e.bedrijven.praktijk.personeel + e.macro.leverancierPersoneel;
    e.macro.werkloosheid = Number(begrens((e.macro.beroepsbevolking - werkenden) / e.macro.beroepsbevolking * 100, 0, 40).toFixed(1));
    const vraagDruk = totaleVraag / e.instellingen.basisVraag - 1;
    const aanbodDruk = 1 - schok.aanbod;
    e.macro.inflatie = Number(begrens(2 + vraagDruk * 5.5 + aanbodDruk * 4.5 - (e.macro.werkloosheid - 5) * .06, -.5, 12).toFixed(2));
    e.macro.rente = Number(begrens(1.4 + .62 * (e.macro.inflatie - 2) - .08 * (e.macro.werkloosheid - 5), .25, 11).toFixed(2));
    e.macro.prijsindex = Number((e.macro.prijsindex * (1 + e.macro.inflatie / 100 / 365)).toFixed(3));
    e.macro.bbpVandaag = som(bedrijven.map(b => b.omzetVandaag));
    e.macro.vraagIndex = rond(totaleVraag / e.instellingen.basisVraag * 100);
    e.macro.aanbodIndex = rond(schok.aanbod * 100);
    e.macro.consumentenvertrouwen = Number(begrens(e.macro.consumentenvertrouwen + (schok.id === 'geen' ? .3 : -.7), 70, 115).toFixed(1));
    verwerkOverheid(e);

    legUit(e, 'markt', 'Vraag en marktaandeel verdeeld', 'Prijs, kwaliteit en reputatie bepalen samen de aantrekkelijkheid. Capaciteit en voorraad begrenzen de uiteindelijke verkoop.', totaleVraag + ' gevraagde diensten', 'vraagcurve + prijselasticiteit + capaciteitsgrens');
    if (schok.id !== 'geen') legUit(e, 'schok', schok.naam, schok.uitleg, 'Vraag ' + rond(schok.vraag * 100) + ' · aanbod ' + rond(schok.aanbod * 100) + ' · arbeid ' + rond(schok.arbeid * 100), 'deterministisch scenarioschema');
    if (werk.aantal) legUit(e, 'werkvloer', 'RTG-werk veranderde de uitvoering', werk.aantal + ' voltooide dossier(s) verbeteren productiviteit, service, controle of innovatie in de volgende economische dag.', '+' + rond(werkBonus * 100) + '% productiviteitspotentieel', 'Magnaat-kantoorprocessen');
  }

  function neemMoment(e) {
    const moment = {
      dag: e.dag, datum: datumOpDag(e.dag), schok: e.actieveSchok.id,
      macro: Object.assign({}, e.macro),
      bedrijven: Object.fromEntries(Object.values(e.bedrijven).map(b => [b.id, {
        omzet: b.omzetVandaag, winst: b.winstVandaag, kas: kas(e, b.id), schuld: creditWaarde(e, b.id + '.schuld'),
        personeel: b.personeel, prijs: b.prijs, kwaliteit: b.kwaliteit, reputatie: b.reputatie,
        vraag: b.vraagVandaag, verkoop: b.verkopenVandaag, capaciteit: b.capaciteitVandaag, voorraad: b.voorraad
      }]))
    };
    e.historie.push(moment);
    if (e.historie.length > MAX_HISTORIE) e.historie.shift();
    return moment;
  }

  function wisWerk(e) {
    e.werk = { aantal: 0, productiviteit: 0, service: 0, controle: 0, impact: 0, innovatie: 0, bronnen: [] };
  }

  function volgendeDag(actor, commandoId) {
    const e = state();
    commandoId = String(commandoId || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 120);
    if (!commandoId) return { status: 400, error: 'Een unieke commandosleutel is nodig om dubbel verwerken te voorkomen.' };
    if (e.commandos[commandoId]) return Object.assign({ ok: true, herhaald: true }, overzicht(), { verwerktCommando: commandoId });
    e.dag += 1;
    e.actieveSchok = schokVoorDag(e);
    berekenMarkt(e);
    neemMoment(e);
    wisWerk(e);
    e.commandos[commandoId] = e.dag;
    const sleutels = Object.keys(e.commandos);
    if (sleutels.length > 500) for (const k of sleutels.slice(0, sleutels.length - 500)) delete e.commandos[k];
    audit(e, actor, 'volgende-dag', 'Economische dag ' + e.dag + ' verwerkt');
    save();
    return Object.assign({ ok: true, herhaald: false, verwerktCommando: commandoId }, overzicht());
  }

  function getal(v, veld) {
    const n = Number(v);
    if (!Number.isFinite(n)) return { error: veld + ' moet een getal zijn.' };
    return { waarde: n };
  }

  function beslis(actor, invoer) {
    const e = state();
    const b = e.bedrijven.praktijk;
    invoer = invoer && typeof invoer === 'object' ? invoer : {};
    const velden = [
      ['prijs', 50, 350, n => b.prijs = geld(n * 100)],
      ['personeelDoel', 3, 100, n => b.personeelDoel = rond(n)],
      ['loonMaand', 1800, 12000, n => b.loonMaand = geld(n * 100)],
      ['trainingDag', 0, 50000, n => b.trainingDag = geld(n * 100)],
      ['bestelling', 0, 2000, n => b.bestelling = rond(n)],
      ['impactPct', 0, 20, n => b.impactBp = rond(n * 100)]
    ];
    let gewijzigd = 0;
    for (const [veld, min, max, toepassen] of velden) {
      if (invoer[veld] === undefined) continue;
      const n = getal(invoer[veld], veld);
      if (n.error) return { status: 400, error: n.error };
      if (n.waarde < min || n.waarde > max) return { status: 400, error: veld + ' moet tussen ' + min + ' en ' + max + ' liggen.' };
      toepassen(n.waarde);
      gewijzigd += 1;
    }
    if (invoer.lening !== undefined && Number(invoer.lening) > 0) {
      const n = getal(invoer.lening, 'lening');
      if (n.error || n.waarde > 1000000) return { status: 400, error: 'Lening moet tussen 0 en 1.000.000 euro liggen.' };
      const uitkomst = leen(e, 'praktijk', geld(n.waarde * 100), 'besluit:' + e.dag + ':lening:' + e.boekVolgorde, actor);
      if (uitkomst && uitkomst.status) return uitkomst;
      gewijzigd += 1;
    }
    if (!gewijzigd) return { status: 400, error: 'Geef ten minste één bedrijfsbesluit door.' };
    audit(e, actor, 'strategie', 'Praktijkbedrijf: ' + gewijzigd + ' instelling(en) gewijzigd');
    legUit(e, 'besluit', 'Nieuwe bedrijfsstrategie vastgelegd', 'De keuze verandert niet direct de score. De volgende dagcyclus rekent eerst alle markt-, arbeids- en kasgevolgen door.', gewijzigd + ' instelling(en)', 'spelersbesluit');
    save();
    return Object.assign({ ok: true }, overzicht());
  }

  function kiesSchok(actor, schokId) {
    const e = state();
    const schok = SCHOKKEN.find(s => s.id === String(schokId || ''));
    if (!schok || schok.id === 'geen') return { status: 400, error: 'Kies een bestaand economisch scenario.' };
    e.geforceerdeSchok = schok.id;
    audit(e, actor, 'scenario', schok.naam + ' staat klaar voor de volgende dag');
    save();
    return Object.assign({ ok: true, gepland: schok }, overzicht());
  }

  function registreerWerk(actor, taak) {
    const e = state();
    const max = som((taak.stappen || []).map(s => s.soort === 'software' ? 75 : 100)) || 100;
    const kwaliteit = begrens((taak.punten || 0) / max, .2, 1);
    const waarde = rond(kwaliteit * 100);
    const soort = taak.spelvorm || 'operatie';
    const koppeling = {
      planning: ['productiviteit', 'Ketenplanning verhoogt de leverbare capaciteit.'],
      controle: ['controle', 'Controlewerk verlaagt fouten en beschermt kwaliteit.'],
      gesprek: ['service', 'Goede service versterkt kwaliteit en reputatie.'],
      impact: ['impact', 'Impactwerk vergroot het maatschappelijke rendement.'],
      operatie: ['productiviteit', 'Operationeel werk verlaagt verspilling.'],
      puzzel: ['innovatie', 'Procesinnovatie verhoogt de toekomstige productiviteit.']
    }[soort] || ['productiviteit', 'Het werk verbetert de uitvoering.'];
    e.werk.aantal += 1;
    e.werk[koppeling[0]] += waarde;
    if (koppeling[0] === 'innovatie') e.werk.productiviteit += rond(waarde * .6);
    if (koppeling[0] === 'impact') e.werk.service += rond(waarde * .25);
    e.werk.bronnen.unshift({ taakId: taak.id, functieId: taak.functieId, kwaliteit: waarde, soort });
    if (e.werk.bronnen.length > 30) e.werk.bronnen.length = 30;
    audit(e, actor, 'werkresultaat', taak.functieId + ' · ' + waarde + '% proceskwaliteit');
    return { soort: koppeling[0], kwaliteit: waarde, uitleg: koppeling[1] + ' Het effect wordt bij de volgende economische dag doorgerekend.' };
  }

  function publiekeBedrijf(e, b) {
    return {
      id: b.id, naam: b.naam, kas: kas(e, b.id), schuld: creditWaarde(e, b.id + '.schuld'),
      personeel: b.personeel, personeelDoel: b.personeelDoel, loonMaand: b.loonMaand,
      prijs: b.prijs, kwaliteit: b.kwaliteit, reputatie: b.reputatie,
      voorraad: b.voorraad, bestelling: b.bestelling, trainingDag: b.trainingDag,
      impactPct: b.impactBp / 100, omzetVandaag: b.omzetVandaag,
      kostenVandaag: b.kostenVandaag, winstVandaag: b.winstVandaag,
      verkopenVandaag: b.verkopenVandaag, vraagVandaag: b.vraagVandaag,
      capaciteitVandaag: b.capaciteitVandaag, productiviteit: b.productiviteit,
      benutting: b.benutting, levergraad: b.levergraad
    };
  }

  function balansControle(e) {
    const debet = som(e.journaal.map(j => j.debet));
    const credit = som(e.journaal.map(j => j.credit));
    return { debet, credit, verschil: debet - credit, inBalans: debet === credit };
  }

  function overzicht() {
    const e = state();
    return {
      versie: VERSIE, naam: 'Magnaat Economische Motor', dag: e.dag,
      datum: datumOpDag(e.dag), omgeving: 'synthetische trainingswereld',
      serverAuthoritatief: true, deterministisch: true,
      actieveSchok: Object.assign({}, e.actieveSchok),
      geplandeSchok: e.geforceerdeSchok || null,
      schokken: SCHOKKEN.filter(s => s.id !== 'geen').map(s => Object.assign({}, s)),
      macro: Object.assign({}, e.macro, {
        huishoudensKas: kas(e, 'huishoudens'), overheidsKas: kas(e, 'overheid'),
        rtfKas: kas(e, 'rtf'), bankKas: kas(e, 'bank')
      }),
      bedrijven: Object.values(e.bedrijven).map(b => publiekeBedrijf(e, b)),
      strategie: publiekeBedrijf(e, e.bedrijven.praktijk),
      werkvoorraad: Object.assign({}, e.werk, { bronnen: e.werk.bronnen.slice(0, 8) }),
      grootboek: {
        boekingen: e.journaal.length, controle: balansControle(e),
        laatste: e.journaal.slice(0, 12).map(j => ({ id: j.id, datum: j.datum, omschrijving: j.omschrijving, bedrag: j.bedrag, debet: j.debet, credit: j.credit, labels: j.labels }))
      },
      verklaringen: e.verklaringen.slice(0, 12),
      historie: e.historie.slice(-40),
      regels: [
        'Vraag reageert op prijs, kwaliteit, reputatie en consumentenvertrouwen.',
        'Verkoop kan nooit hoger zijn dan vraag, capaciteit of voorraad.',
        'Personeel, loon en training veranderen kosten en productiviteit.',
        'Schaarste verhoogt inflatie; inflatie en werkloosheid sturen de rente.',
        'Winst wordt pas na inkoop, lonen, training, rente, impact en belasting berekend.',
        'Iedere geldstroom is dubbel geboekt; een ongebalanceerde post wordt geweigerd.'
      ]
    };
  }

  return { overzicht, beslis, volgendeDag, kiesSchok, registreerWerk, _state: state, _boek: boek };
};
