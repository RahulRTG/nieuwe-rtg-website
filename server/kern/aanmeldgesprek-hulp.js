/* Hulpstukken voor het aanmeldgesprek (kern/aanmeldgesprek.js): de vaste
   teksten (uitleg + de eerlijke "waarom?"-antwoorden) en de kleine, pure
   herkenners (warmtespiegel, woonplaats/werkgever/pas-interesse oppikken).
   Apart gehouden zodat de gespreksmotor zelf klein en leesbaar blijft. */

module.exports = function maakHulp({ db, schoon }) {
  const ord = i => ['eerste', 'tweede', 'derde', 'vierde'][i] || (i + 1) + 'e';

  // korte, eerlijke uitleg voor wie eerst wil weten wat RTG is (het uitleg-pad)
  const UITLEG = 'RTG is een membership-reisbureau: je pas opent reizen, verblijven, uitgaan en meer, met een persoonlijke AI (dat ben ik) die alles voor je regelt. Er zijn drie passen: de RTG Pass als instap, en de Lifestyle en Business Pass op uitnodiging. Wil je lid worden, dan meld ik je hier gewoon aan; ben je al lid, dan log ik je in. Zeg het maar: aanmelden, inloggen, of nog een vraag?';

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
  const WAAROM = {
    doel: 'Ik vraag het alleen om je meteen goed te helpen: terugkerende leden log ik in, nieuwe gasten meld ik aan, en wie eerst wil weten wat RTG is, leg ik het uit. Meer zit er niet achter.',
    'login-naam': 'Je e-mailadres of gebruikersnaam is hoe de kluis jouw account terugvindt; zonder kan ik je niet inloggen.',
    'sw-open': 'We loggen je in met je vier sleutelwoorden in plaats van een wachtwoord: ik vraag er telkens drie, in een andere volgorde. Zo staat er nergens een vast wachtwoord op de lijn en geeft een keer meekijken nooit al je woorden prijs. Liever toch je wachtwoord? Zeg "wachtwoord".',
    'sw-sluit': 'Nog een laatste sleutelwoord en je bent binnen. Je woorden zijn versleuteld opgeslagen; ik kan ze zelf niet teruglezen.',
    'login-af': 'Je wachtwoord typ je hieronder in een apart veld: het gaat rechtstreeks en versleuteld naar de inlogcontrole, niet door dit gesprek. Zo leest niemand het mee, ik ook niet.',
    woonplaats: 'Je woonplaats helpt me met reistijden, aanraders in de buurt en de regels van je land. Alleen de plaatsnaam; je volledige adres vraag ik pas als er echt iets bezorgd moet worden, en overslaan is ook gewoon goed.',
    naam: 'Eerlijk antwoord: je naam staat straks op je pas en in de kluis met je echte gegevens; in de app zelf werk je onder een codenaam, zodat zaken en personeel je echte naam nooit hoeven te zien.',
    email: 'Je e-mailadres gebruik ik voor de bevestigingslink en om je account terug te geven als je ooit je wachtwoord kwijt bent. Reclame sturen we er niet mee.',
    telefoon: 'Je nummer is voor herstel en voor belangrijke seintjes (bijvoorbeeld als je ergens verwacht wordt). Niet voor spam; dat vinden wij zelf ook niks.',
    geboren: 'Je geboortedatum zoals in je paspoort bepaalt eerlijk wat er opengaat: sommige onderdelen zijn 18+, en voor 15 tot 17 gelden beschermende regels per land. Daarom wil ik hem precies weten.',
    wachtwoord: 'Je wachtwoord gaat versleuteld de kluis in; ik kan het zelf niet eens teruglezen. Minstens 6 tekens, en kies iets wat je nergens anders gebruikt.'
  };
  const isWaarom = t => /\b(waarom|hoezo|waarvoor|wat moet je daarmee|wat doe je daarmee)\b/i.test(t);

  return { ord, UITLEG, warmteVan, toon, pikWoonplaats, pikWerkgever, pikPasInteresse, WAAROM, isWaarom };
};
