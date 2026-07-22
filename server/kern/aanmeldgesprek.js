/* Het aanmeldgesprek: Rahul neemt de HELE poort over, inloggen en aanmelden.
   Een menselijk gesprek waarin hij zelf ontdekt of je nieuw bent of terugkomt,
   en waarin de antwoorden die hij nodig heeft vanzelf bovenkomen; op elke
   "waarom?" legt hij eerlijk uit waarvoor iets dient. Aan het eind levert het
   gesprek precies de velden op die de ENE registratieroute (/api/auth/register)
   al kent, of de gebruikersnaam voor de ENE inlogroute (/api/auth/login); het
   wachtwoord van een terugkerend lid gaat NOOIT door dit gesprek, dat typt de
   app rechtstreeks naar de inlogroute. Het gesprek is een vriendelijker
   ingang, nooit een tweede toegangspad.

   Afspraken die hier bewust in zitten:
   - Rahul heet Rahul. Nooit "butler" of een andere titel.
   - Warmtespiegel: hij begint vriendelijk-gewoon en wordt hoogstens warmer
     als de ander dat duidelijk zelf is, en dan altijd een stapje minder
     amicaal dan de gebruiker zelf.
   - De woonplaats komt het liefst vanzelf (terloops genoemd = opgepikt);
     komt hij niet vanzelf, dan vraagt Rahul er een keer subtiel naar, met
     uitleg waarom, en overslaan is altijd goed. Een volledig adres vraagt
     hij hier nooit; dat komt pas als er echt iets bezorgd moet worden.
   - Het accounttype hoeft niemand op te zoeken: Rahul adviseert de RTG Pass;
     interesse in Lifestyle of Business noteert hij eerlijk als interesse,
     want die passen blijven op uitnodiging of na menselijke goedkeuring en
     hij belooft daar NOOIT toegang toe.
   - Noemt iemand waar die werkt, dan herkent Rahul de zaak en stelt hij de
     personeelskoppeling voor; het bewijs blijft de eigen pincode (security).

   maakAanmeldgesprek(state) volgt het vaste kern-patroon; werkt volledig
   zonder API-sleutel (de teksten zijn van de motor zelf). */

const MAX_GESPREKKEN = 500;
const MAX_BEURTEN = 60;
const TTL_MS = 30 * 60 * 1000;

function maakAanmeldgesprek({ db, schoon, leeftijdVan }) {
  const gesprekken = new Map(); // id -> { stap, velden, warmte, beurten, at, werkgever }
  const nu = () => Date.now();

  function opruimen() {
    if (gesprekken.size < MAX_GESPREKKEN) return;
    for (const [id, g] of gesprekken) { if (nu() - g.at > TTL_MS) gesprekken.delete(id); }
    while (gesprekken.size >= MAX_GESPREKKEN) { gesprekken.delete(gesprekken.keys().next().value); }
  }

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
    doel: 'Ik vraag het alleen om je meteen goed te helpen: terugkerende leden log ik in, nieuwe gasten meld ik aan. Meer zit er niet achter.',
    'login-naam': 'Je e-mailadres of gebruikersnaam is hoe de kluis jouw account terugvindt; zonder kan ik je niet inloggen.',
    'login-af': 'Je wachtwoord typ je hieronder in een apart veld: het gaat rechtstreeks en versleuteld naar de inlogcontrole, niet door dit gesprek. Zo leest niemand het mee, ik ook niet.',
    woonplaats: 'Je woonplaats helpt me met reistijden, aanraders in de buurt en de regels van je land. Alleen de plaatsnaam; je volledige adres vraag ik pas als er echt iets bezorgd moet worden, en overslaan is ook gewoon goed.',
    naam: 'Eerlijk antwoord: je naam staat straks op je pas en in de kluis met je echte gegevens; in de app zelf werk je onder een codenaam, zodat zaken en personeel je echte naam nooit hoeven te zien.',
    email: 'Je e-mailadres gebruik ik voor de bevestigingslink en om je account terug te geven als je ooit je wachtwoord kwijt bent. Reclame sturen we er niet mee.',
    telefoon: 'Je nummer is voor herstel en voor belangrijke seintjes (bijvoorbeeld als je ergens verwacht wordt). Niet voor spam; dat vinden wij zelf ook niks.',
    geboren: 'Je geboortedatum zoals in je paspoort bepaalt eerlijk wat er opengaat: sommige onderdelen zijn 18+, en voor 15 tot 17 gelden beschermende regels per land. Daarom wil ik hem precies weten.',
    wachtwoord: 'Je wachtwoord gaat versleuteld de kluis in; ik kan het zelf niet eens teruglezen. Minstens 6 tekens, en kies iets wat je nergens anders gebruikt.'
  };
  const isWaarom = t => /\b(waarom|hoezo|waarvoor|wat moet je daarmee|wat doe je daarmee)\b/i.test(t);

  function intakeStart() {
    opruimen();
    const id = 'ag' + nu().toString(36) + Math.random().toString(36).slice(2, 8);
    const g = { stap: 'doel', velden: {}, warmte: 0, beurten: 0, at: nu(), werkgever: null };
    gesprekken.set(id, g);
    return { id, tekst: 'Hallo, ik ben Rahul. Geen formulieren hier; vertel gewoon. Ken ik je al, of is dit je eerste keer bij RTG?' };
  }

  function intakeZeg(id, ruwTekst) {
    const g = gesprekken.get(id);
    if (!g) return { status: 404, error: 'Dit gesprek ken ik niet (meer). Begin gerust opnieuw.' };
    if (++g.beurten > MAX_BEURTEN) { gesprekken.delete(id); return { status: 429, error: 'Dit gesprek werd wel erg lang; begin even opnieuw.' }; }
    g.at = nu();
    const tekst = schoon(String(ruwTekst || ''), 280);
    if (!tekst) return { tekst: 'Zeg maar gewoon wat je denkt; ik luister.' };
    g.warmte = warmteVan(tekst, g.warmte);
    pikWoonplaats(g, tekst); pikWerkgever(g, tekst); pikPasInteresse(g, tekst);
    if (isWaarom(tekst) && WAAROM[g.stap]) return { tekst: WAAROM[g.stap] };

    switch (g.stap) {
      case 'doel': {
        // Rahul ontdekt zelf of iemand komt inloggen of aanmelden
        const wilIn = /\b(inloggen|log in|al lid|al een account|ik ben lid|ken(t|nen)? (je )?m(e|ij)|welkom terug|terugkerend|bestaand account|weer hier)\b/i.test(tekst);
        const wilNieuw = /\b(eerste keer|voor het eerst|nieuw|aanmelden|lid worden|registreren|nog geen|account maken|nog niet)\b/i.test(tekst);
        const mail = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        if (wilIn && !wilNieuw) {
          if (mail) { g.stap = 'login-af'; g.login = { u: mail[0].toLowerCase() }; return { tekst: 'Kijk, daar ben je weer. Nog even je wachtwoord hieronder en je bent binnen; dat gaat rechtstreeks de kluis in, niet door dit gesprek.', login: g.login }; }
          g.stap = 'login-naam';
          return { tekst: 'Ha, welkom terug. Even kijken: welk e-mailadres of welke gebruikersnaam gebruik je hier?' };
        }
        if (wilNieuw && !wilIn) {
          g.stap = 'hallo';
          return { tekst: toon(g, 'Leuk je te ontmoeten; dan regelen wij je aanmelding gewoon in dit gesprek. ', 'Wat leuk! Dan regelen we het hier samen. ') + 'Maar eerst: hoe gaat het vandaag?' };
        }
        // een los e-mailadres als eerste zin = vrijwel zeker een terugkerend lid
        if (mail) { g.stap = 'login-af'; g.login = { u: mail[0].toLowerCase() }; return { tekst: 'Dat adres ken ik vast; typ je wachtwoord in het veld hieronder, dan kijken we meteen.', login: g.login }; }
        return { tekst: 'Allebei goed hoor. Zeg het maar: kom je inloggen, of word je vandaag lid?' };
      }
      case 'login-naam': {
        const mail = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        const u = mail ? mail[0].toLowerCase() : schoon(tekst.replace(/^(met\s+|mijn\s+(e-?mail(adres)?|gebruikersnaam|naam)\s+is\s+|het\s+is\s+)/i, ''), 80);
        if (!u || u.length < 2) return { tekst: 'Welk e-mailadres of welke gebruikersnaam gebruik je hier? Typ hem even voluit.' };
        g.login = { u };
        g.stap = 'login-af';
        return { tekst: 'Top. Nog even je wachtwoord hieronder en je bent binnen; dat gaat rechtstreeks en versleuteld de kluis in, niet door dit gesprek.', login: g.login };
      }
      case 'login-af': {
        if (/\b(opnieuw|ander (adres|account)|verkeerde?|toch (aanmelden|lid|nieuw))\b/i.test(tekst)) {
          g.stap = 'doel'; g.login = null;
          return { tekst: 'Geen punt, we beginnen gewoon opnieuw. Kom je inloggen, of word je lid?' };
        }
        return { tekst: 'Typ je wachtwoord gewoon hieronder, dan ben je zo binnen. Kom je er niet uit: zeg "opnieuw" of pak "Wachtwoord vergeten?".', login: g.login || null };
      }
      case 'hallo': {
        g.stap = 'naam';
        const somber = /\b(slecht|niet zo|moe|druk|stress|rot)\b/i.test(tekst);
        const opening = somber
          ? 'Dank dat je dat gewoon zegt; dat hoeft hier niet mooier dan het is. '
          : toon(g, 'Goed om te horen. ', 'Mooi zo! ');
        return { tekst: opening + 'Hoe mag ik je noemen? Je volledige naam graag, zoals in je paspoort; in de app krijg je gewoon een codenaam.' };
      }
      case 'naam': {
        const naam = schoon(tekst.replace(/^(ik ben|ik heet|mijn naam is)\s+/i, ''), 80);
        if (naam.length < 2 || !/[A-Za-zÀ-ÿ]/.test(naam)) return { tekst: 'Die naam kan ik niet goed lezen; hoe staat hij in je paspoort?' };
        g.velden.name = naam;
        g.stap = 'email';
        const voornaam = naam.split(' ')[0];
        return { tekst: 'Aangenaam, ' + voornaam + (g.velden.woonplaats ? '. En ' + g.velden.woonplaats + ', mooie plek' : '') + '. Waar mag ik je bevestiging naartoe sturen? Een e-mailadres is genoeg.' };
      }
      case 'email': {
        const m = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        if (!m) return { tekst: 'Ik zie er geen e-mailadres in; typ hem even voluit (met @).' };
        g.velden.email = m[0].toLowerCase();
        g.stap = 'telefoon';
        return { tekst: toon(g, 'Genoteerd. ', 'Staat erin! ') + 'En een mobiel nummer? Dat is voor herstel en belangrijke seintjes, niet voor spam.' };
      }
      case 'telefoon': {
        const cijfers = tekst.replace(/\D/g, '');
        if (cijfers.length < 8) return { tekst: 'Dat lijkt me te kort voor een mobiel nummer; typ hem even helemaal.' };
        g.velden.phone = tekst.replace(/[^\d+ ]/g, '').trim().slice(0, 30);
        // de woonplaats: het liefst kwam hij al terloops voorbij; zo niet,
        // dan een keer subtiel vragen, met de reden erbij, en overslaan mag
        if (!g.velden.woonplaats) {
          g.stap = 'woonplaats';
          return { tekst: toon(g, 'Dank je. ', 'Top. ') + 'En waar woon je zoal? Alleen de plaats; dat helpt me straks met reistijden en aanraders in de buurt. Liever niet zeggen is ook gewoon goed.' };
        }
        g.stap = 'geboren';
        return { tekst: 'Dan de enige echt formele vraag: wanneer ben je geboren, precies zoals in je paspoort? (Vraag gerust waarom.)' };
      }
      case 'woonplaats': {
        const slaatOver = /\b(overslaan|liever niet|zeg ik (liever )?niet|priv[eé]|gaat je niks aan|skip)\b/i.test(tekst);
        if (!slaatOver && !g.velden.woonplaats) {
          // een kale plaatsnaam is ook een antwoord ("Ibiza", "Den Haag")
          const kaal = schoon(tekst.replace(/^(in|uit|ik woon in|gewoon)\s+/i, '').replace(/[.,!?].*$/, ''), 40);
          if (/^[A-Za-zÀ-ÿ' -]{2,40}$/.test(kaal)) g.velden.woonplaats = kaal;
        }
        g.stap = 'geboren';
        const dank = slaatOver || !g.velden.woonplaats
          ? 'Helemaal goed, hoort er niet per se bij. '
          : (g.velden.woonplaats + ', mooi. ');
        return { tekst: dank + 'Dan de enige echt formele vraag: wanneer ben je geboren, precies zoals in je paspoort? (Vraag gerust waarom.)' };
      }
      case 'geboren': {
        let d = null;
        let m = /(\d{4})-(\d{2})-(\d{2})/.exec(tekst);
        if (m) d = m[1] + '-' + m[2] + '-' + m[3];
        else if ((m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(tekst))) d = m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
        const lft = d ? leeftijdVan(d) : null;
        if (lft == null || lft > 120) return { tekst: 'Die datum kan ik niet plaatsen; schrijf hem als dag-maand-jaar, bijvoorbeeld 14-03-1992.' };
        if (lft < 15) return { tekst: 'Eerlijk is eerlijk: het RTG-lidmaatschap kan vanaf 15 jaar. Tot die tijd is er de RTFoundation-wereld; die is er juist voor jou.' };
        g.velden.geboortedatum = d;
        g.stap = 'wachtwoord';
        return { tekst: (lft < 18 ? 'Dank je. Voor jouw leeftijd gelden beschermende regels; die regel ik automatisch goed. ' : 'Dank je. ') + 'Kies tot slot een wachtwoord van minstens 6 tekens. Het gaat versleuteld de kluis in; ik kan het zelf niet teruglezen.' };
      }
      case 'wachtwoord': {
        if (tekst.length < 6) return { tekst: 'Net te kort; minstens 6 tekens. Een zinnetje werkt vaak het best.' };
        g.velden.password = String(ruwTekst).slice(0, 200);
        g.stap = 'klaar';
        g.velden.tier = 'rtg';
        const interesse = g.velden.interesse === 'business'
          ? ' Je noemde je bedrijf: de Business Pass gaat op uitnodiging of na menselijke goedkeuring, dus die kan en wil ik je niet beloven; ik noteer je interesse eerlijk en dan hoor je ervan.'
          : (g.velden.interesse === 'lifestyle' ? ' De Lifestyle Pass gaat op uitnodiging; ik noteer je interesse, beloven kan ik niets.' : '');
        const werk = g.werkgever
          ? ' En je zei dat je bij ' + g.werkgever.naam + ' werkt: na je aanmelding koppel ik je personeelstoegang, met je eigen pincode als bewijs.'
          : '';
        const velden = { name: g.velden.name, email: g.velden.email, phone: g.velden.phone, geboortedatum: g.velden.geboortedatum, password: g.velden.password, tier: 'rtg' };
        const uit = { tekst: 'Dat was alles; geen formulier aan te pas gekomen. Ik zet je aanmelding door voor de RTG Pass; welk type account je nodig had, heb ik onderweg gewoon voor je bepaald.' + interesse + werk,
          klaar: true, velden, werkgever: g.werkgever, woonplaats: g.velden.woonplaats || null };
        gesprekken.delete(id);
        return uit;
      }
      default:
        return { tekst: 'Zullen we opnieuw beginnen? Dat praat makkelijker.' };
    }
  }

  return { intakeStart, intakeZeg };
}

module.exports = { maakAanmeldgesprek };
