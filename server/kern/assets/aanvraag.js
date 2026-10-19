/* RTG Shared Assets, deelbestand "aanvraag": EEN KOOP IS EEN AANVRAAG
   (eigenaarsbesluit van 19 oktober 2026).

   WAAROM. assetKoop maakte tickets en meldde een totaalprijs zonder dat er iets
   werd afgeschreven, en assetHerroep meldde "de koopsom staat in uw tegoed"
   terwijl de terugbetaling boven het walletplafond werd geweigerd en die
   weigering werd geslikt (voltooiproef tab:assets). Een deelnemingsbewijs van
   tienduizenden euro's is bovendien geen knop maar een handeling in de klasse
   voorbehouden/advies (AGENTS.md): RTG belooft niets voordat een mens keek.

   DE WEG, in vier stappen en nergens een kortere:
     1. het lid vraagt aan: een AANVRAAG, geen ticket en geen afschrijving;
     2. een mens van RTG OP NAAM beoordeelt (nooit de gedeelde kantoorcode, nooit
        de aanvrager zelf);
     3. na goedkeuring betaalt het lid via de betaalwaarheid (soort
        `asset-koop`, de bankrail en niet de wallet);
     4. de afhandelaar maakt de tickets pas als de betaling definitief is, en
        precies een keer -- of de bevestiging nu meteen, via een webhook of via
        de veegronde komt.
   Herroepen zegt alleen wat waar is: voor betaling sluit het de aanvraag, na
   betaling loopt het via betaalWaarheid.terugbetalen en heet het pas
   terugbetaald als dat bevestigd is. Krijgt de gedeelde ctx van ../assets.js. */
'use strict';

module.exports = (ctx) => {
  const { save, crypto, schoon, notify, nu, aanvragen: lijst, objectVan,
    prijsAccessVan, prijsAssetVan, bezetVan, magKopen, TICKETS_PER_OBJECT, TERUGKOOP_VENSTER_DAGEN } = ctx;
  const SOORT = 'asset-koop';
  const sleutelVan = (idem) => typeof idem === 'string' && idem.trim() ? idem.trim().slice(0, 80) : null;
  const publiek = (a) => ({ id: a.id, assetId: a.assetId, assetNaam: a.assetNaam, smaak: a.smaak, aantal: a.aantal,
    prijs: a.prijs, totaal: a.totaalCenten / 100, status: a.status, at: a.at, besloten: a.besluit ? { at: a.besluit.at, besluit: a.besluit.besluit } : null,
    ticketIds: a.ticketIds || [] });
  const vrij = (assetId) => TICKETS_PER_OBJECT - bezetVan(assetId).length;

  function assetKoop(sess, codenaam, assetIdIn, smaakIn, aantalIn, akkoord, idem) {
    if (!magKopen(sess)) return { status: 403, error: 'RTG Shared Assets is er voor betalende leden (RTG, Lifestyle en Business Pass).' };
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const smaak = smaakIn === 'asset' ? 'asset' : 'access';
    if (smaak === 'asset' && akkoord !== true) {
      return { status: 400, error: 'De Asset-smaak is een deelnemingsbewijs in ' + a.entiteit + '. Lees het informatiedocument (waarde kan dalen, jaarlijkse servicefee, uitstappen via wachtlijst of terugkoop binnen ' + TERUGKOOP_VENSTER_DAGEN + ' dagen) en bevestig uw akkoord.' };
    }
    const aantal = Math.max(1, Math.min(TICKETS_PER_OBJECT, parseInt(aantalIn, 10) || 1));
    const sleutel = sleutelVan(idem);
    const al = sleutel && lijst().find(x => x.key === sess.key && x.idem === sleutel);
    if (al) return al.assetId === a.id && al.smaak === smaak && al.aantal === aantal
      ? { ok: true, aanvraag: publiek(al), herhaald: true, let: LET }
      : { status: 409, error: 'Deze herhaalsleutel hoort bij een andere aanvraag.' };
    if (aantal > vrij(a.id)) return { status: 409, error: 'Uitverkocht: er zijn nog ' + vrij(a.id) + ' van de ' + TICKETS_PER_OBJECT + ' tickets beschikbaar. Zet u op de wachtlijst.' };
    const prijs = smaak === 'asset' ? prijsAssetVan(a) : prijsAccessVan(a);
    const x = { id: 'AV-' + crypto.randomBytes(5).toString('hex').toUpperCase(), assetId: a.id, assetNaam: a.naam,
      smaak, aantal, prijs, totaalCenten: prijs * 100 * aantal, key: sess.key, codenaam: schoon(codenaam, 40), tier: sess.tier,
      akkoord: smaak === 'asset' ? nu() : null, status: 'aangevraagd', at: nu(), ...(sleutel ? { idem: sleutel } : {}) };
    lijst().unshift(x); save();
    return { ok: true, aanvraag: publiek(x), let: LET };
  }
  const LET = 'Dit is een aanvraag. Een mens van RTG beoordeelt hem; er is nog niets afgeschreven en er is nog geen ticket.';

  const mijnAanvragen = (key) => (betaalDeel.bijwerken(key), { ok: true, aanvragen: lijst().filter(x => x.key === key).slice(0, 50).map(publiek) });
  const kantoorAanvragen = () => ({ ok: true, aanvragen: lijst().filter(x => x.status === 'aangevraagd')
    .map(x => Object.assign(publiek(x), { codenaam: x.codenaam, tier: x.tier })) });

  /* Stap 2: een mens op naam. `doorKey` komt uit de kantoorsessie op naam
     (kern/kantoor/index.js); de gedeelde code heeft er geen. */
  function beslis({ id, besluit, reden, doorKey }) {
    const x = lijst().find(y => y.id === String(id || ''));
    if (!x) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (!doorKey) return { status: 403, error: 'Een aanvraag beoordeelt een mens van RTG op naam; met de gedeelde kantoorcode kan dat niet. Log in met uw eigen RTG-account.' };
    if (doorKey === x.key) return { status: 403, error: 'Uw eigen aanvraag beoordeelt een ander.' };
    if (x.status !== 'aangevraagd') return { status: 409, error: 'Over deze aanvraag is al besloten (' + x.status + ').' };
    if (!['goedgekeurd', 'afgewezen'].includes(besluit)) return { status: 400, error: 'Het besluit is goedgekeurd of afgewezen.' };
    x.status = besluit;
    x.besluit = { besluit, reden: schoon(reden, 300), doorKey, at: nu() };
    save();
    notify(x.key, { icon: 'betalen', title: 'Uw aanvraag voor ' + x.assetNaam, scope: 'assets',
      body: besluit === 'goedgekeurd' ? 'Goedgekeurd. U kunt nu betalen; pas na een bevestigde betaling staan uw tickets klaar.' : 'Niet goedgekeurd. Er is niets afgeschreven.' });
    return { ok: true, aanvraag: publiek(x) };
  }

  /* Stap 3 en 4 (betalen, tickets, herroepen) staan in ./aanvraag-betaal.js. */
  const betaalDeel = require('./aanvraag-betaal')(ctx, { lijst, publiek, SOORT });

  return { assetKoop, assetHerroep: betaalDeel.assetHerroep, assetHerroepBijwerken: betaalDeel.bijwerken, assetAanvragenMijn: mijnAanvragen, assetAanvragenKantoor: kantoorAanvragen,
    assetAanvraagBeslis: beslis, assetAanvraagBetaal: betaalDeel.betaal };
};
