/* RTF-kantoor (deelmodule): "Rahul denkt mee in deze kamer", de tegenhanger van
   kern/afdelingen/kameradvies.js aan RTG-kant. Per kamer leest deze laag de
   echte cijfers van die kamer -- de KPI's, de werklijsten en de open taken --
   en maakt daar eerst een regelgebaseerd advies van. Met een sleutel legt Rahul
   daar een korte reflectie overheen, in dezelfde stem als overal.

   Nadrukkelijk ADVISEREND: Rahul beslist niets en schakelt niets. Hij benoemt
   wat opvalt en stelt een volgende stap voor; de mens in de kamer beslist. En
   hij verzint niets: staat er niets in het beeld, dan zegt hij dat het rustig
   is.

   Krijgt de context van kern/rtfkantoor.js, zodat kamer() en taken() dezelfde
   bron lezen als het kantoor zelf. */
module.exports = (ctx) => {
  const { anthropic, AFDELINGEN, kamer, taken, KAMER_IDS } = ctx;
  const rahul = require('./rahul');

  /* Wat valt er in deze kamer op? Puur uit de eigen cijfers en lijsten. */
  function punten(id) {
    const k = kamer(id);
    if (k.error) return null;
    const regels = [];
    const open = taken(id).filter(t => !t.af);
    if (open.length) regels.push('Er staan ' + open.length + ' taken open; de eerste is: ' + String(open[0].tekst).slice(0, 80) + '.');
    // een KPI op nul is vaak het echte signaal in een stichting: er gebeurt nog niets
    const leeg = k.kpis.filter(x => Number(x.waarde) === 0).map(x => x.label);
    const vol = k.kpis.filter(x => Number(x.waarde) > 0).map(x => x.label + ': ' + x.waarde);
    if (vol.length) regels.push('Loopt: ' + vol.slice(0, 4).join(', ') + '.');
    if (leeg.length) regels.push('Nog op nul: ' + leeg.slice(0, 4).join(', ') + '.');
    const gevuld = (k.lijsten || []).filter(l => (l.items || []).length);
    if (gevuld.length) regels.push('Werklijst: ' + gevuld.map(l => l.titel + ' (' + l.items.length + ')').join(', ') + '.');
    if (!regels.length) regels.push('Deze kamer is rustig: geen open taken en geen lopende lijsten.');
    return { kamer: k, regels };
  }

  /* Het advies voor een kamer. Zonder sleutel blijft het bij de regels; dat is
     geen half antwoord maar gewoon het eerlijke, feitelijke deel. */
  async function kamerAdvies(id, vraag) {
    const p = punten(id);
    if (!p) return { status: 404, error: 'Deze kamer bestaat niet.' };
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);

    if (anthropic) {
      try {
        const beeld = 'Kamer: ' + p.kamer.naam + '. Missie: ' + p.kamer.missie +
          '. Cijfers: ' + p.kamer.kpis.map(x => x.label + ' ' + x.waarde).join(', ') +
          '. Open taken: ' + taken(id).filter(t => !t.af).length +
          '. Voorlopige punten: ' + p.regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 380,
          system: rahul.RAHUL_LEAD + 'je denkt mee in deze kamer van het RTFoundation-kantoor. De stichting werkt met geld van leden: 30% van elke bijdrage. Wees daarom zuinig en zorgvuldig in wat je voorstelt. Geef KORT en concreet wat opvalt en wat een verstandige volgende stap is, in hooguit drie punten, in gewone taal. ' +
            'Je BESLIST NOOIT en schakelt niets: je adviseert, de mens in de kamer beslist. Verzin geen getallen, namen of gebeurtenissen die niet in het beeld staan; is het rustig, zeg dat gewoon. Situatie: ' + beeld,
          messages: [{ role: 'user', content: v || 'Waar zou ik in deze kamer als eerste naar kijken?' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, kamer: p.kamer.naam, antwoord: t, punten: p.regels };
      } catch (e) { /* terugval op de regels hieronder */ }
    }
    return { ok: true, kamer: p.kamer.naam, antwoord: 'Wat opvalt in deze kamer (u beslist zelf): ' + p.regels.join(' '), punten: p.regels };
  }

  /* Het advies over het hele huis: welke kamer voelt de meeste druk. */
  async function huisAdvies(vraag) {
    const druk = KAMER_IDS.map(id => ({ id, naam: AFDELINGEN[id].naam, open: taken(id).filter(t => !t.af).length }))
      .filter(x => x.open > 0).sort((a, b) => b.open - a.open);
    const stil = KAMER_IDS.filter(id => {
      const k = kamer(id);
      return !k.error && k.kpis.every(x => Number(x.waarde) === 0) && !taken(id).filter(t => !t.af).length;
    }).map(id => AFDELINGEN[id].naam);

    const regels = [];
    if (druk.length) regels.push('Meeste open taken: ' + druk.slice(0, 3).map(x => x.naam + ' (' + x.open + ')').join(', ') + '.');
    if (stil.length) regels.push('Nog helemaal stil: ' + stil.slice(0, 4).join(', ') + '.');
    if (!regels.length) regels.push('Over de hele linie geen knelpunten; een rustig huis.');
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);

    if (anthropic) {
      try {
        const beeld = 'Aantal kamers: ' + KAMER_IDS.length +
          '. Drukte per kamer (open taken): ' + (druk.length ? druk.map(x => x.naam + ' ' + x.open).join(', ') : 'overal leeg') +
          '. Nog stille kamers: ' + (stil.length ? stil.join(', ') : 'geen') +
          '. Voorlopige punten: ' + regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 420,
          system: rahul.RAHUL_LEAD + 'je denkt mee over het hele RTFoundation-kantoor. Zeg KORT waar de aandacht vandaag zou liggen en welke kamer de meeste druk voelt, in hooguit drie punten, in gewone taal. ' +
            'Je BESLIST NOOIT en schakelt niets. Verzin geen kamers of getallen die niet in het beeld staan; is het rustig, zeg dat. Situatie: ' + beeld,
          messages: [{ role: 'user', content: v || 'Waar zou ik vandaag als eerste naar kijken?' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t, punten: regels };
      } catch (e) { /* terugval op de regels hieronder */ }
    }
    return { ok: true, antwoord: 'Waar ik naar zou kijken (u beslist zelf): ' + regels.join(' '), punten: regels };
  }

  return { kamerAdvies, huisAdvies };
};
