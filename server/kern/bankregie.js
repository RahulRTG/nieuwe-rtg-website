/* Kern-module "bankregie": de geldinfrastructuur-knop van de boardroom. RTG
   draait vandaag op RTG Pay met de externe kaart-naad (server/betaal.js). De
   toekomst is de eigen RTG Bank als uitgevende partij. Deze module is de ENE
   knop waarmee dat geregeld is -- een schakelaar met DRIE standen:

     partner  -> alles clearet via de externe kaart-rails (Stripe/demo). Vandaag.
     hybride  -> beide naast elkaar: de eigen bank draait mee, de kaart-rails
                 blijven als terugval. De overgangsstand.
     eigen    -> uitsluitend de eigen RTG Bank; de kaart-rails staan uit.

   De stand stuurt hoe stortingen clearen (zie kern/bank): op de kaart-naad of
   als eigen emissie tegen 'extern:emissie'. Verder draaien kan alleen als de
   bank operationeel is; zet je 'operationeel' uit, dan valt de stand veilig
   terug naar 'partner' (nooit een eigen-bank-belofte zonder bank).

   Naast de knop houdt de boardroom hier de tarieven en de spaarrente bij.
   maakBankregie(state) volgt het vaste kern-patroon (zoals geldregie). */

const MODI = ['partner', 'hybride', 'eigen'];
const RENTE_BP_MAX = 2000;        // spaarrente tot 20% (basispunten); ruim, RTG stelt in
const ROOD_MAX_CENTEN = 5000000;  // rood staan tot 50.000 euro als bovengrens
const FOOI_MAX_CENTEN = 100000;   // een tarief is nooit meer dan 1000 euro

function maakBankregie({ db, save }) {
  function d() {
    if (!db.data.bankregie || typeof db.data.bankregie !== 'object') db.data.bankregie = {};
    const b = db.data.bankregie;
    if (!MODI.includes(b.modus)) b.modus = 'partner';
    if (typeof b.operationeel !== 'boolean') b.operationeel = false;
    if (!Number.isFinite(b.spaarrenteBp)) b.spaarrenteBp = 150;        // 1,5% per jaar
    if (!Number.isFinite(b.roodLimietCenten)) b.roodLimietCenten = 0;  // geen rood staan tenzij gezet
    if (!b.tarieven || typeof b.tarieven !== 'object') b.tarieven = { sepaUitCenten: 0, spoedCenten: 0, passenCenten: 0 };
    if (!b.iban || typeof b.iban !== 'object') b.iban = { landcode: 'NL', bankcode: 'RTGB', bic: 'RTGBNL2A' };
    return b;
  }

  const modus = () => d().modus;
  const operationeel = () => d().operationeel === true;
  const spaarrenteBp = () => d().spaarrenteBp;
  const roodLimietStandaard = () => d().roodLimietCenten;
  const ibanParams = () => ({ ...d().iban });
  const tarief = naam => Math.max(0, Math.round(Number(d().tarieven[naam]) || 0));

  // clearing-vraag voor de bank: mag de eigen bank clearen? mag de kaart-naad?
  function clearing() {
    const b = d();
    const m = b.operationeel ? b.modus : 'partner';
    return { modus: m, eigen: m === 'eigen' || m === 'hybride', kaart: m === 'partner' || m === 'hybride' };
  }

  /* De knop zelf: expliciet een stand kiezen. Verder draaien (hybride/eigen) mag
     alleen als de bank operationeel is. Geeft een audit-vriendelijk resultaat. */
  function modusZet({ modus: gewenst, wie }) {
    const m = String(gewenst || '');
    if (!MODI.includes(m)) return { status: 400, error: 'Kies partner, hybride of eigen.' };
    if (m !== 'partner' && !operationeel())
      return { status: 409, error: 'De eigen bank is nog niet operationeel; zet hem eerst aan.' };
    const oud = d().modus;
    d().modus = m;
    save();
    return { ok: true, modus: m, oud, wie: wie || 'boardroom' };
  }

  /* Eén klik verder draaien: partner -> hybride -> eigen (stopt op eigen). Zo
     voelt het als een knop die je een slag verder zet. */
  function draai({ wie } = {}) {
    const i = MODI.indexOf(d().modus);
    const volgende = MODI[Math.min(i + 1, MODI.length - 1)];
    if (volgende === d().modus) return { ok: true, modus: volgende, oud: volgende, ongewijzigd: true, wie: wie || 'boardroom' };
    return modusZet({ modus: volgende, wie });
  }
  // een slag terug (eigen -> hybride -> partner), voor het geval de boardroom terug wil
  function draaiTerug({ wie } = {}) {
    const i = MODI.indexOf(d().modus);
    const vorige = MODI[Math.max(i - 1, 0)];
    return modusZet({ modus: vorige, wie });
  }

  /* De bank aan- of uitzetten als uitgevende partij. Uitzetten terwijl de stand
     nog op de eigen bank leunt: veilig terugvallen naar 'partner'. */
  function operationeelZet({ aan, wie }) {
    d().operationeel = aan === true;
    let teruggevallen = false;
    if (!d().operationeel && d().modus !== 'partner') { d().modus = 'partner'; teruggevallen = true; }
    save();
    return { ok: true, operationeel: d().operationeel, modus: d().modus, teruggevallen, wie: wie || 'boardroom' };
  }

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
    return { status: 200, modus: b.modus, modi: MODI.slice(), operationeel: b.operationeel,
      clearing: clearing(), spaarrenteBp: b.spaarrenteBp, spaarrentePct: b.spaarrenteBp / 100,
      roodLimietCenten: b.roodLimietCenten, tarieven: { ...b.tarieven }, iban: { ...b.iban } };
  }

  return {
    MODI: MODI.slice(),
    bankModus: modus, bankOperationeel: operationeel, bankClearing: clearing,
    bankSpaarrenteBp: spaarrenteBp, bankRoodStandaard: roodLimietStandaard, bankIbanParams: ibanParams, bankTarief: tarief,
    bankModusZet: modusZet, bankDraai: draai, bankDraaiTerug: draaiTerug,
    bankOperationeelZet: operationeelZet, bankInstellingenZet: instellingenZet, bankregieOverzicht: overzicht
  };
}

module.exports = { maakBankregie, MODI };
