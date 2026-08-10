/* RTG Mall, deelbestand "bestellingen": ALLES WAT U LOPEN HEEFT, OP EEN PLEK.

   Dezelfde truc als ./aanbod.js, maar dan de andere kant op: waar de aanbodlaag
   uit tien domeinen EEN zoeklijst maakt, maakt dit uit vijf domeinen EEN
   overzicht van wat er loopt. Een tafel bij de een, een klus bij de ander, een
   reis bij het reisbureau en een verblijf bij RTG Thuis stonden tot nu toe in
   vier schermen.

   ================== WAT DIT NADRUKKELIJK NIET IS ==================

   Dit is GEEN gezamenlijke afrekening. Er is bewust geen knop "betaal alles":
   achter deze regels zitten verschillende partijen met verschillende
   bevestigingen, en een enkele knop zou een belofte doen die niemand van hen
   heeft gegeven. Elke regel wijst naar het scherm van het domein dat hem
   werkelijk beheert; annuleren, betalen en wijzigen gebeuren daar.

   Er wordt hier dus ook NIETS geschreven. Geen status gezet, geen betaling
   gemarkeerd, geen annulering. Alleen lezen.

   ================== DRIE DINGEN DIE NIET MOGEN VERDWIJNEN ==================

   1. EEN KAPOTTE BRON. Valt een domein om, dan komt dat als `stuk` terug en
      niet als een korter lijstje. Een overzicht dat stilletjes een reis
      weglaat, is erger dan een overzicht dat zegt dat het de reizen niet kon
      ophalen (LAT-regel 5).
   2. EEN ONBEKENDE STATUS. De domeinen houden hun eigen statussen en die worden
      hier ONGEWIJZIGD getoond. Wat we niet herkennen valt in "loopt" -- met
      zijn eigen naam erbij, niet weggemoffeld onder een verzonnen label.
   3. BETAALD OF NIET. `betaald` komt uit de bron. Waar een bron dat niet
      bijhoudt staat er null, en dat is niet hetzelfde als false. */

const { stand } = require('../ervaring/afgerond');

const SOORT_LABEL = {
  order: 'Bestelling', boeking: 'Afspraak', ticket: 'Ticket',
  reservering: 'Tafel', reis: 'Reis', verblijf: 'Verblijf'
};

module.exports = (ctx) => {
  const { db } = ctx;
  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);

  /* De gedeelde vorm. `bedrag` mag null zijn (een offerte zonder prijs, een
     tafel zonder aanbetaling) -- dat is iets anders dan nul. */
  function regel(o) {
    const soort = o.soort;
    return {
      id: tekst(o.id, 60), bron: o.bron, soort, soortLabel: SOORT_LABEL[soort] || soort,
      titel: tekst(o.titel, 140),
      aanbieder: tekst(o.aanbieder, 80) || 'RTG',
      aanbiederCode: o.aanbiederCode || null,
      status: tekst(o.status, 40),
      stand: stand(soort, o.status),
      betaald: o.betaald == null ? null : !!o.betaald,
      bedrag: o.bedrag == null ? null : Math.round(Number(o.bedrag) * 100) / 100,
      valuta: 'EUR',
      wanneer: o.wanneer || null,
      at: o.at || null,
      // waar deze regel werkelijk wordt beheerd; hier gebeurt niets
      pagina: o.pagina
    };
  }

  const som = (items) => (items || []).reduce((s, i) => s + (Number(i.prijs || i.price || 0) * (Number(i.aantal || i.qty || 1))), 0);

  function bronOrders(key) {
    return (db.ordersVanKlant ? db.ordersVanKlant(key) : (db.data.orders || []).filter(o => o.customerKey === key))
      .map(o => regel({
        id: o.ref, bron: 'horeca-winkel', soort: 'order',
        titel: (o.items || []).map(i => i.naam || i.name).filter(Boolean).slice(0, 3).join(', ') || 'Bestelling',
        aanbieder: o.supplierName, aanbiederCode: o.supplierCode,
        status: o.status, betaald: o.paid,
        bedrag: o.total != null ? o.total : som(o.items),
        at: o.at, pagina: '/apps/portaal.html'
      }));
  }

  function bronBoekingen(key) {
    return (db.boekingenVanKlant ? db.boekingenVanKlant(key) : (db.data.boekingen || []).filter(b => b.customerKey === key))
      .map(b => regel({
        id: b.ref, bron: b.kind === 'ticket' ? 'tickets' : 'diensten',
        soort: b.kind === 'ticket' ? 'ticket' : 'boeking',
        titel: (b.service && b.service.name) || 'Afspraak',
        aanbieder: b.supplierName, aanbiederCode: b.supplierCode,
        status: b.status, betaald: b.paid,
        bedrag: typeof b.price === 'number' ? b.price : (b.price && b.price.totaal),
        wanneer: b.wanneer || (b.datum ? b.datum + (b.tijd ? ' ' + b.tijd : '') : null),
        at: b.at, pagina: '/apps/portaal.html'
      }));
  }

  function bronReserveringen(key) {
    return (db.data.reserveringen || []).filter(r => r.customerKey === key).map(r => regel({
      id: r.id, bron: 'foodcourt', soort: 'reservering',
      titel: r.personen + ' personen',
      aanbieder: r.supplierName, aanbiederCode: r.supplierCode,
      status: r.status,
      // een tafel kent geen betaling tenzij de zaak een aanbetaling vraagt
      betaald: r.aanbetaling ? !!r.aanbetaling.betaald : null,
      bedrag: r.aanbetaling ? (r.aanbetaling.centen || 0) / 100 : null,
      wanneer: r.datum + ' ' + r.tijd, at: r.at, pagina: '/apps/foodcourt.html'
    }));
  }

  function bronReizen(key) {
    return (db.data.reisAanvragen || []).filter(a => a.customerKey === key).map(a => regel({
      id: a.ref, bron: 'reisbureau', soort: 'reis',
      titel: a.titel, aanbieder: 'RTG Reisbureau',
      status: a.status, betaald: false,
      bedrag: a.prijs ? a.prijs.totaal : null,
      wanneer: a.vertrek || null, at: a.at, pagina: '/apps/reisbureau.html'
    }));
  }

  /* RTG Thuis houdt zijn boekingen op CODENAAM en niet op lidsleutel -- dat is
     geen slordigheid maar het privacy-ontwerp van dat domein. Zonder codenaam
     kunnen we dus niets vinden, en dan doen we ook niet alsof: de bron meldt
     zichzelf als overgeslagen in plaats van een lege lijst te leveren. */
  function bronThuis(key, codenaam) {
    if (!codenaam) { const e = new Error('zonder codenaam zijn verblijven niet op te zoeken'); e.overslaan = true; throw e; }
    const boekingen = db.data.thuisBoekingen || [];
    return boekingen.filter(b => b.gast === codenaam).map(b => regel({
      id: b.ref, bron: 'thuis', soort: 'verblijf',
      titel: b.titel, aanbieder: b.plaats || 'RTG Thuis',
      status: b.status, betaald: false,
      bedrag: b.prijsopbouw ? b.prijsopbouw.totaal : null,
      wanneer: b.van + ' t/m ' + b.tot, at: b.at || null,
      pagina: '/apps/thuis.html'
    }));
  }

  const BRONNEN = [
    ['horeca-winkel', bronOrders], ['diensten', bronBoekingen],
    ['foodcourt', bronReserveringen], ['reisbureau', bronReizen], ['thuis', bronThuis]
  ];

  /* Alles van dit lid. Een bron die omvalt neemt de rest niet mee, maar
     verdwijnt ook niet: hij komt terug in `stuk` met zijn reden. */
  function mijn(key, codenaam) {
    const uit = [], stuk = [];
    for (const [naam, fn] of BRONNEN) {
      try { uit.push(...fn(key, codenaam)); }
      catch (e) {
        stuk.push({ bron: naam, fout: String((e && e.message) || e).slice(0, 200), overslaan: !!(e && e.overslaan) });
      }
    }
    uit.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    const perStand = (s) => uit.filter(r => r.stand === s);
    return {
      ok: true,
      bestellingen: uit,
      aantal: uit.length,
      loopt: perStand('loopt').length,
      klaar: perStand('klaar').length,
      afgezegd: perStand('afgezegd').length,
      bronnen: BRONNEN.map(b => b[0]),
      stuk,
      /* Deze twee zinnen zijn geen sier: zonder de eerste gaat iemand hier een
         betaalknop zoeken, en zonder de tweede denkt hij dat RTG partij is bij
         alle vijf. */
      opmerking: 'Elke regel wordt beheerd door de partij die hem levert; annuleren, betalen en wijzigen gebeurt daar.',
      geenGezamenlijkeAfrekening: true
    };
  }

  const api = { mijn, BRONNEN: BRONNEN.map(b => b[0]) };
  ctx.bestellingen = api;
  return { mallBestellingen: api };
};

module.exports.SOORT_LABEL = SOORT_LABEL;
