/* Kern-module "eenaccount": EEN account voor alles. Mensen registreren zich
   een keer (het leden-account met codenaam in de kluis); elke andere rol op
   het platform is daarna een KOPPELING aan dat ene account, nooit een nieuw
   account:
   - personeel:  afgeleid uit het levende, aan het account gebonden dienstverband
   - zaak:       gekoppeld door een keer de bedrijfsinlog te bewijzen
   - kantoor:    gekoppeld door een keer de backoffice-code (en TOTP als die
                 aanstaat) te bewijzen
   Daarna logt iedereen overal in met het ene RTG-account en kiest een rol;
   accStart munt dan precies dezelfde sessie als de losse inlog zou doen
   (zelfde rememberSession, zelfde logs), dus geen tweede toegangspad met
   andere regels. Oude PIN-koppeling bestaat alleen nog als expliciete Magnaat
   Test-fixture; in iedere echte omgeving is het account zelf de sleutelbos.

   maakEenAccount(state) volgt het vaste kern-patroon. Het BEWIJZEN zelf (de
   drie soorten, met de twee remmen) staat in ./eenaccount/koppelen.js; hier de
   sleutelbos en het munten van de sessie. */

const { idVanKey } = require('../lib/lidsleutel');

function maakEenAccount({ db, save, crypto, accounts, findSupplier, checkCred, hasCred, DEMO,
  DEMO_SUPPLIER, OFFICE_CODE, veiligGelijk, totpOk, rememberSession, logInlog, logActivity,
  supplierState, officeState, magWerken, pinInfo, pinCheck, pinSlot, persoonsPoort, sessieregister }) {
  const nu = () => new Date().toISOString();
  function lijst(key) {
    if (!db.data.accountRollen || typeof db.data.accountRollen !== 'object') db.data.accountRollen = {};
    if (!Array.isArray(db.data.accountRollen[key])) db.data.accountRollen[key] = [];
    return db.data.accountRollen[key];
  }
  const zelfde = (a, b) => a.rol === b.rol && (a.code || '') === (b.code || '') && (a.staffId || null) === (b.staffId || null);

  /* Meteen bij het opstarten, niet pas bij de eerste poging: een ontbrekend
     doel-slot is stil een gat, en zo'n stille terugval is precies hoe dit gat
     is ontstaan. Liever een server die niet start. */
  if (!pinSlot || typeof pinSlot.personeel !== 'function')
    throw new Error('eenaccount: pinSlot ontbreekt; zonder gedeeld doel-slot is /api/account/koppel een tweede, ongeremde deur naar de personeelspin.');
  const koppelen = require('./eenaccount/koppelen')({ accounts, findSupplier, checkCred, hasCred,
    DEMO, DEMO_SUPPLIER, OFFICE_CODE, veiligGelijk, totpOk, logInlog, pinSlot, nu });

  /* De AFGELEIDE sleutels: niet opgeslagen maar gelezen uit een waarheid die
     ergens anders al staat -- de kantoordeur van de eigenaar en elke
     werkruimte waar dit account aan gekoppeld is. Zie ./eenaccount/afgeleid.js
     voor waarom dat geen tweede opslag mag worden. */
  const afgeleid = require('./eenaccount/afgeleid')({ db, accounts });
  const { eigenaarKantoor } = afgeleid;

  /* ---- de sleutelbos van dit account ---- */
  function accRollen(key) {
    // `staffRole` viel hier weg, en daardoor stuurde de Werk-kiezer de eigenaar
    // van een zaak (altijd manager) naar de PDA in plaats van de zaak-app.
    const rollen = lijst(key).map(r => ({ rol: r.rol, code: r.code || null,
      staffId: r.staffId || null, naam: r.naam || null, zaakNaam: r.zaakNaam || null,
      staffRole: r.staffRole || null, manager: r.staffRole === 'manager', sinds: r.at }));
    // de afgeleide kantoorsleutel van de eigenaar, tenzij hij hem al koppelde
    const eig = eigenaarKantoor(key);
    if (eig && !rollen.some(r => r.rol === 'kantoor')) {
      rollen.push({ rol: 'kantoor', code: null, staffId: null, naam: eig.naam,
        zaakNaam: null, sinds: null, viaEigenaar: true });
    }
    // Een personeelsrol volgt rechtstreeks uit het levende, aan dit account
    // gebonden dienstverband. Er is geen PIN-koppeling of tweede opslag nodig.
    for (const p of afgeleid.personeel(key)) {
      if (!rollen.some(r => r.rol === 'personeel' && Number(r.staffId) === Number(p.staffId)))
        rollen.push(p);
    }
    // en elke werkruimte waar dit account aan gekoppeld is, apart per
    // organisatie en met de eigen functie erbij
    for (const wr of afgeleid.werkruimtes(key)) {
      if (!rollen.some(r => r.rol === 'werkruimte' && r.code === wr.code)) rollen.push(wr);
    }
    return { status: 200, rollen };
  }

  /* ---- een legacy testrol koppelen: eerst de bestaande werk-inlog bewijzen ---- */
  async function accKoppel(key, body, req) {
    const uitslag = await koppelen.bewijs(key, body, req);
    if (uitslag.error) return uitslag;
    const rol = uitslag.rol;
    if (uitslag.personeelKoppeling) {
      // Oude installaties kunnen al een sleutelbosregel hebben van vóórdat de
      // personeelsdatabase de koppeling zelf vastlegde. Ook die identiteit mag
      // niet door een tweede account worden geclaimd.
      const alVanAnder = Object.entries(db.data.accountRollen || {}).some(([ander, rollen]) =>
        ander !== key && Array.isArray(rollen) && rollen.some(r =>
          r.rol === 'personeel' && Number(r.staffId) === Number(rol.staffId)));
      if (alVanAnder) return { status: 403, error: 'Deze personeelsplek is al aan een ander RTG-account gekoppeld.' };
      const p = uitslag.personeelKoppeling;
      if (!accounts.claimStaffMember(p.staffId, p.memberId, p.memberTier)) {
        return { status: 403, error: 'Deze personeelsplek is al aan een ander RTG-account gekoppeld.' };
      }
    }
    const rij = lijst(key).filter(r => !zelfde(r, rol));
    rij.push(rol);
    db.data.accountRollen[key] = rij.slice(-10);
    save();
    logInlog('koppel', true, rol.rol + (rol.code ? ' ' + rol.code : ''), req);
    return { status: 200, ok: true, rollen: accRollen(key).rollen };
  }

  function accOntkoppel(key, body) {
    const bestaand = lijst(key);
    const voor = bestaand.length;
    const weg = r => r.rol === String(body.rol || '')
      && (body.code ? r.code === String(body.code).toUpperCase() : true)
      && (body.staffId != null ? r.staffId === Number(body.staffId) : true);
    const verwijderd = bestaand.filter(weg);
    db.data.accountRollen[key] = bestaand.filter(r => !weg(r));
    const lidId = idVanKey(key);
    if (lidId != null) for (const r of verwijderd) {
      if (r.rol === 'personeel' && r.staffId != null) accounts.releaseStaffMember(r.staffId, lidId);
    }
    save();
    return { status: 200, ok: true, verwijderd: voor - lijst(key).length };
  }

  /* Het MUNTEN van een werk-sessie staat in ./eenaccount/starten.js. De naad
     loopt langs de vraag wat er gebeurt: hierboven wordt de SLEUTELBOS beheerd
     (welke rollen hangen eraan, en hoe komt er een bij), daar wordt met zo'n
     sleutel een echte sessie gemaakt -- met het werkvenster, de algemene pin en
     de logs die daarbij horen. Twee onderwerpen; het tweede is verreweg het
     zwaarste en het stond de hele tijd in hetzelfde bestand. */
  const { accStart } = require('./eenaccount/starten')({ db, save, crypto, accounts,
    findSupplier, rememberSession, logInlog, logActivity, supplierState, officeState,
    magWerken, pinInfo, pinCheck, lijst, zelfde, eigenaarKantoor, afgeleid, nu, persoonsPoort, sessieregister });

  return { accRollen, accKoppel, accStart, accOntkoppel };
}

module.exports = { maakEenAccount };
