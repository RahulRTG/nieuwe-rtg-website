/* De Residence, deelbestand "spel": samen spelen om elkaar te leren kennen.
   Twee leden in dezelfde zaal dagen elkaar uit voor een potje; de client
   stuurt per beurt een timing-nauwkeurigheid (0-100) en de server rekent
   de uitslag. Bewust rustig: geen ranglijsten, geen reeksen, geen inzet --
   een potje is een gesprek met een bal erbij. Het vragenspel aan tafel
   stelt de vragen die een eerste date makkelijker maken. */

const toeval = require('../../lib/toeval');   // keuzes op toeval: herhaalbaar met RTG_ZAAD
const { SPELLEN, plaats } = require('./spellen');
const rahul = require('./rahul');
const vragen = require('./vragen');

module.exports = (ctx) => {
  const { R, kamer, kamerVan, sein, sseToCustomer, save, partnerVan } = ctx;
  const potjes = () => (R().potjes = R().potjes || {});
  const spelerIn = (id, key) => kamer(id).leden[key];
  const keyOpNaam = (id, codenaam) =>
    Object.keys(kamer(id).leden).find(k => kamer(id).leden[k].codenaam === codenaam) || null;

  function daag(key, body) {
    const id = kamerVan(key);
    if (!id) return { status: 409, error: 'U bent nog geen kamer binnen.' };
    const S2 = SPELLEN[String((body || {}).spel || '')];
    if (!S2) return { status: 400, error: 'Dit spel kent het huis niet.' };
    if (S2.zaal !== id) return { status: 409, error: 'Dit spel speelt u in een andere zaal (' + S2.zaal + ').' };
    let p = potjes()[id];
    // een verweesd potje (spelers weg of stokoud) telt niet meer
    if (p && (Date.now() - p.at > 180000 || !p.spelers.every(s => spelerIn(id, s.key)))) { delete potjes()[id]; p = null; }
    if (p) return { status: 409, error: 'Er loopt hier al een potje; wacht even.' };
    const tegenKey = keyOpNaam(id, String((body || {}).codenaam || '').trim());
    if (!tegenKey || tegenKey === key) return { status: 404, error: 'Dit lid is hier niet (meer).' };
    const ik = spelerIn(id, key);
    const spelers = [{ key, codenaam: ik.codenaam, punten: [], team: 0 },
      { key: tegenKey, codenaam: spelerIn(id, tegenKey).codenaam, punten: [], team: 1 }];
    // koppel daagt koppel: zijn beide kanten gekoppeld en is iedereen hier, dan 2 tegen 2
    const maat = partnerVan && partnerVan(key), maatT = partnerVan && partnerVan(tegenKey);
    if (maat && maatT && spelerIn(id, maat) && spelerIn(id, maatT) && new Set([key, tegenKey, maat, maatT]).size === 4) {
      spelers.push({ key: maat, codenaam: spelerIn(id, maat).codenaam, punten: [], team: 0 });
      spelers.push({ key: maatT, codenaam: spelerIn(id, maatT).codenaam, punten: [], team: 1 });
    }
    potjes()[id] = { spel: body.spel, status: 'wacht', at: Date.now(), spelers, beurt: 0 };
    save();
    try { sseToCustomer(tegenKey, 'residentie', { kind: 'spel-uitnodiging', kamer: id, spel: body.spel, naam: S2.naam, van: ik.codenaam, teams: spelers.length === 4 }); } catch (e) {}
    return { status: 200, ok: true, wacht: true, teams: spelers.length === 4 };
  }

  function antwoord(key, body) {
    const id = kamerVan(key);
    const p = id && potjes()[id];
    if (!p || p.status !== 'wacht' || p.spelers[1].key !== key) return { status: 404, error: 'Er is geen uitnodiging (meer).' };
    if (!(body || {}).ja) {
      delete potjes()[id]; save();
      try { sseToCustomer(p.spelers[0].key, 'residentie', { kind: 'spel-afgewezen', kamer: id, van: p.spelers[1].codenaam }); } catch (e) {}
      return { status: 200, ok: true };
    }
    p.status = 'bezig'; p.at = Date.now();
    plaats(id, kamer(id).leden, p.spelers, sein); // iedereen treedt aan op de speelplek
    save();
    sein(id, 'spel-start', staTe(p, id));
    return { status: 200, ok: true, potje: staTe(p, id) };
  }

  const staTe = (p, id) => ({ spel: p.spel, naam: SPELLEN[p.spel].naam, eenheid: SPELLEN[p.spel].eenheid,
    laag: !!SPELLEN[p.spel].laag, samen: !!SPELLEN[p.spel].samen, beurten: SPELLEN[p.spel].beurten, kamerId: id,
    spelers: p.spelers.map(s => ({ codenaam: s.codenaam, punten: s.punten, team: s.team })),
    aanZet: p.status === 'bezig' ? p.spelers[p.beurt % p.spelers.length].codenaam : null });
  const teamNamen = p => [0, 1].map(t => p.spelers.filter(s => s.team === t).map(s => s.codenaam).join(' & '));

  function spelZet(key, body) {
    const id = kamerVan(key);
    const p = id && potjes()[id];
    if (!p || p.status !== 'bezig') return { status: 404, error: 'Er loopt hier geen potje.' };
    const S2 = SPELLEN[p.spel];
    const wie = p.spelers[p.beurt % p.spelers.length];
    if (wie.key !== key) return { status: 409, error: 'De ander is aan zet.' };
    const acc = Math.max(0, Math.min(100, Number((body || {}).kracht) || 0));
    const punt = S2.punt(acc);
    wie.punten.push(punt);
    p.beurt++; p.at = Date.now();
    const klaar = p.spelers.every(s => s.punten.length >= S2.beurten);
    let uitslag = null;
    if (klaar) {
      const som = t => Math.round(p.spelers.filter(s => t == null || s.team === t)
        .reduce((a, s) => a + s.punten.reduce((x, y) => x + y, 0), 0) * 10) / 10;
      if (S2.samen) {
        uitslag = { stand: [som(null)], samen: true, winnaar: null,
          teams: [p.spelers.map(s => s.codenaam).join(' & ')] };
      } else {
        const a = som(0), b = som(1);
        uitslag = { stand: [a, b], teams: teamNamen(p),
          winnaar: a === b ? null : (S2.laag ? (a < b ? 0 : 1) : (a > b ? 0 : 1)) };
      }
      delete potjes()[id];
    }
    save();
    sein(id, 'spel-zet', { codenaam: wie.codenaam, punt, potje: klaar ? null : staTe(p, id), uitslag });
    return { status: 200, ok: true, punt, potje: klaar ? null : staTe(p, id), uitslag };
  }

  function spelStop(key) {
    const id = kamerVan(key);
    const p = id && potjes()[id];
    if (!p || !p.spelers.some(s => s.key === key)) return { status: 404, error: 'Er loopt hier geen potje van u.' };
    delete potjes()[id]; save();
    sein(id, 'spel-gestopt', { van: spelerIn(id, key) ? spelerIn(id, key).codenaam : null });
    return { status: 200, ok: true };
  }

  /* het vragenspel: aan tafel in het restaurant of in de eigen suite. Af en
     toe neemt Rahul, de directeur, het over met een ongemakkelijk eerlijke
     vraag; zit een gekoppeld paar alleen samen in een suite, dan is de
     directeur de gastheer en wisselt hij eerlijk en gewaagd af -- het paar
     (samen wandelen) is daar de toestemming voor het gewaagde dek. */
  function vraag(key) {
    const id = kamerVan(key);
    if (!id) return { status: 409, error: 'U bent nog geen kamer binnen.' };
    if (id !== 'restaurant' && !id.startsWith('suite:')) return { status: 409, error: 'De vragen van het huis horen bij het diner (restaurant of suite).' };
    const k = kamer(id);
    if (Date.now() - (k.laatsteVraag || 0) < 8000) return { status: 429, error: 'Even de vorige vraag laten landen.' };
    k.laatsteVraag = Date.now();
    k.vraagTeller = (k.vraagTeller || 0) + 1;
    const maat = partnerVan && partnerVan(key);
    const prive = id.startsWith('suite:') && maat && k.leden[maat] && Object.keys(k.leden).length === 2;
    const pak = a => toeval.kies(a);
    let uit;
    if (prive) {
      // de directeur als gastheer: gewaagd (eigen dek) afgewisseld met de
      // diepere genres uit de motor
      if (k.vraagTeller % 2 === 0) {
        const r = rahul.kies('gewaagd');
        uit = { tekst: r.tekst, intro: r.intro, van: 'rahul', niveau: 'gewaagd' };
      } else {
        const v = vragen.genereer(pak(['intiem', 'ongemakkelijk', 'traan']));
        uit = { tekst: v.tekst, intro: rahul.kies('eerlijk').intro, van: 'rahul', niveau: v.genre };
      }
    } else if (id === 'restaurant' && k.vraagTeller % 3 === 0) {
      const v = vragen.genereer(pak(['ongemakkelijk', 'traan', 'zakelijk']));
      uit = { tekst: v.tekst, intro: rahul.kies('eerlijk').intro, van: 'rahul', niveau: v.genre };
    } else {
      const v = vragen.genereer(pak(['luchtig', 'luchtig', 'lach', 'zakelijk', 'intiem']));
      uit = { tekst: v.tekst, van: 'huis', niveau: v.genre };
    }
    sein(id, 'vraag', uit, key);
    return Object.assign({ status: 200, ok: true }, uit);
  }

  /* de huistelefoon: wie nu in het huis is, en iemand uitnodigen */
  function huis(key) {
    const wie = [];
    for (const [id, k] of Object.entries(R().kamers)) {
      const naam = id.startsWith('suite:') ? 'een suite' : id;
      for (const l of Object.values(k.leden)) if (l.codenaam) wie.push({ codenaam: l.codenaam, kamer: naam, key: undefined, eigen: kamer(id).leden[key] === l });
    }
    return { status: 200, ok: true, leden: wie.filter(w => !w.eigen).map(w => ({ codenaam: w.codenaam, kamer: w.kamer })) };
  }

  function bel(key, body, mijnCodenaam) {
    const doel = String((body || {}).codenaam || '').trim();
    let doelKey = null, doelKamer = null;
    for (const [id, k] of Object.entries(R().kamers)) {
      for (const [kk, l] of Object.entries(k.leden)) if (l.codenaam === doel && kk !== key) { doelKey = kk; doelKamer = id; }
    }
    if (!doelKey) return { status: 404, error: 'Dit lid is nu niet in het huis.' };
    try { sseToCustomer(doelKey, 'residentie', { kind: 'telefoon', kamer: doelKamer, van: mijnCodenaam, adres: 'suite:' + mijnCodenaam }); } catch (e) {}
    return { status: 200, ok: true };
  }

  return { daag, antwoord, spelZet, spelStop, vraag, huis, bel };
};
