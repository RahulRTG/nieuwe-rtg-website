/* Vakwerk, deelbestand "advies": de genre-bewuste AI-assistent. Een regelgebaseerd
   advies dat altijd werkt (ook zonder AI-sleutel) plus de Claude-adviseur die met de
   persona van het genre (zzp/chef/wellness) meedenkt over agenda, aanbod en omzet.
   Werkt alleen met de echte cijfers uit het bord; verzint niets, en klanten blijven op
   codenaam. Krijgt de gedeelde ctx van kern/vakwerk/index.js. */
module.exports = (ctx) => {
  const { anthropic, bord, VAK_GENRES } = ctx;

  /* De regelgebaseerde adviezen: werkt altijd, ook zonder AI-sleutel. */
  function regelAdvies(b, g) {
    const a = [];
    if (b.teBevestigen.length) a.push(b.teBevestigen.length + ' ' + (b.teBevestigen.length === 1 ? 'aanvraag wacht' : 'aanvragen wachten') + ' op je bevestiging; bevestig ze zodat het lid zekerheid heeft.');
    if (b.vandaag.length) a.push('Vandaag staan er ' + b.vandaag.length + ' ' + g.werkMv + (b.vandaag[0].tijd ? ', de eerste om ' + b.vandaag[0].tijd : '') + '.');
    if (b.zonderDatum.length) a.push(b.zonderDatum.length + ' ' + (b.zonderDatum.length === 1 ? 'boeking heeft' : 'boekingen hebben') + ' nog geen datum; plan een moment met het lid.');
    if (!b.aanbod.length) a.push('Je aanbod is nog leeg. Zet je eerste ' + (g.werk === 'behandeling' ? 'behandeling' : 'dienst') + ' in de app zodat leden kunnen boeken.');
    else {
      const stil = b.aanbod.filter(x => !x.boekingen);
      if (stil.length) a.push(stil.length + ' van je ' + b.aanbod.length + ' aanbod-items zijn nog nooit geboekt; overweeg de omschrijving of prijs aan te scherpen.');
    }
    if (b.kpi.omzetWeek > 0) a.push('Omzet deze week: € ' + b.kpi.omzetWeek.toFixed(2) + ' (deze maand € ' + b.kpi.omzetMaand.toFixed(2) + ').');
    if (!a.length) a.push('Rustig beeld: geen open aanvragen en niets vandaag. Goed moment om je aanbod of de Salon-pagina bij te werken.');
    return a;
  }

  async function adviseur(code, vraag) {
    const b = bord(code);
    if (b.error) return b;
    const g = VAK_GENRES[b.genre];
    const regels = regelAdvies(b, g);
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 400);
    if (anthropic) {
      try {
        const situatie = 'Genre: ' + g.label + '. Vandaag ' + b.vandaag.length + ' ' + g.werkMv +
          ', ' + b.teBevestigen.length + ' open aanvragen, ' + b.zonderDatum.length + ' zonder datum. ' +
          'Aanbod: ' + (b.aanbod.map(x => x.name + ' (€' + x.price + (x.duurMin ? ', ' + x.duurMin + 'min' : '') + ', ' + x.boekingen + 'x)').join('; ') || 'nog leeg') + '. ' +
          'Omzet week €' + b.kpi.omzetWeek.toFixed(0) + ', maand €' + b.kpi.omzetMaand.toFixed(0) + ', gemiddelde bon €' + b.kpi.gemBon.toFixed(0) + '. ' +
          'Overzicht van de adviezen: ' + regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 450,
          system: require('../rahul').RAHUL_LEAD + g.persona +
            ' Antwoord kort en concreet in het Nederlands. Werk alleen met de gegevens die je krijgt, verzin geen boekingen of omzet. Klanten staan op codenaam; noem nooit een echte naam. Situatie: ' + situatie,
          messages: [{ role: 'user', content: v || 'Waar moet ik me vandaag op richten?' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t, voorstellen: regels };
      } catch (e) { /* val terug op de regels */ }
    }
    return { ok: true, antwoord: regels.join(' '), voorstellen: regels };
  }

  return { adviseur };
};
