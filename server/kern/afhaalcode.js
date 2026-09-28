/* De AFHAALCODE van een bestelling: een bearer van 128 bits waarmee de kassa
   van EEN zaak EEN bestelling eenmaal uitgeeft -- en, als het lid aan de balie
   afrekent, in dezelfde claim ook het afrekenbesluit vastlegt.

   WAAROM DIT ER IS. De oude `pickup` was vier tekens uit een alfabet van 32
   (ongeveer 20 bits), stond kaal op de order in het grootboek, reisde mee in
   kassalijsten, keukenbonnen, meldingen en AI-context, en de kassa gaf er een
   bestelling mee uit en zette een onbetaalde op betaald. Dat veld blijft, maar
   als BONNUMMER: een label voor keuken en pas dat niets autoriseert. De kassa
   zoekt er niet meer op (server/routes/supplier/kassa/innen.js).

   HET GEHEIM:
   - ontstaat alleen in uitgeven() (POST /api/order/afhaalcode: uitgeven IS
     roteren) en staat alleen in dat antwoord kaal; op schijf staat de SHA-256
     in `afhaalToegang`, per orderref, en een vorige code gaat ingetrokken de
     historie in;
   - draagt issuer, doel en scope, een vervaltijd en max_gebruik 1;
   - wordt door het lid ingetrokken, en door de zaak zodra die de bestelling
     afsluit, weigert of terugstort (sluit());
   - wordt constant-time gezocht: elke hash, ook na een treffer, en een treffer
     bij een ANDERE zaak telt niet -- de scope is de zaak;
   - wordt geclaimd in DEZELFDE collectietransactie waarin uitgifte en
     afrekenbesluit worden vastgelegd. In PostgreSQL is dat advisory lock plus
     FOR UPDATE, dus twee instances kunnen niet allebei uitgeven.

   WAAROM HET BESLUIT HIER WOONT EN NIET OP DE ORDER. `orders` is een
   rij-voor-rij grootboekcollectie zonder collectieslot. "Uitgegeven, en wel of
   niet afgerekend" is daarom hier autoritatief; de order krijgt daarna de
   projectie. Een kassa die de projectie mist (crash tussen commit en save)
   herhaalt met dezelfde idem-sleutel en krijgt het vastgelegde besluit terug,
   zonder tweede afrekening. Een app-betaling op een balie-bon zet hier eerst
   `betaling.weg = 'app'` (betaalBegin), zodat kassa en app niet allebei
   afrekenen. */
'use strict';

module.exports = ({ db, bewerkCollectie, crypto, nu }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('De afhaalcode vereist een collectietransactie.');
  const t = require('./afhaalcode-toegang')(nu ? { crypto, nu } : { crypto });
  const { bearer, afdruk, lidHash, ms, idem, open, mag, ruim, publiek, eigenRij, nieuweRij,
    sluitOud, ikBen, DOEL, SCOPE, GELDIG_MS, BETAAL_VENSTER_MS, DICHT } = t;
  nu = t.nu;
  const eigen = require('./eigencollectie')({ db, domein: 'kern/afhaalcode', bezit: { afhaalToegang: 'kaart' } });

  const transactie = werk => bewerkCollectie('afhaalToegang', bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('afhaalToegang hoort een kaart te zijn');
    return werk(bron);
  });

  function uitgeven({ order: o, key }) {
    if (!ikBen(o, key)) return { status: 404, error: 'Bestelling niet gevonden.' };
    if (!mag(o)) return { status: 409, error: open(o)
      ? 'Reken deze bestelling eerst af; daarna kunt u de afhaalcode tonen.'
      : 'Voor deze bestelling kan geen afhaalcode meer worden gemaakt.' };
    return transactie(bron => {
      const oud = bron[o.ref];
      if (!eigenRij(oud, o)) return { status: 409, error: 'Deze afhaalcode hoort niet bij deze bestelling.' };
      if (oud && oud.uitgifte) return { status: 409, error: 'Deze bestelling is al uitgegeven.' };
      ruim(bron);
      const r = bron[o.ref] || nieuweRij(bron, o);
      const rotatie = Math.max(0, ...[r.toegang, ...r.historie].filter(Boolean)
        .map(t => Number(t.rotatie) || 0)) + 1;
      sluitOud(r, lidHash(o), 'afhaalcode vernieuwd');
      const g = bearer.maak({ prefix: 'AH', issuer: 'rtg.lid.bestelling', doel: DOEL, scope: SCOPE,
        onderwerp: { soort: 'order', ref: o.ref, supplierCode: o.supplierCode, lid_hash: r.lid_hash },
        geldigMs: GELDIG_MS, maxGebruik: 1 });
      g.toegang.rotatie = rotatie;
      r.toegang = g.toegang;
      r.betaald_bij_uitgifte = r.betaald_bij_uitgifte || !!o.paid;
      r.bijgewerkt_at = nu();
      return { status: 200, ok: true, eenmalig: true, code: g.code, afhaal: publiek(r) };
    });
  }

  /* Intrekken zonder te vernieuwen: door het lid (key), of door de zaak bij
     afsluiten, weigeren of terugstorten (actor). Zonder rij valt er niets in te
     trekken, en dan wordt er ook niets geschreven. */
  function sluit({ order: o, key, actor, reden }) {
    if (key != null && !ikBen(o, key)) return { status: 404, error: 'Bestelling niet gevonden.' };
    return transactie(bron => {
      const r = bron[o.ref];
      if (!r || !eigenRij(r, o)) return { status: 200, ok: true, afhaal: null };
      if (r.toegang && !r.toegang.ingetrokken_at) {
        bearer.intrekken(r.toegang, key != null ? lidHash(o) : String(actor || 'zaak'), reden || 'ingetrokken');
        r.bijgewerkt_at = nu();
      }
      return { status: 200, ok: true, afhaal: publiek(r) };
    });
  }

  function claim({ code, supplierCode, actor, idempotentieSleutel, orderVan }) {
    const kale = String(code || '').trim().slice(0, 80);
    if (!kale) return { status: 400, error: 'Scan de afhaal-QR van het lid.' };
    const gezocht = bearer.hash(kale);
    const sl = idem(idempotentieSleutel);
    const idemHash = sl ? afdruk('afhaal-claim-v1|' + supplierCode + '|' + sl) : null;
    return transactie(bron => {
      let r = null, oud = null;
      for (const x of Object.values(bron)) {
        if (bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash, gezocht)) r = x;
        for (const t of (x && x.historie) || []) if (bearer.zelfdeHash(t && t.code_hash, gezocht)) oud = x;
      }
      if (!r && oud && oud.supplierCode === supplierCode)
        return { status: 409, error: 'Deze afhaalcode is vervangen. Vraag het lid de nieuwe te tonen.' };
      if (!r || r.supplierCode !== supplierCode) return { status: 404, error: 'Deze afhaalcode kennen we hier niet.' };
      if (r.uitgifte) {
        if (idemHash && bearer.zelfdeHash(r.uitgifte.idem_hash, idemHash))
          return { status: 200, ok: true, herhaald: true, ref: r.ref, afgerekend: r.uitgifte.afgerekend };
        return { status: 409, error: 'Deze bestelling is al uitgegeven.' };
      }
      const reden = bearer.reden(r.toegang, { doel: DOEL, scope: SCOPE });
      if (reden === 'verlopen') return { status: 410, error: 'Deze afhaalcode is verlopen; het lid toont in de app een nieuwe.' };
      if (reden) return { status: 409, error: 'Deze afhaalcode is niet meer geldig.' };
      const o = orderVan(r.ref), ow = r.toegang.onderwerp || {};
      if (!o || o.ref !== r.ref || o.supplierCode !== supplierCode || !eigenRij(r, o) ||
          ow.ref !== o.ref || ow.supplierCode !== supplierCode || ow.lid_hash !== r.lid_hash)
        return { status: 404, error: 'Deze afhaalcode kennen we hier niet.' };
      if (!open(o)) return { status: 409, error: DICHT.slice(0, 3).includes(o.status)
        ? 'Deze bestelling is al uitgegeven.' : 'Deze bestelling is geannuleerd.' };
      const b = r.betaling;
      const betaald = !!o.paid || r.betaald_bij_uitgifte || !!(b && b.weg === 'app' && b.klaar);
      if (!betaald && b && b.weg === 'app' && ms() - Date.parse(b.at) < BETAAL_VENSTER_MS)
        return { status: 409, error: 'Het lid rekent deze bestelling nu in de app af. Probeer het over een minuut opnieuw.' };
      bearer.gebruik(r.toegang);
      if (!betaald) r.betaling = { weg: 'kassa', at: nu(), klaar: true };
      r.uitgifte = { at: nu(), afgerekend: !betaald, idem_hash: idemHash,
        actor_hash: afdruk('afhaal-kassa-v1|' + supplierCode + '|' + String(actor || '')) };
      r.bijgewerkt_at = nu();
      return { status: 200, ok: true, ref: r.ref, afgerekend: !betaald };
    });
  }

  /* De app-kant van dezelfde balie-bon: eerst de betaalweg vastleggen, dan pas
     geld bewegen, en daarna melden hoe het afliep. */
  function betaalBegin(o) {
    return transactie(bron => {
      const r = bron[o.ref];
      if (r && r.betaling && r.betaling.weg === 'kassa')
        return { status: 409, error: 'Deze bestelling is al aan de kassa afgerekend.' };
      if (!eigenRij(r, o)) return { status: 409, error: 'Deze bestelling hoort bij een ander.' };
      const x = r || nieuweRij(bron, o);
      x.betaling = { weg: 'app', at: nu(), klaar: false };
      x.bijgewerkt_at = nu();
      return { ok: true };
    });
  }
  function betaalEinde(o, gelukt) {
    return transactie(bron => {
      const r = bron[o.ref];
      if (!r || !r.betaling || r.betaling.weg !== 'app') return { ok: true };
      if (gelukt) r.betaling.klaar = true; else r.betaling = null;
      r.bijgewerkt_at = nu();
      return { ok: true };
    });
  }

  const standVan = ref => { const r = eigen.kijk('afhaalToegang')[ref]; return r ? publiek(r) : null; };

  return { uitgeven, sluit, claim, betaalBegin, betaalEinde, standVan, mag, DOEL, SCOPE, GELDIG_MS };
};

