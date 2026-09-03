/* Kinderopvang en de nanny-service. Privacy by design: alleen voornamen
   op de lijsten, ophalen kan uitsluitend door de ouder die het kind ook
   heeft aangemeld, en een nanny-aanvraag wordt altijd door een mens
   bevestigd. Opslag in db.data.opvang[code]. */

const { MAX_LIJST, TIJD, DATUM, maakHulp } = require('../genrehulp');

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, vandaag, id, cap, bak } = maakHulp({ db, save, crypto });

  function demoOpvang() {
    return {
      naam: 'Nido Kinderopvang & Nanny',
      groepen: [
        { id: 'g1', naam: 'Vlinders (0 tot 2)', capaciteit: 9, aanwezig: [] },
        { id: 'g2', naam: 'Ontdekkers (2 tot 4)', capaciteit: 12, aanwezig: [] }
      ],
      nannies: [
        { id: 'n1', naam: 'Sofia', gescreend: true },
        { id: 'n2', naam: 'Mees', gescreend: true }
      ],
      nannyBoekingen: [], verslagen: []
    };
  }
  const opvangVan = bak('opvang', demoOpvang);

  function opvangOverzicht(code) {
    const o = opvangVan(code);
    return {
      naam: o.naam, groepen: o.groepen, nannies: o.nannies,
      nannyBoekingen: o.nannyBoekingen.slice(0, 20), verslagen: o.verslagen.slice(0, 20),
      regel: 'Ophalen kan alleen door de ouder die het kind heeft aangemeld; een nanny-aanvraag bevestigt altijd een mens.',
      kpi: {
        aanwezig: o.groepen.reduce((s, g) => s + g.aanwezig.length, 0),
        plekkenVrij: o.groepen.reduce((s, g) => s + Math.max(0, g.capaciteit - g.aanwezig.length), 0),
        nannyOpen: o.nannyBoekingen.filter(b => b.status === 'aangevraagd').length,
        verslagenVandaag: o.verslagen.filter(v => v.om.slice(0, 10) === vandaag()).length
      }
    };
  }
  function kindMeld(code, b) {
    const o = opvangVan(code);
    const g = o.groepen.find(x => x.id === String(b.groepId || ''));
    if (!g) return { status: 404, error: 'Deze groep bestaat niet.' };
    const voornaam = schoon(b.voornaam, 30), ouder = schoon(b.ouder, 60);
    if (!voornaam || !ouder) return { status: 400, error: 'De voornaam van het kind en de naam van de ouder horen erbij.' };
    if (g.aanwezig.length >= g.capaciteit) return { status: 409, error: g.naam + ' zit vol.' };
    if (g.aanwezig.find(k => k.voornaam.toLowerCase() === voornaam.toLowerCase())) return { status: 409, error: voornaam + ' is al aangemeld.' };
    const k = { id: id('k'), voornaam, ouder, sinds: nu() };
    g.aanwezig.push(k); save();
    return { ok: true, kind: { id: k.id, voornaam: k.voornaam }, groep: g.naam };
  }
  function kindOphaal(code, b) {
    const o = opvangVan(code);
    const g = o.groepen.find(x => x.id === String(b.groepId || ''));
    if (!g) return { status: 404, error: 'Deze groep bestaat niet.' };
    const k = g.aanwezig.find(x => x.id === String(b.kindId || ''));
    if (!k) return { status: 404, error: 'Dit kind staat niet op de lijst.' };
    const ouder = schoon(b.ouder, 60);
    if (!ouder || ouder.toLowerCase() !== k.ouder.toLowerCase()) {
      return { status: 403, error: 'Ophalen kan alleen door de ouder die het kind heeft aangemeld.' };
    }
    g.aanwezig = g.aanwezig.filter(x => x.id !== k.id); save();
    return { ok: true, opgehaald: k.voornaam };
  }
  function nannyVraag(code, b) {
    const o = opvangVan(code);
    const datum = String(b.datum || '').slice(0, 10), van = String(b.van || ''), tot = String(b.tot || '');
    const gezin = schoon(b.gezin, 60), wens = schoon(b.wens, 160);
    if (!gezin) return { status: 400, error: 'Voor welk gezin is de nanny?' };
    if (!DATUM.test(datum) || !TIJD.test(van) || !TIJD.test(tot) || tot <= van) return { status: 400, error: 'Kies een datum en een geldig tijdvak.' };
    const a = { id: id('b'), gezin, datum, van, tot, wens, nanny: null, status: 'aangevraagd', gemaakt: nu() };
    o.nannyBoekingen.unshift(a); cap(o.nannyBoekingen, MAX_LIJST); save();
    return { ok: true, aanvraag: a };
  }
  function nannyZet(code, b) {
    const o = opvangVan(code);
    const a = o.nannyBoekingen.find(x => x.id === String(b.id || ''));
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (b.status === 'bevestigd') {
      const n = o.nannies.find(x => x.id === String(b.nannyId || ''));
      if (!n) return { status: 404, error: 'Kies een van onze gescreende nanny\'s.' };
      const botst = o.nannyBoekingen.find(x => x.id !== a.id && x.nanny === n.naam && x.status === 'bevestigd' && x.datum === a.datum && a.van < x.tot && a.tot > x.van);
      if (botst) return { status: 409, error: n.naam + ' is dan al bij ' + botst.gezin + '.' };
      a.nanny = n.naam; a.status = 'bevestigd';
    } else if (b.status === 'afgerond') a.status = 'afgerond';
    else return { status: 400, error: 'Kies bevestigd of afgerond.' };
    save(); return { ok: true, aanvraag: a };
  }
  /* Een aanvraag intrekken. Hij hoort HIER en niet in ./opvangleden.js, want
     db.data.opvang heeft een eigenaar en die schrijft als enige (keuringsregel
     63). De ledenkant geeft de codenaam mee en krijgt een 404 als de aanvraag
     niet op die naam staat -- de eigendomscontrole staat dus VOOR de wijziging,
     zoals bij het annuleren in ./beautyleden.js.

     WAAROM DIT ER MOET ZIJN EN GEEN EXTRA IS. HDI.md par. 3 stelt bij elke
     module van die laag een toets: *kan de persoon dit uitzetten zonder iemand
     te bellen?* Kan hij dat niet, dan is het volgen in plaats van in beeld
     houden. Een ouder die een aanvraag heeft klaargezet en hem alleen
     telefonisch weer weg kan krijgen, valt aan de verkeerde kant van die zin.

     Een BEVESTIGDE afspraak trekt de ouder niet zelf terug: daar staat een
     nanny voor ingepland en dat is een afspraak met een mens geworden. Dan is
     bellen juist het goede antwoord, en dat zegt de melding ook. */
  function nannyWeg(code, id, gezin) {
    const o = opvangVan(code);
    const a = o.nannyBoekingen.find(x => x.id === String(id || '') && x.gezin === gezin);
    if (!a) return { status: 404, error: 'Deze aanvraag staat niet op uw naam.' };
    if (a.status !== 'aangevraagd') {
      return { status: 409, error: 'Deze aanvraag is al bevestigd. Neem contact op met de opvang; ' +
        'er staat inmiddels iemand voor ingepland.' };
    }
    o.nannyBoekingen = o.nannyBoekingen.filter(x => x.id !== a.id); save();
    return { ok: true, ingetrokken: a.datum };
  }

  function verslagMaak(code, b) {
    const o = opvangVan(code);
    const voornaam = schoon(b.voornaam, 30), tekst = schoon(b.tekst, 240);
    if (!voornaam || !tekst) return { status: 400, error: 'Voor wie is het verslagje, en wat is er beleefd?' };
    const v = { id: id('v'), voornaam, tekst, om: nu() };
    o.verslagen.unshift(v); cap(o.verslagen, MAX_LIJST); save();
    return { ok: true, verslag: v };
  }

  /* opvangVan gaat mee naar buiten omdat de ledenkant (./opvangleden.js) op
     dezelfde bak moet lezen in plaats van hem opnieuw te openen -- zelfde reden
     en zelfde vorm als salonVan in ./beauty.js. De ledenkant PROJECTEERT die
     bak scherp: `aanwezig` draagt voornamen van kinderen en de naam van hun
     ouder, en dat is precies wat daar nooit uit mag komen. */
  return { opvang: { overzicht: opvangOverzicht, kindMeld, kindOphaal, nannyVraag, nannyZet,
    nannyWeg, verslagMaak, opvangVan } };
};
