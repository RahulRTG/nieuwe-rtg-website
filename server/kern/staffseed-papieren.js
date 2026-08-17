/* De PAPIEREN van het demopersoneel: de demowereld in orde brengen.

   WAAROM DIT ER IS. Sinds kern/persoonseis.js vraagt een kinderopvang, een
   praktijk, een korps of een beveiligingsbedrijf iets van de MENS die er werkt:
   een vastgestelde identiteit, en soms een VOG, een BIG-registratie of een
   legitimatiebewijs. Het demopersoneel had dat allemaal niet -- het bestond uit
   losse personeelsrijen zonder eigen RTG-account, want zo is de demo ooit
   begonnen.

   ER WAREN TWEE UITWEGEN EN EEN ERVAN DEUGT NIET. De verleiding is om de eis in
   demostand over te slaan. Dat is precies de vorm die dit huis niet wil: een
   poort met een uitzondering die nergens zichtbaar is, en een demo die
   VOORDOET dat een kinderopvang werkt zonder dat iemand papieren heeft. Wie de
   app leert kennen in de demo, leert hem dan verkeerd.

   Dus de andere: de demowereld wordt een wereld die in orde IS. Elk
   demopersoneelslid in zo'n genre krijgt een eigen (demo)account met een
   vastgestelde identiteit, en de stukken die zijn genre vraagt -- ingediend en
   afgetekend, net als bij een echte partner.

   WIE WAT KRIJGT, EN WAAROM DAT VERSCHILT. De manager krijgt ook de stukken die
   bij de HANDELINGEN horen (voorschrijven, verwijzen, uitreiken); het
   vloerpersoneel krijgt alleen wat het WERK vraagt. Zo laat de demo meteen zien
   waar deze hele laag om draait: de assistente van de huisarts werkt gewoon en
   kan alles behalve een recept uitschrijven. Zou iedereen alles krijgen, dan was
   de demo weer een wereld zonder verschil -- en dan zie je de poort nooit.

   ALLEEN IN DEMOSTAND. In productie komt personeel binnen via een uitnodiging
   op zijn eigen RTG-account (routes/werving.js) en levert het zijn stukken zelf
   in (routes/vakbewijs.js). Daar zaait niemand papieren. */
'use strict';

const { EISEN } = require('./persoonseis');

/* Een demo-e-mailadres dat bij deze ene persoon hoort en bij elke start
   hetzelfde is. Zonder die vastigheid maakt elke herstart een nieuw account en
   loopt de demo vol met wezen. */
const adresVan = (code, naam) =>
  (String(naam).toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') || 'werker') +
  '.' + String(code).toLowerCase() + '@rtg.example';

/* De stukken die dit genre van deze rol vraagt. De handeling-stukken gaan naar
   de manager; het werk-stuk naar iedereen. `identiteit` staat er NIET bij: die
   komt niet uit deze la maar uit de verificatie, en die wordt hieronder op het
   account zelf gezet. */
function stukkenVoor(genre, rol) {
  const eis = EISEN[genre];
  if (!eis) return [];
  const uit = new Set((eis.werk || []).filter(s => s !== 'identiteit'));
  if (rol === 'manager') {
    for (const soorten of Object.values(eis.handelingen || {})) for (const s of soorten) uit.add(s);
  }
  return [...uit];
}

/* Zet de papieren van een hele demowereld klaar. Idempotent: bestaat het
   account al, dan wordt het niet opnieuw gemaakt, en een al afgetekend stuk
   blijft staan zoals het staat. */
function zaaiPapieren({ db, save, accounts, findSupplier, log }) {
  const vakbewijs = require('./vakbewijs')({ db, save,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200) });
  let accountsGemaakt = 0, stukkenGezet = 0;

  for (const s of db.data.suppliers || []) {
    if (!EISEN[s.type]) continue;
    let ploeg = [];
    try { ploeg = accounts.listStaff(s.code) || []; } catch (e) { continue; }
    for (const st of ploeg) {
      let lid = st.member_id != null ? Number(st.member_id) : null;
      if (lid == null) {
        const email = adresVan(s.code, st.name);
        try {
          let u = accounts.findByLogin(email);
          if (!u) {
            u = accounts.createUserSync({ username: email.split('@')[0], email,
              password: process.env.DEMO_STAFF_PASS || 'werk', tier: 'rtg', realName: st.name });
            accountsGemaakt++;
          }
          /* De identiteit is VASTGESTELD, want dat is wat het genre vraagt. In de
             demo doen we dat hier; in het echt komt hij uit de KYC-stroom met een
             mens die het document heeft gezien. */
          accounts.setVerification(u.id, 'verified');
          accounts.setStaffMember(st.id, u.id, u.tier);
          lid = u.id;
        } catch (e) { continue; }   // een demo-account is nooit reden om de start te breken
      }
      const sleutel = vakbewijs.sleutelLid(lid);
      for (const soort of stukkenVoor(s.type, st.role)) {
        const heeft = vakbewijs.vakbewijsHeeft(sleutel, soort, { aftekening: true });
        if (heeft.ok) continue;
        vakbewijs.vakbewijsZet(sleutel, { wat: soort, nummer: 'DEMO-' + st.id,
          tot: '2030-01-01', toelichting: 'Demogegeven; in het echt levert de mens dit zelf in.' });
        vakbewijs.vakbewijsTeken(sleutel, soort, 'RTG (demoseed)');
        stukkenGezet++;
      }
    }
  }
  if ((accountsGemaakt || stukkenGezet) && log) {
    log.info('[demo] papieren gezaaid', { accounts: accountsGemaakt, stukken: stukkenGezet });
  }
  return { accountsGemaakt, stukkenGezet };
}

module.exports = { zaaiPapieren, stukkenVoor, adresVan };
