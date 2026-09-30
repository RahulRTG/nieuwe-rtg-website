/* Eenaccount (deelbestand): MET EEN SLEUTEL EEN WERK-SESSIE MUNTEN.

   ../eenaccount.js beheert de sleutelbos: welke rollen hangen aan dit account,
   en hoe komt er een bij (altijd door de bestaande werk-inlog te bewijzen).
   Dit bestand doet het andere: met zo'n sleutel daadwerkelijk naar binnen.

   Afgesplitst toen het bestand over de 10 kB ging: aan een sessie hangt wat er
   aan een sleutel niet hangt -- het werkvenster, de algemene pin, twee soorten
   logs, of iemand nog in dienst is, en (B10) de passkey aan de kantoordeur.

   HET ENE ACCOUNT IS GEEN ACHTERDEUR, en dat wordt HIER waargemaakt. accStart()
   munt precies dezelfde sessie als de losse inlog: dezelfde rememberSession met
   dezelfde velden, dezelfde logregel, hetzelfde werkvenster. Een controle die
   hier wordt overgeslagen omdat "hij al is ingelogd", maakt van de sleutelbos
   een omweg met soepeler regels. */
'use strict';
const klok = require('../../lib/klok');
const werkSleutels = require('../../bedrijf/sleutels').maak();

module.exports = (ctx) => {
  const { db, save, crypto, accounts, findSupplier, rememberSession, logInlog,
    logActivity, supplierState, officeState, magWerken, pinInfo, pinCheck,
    lijst, zelfde, eigenaarKantoor, kantoorVanZetel, afgeleid, nu, persoonsPoort, sessieregister, zwaarVan } = ctx;
  const productiedeur = require('../kantoor/productiedeur');

  /* Het lidnummer uit de lidsleutel. De sleutel is 'user-<id>' -- dezelfde vorm
     die kernlaag1, kernlaag7 en kern/wauw.js al lezen. Geen tweede opzoeking in
     accounts: die zou hetzelfde antwoord op een tweede manier berekenen. */
  const lidVanKey = (k) => {
    const m = /^user-(\d+)$/.exec(String(k || ''));
    return m ? Number(m[1]) : null;
  };

  /* ---- met het ene account een werk-sessie starten (zelfde munt als de
     losse inlog: rememberSession met exact dezelfde velden en logs) ---- */
  async function accStart(key, body, req) {
    const wens = { rol: String((body || {}).rol || ''), code: body && body.code ? String(body.code).toUpperCase() : '',
      staffId: body && body.staffId != null ? Number(body.staffId) : null };
    let r = lijst(key).find(x => x.rol === wens.rol && (!wens.code || x.code === wens.code)
      && (wens.staffId == null || x.staffId === wens.staffId));
    // de eigenaar opent de kantoordeur zonder koppeling; zie eigenaarKantoor()
    if (!r && wens.rol === 'kantoor' && !wens.code) r = eigenaarKantoor(key) || kantoorVanZetel(key);
    // een werkruimte staat niet in de opslag maar in de koppeling zelf
    if (!r && wens.rol === 'werkruimte') {
      r = afgeleid.werkruimtes(key).find(x => !wens.code || x.code === wens.code) || null;
    }
    if (!r && wens.rol === 'personeel') {
      r = afgeleid.personeel(key).find(x => (!wens.code || x.code === wens.code) &&
        (wens.staffId == null || Number(x.staffId) === wens.staffId)) || null;
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
    /* NAMENS WIE (MIJN RTG blok 3). Hier ontstaat een tweede context voor
       dezelfde mens: hij was al ingelogd als zichzelf en handelt nu namens een
       zaak of namens het kantoor. Dat is precies het moment waarop het
       vastgelegd hoort te worden -- achteraf uit de rol afleiden zou een
       afleiding zijn en dus hoogstens `vermoed` opleveren, terwijl wij het nu
       met zekerheid weten.

       De contextId is een CODE en geen naam: de naam van de zaak wordt door het
       scherm opgezocht, om dezelfde reden als bij de toestelnaam -- een sessie
       repliceert over een bus en draagt daarom geen namen. */
    function legContext(sess, lidKey, soort, contextId) {
      if (!sessieregister || !sess || !sess.sid) return;
      sessieregister.open(sess.sid, lidKey, {
        context: { contextId: String(contextId), contextSoort: soort, contextVersie: 1,
          herkomst: { bron: 'eenaccount/starten', methode: 'gemeten',
            vastgesteldOp: klok.datum().toISOString(), regelversie: 'blok3' } }
      });
    }

    /* Buiten productie een VERSE lid-sessie (bedrijf/sleutels.js): de oude staat
       alleen als hash en wordt nooit opnieuw getoond. Vers opgezocht, zodat
       losmaken of een schorsing meteen telt; productie opent met het account. */
    if (r.rol === 'werkruimte') {
      const wl = afgeleid.werkruimteLid(key, r.code);
      if (!wl) return { status: 403, error: 'Deze werkruimte is niet (meer) aan uw account gekoppeld.' };
      logInlog('werkruimte', true, wl.w.code + ' · ' + (wl.l.functie || wl.l.naam) + ' via RTG-account', req);
      const token = process.env.NODE_ENV === 'production' ? null : werkSleutels.geefLid(wl.w, wl.l);
      if (token) save();
      return { status: 200, ok: true, rol: 'werkruimte', token,
        code: wl.w.code, naam: wl.w.naam, functie: wl.l.functie || null };
    }
    if (r.rol === 'kantoor') {
      // B10: in productie alleen met een verse passkey (../kantoor/productiedeur.js)
      const pd = await productiedeur.startBewijs({ zwaarVan, accounts, key, req });
      if (!pd.ok) return pd;
      const token = crypto.randomBytes(24).toString('hex');
      // lidKey: WIE er door de kantoordeur kwam (boardroom-poort)
      const oSess = { role: 'office', lidKey: key, ...(pd.bewijs ? { kantoorBewijs: pd.bewijs } : {}) };
      rememberSession(token, oSess);
      legContext(oSess, key, 'kantoor', 'rtg-kantoor');
      logInlog('office', true, r.viaRtgZaak ? 'backoffice via zetel in de RTG-zaak' : 'backoffice via RTG-account', req);
      return { status: 200, ok: true, rol: 'kantoor', token, state: officeState() };
    }
    const s = findSupplier(r.code);
    if (!s) return { status: 404, error: 'Deze zaak bestaat niet meer.' };
    const lidId = lidVanKey(key);
    let actor;
    if (r.rol === 'personeel') {
      // het personeelslid moet nog steeds in dienst zijn; anders vervalt de koppeling
      const staff = accounts.listStaff(s.code).find(x => x.id === r.staffId);
      const personeelLid = lidVanKey(key);
      if (!staff || personeelLid == null || Number(staff.member_id) !== personeelLid) {
        db.data.accountRollen[key] = lijst(key).filter(x => !zelfde(x, r));
        save();
        return { status: 403, error: 'Deze personeelslogin bestaat niet meer; de koppeling is opgeruimd.' };
      }
      actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
    } else {
      const staff = lidId != null ? accounts.staffByMember(s.code, lidId) : null;
      if (staff) {
        actor = { name: staff.name, role: staff.role, staffId: staff.id, manager: staff.role === 'manager' };
      } else if (!accounts.legacyStaffPinToegestaan || !accounts.legacyStaffPinToegestaan()) {
        return { status: 403, error: 'Deze bedrijfsrol is nog niet aan uw persoonlijke RTG-account gebonden. Laat de bedrijfsaanmelding veilig opnieuw provisioneren.' };
      } else {
        actor = { name: 'Beheer', role: 'manager', manager: true };
      }
    }
    // het ene account is geen achterdeur: het werkvenster van de werkgever
    // geldt hier precies zo als bij de losse personeelslogin
    if (magWerken) {
      const w = magWerken(s, { staffId: actor.staffId, manager: actor.manager }, null, (body || {}).positie);
      if (!w.ok) return { status: 403, error: w.error, venster: w.venster || null, ...(w.locatieNodig ? { locatieNodig: true } : {}) };
    }
    /* En de persoonseis van het genre, om dezelfde reden als het werkvenster
       erboven: het ene account is geen achterdeur. Dezelfde functie als
       supplierAuth, zodat er niet twee besluiten over dezelfde vraag ontstaan. */
    if (persoonsPoort) {
      const pp = persoonsPoort(s, { manager: actor.manager, lid: lidId });
      if (!pp.ok) return { status: 403, error: pp.error, persoonseis: pp.missend || null };
    }
    const token = crypto.randomBytes(24).toString('hex');
    /* lidKey reist mee zodat Rahuls werkadvies (alleen lezend) naar de eigen
       agenda van dit lid kan kijken; nooit naar die van iemand anders. `lid`
       reist mee omdat de persoonseis en de loonlaag het lidnummer zelf nodig
       hebben -- dat ontbrak hier, net als in kern/werkbijlogin.js. */
    const binding = accounts.staffAccountBinding(lidId);
    if (!binding || binding.lidKey !== key)
      return { status: 401, error: 'Uw persoonlijke RTG-account is niet meer actief.' };
    const zSess = { role: 'supplier', code: s.code, actor: actor.name,
      staffId: actor.staffId, staffRole: actor.role, manager: actor.manager, ...binding };
    rememberSession(token, zSess);
    legContext(zSess, key, 'zaak', s.code);
    logInlog('zaak', true, s.code + ' · ' + actor.name + ' via RTG-account', req);
    logActivity(s.code, actor, actor.name + ' logde in met het RTG-account');
    /* Rahuls welzijnszin: een stille, eenmalige opmerking bij de start --
       nooit een blokkade, nooit een score, alleen zorg. Diep in de nacht
       of bij een zoveelste werkstart vandaag mag dat gezegd worden. */
    let welzijn = null;
    const uur = klok.datum().getHours();
    const wm = db.data.accountWelzijn = db.data.accountWelzijn || {};
    const vandaag = klok.datum().toISOString().slice(0, 10);
    const wr = wm[key] = (wm[key] && wm[key].dag === vandaag) ? wm[key] : { dag: vandaag, starts: 0 };
    wr.starts++;
    save();
    if (uur >= 23 || uur < 6) welzijn = 'Late dienst; neem morgen bewust je rust.';
    else if (wr.starts >= 5) welzijn = 'Dit is al je ' + wr.starts + 'e werkstart vandaag; vergeet de pauze niet.';
    return { status: 200, ok: true, rol: r.rol, token, state: supplierState(s, actor), ...(welzijn ? { welzijn } : {}) };
  }

  return { accStart };
};
