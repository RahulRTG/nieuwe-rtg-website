/* Verzekeringen: uitsluitend adviserend (reis, annulering, pleziervaart).
   Hier wordt nooit een polis afgesloten; de klant beslist zelf na
   menselijk advies. Opslag in db.data.polis[code]. */

const { MAX_LIJST, maakHulp } = require('../genrehulp');

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, id, cap, bak } = maakHulp({ db, save, crypto });

  function demoPolis() {
    return {
      naam: 'Segur Advies',
      producten: [
        { id: 'p1', naam: 'Reisverzekering', indicatie: 'indicatie vanaf 12 per maand' },
        { id: 'p2', naam: 'Annuleringsdekking', indicatie: 'indicatie 5 procent van de reissom' },
        { id: 'p3', naam: 'Jacht en pleziervaart', indicatie: 'indicatie op aanvraag' }
      ],
      aanvragen: [],
      regel: 'Wij adviseren alleen. Een polis sluit u altijd zelf af bij de verzekeraar, na het advies van een mens; hier wordt nooit iets automatisch afgesloten.'
    };
  }
  const polVan = bak('polis', demoPolis);

  function polOverzicht(code) {
    const p = polVan(code);
    return {
      naam: p.naam, producten: p.producten, regel: p.regel,
      aanvragen: p.aanvragen.slice(0, 30),
      kpi: {
        open: p.aanvragen.filter(x => x.status === 'aangevraagd').length,
        geadviseerd: p.aanvragen.filter(x => x.status === 'advies-klaar').length,
        doorverwezen: p.aanvragen.filter(x => x.status === 'doorverwezen').length
      }
    };
  }
  function adviesVraag(code, b) {
    const p = polVan(code);
    const product = p.producten.find(x => x.id === String(b.productId || ''));
    const klant = schoon(b.klant, 60), situatie = schoon(b.situatie, 200);
    if (!product) return { status: 404, error: 'Kies een van onze adviesproducten.' };
    if (!klant || !situatie) return { status: 400, error: 'Voor wie is het advies, en wat is de situatie?' };
    const a = { id: id('v'), klant, product: product.naam, situatie, advies: '', status: 'aangevraagd', gemaakt: nu() };
    p.aanvragen.unshift(a); cap(p.aanvragen, MAX_LIJST); save();
    return { ok: true, aanvraag: a };
  }
  function adviesZet(code, b) {
    const p = polVan(code);
    const a = p.aanvragen.find(x => x.id === String(b.id || ''));
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (b.status === 'advies-klaar') {
      const advies = schoon(b.advies, 240);
      if (!advies) return { status: 400, error: 'Schrijf het advies; dat komt van een mens, niet van het systeem.' };
      a.advies = advies; a.status = 'advies-klaar';
    } else if (b.status === 'doorverwezen') {
      if (a.status !== 'advies-klaar') return { status: 409, error: 'Eerst het advies, dan pas de doorverwijzing.' };
      a.status = 'doorverwezen';
    } else return { status: 400, error: 'Hier wordt niets afgesloten; kies advies-klaar of doorverwezen.' };
    save(); return { ok: true, aanvraag: a };
  }

  return { polis: { overzicht: polOverzicht, adviesVraag, adviesZet } };
};
