/* Afdelingsregister deel 2, kamergroep "ontwerpbureaus" (kern/afdelingen): de
   vier besloten ontwerpbureaus van het kantoor - RTG Atelier (mode), RTG
   Ontwerpstudio (voertuigen en vaartuigen), RTG Hardwarelab (eigen apparaten)
   en RTG Architectenbureau (het gebouwde). De cijfers staan hier; de eigenlijke
   ontwerpvloer opent als een eigen cockpit op de kamer (eigenApp: true).
   Verbatim afgesplitst uit register2.js. */
module.exports = (ctx) => {
  const { d, lijst, tel, recent } = ctx;

  return {
    atelier: { naam: 'RTG Atelier', emoji: '✂️', missie: 'Het ontwerpbureau van het kantoor voor mode en alles wat je aan het lijf draagt; het huis waar de grote maisons hun atelier zouden willen hebben.', eigenApp: true,
      kpis: () => [
        ['Ontwerpen', tel((d().atelier || {}).ontwerpen)],
        ['In productie', tel(lijst((d().atelier || {}).ontwerpen).filter(o => o.status === 'productie'))],
        ['Categorieen', 8],
        ['Collecties', tel((d().atelier || {}).collecties)],
        ['Bijgewerkt (7d)', recent((d().atelier || {}).ontwerpen, 'updatedAt', 7)]
      ],
      lijsten: () => [
        { titel: 'Laatste ontwerpen', items: lijst((d().atelier || {}).ontwerpen).slice(0, 8).map(o => String(o.naam) + ' (' + String(o.categorie) + ', ' + String(o.status) + ')') },
        { titel: 'Verder werken', items: ['Klik op deze kamer om het atelier te openen: brief een stuk, laat de AI het concept uittekenen, en vraag het tech pack en de creatief directeur.'] }
      ] },
    studio: { naam: 'RTG Ontwerpstudio', emoji: '🏎️', missie: 'Het ontwerpbureau van het kantoor voor alles wat je beweegt: hypercars, jachten, business jets en helikopters, op het niveau waar de grote namen om zouden vragen.', eigenApp: true,
      kpis: () => [
        ['Concepten', tel((d().studio || {}).ontwerpen)],
        ['In productie', tel(lijst((d().studio || {}).ontwerpen).filter(o => o.status === 'productie'))],
        ['Disciplines', 4],
        ['Programma’s', tel((d().studio || {}).collecties)],
        ['Bijgewerkt (7d)', recent((d().studio || {}).ontwerpen, 'updatedAt', 7)]
      ],
      lijsten: () => [
        { titel: 'Laatste concepten', items: lijst((d().studio || {}).ontwerpen).slice(0, 8).map(o => String(o.naam) + ' (' + String(o.discipline) + ', ' + String(o.status) + ')') },
        { titel: 'Verder werken', items: ['Klik op deze kamer om de studio te openen: brief een concept, laat de AI het uittekenen, en vraag de specsheet en de chef-ontwerper. Onderweg werkt de RTG Studio PDA.'] }
      ] },
    hardware: { naam: 'RTG Hardwarelab', emoji: '🔧', missie: 'Het ontwerpbureau van het kantoor voor de eigen apparaten: PDA\'s en tablets, schermen, sensoren, de zaakdoos-familie en accessoires, van eerste schets tot vrijgave.', eigenApp: true,
      kpis: () => [
        ['Concepten', tel((d().hardware || {}).ontwerpen)],
        ['In de winkel', tel(lijst((d().hardware || {}).ontwerpen).filter(o => o.winkel))],
        ['Disciplines', 6],
        ['Series', tel((d().hardware || {}).collecties)],
        ['Bijgewerkt (7d)', recent((d().hardware || {}).ontwerpen, 'updatedAt', 7)]
      ],
      lijsten: () => [
        { titel: 'Laatste concepten', items: lijst((d().hardware || {}).ontwerpen).slice(0, 8).map(o => String(o.naam) + ' (' + String(o.discipline) + ', ' + String(o.status) + ')') },
        { titel: 'Verder werken', items: ['Klik op deze kamer om het Hardwarelab te openen: brief een apparaat, laat de AI het concept uittekenen, en vraag de stuklijst en de chef-engineer. Onderweg werkt de RTG Hardware PDA.'] }
      ] },
    architect: { naam: 'RTG Architectenbureau', emoji: '🏛️', missie: 'Het ontwerpbureau van het kantoor voor het gebouwde: villa\'s, penthouses, landgoederen, chalets en paviljoens, van eerste schets tot oplevering.', eigenApp: true,
      kpis: () => [
        ['Concepten', tel((d().architect || {}).ontwerpen)],
        ['In realisatie', tel(lijst((d().architect || {}).ontwerpen).filter(o => o.status === 'realisatie'))],
        ['Disciplines', 5],
        ['Projecten', tel((d().architect || {}).collecties)],
        ['Bijgewerkt (7d)', recent((d().architect || {}).ontwerpen, 'updatedAt', 7)]
      ],
      lijsten: () => [
        { titel: 'Laatste concepten', items: lijst((d().architect || {}).ontwerpen).slice(0, 8).map(o => String(o.naam) + ' (' + String(o.discipline) + ', ' + String(o.status) + ')') },
        { titel: 'Verder werken', items: ['Klik op deze kamer om het Architectenbureau te openen: brief een huis, laat de AI het concept uittekenen, en vraag de bouwstaat en de chef-architect. Onderweg werkt de RTG Architect PDA.'] }
      ] }
  };
};
