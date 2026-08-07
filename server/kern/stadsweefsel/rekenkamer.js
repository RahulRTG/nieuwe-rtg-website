/* RTG Stadsweefsel, deel "rekenkamer": achteraf nagaan wat het opleverde.

   Dit deel voegt geen enkel gegeven toe. Het legt de bestaande naast elkaar:
   de begroting weet het budget en de uitgaven, de indicatoren weten de
   uitkomst, het bestuur weet welk besluit eronder lag en de werkorders weten
   of de afgesproken hersteltijd is gehaald.

   WAT ERUIT KOMT ZIJN FEITEN EN VRAGEN, geen cijfer en geen stoplicht. Een
   onafhankelijk onderzoek dat begint bij een automatisch oordeel, is geen
   onderzoek meer -- en een systeem dat zijn eigen projecten een score geeft,
   heeft zichzelf tot rechter benoemd. Krijgt de gedeelde ctx. */
const DAG = 86400000;

module.exports = (ctx) => {
  const { nu, bes, beg, werk } = ctx;

  /* HET REKENKAMERONDERZOEK. Geen nieuw gegeven, alleen de bestaande naast
     elkaar: wat was het doel, wat mocht het kosten, wat kostte het, wat is
     ervan gemeten, welk besluit lag eronder, en wat is er in dezelfde periode
     nog meer gebeurd. Wat eruit komt zijn FEITEN en VRAGEN. */
  function onderzoek({ projectId }) {
    const p = beg.project(projectId);
    if (!p) return { status: 404, error: 'Onbekend project.' };
    const cijfers = beg.besteed(p);
    const effect = beg.effectVan(p);
    const dekking = bes.lijst({ projectId: p.id }).filter(b => b.status === 'aangenomen');
    /* HET MANDAAT WORDT GETOETST OP WAT HET WERKELIJK KOSTTE, niet alleen op
       wat het mocht kosten. De begroting bewaakt de grens bij het AANMAKEN --
       daar komt geen project doorheen dat te duur is begroot zonder besluit --
       maar een project dat netjes onder de grens begon en er tijdens de rit
       overheen ging, glipt daar per definitie langs. Dat is precies het geval
       waar een rekenkamer voor bestaat, en het was de eerste versie van deze
       functie niet: die keek alleen naar het budget, waardoor deze vraag nooit
       gesteld kon worden. */
    const gemeten = Math.max(p.budget, cijfers.uitgegeven);
    const eis = bes.mandaat({ bedrag: gemeten });
    const orders = p.werkorders.map(id => werk.order(id)).filter(Boolean);
    const traag = orders.filter(w => w.herstelBinnenSla === false).length;
    const periode = (p.afgeslotenAt || nu()) - p.at;

    const feiten = [
      'Budget EUR ' + p.budget + '; uitgegeven EUR ' + cijfers.uitgegeven + ' (' + Math.round(cijfers.uitgegeven / p.budget * 100) + '%).',
      orders.length + ' werkorder(s), waarvan ' + cijfers.werkKlaar + ' afgerond en ' + cijfers.werkOpen + ' nog open.',
      'Looptijd tot nu toe: ' + Math.round(periode / DAG) + ' dagen.',
      effect.gemeten ? 'Indicator ' + effect.indicator + ': van ' + effect.van + ' naar ' + effect.naar + ' (' + effect.eenheid + ').'
        : 'Effect niet gemeten: ' + effect.reden + '.',
      dekking.length ? 'Bestuurlijke dekking: ' + dekking.map(b => b.ref + ' (' + b.orgaanNaam + ')').join(', ') + '.'
        : 'Er ligt geen aangenomen besluit onder dit project.'
    ];
    const vragen = [];
    if (!dekking.length && eis.besluitNodig)
      vragen.push('Op EUR ' + gemeten + ' vraagt het mandaat een besluit van ' + eis.orgaan + ' (' + eis.reden + '), en dat ontbreekt.' +
        (gemeten > p.budget ? ' Het project begon onder de grens (EUR ' + p.budget + ') en kwam er tijdens de uitvoering overheen -- wie heeft dat gezien?' : ' Hoe is het dan gestart?'));
    if (cijfers.uitgegeven > p.budget)
      vragen.push('Het budget is met EUR ' + Math.round(cijfers.uitgegeven - p.budget) + ' overschreden. Wanneer is dat gemeld en aan wie?');
    if (!effect.gemeten)
      vragen.push('Zonder nulmeting of eindmeting is niet vast te stellen of dit project heeft opgeleverd wat het beloofde. Waarom is er geen indicator gekozen?');
    if (effect.gemeten && effect.beter === false)
      vragen.push('De indicator ging de verkeerde kant op. Ligt dat aan het project, of aan iets anders in dezelfde periode?');
    if (traag) vragen.push(traag + ' werkorder(s) haalden de afgesproken hersteltijd niet. Is daarover met de aannemer gesproken?');
    if (cijfers.werkOpen && p.status === 'afgesloten')
      vragen.push('Het project is afgesloten terwijl er werk openstond. Wat is daarmee gebeurd?');
    if (!vragen.length) vragen.push('Op de beschikbare gegevens roept dit project geen vragen op. Dat is geen goedkeuring: er is niet gekeken naar wat er NIET is vastgelegd.');

    return { status: 200, project: p.naam, doel: p.doelId, status_project: p.status,
      feiten, vragen, mandaat: eis, dekking: dekking.map(b => b.ref), effect,
      let_op: 'Dit is een feitenblad uit de eigen administratie, geen oordeel. De rekenkamer oordeelt; het systeem legt de cijfers naast elkaar.' };
  }

  // het jaarbeeld voor de rekenkamer: alle projecten met hun dekking en effect
  function jaarbeeld({ jaar }) {
    const b = beg.api.weefselBegroting({ jaar });
    const rij = [];
    for (const doel of b.doelen) for (const p of doel.projecten) {
      const dekking = bes.lijst({ projectId: p.id }).filter(x => x.status === 'aangenomen');
      const eis = bes.mandaat({ bedrag: p.budget });
      rij.push({ project: p.naam, doel: doel.naam, budget: p.budget, uitgegeven: p.uitgegeven,
        status: p.status, besluitNodig: eis.besluitNodig, orgaan: eis.orgaan,
        dekking: dekking.map(x => x.ref), zonderDekking: eis.besluitNodig && !dekking.length,
        effectGemeten: !!(beg.project(p.id) && beg.effectVan(beg.project(p.id)).gemeten) });
    }
    return { status: 200, jaar: b.jaar, projecten: rij,
      zonderDekking: rij.filter(x => x.zonderDekking).length,
      zonderEffect: rij.filter(x => !x.effectGemeten).length,
      let_op: 'Twee getallen om te lezen: projecten zonder bestuurlijke dekking, en projecten waarvan het effect niet is gemeten.' };
  }

  return { onderzoek, jaarbeeld };
};
