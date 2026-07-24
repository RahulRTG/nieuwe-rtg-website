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

  return { kamerAdvies };
};
