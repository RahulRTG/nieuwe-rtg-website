/* DE HANDELSKETEN: één weg waarlangs elke zaak met elke andere zaak zaken doet.

   WAAROM DIT BESTAAT

   Zaak-naar-zaak werkte hier al, maar elk PAAR had zijn eigen uitvinding.
   Geteld in de code stonden er veertien verschillende aanvraag- en
   ordercollecties naast elkaar (bevAanvragen, groothandelOrders, vakOffertes,
   samenwerkingen, winkelBestellingen ...), elk met een eigen vorm, eigen
   statuswoorden en eigen endpoints. De groothandel had een volwaardige
   inkoopstroom, maar alleen naar groothandels. De creator-laag koppelde
   creators aan leveranciers, maar alleen die twee.

   Dat is de N-kwadraat-val. 73 genres die onderling zaken doen zijn 5329 paren;
   bij 130 genres 16.900. Zo komt het er nooit -- en het is precies de reden dat
   een beachclub geen linnen bij een wasserij kon bestellen: niet omdat het
   moeilijk is, maar omdat dat ene paar nog niet gebouwd was.

   Eén keten maakt van N-kwadraat weer N. Een zaak hoeft alleen deze weg te
   spreken en kan dan met ELK genre zaken doen:

     aanvraag -> offerte -> gunning -> planning -> levering (met bewijs)
              -> factuur -> betaling

   HOE HET VINDEN WERKT, EN WAAROM DAT HIER GRATIS IS

   Een aanvraag wordt niet aan een BEDRIJF gericht maar aan een GENRE. "Ik zoek
   een wasserij" bereikt elke wasserij op het net, ook een die zich gisteren
   heeft aangemeld. Dat kan sinds het genre-register (seed/genres.js) bestaat:
   het genre is een echte, gedeelde sleutel geworden in plaats van een woord dat
   op zestien plekken los werd opgeschreven. Een aanvraag op een sector kan
   later op dezelfde manier.

   WAT DIT (NOG) NIET DOET

   De factuur blijft in deze keten staan en gaat nog niet de centrale
   facturatielaag (kern/facturatie.js) in, en er wordt geen geld verplaatst:
   "betaald" is hier een administratieve vaststelling door de koper. Dat is
   bewust de eerste snede -- de keten eerst kloppend, daarna de koppeling naar
   het grootboek. Zie PLATFORM.md; het staat als open punt in TAKEN.md. */

'use strict';

const { STAPPEN, EENHEDEN, magStap, publiek, overzicht } = require('./handelsketen/regels');

function maakHandelsketen({ db, save, crypto, findSupplier, notifySupplier, sseToSupplier, schoon }) {
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const getal = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };

  function store() {
    if (!Array.isArray(db.data.handel)) db.data.handel = [];
    return db.data.handel;
  }
  function vind(id) { return store().find(h => h.id === String(id || '')); }
  function zaakInfo(s) { return { code: s.code, naam: s.name }; }
  function genreLabel(genre) {
    const t = (db.data.supplierTypes || {})[genre];
    return (t && t.label) || genre;
  }
  function meld(h, code, titel, body) {
    if (notifySupplier) notifySupplier(code, { icon: 'logistiek', title: titel, body });
    if (sseToSupplier) sseToSupplier(code, 'sync', { scope: 'handel' });
    h.log.push({ wat: titel, wie: code, at: nu() });
  }

  /* De poort van de keten staat in ./handelsketen/regels.js; hier komt alleen
     het opzoeken erbij, zodat elke stap met een handel of met een fout
     terugkomt. */
  function mag(zaak, id, stap) {
    const h = vind(id);
    if (!h) return { fout: { status: 404, error: 'Deze aanvraag kennen we niet.' } };
    const fout = magStap(h, zaak, stap);
    return fout ? { fout } : { h };
  }

  /* ---------- de koper: een aanvraag uitzetten bij een heel genre ---------- */
  function nieuweAanvraag(s, body) {
    const genre = scho(body.genre, 40);
    if (!genre || !(db.data.supplierTypes || {})[genre])
      return { status: 400, error: 'Kies een geldig soort bedrijf.' };
    if (genre === s.type) return { status: 400, error: 'Een aanvraag aan uw eigen soort bedrijf zetten we niet uit.' };
    const titel = scho(body.titel, 80);
    if (!titel) return { status: 400, error: 'Geef kort aan wat u nodig heeft.' };
    const regels = (Array.isArray(body.regels) ? body.regels : []).slice(0, 20)
      .map(r => ({ wat: scho(r && r.wat, 60), aantal: getal(r && r.aantal, 100000),
        eenheid: EENHEDEN.includes(r && r.eenheid) ? r.eenheid : 'stuk' }))
      .filter(r => r.wat && r.aantal > 0);
    if (!regels.length) return { status: 400, error: 'Zet er minstens een regel in, met een aantal.' };

    const h = {
      id: 'h' + crypto.randomBytes(6).toString('hex'),
      ref: 'AAN-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      koper: zaakInfo(s), genre, genreLabel: genreLabel(genre),
      titel, regels,
      ophalen: scho(body.ophalen, 60) || null,
      retour: scho(body.retour, 60) || null,
      status: 'aanvraag',
      offertes: [], gegundAan: null, planning: null, levering: null, factuur: null, betaaldAt: null,
      at: nu(), log: [{ wat: 'Aanvraag uitgezet', wie: s.code, at: nu() }]
    };
    store().push(h);
    save();
    // iedereen in het gevraagde genre krijgt hem te zien; de melding gaat mee
    for (const lev of db.data.suppliers || [])
      if (lev.type === genre && lev.code !== s.code)
        meld(h, lev.code, 'Nieuwe aanvraag', s.name + ' zoekt: ' + titel);
    save();
    return { handel: publiek(h, s) };
  }

  /* ---------- de leverancier: offreren ---------- */
  function offreren(s, id, body) {
    const { h, fout } = mag(s, id, 'offreren');
    if (fout) return fout;
    const prijs = getal(body.prijs, 1000000);
    if (prijs <= 0) return { status: 400, error: 'Noem een prijs.' };
    const bestaand = h.offertes.find(o => o.code === s.code);
    const o = { id: bestaand ? bestaand.id : 'o' + crypto.randomBytes(4).toString('hex'),
      code: s.code, naam: s.name, prijs, opmerking: scho(body.opmerking, 200), at: nu() };
    if (bestaand) Object.assign(bestaand, o); else h.offertes.push(o);
    meld(h, h.koper.code, bestaand ? 'Offerte bijgewerkt' : 'Nieuwe offerte',
      s.name + ' biedt € ' + prijs.toFixed(2) + ' voor ' + h.titel);
    save();
    return { handel: publiek(h, s) };
  }

  /* ---------- de koper: gunnen (het contractmoment) ---------- */
  function gunnen(s, id, offerteId) {
    const { h, fout } = mag(s, id, 'gunnen');
    if (fout) return fout;
    const o = h.offertes.find(x => x.id === String(offerteId || ''));
    if (!o) return { status: 404, error: 'Die offerte kennen we niet.' };
    h.gegundAan = { code: o.code, naam: o.naam, offerteId: o.id, prijs: o.prijs, at: nu() };
    h.status = 'gegund';
    meld(h, o.code, 'Aanvraag aan u gegund', h.koper.naam + ' gaat met uw offerte verder.');
    for (const ander of h.offertes) if (ander.code !== o.code)
      meld(h, ander.code, 'Aanvraag aan een ander gegund', h.titel);
    save();
    return { handel: publiek(h, s) };
  }

  function intrekken(s, id) {
    const { h, fout } = mag(s, id, 'intrekken');
    if (fout) return fout;
    h.status = 'ingetrokken';
    for (const o of h.offertes) meld(h, o.code, 'Aanvraag ingetrokken', h.titel);
    save();
    return { handel: publiek(h, s) };
  }

  /* ---------- de leverancier: plannen, leveren, factureren ---------- */
  function plannen(s, id, body) {
    const { h, fout } = mag(s, id, 'plannen');
    if (fout) return fout;
    h.planning = { ophaalMoment: scho(body.ophaalMoment, 60) || null,
      retourMoment: scho(body.retourMoment, 60) || null, at: nu() };
    h.status = 'gepland';
    meld(h, h.koper.code, 'Planning bevestigd', s.name + ': ' + (h.planning.ophaalMoment || 'ophalen') +
      (h.planning.retourMoment ? ', retour ' + h.planning.retourMoment : ''));
    save();
    return { handel: publiek(h, s) };
  }

  function leveren(s, id, body) {
    const { h, fout } = mag(s, id, 'leveren');
    if (fout) return fout;
    const bewijs = scho(body.bewijs, 120);
    if (!bewijs) return { status: 400, error: 'Zet erbij wie het heeft aangenomen; zonder bewijs geen levering.' };
    h.levering = { at: nu(), bewijs };
    h.status = 'geleverd';
    meld(h, h.koper.code, 'Geleverd', h.titel + ' -- aangenomen door ' + bewijs);
    save();
    return { handel: publiek(h, s) };
  }

  function factureren(s, id, body) {
    const { h, fout } = mag(s, id, 'factureren');
    if (fout) return fout;
    /* De prijs uit de gunning is de afspraak. Een factuur die daarvan afwijkt is
       geen detail maar een andere afspraak, dus die weigeren we hier -- anders
       is "gegund voor 240" een schatting geworden en niemand die het merkt. */
    const bedrag = getal(body.bedrag, 1000000);
    if (Math.abs(bedrag - h.gegundAan.prijs) > 0.005)
      return { status: 409, error: 'Het gegunde bedrag is € ' + h.gegundAan.prijs.toFixed(2) +
        '. Wijkt de factuur af, dan hoort daar een nieuwe afspraak bij.' };
    h.factuur = { nummer: 'F-' + crypto.randomBytes(3).toString('hex').toUpperCase(), bedrag, at: nu() };
    h.status = 'gefactureerd';
    meld(h, h.koper.code, 'Factuur ontvangen', s.name + ': € ' + bedrag.toFixed(2) + ' (' + h.factuur.nummer + ')');
    save();
    return { handel: publiek(h, s) };
  }

  /* ---------- de koper: betalen ---------- */
  function betalen(s, id) {
    const { h, fout } = mag(s, id, 'betalen');
    if (fout) return fout;
    h.betaaldAt = nu();
    h.status = 'betaald';
    meld(h, h.gegundAan.code, 'Factuur voldaan', h.koper.naam + ' heeft ' + h.factuur.nummer + ' voldaan.');
    save();
    return { handel: publiek(h, s) };
  }

  const mijn = (s) => overzicht(store(), db.data.supplierTypes || {}, s);

  return { STAPPEN, EENHEDEN, nieuweAanvraag, offreren, gunnen, intrekken, plannen,
    leveren, factureren, betalen, mijn, publiek };
}

module.exports = { maakHandelsketen, STAPPEN, EENHEDEN };
