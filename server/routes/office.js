/* Domein "office" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { accounts, eigenaar, sessionFor } = kern;

  // backoffice-toegang via een query-token (stream/export/doc): een echte
  // office-sessie, OF de eigenaar met zijn eigen accountlogin.
  const officeQueryMag = (token) => {
    const sess = sessionFor(String(token || ''));
    if (sess && sess.role === 'office') return true;
    try { return eigenaar.isEigenaar(accounts, accounts.verifyToken(String(token || ''))); } catch (e) { return false; }
  };

  /* De vier domeindelen draaien als submodules op de gedeelde kern plus de
     query-toegangshelper, een keer gemount bij het opstarten. */
  const octx = { kern, officeQueryMag };
  require('./office/veiligheid')(octx);
  require('./office/partners')(octx);
  require('./office/ondernemers')(octx);   // de ondernemerskant: regie, rechtsvormwacht, catalogus-wensen
  require('./office/instellingen')(octx);  // gemeente, luchthaven, OV en de andere interne genres aansluiten
  require('./office/toegang')(octx);
  require('./office/werk')(octx);
  require('./office/bewaarverzoek')(octx);
  require('./office/concierge')(octx);
  /* THE TABLE: het kantoor stelt een tafel samen op codenaam. Curatie is
     mensenwerk en dit is de enige plek waar een tafel ontstaat; zie
     ./office/rendezvous.js en ONTMOETEN.md.

     DEZE REGEL WAS BIJ DE SAMENVOEGING WEGGEVALLEN. Het bestand stond er nog,
     de kern eronder ook, en alle drie zijn adressen gaven 404 -- "Onbekend
     eindpunt". Vier toetsen in test/rendezvous.test.js zakten daarop, en geen
     enkele meting zag het: een module die niemand inlaadt heeft geen dekking
     om te verliezen. Gevonden door de routes die de BRON noemt te vergelijken
     met de routes die de ROUTER registreert (test/magnaat-capabilities.test.js
     doet dat al voor de andere kant van hetzelfde gat). */
  require('./office/rendezvous')(octx);
  /* De routedekking: welke routes dit huis heeft en of ze beproefd zijn, voor
     het personeel na te kijken in plaats van alleen in een terminal. Zie
     ./office/dekking.js. */
  require('./office/dekking')(octx);
  /* Het routedossier: dezelfde routes, maar dan wat we er over ELF schakels van
     weten. De dekking zegt of een route is aangeraakt; dit zegt of hij dicht
     zit, rommel weigert en een spoor achterlaat. Zie ./office/dossier.js. */
  require('./office/dossier')(octx);
  /* Het platformregister: van elk ding in dit huis wat het is, wat het doet, of
     het aan staat en wat we ervan weten. Vier soorten op een rij. Zie
     ./office/register.js. */
  require('./office/register')(octx);
  /* De ledenbalie: de derde poort van het kantoor. Zie ./office/balie.js. */
  /* De ledenbalie hangt in server/routes/ledenbalie.js, met een eigen zetel en
     een eigen kern (kern/ledenbalie*.js). Hier stond een TWEEDE balie uit een
     andere tak die dezelfde routes registreerde -- en dan wint de eerste stil
     terwijl de rest dode code is. scripts/check.js ving dat. Een deur per
     kamer. */
};
