/* Staff (deelbestand): FLUISTER VOOR DE VLOER.

   Dezelfde persoonlijke assistent als bij de leden, met een eigen geheugen per
   personeelslid dat nooit met de werkgever wordt gedeeld. Apart van de rest van
   de dienstlaag (klokken, pauze, verlof, vertrouwenspersoon) omdat het een
   ander onderwerp is: dit stuk praat met een modelaanbieder en de rest niet --
   en juist daarom hoort de vraag "wat gaat er precies naar buiten" hier bij
   elkaar te staan.

   Afgesplitst uit dienst.js toen die de 10 KB passeerde. */
module.exports = (fctx) => {
  const { app, accounts, supplierAuth, stuurLus } = fctx;
  const { fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel } = fctx.fluister;

/* Fluister voor de vloer: dezelfde persoonlijke assistent, met een eigen
   geheugen per personeelslid (nooit gedeeld met de werkgever). */
const staffKey = req => 'staff:' + req.supplier.code + ':' + req.actor.staffId;
/* HOE RAHUL DIT PERSONEELSLID NOEMT -- EN DAT IS NIET BIJ NAAM.

   Hier ging req.actor.name mee, en die waarde reist woordelijk naar de
   modelaanbieder: een keer als "Lid: <naam>" in de context van fluisterZeg
   (kern/fluister/gesprek.js), en nog eens onversneden in de system prompt van
   de stuur-lus hieronder. Op precies die plek staat aan de ledenkant een
   CODENAAM (routes/member/persoonlijk.js geeft liveCodename mee) -- de
   parameter heet daar zelfs `codenaam`. Deze route deed dus alsof het om een
   pseudoniem ging terwijl er een persoonsnaam in stond.

   Die naam is bovendien vaak wel degelijk uit de kluis afkomstig: bij de
   zelfaanmelding vult routes/supplier/werving/personeel.js hem met
   accounts.realNameOf(lid).

   Rahul heeft de naam niet nodig om te helpen met een rooster, een pauze of
   een ziekmelding; hij heeft nodig WAT iemand doet. Vandaar een werk-aanduiding
   in plaats van een persoon. De naam blijft gewoon staan waar hij hoort: in het
   werkrooster, de klok en de activiteitenlog van de zaak zelf. */
const werkNaam = (req) => {
  const rol = req.actor.manager ? 'de manager' : 'een medewerker';
  /* De functie ("bediening", "keuken") maakt het antwoord bruikbaarder en zegt
     niets over WIE het is. Hij staat niet op req.actor -- dat draagt alleen
     name/role/staffId/manager -- dus even opzoeken; dat is een lookup op id in
     SQLite en geen omweg. Lukt het niet, dan is de rol alleen ook prima. */
  let func = null;
  try { const st = accounts.getStaffById(req.actor.staffId); func = st && st.func; } catch (e) {}
  return func ? rol + ' (' + String(func).slice(0, 40) + ')' : rol;
};
app.post('/api/staff/fluister', supplierAuth, async (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const r = await fluisterZeg(staffKey(req), werkNaam(req), req.body.q);
  if (r.error) return res.status(r.status).json({ error: r.error });
  /* Rahul aan het stuur op de PDA: pakten de eigen regels het gesprek niet
     op (pakte=false), dan mag hij het alsnog echt doen; alles wat dit
     personeelslid zelf op de PDA kan, met dezelfde inlog. Zonder
     AI-sleutel verandert er niets. */
  if (stuurLus && !r.pakte) {
    const lus = await stuurLus(req, {
      vraag: req.body.q,
      wereld: 'staff',
      filter: p => p.startsWith('/api/staff'),
      systeem: require('../../kern/rahul').RAHUL_LEAD +
        'Je helpt ' + werkNaam(req) + ' (personeel, PDA) bij ' + req.supplier.name + ' (' + req.supplier.type + ').'
    });
    if (lus && lus.tekst) return res.json({ antwoord: lus.tekst, gedaan: lus.acties.some(a => a.status < 400), stuur: lus.acties,
      goedkeuringen: lus.acties.filter(a => a.goedkeuring).map(a => a.goedkeuring), goedkeuringWereld: 'staff' });
  }
  res.json(r);
});
app.post('/api/staff/fluister/profiel', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json(fluisterProfiel(staffKey(req)));
});
app.post('/api/staff/fluister/vergeet', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const r = fluisterVergeet(staffKey(req), req.body.wat);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/staff/fluister/focus', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json(fluisterFocus(staffKey(req), req.body.scores));
});

};
