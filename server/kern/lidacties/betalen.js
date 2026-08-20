/* Lidacties (deelmodule): DE BESTELLING BETALEN.

   Afgesplitst van ./bestellen.js om dezelfde reden als ./rekening.js: dat
   bestand kwam met de factuurregel hieronder over de omvangsgrens heen, en de
   naad tussen PLAATSEN en BETALEN is de eerlijkste die er ligt -- het zijn twee
   momenten met twee eigen grendels, en alleen het tweede raakt geld.

   Wat hier gebeurt: de grendels (al betaald, geannuleerd, verlopen), de fooi,
   het puntentegoed, het ledenvoordeel, de punten, de FACTUUR (zie ./factuur.js)
   en pas daarna het bericht aan de zaak -- betaald is definitief.

   Krijgt dezelfde gedeelde context als ./bestellen.js. */
module.exports = (ctx) => {
  const { save, findSupplier, fooiUit, pasTegoedToe, verdienPunten, ledenvoordeelVoor,
    keuken, notifySupplier, sseToSupplier, sseToOffice, orderMetRef, factuurVoorLid } = ctx;
  const { regelsVanItems } = require('./factuur');
  const { rekenAf } = require('./afrekenen')(ctx);
async function betaalOrderVoor(session, body) {
  const o = orderMetRef(body.ref);
  if (!o || (o.customerKey || o.customerTier) !== session.key) return { status: 404, error: 'Bestelling niet gevonden.' };
  if (o.paid) return { status: 409, error: 'Al betaald.' };
  /* Een terugbetaalde of geannuleerde bon mag NIET opnieuw betaald worden.
     `o.paid` was de enige poort, en juist de annulering zet die weer op false
     (ervaring/leden/annuleren.js: paid=false, refunded=true, status
     'terugbetaald'). Daarmee viel de grendel weg en kon dezelfde retour-bon nog
     een keer betalen: punten er nog eens bij, de ingredienten nog eens afgeboekt
     en de zaak kreeg 'Nieuwe bestelling (betaald)' voor iets wat al retour was.
     De verloopgrens hieronder ving dat niet, want die geldt alleen bij
     'wacht-op-betaling'. */
  if (o.refunded || ['terugbetaald', 'geweigerd', 'geannuleerd'].includes(o.status))
    return { status: 409, error: 'Deze bestelling is geannuleerd (' + o.status + ') en kan niet opnieuw betaald worden.' };
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (o.status === 'wacht-op-betaling' && Date.now() - new Date(o.at) > 30 * 60000) return { status: 410, error: 'Deze bestelling is verlopen. Plaats hem opnieuw.' };
  // fooi (gaat naar het team), punten-tegoed (RTG legt bij) en spaarpunten
  const fooi = fooiUit(body, o.total);
  if (fooi) o.fooi = fooi;
  const korting = pasTegoedToe(session.key, o.total);
  if (korting) o.puntenKorting = korting;
  // het RTG-ledenvoordeel per genre (de boardroom bepaalt; RTG legt bij,
  // dus de zaak houdt het volle bedrag en de nettoprijzen-belofte blijft staan)
  const voordeel = ledenvoordeelVoor(findSupplier(o.supplierCode), o.total - korting);
  if (voordeel) o.regieKorting = voordeel;
  /* HET GELD, EN PAS DAARNA `paid`. Deze functie zette alleen de vlag om; er
     kwam geen boeking aan te pas. De volgorde is nu: eerst betalen, dan pas
     zeggen dat er betaald is -- mislukt de betaling, dan blijft de bestelling
     staan zoals hij stond. Zie kern/pay/zaakbetaling.js voor de driehoek
     (lid -> zaak, RTG -> zaak) en waarom die alles-of-niets is. */
  const geld = await rekenAf({ session, supplierCode: o.supplierCode, supplierNaam: o.supplierName,
    bedrag: o.total, fooi, korting, voordeel, soort: 'bestelling', ref: o.ref, idem: 'order:' + o.ref });
  if (geld.error) return geld;   // rekenAf gaf het tegoed al terug
  o.payBetaaldCenten = geld.betaaldCenten;
  o.payBijgelegdCenten = geld.bijgelegdCenten;
  o.paid = true;
  o.paidAt = new Date().toISOString();
  if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
  verdienPunten(session.key, o.total - korting - voordeel, o.supplierName);
  save();
  /* Betaald = definitief, dus ook: een factuur voor beide partijen. Zie de kop
     van ./factuur.js -- deze transactie had er geen, en dat was de oorzaak
     achter "omzet zonder factuur" in de btw-aangifte. */
  factuurVoorLid({ supplierCode: o.supplierCode, supplierNaam: o.supplierName,
    codenaam: o.customerCodename, ref: o.ref, methode: 'rtg', regels: regelsVanItems(o.items) });
  // betaald = definitief: het keukenbrein boekt de ingredienten af via de recepten
  try { keuken.boekVerkoopAf(findSupplier(o.supplierCode), o.items || [], 'bestelling ' + o.ref); } catch (e) {}
  // nu pas hoort de zaak ervan: betaald = definitief
  notifySupplier(o.supplierCode, { icon: 'hotel', title: 'Nieuwe bestelling (betaald)', body: o.customerCodename + ', ' + o.items.reduce((n, i) => n + i.qty, 0) + ' item(s), \u20AC ' + o.total + (o.allergyNote ? ' \u00B7 allergie: ' + o.allergyNote : '') });
  sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  return { ok: true, order: o, bijgeladen: geld.bijgeladen || 0 };
}

  return { betaalOrderVoor };
};
