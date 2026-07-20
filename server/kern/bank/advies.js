/* RTG Bank, deel "advies": de AI-bankier (Rahul). Kijkt naar de rekeningen van het
   lid -- saldi, rood staan, spaargeld tegenover de rente -- en geeft concreet,
   eerlijk advies. De AI adviseert alleen; hij opent geen rekening en verstrekt geen
   krediet (dat besluit een mens). Met een echte sleutel praat Rahul; zonder sleutel
   geeft dezelfde motor een vaste, regel-gebaseerde analyse (demo). Krijgt de gedeelde
   ctx van kern/bank/index.js (met anthropic). */
module.exports = (ctx) => {
  const { anthropic, rekeningen, saldoVan, bankregie } = ctx;
  const euro = c => '€ ' + (Math.round(c) / 100).toFixed(2);

  function beeld(codenaam) {
    const c = String(codenaam || '').trim();
    const eigen = Object.values(rekeningen()).filter(m => m.codenaam === c);
    let betaal = 0, spaar = 0, rood = 0;
    for (const m of eigen) {
      const s = saldoVan(m.iban);
      if (m.soort === 'spaar') spaar += Math.max(0, s);
      else betaal += Math.max(0, s);
      if (s < 0) rood += -s;
    }
    return { c, eigen, betaal, spaar, rood, renteBp: bankregie.bankSpaarrenteBp() };
  }

  // de vaste regels: eerlijk waar het moet, concreet waar het kan
  function tips(b) {
    const uit = [];
    if (!b.eigen.length) return ['U heeft nog geen rekening. Open een betaalrekening om te beginnen; sparen kan er zo naast.'];
    if (b.rood > 0) uit.push('Let op: u staat ' + euro(b.rood) + ' rood. Rood staan kost het meest; vul dit als eerste aan.');
    if (b.betaal > 200000 && b.spaar === 0) uit.push('U houdt ' + euro(b.betaal) + ' op de betaalrekening en spaart nog niet. Zet een deel op een spaarrekening tegen ' + (b.renteBp / 100) + '% rente.');
    if (b.spaar > 0) uit.push('Uw spaargeld levert nu ' + (b.renteBp / 100) + '% per jaar op, ongeveer ' + euro(Math.round(b.spaar * b.renteBp / 10000)) + ' in een jaar bij dit saldo.');
    if (!uit.length) uit.push('Uw rekeningen staan er gezond bij. Een vaste maandelijkse overboeking naar sparen bouwt vanzelf een buffer op.');
    return uit;
  }

  async function advies({ codenaam, vraag }) {
    const b = beeld(codenaam);
    const regels = tips(b);
    const samenvatting = b.eigen.length
      ? 'Betaalgeld ' + euro(b.betaal) + ', spaargeld ' + euro(b.spaar) + (b.rood > 0 ? ', rood ' + euro(b.rood) : '') + '.'
      : 'Nog geen rekeningen.';
    const q = String(vraag || '').trim().slice(0, 500);
    if (anthropic && q) {
      try {
        const context = 'De codenaam van het lid is ' + b.c + '. ' + samenvatting +
          ' Spaarrente ' + (b.renteBp / 100) + '% per jaar. Adviseer, maar beloof nooit een rekening of krediet; dat besluit een mens.';
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 320,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-bankier van RTG Bank. Antwoord kort, concreet en eerlijk over geld, in de taal van de vraag. Context: ' + context,
          messages: [{ role: 'user', content: q }]
        });
        return { ok: true, antwoord: res.content[0].text, samenvatting, tips: regels };
      } catch (e) { /* val terug op de eigen regels */ }
    }
    return { ok: true, antwoord: samenvatting + ' ' + regels.join(' '), samenvatting, tips: regels };
  }

  return { bankAdvies: advies };
};
