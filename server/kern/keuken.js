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

module.exports = ({ db, save, crypto, schoon, notifySupplier }) => {
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
  function menuAnalyse(s, dagen) {
    const periode = Math.max(1, Math.min(90, Number(dagen) || 21));
    const sinds = Date.now() - periode * 86400000;
    const per = {};
    const telItems = items => {
      for (const it of items || []) {
        const m = menuItemVan(s, it.id || it.name);
        if (m) per[m.id] = (per[m.id] || 0) + Math.max(1, parseInt(it.qty, 10) || 1);
      }
    };
    for (const o of require('../db').ordersVanZaak(s.code)) if (o.paid && new Date(o.paidAt || o.at) >= sinds) telItems(o.items);
    for (const v of db.data.posSales[s.code] || []) if (new Date(v.at) >= sinds) telItems(v.items);
    const rijen = (Array.isArray(s.menu) ? s.menu : []).map(m => {
      const verkocht = per[m.id] || 0;
      const kost = kostprijsVan(s, m.id);
      const prijs = Number(m.price) || 0;
      const marge = rond2(prijs - kost);
      return { id: m.id, naam: m.name, prijs, kostprijs: kost, marge, verkocht,
        omzet: rond2(verkocht * prijs), brutowinst: rond2(verkocht * marge), heeftRecept: (recepten(s)[m.id] || []).length > 0 };
    });
    const mediaan = arr => { const x = [...arr].sort((a, b) => a - b); return x.length ? x[Math.floor(x.length / 2)] : 0; };
    const mV = mediaan(rijen.map(r => r.verkocht));
    const mM = mediaan(rijen.filter(r => r.heeftRecept).map(r => r.marge));
    for (const r of rijen) {
      const hoogV = r.verkocht >= mV && r.verkocht > 0;
      const hoogM = r.heeftRecept ? r.marge >= mM : null;
      r.klasse = hoogM === null ? 'onbekend' : (hoogV && hoogM) ? 'ster' : hoogV ? 'werkpaard' : hoogM ? 'puzzel' : 'hond';
      r.advies = r.klasse === 'ster' ? 'Koester en geef het podium: dit is de chef-aanrader.'
        : r.klasse === 'werkpaard' ? 'Loopt hard maar verdient weinig: kijk naar de prijs of de portiekost.'
        : r.klasse === 'puzzel' ? 'Verdient goed maar verkoopt weinig: betere plek op de kaart, of laat de bediening hem noemen.'
        : r.klasse === 'hond' ? 'Weinig verkoop en weinig marge: overweeg vervangen of van de kaart halen.'
        : 'Zet een recept op dit gerecht, dan rekent de marge mee.';
    }
    return { ok: true, dagen: periode, mediaanVerkocht: mV, mediaanMarge: mM, rijen: rijen.sort((a, b) => b.brutowinst - a.brutowinst) };
  }

  /* Het advies van de AI-chef-adviseur: de kwadranten omgezet in een concreet
     actieplan met bedragen, volledig uit de eigen cijfers (dus ook zonder
     externe AI altijd beschikbaar, en altijd consistent met de kaart). */
  function menuAdvies(s, dagen) {
    const a = menuAnalyse(s, dagen);
    const acties = [];
    const sterren = a.rijen.filter(r => r.klasse === 'ster');
    const werkpaarden = a.rijen.filter(r => r.klasse === 'werkpaard');
    const puzzels = a.rijen.filter(r => r.klasse === 'puzzel');
    const honden = a.rijen.filter(r => r.klasse === 'hond');
    const onbekend = a.rijen.filter(r => r.klasse === 'onbekend');
    for (const r of werkpaarden) {
      // een kleine prijsstap op een hardloper: afgerond op halve euro's
      const stap = Math.max(0.5, Math.round(r.prijs * 0.05 * 2) / 2);
      acties.push({ soort: 'prijs', gerecht: r.naam, impact: rond2(r.verkocht * stap),
        tekst: 'Zet ' + r.naam + ' van ' + r.prijs.toFixed(2) + ' naar ' + (r.prijs + stap).toFixed(2) + ' euro: bij ' + r.verkocht + ' verkopen is dat ' + rond2(r.verkocht * stap).toFixed(2) + ' euro extra winst per ' + a.dagen + ' dagen.' });
    }
    for (const r of puzzels) {
      const extra = Math.max(1, a.mediaanVerkocht - r.verkocht);
      acties.push({ soort: 'podium', gerecht: r.naam, impact: rond2(extra * r.marge),
        tekst: 'Laat de bediening ' + r.naam + ' actief noemen: elke verkoop is ' + r.marge.toFixed(2) + ' euro marge; op het niveau van de rest van de kaart is dat ' + rond2(extra * r.marge).toFixed(2) + ' euro erbij.' });
    }
    if (honden.length && puzzels.length) {
      const hond = honden[honden.length - 1];
      const parel = puzzels[0];
      acties.push({ soort: 'kaart', gerecht: hond.naam, impact: rond2(Math.max(1, a.mediaanVerkocht) * parel.marge),
        tekst: 'Haal ' + hond.naam + ' van de kaart en geef die plek aan ' + parel.naam + ': minder mise en place, meer marge op dezelfde plek.' });
    } else for (const r of honden) {
      acties.push({ soort: 'kaart', gerecht: r.naam, impact: 0,
        tekst: r.naam + ' verkoopt weinig en verdient weinig: vervang het gerecht of geef het een seizoensdraai.' });
    }
    for (const r of sterren) {
      acties.push({ soort: 'bewaak', gerecht: r.naam, impact: rond2(r.verkocht * r.kostprijs * 0.1),
        tekst: 'Bewaak de kostprijs van ' + r.naam + ' (de ster van de kaart): tien procent duurdere inkoop kost hier ' + rond2(r.verkocht * r.kostprijs * 0.1).toFixed(2) + ' euro per ' + a.dagen + ' dagen.' });
    }
    if (onbekend.length) acties.push({ soort: 'recept', gerecht: null, impact: 0,
      tekst: 'Zet recepten op ' + onbekend.length + ' gerecht(en) (' + onbekend.slice(0, 3).map(r => r.naam).join(', ') + (onbekend.length > 3 ? ', ...' : '') + '): zonder recept rekent de marge niet mee.' });
    // de derving uit het logboek meewegen: dat is winst die al gemaakt was
    const sinds = Date.now() - a.dagen * 86400000;
    let derving = 0; const dervingPer = {};
    for (const l of logboek(s)) {
      if (l.soort !== 'verspilling' || new Date(l.at) < sinds) continue;
      const art = artikelVan(s, l.artikelId);
      const kost = rond2(Math.abs(l.delta || 0) * ((art && art.kostprijs) || 0));
      derving = rond2(derving + kost);
      if (kost > 0 && l.artikel) dervingPer[l.artikel] = rond2((dervingPer[l.artikel] || 0) + kost);
    }
    if (derving > 0) {
      const top = Object.entries(dervingPer).sort((x, y) => y[1] - x[1])[0];
      acties.push({ soort: 'derving', gerecht: null, impact: derving,
        tekst: 'Er is ' + derving.toFixed(2) + ' euro aan derving geboekt in ' + a.dagen + ' dagen' + (top ? ', het meest op ' + top[0] + ' (' + top[1].toFixed(2) + ' euro)' : '') + ': kleinere mise en place of scherper bestellen.' });
    }
    acties.sort((x, y) => y.impact - x.impact);
    const winst = rond2(a.rijen.reduce((n, r) => n + r.brutowinst, 0));
    const omzet = rond2(a.rijen.reduce((n, r) => n + r.omzet, 0));
    const samenvatting = 'Laatste ' + a.dagen + ' dagen: ' + omzet.toFixed(2) + ' euro omzet en ' + winst.toFixed(2) + ' euro brutowinst uit de kaart.' +
      (acties.length ? ' De grootste kans: ' + acties[0].tekst : ' De kaart staat er goed bij; er is geen dringende actie.');
    return { ok: true, dagen: a.dagen, samenvatting, acties: acties.slice(0, 8), derving };
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

  return { keuken: { overzicht, werkvloer, receptZet, receptOverzicht, boekVerkoopAf, telling, verspilling, levering, leverBinnen, menuAnalyse, menuAdvies, inkoopadvies, kostprijsVan } };
};
