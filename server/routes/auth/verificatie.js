/* Auth (deelmodule): de identiteitsverificatie: paspoort-upload en selfie
   (versleuteld op schijf, map 0700/bestand 0600) en de statuscheck. Krijgt
   de gedeelde context een keer bij het opstarten vanuit routes/auth.js. */
module.exports = (actx) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN } = actx;
app.post('/api/verify/upload', express.json({ limit: '6mb' }), auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Verificatie is voor echte accounts.' });
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
  if (!m) return res.status(400).json({ error: 'Upload een foto (JPG, PNG of WebP) van de voorkant van uw paspoort.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Bestand te groot (max 5 MB).' });
  // Identiteitsbewijs: alleen de eigenaar van het proces mag erbij (map 0700, bestand 0600).
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(UPLOAD_DIR, 0o700); } catch (e) {}
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const fname = req.session.account.id + '-' + Date.now() + '.' + ext;
  // met RTG_ENC_KEY wordt het identiteitsbewijs versleuteld op schijf gezet
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), require('../../kluis').versleutelBuf(buf), { mode: 0o600 });
  accounts.setVerification(req.session.account.id, 'pending', fname);
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
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(UPLOAD_DIR, 0o700); } catch (e) {}
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const fname = req.session.account.id + '-selfie-' + Date.now() + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), require('../../kluis').versleutelBuf(buf), { mode: 0o600 });
  const md = accounts.getMemberState(req.session.account.id) || {};
  md.selfie = fname;
  accounts.saveMemberState(req.session.account.id, md);
  res.json({ ok: true });
});
};
