/* RTG Stad, deel "advies": de AI-stadsregisseur. Leest het hele stadsbeeld --
   standen, regimes, waarschuwingen, de vloot -- en adviseert de boardroom wat
   te doen. De AI ADVISEERT alleen: hij verzet zelf geen regime en drukt nooit
   op de scenario-knop; besluiten over de openbare ruimte neemt een mens. Met
   een echte sleutel praat Rahul; zonder sleutel geeft dezelfde motor een vaste,
   regel-gebaseerde analyse (demo). Krijgt de gedeelde ctx van kern/stad/index.js. */
module.exports = (ctx) => {
  const { anthropic, nu, nodes, regie, ONLINE_MS, DOMEINEN, standVan, alerts } = ctx;

  function foto() {
    const rij = Object.values(nodes()).filter(n => n.actief);
    const online = rij.filter(n => nu() - (n.laatsteContact || 0) < ONLINE_MS).length;
    const standen = DOMEINEN.map(x => {
      const s = standVan(x.id);
      return { id: x.id, label: x.label, eenheid: x.eenheid, regime: regie().regimes[x.id] || x.regimes[0], ...s };
    });
    return { scenario: regie().scenario, standen, alerts: alerts(), vloot: { totaal: rij.length, online } };
  }

  // de vaste regels: concreet, uitlegbaar en nooit een besluit
  function tips(f) {
    const uit = f.alerts.map(a => a.tekst);
    const druk = f.standen.filter(s => s.stand === 'druk').map(s => s.label.toLowerCase());
    if (druk.length >= 3 && f.scenario !== 'druk' && f.scenario !== 'evenement' && f.scenario !== 'nood')
      uit.push('Meerdere domeinen staan op druk (' + druk.join(', ') + '); het scenario "druk" zet de hele stad in een passende stand.');
    if (f.vloot.totaal > 0 && f.vloot.online < f.vloot.totaal)
      uit.push((f.vloot.totaal - f.vloot.online) + ' van de ' + f.vloot.totaal + ' Stadsdozen is offline; plan een onderhoudsronde.');
    const stil = f.standen.filter(s => s.stand === 'stil').map(s => s.label.toLowerCase());
    if (stil.length) uit.push('Nog geen verse metingen voor ' + stil.join(', ') + '; hang daar een Stadsdoos met die sensor.');
    if (!uit.length) uit.push('De stad draait rustig in scenario "' + f.scenario + '". Niets dat nu om een ingreep vraagt.');
    return uit;
  }

  async function advies({ vraag }) {
    const f = foto();
    const regels = tips(f);
    const samenvatting = 'Scenario "' + f.scenario + '"; ' +
      f.standen.filter(s => s.stand !== 'stil').map(s => s.label.toLowerCase() + ' ' + s.stand).join(', ') +
      '; vloot ' + f.vloot.online + '/' + f.vloot.totaal + ' online.';
    const q = String(vraag || '').trim().slice(0, 500);
    if (anthropic && q) {
      try {
        const context = samenvatting + ' Waarschuwingen: ' + (f.alerts.map(a => a.tekst).join(' ') || 'geen.') +
          " Je adviseert alleen; regimes en scenario's verzet een mens in de boardroom. De stad meet dingen, geen mensen.";
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 320,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-stadsregisseur van RTG Stad. Antwoord kort, concreet en eerlijk, in de taal van de vraag. Context: ' + context,
          messages: [{ role: 'user', content: q }]
        });
        return { ok: true, antwoord: res.content[0].text, samenvatting, tips: regels };
      } catch (e) { /* val terug op de eigen regels */ }
    }
    return { ok: true, antwoord: samenvatting + ' ' + regels.join(' '), samenvatting, tips: regels };
  }

  return { stadAdvies: advies };
};
