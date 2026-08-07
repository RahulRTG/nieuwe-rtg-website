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

   maakEenAccount(state) volgt het vaste kern-patroon. Het BEWIJZEN zelf (de
   drie soorten, met de twee remmen) staat in ./eenaccount/koppelen.js; hier de
   sleutelbos en het munten van de sessie. */

function maakEenAccount({ db, save, crypto, accounts, findSupplier, checkCred, hasCred, DEMO,
  DEMO_SUPPLIER, OFFICE_CODE, veiligGelijk, totpOk, rememberSession, logInlog, logActivity,
  supplierState, officeState, magWerken, pinInfo, pinCheck, pinSlot }) {
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
    const rollen = lijst(key).map(r => ({ rol: r.rol, code: r.code || null,
      staffId: r.staffId || null, naam: r.naam || null, zaakNaam: r.zaakNaam || null, sinds: r.at }));
    // de afgeleide kantoorsleutel van de eigenaar, tenzij hij hem al koppelde
    const eig = eigenaarKantoor(key);
    if (eig && !rollen.some(r => r.rol === 'kantoor')) {
      rollen.push({ rol: 'kantoor', code: null, staffId: null, naam: eig.naam,
        zaakNaam: null, sinds: null, viaEigenaar: true });
    }
    // en elke werkruimte waar dit account aan gekoppeld is, apart per
    // organisatie en met de eigen functie erbij
    for (const wr of afgeleid.werkruimtes(key)) {
      if (!rollen.some(r => r.rol === 'werkruimte' && r.code === wr.code)) rollen.push(wr);
    }
    return { status: 200, rollen };
  }

  /* ---- een rol koppelen: altijd eerst de bestaande werk-inlog bewijzen ---- */
  async function accKoppel(key, body, req) {
    const uitslag = await koppelen.bewijs(key, body, req);
    if (uitslag.error) return uitslag;
    const rol = uitslag.rol;
    const rij = lijst(key).filter(r => !zelfde(r, rol));
    rij.push(rol);
    db.data.accountRollen[key] = rij.slice(-10);
    save();
    logInlog('koppel', true, rol.rol + (rol.code ? ' ' + rol.code : ''), req);
    return { status: 200, ok: true, rollen: accRollen(key).rollen };
  }

  /* ---- met het ene account een werk-sessie starten (zelfde munt als de
     losse inlog: rememberSession met exact dezelfde velden en logs) ---- */
  async function accStart(key, body, req) {
    const wens = { rol: String((body || {}).rol || ''), code: body && body.code ? String(body.code).toUpperCase() : '',
      staffId: body && body.staffId != null ? Number(body.staffId) : null };
    let r = lijst(key).find(x => x.rol === wens.rol && (!wens.code || x.code === wens.code)
      && (wens.staffId == null || x.staffId === wens.staffId));
    // de eigenaar opent de kantoordeur zonder koppeling; zie eigenaarKantoor()
    if (!r && wens.rol === 'kantoor' && !wens.code) r = eigenaarKantoor(key);
    // een werkruimte staat niet in de opslag maar in de koppeling zelf
    if (!r && wens.rol === 'werkruimte') {
      r = afgeleid.werkruimtes(key).find(x => !wens.code || x.code === wens.code) || null;
    }
    if (!r) return { status: 404, error: 'Deze rol is niet aan uw account gekoppeld.' };
    // de algemene pin: heeft dit lid er een gezet, dan opent er geen werk-app
    // zonder (bevoegdheid = het ene account, bewijs = de pin). Zonder pin in
    // het verzoek vragen we er netjes om, zonder een foutpoging te tellen.
    if (pinInfo && pinCheck && pinInfo(key).gezet) {
      if (!(body || {}).pin) return { status: 401, error: 'Voer uw algemene pin in.', pinNodig: true };
      const p = await pinCheck(key, body.pin);
      if (p.error) return { status: p.status || 401, error: p.error, pinNodig: true };
    }
    /* De werkruimte munt geen nieuwe sessie: hij HEEFT er al een, en dat is de
       code plus het lid-token dat deze persoon zelf in handen had toen hij
       koppelde. We geven dus terug wat hij al bezit -- geen escalatie, wel het
       einde van de tweede inlog. Vers opgezocht, zodat losmaken of een
       schorsing meteen telt. */
    if (r.rol === 'werkruimte') {
      const wl = afgeleid.werkruimteLid(key, r.code);
      if (!wl) return { status: 403, error: 'Deze werkruimte is niet (meer) aan uw account gekoppeld.' };
      logInlog('werkruimte', true, wl.w.code + ' · ' + (wl.l.functie || wl.l.naam) + ' via RTG-account', req);
      return { status: 200, ok: true, rol: 'werkruimte', token: wl.l.token,
        code: wl.w.code, naam: wl.w.naam, functie: wl.l.functie || null };
    }
    if (r.rol === 'kantoor') {
      const token = crypto.randomBytes(24).toString('hex');
      // lidKey reist mee: zo weet de boardroom-poort WIE er door de
      // kantoordeur kwam (de eigenaar of iemand met gegeven toegang)
      rememberSession(token, { role: 'office', lidKey: key });
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
      const w = magWerken(s, { staffId: actor.staffId, manager: actor.manager }, null, (body || {}).positie);
      if (!w.ok) return { status: 403, error: w.error, venster: w.venster || null, ...(w.locatieNodig ? { locatieNodig: true } : {}) };
    }
    const token = crypto.randomBytes(24).toString('hex');
    // lidKey reist mee zodat Rahuls werkadvies (alleen lezend) naar de eigen
    // agenda van dit lid kan kijken; nooit naar die van iemand anders
    rememberSession(token, { role: 'supplier', code: s.code, actor: actor.name, staffId: actor.staffId, staffRole: actor.role, manager: actor.manager, lidKey: key });
    logInlog('zaak', true, s.code + ' · ' + actor.name + ' via RTG-account', req);
    logActivity(s.code, actor, actor.name + ' logde in met het RTG-account');
    /* Rahuls welzijnszin: een stille, eenmalige opmerking bij de start --
       nooit een blokkade, nooit een score, alleen zorg. Diep in de nacht
       of bij een zoveelste werkstart vandaag mag dat gezegd worden. */
    let welzijn = null;
    const uur = new Date().getHours();
    const wm = db.data.accountWelzijn = db.data.accountWelzijn || {};
    const vandaag = new Date().toISOString().slice(0, 10);
    const wr = wm[key] = (wm[key] && wm[key].dag === vandaag) ? wm[key] : { dag: vandaag, starts: 0 };
    wr.starts++;
    save();
    if (uur >= 23 || uur < 6) welzijn = 'Late dienst; neem morgen bewust je rust.';
    else if (wr.starts >= 5) welzijn = 'Dit is al je ' + wr.starts + 'e werkstart vandaag; vergeet de pauze niet.';
    return { status: 200, ok: true, rol: r.rol, token, state: supplierState(s, actor), ...(welzijn ? { welzijn } : {}) };
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
