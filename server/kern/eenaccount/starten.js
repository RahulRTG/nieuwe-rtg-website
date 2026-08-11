/* Eenaccount (deelbestand): MET EEN SLEUTEL EEN WERK-SESSIE MUNTEN.

   ../eenaccount.js beheert de sleutelbos: welke rollen hangen aan dit account,
   en hoe komt er een bij (altijd door de bestaande werk-inlog te bewijzen).
   Dit bestand doet het andere: met zo'n sleutel daadwerkelijk naar binnen.

   Afgesplitst toen het bestand over de 10 kB ging, en de naad zat er al: dit is
   verreweg het zwaarste deel, want er hangt van alles aan een sessie die er aan
   een sleutel niet hangt -- het werkvenster van de werkgever, de algemene pin,
   twee soorten logs, en de vraag of iemand nog in dienst is.

   HET ENE ACCOUNT IS GEEN ACHTERDEUR, en dat wordt HIER waargemaakt. accStart()
   munt precies dezelfde sessie als de losse inlog: dezelfde rememberSession met
   dezelfde velden, dezelfde logregel, hetzelfde werkvenster. Zou hier ook maar
   een controle worden overgeslagen omdat "hij al is ingelogd", dan is het ene
   account een tweede toegangspad met soepeler regels -- en dan is het geen
   sleutelbos meer maar een omweg. */
'use strict';

module.exports = (ctx) => {
  const { db, save, crypto, accounts, findSupplier, rememberSession, logInlog,
    logActivity, supplierState, officeState, magWerken, pinInfo, pinCheck,
    lijst, zelfde, eigenaarKantoor, afgeleid, nu } = ctx;

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

  return { accStart };
};
