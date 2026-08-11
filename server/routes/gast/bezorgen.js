/* Guest OS (deellaag): BEZORGEN EN AFHALEN vanaf de ledenapp.

   De poort is hier `auth` en niet `gastAuth`. Dat is geen inconsistentie maar
   het kanaalverschil: aan tafel bewijst de QR dat je er bent, thuis bestaat dat
   bewijs niet en moet er iemand bereikbaar zijn. Wat er ONDER ligt is identiek
   -- dezelfde rekening, dezelfde orderlaag, dezelfde idempotentie en audit.

   DE VOLGORDE IS GEDRAG. Een bezorgbestelling wordt in deze volgorde
   opgebouwd: eerst de zone (mag het hier, wat kost het), dan het mandje (de
   regels), dan het tijdslot (kan de keuken het aan). Andersom reserveer je
   keukenminuten voor een bestelling die buiten de zone valt, en dan knijpt de
   rem een keuken dicht voor een rit die nooit gaat rijden. */
'use strict';

module.exports = (kern) => {
  const { app, auth, schoon, findSupplier, orderlaag, buitenshuis, bezorglaag, beleid, stuur, naad } = kern;

  /* De codenaam van het lid. Nooit de echte naam en nooit de sleutel: de
     identiteitskluis blijft gescheiden, ook als de bezorger voor de deur staat
     -- die krijgt een adres, geen personalia. */
  /* De handle van een lid op een rekening komt uit kern/gast/naad.js. Hij
     stond hier en in foodcourt.js woordelijk hetzelfde, en die twee moeten
     dezelfde handle opleveren: anders vinden je bezorgbestellingen en je
     foodcourt-mandje elkaar niet meer, zonder enige foutmelding. */
  const handleVan = naad.handleVanReq;

  const zaakVan = (req, res) => {
    const s = findSupplier(schoon((req.body || {}).zaak, 30));
    if (!s) { res.status(404).json({ error: 'Deze zaak kennen we niet.', code: 'zaak-onbekend' }); return null; }
    return s;
  };

  /* ---------- kan het hier bezorgd worden ----------
     Bewust ook te stellen VOORDAT er iets in het mandje zit: wie eerst een
     kwartier een bestelling samenstelt en dan hoort dat er niet bezorgd wordt,
     is terecht boos. */
  app.post('/api/gast/bezorg/check', auth, (req, res) => {
    const s = zaakVan(req, res); if (!s) return;
    const b = req.body || {};
    const uit = bezorglaag.bezorgCheck(s.code, s, { postcode: b.postcode, lat: b.lat, lng: b.lng,
      bedragCenten: b.bedragCenten });
    if (uit.error) return stuur(res, uit);
    const sloten = bezorglaag.slotenVan(s.code, schoon(b.datum, 10));
    res.json(Object.assign(uit, { zaak: { code: s.code, naam: s.name },
      datum: sloten.datum, sloten: sloten.sloten.filter(x => !x.vol) }));
  });

  /* ---------- de kaart van een zaak, buiten de deur ---------- */
  app.post('/api/gast/bezorg/kaart', auth, (req, res) => {
    const s = zaakVan(req, res); if (!s) return;
    res.json({ ok: true, zaak: { code: s.code, naam: s.name },
      kaart: kern.gastKaartVanZaak(s.code), beleid: beleid.beleidVan(s.code) });
  });

  /* ---------- bestellen ---------- */
  function bestelBuiten(req, res, kanaal) {
    const s = zaakVan(req, res); if (!s) return;
    const b = req.body || {};
    const handle = handleVan(req);

    /* Eerst de zone, dan pas een rekening openen. Een half opgebouwde
       bestelling bij een zaak die niet bij je bezorgt, is rommel die blijft
       staan en die de zaak op zijn scherm ziet. */
    let check = null;
    if (kanaal === 'bezorging') {
      check = bezorglaag.bezorgCheck(s.code, s, { postcode: b.postcode, lat: b.lat, lng: b.lng, bedragCenten: 0 });
      if (check.error) return stuur(res, check);
      if (!check.bezorgbaar) return res.status(409).json({ error: check.reden || check.redenDicht,
        code: check.code || 'bezorging-dicht', km: check.km || null });
    }

    const lop = buitenshuis.lopende(s.code, kanaal, handle);
    if (lop.error) return stuur(res, lop);
    const rek = lop.rekening;

    const kaart = kern.gastKaartVanZaak(s.code);
    const uit = orderlaag.bestel(s.code, rek, lop.deelnemer, {
      items: b.items, allergie: schoon(b.allergie, 120) || null,
      idem: b.idem, apparaat: schoon(b.apparaat, 40) || null,
      kaartVan: (id) => { const m = kaart.find(x => x.id === id); return m
        ? { id: m.id, name: m.naam, price: m.centen / 100, cat: m.cat, station: m.station, alcohol: m.alcohol } : null; }
    });
    if (uit.error) return stuur(res, uit);
    if (uit.herhaald) return res.json(uit);

    /* Nu pas het tijdslot. Lukt dat niet, dan staat de bestelling er wel maar
       zonder tijd -- en het antwoord zegt welk slot wel kan. Terugdraaien van
       de regels zou erger zijn: dan is de bestelling weg en moet de gast alles
       opnieuw kiezen omdat het een kwartier te druk was. */
    let slot = null;
    if (b.tijd) {
      const minuten = Math.max(5, Math.min(120, (rek.regels || []).length * 5));
      slot = bezorglaag.reserveerSlot(s.code, { datum: b.datum, tijd: b.tijd, minuten });
      if (slot.error) {
        return res.status(slot.status || 409).json(Object.assign({}, slot,
          { bestellingStaat: true, rekeningId: rek.id,
            let: 'Je bestelling staat klaar maar heeft nog geen tijd. Kies een ander tijdslot.' }));
      }
    }

    if (kanaal === 'bezorging') {
      buitenshuis.zetBezorging(rek, { adres: b.adres, postcode: b.postcode, lat: b.lat, lng: b.lng,
        zone: check.zone, kostenCenten: check.kostenCenten, datum: b.datum, tijd: b.tijd, opmerking: b.opmerking });
      /* De bezorgkosten opnieuw uitrekenen NA het mandje: gratis-vanaf hangt aan
         het bedrag, en dat weet je pas als de regels erop staan. */
      const na = bezorglaag.bezorgCheck(s.code, s, { postcode: b.postcode, lat: b.lat, lng: b.lng,
        bedragCenten: (rek.regels || []).filter(r => !r.bezorgkosten).reduce((t, r) => t + r.centen * r.aantal, 0) });
      buitenshuis.zetBezorgkosten(rek, na.kostenCenten || 0, check.zone ? check.zone.naam : null);
      rek.bezorg.kostenCenten = na.kostenCenten || 0;
      if (!na.haaltMinimum) rek.bezorg.tekort = na.tekort;
      else delete rek.bezorg.tekort;
    } else {
      buitenshuis.zetAfhaal(rek, { datum: b.datum, tijd: b.tijd, opmerking: b.opmerking });
    }
    orderlaag.audit(rek, { actor: handle, bron: 'gast', apparaat: schoon(b.apparaat, 40) || null,
      wat: kanaal, naar: (b.tijd || 'zonder tijd') });
    kern.save();

    res.json({ ok: true, kanaal, toegevoegd: uit.toegevoegd, bevestiging: uit.bevestiging || null,
      bezorg: rek.bezorg || null, afhaal: rek.afhaal || null,
      slot: slot && slot.ok ? { datum: slot.datum, tijd: slot.tijd } : null,
      tekort: rek.bezorg && rek.bezorg.tekort ? rek.bezorg.tekort : 0,
      rekening: orderlaag.gastBeeld(rek, lop.deelnemer) });
  }

  /* De gegevenspoort staat HIER en niet in bestelBuiten(). Twee redenen, en de
     tweede is de echte: een lezer ziet aan de route zelf welke gegevens hij
     eist, en de keuring leest de body van de route (check.js regel over derde
     partijen) -- een poort die in een hulpfunctie wegkruipt, is een poort die
     de handhaver niet kan zien. Bezorging vraagt telefoon EN adres, want er
     komt iemand langs; afhalen alleen een nummer, want de tas ligt klaar op een
     code en een adres zou meer zijn dan nodig. */
  app.post('/api/gast/bezorg/bestel', auth, (req, res) => {
    if (kern.gegevensStop(req, res, 'bezorging')) return;
    bestelBuiten(req, res, 'bezorging');
  });
  app.post('/api/gast/afhaal/bestel', auth, (req, res) => {
    if (kern.gegevensStop(req, res, 'bestelling')) return;
    bestelBuiten(req, res, 'afhaal');
  });

  /* ---------- mijn bestellingen ---------- */
  app.post('/api/gast/bezorg/mijn', auth, (req, res) => {
    res.json({ ok: true, bestellingen: buitenshuis.mijne(kern.db, handleVan(req)) });
  });

  app.post('/api/gast/bezorg/rekening', auth, (req, res) => {
    const s = zaakVan(req, res); if (!s) return;
    const kanaal = String((req.body || {}).kanaal || 'bezorging');
    const lop = buitenshuis.lopende(s.code, kanaal, handleVan(req), { open: false });
    if (lop.error) return stuur(res, lop);
    if (!lop.rekening) return res.status(404).json({ error: 'Je hebt hier geen lopende bestelling.', code: 'niets-open' });
    res.json({ ok: true, rekening: orderlaag.gastBeeld(lop.rekening, lop.deelnemer),
      bezorg: lop.rekening.bezorg || null, afhaal: lop.rekening.afhaal || null });
  });
};
