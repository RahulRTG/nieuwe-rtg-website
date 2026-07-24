/* Afdelingen (deelmodule): "Rahul denkt mee in deze kamer". Per afdelingskamer
   leest deze laag de echte cijfers van die kamer -- de KPI's, de werklijsten, de
   open taken en de verbeterkamer-voorstellen die op die kamer slaan -- en maakt
   er eerst een regelgebaseerd advies van. Met een sleutel legt Rahul daar een
   korte, kamer-specifieke reflectie overheen (dezelfde stem als overal).

   Nadrukkelijk ADVISEREND, net als de rampbeeld-coordinator: Rahul beslist
   niets en schakelt niets; hij benoemt wat opvalt en stelt een volgende stap
   voor. De mens in de kamer beslist. Krijgt de gedeelde ctx van
   kern/afdelingen.js (na de boardroomlaag, want hij leunt op voorstellen()). */
module.exports = (ctx) => {
  const { anthropic, AFDELINGEN, kamer, taken, voorstellen } = ctx;
  const rahul = require('../rahul');

  // De voorstellen uit de dagronde die op deze kamer slaan (of op de boardroom,
  // die overkoepelend is) -- zo krijgt Rahul dezelfde signalen als de eigenaar.
  function voorstellenVoor(id) {
    const v = (voorstellen(false) || {}).voorstellen || [];
    return v.filter(x => x.kamer === id || x.kamer === 'boardroom').map(x => x.tekst);
  }

  // Het regelgebaseerde advies: puur uit de eigen cijfers, altijd iets zinnigs,
  // ook zonder AI-sleutel. Kort en concreet, geen verzonnen getallen.
  function regelAdvies(k, open, sig) {
    const uit = [];
    for (const s of sig.slice(0, 4)) uit.push(s);
    if (open.length >= 5) uit.push(open.length + ' taken staan open in deze kamer; kies de drie die vandaag het meest opleveren en parkeer de rest bewust.');
    else if (!open.length) uit.push('Geen open taken -- goed moment om vooruit te kijken: wat wordt volgende week het knelpunt in ' + k.naam.toLowerCase() + '?');
    // een KPI die op nul staat is vaak een signaal (niets in beweging of net leeg)
    for (const kpi of (k.kpis || []).slice(0, 5)) {
      const w = String(kpi.waarde);
      if ((w === '0' || w === '0,0') && /open|storing|wacht|paniek|behandeling/i.test(kpi.label)) uit.push('"' + kpi.label + '" staat op nul -- niets blijft liggen; houd dat zo.');
    }
    if (!uit.length) uit.push('De kamer draait rustig; geen knelpunten in de cijfers van dit moment.');
    return uit;
  }

  async function kamerAdvies(id, vraag) {
    if (!AFDELINGEN[id]) return { status: 404, error: 'Deze kamer bestaat niet.' };
    const k = kamer(id);
    if (k.error) return k;
    const open = taken(id).filter(t => !t.af);
    const sig = voorstellenVoor(id);
    const regels = regelAdvies(k, open, sig);
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);

    if (anthropic) {
      try {
        const kpiTekst = (k.kpis || []).map(x => x.label + ': ' + x.waarde).join('; ');
        const lijstTekst = (k.lijsten || []).map(l => l.titel + ' (' + (l.items || []).length + ')').join('; ');
        const beeld = 'Kamer: ' + k.naam + '. Missie: ' + k.missie + '. Cijfers nu: ' + kpiTekst +
          '. Werklijsten: ' + lijstTekst + '. Open taken: ' + open.length +
          '. Signalen uit de dagronde: ' + (sig.length ? sig.join(' | ') : 'geen') +
          '. Voorlopige punten: ' + regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: rahul.RAHUL_LEAD + 'je denkt mee met de mensen in deze RTG-kantoorkamer. Je geeft KORT en concreet je blik op waar de aandacht heen moet, in hooguit drie punten, in gewone taal. ' +
            'Je BESLIST NOOIT en schakelt niets: je adviseert, de mensen in de kamer beslissen zelf. Verzin geen getallen of gebeurtenissen die niet in het beeld staan; is er weinig aan de hand, zeg dat rustig. Situatie: ' + beeld,
          messages: [{ role: 'user', content: v || 'Waar zou je vandaag als eerste naar kijken in deze kamer?' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, kamer: k.naam, antwoord: t, punten: regels };
      } catch (e) { /* de regelterugval hieronder */ }
    }
    return { ok: true, kamer: k.naam, antwoord: 'Waar ik naar zou kijken (u beslist zelf): ' + regels.join(' '), punten: regels };
  }

  /* Rahul over het hele huis: dezelfde stem, maar nu overkoepelend voor de
     boardroom. Hij leest de verbeterkamer-signalen (per kamer) en de open
     taken per kamer, en zegt waar de boardroom vandaag de aandacht zou leggen
     en welke kamer de meeste druk voelt. Adviserend; de boardroom beslist. */
  async function boardroomAdvies(vraag) {
    const sig = ((voorstellen(false) || {}).voorstellen || []).map(x => (x.kamer ? x.kamer + ': ' : '') + x.tekst);
    // per kamer het aantal open taken, om de drukste kamers te benoemen
    const druk = Object.keys(AFDELINGEN).map(id => ({ id, naam: AFDELINGEN[id].naam, open: taken(id).filter(t => !t.af).length }))
      .filter(x => x.open > 0).sort((a, b) => b.open - a.open);
    const regels = [];
    for (const s of sig.slice(0, 6)) regels.push(s);
    if (druk.length) regels.push('Meeste open taken: ' + druk.slice(0, 3).map(x => x.naam + ' (' + x.open + ')').join(', ') + '.');
    if (!regels.length) regels.push('Over de hele linie geen knelpunten in de dagronde; een rustig huis.');
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);

    if (anthropic) {
      try {
        const beeld = 'Aantal kamers: ' + Object.keys(AFDELINGEN).length +
          '. Signalen uit de dagronde (per kamer): ' + (sig.length ? sig.join(' | ') : 'geen') +
          '. Drukte per kamer (open taken): ' + (druk.length ? druk.map(x => x.naam + ' ' + x.open).join(', ') : 'overal leeg') +
          '. Voorlopige punten: ' + regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 420,
          system: rahul.RAHUL_LEAD + 'je denkt mee met de RTG-boardroom over het hele kantoor. Je geeft KORT en concreet je blik op waar de boardroom vandaag de aandacht zou leggen en welke kamer de meeste druk voelt, in hooguit drie punten, in gewone taal. ' +
            'Je BESLIST NOOIT en schakelt niets: je adviseert, de boardroom beslist zelf. Verzin geen kamers, getallen of gebeurtenissen die niet in het beeld staan; is het rustig, zeg dat. Situatie: ' + beeld,
          messages: [{ role: 'user', content: v || 'Waar zou de boardroom vandaag als eerste naar kijken?' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t, punten: regels };
      } catch (e) { /* de regelterugval hieronder */ }
    }
    return { ok: true, antwoord: 'Waar de boardroom naar zou kijken (u beslist zelf): ' + regels.join(' '), punten: regels };
  }

  return { kamerAdvies, boardroomAdvies };
};
