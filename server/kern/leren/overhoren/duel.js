/* Leren-overhoren, deel "duel" (kern/leren): samen leren, het overhoorduel met
   een leermaatje - uitnodigen (vriend op sleutel of anderen op exacte codenaam),
   de uitnodiging beantwoorden, de sessie spelen en per beurt de stand bijhouden.
   Verbatim afgesplitst uit overhoren.js. */
module.exports = (ctx) => {
  const { save, codenaamVan, zijnVrienden, socialZoek, isGeblokkeerd, sociaalRate,
    rid, nu, L, schud, opruimen, seintje, norm } = ctx;

  async function nodigUit(mij, vrienden, codenamen, maxErbij, rateSleutel) {
    // gedeeld uitnodigingspad: vrienden op sleutel, anderen op exacte codenaam.
    // Samen leren of samen werken maakt je NIET automatisch vrienden.
    if (!sociaalRate(mij, rateSleutel, 20, 3600000)) return { error: { status: 429, error: 'Rustig aan met uitnodigen.' } };
    const uit = (Array.isArray(vrienden) ? vrienden : []).slice(0, maxErbij).filter(v => zijnVrienden(mij, v));
    for (const cn of (Array.isArray(codenamen) ? codenamen : []).slice(0, maxErbij)) {
      const zoek = await socialZoek(mij, String(cn));
      const hit = (zoek || []).find(r => String(r.codename).toLowerCase() === String(cn).trim().toLowerCase());
      if (!hit) return { error: { status: 404, error: 'De codenaam "' + String(cn).slice(0, 40) + '" is niet gevonden.' } };
      if (isGeblokkeerd(mij, hit.key)) return { error: { status: 403, error: 'Dit contact is niet beschikbaar.' } };
      if (!uit.includes(hit.key) && hit.key !== mij) uit.push(hit.key);
    }
    return { uitgenodigd: uit.slice(0, maxErbij) };
  }
  async function sessieStart(mij, { lijstId, vrienden, codenamen }) {
    opruimen();
    const l = L().lijsten[String(lijstId || '')];
    if (!l || l.van !== mij) return { status: 404, error: 'Kies eerst een van je eigen lijsten.' };
    const wie = await nodigUit(mij, vrienden, codenamen, 1, 'leer-uitnodiging');
    if (wie.error) return wie.error;
    if (wie.uitgenodigd.length !== 1) return { status: 400, error: 'Nodig precies een leermaatje uit (vriend of codenaam).' };
    const s = { id: rid(5), naam: l.naam, paren: l.paren.map(p => ({ v: p.v, a: p.a })), volgorde: schud(l.paren.map((_, i) => i)),
      spelers: [mij], uitgenodigd: wie.uitgenodigd, status: 'wacht', idx: { [mij]: 0 }, goed: { [mij]: 0 }, at: nu(), door: codenaamVan(mij) };
    L().sessies[s.id] = s; save();
    seintje(wie.uitgenodigd[0], 'leersessie', s.id);
    return { status: 200, ok: true, id: s.id };
  }
  function sessieAntwoord(mij, id, akkoord) {
    const s = L().sessies[id];
    if (!s || s.status !== 'wacht' || !s.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    s.uitgenodigd = [];
    if (akkoord === true) {
      s.spelers.push(mij); s.idx[mij] = 0; s.goed[mij] = 0; s.status = 'bezig';
    } else delete L().sessies[id];
    save();
    s.spelers.forEach(sp => seintje(sp, 'leersessie', id));
    return { status: 200, ok: true, gestart: s.status === 'bezig' };
  }
  function sessiesVan(mij) {
    opruimen();
    const alle = Object.values(L().sessies);
    return { status: 200,
      sessies: alle.filter(s => s.spelers.includes(mij)).map(s => ({ id: s.id, naam: s.naam, status: s.status, spelers: s.spelers.map(codenaamVan), at: s.at }))
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10),
      uitnodigingen: alle.filter(s => s.status === 'wacht' && s.uitgenodigd.includes(mij)).map(s => ({ id: s.id, naam: s.naam, van: s.door, aantal: s.paren.length })) };
  }
  function sessieStaat(mij, id) {
    const s = L().sessies[id];
    if (!s || !s.spelers.includes(mij)) return { status: 404, error: 'Deze leersessie bestaat niet (meer).' };
    const ander = s.spelers.find(sp => sp !== mij);
    const mijnIdx = s.idx[mij] || 0;
    return { status: 200, sessie: { id: s.id, naam: s.naam, status: s.status, aantal: s.paren.length,
      ik: { idx: mijnIdx, goed: s.goed[mij] || 0, klaar: mijnIdx >= s.paren.length },
      ander: ander ? { codenaam: codenaamVan(ander), idx: s.idx[ander] || 0, goed: s.goed[ander] || 0, klaar: (s.idx[ander] || 0) >= s.paren.length } : null,
      vraag: s.status === 'bezig' && mijnIdx < s.paren.length ? s.paren[s.volgorde[mijnIdx]].v : null,
      winnaar: s.winnaar || null, gelijk: !!s.gelijk } };
  }
  function sessieZet(mij, id, antwoord) {
    const s = L().sessies[id];
    if (!s || !s.spelers.includes(mij)) return { status: 404, error: 'Deze leersessie bestaat niet (meer).' };
    if (s.status !== 'bezig') return { status: 409, error: 'Deze sessie loopt niet (meer).' };
    const i = s.idx[mij] || 0;
    if (i >= s.paren.length) return { status: 409, error: 'Jij bent al klaar; wacht op de ander.' };
    const p = s.paren[s.volgorde[i]];
    const goed = norm(antwoord) === norm(p.a);
    if (goed) s.goed[mij] = (s.goed[mij] || 0) + 1;
    s.idx[mij] = i + 1;
    // allebei klaar: de stand bepaalt de winnaar (gelijkspel kan)
    if (s.spelers.length === 2 && s.spelers.every(sp => (s.idx[sp] || 0) >= s.paren.length)) {
      s.status = 'klaar';
      const [a, b] = s.spelers;
      if (s.goed[a] === s.goed[b]) s.gelijk = true;
      else s.winnaar = codenaamVan(s.goed[a] > s.goed[b] ? a : b);
    }
    save();
    s.spelers.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'leersessie', id));
    return { status: 200, ok: true, goed, juist: p.a, klaar: s.idx[mij] >= s.paren.length };
  }

  return { nodigUit, sessieStart, sessieAntwoord, sessiesVan, sessieStaat, sessieZet };
};
