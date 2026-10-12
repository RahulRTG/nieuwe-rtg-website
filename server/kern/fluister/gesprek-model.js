/* HET MODELANTWOORD VAN HET GESPREK (kern/fluister/gesprek.js) -- de laatste
   stap, als geen eigen regel en geen handeling de vraag pakte.

   Afgesplitst toen gesprek.js tegen de omvanggrens aan liep: dit is het enige
   deel van het gesprek dat met een model praat, en het enige dat de schermregel
   (EDGE.md par. 14.4) leest. Wat hier binnenkomt is al begrensd: de regel is
   afgeleid door kern/stuur/menscontext-uit.js en gaat ONDER de vraag, nooit in
   het gespreksgeheugen.

   Geeft de tekst van het model, of null als er geen model is of het faalt --
   dan valt het gesprek terug op zijn eigen regels. */
'use strict';

module.exports = ({ anthropic, sparHouding, topFocus }) => async function modelAntwoord({ key, codenaam, q, p, stand, seintjes, sch }) {
  if (!anthropic) return null;
  try {
    const ctx = 'Lid: ' + codenaam + '. ' +
      (p.weetjes.length ? 'Weetjes die het lid zelf deelde: ' + p.weetjes.map(w => w.tekst).join('; ') + '. ' : '') +
      (topFocus(p, 3).length ? 'Gebruikt het meest: ' + topFocus(p, 3).join(', ') + '. ' : '') +
      (stand.length ? 'Actuele stand: ' + stand.join('; ') + '. ' : '') +
      (seintjes.length ? 'Actuele seintjes: ' + seintjes.map(x => x.tekst).join('; ') + '.' : '');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5', max_tokens: 300,
      system: require('../rahul').rahulLeadVoor(key) + 'je bent de persoonlijke rechterhand in de RTG-app. Antwoord kort, warm en concreet, in de taal van de vraag. Gebruik het persoonlijke beeld alleen als het helpt. ' + (sparHouding ? sparHouding() + ' ' : '') + 'Context: ' + ctx + (sch ? ' ' + sch.uitleg : ''),
      messages: [...p.gesprek.flatMap(g => [{ role: 'user', content: g.u }, { role: 'assistant', content: g.a }]), { role: 'user', content: sch ? q + '\n\nActieve context: ' + sch.regel : q }]
    });
    return response.content[0].text;
  } catch (e) { return null; }
};
