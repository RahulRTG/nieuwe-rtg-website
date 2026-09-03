/* Genootschap (deelmodule): bijeenkomsten. Een datum, een plek, en wie komt.

   Wat hier NIET zit, en dat is de kern van het ontwerp:
   - geen herinnering die drie keer trekt. Een uitnodiging gaat een keer de deur
     uit; daarna staat de bijeenkomst in de app en is het aan het lid.
   - geen "X en 12 anderen komen" om je over te halen. De aantallen staan er
     omdat een gastheer moet weten hoeveel stoelen hij nodig heeft, niet als
     sociale druk.
   - geen misschien-die-stilletjes-ja-wordt. Misschien is een eigen antwoord dat
     zo blijft staan tot het lid het zelf verandert.

   Wel: een plaatsgrens die eerlijk werkt. Is het vol, dan is het vol -- er
   ontstaat geen wachtlijst die iedereen hoop geeft. Wie afzegt maakt een plaats
   vrij en dat is meteen te zien. */
const { keur } = require('../veilig');

module.exports = ({ db, save, codenaamVan, notify, genootschap }) => {
  const WAT_MAX = 90, WAAR_MAX = 120, TOELICHTING_MAX = 600;
  const PER_GROEP = 120;
  const DATUM = /^\d{4}-\d{2}-\d{2}$/;
  const TIJD = /^\d{2}:\d{2}$/;
  const ANTWOORDEN = ['ja', 'misschien', 'nee'];
  const nu = () => new Date().toISOString();

  /* lijstVan SCHRIJFT: hij zet een lege rij neer voor een genootschap dat er nog
     geen had. Dat hoort ook zo op de weg die een bijeenkomst AANMAAKT. Op elke
     andere weg is het verkeerd: wie een bijeenkomst opzoekt die niet bestaat,
     krijgt een 400 en hoort niets achter te laten. De staatproef ving dat als
     een gezakte ROLLBACK, en via VERTROUWEN.json zette de schorspoort
     /api/genootschap/afgelast met een 503 dicht. */
  const lijstVan = (id) => {
    const g = genootschap.S();
    if (!Array.isArray(g.bijeenkomst[id])) g.bijeenkomst[id] = [];
    return g.bijeenkomst[id];
  };
  // kijken zonder scheppen -- voor alles wat alleen opzoekt of toont
  const kijkVan = (id) => {
    const g = genootschap.S();
    return Array.isArray(g.bijeenkomst[id]) ? g.bijeenkomst[id] : [];
  };

  const poort = (sess, groepId) => {
    const gr = genootschap.groepMet(groepId);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isLid(gr, sess.key)) return { error: 'Je bent hier geen lid van.' };
    return { gr };
  };

  function nieuwId(lijst) {
    let id = Date.now();
    while (lijst.some(x => x.id === id)) id++;
    return id;
  }

  function roepBijeen(sess, groepId, invoer) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const v = invoer || {};
    const wat = String(v.wat || '').slice(0, WAT_MAX).trim();
    const waar = String(v.waar || '').slice(0, WAAR_MAX).trim();
    const datum = String(v.datum || '').trim();
    const tijd = String(v.tijd || '').trim();
    if (!wat) return { error: 'Wat is de gelegenheid?' };
    if (!DATUM.test(datum)) return { error: 'Geef een datum als 2026-08-14.' };
    if (tijd && !TIJD.test(tijd)) return { error: 'Geef een tijd als 20:30.' };
    for (const t of [wat, waar].filter(Boolean)) { const k = keur(t); if (!k.ok) return { error: k.reden }; }
    const toelichting = String(v.toelichting || '').slice(0, TOELICHTING_MAX).trim();
    if (toelichting) { const k = keur(toelichting); if (!k.ok) return { error: k.reden }; }
    const plaatsen = Number(v.plaatsen);

    const lijst = lijstVan(groepId);
    const b = {
      id: nieuwId(lijst), vanKey: sess.key, wat, waar, datum, tijd: tijd || null,
      toelichting, plaatsen: Number.isInteger(plaatsen) && plaatsen > 0 && plaatsen <= 500 ? plaatsen : null,
      at: nu(), antwoorden: {}, afgelast: null
    };
    lijst.unshift(b);
    if (lijst.length > PER_GROEP) lijst.length = PER_GROEP;
    save();
    // een uitnodiging, EEN keer: geen herinneringsreeks
    try {
      if (notify) for (const l of (p.gr.leden || [])) {
        if (l.key !== sess.key) notify(l.key, p.gr.naam + ': ' + wat + ' op ' + datum);
      }
    } catch (e) {}
    return { ok: true, bijeenkomst: publiek(b, sess) };
  }

  function antwoord(sess, groepId, id, wat) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const b = kijkVan(groepId).find(x => String(x.id) === String(id));
    if (!b) return { error: 'Deze bijeenkomst bestaat niet.' };
    if (b.afgelast) return { error: 'Deze bijeenkomst is afgelast.' };
    if (!ANTWOORDEN.includes(wat)) return { error: 'Antwoord met ja, misschien of nee.' };
    if (wat === 'ja' && b.plaatsen && b.antwoorden[sess.key] !== 'ja') {
      const jaNu = Object.keys(b.antwoorden).filter(k => b.antwoorden[k] === 'ja').length;
      if (jaNu >= b.plaatsen) return { error: 'Het is vol. Zeg iemand af, dan komt er een plaats vrij.' };
    }
    b.antwoorden[sess.key] = wat;
    save();
    return { ok: true, bijeenkomst: publiek(b, sess) };
  }

  function afgelast(sess, groepId, id, reden) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const b = kijkVan(groepId).find(x => String(x.id) === String(id));
    if (!b) return { error: 'Deze bijeenkomst bestaat niet.' };
    if (b.vanKey !== sess.key && !genootschap.isBeheer(p.gr, sess.key)) return { error: 'Alleen de gastheer of een beheerder last af.' };
    b.afgelast = { at: nu(), reden: String(reden || '').slice(0, 200).trim() };
    save();
    try {
      if (notify) for (const k of Object.keys(b.antwoorden)) {
        if (b.antwoorden[k] === 'ja' && k !== sess.key) notify(k, 'Afgelast: ' + b.wat);
      }
    } catch (e) {}
    return { ok: true, bijeenkomst: publiek(b, sess) };
  }

  const tel = (b, wat) => Object.keys(b.antwoorden || {}).filter(k => b.antwoorden[k] === wat).length;

  const publiek = (b, sess) => ({
    id: b.id, wat: b.wat, waar: b.waar || '', datum: b.datum, tijd: b.tijd || null,
    toelichting: b.toelichting || '', gastheer: codenaamVan(b.vanKey),
    vanMij: !!(sess && b.vanKey === sess.key),
    plaatsen: b.plaatsen || null,
    ja: tel(b, 'ja'), misschien: tel(b, 'misschien'), nee: tel(b, 'nee'),
    vol: !!(b.plaatsen && tel(b, 'ja') >= b.plaatsen),
    mijnAntwoord: (sess && b.antwoorden && b.antwoorden[sess.key]) || null,
    komen: Object.keys(b.antwoorden || {}).filter(k => b.antwoorden[k] === 'ja').map(k => codenaamVan(k)),
    afgelast: b.afgelast || null
  });

  /* De agenda van dit genootschap: wat komt er nog, en wat is geweest. Bewust
     gescheiden, want een lijst waarin gisteren en volgende maand door elkaar
     staan is geen agenda. */
  function agenda(sess, groepId) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const vandaag = new Date().toISOString().slice(0, 10);
    const alle = kijkVan(groepId).map(b => publiek(b, sess));
    return {
      ok: true,
      komt: alle.filter(b => b.datum >= vandaag && !b.afgelast).sort((a, b) => a.datum.localeCompare(b.datum)),
      geweest: alle.filter(b => b.datum < vandaag || b.afgelast).slice(0, 30)
    };
  }

  // Alle aanstaande bijeenkomsten uit al mijn genootschappen, op datum.
  function mijnAgenda(sess) {
    const vandaag = new Date().toISOString().slice(0, 10);
    const uit = [];
    for (const gr of genootschap.mijne(sess.key)) {
      for (const b of kijkVan(gr.id)) {
        if (b.datum < vandaag || b.afgelast) continue;
        uit.push(Object.assign({ groep: gr.naam, groepId: gr.id }, publiek(b, sess)));
      }
    }
    uit.sort((a, b) => a.datum.localeCompare(b.datum) || String(a.tijd || '').localeCompare(String(b.tijd || '')));
    return { ok: true, komt: uit.slice(0, 50) };
  }

  return { roepBijeen, antwoord, afgelast, agenda, mijnAgenda, publiek, lijstVan, ANTWOORDEN };
};
