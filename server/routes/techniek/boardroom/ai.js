/* RTG Boardroom, deel "ai": de AI-hulp (Rahul) die een instructie in gewone taal
   begrijpt en een wijzigingsvoorstel maakt voor de schakelkast -- schakelen per
   pas/doelgroep/genre en de geld-regie (pasprijzen, ledenvoordeel, partner-
   vergoeding). Er verandert zelf niets; de eigenaar past het voorstel toe (mens
   beslist). Afgesplitst uit boardroom/index.js; db en anthropic komen binnen. */
const functies = require('../../../functies');
module.exports = (ctx) => {
  const { db, anthropic } = ctx;
  const genresLijst = () => Object.entries(db.data.supplierTypes || {}).map(([id, tp]) => ({ id, label: tp.label }));
  async function boardroomAi(vraag, t) {
    const lokaal = functies.duidVoorstel(vraag, t.functies, { genres: genresLijst() });
    let antwoord = null, voorstel = lokaal.voorstel, bron = 'ingebouwd';
    if (anthropic) {
      try {
        const catTekst = functies.FUNCTIES.map(f => '- ' + f.id + ' ("' + f.naam + '", categorie ' + f.categorie +
          ', doelgroepen: ' + (f.doelgroepen || []).join('/') + ')').join('\n');
        const dgTekst = functies.DOELGROEPEN.map(d => d.id + ' = ' + d.naam).join(', ');
        const genreTekst = genresLijst().map(g => g.id).join(', ');
        const prompt = require('../../../kern/rahul').RAHUL_LEAD + 'de assistent van de RTG Boardroom (de schakelkast van het platform). De eigenaar kan functies ' +
          'globaal, per doelgroep of per genre zaken aan- of uitzetten, en bepaalt de geldkant (pasprijzen, ledenvoordeel, partnervergoeding).\n' +
          'Doelgroepen: ' + dgTekst + '.\nGenres zaken: ' + genreTekst + '.\nBeschikbare functies:\n' + catTekst +
          '\n\nVraag of instructie: "' + vraag + '"\n\nAntwoord kort in het Nederlands (max 4 zinnen). Vraagt de instructie om een ' +
          'wijziging, geef daarna EEN codeblok met een lijst wijzigingen in deze vormen:\n```json\n{"voorstel":[' +
          '{"id":"<functie-id>","doelgroep":"<doelgroep-id of null>","aan":true},' +
          '{"id":"<functie-id>","genre":"<genre-id>","aan":false},' +
          '{"soort":"pasprijs","pas":"rtg|lifestyle","euro":65},' +
          '{"soort":"korting","genre":"<genre-id>","pct":10},' +
          '{"soort":"commissie","genre":"<genre-id>","pct":8}]}\n```\n' +
          'Gebruik uitsluitend bestaande id\'s; laat doelgroep leeg (null) voor een globale wijziging. De gratis app blijft altijd ' +
          'gratis en de Business Pass is prijs op maat: stel daar nooit een prijs voor voor. Geen codeblok als er niets te wijzigen valt.';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
        const tekst = (r.content && r.content[0] && r.content[0].text) || '';
        antwoord = tekst.replace(/```json[\s\S]*?```/g, '').trim();
        const m = tekst.match(/```json\s*([\s\S]*?)```/);
        if (m) { try { const j = JSON.parse(m[1]); if (j && Array.isArray(j.voorstel)) voorstel = j.voorstel; } catch (e) {} }
        bron = 'ai';
      } catch (e) { antwoord = null; bron = 'ingebouwd'; }
    }
    if (!antwoord) antwoord = lokaal.uitleg;
    return { antwoord, voorstel: functies.valideerVoorstel(voorstel), bron };
  }
  return { genresLijst, boardroomAi };
};
