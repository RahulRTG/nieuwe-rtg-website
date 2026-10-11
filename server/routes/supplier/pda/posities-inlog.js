/* PDA (deelmodule): de werkplekinlog met het eigen RTG-account,
   POST /api/supplier/mijn/login ("1x aanmelden", zie ./posities.js).

   DE TWEEDE FACTOR GELDT OOK HIER (N19 van de V1-audit, besluit van de
   eigenaar). Deze deur gaf op e-mail en wachtwoord meteen een werksessie die
   aan het account hangt, ook als de tweede factor aanstond: de inlogpoort werd
   niet gevraagd en het pad stond niet in de inlogpauze. De eindkeuring van
   ronde 4 zag het zelf: /api/auth/login gaf voor dat lid een bewijs, deze deur
   een token, en met dat token opende /api/supplier/state.

   Nu dezelfde tweede stap als de gewone inlog, in de vorm van
   ../../techniek/inlog.js. Met de tweede factor aan geeft het wachtwoord alleen
   het antwoord van de inlogpoort: een kort bewijs met een EIGEN doel (`werk2`)
   en geen werksessie. Dezelfde route ruilt { bewijs, code } om. Een gewoon
   inlogbewijs (`inlog2`) werkt hier niet, en dit bewijs werkt niet bij
   /api/auth/tweede of de techniekpagina: elke deur munt haar eigen soort
   sessie, en een bewijs dat ook bij een andere deur geldt, is een weg om haar
   poorten heen. De rem op de code is de gedeelde
   (../../../kern/identiteit/tweedestap-rem.js), en het bewijs valt onder de
   sessiegrens (../../../accounts/sessiegrens.js): een wachtwoordwijziging
   tussen stap een en twee laat het vervallen.

   WAT PAS NA DE CODE GEBEURT. Of het lid nog actief is, wordt in stap twee
   opnieuw gelezen (het bewijs leeft vijf minuten). De werkplekken worden pas
   opgezocht als het lid bewezen is: met alleen het wachtwoord hoort niemand te
   horen of dit account ergens op het rooster staat, of bij RTG Kantoor mag.
   Een gevraagd bedrijf (`bedrijf`, deeplink of onthouden) reist met de tweede
   stap mee en telt alleen als het lid daar werkt. Zonder tweede factor
   verandert er niets.

   Afgesplitst uit ./posities.js toen de tweede stap erbij kwam. */
/* `werk` draagt de twee hulpjes van ./posities.js (posities en antwoord). Los
   van de context en niet uitgepakt: het zijn geen namen uit de kern, en naast
   de context uitgepakt zouden ze er wel zo uitzien, ook voor scripts/grenzen.js. */
module.exports = (ictx, werk) => {
  const { app, accounts, tooManyTries, noteFailedTry, loginFails, logActivity,
    heeftKantoor, tweefactor } = ictx;
  const rem = tweefactor && tweefactor.rem;
  /* Zonder inlogpoort zou deze deur stil terugvallen op een werksessie op
     alleen het wachtwoord, en dat is precies de fout. Liever niet starten
     (zelfde regel als ../../aanmeldgesprek.js en ../../techniek/inlog.js). */
  if (!tweefactor || typeof tweefactor.inlogPoort !== 'function' || !rem) {
    throw new Error('pda/posities-inlog: zonder tweefactor.inlogPoort en zijn rem kan deze deur de tweede factor niet vragen');
  }
  const DOEL = 'werk2';
  const ONJUIST = 'Onjuiste RTG-inloggegevens. Log in met uw eigen RTG-account.';

  /* Het lid is bewezen (wachtwoord, en zo nodig de code): zoek zijn
     werkplekken en munt de werksessie. Een weg voor beide stappen. */
  function land(req, res, lid, extra) {
    const posities = werk.posities(lid.id);
    if (!posities.length) {
      // geen zaak, wel kantoor: alleen de WEG terug, geen sessie (zie ../pda.js)
      if (heeftKantoor(lid.id)) {
        return res.status(404).json({ kantoor: true,
          error: 'U staat bij geen zaak op het rooster, maar uw account heeft wel toegang tot RTG Kantoor.' });
      }
      return res.status(404).json({ error: 'U staat nog nergens op het rooster. Vraag uw werkgever om een kassacode en meld u eenmalig aan.' });
    }
    // land op het gevraagde bedrijf (deeplink/onthouden), anders het eerste
    const voorkeur = String(req.body.bedrijf || '').toUpperCase();
    const start = posities.find(p => p.code === voorkeur) || posities[0];
    const antwoord = werk.antwoord(start, lid.id, posities);
    if (!antwoord.token) return res.status(401).json({ error: 'Uw persoonlijke RTG-account is niet meer actief.' });
    logActivity(start.code, { name: start.persoon }, start.persoon + ' logde in (RTG-account)');
    res.json(Object.assign(antwoord, extra || {}));
  }

  /* De tweede stap: het bewijs uit stap een plus een code. Een verkeerde code
     trekt het bewijs niet in (een typefout is geen nieuwe inlog waard); een
     goede wel, zodat het geen tweede keer werkt. */
  async function tweedeStap(req, res) {
    const lid = accounts.verifyActionToken(req.body.bewijs, DOEL);
    if (!lid) return res.status(401).json({ error: 'Deze inlogpoging is verlopen. Log opnieuw in.' });
    if (rem.dicht(res, lid.id, req.ip)) return;
    // voor de code: anders kost een uitgezet account nog een herstelcode
    if (accounts.isActief && !accounts.isActief(lid)) return res.status(401).json({ error: ONJUIST });
    const r = tweefactor.toets(lid, req.body.code);
    if (!r.ok) { rem.mis(lid.id, req.ip); return res.status(403).json({ error: r.error || 'Die code klopt niet.' }); }
    rem.gelukt(lid.id, req.ip);
    await accounts.trekInActie(req.body.bewijs, DOEL);
    if (accounts.wachtIntrekkingen) await accounts.wachtIntrekkingen();
    land(req, res, lid, Object.assign({}, r.let ? { let: r.let } : {}, r.soort ? { soort: r.soort } : {}));
  }

  app.post('/api/supplier/mijn/login', async (req, res) => {
    if (req.body && req.body.bewijs) return tweedeStap(req, res);
    const bucket = 'mijn:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    const lid = accounts.findByLogin(req.body.login);
    if (!lid || (accounts.isActief && !accounts.isActief(lid)) ||
        !(await accounts.verifyPassword(String(req.body.password || ''), lid.password_hash))) {
      noteFailedTry(bucket, req.ip);
      return res.status(401).json({ error: ONJUIST });
    }
    loginFails.delete(bucket);
    // de poort staat VOOR de werkplekken en de sessie: eronder was hij een mededeling
    const tweede = tweefactor.inlogPoort(lid, DOEL);
    if (tweede) return res.json(tweede);
    land(req, res, lid);
  });
};
