/* Spellen (deelmodule): wat er weggaat -- vanzelf, en op verzoek.

   Twee dingen die er niet uitzien als één onderwerp en dat wel zijn: het potje
   dat vanzelf verdwijnt omdat er niets meer mee gebeurt, en het potje dat
   verdwijnt omdat een van de spelers zich laat verwijderen. Allebei antwoorden
   ze op dezelfde vraag -- wanneer houdt een partij op te bestaan? -- en ze
   leunen op precies dezelfde kennis van de opslag.

   OPSCHONEN: klare potjes na een dag, wachtenden na zes uur, verlaten partijen
   na dertig dagen. Die laatste ontbrak, en dat was geen detail: een potje met
   status 'bezig' werd NOOIT opgeruimd. Twee spelers die een partij laten liggen
   lieten hem voor altijd staan, met hun beide sleutels erin -- ongebonden groei
   en een bewaarprobleem in een. Gemeten op de laatste ZET (`zetAt`) en niet op
   het aanmaken, want anders zou een lange, levende partij ook verdwijnen; een
   ouder potje zonder dat stempel valt terug op `at`. Hooguit een keer per
   minuut: de scan over alle potjes hoort niet in het hete pad van elke
   lobby-poll.

   VERGETEN: WEGGAAN TELT ALS OPGEVEN, en dat is geen nieuw gedrag maar hetzelfde
   als wat de knop "opgeven" doet. Wie vertrekt maakt de partij niet af, en dat
   IS opgeven; de tegenstander wint en die overwinning landt in de uitslagen. Het
   alternatief -- het potje stilletjes laten verdwijnen -- zou de ander een
   partij afnemen die hij aan het winnen kon zijn.

   Het potje zelf gaat daarna weg en blijft dus niet de gebruikelijke dag staan.
   Dat kan ook niet: `spelers` bestaat uit sleutels, en een potje laten staan
   waarin de sleutel van een verwijderd lid zit is precies wat we hier weghalen.
   De uitslag blijft wel, met de vertrekker erin als `{ anoniem: true }` -- mits
   het wisbeleid deze functie AANROEPT vóór het anonimiseren van de uitslagen, en
   die volgorde staat in vergeten/anoniem.js.

   DE DEELTAKKEN RUIMEN ZICHZELF OP. Toernooien, replays, teams en de arcade
   kennen elk hun eigen vorm van opslag en krijgen hier alleen een zetje. Dat is
   met opzet: wie de vorm kent, hoort hem op te ruimen -- anders staat er hier
   een kopie van vier datamodellen die stil veroudert. */
module.exports = (ctx) => {
  const { S, save, codenaamVan, noteerUitslag, deelVergeet, sudokuOpschonen } = ctx;

  const VERLATEN_MS = 30 * 86400000;
  let opgeschoondOm = 0;

  function opschonen() {
    const t = Date.now();
    if (t - opgeschoondOm < 60000) return;
    opgeschoondOm = t;
    const s = S();
    if (typeof sudokuOpschonen === 'function') sudokuOpschonen(t);   // een sudoku die je laat staan verdwijnt ook
    for (const [id, p] of Object.entries(s.potjes)) {
      const leeftijd = t - new Date(p.at).getTime();
      const stil = t - new Date(p.zetAt || p.at).getTime();
      if ((p.status === 'klaar' && leeftijd > 86400000) ||
          (p.status === 'wacht' && leeftijd > 6 * 3600000) ||
          (p.status === 'bezig' && stil > VERLATEN_MS)) delete s.potjes[id];
    }
  }

  function spelVergeet(key) {
    if (!key) return { status: 200, ok: true, potjes: 0 };
    const s = S();
    // toernooien, replays, teams en de arcadeborden: elk ruimt zijn eigen tak
    for (const veeg of (deelVergeet || [])) veeg(key);
    for (const [sleutel, rij] of Object.entries(s.wachtrij || {})) {
      const over = (rij || []).filter(x => x !== key);
      if (over.length) s.wachtrij[sleutel] = over; else delete s.wachtrij[sleutel];
    }
    let geraakt = 0;
    for (const [id, p] of Object.entries(s.potjes || {})) {
      if (!Array.isArray(p.spelers) || !p.spelers.includes(key)) continue;
      geraakt++;
      if (p.status !== 'klaar') {
        const rest = p.spelers.filter(x => x !== key);
        p.status = 'klaar';
        p.gelijk = false;
        p.winnaar = rest.length ? (rest.length === 1 ? codenaamVan(rest[0]) : rest.map(codenaamVan).join(' & ')) : null;
        noteerUitslag(p);
      }
      delete s.potjes[id];
    }
    save();
    return { status: 200, ok: true, potjes: geraakt };
  }

  return { opschonen, spelVergeet };
};
