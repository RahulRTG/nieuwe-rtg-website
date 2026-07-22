/* Overheid-domein "rechtbank", deel AI-griffier: helpt de griffie en de
   rechters met het beeld, de rol en de voorbereiding, kort en precies. Oordeelt
   NOOIT en geeft partijen geen juridisch advies; de rechter beslist altijd zelf.
   Afgesplitst uit rechtbank.js zodat elk deel klein blijft; krijgt het cockpit-
   beeld en de gedeelde helpers via de context. */
module.exports = (ctx) => {
  const { anthropic, schoon, rbCockpit } = ctx;

  return async function rbAI(vraag) {
    const c = rbCockpit();
    const beeld = c.zaken + ' zaken (' + Object.entries(c.perStatus).map(([k, v]) => v + ' ' + k).join(', ') + '), ' +
      c.rolVandaag + ' op de rol van vandaag, gemiddelde doorlooptijd ' + c.doorloopDagen + ' dagen, ' +
      c.beroepenWachtend + ' ongegronde bezwaren zonder beroep. Signalen: ' +
      (c.signalen.length ? c.signalen.slice(0, 5).map(s => s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-griffier van De Rechtspraak op het RTG-platform. ' +
            'Je helpt de griffie en de rechters met de rol, de planning en de voorbereiding van zittingen, kort en precies. ' +
            'Je oordeelt NOOIT over een zaak en doet geen uitspraak: de rechter beslist altijd zelf. ' +
            'Je geeft partijen geen juridisch advies; dit is het interne huis. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld van vandaag: ' + beeld + ' Mijn advies: plan eerst de zaken die het langst wachten, en loop de rol van vandaag na met de bode. Oordelen doet de rechter zelf.' };
  };
};
