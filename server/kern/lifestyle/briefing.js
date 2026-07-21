/* Lifestyle, deelbestand "briefing": het overkoepelende Rechterhand-overzicht
   (verzoeken, volgende afspraak, het register en de attentiepunten op een
   regel) en de briefing van Rahul in de u-vorm -- die noteert en verwijst,
   maar NOOIT een boeking of toegang belooft die hij niet zeker kan waarmaken.
   Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { anthropic, liveCodename, schoon, vandaag, L, bezittingen, gezondheid } = ctx;

  function overzicht(key) {
    const l = L(key);
    const open = l.verzoeken.filter(v => v.status !== 'afgerond' && v.status !== 'ingetrokken');
    const gz = gezondheid(key);
    const bez = bezittingen(key);
    return {
      status: 200,
      naam: liveCodename ? liveCodename(key) : '',
      verzoekenOpen: open.length,
      laatsteVerzoek: l.verzoeken[0] || null,
      volgendeAfspraak: gz.volgende,
      bezittingen: bez.bezittingen.length, bezittingenWaarde: bez.totaalWaarde,
      attenties: bez.attenties,
      voorkeurenGezet: Object.keys(l.voorkeuren).filter(k => l.voorkeuren[k]).length
    };
  }

  async function lifestyleAI(key, vraag) {
    const q = schoon(vraag, 400);
    const o = overzicht(key);
    const samenvatting = 'Open verzoeken: ' + o.verzoekenOpen +
      (o.volgendeAfspraak ? '. Volgende afspraak: ' + o.volgendeAfspraak.wat + ' op ' + o.volgendeAfspraak.datum : '') +
      (o.attenties.length ? '. Attentiepunten in het register: ' + o.attenties.length : '') + '.';
    if (anthropic && q) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 320,
          system: require('../rahul').rahulLeadVoor(key) + 'u bent De Rechterhand van dit Lifestyle Pass-lid: hun persoonlijke chef de bureau. ' +
            'Spreek het lid consequent aan met "u". Voorkomend, discreet en to the point. U regelt en noteert, maar u belooft NOOIT een boeking, ' +
            'tafel, toegang of levertijd die u niet zeker kunt waarmaken: u noteert het verzoek en zegt dat een van onze mensen het persoonlijk oppakt. ' +
            'U verzint geen namen van partners of prijzen. Context (prive): ' + samenvatting,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) return { status: 200, ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { status: 200, ok: true, demo: true,
      antwoord: 'Tot uw dienst. ' + samenvatting + ' Zeg mij waarmee ik u kan helpen, dan noteer ik het en pakt een van onze mensen het persoonlijk op. Een boeking bevestig ik pas als die rond is.' };
  }

  return { lifestyleOverzicht: overzicht, lifestyleAI };
};
