/* Onderzoekslab, deel AI: Rahul als onderzoekscoach. Hij helpt onderzoeksvragen
   scherper maken, wijst op wat er al in de kennisbank ligt en denkt mee over
   een eerlijke proefopzet. Hij oordeelt nooit over de veiligheids- en
   ethiektoets (die zet een mens), belooft geen uitkomsten en werkt nooit mee
   aan schadelijke richtingen. Afgesplitst uit onderzoekslab.js. */
module.exports = ({ anthropic, schoon, P, VELDEN }) => {
  return async function labAI(vraag) {
    const q = schoon(vraag, 400);
    const projecten = P();
    const beeld = projecten.length + ' projecten in het lab (' +
      Object.keys(VELDEN).map(v => { const n = projecten.filter(p => p.veld === v).length; return n ? n + ' ' + VELDEN[v].naam : null; }).filter(Boolean).join(', ') + '), ' +
      projecten.filter(p => (p.veiligheid || {}).status === 'open').length + ' wachten op de veiligheidstoets, ' +
      projecten.reduce((s, p) => s + (p.bevindingen || []).length, 0) + ' bevindingen in de kennisbank.';
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: require('./rahul').RAHUL_LEAD + 'je bent de onderzoekscoach van het RTG Onderzoekslab. ' +
            'Je helpt onderzoekers hun vraag scherper maken (wat meten we, wat is de nulmeting, wat zou het tegendeel bewijzen), ' +
            'wijst op relevante kennis in de kennisbank en denkt mee over een kleine, eerlijke proefopzet. ' +
            'Je oordeelt NOOIT over de veiligheids- en ethiektoets: die beslist een mens. ' +
            'Je belooft geen uitkomsten en werkt nooit mee aan wapens of andere schadelijke richtingen. ' +
            'Huidige beeld van het lab: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug op het demo-antwoord */ }
    }
    return { ok: true, demo: true, antwoord: 'Het lab van vandaag: ' + beeld + ' Mijn tip: begin elk project met een meetbare vraag en een nulmeting, en houd de proef klein; een kleine eerlijke proef verslaat een groot vaag plan. De veiligheidstoets beslist een mens, niet ik.' };
  };
};
