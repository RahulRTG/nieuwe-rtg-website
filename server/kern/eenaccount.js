/* Kern-module "eenaccount": EEN account voor alles. Mensen registreren zich
   een keer (het leden-account met codenaam in de kluis); elke andere rol op
   het platform is daarna een KOPPELING aan dat ene account, nooit een nieuw
   account:
   - personeel:  gekoppeld door een keer de zaak-code + eigen PIN te bewijzen
   - zaak:       gekoppeld door een keer de bedrijfsinlog te bewijzen
   - kantoor:    gekoppeld door een keer de backoffice-code (en TOTP als die
                 aanstaat) te bewijzen
   Daarna logt iedereen overal in met het ene RTG-account en kiest een rol;
   accStart munt dan precies dezelfde sessie als de losse inlog zou doen
   (zelfde rememberSession, zelfde logs), dus geen tweede toegangspad met
   andere regels. Koppelen bewijst altijd eerst de bestaande werk-inlog; het
   ene account wordt zo een sleutelbos, geen achterdeur.

   maakEenAccount(state) volgt het vaste kern-patroon. */

const MAX_POGING = 5; // koppel-pogingen per account per minuut

function maakEenAccount({ db, save, crypto, accounts, findSupplier, checkCred, hasCred, DEMO,
  DEMO_SUPPLIER, OFFICE_CODE, veiligGelijk, totpOk, rememberSession, logInlog, logActivity,
  supplierState, officeState, magWerken, pinInfo, pinCheck }) {
  const nu = () => new Date().toISOString();
  function lijst(key) {
    if (!db.data.accountRollen || typeof db.data.accountRollen !== 'object') db.data.accountRollen = {};
    if (!Array.isArray(db.data.accountRollen[key])) db.data.accountRollen[key] = [];
    return db.data.accountRollen[key];
  }
  const zelfde = (a, b) => a.rol === b.rol && (a.code || '') === (b.code || '') && (a.staffId || null) === (b.staffId || null);

  // een klein slot tegen brute-force op het koppelen (per account)
  const pogingen = new Map();
  function teVaak(key) {
    const p = pogingen.get(key) || { n: 0, tot: 0 };
    if (p.tot > Date.now()) return true;
    return false;
  }
  function fout(key) {
    const p = pogingen.get(key) || { n: 0, tot: 0 };
    p.n++;
    if (p.n >= MAX_POGING) { p.n = 0; p.tot = Date.now() + 60000; }
    pogingen.set(key, p);
  }

  /* ---- de sleutelbos van dit account ---- */
  function accRollen(key) {
    return { status: 200, rollen: lijst(key).map(r => ({ rol: r.rol, code: r.code || null,
      staffId: r.staffId || null, naam: r.naam || null, zaakNaam: r.zaakNaam || null, sinds: r.at })) };
  }

  /* ---- een rol koppelen: altijd eerst de bestaande werk-inlog bewijzen ---- */
  async function accKoppel(key, body, req) {
    if (teVaak(key)) return { status: 429, error: 'Te veel koppel-pogingen. Wacht een minuut.' };
    const soort = String((body || {}).soort || '');
    let rol = null;
    if (soort === 'personeel') {
      const s = findSupplier(body.code);
      if (!s) return { status: 404, error: 'Deze zaak-code kennen we niet.' };
      const staff = await accounts.verifyStaffPin(Number(body.staffId), body.pin);
      if (!staff || String(staff.supplier_code).toUpperCase() !== s.code) {
        fout(key);
        logInlog('koppel', false, s.code + '#' + body.staffId, req);
        return { status: 401, error: 'Onjuiste PIN.' };
      }
      rol = { rol: 'personeel', code: s.code, zaakNaam: s.name, staffId: staff.id, naam: staff.name, staffRole: staff.role, at: nu() };
    } else if (soort === 'zaak') {
      if (!DEMO) return { status: 403, error: 'De bedrijfsinlog is uitgeschakeld; koppel uw persoonlijke personeelslogin.' };
      if (!hasCred(body) || !checkCred(body.username, body.password)) {
        fout(key);
        logInlog('koppel', false, 'zaak', req);
        return { status: 401, error: 'Onjuiste gebruikersnaam of wachtwoord.' };
      }
      const s = findSupplier(DEMO_SUPPLIER);
      if (!s) return { status: 404, error: 'De zaak is niet gevonden.' };
      rol = { rol: 'zaak', code: s.code, zaakNaam: s.name, naam: 'Beheer', at: nu() };
    } else if (soort === 'kantoor') {
      if (!veiligGelijk(String(body.code || '').trim().toUpperCase(), OFFICE_CODE)) {
        fout(key);
        logInlog('koppel', false, 'kantoor', req);
        return { status: 401, error: 'Onjuiste backoffice-code.' };
      }
      if (process.env.OFFICE_TOTP_SECRET && !totpOk(process.env.OFFICE_TOTP_SECRET, body.totp))
        return { status: 401, error: 'Tweede factor vereist: voer de authenticator-code in.' };
      rol = { rol: 'kantoor', at: nu() };
    } else {
      return { status: 400, error: 'Kies wat u koppelt: personeel, zaak of kantoor.' };
    }
    const rij = lijst(key).filter(r => !zelfde(r, rol));
    rij.push(rol);
    db.data.accountRollen[key] = rij.slice(-10);
    save();
    logInlog('koppel', true, rol.rol + (rol.code ? ' ' + rol.code : ''), req);
    return { status: 200, ok: true, rollen: accRollen(key).rollen };
  }

  /* ---- met het ene account een werk-sessie starten (zelfde munt als de
     losse inlog: rememberSession met exact dezelfde velden en logs) ---- */
  function accStart(key, body, req) {
    const wens = { rol: String((body || {}).rol || ''), code: body && body.code ? String(body.code).toUpperCase() : '',
      staffId: body && body.staffId != null ? Number(body.staffId) : null };
    const r = lijst(key).find(x => x.rol === wens.rol && (!wens.code || x.code === wens.code)
      && (wens.staffId == null || x.staffId === wens.staffId));
    if (!r) return { status: 404, error: 'Deze rol is niet aan uw account gekoppeld.' };
    // de algemene pin: heeft dit lid er een gezet, dan opent er geen werk-app
    // zonder (bevoegdheid = het ene account, bewijs = de pin). Zonder pin in
    // het verzoek vragen we er netjes om, zonder een foutpoging te tellen.
    if (pinInfo && pinCheck && pinInfo(key).gezet) {
      if (!(body || {}).pin) return { status: 401, error: 'Voer uw algemene pin in.', pinNodig: true };
      const p = pinCheck(key, body.pin);
      if (p.error) return { status: p.status || 401, error: p.error, pinNodig: true };
    }
    if (r.rol === 'kantoor') {
      const token = crypto.randomBytes(24).toString('hex');
      rememberSession(token, { role: 'office' });
      logInlog('office', true, 'backoffice via RTG-account', req);
      return { status: 200, ok: true, rol: 'kantoor', token, state: officeState() };
    }
    const s = findSupplier(r.code);
    if (!s) return { status: 404, error: 'Deze zaak bestaat niet meer.' };
    let actor;
    if (r.rol === 'personeel') {
      // het personeelslid moet nog steeds in dienst zijn; anders vervalt de koppeling
      const staff = accounts.listStaff(s.code).find(x => x.id === r.staffId);
      if (!staff) {
        db.data.accountRollen[key] = lijst(key).filter(x => !zelfde(x, r));
        save();
        return { status: 403, error: 'Deze personeelslogin bestaat niet meer; de koppeling is opgeruimd.' };
      }
      actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
    } else {
      actor = { name: 'Beheer', role: 'manager', manager: true };
    }
    // het ene account is geen achterdeur: het werkvenster van de werkgever
    // geldt hier precies zo als bij de losse personeelslogin
    if (magWerken) {
      const w = magWerken(s, { staffId: actor.staffId, manager: actor.manager });
      if (!w.ok) return { status: 403, error: w.error, venster: w.venster || null };
    }
    const token = crypto.randomBytes(24).toString('hex');
    // lidKey reist mee zodat Rahuls werkadvies (alleen lezend) naar de eigen
    // agenda van dit lid kan kijken; nooit naar die van iemand anders
    rememberSession(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId, staffRole: actor.role, manager: actor.manager, lidKey: key });
    logInlog('zaak', true, s.code + ' · ' + actor.name + ' via RTG-account', req);
    logActivity(s.code, actor, actor.name + ' logde in met het RTG-account');
    return { status: 200, ok: true, rol: r.rol, token, state: supplierState(s, actor) };
  }

  function accOntkoppel(key, body) {
    const voor = lijst(key).length;
    db.data.accountRollen[key] = lijst(key).filter(r => !(r.rol === String(body.rol || '')
      && (body.code ? r.code === String(body.code).toUpperCase() : true)
      && (body.staffId != null ? r.staffId === Number(body.staffId) : true)));
    save();
    return { status: 200, ok: true, verwijderd: voor - lijst(key).length };
  }

  return { accRollen, accKoppel, accStart, accOntkoppel };
}

module.exports = { maakEenAccount };
