/* Pure, deterministic demo model. No network, accounts, tracking or execution. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RTGExperienceCore = api;
}(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var WORLDS = Object.freeze({
    living: { name: 'LivingOS', description: 'Uw mensen, plannen en dagelijkse leven' },
    travel: { name: 'TravelOS', description: 'Reizen, vervoer en ervaringen' },
    work: { name: 'WorkOS', description: 'Uw bedrijf, team en klanten' },
    foundation: { name: 'FoundationOS', description: 'Altijd 100% gratis' }
  });
  var SCENARIOS = Object.freeze({
    travel: { world: 'travel', title: 'Amsterdam ↗ Ibiza', intro: 'Vrijdag. Twee personen. Eén plan waarin alles samenkomt.', label: 'Vertrek in dit voorbeeld', options: [['early', 'Vrijdagmiddag'], ['late', 'Vrijdagavond']] },
    dinner: { world: 'living', title: 'Samen aan tafel', intro: 'Acht personen. Een avond om bij elkaar te zijn.', label: 'Eten in dit voorbeeld', options: [['standard', 'Gedeeld menu'], ['vegetarian', 'Vegetarisch menu']] },
    work: { world: 'work', title: 'Een zaak, één overzicht', intro: 'Een restaurant. Veertig medewerkers. Een vrijdag die om afstemming vraagt.', label: 'Bezetting in dit voorbeeld', options: [['busy', 'Een teamlid valt uit'], ['covered', 'Een vervanger is beschikbaar']] },
    family: { world: 'foundation', title: 'Ruimte voor uw gezin', intro: 'Een schoolmoment, een werkdag en vervoer dat moet aansluiten.', label: 'Schoolmoment in dit voorbeeld', options: [['afternoon', 'Vrijdag om 15:00'], ['evening', 'Vrijdag om 18:00']] }
  });
  function state() { return { scenario: 'travel', option: 'early', interests: {}, permissions: { calendar: true, work: true, location: true }, confirmed: false }; }
  function interest(s, world) { if (Object.hasOwn(WORLDS, world)) s.interests[world] = true; }
  function choose(s, id) {
    if (!Object.hasOwn(SCENARIOS, id)) return false;
    s.scenario = id; s.option = SCENARIOS[id].options[0][0]; s.confirmed = false;
    interest(s, SCENARIOS[id].world); return true;
  }
  function option(s, value) {
    if (!SCENARIOS[s.scenario].options.some(function (v) { return v[0] === value; })) return false;
    s.option = value; s.confirmed = false; interest(s, SCENARIOS[s.scenario].world); return true;
  }
  function permission(s, key, value) {
    if (!Object.hasOwn(s.permissions, key)) return false;
    s.permissions[key] = value === true; s.confirmed = false; return true;
  }
  function ordered(s) { return Object.keys(WORLDS).filter(function (k) { return s.interests[k]; }).concat(Object.keys(WORLDS).filter(function (k) { return !s.interests[k]; })); }
  function recognise(text) {
    var t = String(text || '').trim().slice(0, 240).toLowerCase();
    var patterns = [['work', /bedrijf|restaurant run|strandtent|medewerkers|werknemers|team|zaak|werkdag|ondernem/], ['dinner', /etentje|diner|dinner|restaurant|tafel|eten/], ['travel', /reis|parijs|paris|ibiza|vlucht|vlieg|vakantie|weekend|buitenland|verhuis/], ['family', /gezin|famil|kind|school|onderwijs/]];
    var match = patterns.find(function (p) { return p[1].test(t); });
    return match ? match[0] : null;
  }
  function proposal(s) {
    var id = s.scenario, p = s.permissions, rows = [], conflict = false;
    function add(world, text, warn) { rows.push({ world: world, text: text, conflict: !!warn }); }
    if (id === 'travel') {
      add('TravelOS', s.option === 'late' ? 'Voorbeeldreis: vertrek vrijdagavond' : 'Voorbeeldreis: vertrek vrijdagmiddag');
      conflict = p.work && s.option === 'early';
      add('WorkOS', !p.work ? 'Werktijden niet gedeeld: controleer uw beschikbaarheid zelf' : conflict ? 'Conflict: uw voorbeeldwerkdag loopt tot 16:00' : 'Avondvertrek past na uw voorbeeldwerkdag', conflict);
      add('LivingOS', p.calendar ? 'Een agendavoorstel voor twee personen staat klaar' : 'Agenda niet gedeeld: er is geen agenda gecontroleerd');
      add('TravelOS', p.location ? 'Voorbeeldtransfer sluit aan op uw vertrektijd' : 'Geen vertrekplek gedeeld: vervoer blijft een open vraag');
    } else if (id === 'dinner') {
      add('LivingOS', 'Voorbeeldgezelschap: acht personen');
      add('TravelOS', s.option === 'vegetarian' ? 'Voorbeeldmenu: acht vegetarische couverts' : 'Voorbeeldmenu: gedeelde gerechten; vraag dieetwensen nog na');
      add('LivingOS', p.calendar ? 'Voorbeeldagenda: vrijdag 19:30 is vrij' : 'Geen agenda gedeeld: stem het tijdstip zelf af');
      add('Pay', 'Verdeling kan worden besproken; geen echte rekening of betaling');
    } else if (id === 'work') {
      conflict = p.work && s.option === 'busy';
      add('WorkOS', 'Voorbeeldorganisatie: restaurant met veertig medewerkers');
      add('WorkOS', !p.work ? 'Rooster niet gedeeld: bezetting is niet gecontroleerd' : conflict ? 'Open dienst: één medewerker ontbreekt vrijdag' : 'Voorbeeldvervanger beschikbaar; toewijzing nog te bespreken', conflict);
      add('LivingOS', p.calendar ? 'Een overlegmoment staat als voorstel klaar' : 'Agenda niet gedeeld: kies zelf een overlegmoment');
      add('WorkOS', 'Geen medewerker benaderd, rooster gewijzigd of loon verwerkt');
    } else {
      conflict = p.work && s.option === 'afternoon';
      add('FoundationOS', s.option === 'afternoon' ? 'Voorbeeldschoolmoment: vrijdag 15:00' : 'Voorbeeldschoolmoment: vrijdag 18:00');
      add('WorkOS', !p.work ? 'Werktijden niet gedeeld: beschikbaarheid blijft onbekend' : conflict ? 'Conflict: de voorbeeldwerkdag eindigt om 16:00' : 'Dit voorbeeldmoment valt na de werkdag', conflict);
      add('LivingOS', p.calendar ? 'Een gezinsafspraak staat als voorstel klaar' : 'Geen gezinsagenda gedeeld of aangepast');
      add('FoundationOS', 'Altijd 100% gratis; geen school of gezinslid benaderd');
    }
    return { title: SCENARIOS[id].title, rows: rows, conflict: conflict,
      result: conflict ? 'Er is een conflict in dit voorbeeld. Verander uw keuze en bekijk wat er meebeweegt. Er is niets uitgevoerd.' : 'Het voorbeeldvoorstel staat klaar. Niet gedeelde informatie blijft een open vraag. Er is niets uitgevoerd.' };
  }
  function handoff(s) { return Object.keys(WORLDS).filter(function (k) { return s.interests[k]; }).join(','); }
  return Object.freeze({ WORLDS: WORLDS, SCENARIOS: SCENARIOS, state: state, choose: choose, option: option, interest: interest, ordered: ordered, recognise: recognise, proposal: proposal, permission: permission, handoff: handoff });
}));
