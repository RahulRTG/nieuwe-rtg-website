/* De Lesmaker: een leraar maakt in een paar tikken lesstof met AI, uit elk
   onderwerp of elke app uit de bibliotheken (School-, App-, Reis- en
   Rijks-Bibliotheek), en zet die meteen live op de klas-PDA: de kinderen
   doen mee op hun eigen scherm (telefoon of iPad) met een klascode.

   Kindveilig, bewust simpel:
   - kinderen doen mee met code + voornaam; geen accounts, geen chat, alleen
     antwoorden geven en de eigen score zien
   - de leraar houdt de regie: hij start elke vraag zelf, kan pauzeren en
     sluit de les af; de AI maakt de stof, de leraar beslist wat er staat
   - zonder API-sleutel een nette demo-les, met sleutel echte AI-lesstof
   - lessen verlopen vanzelf na zes uur; niets blijft rondslingeren */

const VERVAL_MS = 6 * 3600000;
const MAX_LESSEN = 500;
const MAX_KINDEREN = 40;

module.exports = ({ db, save, crypto, schoon, anthropic, leeftijdInstr }) => {
  const L = () => { if (!db.data.lessen) db.data.lessen = {}; return db.data.lessen; };
  const nu = () => Date.now();
  const code = (n) => { let s = ''; const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for (let i = 0; i < n; i++) s += A[crypto.randomInt(0, A.length)]; return s; };

  function opruimen() {
    const l = L();
    for (const [c, les] of Object.entries(l)) if (nu() - les.at > VERVAL_MS) delete l[c];
    const codes = Object.keys(l);
    if (codes.length > MAX_LESSEN) for (const c of codes.slice(0, codes.length - MAX_LESSEN)) delete l[c];
  }

  // de demo-les: eerlijk bruikbare stof zonder API-sleutel, uit het onderwerp zelf
  const demoLes = require('./lesmaker-demo'); // de vaste demo-les (pure functie)

  async function maakLes({ onderwerp, niveau, app } = {}) {
    opruimen();
    const o = schoon(String(onderwerp || ''), 120);
    if (!o || o.length < 2) return { status: 400, error: 'Geef eerst een onderwerp (of kies een app uit de bibliotheek).' };
    const groep = ['mini', 'kind', 'tiener', 'jong', 'volw'].includes(niveau) ? niveau : 'kind';
    const appNaam = schoon(String(app || ''), 120);
    let stof = null;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 1200,
          system: 'Je bent een ervaren lesontwerper. Maak korte, warme, feitelijk juiste lesstof in het Nederlands. ' +
            'Antwoord UITSLUITEND met geldige JSON: {"titel":"...","uitleg":"(120-180 woorden, direct tot de klas)","vragen":[{"v":"...","opties":["a","b","c","d"],"juist":0..3} x6]}. ' +
            'Wissel de positie van het juiste antwoord. Geen gevoelige of onveilige inhoud; dit is voor een klas. ' +
            (leeftijdInstr ? leeftijdInstr(groep) : ''),
          messages: [{ role: 'user', content: 'Onderwerp: ' + o + (appNaam ? '\nDe les hoort bij de app "' + appNaam + '" uit onze bibliotheek; verwerk waar de app bij helpt.' : '') }] });
        const uit = (r.content || []).map(b => b.text || '').join('');
        const j = JSON.parse(uit.slice(uit.indexOf('{'), uit.lastIndexOf('}') + 1));
        if (j && j.titel && Array.isArray(j.vragen) && j.vragen.length >= 3) {
          stof = { titel: schoon(j.titel, 120), uitleg: schoon(j.uitleg, 1500),
            vragen: j.vragen.slice(0, 8).map(x => ({ v: schoon(x.v, 300), opties: (x.opties || []).slice(0, 4).map(y => schoon(y, 120)), juist: Math.min(3, Math.max(0, Number(x.juist) || 0)) }))
              .filter(x => x.v && x.opties.length === 4) };
          if (stof.vragen.length < 3) stof = null;
        }
      } catch (e) { /* val terug op de demo-les */ }
    }
    if (!stof) stof = demoLes(o, groep);
    const c = code(6);
    L()[c] = { code: c, leraarToken: code(12), onderwerp: o, app: appNaam || null, niveau: groep,
      titel: stof.titel, uitleg: stof.uitleg, vragen: stof.vragen, demo: !!stof.demo,
      fase: 'lobby', vraagIx: -1, vraagStart: 0, volg: 0, deelnemers: {}, at: nu() };
    save();
    const les = L()[c];
    return { status: 200, code: c, leraarToken: les.leraarToken, les: leraarBeeld(les) };
  }

  const vind = (c) => L()[String(c || '').trim().toUpperCase()] || null;
  const alsLeraar = (c, tok) => { const les = vind(c); return les && les.leraarToken === String(tok || '') ? les : null; };

  function stand(les) {
    return Object.entries(les.deelnemers).map(([naam, d]) => ({ naam, score: d.score, beantwoord: d.antwoorden.length }))
      .sort((a, b) => b.score - a.score);
  }
  function leraarBeeld(les) {
    return { code: les.code, titel: les.titel, uitleg: les.uitleg, onderwerp: les.onderwerp, app: les.app,
      niveau: les.niveau, demo: les.demo, fase: les.fase, vraagIx: les.vraagIx, volg: les.volg,
      vragen: les.vragen, aantal: Object.keys(les.deelnemers).length, stand: stand(les),
      // per vraag hoeveel kinderen wat kozen (voor het klassenbord van de leraar)
      keuzes: les.vraagIx >= 0 ? [0, 1, 2, 3].map(k => Object.values(les.deelnemers).filter(d => (d.antwoorden[les.vraagIx] || {}).keuze === k).length) : null };
  }

  function leraar(c, tok) {
    const les = alsLeraar(c, tok);
    if (!les) return { status: 403, error: 'Onbekende les of verkeerde leraarsleutel.' };
    return { status: 200, les: leraarBeeld(les) };
  }
  function volgende(c, tok) {
    const les = alsLeraar(c, tok);
    if (!les) return { status: 403, error: 'Onbekende les of verkeerde leraarsleutel.' };
    if (les.vraagIx + 1 >= les.vragen.length) { les.fase = 'klaar'; }
    else { les.vraagIx += 1; les.fase = 'vraag'; les.vraagStart = nu(); }
    les.volg += 1; save();
    return { status: 200, les: leraarBeeld(les) };
  }
  function sluit(c, tok) {
    const les = alsLeraar(c, tok);
    if (!les) return { status: 403, error: 'Onbekende les of verkeerde leraarsleutel.' };
    les.fase = 'klaar'; les.volg += 1; save();
    return { status: 200, les: leraarBeeld(les) };
  }

  /* ---- de kinderkant: meedoen, kijken, antwoorden ---- */
  function doeMee(c, naam) {
    opruimen();
    const les = vind(c);
    if (!les) return { status: 404, error: 'Deze klascode bestaat niet (meer). Vraag de juf of meester om de code op het bord.' };
    const n = schoon(String(naam || ''), 24).trim();
    if (!n) return { status: 400, error: 'Vul eerst je voornaam in.' };
    // een bezette naam wordt geweigerd: anders kon je met andermans naam
    // andermans plek (en score) overnemen
    if (les.deelnemers[n]) return { status: 400, error: 'Die naam is al bezet; zet er een letter achter.' };
    if (Object.keys(les.deelnemers).length >= MAX_KINDEREN) return { status: 400, error: 'De klas zit vol (' + MAX_KINDEREN + ').' };
    les.deelnemers[n] = { token: code(10), score: 0, antwoorden: [] };
    les.volg += 1; save();
    return { status: 200, deelnemerToken: les.deelnemers[n].token, naam: n, les: kindBeeld(les, n) };
  }
  const alsKind = (c, naam, tok) => {
    const les = vind(c); if (!les) return null;
    const d = les.deelnemers[String(naam || '')];
    return d && d.token === String(tok || '') ? { les, d, naam: String(naam) } : null;
  };
  function kindBeeld(les, naam) {
    const d = les.deelnemers[naam];
    const vraag = les.fase === 'vraag' ? les.vragen[les.vraagIx] : null;
    const eigen = d && les.vraagIx >= 0 ? d.antwoorden[les.vraagIx] : null;
    return { code: les.code, titel: les.titel, uitleg: les.fase === 'lobby' ? les.uitleg : undefined,
      fase: les.fase, vraagIx: les.vraagIx, totaalVragen: les.vragen.length, volg: les.volg,
      vraag: vraag ? { v: vraag.v, opties: vraag.opties } : null,           // NOOIT het juiste antwoord meesturen
      beantwoord: !!eigen, goedFout: eigen ? eigen.goed : null,
      score: d ? d.score : 0, stand: les.fase === 'klaar' ? stand(les).slice(0, 10) : undefined };
  }
  function kijk(c, naam, tok) {
    const s = alsKind(c, naam, tok);
    if (!s) return { status: 403, error: 'Doe eerst mee met de klascode en je naam.' };
    return { status: 200, les: kindBeeld(s.les, s.naam) };
  }
  function antwoord(c, naam, tok, keuze) {
    const s = alsKind(c, naam, tok);
    if (!s) return { status: 403, error: 'Doe eerst mee met de klascode en je naam.' };
    const { les, d } = s;
    if (les.fase !== 'vraag') return { status: 400, error: 'Er staat nu geen vraag open; wacht op de juf of meester.' };
    if (d.antwoorden[les.vraagIx]) return { status: 400, error: 'Je hebt deze vraag al beantwoord.' };
    const k = Math.min(3, Math.max(0, Number(keuze) || 0));
    const goed = k === les.vragen[les.vraagIx].juist;
    // snelheid telt een beetje mee, kennis het meest: 100 basis + max 50 tempo
    const tempo = Math.max(0, 50 - Math.floor((nu() - les.vraagStart) / 1000));
    const punten = goed ? 100 + tempo : 0;
    d.antwoorden[les.vraagIx] = { keuze: k, goed, punten };
    d.score += punten;
    les.volg += 1; save();
    return { status: 200, goed, punten, score: d.score };
  }

  return { lesmaker: { maakLes, leraar, volgende, sluit, doeMee, kijk, antwoord } };
};
