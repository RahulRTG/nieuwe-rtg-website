/* RTG Festival (deelmodule): DE GEREEDHEID. Een getal dat niet groen te praten is.

   FESTIVAL.md par. 5.5 stelt de eis, en LAT.md regel 11 zegt waarom: bewijsgroen
   is geen go-live-groen. Een Festival Readiness Score van 98,7% is een mooi
   getal en juist daarom gevaarlijk -- een cijfer dat uit een gevoel komt, praat
   een terrein open.

   DUS: ELK PROCENT KOMT UIT EEN CONTROL MET BEWIJS. Een vergunning met een
   nummer en een datum, een keuring met een handtekening, een rooster met
   bezette posten. Vier standen, en maar EEN ervan telt mee:

     ontbreekt   er is niets ingediend                 -> 0
     ingediend   er ligt een stuk, niemand keek        -> 0
     verlopen    het is gezien, maar het liep af       -> 0
     gezien      afgetekend en op de peildatum geldig  -> 1

   "Ingediend" telt dus NUL. Dat is de hele regel: een stuk dat niemand heeft
   gezien is geen bewijs, alleen een belofte met een bijlage.

   EN EEN ONTBREKENDE KRITIEKE CONTROL ZET ALLES OP NIET GEREED, ongeacht wat de
   andere negenennegentig doen en ongeacht of de kaartverkoop al gelopen is.

   WIE AFTEKENT, IS NIET WIE INDIENT. Dezelfde scheiding als bij het vakbewijs
   (kern/vakbewijs.js: nooit de werkgever zelf). Een organisatie die haar eigen
   stukken aftekent, heeft geen controle maar een formulier.

   WAT DEZE LAAG NIET IS: een juridische autoriteit. De startlijst hieronder is
   een BEGIN dat de organisator aanpast, en geen opsomming van wettelijke
   eisen -- FESTIVAL.md par. 9 en CONCERN.md zijn daar allebei duidelijk over.
   Wij lezen geen vergunning na en bellen geen gemeente. */
'use strict';

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const GROEPEN = ['vergunningen', 'veiligheid', 'personeel', 'leveranciers',
  'ticketing', 'infrastructuur', 'hulpdiensten'];

/* De STARTLIJST. Een begin, geen wet. Wat hier kritiek staat, is wat een
   festival zonder plausibel niet opent; de organisator mag het bijstellen --
   maar afzwakken laat een spoor na (zie controlZet). */
const START = [
  ['vergunningen', 'Evenementenvergunning', 'het besluit met nummer en datum', true],
  ['vergunningen', 'Geluidsontheffing', 'de ontheffing met de toegestane tijden', false],
  ['veiligheid', 'Veiligheidsplan', 'het vastgestelde plan met de capaciteiten erin', true],
  ['veiligheid', 'Ontruimingsplan', 'het plan dat bij het veiligheidsplan hoort', true],
  ['veiligheid', 'Constructiekeuring', 'de keuring van podia en tribunes', true],
  ['personeel', 'Beveiligingsinzet', 'het rooster met bezette posten', true],
  ['personeel', 'EHBO-bezetting', 'de bezetting per post en per dag', true],
  ['hulpdiensten', 'Afstemming hulpdiensten', 'het verslag van het vooroverleg', true],
  ['infrastructuur', 'Stroom en aggregaten', 'de keuring van de installatie', false],
  ['infrastructuur', 'Drinkwaterpunten', 'het aantal en de plek ervan', false],
  ['ticketing', 'Capaciteit vastgelegd', 'de vergunde capaciteit in het terrein', false],
  ['leveranciers', 'Verzekering', 'de polis voor dit evenement', false]
];

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind } = ctx;

  const bak = (e) => {
    if (!e.controls || typeof e.controls !== 'object') e.controls = {};
    return e.controls;
  };
  const nuIso = () => new Date().toISOString();

  /* De stand van EEN control op een peildatum. Losstaand omdat zowel de lijst
     als het cijfer hem nodig hebben, en twee berekeningen van "telt dit mee"
     is precies hoe een score gaat liegen (LAT-regel 4). */
  function standVanControl(c, op) {
    const b = c.bewijs;
    if (!b) return 'ontbreekt';
    if (!b.afgetekend) return 'ingediend';
    if (b.geldigTot && b.geldigTot < op) return 'verlopen';
    return 'gezien';
  }
  const telt = (stand) => stand === 'gezien';

  function controlsSeed(fid, eid) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const b = bak(e);
    if (Object.keys(b).length) return { status: 409, error: 'Deze editie heeft al controls.' };
    for (const [groep, naam, eis, kritiek] of START) {
      const id = 'ctl' + crypto.randomBytes(4).toString('hex');
      b[id] = { id, groep, naam, eis, kritiek, bewijs: null, geschiedenis: [] };
    }
    save();
    return { ok: true, aantal: Object.keys(b).length };
  }

  function controlZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const naam = schoon(d.naam, 80);
    if (!naam) return { status: 400, error: 'Geef de control een naam.' };
    const groep = GROEPEN.includes(String(d.groep)) ? String(d.groep) : null;
    if (!groep) return { status: 400, error: 'Kies een groep: ' + GROEPEN.join(', ') + '.' };
    const eis = schoon(d.eis, 140);
    if (!eis) return { status: 400, error: 'Waaruit moet blijken dat dit in orde is?' };
    const kritiek = d.kritiek === true;
    const b = bak(e);

    if (d.id) {
      const c = b[String(d.id)];
      if (!c) return { status: 404, error: 'Deze control bestaat niet.' };
      /* AFZWAKKEN MAG, EN LAAT EEN SPOOR NA. Verbieden zou betekenen dat RTG
         beslist wat er voor dit festival kritiek is, en dat is precies de
         juridische autoriteit die deze laag niet heeft. Maar stil afzwakken is
         de enige weg naar een groen cijfer zonder bewijs, en die hoort dicht:
         het staat in de geschiedenis EN het komt terug in de uitslag. */
      if (c.kritiek && !kritiek) {
        const reden = schoon(d.reden, 200);
        if (!reden) return { status: 400, error: 'Waarom is dit niet langer kritiek? Noem een reden.' };
        c.geschiedenis.push({ wat: 'afgezwakt', reden, door: schoon(d.door, 60) || null, at: nuIso() });
      }
      Object.assign(c, { naam, groep, eis, kritiek });
      save();
      return { ok: true, control: c };
    }
    if (Object.keys(b).length >= 300) return { status: 400, error: 'Tot driehonderd controls per editie.' };
    const c = { id: 'ctl' + crypto.randomBytes(4).toString('hex'), groep, naam, eis, kritiek,
      bewijs: null, geschiedenis: [] };
    b[c.id] = c;
    save();
    return { ok: true, control: c };
  }

  function controlWeg(fid, eid, id) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const c = bak(e)[String(id || '')];
    if (!c) return { status: 404, error: 'Deze control bestaat niet.' };
    delete e.controls[c.id];
    save();
    return { ok: true };
  }

  /* Een stuk indienen. Dit is een MELDING en geen bewijs -- de stand blijft
     'ingediend' tot een ander mens er zijn naam onder zet. */
  function bewijsIndienen(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const c = bak(e)[String(d.control || '')];
    if (!c) return { status: 404, error: 'Deze control bestaat niet.' };
    const soort = schoon(d.soort, 80), nummer = schoon(d.nummer, 60);
    if (!soort) return { status: 400, error: 'Welk stuk dient u in? Noem het soort.', vraag: c.eis };
    const door = schoon(d.door, 60);
    if (!door) return { status: 400, error: 'Op wiens naam wordt dit ingediend?' };
    const tot = DATUM.test(String(d.geldigTot || '')) ? String(d.geldigTot) : null;
    /* Een nieuw stuk wist de aftekening van het vorige. Zelfde regel als
       kern/vakbewijs.js, en om dezelfde reden: wie iets vervangt, vervangt ook
       wat er over het oude was vastgesteld. */
    c.bewijs = { soort, nummer: nummer || null, geldigTot: tot,
      ingediend: { door, at: nuIso() }, afgetekend: null };
    c.geschiedenis.push({ wat: 'ingediend', door, at: nuIso() });
    save();
    return { ok: true, control: c };
  }

  function bewijsAftekenen(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const c = bak(e)[String(d.control || '')];
    if (!c) return { status: 404, error: 'Deze control bestaat niet.' };
    if (!c.bewijs) return { status: 409, error: 'Er is nog niets ingediend om af te tekenen.' };
    const door = schoon(d.door, 60);
    if (!door) return { status: 400, error: 'Wie tekent af?' };
    /* WIE AFTEKENT IS NIET WIE INDIENT. Zonder deze regel is de hele
       bewijslaag een formulier dat zichzelf invult. */
    if (c.bewijs.ingediend && c.bewijs.ingediend.door === door) {
      return { status: 409, error: 'Wie een stuk indient, tekent het niet zelf af.' };
    }
    c.bewijs.afgetekend = { door, at: nuIso() };
    c.geschiedenis.push({ wat: 'afgetekend', door, at: nuIso() });
    save();
    return { ok: true, control: c };
  }

  return { controlsSeed, controlZet, controlWeg, bewijsIndienen, bewijsAftekenen,
    standVanControl, telt, GEREED_GROEPEN: GROEPEN };
};

module.exports.GEREED_GROEPEN = GROEPEN;
