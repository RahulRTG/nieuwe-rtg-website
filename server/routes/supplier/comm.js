/* ========= De zakelijke kant van het communicatieplatform =========

   Dezelfde kern, dezelfde gesprekken, andere deur. Een lid komt binnen via
   routes/member/comm.js met zijn ledensleutel; een zaak komt hier binnen met
   de sleutel die uit haar SESSIE volgt (kern/comm/wie.js). Er staat hier geen
   tweede berichtenmodel, geen tweede leesstand en geen tweede zoekfunctie --
   dat was nu juist wat de kern ophief.

   DE ENE REGEL WAAR ALLES OP RUST: de sleutel wordt AFGELEID, nooit
   aangeleverd. supplierAuth heeft de sessie al gelezen en zet req.supplier en
   req.actor; wie() maakt daar 'zaak:AB12' en eventueel 'mens:AB12:7' van. Er
   is met opzet geen enkele parameter waarin een verzoek kan zeggen wie het is.
   Zou die er wel zijn, dan zou een leverancier de sleutel van een lid kunnen
   invullen en meelezen in een gesprek tussen twee mensen die hem niet kennen.

   TWEE SLEUTELS, EN DAT IS HET HELE VERSCHIL tussen een gedeelde inbox en
   eigen berichten:

     zaak:AB12     de gedeelde inbox van het bedrijf. Een bestelling is van de
                   zaak, niet van wie er die dag staat; iedereen met een
                   zaaklogin hoort de klant te kunnen helpen.
     mens:AB12:7   de eigen gesprekken van een medewerker (collega tegen
                   collega). Die deelt het team juist NIET, en daarom staat de
                   zaaksleutel niet in zo'n gesprek.

   Welke van de twee er geldt, bepaalt niet het verzoek maar het GESPREK: in
   welke van beide zit deze deelnemer? Staat er geen van beide in, dan is het
   antwoord van de kern het antwoord van deze route -- dit gesprek is niet van
   jou. */
'use strict';
const wie = require('../../kern/comm/wie');
const { veiligeFout } = require('../../kern/util');

module.exports = (kern) => {
  const { app, accounts, comm, supplierAuth } = kern;
  if (!comm) return;
  const fout = (res, e) => res.status(400).json({ error: veiligeFout(e) });

  /* Wie deze sessie is. Geen zaak in de sessie is geen actor -- en dan is er
     niets om mee te proberen. */
  function actor(req, res) {
    const a = wie.vanZaak(req);
    if (!a) { res.status(401).json({ error: 'Geen zaak in deze sessie.' }); return null; }
    return a;
  }

  /* Onder WELKE sleutel dit gesprek van jou is. In de praktijk staat er een
     van de twee in een gesprek -- een gedeelde zaakinbox en een collega-DM
     zijn verschillende dingen -- maar niets in de kern verbiedt allebei, en
     een route hoort niet te leunen op wat er meestal staat. De volgorde van
     `alle` beslist dus, en die is met opzet zaak-eerst: staat de zaak erin,
     dan is het gesprek van het bedrijf en hoort het antwoord ook van het
     bedrijf te komen.

     Geen van beide is een weigering, en die weigering komt van de kern zelf
     zodat er maar een plek is waar dat antwoord wordt geformuleerd. */
  function alsWie(a, gesprekId) {
    const g = comm.gesprekVan(String(gesprekId || ''));
    const sleutel = g && a.alle.find((s) => comm.magErin(g, s));
    if (!sleutel) throw new Error(g ? 'Dit gesprek is niet van jou.' : 'Dit gesprek bestaat niet.');
    return sleutel;
  }

  /* De inbox van de zaak EN de eigen gesprekken in een lijst. Twee aanroepen
     van dezelfde kern en geen samengevoegde query: de kern kent een deelnemer,
     niet een verzameling deelnemers, en die grens hier oprekken zou betekenen
     dat magErin() ergens een lijst moet accepteren. Dat is precies de poort
     die smal hoort te blijven. */
  app.post('/api/supplier/comm/inbox', supplierAuth, (req, res) => {
    const a = actor(req, res); if (!a) return;
    try {
      const uit = [];
      for (const sleutel of a.alle) {
        comm.levensteken(sleutel);
        for (const g of comm.inbox(sleutel, { lade: req.body.lade, archief: !!req.body.archief }).gesprekken) {
          /* De twee eigen velden staan ACHTERAAN: kwam er ooit een `alsWie` of
             `gedeeld` uit de kern, dan hoort de route te winnen -- dit is wat
             zij weet en de kern niet. */
          uit.push(Object.assign({}, g, { alsWie: sleutel, gedeeld: sleutel === a.zaak }));
        }
      }
      uit.sort((x, y) => (y.vast ? 1 : 0) - (x.vast ? 1 : 0) ||
        String(y.at || '').localeCompare(String(x.at || '')));
      res.json({ ok: true, gesprekken: uit, laden: comm.LADEN,
        ongelezen: uit.reduce((n, g) => n + (g.ongelezen || 0), 0) });
    } catch (e) { fout(res, e); }
  });

  app.post('/api/supplier/comm/gesprek', supplierAuth, (req, res) => {
    const a = actor(req, res); if (!a) return;
    try {
      const sleutel = alsWie(a, req.body.id);
      comm.levensteken(sleutel);
      res.json({ ok: true, alsWie: sleutel, gedeeld: sleutel === a.zaak,
        gesprek: comm.gesprek(sleutel, req.body.id, { aantal: req.body.aantal }) });
    } catch (e) { fout(res, e); }
  });

  /* Versturen. In een gesprek van de ZAAK schrijft de zaak, met de medewerker
     in `door`: de klant ziet het bedrijf, het team ziet wie het typte (die
     scheiding wordt in de kern afgedwongen, niet hier). In een eigen gesprek
     is `door` leeg -- daar is de afzender de persoon zelf en zou een tweede
     naam alleen maar ruis zijn. */
  app.post('/api/supplier/comm/stuur', supplierAuth, (req, res) => {
    const a = actor(req, res); if (!a) return;
    try {
      const sleutel = alsWie(a, req.body.id);
      comm.levensteken(sleutel);
      comm.bericht({ gesprekId: req.body.id, van: sleutel,
        door: sleutel === a.zaak ? a.mens : null,
        tekst: req.body.tekst, antwoordOp: req.body.antwoordOp });
      res.json({ ok: true, gesprek: comm.gesprek(sleutel, req.body.id) });
    } catch (e) { fout(res, e); }
  });

  app.post('/api/supplier/comm/lees', supplierAuth, (req, res) => {
    const a = actor(req, res); if (!a) return;
    try { res.json({ ok: true, stand: comm.lees(alsWie(a, req.body.id), req.body.id) }); }
    catch (e) { fout(res, e); }
  });
  app.post('/api/supplier/comm/typt', supplierAuth, (req, res) => {
    const a = actor(req, res); if (!a) return;
    try { comm.typtNu(alsWie(a, req.body.id), req.body.id); res.json({ ok: true }); }
    catch (e) { fout(res, e); }
  });
  app.post('/api/supplier/comm/zoek', supplierAuth, (req, res) => {
    const a = actor(req, res); if (!a) return;
    try {
      const uit = [];
      for (const sleutel of a.alle) uit.push(...comm.zoek(sleutel, req.body.vraag).treffers);
      uit.sort((x, y) => String(y.at || '').localeCompare(String(x.at || '')));
      res.json({ ok: true, treffers: uit.slice(0, 60), vraag: String(req.body.vraag || '').slice(0, 80) });
    } catch (e) { fout(res, e); }
  });

  /* GEEN /begin MET EEN LID hier, en dat is een keuze. Aan de ledenkant staat
     die route achter "alleen met wie je al kent" (zijnVrienden); een zaak kent
     niemand op die manier, en een bedrijf dat uit het niets een gesprek met
     een codenaam mag openen is precies de kant van dit platform waar
     ongevraagd contact zakelijk waardevol wordt. Een zakelijk gesprek met een
     klant ontstaat dus uit iets dat er al is -- een bestelling, een rit, een
     boeking -- en de module die dat weet, maakt het via comm.gesprekMaak().

     WAT WEL MAG: een collega binnen de eigen zaak. Dat is de zakelijke
     tegenhanger van "alleen met wie je al kent": collega's van hetzelfde
     bedrijf kennen elkaar per definitie, en de zaak weet zelf wie er op de
     loonlijst staat. De poort is dus niet vriendschap maar de personeelslijst,
     en die vraag stellen we aan accounts en niet aan het verzoek.

     Drie voorwaarden, en alle drie zijn ze een nee waard:
       - een PERSOONLIJKE login (een gedeeld beheeraccount is geen collega);
       - de ander staat ECHT bij deze zaak op de lijst (anders is een
         staffId invullen een manier om de personeelstabel af te lopen);
       - en niet jezelf. */
  app.post('/api/supplier/comm/collega', supplierAuth, (req, res) => {
    const a = actor(req, res); if (!a) return;
    try {
      if (!a.mens) throw new Error('Dit kan alleen met een persoonlijke login.');
      const id = parseInt(req.body.staffId, 10);
      const st = Number.isFinite(id) ? accounts.getStaffById(id) : null;
      if (!st || String(st.supplier_code || '').toUpperCase() !== a.code) {
        throw new Error('Collega niet gevonden.');
      }
      if (a.mens === wie.mens(a.code, id)) throw new Error('Met uzelf praten hoeft niet.');
      /* Via tussen(): een paar heeft EEN gesprek, welke kant je het ook opent.
         De zaaksleutel zit er met opzet niet in -- zie de kop. */
      const g = comm.tussen(a.mens, wie.mens(a.code, id), { soort: 'personal' });
      res.json({ ok: true, gesprek: comm.gesprek(a.mens, g.id) });
    } catch (e) { fout(res, e); }
  });
};
