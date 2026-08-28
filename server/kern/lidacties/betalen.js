/* Lidacties (deelmodule): DE BESTELLING BETALEN.

   Afgesplitst van ./bestellen.js om dezelfde reden als ./rekening.js: dat
   bestand kwam met de factuurregel hieronder over de omvangsgrens heen, en de
   naad tussen PLAATSEN en BETALEN is de eerlijkste die er ligt -- het zijn twee
   momenten met twee eigen grendels, en alleen het tweede raakt geld.

   Wat hier gebeurt: de grendels (al betaald, geannuleerd, verlopen), de fooi,
   het puntentegoed, het ledenvoordeel, de punten, de FACTUUR (zie ./factuur.js)
   en pas daarna het bericht aan de zaak -- betaald is definitief.

   Krijgt dezelfde gedeelde context als ./bestellen.js. */
const subsidie = require('../commercie/subsidie');

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
  /* Het RTG-ledenvoordeel per genre. De boardroom bepaalt het percentage; RTG
     legt bij, dus de zaak houdt het volle bedrag en de nettoprijzen-belofte
     blijft staan.

     De VIER bedragen worden hier in een keer vastgelegd
     (kern/commercie/subsidie.js). Hier stond alleen `o.regieKorting = voordeel`
     -- het bedrag op het scherm, en verder niets: geen vastgelegde verplichting
     van RTG aan de zaak, en geen enkele plek waar na te rekenen viel of lid +
     RTG samen het brutobedrag opleveren. */
  const voordeel = ledenvoordeelVoor(findSupplier(o.supplierCode), o.total - korting);
  if (voordeel) {
    o.regieKorting = voordeel;
    o.voordeelOpbouw = subsidie.opbouwVan(o.total - korting, voordeel);
  }
  /* HET GELD, EN PAS DAARNA `paid`. Deze functie zette alleen de vlag om; er
     kwam geen boeking aan te pas. De volgorde is nu: eerst betalen, dan pas
     zeggen dat er betaald is -- mislukt de betaling, dan blijft de bestelling
     staan zoals hij stond. Zie kern/pay/zaakbetaling.js voor de driehoek
     (lid -> zaak, RTG -> zaak) en waarom die alles-of-niets is. */
  const geld = await rekenAf({ session, supplierCode: o.supplierCode, supplierNaam: o.supplierName,
    bedrag: o.total, fooi, korting, voordeel, soort: 'bestelling', ref: o.ref, idem: 'order:' + o.ref });
  if (geld.error) return geld;   // rekenAf gaf het tegoed al terug
  /* EEN HERHALING IS GEEN TWEEDE BETALING, en mag dus ook de gevolgen niet nog
     eens hebben. De grendel hierboven (`o.paid`) vangt de tweede tik pas als de
     eerste KLAAR is; twee tikken tegelijk glippen er allebei langs, want op dat
     moment staat paid nog op false. Het geld ging dan wel een keer -- daar is de
     idem-sleutel voor, en die werkte -- maar alles erna liep twee keer: punten
     erbij, een tweede factuur, de ingredienten nog eens afgeboekt en de zaak
     kreeg "Nieuwe bestelling (betaald)" in tweevoud. `herhaald` is precies het
     signaal dat de kas dit verzoek al kende, dus hier hoort dezelfde 409 als
     hierboven. rekenAf heeft het verrekende tegoed al teruggegeven. */
  if (geld.herhaald) return { status: 409, error: 'Al betaald.' };
  o.payBetaaldCenten = geld.betaaldCenten;
  o.payBijgelegdCenten = geld.bijgelegdCenten;
  o.paid = true;
  o.paidAt = new Date().toISOString();
  // WAARMEE er is betaald, en niet alleen DAT. De dagafsluiting zet elke euro
  // omzet onder zijn werkelijke betaalwijze (TAKEN.md 4.59); hier is dat de app.
  o.betaaldMet = 'app';
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
