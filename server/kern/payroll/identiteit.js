/* Payroll OS: DE IDENTITEIT VAN EEN MEDEWERKER -- ja of nee, en opvragen.

   DE STANDAARD IS JA OF NEE, EN VERDER NIETS. Een werkgever hoeft voor het
   dagelijkse werk maar een ding te weten: is de identiteit van deze medewerker
   vastgesteld. Geen documentnummer, geen scan, geen geboortedatum, geen
   nationaliteit. Dat is niet zuinigheid maar hetzelfde ontwerp als de rest van
   dit huis: de operationele laag draait op zo min mogelijk, en de kluis gaat
   alleen open als daar een reden voor is.

   MAAR OPVRAGEN MOET KUNNEN. Een werkgever in Nederland heeft de identiteit van
   zijn werknemers nodig voor de loonadministratie -- dat is geen nieuwsgierigheid
   maar een verplichting. De vraag is dus niet OF hij erbij mag, maar HOE.

   TWEE ZWAARTES, WANT DE BEHOEFTE VERSCHILT:

     gegevens  soort document, laatste vier cijfers, geldig tot, nationaliteit,
               geboortedatum. Genoeg voor de loonadministratie en voor de
               controle of iemand mag werken. De scan blijft in de kluis.
     kopie     het document zelf. Zwaarder, want de scan verlaat de kluis en
               ligt daarna bij het bedrijf. Voor wie de identificatieplicht
               letterlijk moet naleven.

   WAT VOOR ALLEBEI GELDT, EN NIET TE OMZEILEN IS:

     - een REDEN is verplicht, en een lege of nietszeggende reden wordt
       geweigerd. Een spoor zonder reden vertelt alleen dat er iemand in de
       kluis is geweest;
     - het gaat in het INZAGEJOURNAAL (server/inzagelog.js), dat bewust de naam
       zelf niet bewaart -- anders bouw je een tweede, onversleutelde kopie van
       de kluis;
     - de MEDEWERKER KRIJGT BERICHT. Dat is de rem die echt werkt: wie weet dat
       de ander het ziet, vraagt niet uit nieuwsgierigheid op. Het is ook het
       enige dat een betrokkene in staat stelt te merken dat er iets misgaat,
       in plaats van het achteraf uit een logboek te moeten vissen;
     - alleen over EIGEN personeel. Een zaak vraagt niets op over iemand die er
       niet werkt, en niet over een oud-medewerker buiten de bewaartermijn.

   WAT HIER NIET GEBEURT: een tweede intake. Het identiteitsbewijs komt uit de
   bestaande verificatie (routes/auth/verificatie.js en de beoordeling in het
   kantoor). Deze laag leest die, hij vraagt niets opnieuw. */
'use strict';

const NIVEAUS = ['gegevens', 'kopie'];
/* Een reden moet iets zeggen. "ok", "j", "..." zijn geen redenen; de grens ligt
   laag maar niet op nul, want een verplicht veld dat je met een punt kunt
   vullen is geen verplicht veld. */
const REDEN_MIN = 10;

function maakIdentiteit({ accounts, db, save, nu, inzagelog, notify, logActivity }) {
  const tijd = nu || (() => new Date().toISOString());

  /* De stand: het enige dat een werkgever standaard ziet. */
  function stand(memberId) {
    if (!memberId) return { geverifieerd: false, reden: 'geen RTG-account gekoppeld' };
    let u = null;
    try { u = accounts.getUserById(Number(memberId)); } catch (e) { u = null; }
    if (!u) return { geverifieerd: false, reden: 'account niet gevonden' };
    const v = String(u.verified || 'none');
    return { geverifieerd: v === 'verified', stand: v };
  }

  /* Voor een hele ploeg tegelijk: alleen ja of nee, per personeelsnummer. Dit
     is wat het personeelsscherm van een zaak hoort te tonen. */
  function standen(staffLijst) {
    return (staffLijst || []).map(s => Object.assign({ staffId: s.id, naam: s.name },
      stand(s.member_id != null ? s.member_id : s.memberId)));
  }

  /* ---------- opvragen ---------- */
  function opvraag({ supplierCode, supplierNaam, staff, niveau, reden, door, doorRol }) {
    if (!NIVEAUS.includes(niveau))
      return { status: 400, error: 'Kies wat u nodig hebt: gegevens of kopie.' };
    if (!door) return { status: 400, error: 'Noteer wie deze gegevens opvraagt.' };
    if (String(reden || '').trim().length < REDEN_MIN)
      return { status: 400, error: 'Noteer waarvoor u dit nodig hebt. De medewerker krijgt uw reden te zien.' };
    if (!staff || String(staff.supplier_code || '').toUpperCase() !== String(supplierCode).toUpperCase())
      return { status: 404, error: 'Deze medewerker werkt hier niet.' };
    /* Een KOPIE is de zwaarste inzage die er is; daar is de manager voor. Een
       gewone medewerker met roostertoegang hoort er niet bij te kunnen. */
    if (niveau === 'kopie' && doorRol !== 'manager')
      return { status: 403, error: 'Alleen een manager kan een kopie van een identiteitsbewijs opvragen.' };

    const memberId = staff.member_id != null ? staff.member_id : staff.memberId;
    const s = stand(memberId);
    if (!s.geverifieerd)
      return { status: 409, error: 'De identiteit van deze medewerker is nog niet vastgesteld; er is niets om op te vragen.', stand: s };

    const md = (accounts.getMemberState ? accounts.getMemberState(Number(memberId)) : null) || {};
    const pas = md.paspoort || {};
    const nummer = String(pas.nummer || '');
    const gegevens = {
      soort: pas.soort || 'identiteitsbewijs',
      laatsteVier: nummer ? nummer.slice(-4) : null,
      geldigTot: pas.vervaldatum || null,
      nationaliteit: pas.nationaliteit || null,
      geboortedatum: md.geboren || null,
      geverifieerdOp: md.geverifieerdOp || null
    };

    /* Het spoor. Eerst noteren, dan pas teruggeven: een inzage die halverwege
       misgaat mag geen gegevens hebben opgeleverd zonder regel in het
       journaal. */
    const verzoekId = 'inz_' + tijd().replace(/\D/g, '').slice(-12) + '-' + String(staff.id);
    try {
      if (inzagelog && inzagelog.noteer) inzagelog.noteer({
        wie: door, wieRol: doorRol || 'werkgever', wieBedrijf: supplierCode,
        accountId: Number(memberId), waarom: String(reden).trim().slice(0, 300),
        wat: 'identiteit:' + niveau
      });
    } catch (e) { /* het journaal mag de inzage niet blokkeren, wel altijd geprobeerd */ }

    const rij = (db.data.identiteitVerzoeken = db.data.identiteitVerzoeken || []);
    rij.unshift({ id: verzoekId, code: supplierCode, staffId: staff.id, accountId: Number(memberId),
      niveau, reden: String(reden).trim().slice(0, 300), door, doorRol: doorRol || null, at: tijd() });
    if (rij.length > 2000) rij.length = 2000;
    save();

    /* De medewerker krijgt bericht -- met de reden erbij, want "er is naar je
       paspoort gekeken" zonder waarom is alleen verontrustend. */
    try {
      if (notify) notify('user-' + memberId, {
        icon: 'schild',
        title: niveau === 'kopie' ? 'Kopie van uw identiteitsbewijs opgevraagd' : 'Uw identiteitsgegevens opgevraagd',
        body: (supplierNaam || supplierCode) + ' (' + door + ') vroeg ' +
          (niveau === 'kopie' ? 'een kopie van uw identiteitsbewijs' : 'uw identiteitsgegevens') +
          ' op. Reden: ' + String(reden).trim().slice(0, 160)
      });
    } catch (e) {}
    try { if (logActivity) logActivity(supplierCode, { name: door, role: doorRol },
      door + ' vroeg ' + niveau + ' van het identiteitsbewijs van ' + staff.name + ' op'); } catch (e) {}

    if (niveau === 'gegevens') return { ok: true, verzoekId, niveau, gegevens };

    /* De kopie zelf komt niet als bestand uit deze functie: het uitleveren is
       een aparte handeling met zijn eigen poort (de scan ligt versleuteld op
       schijf, zie server/identiteitsmap.js). Wat hier teruggaat is het bewijs
       DAT er is opgevraagd plus de verwijzing; de route haalt het bestand op.
       Zo blijft deze module te toetsen zonder schijf, en is er maar een plek
       die weet hoe de kluis opengaat. */
    return { ok: true, verzoekId, niveau, gegevens, kopie: { beschikbaar: true, bestand: null },
      let: 'De kopie verlaat hiermee de kluis. Bewaar hem volgens uw eigen bewaartermijn en niet langer.' };
  }

  /* Wat een medewerker zelf ziet: wie heeft wat opgevraagd, en waarom. Dit is
     de kant van het spoor die de betrokkene toekomt. */
  const mijnVerzoeken = (memberId) => (db.data.identiteitVerzoeken || [])
    .filter(v => v.accountId === Number(memberId))
    .map(v => ({ id: v.id, bedrijf: v.code, niveau: v.niveau, reden: v.reden, door: v.door, at: v.at }));

  return { stand, standen, opvraag, mijnVerzoeken, NIVEAUS, REDEN_MIN };
}

module.exports = { maakIdentiteit, NIVEAUS, REDEN_MIN };
