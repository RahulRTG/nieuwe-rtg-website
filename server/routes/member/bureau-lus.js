/* Member-submodule: de concierge-lus in Het Privékantoor (CONCIERGE.md). Een zin
   wordt een case, en het lid beslist over een voorstel -- niet over een wens.

   Een eigen bestand omdat ./bureau.js tegen de omvanggrens zat. Het krijgt de
   `doe` van ./bureau.js mee, zodat de pas-eis en het vangnet op EEN plek blijven
   staan: een poort die per bestand opnieuw wordt bedacht, staat er op een dag
   bij eentje niet. De logica woont in kern/bureau/lus*.js. */
module.exports = (kern, doe) => {
  const { app, auth } = kern;
  const B = kern.bureau;
  app.post('/api/member/bureau/lus/intake', auth, doe((k, b) => B.lusIntake(k, b)));
  app.post('/api/member/bureau/lus/zaak', auth, doe((k, b) => B.lusLid(k, String(b.id || ''))));
  app.post('/api/member/bureau/lus/toelichting', auth, doe((k, b) => B.lusToelichting(k, String(b.id || ''), b.tekst)));
  app.post('/api/member/bureau/lus/verrassing', auth, doe((k, b) => B.lusVerrassing(k, String(b.id || ''), b.aan === true)));
  app.post('/api/member/bureau/lus/beslis', auth, doe((k, b) => B.lusBeslis(k, String(b.id || ''), b.akkoord === true)));
};
