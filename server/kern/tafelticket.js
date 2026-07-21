/* Tafelticket: de bonnen van dezelfde tafel op EEN ticket.

   Een tafel kan meerdere losse bonnen hebben (meerdere gasten, meerdere
   rondes). Dit voegt alle openstaande bonnen aan een tafel samen tot een
   ticket met een uitsplitsing per gast en een totaal. De AI (Rahul) doet dit
   via de gewone /api/supplier/tafelticket-route, dus met de inlog en de
   controles van de zaak zelf -- een codepad, geen apart AI-terrein.

   De beveiliging zit ingebouwd, in lagen:
   1. Autorisatie: alleen via supplierAuth, en we kijken alleen naar de eigen
      bonnen van die zaak (ordersVanZaak(code)). Bonnen van een andere tafel of
      een andere zaak kunnen er nooit in belanden.
   2. Integriteit: over de canonieke inhoud (zaak, tafel, gesorteerde refs,
      totaal, tijd) zetten we een HMAC-zegel met een serversleutel die alleen
      op de node staat (tafelticket.key, 0600, in .gitignore -- net als de
      andere sleutels). Het totaal of de set bonnen kan zo niet ongemerkt
      worden aangepast.
   3. Verse controle bij het afrekenen: we herbouwen het ticket live uit de
      huidige openstaande bonnen en vergelijken het meegestuurde zegel
      timingvast. Is er intussen een ronde bijgekomen of is een bon al betaald,
      dan klopt het zegel niet meer en weigeren we -- geen afrekenen op een oud
      of gemanipuleerd totaal, geen dubbel afrekenen.

   Geen eigen cryptografie: HMAC-SHA256 uit node:crypto. */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = ({ crypto, dataDir, findSupplier, ordersVanZaak }) => {
  // eigen HMAC-zegelsleutel, zoals de andere sleutels: 0600 in de datamap.
  const keyPad = path.join(dataDir, 'tafelticket.key');
  let sleutel;
  try { sleutel = fs.readFileSync(keyPad); }
  catch (e) { sleutel = crypto.randomBytes(32); try { fs.writeFileSync(keyPad, sleutel, { mode: 0o600 }); } catch (e2) {} }

  const rond = n => Math.round((Number(n) || 0) * 100) / 100;
  const norm = t => String(t == null ? '' : t).trim().slice(0, 40);

  // de echte order-objecten aan een tafel die nog openstaan (onbetaald, niet
  // geannuleerd/geweigerd). Bewust alleen de eigen bonnen van deze zaak.
  function openBonnen(code, table) {
    return (ordersVanZaak(code) || []).filter(o =>
      norm(o.table) === table && !o.paid &&
      !['terugbetaald', 'geannuleerd', 'geweigerd'].includes(o.status));
  }

  // canonieke, sorteervaste payload -> HMAC-zegel (tamper-evident)
  function zegelVan(code, table, bonnen, at) {
    const payload = JSON.stringify({
      supplierCode: code, table,
      refs: bonnen.map(o => o.ref).slice().sort(),
      subtotaal: rond(bonnen.reduce((n, o) => n + (o.total || 0), 0)),
      aantal: bonnen.length, at
    });
    return crypto.createHmac('sha256', sleutel).update(payload).digest('base64url');
  }

  // bouw het ticket voor een tafel: uitsplitsing per gast + totaal + zegel.
  function bouwTicket(supplier, tableIn) {
    const table = norm(tableIn);
    if (!table) return { status: 400, error: 'Kies een tafel om de bonnen samen te voegen.' };
    const bonnen = openBonnen(supplier.code, table);
    if (!bonnen.length) return { status: 404, error: 'Geen openstaande bonnen aan ' + table + '.' };
    const at = new Date().toISOString();
    const perGast = {};
    for (const o of bonnen) perGast[o.customerCodename] = rond((perGast[o.customerCodename] || 0) + (o.total || 0));
    const ticket = {
      supplierCode: supplier.code, supplierName: supplier.name, table, at,
      bonnen: bonnen.map(o => ({ ref: o.ref, codename: o.customerCodename, total: o.total, items: o.items, betaalMoment: o.betaalMoment })),
      perGast,
      aantalBonnen: bonnen.length,
      aantalGasten: Object.keys(perGast).length,
      subtotaal: rond(bonnen.reduce((n, o) => n + (o.total || 0), 0)),
      zegel: zegelVan(supplier.code, table, bonnen, at)
    };
    return { ok: true, ticket };
  }

  // beveiliging bij het afrekenen: herbouw live en vergelijk het meegestuurde
  // zegel timingvast met een vers zegel over dezelfde tijd. Klopt het niet
  // (gewijzigd, verlopen of gemanipuleerd), dan afketsen. Geeft bij succes de
  // echte order-objecten terug om af te rekenen.
  function afrekenCheck(supplier, tableIn, zegelIn, atIn) {
    const table = norm(tableIn);
    const bonnen = openBonnen(supplier.code, table);
    if (!table) return { status: 400, error: 'Kies een tafel.' };
    if (!bonnen.length) return { status: 404, error: 'Geen openstaande bonnen aan ' + table + '.' };
    const vers = zegelVan(supplier.code, table, bonnen, atIn);
    const a = Buffer.from(String(zegelIn || ''));
    const b = Buffer.from(vers);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      return { status: 409, error: 'De rekening aan ' + table + ' is gewijzigd. Haal het ticket opnieuw op en reken dan af.' };
    return { ok: true, table, bonnen, subtotaal: rond(bonnen.reduce((n, o) => n + (o.total || 0), 0)) };
  }

  return { bouwTicket, afrekenCheck, openBonnen };
};
