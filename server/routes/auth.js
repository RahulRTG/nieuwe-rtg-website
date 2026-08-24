/* Domein "auth" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog, automatisering } = kern;
  /* Demo-inlog (snelle pas-login zonder wachtwoord, en het demo-account): UIT,
     tenzij RTG_DEMO=1 uitdrukkelijk aanstaat. Echte leden loggen in via
     /api/auth/login.

     TWEE VLAGGEN MET DEZELFDE NAAM, EN DAT WAS DE VAL. In server/server.js
     stond dezelfde `DEMO` en die is hier gerepareerd; deze tweede bleef op
     `!PRODUCTION` staan. Een toets vond het meteen: met de demo-stand uit gaf
     POST /api/login {"tier":"business"} nog steeds een volledige sessie op naam
     van de eigenaar. Twee bronnen voor dezelfde waarheid betekent dat je er een
     kunt repareren en denken dat je klaar bent. */
  const DEMO = process.env.RTG_DEMO === '1';

  /* Elke pas heeft zijn eigen app (app.html?pas=...). De inloggegevens werken
     echt alleen in de app van de eigen pas: een Business-account komt de
     Lifestyle-app niet in, en andersom. De gratis laag (gast) heeft geen eigen
     app en speelt mee in de RTG-app, met minder functies. Er is geen brede
     leden-app meer; zonder pasApp (directe API-koppelingen en tests) blijft
     elke pas werken. */
  /* DE EIGENAAR LOOPT LANGS DE PAS-CONTROLE.

     Die controle bestaat om leden in de app van hun eigen pas te houden: een
     Business-account komt de Lifestyle-app niet in, en andersom. Voor de
     eigenaar slaat dat nergens op -- hij bouwt ze alle drie, moet ze alle drie
     kunnen laten zien, en zijn eigen account draagt nu eenmaal maar een pas.
     Zonder deze uitzondering wees zijn eigen huis hem de deur.

     Het is geen gat: eigenaar zijn hangt aan het e-mailadres uit de
     identiteitskluis (server/eigenaar.js), niet aan een veld in het verzoek.
     Wie geen eigenaar is, merkt van deze regel niets. */
  const eigenaar = require('../eigenaar');
  const isBaas = (user) => { try { return eigenaar.isEigenaar(accounts, user); } catch (e) { return false; } };

  function pasAppOk(pasApp, tier) {
    if (!['rtg', 'lifestyle', 'business'].includes(pasApp)) return true; // brede app
    if (pasApp === 'rtg') return tier === 'rtg' || tier === 'guest';
    return tier === pasApp;
  }
  const PAS_FOUT = 'Deze inloggegevens horen bij een andere pas. Open de app van uw eigen pas via rtg.example/apps.';
  // e-maillinks (bevestigen/herstellen) landen in de pas-app van het account
  const pasAppVan = (tier) => tier === 'lifestyle' || tier === 'business' ? tier : 'rtg';
  /* DE HERSTEL-LINK IN HET ANTWOORD: UIT, TENZIJ IEMAND HEM BEWUST AANZET.

     Zonder SMTP geeft deze route de herstel-link en de telefooncode terug in het
     antwoord, zodat de stroom lokaal en in toetsen te doorlopen is. Dat hing aan
     `!PRODUCTION && !mail.configured` -- twee dingen die WAAR zijn zodra iemand
     iets vergeet. Op de echte server was NODE_ENV niet gezet en was er geen post
     ingesteld, en die server staat op het open internet: een POST met een
     willekeurig adres leverde de link EN de code op. Elk account was daarmee over
     te nemen, de eigenaar incluis. Nagemeten met een curl van buiten.

     De reparatie erna was OOK fout, en dat is het leerzame deel: ik hing hem aan
     "het verzoek moet van deze machine komen". Maar de gateway (server/trio.js)
     stuurt alles lokaal door, dus de server ziet ELK verzoek als lokaal. Van
     buiten gemeten bleef het gat wagenwijd open. Een controle die je niet van
     buitenaf naprikt, is een aanname.

     Nu staat het om: alleen met RTG_DEV_LINKS=1 komen die velden mee. Uit is de
     stand die je krijgt als je niets doet, en dat is de enige stand die veilig
     mag zijn. De toetshelper zet hem, dus toetsen merken niets. Een echte server
     zet hem niet, en dan is er niets te vergeten. */
  const DEV_VELDEN = () => process.env.RTG_DEV_LINKS === '1';

  /* HOE HARD EN HOE VERS EEN SESSIE IS ONTSTAAN (VERTROUWEN.md laag 2), en het
     staat hier omdat er TWEE deuren zijn die een sessie uitgeven: inloggen en
     registreren. Twee plekken die hetzelfde moeten noteren, noteren het na
     verloop van tijd verschillend (LAT.md regel 4), en dan meet laag 3 de ene
     helft van de mensen anders dan de andere.

     ZONDER DIT LOOPT EEN VERS ACCOUNT DOOD. Van een sessie die alleen uit de
     registratie komt is niets vastgelegd; laag 3 vraagt dan bij de eerste zware
     handeling een tweede bevestiging, en de bevestigingsdeur weigert die omdat
     er geen gemeten inlog onder ligt. De mens zit klem tot hij uitlogt en
     opnieuw inlogt -- terwijl hij zojuist een wachtwoord heeft gezet.

     HET APPARAAT IS DE USERAGENT PLUS DE TAAL, en er wordt alleen een HASH van
     bewaard (kern/vertrouwen/verificatie.js): genoeg voor de enige vraag die
     wordt gesteld -- ken ik dit apparaat van u -- en te weinig voor een
     bewegingsbeeld.

     EN ER STAAT GEEN TRY OMHEEN. Hier stond er ooit een, met "de inlog gaat
     voor" erbij. Dat klonk verstandig en was het niet: de domeingrens hield de
     aanroep tegen, de catch slikte dat op, en de inlog bleef vrolijk slagen
     terwijl laag 2 volledig stilstond. Een vangnet om een bedradingsfout heen
     ziet er precies hetzelfde uit als een vangnet om iets dat werkt.

     EEN ACCOUNT HEEFT EEN SPELLING, en dat is `user-<id>`. De apparatenlijst
     hangt aan die naam, en dezelfde mens komt in dit huis langs meer dan een
     deur: de RTG-inlog kent hem als id, de werkruimte kent hem als `rtgKey`, de
     techniekdeur als `user-<id>`. Twee spellingen zouden twee apparatenlijsten
     opleveren, en dan is elk apparaat bij de tweede deur eeuwig "nieuw" -- een
     step-up die altijd vraagt, precies de vorm van ruis waar niemand nog naar
     kijkt. De prefix staat dus HIER en niet bij de aanroeper. */
  const noteerSessie = (req, token, userId, hoe) =>
    kern.vertrouwen.verifieer(token, { hoe: hoe || 'wachtwoord', account: 'user-' + userId,
      apparaat: String(req.get('user-agent') || '') + '|' + String(req.get('accept-language') || '') });

  /* Inloggen en uitloggen staan in ./auth/inlog.js -- hier aangeroepen en niet
     verderop, want dit zijn de eerste vier routes van het domein en de volgorde
     van registreren is in dit huis de volgorde van afhandelen. */
  require('./auth/inlog')({ PERSONAS, accounts, app, auth, checkCred, crypto, forgetSession, hasCred,
    loginFails, noteFailedTry, rememberSession, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, isBaas, kern, noteerSessie });

  /* De registratie-, herstel- en verificatieroutes draaien als submodules
     op een gedeelde context, een keer opgebouwd bij het opstarten. */
  const actx = { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN, isBaas, antivirus: kern.antivirus,
    webauthnRegOpties: kern.webauthnRegOpties, webauthnRegMaak: kern.webauthnRegMaak,
    webauthnLoginOpties: kern.webauthnLoginOpties, webauthnLoginMaak: kern.webauthnLoginMaak,
    webauthnLijst: kern.webauthnLijst, webauthnWeg: kern.webauthnWeg, automatisering,
    /* De kern zelf reist mee voor de wervingslink. Die helpers (zoekInvite,
       verbindLid) worden PAS aan de kern gehangen als routes/werving.js is
       gemount, en dat gebeurt na deze module -- dus uitpakken bij het opstarten
       zou een undefined opleveren. Via het kern-object leest de registratie ze
       op het moment dat er iemand registreert, en dan staan ze er. */
    kern, noteerSessie };
  require('./auth/account')(actx);
  /* Het bevestigen van het e-mailadres staat los van het registreren: dat is een
     ander moment, met een andere sleutel, vaak dagen later en op een ander
     apparaat. Zie ./auth/emailbevestiging.js. */
  require('./auth/emailbevestiging')(actx);
  require('./auth/herstel')(actx);
  /* De herstelstroom komt uit die submodule (startHerstel) en de LEDENBALIE
     roept hem aan: een lid dat belt dat hij niet meer inlogt, krijgt dezelfde
     mail als wanneer hij zelf op "wachtwoord vergeten" drukt. Hier op de kern
     zetten en niet in de submodule, want actx is van dit bestand -- de balie
     leest kern.startHerstel. Nabouwen was de andere optie en die is fout: dan
     is er een tweede plek die een hersteltoken maakt. */
  kern.startHerstel = actx.startHerstel;
  require('./auth/verificatie')(actx);
  require('./auth/webauthn')(actx);
};
