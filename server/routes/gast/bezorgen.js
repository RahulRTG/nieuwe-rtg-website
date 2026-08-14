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
  const { app, auth, schoon, findSupplier, horeca, orderlaag, buitenshuis, bezorglaag, beleid, stuur, naad } = kern;

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

  const betaalBuiten = require('./betalen-buiten')({ kern, zaakVan, handleVan,
    horeca, orderlaag, naad });

  const checkoutVan = require('./checkout-buiten')({ kern, horeca, bezorglaag, beleid, schoon });

  const publiekCheckout = (uit) => {
    const schoonUit = Object.assign({}, uit);
    delete schoonUit._check;
    return schoonUit;
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

  /* Eén controlepoort voor bezorgen én afhalen. De naam blijft onder bezorg
     omdat dit scherm en deze ledensessie daar al hun API-ruimte hebben; het
     veld `kanaal` maakt het antwoord ondubbelzinnig. */
  app.post('/api/gast/bezorg/checkout', auth, (req, res) => {
    if (kern.gegevensStop(req, res, 'bestelling')) return;
    const s = zaakVan(req, res); if (!s) return;
    const b = req.body || {};
    const kanaal = b.kanaal === 'afhaal' ? 'afhaal' : 'bezorging';
    const uit = checkoutVan(s, b, kanaal);
    if (uit.error) return stuur(res, uit);
    res.json(betaalBuiten.verrijkCheckout(req, publiekCheckout(uit)));
  });

  require('./profiel-buiten')({ kern, zaakVan, horeca, bezorglaag, beleid, schoon });

  /* ---------- bestellen ---------- */
  function bestelBuiten(req, res, kanaal) {
    const s = zaakVan(req, res); if (!s) return;
    const b = req.body || {};
    const handle = handleVan(req);

    /* Eerst het HELE mandje en de zone, dan pas een rekening openen. Dezelfde
       functie voedt de controlesheet in de app, maar de server voert hem hier
       opnieuw uit: een oude of aangepaste browser kan de grens niet omzeilen. */
    const voorbeeld = checkoutVan(s, b, kanaal);
    if (voorbeeld.error) return stuur(res, voorbeeld);
    /* Een vol slot houdt de oude, herstelbare API-belofte: de regels worden
       aangenomen en het antwoord noemt een alternatief. De nieuwe checkout
       voorkomt dat normale schermgebruikers zover komen, maar een oudere app
       verliest zijn bestelling niet. Andere blokkades openen niets. */
    if (!voorbeeld.bevestigbaar && voorbeeld.blokkadeCode !== 'slot-vol')
      return res.status(409).json({ error: voorbeeld.blokkade,
        code: voorbeeld.blokkadeCode, checkout: publiekCheckout(voorbeeld) });
    const check = voorbeeld._check;

    const lop = buitenshuis.lopende(s.code, kanaal, handle);
    if (lop.error) return stuur(res, lop);
    const rek = lop.rekening;
    const betalingLoopt = betaalBuiten.bewaakRekening(rek);
    if (betalingLoopt) return res.status(betalingLoopt.status).json(betalingLoopt);

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
    /* Bij betaling op locatie mag de keuken meteen aan de slag. Bij online
       betalen blijft de bon achter de harde grendel tot de provider definitief
       heeft bevestigd -- processing of authorized is nadrukkelijk niet genoeg. */
    rek.betaalVoorkeur = b.betalingWijze === 'online' ? 'online' : 'ontvangst';
    if (rek.betaalVoorkeur !== 'online') betaalBuiten.maakVrij(rek);
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

  require('./mijn-buiten')({ kern, zaakVan, handleVan, horeca, orderlaag,
    buitenshuis, findSupplier, stuur });
};
