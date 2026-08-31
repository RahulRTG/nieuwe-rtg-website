/* Auth (deelmodule): INLOGGEN EN UITLOGGEN. De vier routes waarmee een sessie
   ontstaat en weer verdwijnt -- de demo-inlog, uitloggen, de echte accountinlog
   en "wie ben ik".

   Geknipt uit routes/auth.js omdat dat bestand over de leesgrens ging. De
   volgorde blijft: dit wordt aangeroepen op de plek waar de routes stonden,
   VOOR de andere auth-submodules, want in dit huis is de volgorde van
   registreren ook de volgorde van afhandelen.

   De gedeelde stukken (DEMO, pasAppOk, PAS_FOUT, isBaas) komen mee uit
   routes/auth.js en staan daar met de uitleg waarom ze zijn zoals ze zijn. */
const { legInlogVast } = require('../../kern/identiteit/inlogherkomst');

module.exports = (ctx) => {
  const { accounts, app, auth, crypto, loginFails, noteFailedTry, stateFor, tooManyTries, logInlog,
    pasAppOk, isBaas, kern , PAS_FOUT, sessieregister } = ctx;

  /* Eenmalig, niet per verzoek: de emmernaam van een doel wordt gehasht zodat
     een e-mailadres nooit in het geheugen van de rem of in een
     beveiligingsmelding belandt. Zelfde vorm als routes/auth/webauthn.js. */
  const vingerafdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex').slice(0, 24);

  /* De PAS-sessie (/api/login en /api/logout) staat in ./inlog-pas.js -- zie
     de kop daar. Hier aangeroepen zodat de registratievolgorde dezelfde
     blijft: eerst de pas-kant, dan de accountkant hieronder. */
  require('./inlog-pas')(ctx);

app.post('/api/auth/login', async (req, res) => {
  const login = req.body.login || req.body.email || req.body.username;
  const sleutel = String(login || '').toLowerCase().trim();
  /* DRIE REMMEN, WANT EEN EMMER OP IP+ACCOUNT REMT MAAR EEN SOORT AANVAL.

     Hier stond alleen de eerste. Die stopt tien gokken van EEN adres op EEN
     account, en dat is precies wat een aanvaller met meer dan een adres
     omzeilt: veertig adressen op hetzelfde account zijn veertig verse emmers.
     Gemeten op de stand van hiervoor: veertig gokken, nul remmen, en het echte
     wachtwoord werkte daarna nog gewoon.

     De passkey-kant (routes/auth/webauthn.js) deed dit al goed met een bron- en
     een doelemmer; de wachtwoordkant liep achter. Nu dezelfde vorm, inclusief
     het hashen van het doel: zo belandt een e-mailadres nooit in het geheugen
     van de rem of in een beveiligingsmelding -- dat is dezelfde regel als de
     codenamen elders in dit huis.

     De grenzen lopen uiteen naar de schade die een onterecht slot aanricht.
     IP+account raakt alleen de aanvaller (10). De bron alleen kan een kantoor
     achter een NAT-adres treffen, dus die staat ruim (50).

     EN HET DOEL KRIJGT GEEN SLOT MAAR EEN VERTRAGING. Een slot op het account
     zou een vreemde de macht geven om een lid uit zijn eigen account te houden:
     vijfentwintig gokken verbranden en de eigenaar staat buiten. Gemeten toen
     die emmer nog een slot was: na de aanval gaf het JUISTE wachtwoord een 429.
     Dat is de aanval helpen in plaats van hem stoppen.

     Dus kost elke MISLUKTE poging op een aangevallen account twee seconden, en
     verandert er voor de eigenaar niets: wie het wachtwoord weet, komt zonder
     vertraging binnen. Voor de aanvaller zakt het tempo naar een gok per twee
     seconden per account, boven op de tien per adres en de vijftig per bron. */
  const bucket = 'auth:' + req.ip + ':' + sleutel.slice(0, 60);
  const bronBucket = 'auth:bron:' + req.ip;
  const doelBucket = 'auth:doel:' + vingerafdruk('account:' + sleutel);
  if (tooManyTries(res, bucket) || tooManyTries(res, bronBucket)) return;
  const user = accounts.findByLogin(login);
  if (!user || !await accounts.verifyPassword(req.body.password, user.password_hash)) {
    noteFailedTry(bucket, req.ip);
    noteFailedTry(bronBucket, req.ip, 50);
    noteFailedTry(doelBucket, req.ip, 25);
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
    /* EN HIER WORDT DE DOELEMMER OOK ECHT GEVOELD. Deze twee regels waren bij de
       samenvoeging weggevallen terwijl het vullen van de emmer hierboven bleef
       staan -- een rem die telt maar niet remt. Het commentaar erboven belooft
       "een gok per twee seconden per account", en zonder deze wacht was dat een
       belofte zonder afdwinging: dertig gokken van dertig adressen liepen weer
       op volle snelheid. test/inlogrem.test.js meet de tijd, niet de status,
       en die zakte er terecht op. */
    const doel = loginFails.get(doelBucket);
    if (doel && doel.until > Date.now()) await new Promise(r => setTimeout(r, 2000));
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
  loginFails.delete(bucket); loginFails.delete(bronBucket); loginFails.delete(doelBucket);
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
  const token = accounts.issueToken(user.id);
  /* Hier is de inlog een feit: er is een token. Loggen VOOR de werkplek-lus,
     zodat een geslaagde inlog ook een spoor nalaat als daar iets misgaat. */
  logInlog('account', true, user.id, req);
  const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
  /* MIJN RTG. Een wachtwoord is `gemeten` en niet `cryptografisch`: wij
     controleerden een gedeeld geheim, niemand bewees sleutelbezit -- zie
     ./webauthn.js, waar dezelfde claim wel `bewezen` haalt. Geen
     authenticatorId, want er is er geen. */
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

app.post('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.session.account ? accounts.publicUser(req.session.account) : stateFor(req.session, req.body.lang).user });
});
};
