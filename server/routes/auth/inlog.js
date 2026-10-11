/* Auth (deelmodule): DE ECHTE ACCOUNTINLOG.

   De kop sprak van VIER routes -- demo-inlog, uitloggen, accountinlog en "wie
   ben ik" -- maar die andere drie staan inmiddels in ./inlog-pas.js. Er staat er
   dus EEN, en dat hoort er te staan: een kop die meer belooft dan het bestand
   heeft, laat je op de verkeerde plek zoeken.

   De volgorde blijft: dit wordt aangeroepen op de plek waar de routes stonden,
   VOOR de andere auth-submodules, want in dit huis is de volgorde van
   registreren ook de volgorde van afhandelen. De gedeelde stukken (DEMO,
   pasAppOk, PAS_FOUT, isBaas) komen uit routes/auth.js, met de uitleg daar. */
const { legInlogVast } = require('../../kern/identiteit/inlogherkomst');
const { maakWachtwoordRem } = require('../../kern/identiteit/wachtwoordrem');

module.exports = (ctx) => {
  const { accounts, app, loginFails, noteFailedTry, stateFor, tooManyTries, logInlog,
    pasAppOk, isBaas, kern , PAS_FOUT, sessieregister, tweefactor } = ctx;

  /* DE REM OP HET WACHTWOORD is gedeeld met de werkplekinlog
     (/api/supplier/mijn/login, N28): drie emmers op dezelfde namen, dus wat
     daar gegokt wordt telt hier mee en andersom. Welke emmers, welke grenzen,
     waarom het account een vertraging krijgt en geen slot, en waarom een
     geslaagde inlog de adresemmer laat staan: zie de kop van
     kern/identiteit/wachtwoordrem.js. */
  const rem = maakWachtwoordRem({ tooManyTries, noteFailedTry, loginFails });

  /* De PAS-sessie (/api/login en /api/logout) staat in ./inlog-pas.js -- zie
     de kop daar. Hier aangeroepen zodat de registratievolgorde dezelfde
     blijft: eerst de pas-kant, dan de accountkant hieronder. */
  require('./inlog-pas')(ctx);

app.post('/api/auth/login', async (req, res) => {
  const login = req.body.login || req.body.email || req.body.username;
  /* DRIE REMMEN, WANT EEN EMMER OP IP+ACCOUNT REMT MAAR EEN SOORT AANVAL.
     Hier stond alleen de emmer op adres plus account, en veertig adressen op
     een account waren veertig verse emmers: gemeten, veertig gokken en nul
     remmen. Nu ook een op het adres en een op het account, en die laatste
     vertraagt en sluit niet. De emmers staan in kern/identiteit/wachtwoordrem.js
     en de werkplekinlog deelt ze (N28). Eerst opzoeken: de emmers hangen aan
     het account en niet aan de getikte naam (I1, zie de kop daar). */
  const user = accounts.findByLogin(login);
  if (rem.dicht(res, req.ip, login, user)) return;
  if (!user || !await accounts.verifyPassword(req.body.password, user.password_hash)) {
    /* De emmers worden hier meteen gevuld, nog voor het spoor: faalt het spoor,
       dan telt de poging toch. Afgewacht wordt pas onderaan. */
    const remming = rem.mis(req.ip, login, user);
    /* HET SPOOR OP DE HOOFDINGANG. logInlog belooft "elke inlogpoging (gelukt of
       mislukt, op elk kanaal)", maar deze route -- de ECHTE accountingang, waar
       een aanval op echte accounts binnenkomt -- liet 102 van de 106 geslaagde
       aanroepen ongelogd. Gemeten op de AUDIT-as, vastgehouden door
       test/inlogspoor.test.js. De mislukte tak is de belangrijkste: zonder deze
       regel is credential stuffing achteraf niet te zien.

       WAT ER IN GAAT IS HET ACCOUNT-ID, NOOIT HET LOGIN-ADRES, en dat is met
       schade geleerd: de eerste versie schreef `login` weg en dat is een
       e-mailadres in de GEDEELDE database. test/vergeten.test.js viel er
       terecht over -- na "verwijder mijn account" stond het adres er nog. De
       regel van dit huis staat in kern/vergeten.js bij het inzagejournaal: een
       auditlog mag blijven staan zolang hij geen naam en geen e-mailadres
       bevat, alleen een id dat na de verwijdering nergens meer op slaat. Zo
       kan niemand zijn sporen uitvegen door een account te wissen, en staat er
       toch geen persoonsgegeven in de gedeelde bak.

       Bij een ONBEKEND login-adres is er geen id, en dan blijft `wie` leeg.
       Dat kost iets -- welk adres er is afgetast staat er niet meer bij -- maar
       het alternatief is het adres van iemand die hier misschien niet eens lid
       is in de database zetten. Wat overblijft is het kanaal, het tijdstip en
       het IP, en dat is ook precies waar credential stuffing aan te zien is:
       veel mislukte accountpogingen van een plek. */
    logInlog('account', false, user ? user.id : null, req);
    /* EN HIER WORDT DE ACCOUNTEMMER OOK ECHT GEVOELD. Deze wacht was bij een
       samenvoeging al eens weggevallen terwijl het vullen bleef staan: een rem
       die telt maar niet remt. test/inlogrem.test.js meet de tijd en zakt dan. */
    await remming;
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
  rem.gelukt(req.ip, login, user);
  logInlog('lid', true, 'user-' + user.id, req);
  /* DE HASH STIL OPWAARDEREN. Het wachtwoord klopt, dus we hebben de klaartekst
     precies een keer in handen -- het enige moment waarop een hash met oude
     scrypt-kosten naar de huidige kan (zie server/accounts/kluis.js). De inlog
     hangt er niet van af: lukt het niet, dan loggen we dat en gaan we door, want
     een lid buitensluiten omdat een VERBETERING mislukte is de verkeerde kant om
     te falen. Stil overslaan mag het niet (LAT.md regel 5). */
  if (typeof accounts.vernieuwWachtwoordHash === 'function') {
    try { await accounts.vernieuwWachtwoordHash(user.id, req.body.password); }
    catch (e) { try { require('../../log').log.warn('hash opwaarderen mislukte voor gebruiker ' + user.id + ': ' + e.message); } catch (x) {} }
  }
  /* Uit dienst gemeld door de organisatie (SCIM) = ook met het juiste wachtwoord
     niet meer naar binnen. verifyToken weigert de sessie toch al, dus zonder
     deze regel zou iemand een token krijgen dat meteen daarna nergens voor
     deugt: verwarrend, en het verbergt de echte reden. */
  if (!accounts.isActief(user)) {
    /* Het wachtwoord klopte, de deur bleef dicht. Dat is een mislukte poging en
       hoort op het bord: iemand probeert binnen te komen op een account dat uit
       dienst is gemeld, en dat is precies iets om terug te kunnen zien. */
    logInlog('account', false, user.id, req);
    return res.status(403).json({ error: 'Dit account is door uw organisatie op non-actief gezet. Neem contact op met uw beheerder.' });
  }
  // juiste gegevens, maar de verkeerde pas-app: netjes doorverwijzen. De
  // eigenaar mag in alle drie de apps; zie de uitleg bij pasAppOk hierboven.
  if (!isBaas(user) && !pasAppOk(String(req.body.pasApp || ''), user.tier)) {
    logInlog('account', false, user.id, req);
    return res.status(403).json({ error: PAS_FOUT });
  }
  /* DE TWEEDE FACTOR (kern/identiteit/tweefactor.js). Staat hij aan, dan komt
     hier een kort BEWIJS uit en geen sessietoken; /api/auth/tweede ruilt dat om.
     Dat dit VOOR het token staat is het punt -- eronder was het een mededeling
     in plaats van een drempel. Wie geen tweede factor heeft, merkt niets. */
  const tweedeStap = tweefactor && tweefactor.inlogPoort(user);
  if (tweedeStap) { logInlog('account', true, user.id, req); return res.json(tweedeStap); }

  const token = accounts.issueToken(user.id);
  /* Hier is de inlog een feit: er is een token. Loggen VOOR de werkplek-lus,
     zodat een geslaagde inlog ook een spoor nalaat als daar iets misgaat. */
  logInlog('account', true, user.id, req);
  const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
  /* Een wachtwoord is `gemeten` en niet `cryptografisch`: een gedeeld geheim
     gecontroleerd, geen sleutelbezit bewezen (vgl. ./webauthn.js). */
  legInlogVast({ sessieregister, accounts, token, lidKey: sess.key,
    type: 'wachtwoord', assurance: 'kennis', methode: 'gemeten', bron: 'auth/inlog' });
  // Bestaande leden krijgen hun publieke adres bij de eerstvolgende veilige
  // inlog; een paswijziging verhuist hier ook naar het juiste pasdomein.
  try { require('../../kern/mail-publiek')({ accounts }).geefLid({
    user, naam:accounts.realNameOf(user), tier:user.tier }); } catch (e) {}
  /* Een account voor alles: heeft dit lid een werkplek, dan komt die hier meteen
     mee. Geen tweede inlog en geen pincode -- je bent al wie je bent. Het
     werkvenster van de werkgever bepaalt of de plek open is; een dichte plek komt
     zonder token mee, met de reden erbij, zodat de app hem wel kan tonen. */
  let werk = [];
  try { werk = kern.werkplekkenBijLogin ? kern.werkplekkenBijLogin(user.id, sess.key, req) : []; } catch (e) { werk = []; }
  res.json({ token, state: stateFor(sess, req.body.lang), ...(werk.length ? { werk } : {}) });
});
};
