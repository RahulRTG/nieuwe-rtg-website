/* DE HANDELSKETEN: één weg waarlangs elke zaak met elke andere zaak zaken doet.

   WAAROM DIT BESTAAT

   Zaak-naar-zaak werkte hier al, maar elk PAAR had zijn eigen uitvinding:
   veertien aanvraag- en ordercollecties naast elkaar (bevAanvragen,
   groothandelOrders, vakOffertes, samenwerkingen ...), elk met een eigen vorm en
   eigen statuswoorden. Dat is de N-kwadraat-val -- 73 genres zijn 5329 paren, bij
   130 genres 16.900 -- en precies waarom een beachclub geen linnen bij een
   wasserij kon bestellen: niet omdat het moeilijk is, maar omdat dat ene paar
   niet gebouwd was. Een keten maakt daar weer N van:

     aanvraag -> offerte -> gunning -> planning -> levering (met bewijs)
              -> factuur -> betaling

   HOE HET VINDEN WERKT

   Een aanvraag gaat naar een GENRE en niet naar een bedrijf: "ik zoek een
   wasserij" bereikt elke wasserij op het net, ook een die zich gisteren heeft
   aangemeld. Dat kan sinds het genre-register (seed/genres.js) van het genre
   een echte gedeelde sleutel maakte in plaats van een woord dat op zestien
   plekken los werd opgeschreven.

   WAT DIT (NOG) NIET DOET

   De veertien oude aanvraagcollecties draaien er nog naast; die migreren is een
   eigen stap per stuk (zie TAKEN.md). En "betaald" is een vaststelling door de
   koper: de factuur staat in het grootboek, maar er wordt hier geen geld
   verplaatst. Zie PLATFORM.md. */

'use strict';

const { STAPPEN, EENHEDEN, magStap, publiek, overzicht } = require('./handelsketen/regels');

function maakHandelsketen({ db, save, crypto, findSupplier, notifySupplier, sseToSupplier, schoon, facturatie }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/handelsketen', bezit: { handel: 'lijst' } });
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const getal = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };

  function store() {
    return eigen.bak('handel');
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

  /* De twee stukken die BEIDE ingangen delen: het lezen van de regels en het
     bouwen van een lege handel. Ze staan hier los omdat een rechtstreekse
     bestelling (./handelsketen/bestellen.js) ze ook gebruikt -- twee keer
     hetzelfde bouwen zou twee soorten handel geven met dezelfde woorden erop. */
  function leesRegels(regelsIn) {
    return (Array.isArray(regelsIn) ? regelsIn : []).slice(0, 20)
      .map(r => ({ wat: scho(r && r.wat, 60), aantal: getal(r && r.aantal, 100000),
        eenheid: EENHEDEN.includes(r && r.eenheid) ? r.eenheid : 'stuk' }))
      .filter(r => r.wat && r.aantal > 0);
  }
  function nieuweHandel(s, d) {
    return {
      id: 'h' + crypto.randomBytes(6).toString('hex'),
      ref: 'AAN-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      koper: zaakInfo(s), genre: d.genre, genreLabel: genreLabel(d.genre),
      titel: d.titel, regels: d.regels, ophalen: d.ophalen || null, retour: d.retour || null,
      status: 'aanvraag', bron: 'aanvraag',
      offertes: [], gegundAan: null, planning: null, levering: null, factuur: null, betaaldAt: null,
      at: nu(), log: [{ wat: 'Aangemaakt', wie: s.code, at: nu() }]
    };
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
      return { status: 409, error: 'Het gegunde bedrag is \u20ac ' + h.gegundAan.prijs.toFixed(2) +
        '. Wijkt de factuur af, dan hoort daar een nieuwe afspraak bij.' };

    /* De factuur gaat de CENTRALE facturatielaag in en krijgt daar zijn nummer.
       Eerst deed deze keten dat zelf, met een eigen reeks -- en dan bestaan er
       twee soorten facturen in huis die geen van beide de andere kennen
       (LAT-regel 4). Nu staat een handelsfactuur gewoon in het factuuroverzicht
       van beide zaken, met de aanvraagreferentie eraan. */
    const geboekt = facturatie && typeof facturatie.boek === 'function'
      ? facturatie.boek({
        soort: 'dienst', verkoperCode: s.code, verkoperNaam: s.name,
        koper: { supplierCode: h.koper.code, naam: h.koper.naam },
        totaal: bedrag, omschrijving: h.titel, ref: h.ref
      })
      : null;
    if (geboekt && geboekt.error) return { status: 409, error: geboekt.error };
    const f = geboekt && geboekt.factuur;
    if (!f || !f.nummer) return { status: 500, error: 'De factuur kon niet worden geboekt.' };
    h.factuur = { nummer: f.nummer, id: f.id || null, bedrag, at: nu() };
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

  /* De twee INGANGEN van de keten -- een aanvraag bij een heel genre, of een
     rechtstreekse bestelling bij een bekende zaak -- staan samen in een eigen
     bestand. Samen, want ze delen alles behalve hun kop; zie daar waarom die
     tweede ingang bestaat. */
  const { nieuweAanvraag, bestellen } = require('./handelsketen/ingangen')({
    db, crypto, findSupplier, store, save, meld, scho, getal, nu, publiek, nieuweHandel, leesRegels });

  return { STAPPEN, EENHEDEN, nieuweAanvraag, bestellen, offreren, gunnen, intrekken, plannen,
    leveren, factureren, betalen, mijn, publiek };
}

module.exports = { maakHandelsketen, STAPPEN, EENHEDEN };
