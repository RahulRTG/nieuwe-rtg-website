/* Keuken (deelmodule): de advieslaag: menu-engineering (analyse en advies),
   het inkoopadvies en de werkvloer- en overzichtskaarten. kostprijsVan komt
   via de context binnen nadat kern/keuken.js de voorraadlaag heeft gemount. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notifySupplier,
    logboek, schrijfLog, bewaakMinimum, nu, rond3, rond2, artikelen, recepten, menuItemVan, artikelVan } = ctx;
  const { receptZet, kostprijsVan, receptOverzicht, boekVerkoopAf, telling, verspilling, levering, leverBinnen } = ctx;
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
    for (const o of require('../../db').ordersVanZaak(s.code)) if (o.paid && new Date(o.paidAt || o.at) >= sinds) telItems(o.items);
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

  return { menuAnalyse, menuAdvies, inkoopadvies, werkvloer, overzicht };
};
