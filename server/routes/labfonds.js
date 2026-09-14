/* Routes voor het Lab-fonds (kern/labfonds): de ledenkant om samen in te zamelen
   voor het RTF Onderzoekslab, per locatie te verdelen en gezamenlijk (met de
   AI-scheidsrechter) te beslissen. Plus een boardroom-overzicht.
   Inzamelen, voorstellen, stemmen en beslissen kan alleen met een echt account.

   TWEE DEUREN, EEN AFHANDELING (besluit van de eigenaar, 14 september 2026).
   Het fonds is van de RTFoundation, en tot vandaag kwam alleen een RTG-LID
   erbij: een gezinssessie kreeg op elke route 401, terwijl dom-labfonds in het
   functieregister uitsluitend `foundation` verklaarde. Dat is gemeten en niet
   vermoed (DOELGROEPBEREIK.json, 14 september). Wat de twee deuren delen is de
   AFHANDELING, om dezelfde reden als bij /api/rtf/knelpunt: elke handeling
   staat een keer opgeschreven in DOEN, en beide deuren roepen hem aan. Twee
   kopieen zouden binnen een maand twee verschillende fondsen worden.

   De gezinsdeur zelf (poort, verfijner, afhandeling) woont sinds de splitsing
   in ./labfonds-gezinsdeur.js; de ROUTES staan alle zestien hier. Dat is geen
   nuance maar de hele reden dat de splitsing veilig is -- zie de kop daar.

   HET IS EEN TOEZEGGINGEN-GROOTBOEK EN GEEN KAS. Er verhuist hier geen euro;
   `doneer` legt een toezegging vast. Dat is de reden dat deze deur open KAN:
   wie geld werkelijk zou verplaatsen, komt langs kern/pay/poort.js en daar
   zet een mens de laatste stap (GELD.md). */

module.exports = (kern) => {
  const { app, auth, officeAuth, labfonds, rtf } = kern;
  const veilig = (res, werk) => { try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); } catch (e) { console.error('[labfonds]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };
  const lid = (req) => (req.session && req.session.key) || null;
  /* DE CONTROLE ZEI "ACCOUNT" EN ACCEPTEERDE EEN GAST.

     De module weigert met "Log in met je RTG-account om mee in te zamelen"
     zodra er geen lidKey is -- maar een anonieme gastsessie HEEFT een key
     ('guest-xxxx'), dus die kwam er gewoon langs. Iedereen kon dus zonder
     account het fondsgrootboek besturen: inzamelen, voorstellen indienen,
     stemmen. Er verdwijnt geen euro (het is een toezeggingen-grootboek), maar
     een gedeeld register dat door willekeurige voorbijgangers gevuld wordt, is
     geen register. De tekst stond er al; nu doet de code wat hij zegt. */
  const echtLid = (req, res) => {
    if (req.session && req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis RTG-account om mee te doen aan het Lab-fonds.' });
      return false;
    }
    return true;
  };
  const naam = (req) => { const s = req.session || {}; return s.codename || (s.account && s.account.codename) || s.naam || 'Lid'; };

  /* ELKE HANDELING EEN KEER, met (wie, naam, lijf) en verder niets. `wie` is de
     sleutel in het grootboek en `naam` een CODENAAM -- nooit een echte naam,
     aan geen van beide deuren. */
  const DOEN = {
    overzicht: (wie) => labfonds.fonds(wie),
    locatie: (wie, nm, b) => labfonds.locatieMaak(b.naam, b.land),
    doneer: (wie, nm, b) => labfonds.doneer(wie, nm, String(b.locId || ''), b.bedrag),
    voorstel: (wie, nm, b) => labfonds.voorstelMaak(wie, nm, String(b.locId || ''), b.titel, b.doel, b.bedrag, b.onderzoek),
    stem: (wie, nm, b) => labfonds.stem(wie, String(b.id || ''), String(b.keuze || '')),
    scheidsrechter: (wie, nm, b) => labfonds.scheidsrechter(String(b.id || '')),
    beslis: (wie, nm, b) => labfonds.beslis(String(b.id || ''), wie),
    financiering: (wie, nm, b) => {
      const r = labfonds.zoekOnderzoek(String(b.onderzoek || ''));
      if (!r.gevonden) return { status: 404, error: r.reden };
      return { ok: true, onderzoek: r.studie, financiering: labfonds.financiering(r.studie.id) };
    }
  };

  const alsLid = (werk, streng) => (req, res) => {
    if (streng && !echtLid(req, res)) return;
    veilig(res, () => werk(lid(req), naam(req), req.body || {}));
  };

  /* DE GEZINSDEUR staat in ./labfonds-gezinsdeur.js -- poort, verfijner en
     afhandeling, met de uitleg erbij. Alleen de ROUTES blijven hier: zestien
     adressen op een plek. Zie de kop daar voor waarom dat onderscheid telt. */
  const { gezinsPoort, nietBeschermd, alsGezin } = require('./labfonds-gezinsdeur')({ rtf, veilig });


  // Inzamelen, stemmen en beslissen kan alleen als LID (auth zet req.session).
  // Het overzicht is ook voor leden; wie niet ingelogd is, ziet het via de OS-kaart.
  app.post('/api/labfonds/overzicht', auth, alsLid(DOEN.overzicht, false));
  app.post('/api/labfonds/locatie/maak', auth, alsLid(DOEN.locatie, true));
  app.post('/api/labfonds/doneer', auth, alsLid(DOEN.doneer, true));
  app.post('/api/labfonds/voorstel/maak', auth, alsLid(DOEN.voorstel, true));
  app.post('/api/labfonds/stem', auth, alsLid(DOEN.stem, true));
  app.post('/api/labfonds/scheidsrechter', auth, alsLid(DOEN.scheidsrechter, false));
  app.post('/api/labfonds/beslis', auth, alsLid(DOEN.beslis, true));

  /* Wat is er met mijn bijdrage onderzocht? De andere kant van de schakel:
     welk fondsgeld is aan EEN onderzoek toegezegd. Openbaar voor leden, want
     het fonds is een ledenpagina -- en er komt niets langs dan wat het Living
     Lab zelf al aan een voorbijganger toont (labfonds/onderzoek.js regel 4). */
  app.post('/api/labfonds/financiering', auth, alsLid(DOEN.financiering, false));

  /* Dezelfde acht handelingen, voor een gezin. Het pad hoort BIJ dom-labfonds
     in het functieregister en krijgt geen eigen functie: het is een tweede
     ingang naar dezelfde dienst, en een eigen functie zou het bord de ene helft
     laten sluiten en de andere niet. */
  app.post('/api/rtf/labfonds/overzicht', gezinsPoort, alsGezin(DOEN.overzicht));
  app.post('/api/rtf/labfonds/locatie/maak', gezinsPoort, nietBeschermd, alsGezin(DOEN.locatie));
  app.post('/api/rtf/labfonds/doneer', gezinsPoort, nietBeschermd, alsGezin(DOEN.doneer));
  app.post('/api/rtf/labfonds/voorstel/maak', gezinsPoort, nietBeschermd, alsGezin(DOEN.voorstel));
  app.post('/api/rtf/labfonds/stem', gezinsPoort, nietBeschermd, alsGezin(DOEN.stem));
  app.post('/api/rtf/labfonds/scheidsrechter', gezinsPoort, alsGezin(DOEN.scheidsrechter));
  app.post('/api/rtf/labfonds/beslis', gezinsPoort, nietBeschermd, alsGezin(DOEN.beslis));
  app.post('/api/rtf/labfonds/financiering', gezinsPoort, alsGezin(DOEN.financiering));

  // de boardroom ziet het hele fonds
  app.post('/api/labfonds/boardroom', officeAuth, (req, res) => veilig(res, () => labfonds.boardroom()));
};
