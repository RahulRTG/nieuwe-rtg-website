/* Borden: het gedeelde werkbord van het platform (Trello-stijl). Elke zaak
   heeft eigen borden met lijsten en kaarten; per bord kiest u welke collega's
   erin zitten (leeg = het hele team). Business Pass-leden krijgen dezelfde
   motor voor hun eigen projecten. De motor is bewust container-onafhankelijk:
   de routes geven een lijst borden mee (per zaak of per lid), de motor doet
   de rest en bewaakt de grenzen. */

function maakBorden({ db, save, crypto }) {
  const id8 = () => crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const tekst = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);

  // de bordenbak per eigenaar: db.data[vak][sleutel] = [borden]
  function bak(vak, sleutel) {
    const root = db.data[vak] = db.data[vak] || {};
    return root[sleutel] = root[sleutel] || [];
  }

  /* wie ziet welk bord: een bord zonder leden is van het hele team; met leden
     alleen voor die collega's (de manager ziet altijd alles, die beheert) */
  function zichtbaar(borden, staffId, manager) {
    if (staffId == null || manager) return borden;
    return borden.filter(b => !(b.leden || []).length || b.leden.includes(staffId));
  }

  function bordMaak(borden, naam, wie) {
    naam = tekst(naam, 60);
    if (!naam) return { status: 400, error: 'Geef het bord een naam.' };
    if (borden.length >= 40) return { status: 409, error: 'Maximaal 40 borden; ruim eerst op.' };
    const b = {
      id: id8(), naam, leden: [], door: wie || null, at: nu(),
      lijsten: [
        { id: id8(), naam: 'Te doen', kaarten: [] },
        { id: id8(), naam: 'Bezig', kaarten: [] },
        { id: id8(), naam: 'Klaar', kaarten: [] }
      ]
    };
    borden.push(b);
    save();
    return { status: 200, ok: true, bord: b };
  }
  const bordVind = (borden, id) => borden.find(b => b.id === id) || null;

  function bordLeden(b, leden) {
    b.leden = [...new Set((Array.isArray(leden) ? leden : [])
      .map(n => parseInt(n, 10)).filter(Number.isFinite))].slice(0, 100);
    save();
    return { status: 200, ok: true, bord: b };
  }
  function bordHernoem(b, naam) {
    naam = tekst(naam, 60);
    if (!naam) return { status: 400, error: 'Geef het bord een naam.' };
    b.naam = naam; save();
    return { status: 200, ok: true, bord: b };
  }
  function bordWeg(borden, id) {
    const i = borden.findIndex(b => b.id === id);
    if (i < 0) return { status: 404, error: 'Bord niet gevonden.' };
    borden.splice(i, 1); save();
    return { status: 200, ok: true };
  }

  function lijstMaak(b, naam) {
    naam = tekst(naam, 40);
    if (!naam) return { status: 400, error: 'Geef de lijst een naam.' };
    if (b.lijsten.length >= 12) return { status: 409, error: 'Maximaal 12 lijsten per bord.' };
    const l = { id: id8(), naam, kaarten: [] };
    b.lijsten.push(l); save();
    return { status: 200, ok: true, lijst: l };
  }
  function lijstBewerk(b, lijstId, velden) {
    const l = b.lijsten.find(x => x.id === lijstId);
    if (!l) return { status: 404, error: 'Lijst niet gevonden.' };
    if (velden.weg) {
      if (l.kaarten.length) return { status: 409, error: 'Deze lijst heeft nog kaarten; verplaats die eerst.' };
      b.lijsten = b.lijsten.filter(x => x.id !== lijstId);
    } else if (velden.naam != null) {
      const naam = tekst(velden.naam, 40);
      if (!naam) return { status: 400, error: 'Geef de lijst een naam.' };
      l.naam = naam;
    }
    save();
    return { status: 200, ok: true, bord: b };
  }

  function kaartMaak(b, lijstId, titel, wie) {
    const l = b.lijsten.find(x => x.id === lijstId);
    if (!l) return { status: 404, error: 'Lijst niet gevonden.' };
    titel = tekst(titel, 120);
    if (!titel) return { status: 400, error: 'Geef de kaart een titel.' };
    if (b.lijsten.reduce((n, x) => n + x.kaarten.length, 0) >= 400)
      return { status: 409, error: 'Dit bord zit vol (400 kaarten); ruim eerst op.' };
    const k = { id: id8(), titel, notitie: '', leden: [], due: null, klaar: false, door: wie || null, at: nu() };
    l.kaarten.push(k); save();
    return { status: 200, ok: true, kaart: k };
  }
  function kaartVind(b, kaartId) {
    for (const l of b.lijsten) {
      const k = l.kaarten.find(x => x.id === kaartId);
      if (k) return { lijst: l, kaart: k };
    }
    return null;
  }
  function kaartBewerk(b, kaartId, velden) {
    const vk = kaartVind(b, kaartId);
    if (!vk) return { status: 404, error: 'Kaart niet gevonden.' };
    const k = vk.kaart;
    if (velden.titel != null) {
      const t = tekst(velden.titel, 120);
      if (!t) return { status: 400, error: 'Geef de kaart een titel.' };
      k.titel = t;
    }
    if (velden.notitie != null) k.notitie = tekst(velden.notitie, 500);
    if (velden.due !== undefined) k.due = /^\d{4}-\d{2}-\d{2}$/.test(String(velden.due || '')) ? velden.due : null;
    if (velden.klaar != null) k.klaar = !!velden.klaar;
    if (velden.leden != null) k.leden = [...new Set((Array.isArray(velden.leden) ? velden.leden : [])
      .map(n => parseInt(n, 10)).filter(Number.isFinite))].slice(0, 30);
    save();
    return { status: 200, ok: true, kaart: k };
  }
  function kaartZet(b, kaartId, naarLijstId, pos) {
    const vk = kaartVind(b, kaartId);
    if (!vk) return { status: 404, error: 'Kaart niet gevonden.' };
    const doel = b.lijsten.find(x => x.id === naarLijstId);
    if (!doel) return { status: 404, error: 'Lijst niet gevonden.' };
    vk.lijst.kaarten = vk.lijst.kaarten.filter(x => x.id !== kaartId);
    const i = Number.isFinite(parseInt(pos, 10)) ? Math.max(0, Math.min(doel.kaarten.length, parseInt(pos, 10))) : doel.kaarten.length;
    doel.kaarten.splice(i, 0, vk.kaart);
    save();
    return { status: 200, ok: true, bord: b };
  }
  function kaartWeg(b, kaartId) {
    const vk = kaartVind(b, kaartId);
    if (!vk) return { status: 404, error: 'Kaart niet gevonden.' };
    vk.lijst.kaarten = vk.lijst.kaarten.filter(x => x.id !== kaartId);
    save();
    return { status: 200, ok: true };
  }

  return { bak, zichtbaar, bordMaak, bordVind, bordLeden, bordHernoem, bordWeg, lijstMaak, lijstBewerk, kaartMaak, kaartBewerk, kaartZet, kaartWeg };
}

module.exports = { maakBorden };
