/* Auth (deelmodule): de identiteitsverificatie: paspoort-upload en selfie
   (versleuteld op schijf, map 0700/bestand 0600) en de statuscheck. Krijgt
   de gedeelde context een keer bij het opstarten vanuit routes/auth.js. */
module.exports = (actx) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN, antivirus } = actx;
  // de opruiming van de identiteitsmap (wezen, en alles bij vergetelheid)
  const identiteitsmap = require('../../identiteitsmap').maakIdentiteitsmap(UPLOAD_DIR);

  /* De Ontsmetter over elke geuploade buffer voordat hij de schijf raakt.
     Besmet -> weigeren (422) en melden; verdacht mag door (de mens beoordeelt
     het bewijs toch met de hand), maar staat wel op het boardroom-bord. */
  function malwareVrij(buf, req, res, naam, soort) {
    if (!antivirus) return true;
    const mime = 'image/' + (soort === 'jpeg' ? 'jpeg' : soort);
    const r = antivirus.verwerk(buf, { naam: naam, mime: mime, bron: req.ip });
    if (r.verdict === 'besmet') {
      res.status(422).json({ error: 'Dit bestand is geweigerd door de beveiliging (mogelijke malware). Upload een echte foto.' });
      return false;
    }
    return true;
  }
app.post('/api/verify/upload', express.json({ limit: '6mb' }), auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Verificatie is voor echte accounts.' });
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
  if (!m) return res.status(400).json({ error: 'Upload een foto (JPG, PNG of WebP) van de voorkant van uw paspoort.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Bestand te groot (max 5 MB).' });
  if (!malwareVrij(buf, req, res, 'paspoort.' + (m[1] === 'jpeg' ? 'jpg' : m[1]), m[1])) return;
  // Identiteitsbewijs: alleen de eigenaar van het proces mag erbij (map 0700, bestand 0600).
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(UPLOAD_DIR, 0o700); } catch (e) {}
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const fname = req.session.account.id + '-' + Date.now() + '.' + ext;
  // met RTG_ENC_KEY wordt het identiteitsbewijs versleuteld op schijf gezet
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), require('../../kluis').versleutelBestand(buf, fname), { mode: 0o600 });
  accounts.setVerification(req.session.account.id, 'pending', fname);
  /* En het VORIGE bewijs weg. Elke upload schreef een nieuw bestand met een
     tijdstempel, maar de database onthoudt er maar een (id_doc wordt
     overschreven) -- dus bleven eerdere pogingen als wees achter, voorgoed en
     gewoon opvraagbaar via /api/office/doc. Juist hier stapelt dat op: de
     afwijzingsmail raadt letterlijk aan het opnieuw te proberen met een
     duidelijkere foto. Na het schrijven, zodat een mislukte schrijfactie niet
     ook het oude bewijs kost. Zie server/identiteitsmap.js. */
  identiteitsmap.houdAlleenBewijs(req.session.account.id, fname);
  res.json({ ok: true, status: 'pending' });
});

app.post('/api/verify/status', auth, (req, res) => {
  res.json({ status: req.session.account ? req.session.account.verified : 'n/a' });
});

/* Een selfie voor de gezichtscontrole (selfie x paspoort). RTG matcht die bij de
   beoordeling, zodat we zeker weten dat het paspoort bij de codenaam en bij de
   persoon hoort. Versleuteld op schijf, net als het identiteitsbewijs. */
app.post('/api/verify/selfie', express.json({ limit: '6mb' }), auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Verificatie is voor echte accounts.' });
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
  if (!m) return res.status(400).json({ error: 'Neem een duidelijke selfie (JPG, PNG of WebP).' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Bestand te groot (max 5 MB).' });
  if (!malwareVrij(buf, req, res, 'selfie.' + (m[1] === 'jpeg' ? 'jpg' : m[1]), m[1])) return;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(UPLOAD_DIR, 0o700); } catch (e) {}
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const fname = req.session.account.id + '-selfie-' + Date.now() + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), require('../../kluis').versleutelBestand(buf, fname), { mode: 0o600 });
  const md = accounts.getMemberState(req.session.account.id) || {};
  md.selfie = fname;
  accounts.saveMemberState(req.session.account.id, md);
  identiteitsmap.houdAlleenSelfie(req.session.account.id, fname);  // idem als hierboven
  res.json({ ok: true });
});
};
