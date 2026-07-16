/* Het keukenbrein (toren horeca): de voorraad telt echt mee.

   Bouwt voort op de bestaande voorraadlijst van de zaak (s.voorraad:
   {id, naam, aantal, min, eenheid, kostprijs}) en maakt er een sluitend
   systeem van:

   - RECEPTEN: per menu-gerecht de ingredienten met hoeveelheid
     (s.recepten = { menuItemId: [{artikelId, hoeveelheid}] }). Daarmee is de
     kostprijs en de marge van elk gerecht altijd actueel.
   - AFBOEKEN: elke verkoop (kassa-bon en betaalde gastbestelling) boekt de
     ingredienten automatisch af via het recept. Een verkoop wordt NOOIT
     geblokkeerd door de voorraadstand (de gast gaat voor); de stand mag
     onder nul en de telling zet hem later recht.
   - TELLING, VERSPILLING en LEVERING: de vloer telt wat er echt staat, boekt
     breuk en derving met reden, en meldt leveringen aan (met inkoopprijs,
     die meteen de kostprijs van het artikel wordt).
   - LOGBOEK: elke beweging staat in s.voorraadLog met wie, wat en waarom.
     Zo is een kasverschil of een gat in de voorraad altijd te herleiden.
   - INKOOPADVIES: alles onder het minimum, met een voorstel dat aanvult tot
     twee keer het minimum. Een knop ervan maken (groothandel) komt in de
     volgende ronde van deze toren. */

module.exports = ({ save, crypto, schoon, notifySupplier }) => {
  const nu = () => new Date().toISOString();
  const rond3 = x => Math.round(Number(x) * 1000) / 1000;
  const rond2 = x => Math.round(Number(x) * 100) / 100;

  const artikelen = s => (s.voorraad = Array.isArray(s.voorraad) ? s.voorraad : []);
  const recepten = s => (s.recepten = (s.recepten && typeof s.recepten === 'object') ? s.recepten : {});
  function logboek(s) { if (!Array.isArray(s.voorraadLog)) s.voorraadLog = []; return s.voorraadLog; }
  function schrijfLog(s, regel) {
    logboek(s).unshift(Object.assign({ at: nu() }, regel));
    if (s.voorraadLog.length > 2000) s.voorraadLog.pop();
  }
  const artikelVan = (s, id) => artikelen(s).find(x => x.id === id) || null;
  const menuItemVan = (s, idOfNaam) => {
    const menu = Array.isArray(s.menu) ? s.menu : [];
    const zoek = String(idOfNaam || '').trim().toLowerCase();
    return menu.find(m => m.id === idOfNaam) || menu.find(m => String(m.name || '').toLowerCase() === zoek) || null;
  };
  // de drempelwachter: een melding per keer dat een artikel onder zijn minimum zakt
  function bewaakMinimum(s, a) {
    if (a.min > 0 && a.aantal <= a.min && !a.laagGemeld) {
      a.laagGemeld = true;
      try { notifySupplier(s.code, { icon: '\u{1F4C9}', title: 'Voorraad laag: ' + a.naam, body: 'Nog ' + a.aantal + ' ' + a.eenheid + ' (minimum ' + a.min + '). Zie het inkoopadvies op de Voorraad-tab.' }); } catch (e) {}
    } else if (a.aantal > a.min) a.laagGemeld = false;
  }

  /* ---------- recepten en marge ---------- */
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

  /* ---------- inkoopadvies en het totaaloverzicht ---------- */
  function inkoopadvies(s) {
    return artikelen(s)
      .filter(a => a.min > 0 && a.aantal <= a.min)
      .map(a => ({
        artikelId: a.id, naam: a.naam, eenheid: a.eenheid, aantal: a.aantal, min: a.min,
        advies: Math.max(1, Math.ceil(a.min * 2 - a.aantal)),
        kosten: rond2(Math.max(1, Math.ceil(a.min * 2 - a.aantal)) * (Number(a.kostprijs) || 0))
      }));
  }
  /* Het werkvloer-uittreksel voor het keukenscherm, het barscherm en de PDA:
     wat is laag, wat is op, en welke gerechten verdienen een 86-advies omdat
     een ingredient uit het recept op is. Compact, zodat de schermen het elke
     verversing kunnen meevragen. */
  function werkvloer(s) {
    const inRecept = new Set();
    for (const regels of Object.values(recepten(s))) for (const r of regels) inRecept.add(r.artikelId);
    const alle = artikelen(s);
    const op = alle.filter(a => a.aantal <= 0 && (a.min > 0 || inRecept.has(a.id)));
    const laag = alle.filter(a => a.min > 0 && a.aantal > 0 && a.aantal <= a.min);
    const adviezen = [];
    for (const m of (Array.isArray(s.menu) ? s.menu : [])) {
      if (m.uitverkocht) continue;
      for (const r of (recepten(s)[m.id] || [])) {
        const a = artikelVan(s, r.artikelId);
        if (a && a.aantal <= 0) { adviezen.push({ menuItemId: m.id, gerecht: m.name, ingredient: a.naam }); break; }
      }
    }
    const kaal = a => ({ id: a.id, naam: a.naam, aantal: a.aantal, eenheid: a.eenheid });
    return { ok: true, op: op.map(kaal), laag: laag.map(kaal), adviezen, artikelen: alle.map(a => ({ id: a.id, naam: a.naam })) };
  }

  function overzicht(s) {
    const lijst = artikelen(s).map(a => Object.assign({}, a, { waarde: rond2((Number(a.kostprijs) || 0) * Math.max(0, a.aantal)) }));
    return {
      ok: true,
      artikelen: lijst,
      totaalWaarde: rond2(lijst.reduce((n, a) => n + a.waarde, 0)),
      onderMinimum: lijst.filter(a => a.min > 0 && a.aantal <= a.min).length,
      recepten: receptOverzicht(s),
      advies: inkoopadvies(s),
      logboek: logboek(s).slice(0, 40)
    };
  }

  return { keuken: { overzicht, werkvloer, receptZet, receptOverzicht, boekVerkoopAf, telling, verspilling, levering, inkoopadvies, kostprijsVan } };
};
