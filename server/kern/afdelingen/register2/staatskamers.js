/* Het afdelingsregister, deel 2c: de staatskamers. Twee kamers die het
   platform met het publieke domein verbinden:
   - regering : het bureau van de minister-president; alles wat het land
                raakt komt hier samen en elk besluit vraagt twee handtekeningen
   - opvang   : de AZC-/COA-afdeling; locaties, bezetting en de doorstroom
                van aanmelding tot een eigen woning -- op dossiernummer,
                nooit op naam
   Beide draaien op de gedeelde ctx van kern/afdelingen. */
module.exports = (ctx) => {
  const { d, lijst, tel } = ctx;

  const opvangLocaties = () => Object.values(d().opvangLocaties || {});
  const opvangDossiers = () => lijst(d().opvangDossiers);
  const inOpvang = () => opvangDossiers().filter(x => ['aangemeld', 'opvang', 'statushouder'].includes(x.fase));
  const capaciteit = () => opvangLocaties().reduce((s, l) => s + (l.capaciteit || 0), 0);
  const bezet = () => inOpvang().reduce((s, x) => s + (x.personen || 1), 0);
  const besluiten = () => lijst(d().regeringBesluiten);

  return {
    regering: { naam: 'Het Regeringskantoor', icoon: 'balans',
      missie: 'Alles wat het land raakt op één bord, en geen besluit zonder tweede handtekening.',
      kpis: () => [
        ['Voorgenomen besluiten', besluiten().filter(b => b.status === 'voorgenomen').length],
        ['Genomen besluiten', besluiten().filter(b => b.status === 'genomen').length],
        ['Veiligheid opgeschaald', (d().rampbeeld && d().rampbeeld.actief) ? 'ja (niveau ' + d().rampbeeld.niveau + ')' : 'nee'],
        ['Opvang bezet', capaciteit() ? Math.round(bezet() / capaciteit() * 100) + '%' : '-'],
        ['Steden aangesloten', [...new Set(lijst(d().suppliers).map(s => s.city).filter(Boolean))].length]
      ],
      lijsten: () => [
        { titel: 'Besluiten die op een tweede handtekening wachten',
          items: besluiten().filter(b => b.status === 'voorgenomen').slice(0, 8)
            .map(b => b.titel + ' (' + b.portefeuilleNaam + ', door ' + b.door + ')') },
        { titel: 'Laatst genomen besluiten',
          items: besluiten().filter(b => b.status === 'genomen').slice(0, 6)
            .map(b => b.titel + ' -- meegetekend door ' + b.medeondertekend) }
      ] },

    opvang: { naam: 'Opvang & migratie', icoon: 'huis',
      missie: 'Iedereen een veilig bed en een eerlijke doorstroom -- op dossiernummer, nooit op naam.',
      kpis: () => [
        ['Locaties', opvangLocaties().length],
        ['Plekken', capaciteit()],
        ['Bezet', bezet()],
        ['Wacht op woning', opvangDossiers().filter(x => x.fase === 'statushouder').reduce((s, x) => s + (x.personen || 1), 0)],
        ['Kinderen in de opvang', inOpvang().reduce((s, x) => s + (x.kinderen || 0), 0)]
      ],
      lijsten: () => [
        { titel: 'Locaties die vollopen (90% of meer)',
          items: opvangLocaties().map(l => {
            const b = opvangDossiers().filter(x => x.locatie === l.id && ['aangemeld', 'opvang', 'statushouder'].includes(x.fase))
              .reduce((s, x) => s + (x.personen || 1), 0);
            return { naam: l.naam, pct: l.capaciteit ? Math.round(b / l.capaciteit * 100) : 0 };
          }).filter(x => x.pct >= 90).slice(0, 8).map(x => x.naam + ': ' + x.pct + '%') },
        { titel: 'Dossiers met een status, klaar voor een woning',
          items: opvangDossiers().filter(x => x.fase === 'statushouder').slice(0, 8)
            .map(x => x.nummer + ' · ' + x.personen + ' persoon(en)' + (x.kinderen ? ', ' + x.kinderen + ' kind(eren)' : '') + ' · ' + x.locatieNaam) },
        { titel: 'Nieuw aangemeld', items: opvangDossiers().filter(x => x.fase === 'aangemeld').slice(0, 6)
            .map(x => x.nummer + ' · ' + x.locatieNaam) }
      ] }
  };
};
