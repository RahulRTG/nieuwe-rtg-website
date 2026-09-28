/* De stuurlus als contextpakket (../ai/contextpakket.js).

   Een beurt van ./lus.js groeit met elke stap: het model vraagt een
   gereedschap, de uitkomst (tot 6000 tekens) gaat terug, en na vier stappen
   draagt het gesprek een veelvoud van de vraag. Bij een klein venster kapte de
   modelserver dan stil het BEGIN af -- de huisregels en de opdracht zelf.

   Wat hier vastligt:
   - de huisregels (`systeem`) en de opdracht zijn verplicht;
   - het LAATSTE paar (vraag om gereedschap + uitkomst) is verplicht, want daar
     reageert het model op;
   - oudere paren zijn FEITEN die worden INGEKORT tot het begin van hun
     uitkomst, met een zichtbare markering -- en nooit weggelaten. Wat het model
     al heeft GEDAAN moet het blijven zien: een lus die vergeet dat hij een
     afspraak al had gezet, zet hem nog een keer. Past het dan nog niet, dan
     stopt de lus met CONTEXT_PAST_NIET. Een paar gaat altijd in zijn geheel:
     een tool_result zonder zijn tool_use is een kapot gesprek.
   Het origineel wordt niet aangeraakt; dit bouwt per beurt een nieuwe weergave. */
'use strict';
const { stelContextSamen } = require('../ai/contextpakket');

const KORT_TEKENS = 400;

function inkort(bericht) {
  if (!Array.isArray(bericht.content)) return bericht;
  return Object.assign({}, bericht, { content: bericht.content.map((c) => {
    if (!c || c.type !== 'tool_result' || typeof c.content !== 'string' || c.content.length <= KORT_TEKENS) return c;
    return Object.assign({}, c, { content: c.content.slice(0, KORT_TEKENS) +
      ' ... [ingekort door de contextsamensteller: ' + (c.content.length - KORT_TEKENS) + ' van ' + c.content.length + ' tekens weggelaten]' });
  }) });
}

function lusPakket({ systeem, messages, tools, venster, antwoord }) {
  const lijst = messages || [];
  const blokken = [{ id: 'huisregels', soort: 'grondwet', verplicht: true, tekst: systeem || '', bron: 'kern/stuur/lusregels.js' }];
  if (lijst.length) blokken.push({ id: 'opdracht', soort: 'opdracht', verplicht: true, berichten: [lijst[0]], bron: 'mens' });
  const paren = [];
  for (let i = 1; i < lijst.length; i += 2) paren.push(lijst.slice(i, i + 2));
  paren.forEach((paar, p) => {
    const laatste = p === paren.length - 1;
    blokken.push(laatste
      ? { id: 'stap.' + p, soort: 'feiten', verplicht: true, berichten: paar, bron: 'gereedschap', graad: 'gemeten' }
      : { id: 'stap.' + p, soort: 'feiten', prioriteit: p, berichten: paar, bron: 'gereedschap', graad: 'gemeten',
        magSamenvatten: true, magVervallen: false, kort: paar.map(inkort) });
  });
  return stelContextSamen({ blokken, venster, antwoord, gereedschap: tools });
}

module.exports = { lusPakket, inkort };
