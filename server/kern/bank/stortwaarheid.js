/* RTG Bank, storten via de betaalwaarheid (MONEY-012, de inkomende kant).

   WAAROM. Storten via de kaart riep een kale betaal.maakBetaling aan, en had
   daarmee dezelfde gaten die RTG Pay bij opladen al dichtte (zie de kop van
   ../pay/oplaadwaarheid.js): er werd niets vastgelegd vóór de aanroep, een
   betaling die later bevestigde (webhook, veegronde) werd nooit bijgeschreven,
   en geen provider anders dan de altijd-ja kon er een uitkomst aan geven die
   de bank begreep. Nu legt de betaalwaarheid de betaling vast VOOR de rail
   gebeld wordt, met een vaste sleutel per storting, en schrijft DIT bestand
   bij -- de enige plek, of de bevestiging nu meteen, via een webhook of via de
   veegronde komt.

   PRECIES EEN KEER. De bijschrijving draagt een economische sleutel op het
   betaling-id; de soort is `pay-oplaad` (een bevestigde inkomende betaling op
   het id van haar betaling, db/economische-identiteit.js) met `bank-stort` als
   eerste deel van de hash, zodat de sleutelruimte nooit die van een
   wallet-oplading raakt en de Rust-motor hem kent. */
'use strict';
const { randomUUID } = require('crypto');
const { maakSleutel } = require('../../db/economische-identiteit');
const { boekOpSleutel } = require('../betaalopdracht/terugboeking');

module.exports = (ctx) => {
  const { betaalWaarheid, grootboek, boek, boekAsync, economischeBoekingEenmaal, geldModus, rekMeta, saldoVan, seintje } = ctx;

  async function bijschrijven({ iban, centen, oms, ref }) {
    const sleutel = maakSleutel('pay-oplaad', ['bank-stort', String(ref)]);
    const args = { van: 'extern:kaart', naar: iban, centen, soort: 'storting', oms: oms || 'Storting', ref };
    if (geldModus === 'motor') return boekAsync(Object.assign({}, args, { economischeSleutel: sleutel }));
    return boekOpSleutel({ domein: 'bank', grootboek, boek, boekAsync, boekEenmaal: economischeBoekingEenmaal, sleutel, args });
  }

  if (betaalWaarheid) betaalWaarheid.registreerAfhandeling('bank-stort', async (w) => {
    const c = w.context || {};
    const r = await bijschrijven({ iban: c.iban, centen: w.centen, oms: c.oms, ref: w.id });
    if (r && r.error) throw new Error(r.error);
    const m = rekMeta(c.iban);
    if (m) seintje(m.codenaam);
  });

  /* Het antwoord aan het lid is de stand van de betaalwaarheid, niet van de
     rail: geweigerd is AF (er gebeurde niets), alleen wat werkelijk loopt
     wacht (scripts/lib/voltooi/bank.js). */
  async function viaKaart({ iban, centen, idem, oms }) {
    if (!betaalWaarheid) return { status: 503, error: 'De betaalwaarheid is niet aangesloten; er is niets afgeschreven.' };
    const codenaam = rekMeta(iban).codenaam;
    let w;
    try {
      w = betaalWaarheid.maak({ actor: 'bank:' + codenaam, soort: 'bank-stort', bronRef: iban,
        idem: 'bank-stort:' + iban + ':' + (idem ? String(idem) : 'los:' + randomUUID()),
        centen, valuta: 'eur', context: { iban, oms: oms || 'Storting' } });
    } catch (e) { return { status: 409, error: e.message }; }
    try { await betaalWaarheid.begin(w.id, { omschrijving: oms || 'RTG Bank storten' }); }
    catch (e) {
      if (e && e.code === 'BETAAL_AFHANDELING_MISLUKT')
        return { status: 502, betalingId: w.id, error: 'De storting is bevestigd maar nog niet bijgeschreven; dat gebeurt vanzelf.' };
      return { status: 502, betalingId: w.id, onbekend: true,
        error: 'De storting gaf geen uitsluitsel. Stort niet opnieuw: RTG zoekt het na met dezelfde sleutel.' };
    }
    const r = betaalWaarheid.van(w.id);
    if (r && r.afgehandeldAt) return { ok: true, iban, via: 'kaart', saldoCenten: saldoVan(iban), gestort: centen, betalingId: w.id };
    const stand = r && r.status;
    const zin = stand === 'GEWEIGERD' || stand === 'GEANNULEERD'
      ? 'De storting is niet gelukt. Er is niets afgeschreven en niets bijgeschreven.'
      : stand === 'CONTROLE_NODIG' ? 'De storting ligt bij RTG ter controle. Stort niet opnieuw.'
        : 'De betaling wacht op bevestiging.';
    return { status: 402, error: zin, betalingId: w.id, betaalStatus: (r && r.providerStatus) || null };
  }

  return { viaKaart };
};
