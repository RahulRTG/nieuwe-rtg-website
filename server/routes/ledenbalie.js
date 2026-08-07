/* De ledenbalie: het loket waar RTG een lid helpt met een klacht, zijn
   abonnement of een vergeten wachtwoord. Alles achter deze deur raakt een
   ACCOUNT, en juist daarom heeft de balie een eigen poort gekregen.

   WAAROM DE KANTOORCODE HIER NIET VOLSTAAT. Het RTG-kantoor is een ongedeelde
   ruimte die men binnenkomt met een code die iedereen kent. Zo'n code wijst
   niemand aan: er staat later nergens wie het wachtwoord van dit lid liet
   herstellen of wie zijn pas ter sprake bracht. De boardroom voerde diezelfde
   redenering al (server/kern/kantoor/index.js) en kreeg een poort op
   IDENTITEIT. De balie krijgt de derde in dezelfde stijl: een zetel op naam,
   door de eigenaar uitgedeeld, gekoppeld aan een echte inlog.

   WAT HIER NIET GEBEURT, en waarom het oordeel daarover in de kern zit en niet
   in deze routes:
   - geen naam, e-mailadres, telefoonnummer of document in enig antwoord; de
     balie werkt op codenamen, de echte gegevens blijven in de kluis;
   - geen wachtwoord zetten: het herstel zet de BESTAANDE stroom in gang naar
     het adres van het lid zelf, dat de balie niet te zien krijgt;
   - geen pas toekennen: een voorstel voor Lifestyle of Business blijft een
     voorstel; het besluit is een mens, via /api/aanmelding/beslis.
   Deze routes reiken de vraag aan en geven het antwoord van de kern door. Een
   tweede oordeel hier zou op den duur van het eerste gaan afwijken, en dan is
   niet meer te zeggen welke van de twee de regel is. */
module.exports = (kern) => {
  const { app, officeAuth, boardroomAuth, boardroomWie, magBalie,
          balieZetels, balieZetelZet, balieZetelWeg, balieZoek, balieDossier,
          balieHerstel, balieKlachtOpen, balieKlachtStatus, balieAboVoorstel } = kern;

  /* Elk antwoord loopt door dezelfde omhulling. Hij wacht op een belofte, want
     het herstel zet e-mail en sms in gang en hoeft niet synchroon te zijn. Een
     status uit de kern wint; anders 200. De fout gaat naar het serverlogboek en
     nooit naar de client: die krijgt een zin waar hij iets aan heeft. */
  const veilig = async (res, werk) => {
    try { const r = await werk(); res.status(r && r.status ? r.status : 200).json(r); }
    catch (e) { console.error('[ledenbalie]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const lijf = (req) => req.body || {};
  const kort = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  // een id mag een getal zijn en blijft dat dan ook; een string kappen we af
  const ident = (v) => (typeof v === 'number' ? v : kort(v, 64));

  /* De deur van de balie bestaat uit drie grendels, in deze volgorde:
     1) officeAuth   -- er moet een kantoorsessie zijn;
     2) boardroomWie -- welke MENS zit daarachter? Bij de kale gedeelde code is
        dat niemand, en null is dan het eerlijke antwoord;
     3) magBalie     -- heeft die mens een zetel (de boardroom altijd).

     De eerste staat als aparte poortwachter in elke routeregel en de andere
     twee zitten hier in balieAuth. Dat is bewust niet in een omhulling gepropt:
     in de routeregel zelf hoort te staan waar hij achter hangt, zodat een lezer
     (en de keuring die de poorten natelt) het ziet zonder eerst een wikkel open
     te vouwen. balieAuth valt overigens ook zonder buurman veilig terug: zonder
     geldig token wijst boardroomWie niemand aan en is er dus geen zetel.

     De weigering noemt de reden. "Geen toegang" laat een medewerker met een
     geldige kantoorcode raden wat hij verkeerd doet, terwijl het antwoord juist
     iets uitlegt dat hij moet weten: deze handelingen dragen een naam. */
  function balieAuth(req, res, next) {
    const key = boardroomWie(req);
    if (!magBalie(key)) {
      return res.status(403).json({ error: 'De ledenbalie vraagt een zetel op naam. De gedeelde kantoorcode opent wel de ruimte, maar wijst niemand aan, en werk aan het account van een lid hoort herleidbaar te zijn tot een mens. Meldt u zich aan met het eigen RTG-account; de eigenaar deelt de zetels aan de balie uit.' });
    }
    req.balieKey = key;
    next();
  }

  /* Zoeken op codenaam of steuncode. De sleutel van de baliemedewerker gaat
     mee, want elke raadpleging komt in het inzagejournaal te staan; zonder die
     sleutel staat daar straks een regel zonder mens erbij, en dat is een spoor
     dat nergens heen leidt. */
  app.post('/api/office/balie/zoek', officeAuth, balieAuth, (req, res) => veilig(res, () => balieZoek({
    codenaam: kort(lijf(req).codenaam, 120),
    steuncode: kort(lijf(req).steuncode, 120),
    door: req.balieKey
  })));

  /* Het dossier: codenaam, pas, land, stad, lid sinds, abo-stand en de open
     klachten. Verder niets, hoe hard iemand ook klikt. Een reden is verplicht;
     de kern beoordeelt of die reden iets zegt, in dezelfde lijn als de
     identiteitsopvraag bij payroll, zodat er een norm is en geen twee. */
  app.post('/api/office/balie/dossier', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    balieDossier(ident(lijf(req).id), { door: req.balieKey, reden: kort(lijf(req).reden, 500) })));

  /* Herstel aanzetten. De balie zet geen wachtwoord en ziet het adres niet: dit
     trapt de bestaande herstelstroom af (/api/auth/forgot) naar het lid zelf,
     met de code over het tweede kanaal. Het lid houdt zijn eigen sleutel; de
     balie duwt hoogstens de envelop op de bus. */
  app.post('/api/office/balie/herstel', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    balieHerstel(ident(lijf(req).id), { door: req.balieKey, reden: kort(lijf(req).reden, 500) })));

  // een klacht vastleggen, en later de stand ervan bijwerken
  app.post('/api/office/balie/klacht', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    balieKlachtOpen(ident(lijf(req).id), { door: req.balieKey, tekst: kort(lijf(req).tekst, 4000), soort: kort(lijf(req).soort, 40) })));
  app.post('/api/office/balie/klacht/status', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    balieKlachtStatus(ident(lijf(req).klachtId), kort(lijf(req).status, 40), { door: req.balieKey })));

  /* Een abonnementsvoorstel. Richting Lifestyle of Business LEGT DIT ALLEEN EEN
     VOORSTEL VAST en verleent het niets: die passen gaan uitsluitend via een
     menselijk besluit (/api/aanmelding/beslis). De kern weigert het toekennen
     zelf, zodat deze route het niet kan omzeilen door zich te vergissen. */
  app.post('/api/office/balie/abo', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    balieAboVoorstel(ident(lijf(req).id), { door: req.balieKey, naarPas: kort(lijf(req).naarPas, 40), reden: kort(lijf(req).reden, 500) })));

  /* De zetels zelf: wie er aan de balie mag staan. Dat is bestuurswerk en gaat
     dus door de boardroomdeur. `baas` gaat mee omdat het scherm moet weten of
     het de knoppen hoort te tonen: de sleutel van de kamer krijgen is niet
     hetzelfde als de eigenaar zijn. De lijst draagt sleutels en sinds-wanneer,
     geen namen; die blijven waar ze horen. */
  app.post('/api/office/balie/zetels', boardroomAuth, (req, res) => veilig(res, () =>
    ({ ok: true, baas: !!req.boardroomBaas, zetels: balieZetels() })));
  app.post('/api/office/balie/zetel', boardroomAuth, (req, res) => veilig(res, () => {
    const key = kort(lijf(req).key, 120);
    if (!key) return { status: 400, error: 'Geef de sleutel van het lid dat de zetel krijgt of verliest.' };
    const weg = lijf(req).weg === true || kort(lijf(req).actie, 20) === 'weg';
    const r = weg ? balieZetelWeg(key) : balieZetelZet(key);
    // de verse lijst gaat mee terug: het scherm werkt erop, en een tweede ronde
    // langs de server zou het beeld alleen maar even uit de pas laten lopen
    return (r && r.error) ? r : Object.assign({}, r, { zetels: balieZetels() });
  }));
};
