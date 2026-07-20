/* Kern-module "bankregie": de geldinfrastructuur-knop van de boardroom. RTG
   draait vandaag op RTG Pay met de externe kaart-naad (server/betaal.js). De
   toekomst is de eigen RTG Bank als uitgevende partij. Deze module is de ENE
   knop waarmee dat geregeld is -- een schakelaar met DRIE standen:

     partner  -> alles clearet via de externe kaart-rails (Stripe/demo). Vandaag.
     hybride  -> beide naast elkaar: de eigen bank draait mee, de kaart-rails
                 blijven als terugval. De overgangsstand.
     eigen    -> uitsluitend de eigen RTG Bank; de kaart-rails staan uit.

   Twee zaken maken de knop veilig genoeg om ook echt aan te durven, en wonen in
   de zusterbestanden: de NOOD-FALLBACK (./nood: valt de eigen bank uit, dan
   clearet alles tijdelijk weer via de kaart-rails, wat de stand ook is) en de
   AUTORISATIE (./autorisatie: opschalen vergt vier ogen -- A vraagt aan, B
   bevestigt; afschalen mag altijd direct, een terugval blokkeer je nooit).

   Hier: de stand, de clearing-berekening, de leden-bank-schakelaar, de tarieven
   en de spaarrente. maakBankregie(state) volgt het vaste kern-patroon. */

const MODI = ['partner', 'hybride', 'eigen'];
const RANG = { partner: 0, hybride: 1, eigen: 2 };
const RENTE_BP_MAX = 2000;         // spaarrente tot 20% (basispunten); ruim, RTG stelt in
const ROOD_MAX_CENTEN = 5000000;   // rood staan tot 50.000 euro als bovengrens
const FOOI_MAX_CENTEN = 100000;    // een tarief is nooit meer dan 1000 euro
const NOOD_DREMPEL = 3;            // zoveel mislukte eigen-clearings achter elkaar -> automatisch nood
const AUTORISATIE_MS = 10 * 60 * 1000; // de tweede persoon heeft tien minuten

function maakBankregie({ db, save }) {
  function d() {
    if (!db.data.bankregie || typeof db.data.bankregie !== 'object') db.data.bankregie = {};
    const b = db.data.bankregie;
    if (!MODI.includes(b.modus)) b.modus = 'partner';
    if (typeof b.operationeel !== 'boolean') b.operationeel = false;
    if (!Number.isFinite(b.spaarrenteBp)) b.spaarrenteBp = 150;
    if (!Number.isFinite(b.roodLimietCenten)) b.roodLimietCenten = 0;
    if (!b.tarieven || typeof b.tarieven !== 'object') b.tarieven = { sepaUitCenten: 0, spoedCenten: 0, passenCenten: 0 };
    if (!b.iban || typeof b.iban !== 'object') b.iban = { landcode: 'NL', bankcode: 'RTGB', bic: 'RTGBNL2A' };
    if (!b.nood || typeof b.nood !== 'object') b.nood = { actief: false, sinds: null, reden: '', door: '' };
    if (!Number.isFinite(b.mislukt)) b.mislukt = 0;
    if (!('autorisatie' in b)) b.autorisatie = null;
    if (typeof b.ledenAan !== 'boolean') b.ledenAan = false; // staat de leden-bank live (zichtbaar in de app)?
    return b;
  }

  const modus = () => d().modus;
  const operationeel = () => d().operationeel === true;
  const spaarrenteBp = () => d().spaarrenteBp;
  const roodLimietStandaard = () => d().roodLimietCenten;
  const ibanParams = () => ({ ...d().iban });
  const tarief = naam => Math.max(0, Math.round(Number(d().tarieven[naam]) || 0));
  const kenmerk = () => 'AUT' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ledenAan = () => d().ledenAan === true;

  // de INGESTELDE clearing (los van nood): wat de gekozen stand zou doen
  function clearingConfig() {
    const b = d();
    const m = b.operationeel ? b.modus : 'partner';
    return { modus: m, eigen: m === 'eigen' || m === 'hybride', kaart: m === 'partner' || m === 'hybride' };
  }
  // de EFFECTIEVE clearing: in nood forceren we de kaart-rails, wat de stand ook is
  function clearing() {
    if (d().nood.actief) return { modus: 'nood', eigen: false, kaart: true, nood: true };
    return { ...clearingConfig(), nood: false };
  }

  // de rauwe uitvoerders (intern; de autorisatie-laag roept ze aan bij opschaling)
  function _modusZet(m, wie) {
    if (!MODI.includes(m)) return { status: 400, error: 'Kies partner, hybride of eigen.' };
    if (m !== 'partner' && !operationeel()) return { status: 409, error: 'De eigen bank is nog niet operationeel; zet hem eerst aan.' };
    const oud = d().modus;
    d().modus = m; save();
    return { ok: true, modus: m, oud, wie: wie || 'boardroom' };
  }
  function _operationeelZet(aan, wie) {
    d().operationeel = aan === true;
    let teruggevallen = false;
    if (!d().operationeel && d().modus !== 'partner') { d().modus = 'partner'; teruggevallen = true; }
    save();
    return { ok: true, operationeel: d().operationeel, modus: d().modus, teruggevallen, wie: wie || 'boardroom' };
  }

  const ctx = { d, save, MODI, RANG, AUTORISATIE_MS, NOOD_DREMPEL, operationeel, _modusZet, _operationeelZet, clearing, kenmerk };
  const nood = require('./nood')(ctx);
  const aut = require('./autorisatie')(ctx);

  // de leden-bank live zetten (zichtbaar in de app). Geen clearing-opschaling,
  // dus geen vier-ogen; wel altijd in het auditlog vanuit de route.
  function ledenZet({ aan, wie }) { d().ledenAan = aan === true; save(); return { ok: true, ledenAan: d().ledenAan, wie: wie || 'boardroom' }; }

  function instellingenZet({ spaarrenteBp: rente, roodLimietEuro, tarieven }) {
    const b = d();
    if (rente != null) {
      const bp = Math.round(Number(rente));
      if (!Number.isFinite(bp) || bp < 0 || bp > RENTE_BP_MAX) return { status: 400, error: 'De spaarrente moet tussen 0 en 20% liggen.' };
      b.spaarrenteBp = bp;
    }
    if (roodLimietEuro != null) {
      const centen = Math.round(Number(roodLimietEuro) * 100);
      if (!Number.isFinite(centen) || centen < 0 || centen > ROOD_MAX_CENTEN) return { status: 400, error: 'De rood-staan-limiet moet tussen 0 en 50.000 euro liggen.' };
      b.roodLimietCenten = centen;
    }
    if (tarieven && typeof tarieven === 'object') {
      for (const naam of ['sepaUitCenten', 'spoedCenten', 'passenCenten']) {
        if (tarieven[naam] == null) continue;
        const c = Math.round(Number(tarieven[naam]));
        if (!Number.isFinite(c) || c < 0 || c > FOOI_MAX_CENTEN) return { status: 400, error: 'Een tarief moet tussen 0 en 1000 euro liggen.' };
        b.tarieven[naam] = c;
      }
    }
    save();
    return { ok: true, spaarrenteBp: b.spaarrenteBp, roodLimietCenten: b.roodLimietCenten, tarieven: { ...b.tarieven } };
  }

  function overzicht() {
    const b = d();
    return { status: 200, modus: b.modus, modi: MODI.slice(), operationeel: b.operationeel, ledenAan: b.ledenAan,
      clearing: clearing(), clearingConfig: clearingConfig(), nood: { ...b.nood }, mislukt: b.mislukt,
      autorisatie: aut.pub(b.autorisatie), spaarrenteBp: b.spaarrenteBp, spaarrentePct: b.spaarrenteBp / 100,
      roodLimietCenten: b.roodLimietCenten, tarieven: { ...b.tarieven }, iban: { ...b.iban } };
  }

  return {
    MODI: MODI.slice(),
    bankModus: modus, bankOperationeel: operationeel, bankClearing: clearing, bankClearingConfig: clearingConfig,
    bankSpaarrenteBp: spaarrenteBp, bankRoodStandaard: roodLimietStandaard, bankIbanParams: ibanParams, bankTarief: tarief,
    // de knop, nu via vier-ogen bij het opschalen
    bankModusZet: ({ modus: m, wie }) => aut.aanvraag({ actie: 'modus', modus: m, door: wie }),
    bankDraai: ({ wie } = {}) => aut.aanvraag({ actie: 'draai', door: wie }),
    bankOperationeelZet: ({ aan, wie }) => aut.aanvraag({ actie: aan ? 'operationeel-aan' : 'operationeel-uit', door: wie }),
    bankDraaiTerug: ({ wie } = {}) => _modusZet(MODI[Math.max(RANG[d().modus] - 1, 0)], wie),
    bankAutoriseerBevestig: aut.bevestig, bankAutoriseerStatus: aut.status, bankAutoriseerAnnuleer: aut.annuleer,
    // nood-fallback
    bankNoodMeld: nood.noodMeld, bankNoodHerstel: nood.noodHerstel, bankClearingMislukt: nood.clearingMislukt, bankClearingGelukt: nood.clearingGelukt,
    // leden-bank live
    bankLedenAan: ledenAan, bankLedenZet: ledenZet,
    bankInstellingenZet: instellingenZet, bankregieOverzicht: overzicht
  };
}

module.exports = { maakBankregie, MODI };
