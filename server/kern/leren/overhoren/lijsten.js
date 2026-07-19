/* Leren-overhoren, deel "lijsten" (kern/leren): de woordenlijsten - maken,
   ophalen, wissen, de beste score bijhouden en een lijst door de AI laten maken
   (met nette demo-setjes als er geen sleutel is). Verbatim afgesplitst uit
   overhoren.js. */
module.exports = (ctx) => {
  const { save, sociaalRate, anthropic, leeftijdInstr, rid, nu, schoon, L } = ctx;

  function lijstenVan(mij) {
    return { status: 200, lijsten: Object.values(L().lijsten).filter(l => l.van === mij)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .map(l => ({ id: l.id, naam: l.naam, aantal: l.paren.length, beste: l.beste || null, at: l.at })) };
  }
  function lijstMaak(mij, { naam, paren }) {
    const p = (Array.isArray(paren) ? paren : []).map(x => ({ v: schoon(x.v, 120), a: schoon(x.a, 120) })).filter(x => x.v && x.a).slice(0, 100);
    if (p.length < 2) return { status: 400, error: 'Een lijst heeft minstens twee vraag-antwoordparen nodig.' };
    if (Object.values(L().lijsten).filter(l => l.van === mij).length >= 50) return { status: 400, error: 'Je hebt al vijftig lijsten; ruim er eerst een op.' };
    const l = { id: rid(5), van: mij, naam: schoon(naam, 60) || 'Mijn lijst', paren: p, at: nu() };
    L().lijsten[l.id] = l; save();
    return { status: 200, ok: true, id: l.id, aantal: p.length };
  }
  function lijstHaal(mij, id) {
    const l = L().lijsten[id];
    if (!l || l.van !== mij) return { status: 404, error: 'Deze lijst is er niet (meer).' };
    return { status: 200, lijst: { id: l.id, naam: l.naam, paren: l.paren, beste: l.beste || null } };
  }
  function lijstWeg(mij, id) {
    const l = L().lijsten[id];
    if (!l || l.van !== mij) return { status: 404, error: 'Deze lijst is er niet (meer).' };
    delete L().lijsten[id]; save();
    return { status: 200, ok: true };
  }
  function overhoorKlaar(mij, id, goed, totaal) {
    const l = L().lijsten[id];
    if (!l || l.van !== mij) return { status: 404, error: 'Deze lijst is er niet (meer).' };
    const g = Math.max(0, Math.min(1000, Math.floor(Number(goed) || 0)));
    const t = Math.max(1, Math.min(1000, Math.floor(Number(totaal) || 0)));
    if (!l.beste || g / t > l.beste.goed / l.beste.totaal) { l.beste = { goed: g, totaal: t, at: nu() }; save(); }
    return { status: 200, ok: true, beste: l.beste };
  }

  /* De AI maakt een lijst over een onderwerp; zonder sleutel valt hij terug op
     nette kant-en-klare setjes, zodat de knop in de demo gewoon werkt. */
  const DEMO_LIJSTEN = [
    { test: /hoofdstad|europ/i, naam: 'Hoofdsteden van Europa', paren: [
      { v: 'Nederland', a: 'Amsterdam' }, { v: 'Belgie', a: 'Brussel' }, { v: 'Frankrijk', a: 'Parijs' }, { v: 'Duitsland', a: 'Berlijn' },
      { v: 'Spanje', a: 'Madrid' }, { v: 'Italie', a: 'Rome' }, { v: 'Portugal', a: 'Lissabon' }, { v: 'Polen', a: 'Warschau' },
      { v: 'Griekenland', a: 'Athene' }, { v: 'Noorwegen', a: 'Oslo' }] },
    { test: /engels|english/i, naam: 'Engelse woordjes', paren: [
      { v: 'de hond', a: 'dog' }, { v: 'de kat', a: 'cat' }, { v: 'het huis', a: 'house' }, { v: 'de school', a: 'school' },
      { v: 'het boek', a: 'book' }, { v: 'de vriend', a: 'friend' }, { v: 'het water', a: 'water' }, { v: 'de zon', a: 'sun' },
      { v: 'de maan', a: 'moon' }, { v: 'het brood', a: 'bread' }] },
    { test: /frans/i, naam: 'Franse woordjes', paren: [
      { v: 'de hond', a: 'le chien' }, { v: 'de kat', a: 'le chat' }, { v: 'het huis', a: 'la maison' }, { v: 'het brood', a: 'le pain' },
      { v: 'de kaas', a: 'le fromage' }, { v: 'het water', a: "l'eau" }, { v: 'de school', a: "l'ecole" }, { v: 'de vriend', a: "l'ami" }] },
    { test: /provincie|topo|nederland/i, naam: 'Provincies en hoofdsteden', paren: [
      { v: 'Noord-Holland', a: 'Haarlem' }, { v: 'Zuid-Holland', a: 'Den Haag' }, { v: 'Utrecht', a: 'Utrecht' }, { v: 'Gelderland', a: 'Arnhem' },
      { v: 'Overijssel', a: 'Zwolle' }, { v: 'Friesland', a: 'Leeuwarden' }, { v: 'Groningen', a: 'Groningen' }, { v: 'Drenthe', a: 'Assen' },
      { v: 'Flevoland', a: 'Lelystad' }, { v: 'Noord-Brabant', a: 'Den Bosch' }, { v: 'Limburg', a: 'Maastricht' }, { v: 'Zeeland', a: 'Middelburg' }] },
    { test: /reken|tafel/i, naam: 'De tafels van 6 tot en met 9', paren: [
      { v: '6 x 7', a: '42' }, { v: '7 x 8', a: '56' }, { v: '8 x 9', a: '72' }, { v: '6 x 9', a: '54' },
      { v: '7 x 7', a: '49' }, { v: '8 x 8', a: '64' }, { v: '9 x 9', a: '81' }, { v: '6 x 8', a: '48' }] }
  ];
  async function lijstAi(mij, onderwerp, groep) {
    onderwerp = schoon(onderwerp, 80);
    if (!onderwerp) return { status: 400, error: 'Zeg waarover de lijst moet gaan.' };
    if (!sociaalRate(mij, 'leren-ai', 30, 3600000)) return { status: 429, error: 'Rustig aan; probeer het over een uurtje weer.' };
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 900,
          system: 'Je maakt overhoorlijsten voor leerlingen. Feitelijk juist, korte antwoorden (een woord of getal waar het kan). ' + (leeftijdInstr ? leeftijdInstr(groep) : ''),
          messages: [{ role: 'user', content: 'Maak een overhoorlijst van 10 vraag-antwoordparen over: ' + onderwerp + '. Antwoord ALLEEN met JSON in deze vorm: {"naam":"korte titel","paren":[{"v":"vraag","a":"antwoord"}]}' }] });
        const tekst = (r.content || []).map(b => b.text || '').join('');
        const m = tekst.match(/\{[\s\S]*\}/);
        if (m) {
          const j = JSON.parse(m[0]);
          const uit = lijstMaak(mij, { naam: j.naam || onderwerp, paren: j.paren });
          if (uit.ok) return uit;
        }
      } catch (e) { /* val terug op het demosetje */ }
    }
    const kk = DEMO_LIJSTEN.find(k => k.test.test(onderwerp)) || DEMO_LIJSTEN[0];
    const uit = lijstMaak(mij, { naam: kk.naam, paren: kk.paren });
    return uit.ok ? Object.assign(uit, { demo: true }) : uit;
  }

  return { lijstenVan, lijstMaak, lijstHaal, lijstWeg, overhoorKlaar, lijstAi };
};
