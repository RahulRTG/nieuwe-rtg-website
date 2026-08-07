/* ================== DE LEDENBALIE: de derde poort van het kantoor ==================

   Het RTG-kantoor is een ongedeelde ruimte die men binnenkomt met een GEDEELDE
   code, en die code wijst niemand aan. Voor het meeste werk daar is dat prima:
   een wachtrij bekijken of een partner goedkeuren gaat over een dossier en niet
   over een mens.

   Iemand helpen met zijn abonnement of zijn wachtwoord is iets anders. Dat
   raakt zijn ACCOUNT, en het is precies het soort handeling waarvan een lid
   later mag vragen: wie was dat, en waarom? Achter een anonieme code is daar
   geen antwoord op. Vandaar de ZETEL: uitgedeeld vanuit de boardroom, gekoppeld
   aan een echte persoonlijke inlog -- precies zoals die kamer het zelf al doet
   (kern/kantoor/index.js, boardroomToegang).

   VIJF REGELS, en ze staan hier omdat ze allemaal een NEE zijn:

   1. GEEN ZETEL, GEEN DOSSIER -- ook niet met een geldige kantoorcode. De code
      opent het kantoor, niet de balie.

   2. HET DOSSIER DRAAGT DE CODENAAM. Geen naam, geen adres, geen telefoon, geen
      document. De balie helpt een LID, niet een persoon: alles wat je nodig
      hebt om te helpen (welke pas, sinds wanneer, welke stad, welke klachten)
      kan zonder te weten wie het is. Wie de echte naam toch nodig heeft, vraagt
      die apart op via de kluis -- en dat komt in het inzagejournaal.

   3. EEN REDEN VAN NIKS IS GEEN REDEN. "test", "x", "......" horen te worden
      geweigerd, en zo'n geweigerde vraag is GEEN inzage: hij komt dus ook niet
      in het journaal. Anders vult het journaal zich met pogingen in plaats van
      met inzagen.

   4. DE BALIE ZET GEEN WACHTWOORD. Herstel gaat via de bestaande stroom naar
      het LID zelf; de balie hoort alleen dat het in gang is gezet. Geen adres
      terug, geen link, geen code -- anders is "helpen met inloggen" een manier
      om een account over te nemen.

   5. EEN ABO-VOORSTEL KENT NIETS TOE. De balie mag een aanvraag KLAARZETTEN
      voor een andere pas; het besluit blijft bij een mens via
      /api/aanmelding/beslis. Dat is dezelfde merkregel als overal: Lifestyle
      en Business alleen na menselijke goedkeuring.

   Alles wat de balie WEL doet -- een dossier openen, een codenaam natrekken --
   gaat door het BESTAANDE inzagejournaal (server/inzagelog.js). Bewust geen
   eigen logboek: een tweede journaal is een journaal dat bij een audit wordt
   vergeten. */
'use strict';

const KLACHT_SOORTEN = ['betaling', 'toegang', 'reis', 'partner', 'privacy', 'overig'];
const MAX_KLACHTEN = 5000;

/* De reden bij een inzage. Zie regel 3 hierboven; hier staat wat "van niks"
   betekent.

   TWEE MATEN, en allebei doen ze werk. Alleen tellen hoeveel LETTERS er staan
   laat "aaaaaaaaaa" door; alleen tellen hoeveel WOORDEN er staan laat "a b c"
   door en "......" ook. Samen vangen ze het hele rijtje uit de toets: "", "  ",
   "x", "test" en "......".

   Hier stond eerst ook een minimumlengte. Die is eruit: met tien letters heb je
   al minstens tien tekens, dus hij kon niets afwijzen wat de andere twee
   doorlieten -- en een regel die nooit kan bijten, is een regel die niemand
   onderhoudt. Een mutatie liet dat zien: hem weghalen brak geen enkele toets. */
function redenOk(reden) {
  const t = String(reden == null ? '' : reden).trim();
  if (t.split(/\s+/).filter(Boolean).length < 2) return false;
  return (t.match(/\p{L}/gu) || []).length >= 10;
}

function maakLedenbalie({ db, save, accounts, inzagelog, aanmeldingen, onboarding, herstelVoor }) {
  const nu = () => new Date().toISOString();
  const kap = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  const zetelLijst = () => {
    if (!Array.isArray(db.data.balieZetels)) db.data.balieZetels = [];
    return db.data.balieZetels;
  };
  const klachtLijst = () => {
    if (!Array.isArray(db.data.balieKlachten)) db.data.balieKlachten = [];
    return db.data.balieKlachten;
  };

  /* ------------------------------------------------------------- de zetels */

  const magBalie = (key) => !!key && zetelLijst().some((z) => z.key === key);
  const balieZetels = () => ({ ok: true, zetels: zetelLijst().map((z) => ({ key: z.key, sinds: z.sinds })) });

  /* Een zetel hangt aan een PERSOON. `office-gedeeld` of een verzonnen sleutel
     is geen persoon, en dan zou de zetel precies het probleem terugbrengen dat
     hij oplost: een bevoegdheid die niemand aanwijst. Vandaar dat de sleutel de
     vorm van een ledenaccount moet hebben EN dat account moet bestaan. */
  function balieZetelZet(key) {
    const k = kap(key, 60);
    const id = /^user-(\d+)$/.exec(k);
    if (!id || !accounts.getUserById(Number(id[1]))) {
      return { status: 400, error: 'Een zetel hangt aan een persoonlijke inlog (user-<id>), niet aan een gedeelde code.' };
    }
    if (!magBalie(k)) { zetelLijst().push({ key: k, sinds: nu() }); save(); }
    return balieZetels();
  }
  function balieZetelWeg(key) {
    const k = kap(key, 60);
    const over = zetelLijst().filter((z) => z.key !== k);
    db.data.balieZetels = over;
    save();
    return balieZetels();
  }

  /* --------------------------------------------------------- het dossier */

  /* De steuncode: een kort kenmerk voor DIT contact, af te leiden uit het
     ledennummer en verder nietszeggend. De balie kan hem noemen ("noteert u
     even RTG-S-0042") zodat beide kanten naar hetzelfde gesprek verwijzen
     zonder dat er ooit een naam over tafel gaat. Dat is de hele reden dat hij
     bestaat: een gesprek moet een handvat hebben, en op een platform op
     codenaam mag dat handvat geen persoon zijn. */
  const steuncodeVan = (id) => 'RTG-S-' + String(1000 + Number(id)).slice(-4);

  /* De stad komt uit het onboardingprofiel (woonplaats), op sleutel -- zelfde
     bron als het ledenregister gebruikt, en met opzet ALLEEN de woonplaats:
     een straat en huisnummer horen in de kluis en niet op een baliescherm. */
  const stadVan = (key) => {
    try {
      const p = ((onboarding && onboarding.store && onboarding.store().profielen) || {})[key];
      const w = p && p.velden && p.velden.woonplaats;
      return w ? kap(w, 60) : null;
    } catch (e) { return null; }
  };
  const landVan = (id) => {
    try {
      const st = accounts.getMemberState(id) || {};
      return st.land ? kap(st.land, 60) : null;
    } catch (e) { return null; }
  };

  const openKlachten = (id) => klachtLijst()
    .filter((k) => String(k.lidId) === String(id) && k.status === 'open')
    .map((k) => ({ id: k.id, soort: k.soort, tekst: k.tekst, status: k.status, at: k.at }));

  /* PRECIES ACHT VELDEN, en de toets pint ze dicht af. Dat is geen pesterij
     maar de bedoeling: groeit dit dossier er ooit een veld bij, dan hoort daar
     een mens naar te kijken in plaats van dat het meelift. De kolom die er
     morgen bij wil is een keer het telefoonnummer. */
  function dossierVan(u) {
    return {
      codename: u.codename || null,
      pas: u.tier || 'rtg',
      sinds: new Date(u.created_at).toISOString().slice(0, 10),
      stad: stadVan('user-' + u.id),
      land: landVan(u.id),
      steuncode: steuncodeVan(u.id),
      abo: { pas: u.tier || 'rtg', sinds: new Date(u.created_at).toISOString().slice(0, 10), loopt: true },
      klachten: openKlachten(u.id)
    };
  }

  /* Elke leesweg langs dezelfde poort: een zetel, een echte reden, en een
     regel in het journaal. Dat laatste NA de controles, want een geweigerde
     vraag is geen inzage (regel 3). */
  function eis(zetel, reden) {
    if (!magBalie(zetel)) return { status: 403, error: 'Hiervoor is een baliezetel nodig. Die deelt de boardroom uit.' };
    if (!redenOk(reden)) return { status: 400, error: 'Geef een echte aanleiding op: waarover belt of schrijft dit lid?' };
    return null;
  }
  function noteer(zetel, u, reden, wat) {
    inzagelog.noteer({
      // de sleutel van de zetel, niet "backoffice": dat is het hele punt
      door: { id: zetel, naam: zetel },
      over: { id: u.id, codenaam: u.codename || null },
      waarom: reden, bron: 'balie/' + wat
    });
  }

  function balieDossier(zetel, id, reden) {
    const nee = eis(zetel, reden);
    if (nee) return nee;
    const u = accounts.getUserById(Number(id));
    if (!u) return { status: 404, error: 'Dit lid kennen we niet.' };
    noteer(zetel, u, reden, 'dossier');
    return { ok: true, lid: dossierVan(u) };
  }

  /* Zoeken op codenaam is OOK inzage. Wie een codenaam natrekt om te zien of
     hij bestaat, doet precies wat het journaal moet vastleggen -- ook als er
     niets uitkomt. Vandaar dat er hier geen "alleen bij een treffer" staat. */
  function balieZoek(zetel, codenaam, reden) {
    const nee = eis(zetel, reden || 'zoeken op codenaam aan de balie');
    if (nee && nee.status === 403) return nee;
    const naald = kap(codenaam, 60).toLowerCase();
    if (naald.length < 2) return { status: 400, error: 'Geef minstens twee letters van de codenaam.' };
    const rijen = accounts.ledenRegisterRijen ? accounts.ledenRegisterRijen(20000) : [];
    const treffers = rijen
      .filter((r) => String(r.codename || '').toLowerCase().includes(naald))
      .slice(0, 25)
      .map((r) => ({ id: r.id, codename: r.codename, pas: r.tier || 'rtg', land: r.land || null }));
    inzagelog.noteer({
      door: { id: zetel, naam: zetel },
      over: { id: treffers.length === 1 ? treffers[0].id : null, codenaam: naald },
      waarom: reden || 'zoeken op codenaam aan de balie', bron: 'balie/zoek'
    });
    return { ok: true, treffers };
  }

  /* ------------------------------------------------------------- herstel */

  /* De balie zet GEEN wachtwoord en krijgt GEEN adres. Hij zet de bestaande
     herstelstroom in gang (dezelfde als /api/auth/forgot) en hoort terug dat
     het gelukt is. Meer niet -- geen link, geen code, geen e-mailadres. Alles
     wat hier extra terug zou komen, is een manier om een account over te nemen
     met "ik help u even". */
  function balieHerstel(zetel, id, reden) {
    const nee = eis(zetel, reden);
    if (nee) return nee;
    const u = accounts.getUserById(Number(id));
    if (!u) return { status: 404, error: 'Dit lid kennen we niet.' };
    noteer(zetel, u, reden, 'herstel');
    let gelukt = false;
    try { gelukt = !!herstelVoor(u); } catch (e) { gelukt = false; }
    if (!gelukt) return { status: 503, error: 'De herstelstroom kon niet worden gestart. Probeer het later opnieuw.' };
    return { ok: true, verstuurd: true, let: 'Het lid ontvangt zelf een bericht. De balie krijgt de link niet te zien.' };
  }

  /* --------------------------------------------------------------- klachten */

  function balieKlachtOpen(zetel, id, soort, tekst) {
    if (!magBalie(zetel)) return { status: 403, error: 'Hiervoor is een baliezetel nodig.' };
    const u = accounts.getUserById(Number(id));
    if (!u) return { status: 404, error: 'Dit lid kennen we niet.' };
    const s = KLACHT_SOORTEN.includes(String(soort)) ? String(soort) : 'overig';
    const t = kap(tekst, 600);
    /* Een klacht is het begin van een dossier waar later iemand anders naar
       kijkt. "x" is dan geen klacht maar ruis, en ruis in een klachtenlijst
       kost precies de aandacht die de echte klacht nodig heeft. */
    if (t.length < 12) return { status: 400, error: 'Schrijf op waar de klacht over gaat (een zin volstaat).' };
    const k = { id: 'kl_' + Math.random().toString(36).slice(2, 10), lidId: u.id, soort: s, tekst: t,
      status: 'open', door: zetel, at: nu(), dicht: null };
    klachtLijst().unshift(k);
    if (klachtLijst().length > MAX_KLACHTEN) klachtLijst().length = MAX_KLACHTEN;
    save();
    return { ok: true, klacht: { id: k.id, soort: k.soort, tekst: k.tekst, status: k.status, at: k.at } };
  }

  function balieKlachtStatus(zetel, klachtId, status) {
    if (!magBalie(zetel)) return { status: 403, error: 'Hiervoor is een baliezetel nodig.' };
    const k = klachtLijst().find((x) => x.id === String(klachtId));
    if (!k) return { status: 404, error: 'Deze klacht kennen we niet.' };
    const nieuw = String(status) === 'gesloten' ? 'gesloten' : 'open';
    k.status = nieuw;
    k.dicht = nieuw === 'gesloten' ? nu() : null;
    save();
    return { ok: true, klacht: { id: k.id, soort: k.soort, tekst: k.tekst, status: k.status, at: k.at } };
  }

  /* ------------------------------------------------------- het abo-voorstel */

  /* KLAARZETTEN, NIET TOEKENNEN. De aanmeldstroom die er al is doet precies
     wat hier nodig is: een aanvraag komt binnen met status "in behandeling" en
     alleen beslis() -- door een mens -- kent hem toe. De balie hangt er het
     account van het lid aan, zodat dat besluit het account kan optillen.

     De aanvraag draagt de CODENAAM als naam. Dat is geen omweg om de kluis
     heen maar de bedoeling: wie later beslist, beslist over een lid en niet
     over een persoon, en heeft de echte naam daar niet voor nodig. */
  function balieAboVoorstel(zetel, id, naarPas, reden) {
    const nee = eis(zetel, reden);
    if (nee) return nee;
    const u = accounts.getUserById(Number(id));
    if (!u) return { status: 404, error: 'Dit lid kennen we niet.' };
    if (!aanmeldingen) return { status: 503, error: 'De aanmeldstroom is nu niet bereikbaar.' };
    noteer(zetel, u, reden, 'abo');
    const r = aanmeldingen.aanvraag({ pas: String(naarPas || ''), naam: u.codename || ('lid ' + u.id),
      contact: 'via de ledenbalie (' + steuncodeVan(u.id) + ')' }, u.id);
    if (!r || r.error) return { status: (r && r.status) || 400, error: (r && r.error) || 'Dit voorstel kon niet worden klaargezet.' };
    return { ok: true, voorstel: r.aanmelding,
      let: 'Klaargezet, niet toegekend: een andere pas is een menselijk besluit en loopt via /api/aanmelding/beslis.' };
  }

  return { magBalie, balieZetels, balieZetelZet, balieZetelWeg,
    balieZoek, balieDossier, balieHerstel, balieKlachtOpen, balieKlachtStatus, balieAboVoorstel,
    redenOk, KLACHT_SOORTEN };
}

module.exports = { maakLedenbalie, redenOk, KLACHT_SOORTEN };
