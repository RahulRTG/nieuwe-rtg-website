/* PDA (deelmodule): werkplekken: wisselen tussen verbonden zaken (dubbele
   accreditatie) en het eenmalige inloggen met alle posities van een
   personeelslid. netState komt via de context binnen nadat
   routes/supplier/pda.js de netwerklaag heeft gemount. */
module.exports = (kctx) => {
  const { accounts, anthropic, app, crypto, db, findSupplier, logActivity, loginFails, managerOnly, noteFailedTry, notifySupplier, rememberSession, save, schoon, sseToSupplier, supplierAuth, supplierState, tooManyTries, orderMetRef, ordersVanZaak } = kctx;
  const { netState, netPaar, netLink } = kctx;

/* Ingeklokt en geaccrediteerd: een personeelslid dat OOK op het rooster van een
   verbonden zaak staat, wisselt van afdeling zonder nieuwe PIN. De PIN is bij
   het inloggen al bewezen; de accreditatie is dubbel: de zaken zijn verbonden
   in het personeelsnetwerk EN de manager van de andere zaak heeft de persoon
   zelf in het team gezet.

   "DEZELFDE PERSOON" WAS HIER "DEZELFDE WEERGAVENAAM", EN DAT IS GEEN IDENTITEIT.

   De naam op een personeelskaart is vrije tekst die de manager van die zaak
   zelf intikt. Stond er bij een verbonden zaak een manager met dezelfde naam,
   dan wisselde je daarheen en kreeg je zijn rol -- inclusief manager: true.
   Erger nog: de manager van de EIGEN zaak mag namen aanpassen, dus die kon een
   medewerker hernoemen naar de naam van een manager bij de buren en hem zo aan
   rechten helpen die hij daar niet heeft. En zonder enige kwade wil botsen
   twee Jan de Vries'en bij twee verbonden zaken gewoon met elkaar.

   De echte identiteit ligt er al: member_id, de koppeling aan het ene
   RTG-account (dezelfde die staffPositions gebruikt voor "1x aanmelden"
   hieronder). Daarop matchen we nu.

   Personeel ZONDER gekoppeld RTG-account kan dus niet meer wisselen. Dat is
   geen verlies maar de kern: zonder identiteit valt niet te bewijzen dat het
   dezelfde persoon is, en dan hoort er geen sessie bij een andere zaak uit te
   komen. Zo iemand logt gewoon met zijn eigen PIN in bij de andere zaak. */
function ikBij(code, staffId) {
  const ik = accounts.listStaff(code).find(m => m.id === staffId);
  return (ik && ik.member_id != null) ? ik : null;
}
function wisselDoelen(code, staffId) {
  const ik = ikBij(code, staffId);
  if (!ik) return [];
  return netState().links
    .filter(l => l.status === 'akkoord' && (l.a === code || l.b === code))
    .map(l => (l.a === code ? l.b : l.a))
    .filter(ander => accounts.listStaff(ander).some(m => m.member_id === ik.member_id));
}
app.post('/api/supplier/wissel/opties', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.json({ opties: [] });
  res.json({ opties: wisselDoelen(req.supplier.code, req.actor.staffId).map(code => {
    const s = findSupplier(code);
    return { code, naam: s ? s.name : code, type: s ? s.type : '' };
  }) });
});
app.post('/api/supplier/wissel', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen personeel wisselt van afdeling; log in op uw eigen naam.' });
  const doel = findSupplier(req.body.code);
  if (!doel) return res.status(404).json({ error: 'Dit bedrijf kennen we niet.' });
  if (doel.code === req.supplier.code) return res.status(400).json({ error: 'U bent hier al.' });
  if (!wisselDoelen(req.supplier.code, req.actor.staffId).includes(doel.code)) {
    return res.status(403).json({ error: 'U bent daar niet geaccrediteerd: de zaken moeten verbonden zijn en de manager moet u in het team hebben gezet.' });
  }
  const ik = ikBij(req.supplier.code, req.actor.staffId);
  // wisselDoelen hierboven heeft dit al bewezen; deze twee regels zijn de
  // vangnetten voor het geval iemand ooit een derde weg naar hier maakt
  if (!ik) return res.status(403).json({ error: 'Wisselen vraagt een personeelskaart die aan uw RTG-account gekoppeld is.' });
  const daar = accounts.listStaff(doel.code).find(m => m.member_id === ik.member_id);
  if (!daar) return res.status(403).json({ error: 'U staat daar niet op het rooster.' });
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'supplier', code: doel.code, actor: daar.name, staffId: daar.id, staffRole: daar.role, manager: daar.role === 'manager' });
  logActivity(doel.code, { name: daar.name }, daar.name + ' wisselde van afdeling (vanuit ' + req.supplier.name + ')');
  res.json({ token, supplier: { code: doel.code, name: doel.name } });
});

/* ============================================================================
   1x aanmelden: het personeelslid logt één keer in met het eigen RTG-account
   (e-mail + wachtwoord) en komt meteen op de juiste bedrijfspagina. Wie bij
   meer bedrijven op het rooster staat, ziet die allemaal als werkplek en wisselt
   met één tik, zonder opnieuw in te loggen. Inklokken blijft een eigen, aparte
   druk op de knop: inloggen zet je nooit automatisch aan het werk.
   ========================================================================== */
function mijnPosities(memberId) {
  return accounts.staffPositions(memberId).map(st => {
    const s = findSupplier(st.supplier_code);
    if (!s) return null; // alleen bestaande bedrijven
    return { code: s.code, naam: s.name, type: s.type, staffId: st.id, persoon: st.name,
      role: st.role, func: st.func || null, manager: st.role === 'manager' };
  }).filter(Boolean);
}
function staffSessie(pos, memberId) {
  const token = crypto.randomBytes(24).toString('hex');
  rememberSession(token, { role: 'supplier', code: pos.code, actor: pos.persoon,
    staffId: pos.staffId, staffRole: pos.role, manager: pos.manager, lid: memberId });
  return token;
}
function posantwoord(pos, memberId, posities) {
  const s = findSupplier(pos.code);
  const actor = { name: pos.persoon, role: pos.role, staffId: pos.staffId, manager: pos.manager };
  return { token: staffSessie(pos, memberId), supplier: { code: s.code, name: s.name, type: s.type },
    actor, posities, state: supplierState(s, actor) };
}
app.post('/api/supplier/mijn/login', async (req, res) => {
  const bucket = 'mijn:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  const lid = accounts.findByLogin(req.body.login);
  if (!lid || !(await accounts.verifyPassword(String(req.body.password || ''), lid.password_hash))) {
    noteFailedTry(bucket);
    return res.status(401).json({ error: 'Onjuiste RTG-inloggegevens. Log in met uw eigen RTG-account.' });
  }
  loginFails.delete(bucket);
  const posities = mijnPosities(lid.id);
  if (!posities.length) {
    return res.status(404).json({ error: 'U staat nog nergens op het rooster. Vraag uw werkgever om een kassacode en meld u eenmalig aan.' });
  }
  // land op het gevraagde bedrijf (deeplink/onthouden), anders het eerste
  const voorkeur = String(req.body.bedrijf || '').toUpperCase();
  const start = posities.find(p => p.code === voorkeur) || posities[0];
  logActivity(start.code, { name: start.persoon }, start.persoon + ' logde in (RTG-account)');
  res.json(posantwoord(start, lid.id, posities));
});
// De eigen werkplekken opnieuw ophalen (na herstel van de sessie), zodat de
// wissel-kaart ook zonder verse login weet welke bedrijven er zijn.
app.post('/api/supplier/mijn/opties', supplierAuth, (req, res) => {
  if (!req.actor.lid) return res.json({ posities: [] });
  res.json({ posities: mijnPosities(req.actor.lid), hier: req.supplier.code });
});
// Wisselen naar een andere eigen werkplek: alleen bedrijven waar dit RTG-lid zelf
// op het rooster staat. De accreditatie is de eigen aanmelding bij dat bedrijf.
app.post('/api/supplier/mijn/wissel', supplierAuth, (req, res) => {
  if (!req.actor.lid) return res.status(403).json({ error: 'Log in met uw RTG-account om te kunnen wisselen tussen uw bedrijven.' });
  const posities = mijnPosities(req.actor.lid);
  const doel = posities.find(p => p.code === String(req.body.code || '').toUpperCase());
  if (!doel) return res.status(403).json({ error: 'U werkt daar niet, of het bedrijf bestaat niet meer.' });
  if (doel.code === req.supplier.code) return res.status(400).json({ error: 'U bent hier al.' });
  logActivity(doel.code, { name: doel.persoon }, doel.persoon + ' wisselde naar deze werkplek');
  res.json(posantwoord(doel, req.actor.lid, posities));
});
};
