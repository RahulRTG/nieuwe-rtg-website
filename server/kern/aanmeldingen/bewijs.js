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
  const EISEN = {
    ziekenhuis: 'toelating als instelling voor medisch-specialistische zorg',
    huisarts: 'BIG-registratie van de praktijkhouder',
    specialist: 'BIG-registratie met het specialisme erbij',
    apotheek: 'inschrijving in het register van gevestigde apothekers',
    beautymedical: 'bevoegdheid voor de behandelingen die u aanbiedt',
    kinderopvang: 'inschrijving in het Landelijk Register Kinderopvang',
    verzekeringen: 'AFM-vergunning of aansluiting bij een gevolmachtigde',
    beveiliging: 'vergunning particuliere beveiligingsorganisatie'
  };

  const eisVan = (genre) => EISEN[genre] || 'het stuk waaruit blijkt dat u dit beroep mag uitoefenen';

  /* De stand op een aanmelding. Drie standen, en "niet nodig" is er een van:
     een restaurant hoort hier geen leeg vakje te zien. */
  function bewijsStand(a) {
    if (!a || !a.bedrijf || !a.bedrijf.bewijsNodig) return { nodig: false, stand: 'niet-nodig' };
    const b = a.bewijs || null;
    if (!b) return { nodig: true, stand: 'ontbreekt', vraag: eisVan(a.bedrijf.type),
      uitleg: 'Uw aanvraag staat op de stapel. Uw zaak wordt klaargezet zodra een medewerker uw ' +
        eisVan(a.bedrijf.type) + ' heeft gezien.' };
    if (b.afgetekend) return { nodig: true, stand: 'gezien', bewijs: b,
      uitleg: 'Gezien en afgetekend door ' + b.afgetekend.door + ' op ' + String(b.afgetekend.at).slice(0, 10) + '.' };
    return { nodig: true, stand: 'ingediend', bewijs: b,
      uitleg: 'U heeft een stuk ingediend. Een medewerker kijkt ernaar; wij beoordelen het niet inhoudelijk.' };
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
    a.bewijs = { soort: soort || null, nummer: nummer || null,
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
    return !!(a.bewijs && a.bewijs.afgetekend);
  }

  return { BEWIJS_EISEN: EISEN, bewijsStand, bewijsIndien, bewijsTeken, bewijsKlaar, bewijsEisVan: eisVan };
};

module.exports.EISEN_IDS = ['ziekenhuis', 'huisarts', 'specialist', 'apotheek',
  'beautymedical', 'kinderopvang', 'verzekeringen', 'beveiliging'];
