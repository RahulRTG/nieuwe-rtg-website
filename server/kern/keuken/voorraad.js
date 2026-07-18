/* Keuken (deelmodule): de voorraadmotor: receptkoppeling per gerecht,
   kostprijs, automatisch afboeken bij verkoop, tellingen, verspilling en
   leveringen. Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/keuken.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notifySupplier,
    logboek, schrijfLog, bewaakMinimum, nu, rond3, rond2, artikelen, recepten, menuItemVan, artikelVan } = ctx;
  function receptZet(s, menuItemId, regels) {
    const m = menuItemVan(s, menuItemId);
    if (!m) return { status: 404, error: 'Dit gerecht staat niet op het menu.' };
    const uit = [];
    for (const r of (Array.isArray(regels) ? regels : []).slice(0, 25)) {
      const a = artikelVan(s, String(r.artikelId || ''));
      const h = rond3(r.hoeveelheid);
      if (!a || !(h > 0)) continue;
      uit.push({ artikelId: a.id, hoeveelheid: h });
    }
    recepten(s)[m.id] = uit;
    save();
    return { ok: true, recept: uit };
  }
  function kostprijsVan(s, menuItemId) {
    const regels = recepten(s)[menuItemId] || [];
    let som = 0;
    for (const r of regels) {
      const a = artikelVan(s, r.artikelId);
      if (a) som += (Number(a.kostprijs) || 0) * r.hoeveelheid;
    }
    return rond2(som);
  }
  function receptOverzicht(s) {
    const menu = Array.isArray(s.menu) ? s.menu : [];
    return menu.map(m => {
      const regels = (recepten(s)[m.id] || []).map(r => {
        const a = artikelVan(s, r.artikelId);
        return { artikelId: r.artikelId, naam: a ? a.naam : '(weg)', eenheid: a ? a.eenheid : '', hoeveelheid: r.hoeveelheid };
      });
      const kost = kostprijsVan(s, m.id);
      const prijs = Number(m.price) || 0;
      return {
        id: m.id, naam: m.name, cat: m.cat || '', prijs, regels, kostprijs: kost,
        marge: rond2(prijs - kost), margePct: prijs > 0 ? Math.round((prijs - kost) / prijs * 100) : null
      };
    });
  }

  /* ---------- de automatische afboeking bij elke verkoop ---------- */
  function boekVerkoopAf(s, verkoopItems, bron) {
    if (!s) return;
    let geboekt = 0;
    for (const it of (Array.isArray(verkoopItems) ? verkoopItems : []).slice(0, 60)) {
      const m = menuItemVan(s, it.id || it.name);
      if (!m) continue;
      const regels = recepten(s)[m.id] || [];
      const qty = Math.max(1, Math.min(100, parseInt(it.qty, 10) || 1));
      for (const r of regels) {
        const a = artikelVan(s, r.artikelId);
        if (!a) continue;
        const delta = rond3(r.hoeveelheid * qty);
        a.aantal = rond3(a.aantal - delta); // mag onder nul: de gast gaat voor, de telling zet recht
        schrijfLog(s, { soort: 'verkoop', artikelId: a.id, artikel: a.naam, delta: -delta, wie: bron || 'kassa', oms: qty + 'x ' + m.name });
        bewaakMinimum(s, a);
        geboekt++;
      }
    }
    if (geboekt) save();
    return geboekt;
  }

  /* ---------- telling, verspilling, levering ---------- */
  function telling(s, artikelId, geteld, wie) {
    const a = artikelVan(s, String(artikelId || ''));
    if (!a) return { status: 404, error: 'Voorraaditem niet gevonden.' };
    const g = rond3(geteld);
    if (!Number.isFinite(g) || g < 0 || g > 100000) return { status: 400, error: 'Vul de getelde stand in.' };
    const delta = rond3(g - a.aantal);
    a.aantal = g;
    schrijfLog(s, { soort: 'telling', artikelId: a.id, artikel: a.naam, delta, wie: schoon(wie, 40) || 'team', oms: 'Geteld: ' + g + ' ' + a.eenheid });
    bewaakMinimum(s, a);
    save();
    return { ok: true, artikel: a, verschil: delta };
  }
  function verspilling(s, artikelId, hoeveelheid, reden, wie) {
    const a = artikelVan(s, String(artikelId || ''));
    if (!a) return { status: 404, error: 'Voorraaditem niet gevonden.' };
    const h = rond3(hoeveelheid);
    if (!(h > 0) || h > 100000) return { status: 400, error: 'Vul de hoeveelheid in.' };
    a.aantal = rond3(a.aantal - h);
    schrijfLog(s, { soort: 'verspilling', artikelId: a.id, artikel: a.naam, delta: -h, wie: schoon(wie, 40) || 'team', oms: schoon(reden, 80) || 'Breuk of derving' });
    bewaakMinimum(s, a);
    save();
    return { ok: true, artikel: a };
  }
  function levering(s, artikelId, hoeveelheid, kostprijs, wie) {
    const a = artikelVan(s, String(artikelId || ''));
    if (!a) return { status: 404, error: 'Voorraaditem niet gevonden.' };
    const h = rond3(hoeveelheid);
    if (!(h > 0) || h > 100000) return { status: 400, error: 'Vul de geleverde hoeveelheid in.' };
    a.aantal = rond3(a.aantal + h);
    const k = Number(kostprijs);
    if (Number.isFinite(k) && k >= 0 && k <= 100000) a.kostprijs = rond2(k); // de laatste inkoopprijs is de kostprijs
    schrijfLog(s, { soort: 'levering', artikelId: a.id, artikel: a.naam, delta: h, wie: schoon(wie, 40) || 'team', oms: 'Levering binnen' + (Number.isFinite(k) ? ', ' + k.toFixed(2) + ' euro per ' + a.eenheid : '') });
    bewaakMinimum(s, a);
    save();
    return { ok: true, artikel: a };
  }

  /* De cirkel dicht: een geleverde groothandelsbestelling vult de voorraad
     automatisch aan (matching op artikelnaam, hoofdletter-ongevoelig) en de
     regelprijs wordt de nieuwe kostprijs. Aangeroepen vanuit de
     groothandel-keten zodra een bestelling op "geleverd" komt. */
  function leverBinnen(s, regels, bron) {
    if (!s) return 0;
    let geboekt = 0;
    for (const r of (Array.isArray(regels) ? regels : [])) {
      const a = artikelen(s).find(x => x.naam.toLowerCase() === String(r.naam || '').toLowerCase());
      if (!a || !(r.aantal > 0)) continue;
      const uit = levering(s, a.id, r.aantal, r.prijs, bron || 'groothandel');
      if (uit.ok) geboekt++;
    }
    return geboekt;
  }

  /* Menu-engineering: verkoopvolume (kassabonnen + betaalde bestellingen)
     maal de marge uit het recept, over de afgelopen weken. De klassieke
     kwadranten: ster (marge en volume boven de mediaan), werkpaard (volume
     hoog, marge laag), puzzel (marge hoog, volume laag), hond (allebei laag). */
  return { receptZet, kostprijsVan, receptOverzicht, boekVerkoopAf, telling, verspilling, levering, leverBinnen };
};
