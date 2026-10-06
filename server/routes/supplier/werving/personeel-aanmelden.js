/* Supplier-werving (deelmodule): de medewerker meldt zich aan bij een zaak,
   POST /api/supplier/staff/join. Bedrijfsnaam + kassacode + eigen RTG-inlog.

   GEEN WACHTWOORDORAKEL (N29 van de V1-audit, besluit van de eigenaar). Hier
   werd het wachtwoord getoetst VOOR de bedrijfsnaam en de kassacode. Een goed
   wachtwoord met een verzonnen bedrijf gaf daardoor 404 ("We kennen geen
   bedrijf") en een fout wachtwoord 401: wie een e-mailadres had, kon hier
   wachtwoorden raden zonder ooit een uitnodiging te zien, en de remmen van de
   gewone inlog zagen er niets van. De 409 "al aangemeld" verraadde op dezelfde
   manier of een lid bij een genoemde zaak op het rooster staat.

   DE VOLGORDE, en elke weigering tot en met stap 3 is HETZELFDE antwoord:
     1. het bedrijf, en een kassacode die erbij hoort (het account nog niet);
     2. het account en het wachtwoord;
     3. de kassacode voor DIT lid: een geclaimde code hervat alleen voor wie hem
        claimde, en een uitgezet account komt er niet door;
     4. pas dan "al aangemeld", en de koppeling.
   Zonder geldige kassacode wordt het account dus niet eens opgezocht.

   DEZELFDE ACCOUNTEMMER ALS DE GEWONE INLOG. Met een geldige kassacode is een
   fout wachtwoord wel een gok, en die telt in de emmer op het doel van
   /api/auth/login (../../auth/inlog.js): dezelfde sleutel, dezelfde grens en
   dezelfde twee seconden per mislukte poging. Die vertraging geldt hier voor
   ELKE weigering zolang het account onder vuur ligt. Gold hij alleen bij een
   fout wachtwoord, dan verraadde juist het snelle antwoord in stap 3 een goed
   wachtwoord. Het pad staat in INLOG_PADEN (../../../middleware/remmen.js),
   dus de inlogpauze geldt hier ook.

   GEEN SESSIE, DUS GEEN TWEEDE STAP. Deze route koppelt het account aan de zaak
   en geeft geen token. Inloggen op de werkplek gaat daarna langs
   /api/supplier/mijn/login, met de tweede factor (N19). Dat de koppeling zelf
   geen tweede factor vraagt, is gemeld en met opzet niet veranderd.

   Afgesplitst uit ./personeel.js, dat in de band onder de grens stond. */
module.exports = (wctx, uitnodiging) => {
  const { kern } = wctx;
  const { accounts, app, crypto, loginFails, noteFailedTry, tooManyTries } = kern;
  /* kassacodeHoortBij wordt via `uitnodiging.` gelezen en niet uitgepakt: het is
     geen naam uit de kern, en uitgepakt telt scripts/grenzen.js hem wel zo. */
  const { findSupplierByName, verbindCode } = uitnodiging;
  const ONJUIST = 'Bedrijfsnaam, kassacode of RTG-inlog klopt niet. Controleer de gegevens van uw werkgever en meld u aan met uw eigen RTG-account.';
  const STUK = 'De aanmelding kon niet veilig worden voltooid. Probeer opnieuw.';
  // de emmer op het doel uit ../../auth/inlog.js: zelfde naam, zelfde hash
  const doelEmmer = login => 'auth:doel:' + crypto.createHash('sha256')
    .update('account:' + String(login || '').toLowerCase().trim()).digest('hex').slice(0, 24);

app.post('/api/supplier/staff/join', async (req, res) => {
  const bucket = 'join:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  const bedrijf = String(req.body.bedrijf || '').trim();
  const kassacode = String(req.body.kassacode || '').trim().toUpperCase();
  const legacyPin = !!(accounts.legacyStaffPinToegestaan && accounts.legacyStaffPinToegestaan());
  const gekozen = legacyPin ? String(req.body.pin || '').trim() : '';
  if (!bedrijf || !kassacode) { noteFailedTry(bucket, req.ip); return res.status(400).json({ error: 'Vul de bedrijfsnaam en de kassacode in.' }); }
  if (gekozen && !/^\d{4}$/.test(gekozen)) return res.status(400).json({ error: 'Een pincode is vier cijfers; laat hem leeg als u er geen wilt.' });
  const pin = legacyPin ? (gekozen || accounts.makePin()) : null;
  const doel = doelEmmer(req.body.login);
  // een weigering in stap 1 tot en met 3; `gok` alleen bij een fout wachtwoord
  async function onjuist(gok) {
    noteFailedTry(bucket, req.ip);
    if (gok) noteFailedTry(doel, req.ip, 25);
    const d = loginFails.get(doel);
    if (d && d.until > Date.now()) await new Promise(r => setTimeout(r, 2000));
    return res.status(401).json({ error: ONJUIST });
  }
  let s, lid;
  try {
    // 1) het bedrijf en zijn kassacode, nog zonder het account
    s = findSupplierByName(bedrijf);
    if (!s || !(await uitnodiging.kassacodeHoortBij(kassacode, s.code))) return onjuist(false);
    // 2) een eigen RTG-account (een betaalde pas is niet nodig)
    lid = accounts.findByLogin(req.body.login);
    if (!lid || !(await accounts.verifyPassword(String(req.body.password || ''), lid.password_hash))) return onjuist(true);
    // 3) de code voor dit lid, en een lid dat nog actief is
    if ((accounts.isActief && !accounts.isActief(lid)) ||
        !(await uitnodiging.kassacodeHoortBij(kassacode, s.code, lid))) return onjuist(false);
  } catch (e) { console.error('[staff-join] veilige verwerking mislukt'); return res.status(503).json({ error: STUK }); }
  loginFails.delete(doel);
  // 4) alles klopt: niet dubbel aanmelden bij hetzelfde bedrijf
  if (accounts.staffByMember(s.code, lid.id)) {
    return res.status(409).json({ error: 'U bent al aangemeld bij dit bedrijf. Log in met uw persoonlijke RTG-account.' });
  }
  loginFails.delete(bucket);
  let v;
  try { v = await verbindCode(lid, kassacode, legacyPin ? { pin } : {}, s.code); }
  catch (e) { console.error('[staff-join] veilige verwerking mislukt'); return res.status(503).json({ error: STUK }); }
  if (!v || v.error) { noteFailedTry(bucket, req.ip); return res.status(v && v.status || 403).json(v || { error: 'Ongeldige uitnodiging.' }); }
  res.json({ ok: true, code: s.code, staffId: v.staff.id, name: v.naam, role: v.invite.role });
});
};
