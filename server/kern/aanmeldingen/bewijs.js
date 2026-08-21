/* Aanmeldingen-deel "bewijs": de genres die niet live gaan zonder papier.

   WAAROM DIT ER MOEST KOMEN. Het genre-register kent de stand `bewijs` voor
   acht genres -- ziekenhuis, huisarts, medisch specialist, apotheek, beauty
   medical, kinderopvang, verzekeringen en beveiliging. Dat zijn stuk voor stuk
   beroepen waar iemand zonder vergunning of diploma reële schade aanricht.

   Die stand stond met opzet DICHT, met deze reden erbij: een `bewijsNodig`-vlag
   die niemand handhaaft is een open deur met een bordje ernaast. Dit bestand is
   de handhaving, en daarmee mag de deur open.

   HET BLOKKEERT DE PROVISIONING EN NIET DE AANVRAAG. Iemand die een apotheek
   wil beginnen mag dat gewoon aanvragen -- zijn plan indienen is geen
   beroepsuitoefening. Wat er niet gebeurt is dat de zaak wordt klaargezet
   voordat een mens het stuk heeft gezien. Zou de aanvraag zelf geblokkeerd zijn,
   dan zou een aspirant-apotheker niet eens kunnen vragen wat er nodig is.

   EN RTG BEOORDEELT HET STUK NIET INHOUDELIJK. Wij zijn geen inspectie: wat
   hier wordt vastgelegd is dat een MEDEWERKER heeft gezien dat er een stuk is,
   met een nummer en een datum. Doen alsof RTG een vergunning valideert, zou
   precies de schijnzekerheid geven waar CONCERN.md voor waarschuwt -- en het
   zou de aansprakelijkheid verschuiven naar de partij die dat niet kan dragen. */
'use strict';

module.exports = ({ save, kap, nu }) => {

  /* Wat er per genre gevraagd wordt. De tekst is wat de aanvrager LEEST, dus
     hij noemt het stuk bij de naam die hij zelf kent. */
  const EISEN = require('../bedrijfscontrole').BEWIJS_EISEN;

  const eisVan = (genre) => EISEN[genre] || 'het stuk waaruit blijkt dat u dit beroep mag uitoefenen';

  const DATUM = /^\d{4}-\d{2}-\d{2}$/;
  const vandaag = () => new Date(nu()).toISOString().slice(0, 10);
  const verlopen = (b) => !!(b && b.geldigTot && b.geldigTot < vandaag());

  /* De stand op een aanmelding. VIER standen sinds de houdbaarheid, en
     "niet nodig" is er een van: een restaurant hoort hier geen leeg vakje te
     zien.

     WAAROM ER EEN VIERDE BIJ MOEST. Een afgetekend stuk was hier voor eeuwig
     gezien. Een BIG-registratie die volgend jaar wordt doorgehaald, een
     LRK-inschrijving die vervalt, een beveiligingsvergunning die afloopt --
     alle drie bleven ze staan als 'gezien', omdat er geen datum was die ooit
     iets kon zeggen. Dat is dezelfde fout als een bewijsvlag die niemand
     handhaaft, alleen een jaar later zichtbaar.

     WAT DEZE STAND WEL EN NIET DOET. Hij zet geen zaak stil. RTG is geen
     inspectie en een aflopende datum in ons dossier is geen bewijs dat een
     vergunning is ingetrokken -- doorhalen op grond van een veld dat wij zelf
     hebben overgetypt zou precies de schijnzekerheid zijn waar de kop van dit
     bestand voor waarschuwt. Hij zorgt dat het OPVALT: bewijsHerkeuring() zet
     ze op een lijst voor het kantoor, en een mens kijkt er opnieuw naar. */
  function bewijsStand(a) {
    if (!a || !a.bedrijf || !a.bedrijf.bewijsNodig) return { nodig: false, stand: 'niet-nodig' };
    const b = a.bewijs || null;
    if (!b) return { nodig: true, stand: 'ontbreekt', vraag: eisVan(a.bedrijf.type),
      uitleg: 'Uw aanvraag staat op de stapel. Uw zaak wordt klaargezet zodra een medewerker uw ' +
        eisVan(a.bedrijf.type) + ' heeft gezien.' };
    if (b.afgetekend && verlopen(b)) return { nodig: true, stand: 'verlopen', bewijs: b,
      uitleg: 'Het stuk dat wij van u zagen liep af op ' + b.geldigTot + '. Dien het vernieuwde stuk in; ' +
        'een medewerker kijkt er opnieuw naar.' };
    if (b.afgetekend) return { nodig: true, stand: 'gezien', bewijs: b,
      uitleg: 'Gezien en afgetekend door ' + b.afgetekend.door + ' op ' + String(b.afgetekend.at).slice(0, 10) + '.' +
        (b.geldigTot ? ' Geldig tot ' + b.geldigTot + '.' : '') };
    return { nodig: true, stand: 'ingediend', bewijs: b,
      uitleg: 'U heeft een stuk ingediend. Een medewerker kijkt ernaar; wij beoordelen het niet inhoudelijk.' };
  }

  /* De herkeuringslijst: aanmeldingen waarvan het bewijsstuk is verlopen of dat
     binnen `dagen` gaat doen. Dit is de tegenhanger van "voor eeuwig gezien" --
     zonder een lijst die vooruitkijkt, is een houdbaarheidsdatum alleen een
     veld dat niemand ooit leest (LAT-regel 6). */
  function bewijsHerkeuring(lijst, dagen) {
    /* nu() geeft hier een ISO-STRING (zie ../aanmeldingen.js), geen milliseconden.
       Zonder de Date.parse eromheen plakt de `+` er een getal achter en komt er
       een datum uit die nooit ergens boven ligt -- dan staat de lijst altijd leeg
       en meldt de herkeuring eeuwig "niets te doen". */
    const grens = new Date(Date.parse(nu()) + (Number(dagen) || 60) * 86400000).toISOString().slice(0, 10);
    const uit = [];
    for (const a of (lijst || [])) {
      const b = a && a.bewijs;
      if (!b || !b.afgetekend || !b.geldigTot) continue;
      if (b.geldigTot > grens) continue;
      uit.push({ id: a.id, genre: a.bedrijf ? a.bedrijf.type : null,
        naam: a.bedrijf ? a.bedrijf.naam || null : null,
        geldigTot: b.geldigTot, verlopen: verlopen(b), vraag: eisVan(a.bedrijf && a.bedrijf.type) });
    }
    return uit.sort((x, y) => String(x.geldigTot).localeCompare(String(y.geldigTot)));
  }

  /* De aanvrager dient een stuk in. Dit is een MELDING en geen bewijs: er
     verandert niets aan de toegang tot een mens het aftekent. */
  function bewijsIndien(a, data) {
    if (!a.bedrijf || !a.bedrijf.bewijsNodig) {
      return { status: 409, error: 'Voor dit genre is geen bewijs nodig.' };
    }
    const soort = kap((data || {}).soort, 80);
    const nummer = kap((data || {}).nummer, 60);
    if (!soort && !nummer) {
      return { status: 400, error: 'Welk stuk dient u in?',
        uitleg: 'Noem het soort (bijvoorbeeld "' + eisVan(a.bedrijf.type) + '") en het nummer ervan.' };
    }
    /* De houdbaarheid. Optioneel, want niet elk stuk heeft er een -- een
       inschrijving in een register loopt door tot hij wordt doorgehaald. Staat
       hij er wel, dan is dit het veld waarmee 'gezien' ooit kan aflopen. */
    const tot = DATUM.test(String((data || {}).geldigTot || '')) ? String((data || {}).geldigTot) : null;
    a.bewijs = { soort: soort || null, nummer: nummer || null, geldigTot: tot,
      toelichting: kap((data || {}).toelichting, 400) || null,
      ingediend: nu(), afgetekend: null };
    a.bijgewerkt = nu();
    save();
    return { ok: true, bewijs: a.bewijs,
      uitleg: 'Ontvangen. Een medewerker bekijkt of het stuk er is; RTG beoordeelt het niet inhoudelijk.' };
  }

  /* Het personeel tekent af. Dat is de handeling die de provisioning vrijgeeft,
     en zij staat op een NAAM -- een aftekening zonder naam is geen aftekening. */
  function bewijsTeken(a, door) {
    if (!a.bedrijf || !a.bedrijf.bewijsNodig) return { status: 409, error: 'Voor dit genre is geen bewijs nodig.' };
    if (!a.bewijs) return { status: 409, error: 'Er is nog geen stuk ingediend.' };
    if (a.bewijs.afgetekend) return { status: 409, error: 'Dit stuk is al afgetekend.' };
    const naam = kap(door, 60);
    if (!naam) return { status: 400, error: 'Wie tekent af? Een aftekening zonder naam is geen aftekening.' };
    a.bewijs.afgetekend = { door: naam, at: nu() };
    a.bijgewerkt = nu();
    save();
    return { ok: true, bewijs: a.bewijs,
      grens: 'Vastgelegd is dat ' + naam + ' het stuk heeft gezien. RTG is geen inspectie en toetst de inhoud niet.' };
  }

  /* DE POORT. Wordt door de provisioning gevraagd voordat er een zaak ontstaat.
     Geeft true als er niets te wachten valt -- zodat een genre zonder eis
     precies loopt zoals altijd. */
  function bewijsKlaar(a) {
    if (!a || !a.bedrijf || !a.bedrijf.bewijsNodig) return true;
    /* Een VERLOPEN stuk zet hier geen zaak klaar. Bij de provisioning kan dat
       ook zonder terughoudendheid: er bestaat nog niets dat we stilzetten, en
       een zaak openen op een vergunning waarvan wij zelf hebben genoteerd dat
       hij is afgelopen, is geen "wij zijn geen inspectie" maar wegkijken. */
    return !!(a.bewijs && a.bewijs.afgetekend && !verlopen(a.bewijs));
  }

  return { BEWIJS_EISEN: EISEN, bewijsStand, bewijsIndien, bewijsTeken, bewijsKlaar,
    bewijsHerkeuring, bewijsEisVan: eisVan };
};

module.exports.EISEN_IDS = ['ziekenhuis', 'huisarts', 'specialist', 'apotheek',
  'beautymedical', 'kinderopvang', 'verzekeringen', 'beveiliging'];
