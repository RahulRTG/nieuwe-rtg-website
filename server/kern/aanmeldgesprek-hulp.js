/* Hulpstukken voor het aanmeldgesprek (kern/aanmeldgesprek.js): de vaste
   teksten (uitleg + de eerlijke "waarom?"-antwoorden) en de kleine, pure
   herkenners (warmtespiegel, woonplaats/werkgever/pas-interesse oppikken).
   Apart gehouden zodat de gespreksmotor zelf klein en leesbaar blijft. */

module.exports = function maakHulp({ db, schoon }) {
  const ord = i => ['eerste', 'tweede', 'derde', 'vierde'][i] || (i + 1) + 'e';

  // korte, eerlijke uitleg voor wie eerst wil weten wat RTG is (het uitleg-pad)
  const UITLEG = 'RTG is een membership-reisbureau. Je pas opent reizen, verblijven en uitgaan; ik regel het. Drie passen: RTG als instap, Lifestyle en Business op uitnodiging. Aanmelden, inloggen, of nog een vraag?';

  /* de warmtespiegel: 0 = gewoon vriendelijk, 1 = warm. Rahul volgt de
     gebruiker en blijft er altijd een stapje onder: pas bij duidelijke
     warmte (2+ signalen) doet hij een klein beetje mee. */
  function warmteVan(tekst, huidig) {
    let s = 0;
    if (/[!]{1,}/.test(tekst)) s++;
    if (/\b(haha|hihi|top|super|gezellig|leuk|lekker)\b/i.test(tekst)) s++;
    if (/[\u{1F300}-\u{1FAFF}❤]/u.test(tekst)) s++;
    return Math.max(huidig, s >= 2 ? 1 : 0);
  }
  const toon = (g, gewoon, warm) => (g.warmte >= 1 ? warm : gewoon);

  // de woonplaats komt vanzelf: alleen oppikken als iemand hem terloops noemt
  function pikWoonplaats(g, tekst) {
    if (g.velden.woonplaats) return;
    // lui + vooruitkijkend: stopt bij leestekens en voegwoorden, zodat
    // "Den Haag" heel blijft maar "en ik werk bij..." erbuiten valt
    const m = /\b(?:ik woon in|woon in|ik kom uit|kom uit|vanuit)\s+([A-Za-zÀ-ÿ' -]{2,30}?)(?=[.,!?;]|\s+(?:en|maar|trouwens|dus|hoor|want)\b|$)/i.exec(tekst);
    if (m) g.velden.woonplaats = schoon(m[1].trim(), 40);
  }
  // werk komt ook vanzelf: "ik werk bij X" herkent de zaak (koppelen blijft met PIN)
  function pikWerkgever(g, tekst) {
    if (g.werkgever) return;
    const m = /\bwerk(?:zaam)?\s+bij\s+([A-Za-z0-9À-ÿ' -]{2,40}?)(?=[.,!?;]|\s+(?:in|als|op|voor|en|met|sinds|want|maar)\b|$)/i.exec(tekst);
    if (!m) return;
    const naam = m[1].trim().toLowerCase();
    const strak = naam.replace(/\s+/g, '');
    // op naam ("Sal de Mar") of op de zaakcode die personeel vaak kent ("KIKUNOI")
    const s = (db.data.suppliers || []).find(x => (x.name && x.name.toLowerCase().includes(naam))
      || (x.code && x.code.toLowerCase() === strak));
    if (s) g.werkgever = { code: s.code, naam: s.name };
  }
  // interesse in de zwaardere passen: eerlijk noteren, nooit beloven
  function pikPasInteresse(g, tekst) {
    if (/\b(business|zakelijk|ondernemer|zzp|mijn bedrijf)\b/i.test(tekst)) g.velden.interesse = 'business';
    else if (/\blifestyle\b/i.test(tekst)) g.velden.interesse = g.velden.interesse || 'lifestyle';
  }

  /* op elke "waarom?" een eerlijk antwoord, per stap */
  /* Op elke "waarom?" een eerlijk antwoord, per stap. Hier mag het iets langer dan
     Rahuls gewone zinnen: er is om uitleg gevraagd. Telefoon en adres staan er niet
     bij -- die vraagt hij niet meer aan de poort, maar pas bij een bestelling of
     reservering (zie kern/aanmeldgesprek-aanmeld.js). */
  const WAAROM = {
    doel: 'Zodat ik je meteen goed help: leden log ik in, nieuwe gasten meld ik aan, en wie wil weten wat RTG is, leg ik het uit.',
    'login-naam': 'Daarmee vindt de kluis jouw account terug. Zonder kan ik je niet inloggen.',
    'sw-open': 'We loggen je in met je vier sleutelwoorden in plaats van een wachtwoord: ik vraag er telkens drie, in een andere volgorde. Zo staat er nergens een vast wachtwoord op de lijn. Liever je wachtwoord? Zeg "wachtwoord".',
    'sw-sluit': 'Nog een woord en je bent binnen. Je woorden staan versleuteld; ik kan ze niet teruglezen.',
    'login-af': 'Je wachtwoord gaat via een apart veld rechtstreeks naar de inlogcontrole, niet door dit gesprek. Niemand leest het mee, ik ook niet.',
    naam: 'Je naam staat op je pas en in de kluis. In de app werk je onder een codenaam, zodat zaken en personeel je echte naam nooit zien.',
    email: 'Voor de bevestigingslink, en om je account terug te geven als je je wachtwoord kwijt bent. Reclame sturen we niet.',
    geboren: 'Je leeftijd bepaalt wat er opengaat: sommige onderdelen zijn 18+, en van 15 tot 17 gelden beschermende regels. Daarom precies.',
    wachtwoord: 'Het gaat versleuteld de kluis in; ik kan het niet teruglezen. Minstens 6 tekens, en kies iets wat je nergens anders gebruikt.'
  };
  const isWaarom = t => /\b(waarom|hoezo|waarvoor|wat moet je daarmee|wat doe je daarmee)\b/i.test(t);

  return { ord, UITLEG, warmteVan, toon, pikWoonplaats, pikWerkgever, pikPasInteresse, WAAROM, isWaarom };
};
