/* ============================================================================
   WAT ER MET EEN ZAAK GEBEURT -- de enige plek die de tijdlijn schrijft.

   ./zaak.js maakt een zaak en leest hem terug. Alles wat hem VERANDERT staat
   hier, en dat is geen indeling om de omvang maar een grens: zolang er precies
   een module is die `tijdlijn.push()` doet, is de tijdlijn de waarheid. Zodra
   het er twee zijn, is hij een verslag dat meestal klopt.

   ELKE FUNCTIE HIER SCHRIJFT EERST DE REGEL EN DAN PAS HET VELD. De losse
   velden op de zaak (stand, eigenaar, prioriteit) zijn afgeleiden voor de
   snelheid; ze worden bijgewerkt NA de regel, nooit ervoor en nooit zonder.

   DE MENSELIJKE OVERNAME IS HIER GEEN FUNCTIE MAAR EEN CONTRACT. `mensVraag()`
   kan niet weigeren zolang ./mens.js zegt dat er een mens bestaat. Er is geen
   tak waarin RTG "probeer het eerst zelf even" antwoordt en de zaak niet in de
   wachtrij zet -- dat was precies het gedrag dat hersteld moest worden. Wat de
   AI daarna nog mag zeggen, staat los van of het verzoek is doorgezet.
   ========================================================================== */
'use strict';

const { STANDEN, geldig } = require('./klassen');
const prioriteit = require('./prioriteit');
const mensLaag = require('./mens');

const MAX_REGELS = 400;

module.exports = function maakLoop({ zaken, save, notify }) {
  const { vind, kort, nu, schoon, inhoud, verwijzing } = zaken;

  /* De tijdlijn kapt aan de VOORKANT en houdt de eerste regel vast. Het begin
     van een zaak (wie meldde wat, wanneer) is het enige stuk dat je nooit kwijt
     wilt; het midden van een lang gesprek wel. */
  function noteer(z, regel) {
    z.tijdlijn.push(Object.assign({ at: nu() }, regel));
    if (z.tijdlijn.length > MAX_REGELS) z.tijdlijn.splice(1, z.tijdlijn.length - MAX_REGELS);
  }

  const VAN = ['melder', 'ai', 'mens', 'systeem'];

  /* Een bericht. `van` is niet cosmetisch: de klokken in ./klok.js rekenen erop
     dat 'mens' echt een mens is. Een AI-antwoord dat zich als mens voordoet,
     zou de menselijke reactietijd laten kloppen terwijl er niemand kwam. */
  function bericht(id, { van, tekst, wie } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    const v = VAN.includes(String(van)) ? String(van) : 'systeem';
    const t = schoon(tekst, 4000);
    if (inhoud(t) < 2) return { status: 400, error: 'Een leeg bericht helpt niemand.' };
    noteer(z, { wat: 'bericht', van: v, tekst: t, wie: schoon(wie, 60) || null });

    /* De stand beweegt mee met wie er sprak, want een stand die met de hand
       moet worden bijgezet, staat binnen een week overal verkeerd. Alleen als
       de zaak nog loopt: een gesloten zaak heropen je met opzet en niet door
       er iets in te typen. */
    if (!(STANDEN[z.stand] || {}).eind) {
      if (v === 'melder' && z.stand === 'wachtOpMelder') zetStand(z, 'inBehandeling', 'systeem', 'De melder heeft gereageerd.');
      else if (v === 'mens' && (z.stand === 'nieuw' || z.stand === 'wachtOpMens')) zetStand(z, 'inBehandeling', wie || 'mens', 'Een medewerker heeft de zaak opgepakt.');
      else if (v === 'ai' && z.stand === 'nieuw') zetStand(z, 'onderzoek', 'systeem', 'RTG kijkt wat er aan de hand is.');
    }
    save();
    if (v !== 'melder') melden(z, t);
    return { ok: true, zaak: kort(z) };
  }

  /* De standwissel zelf. Intern, zodat de regel en het veld nooit los van
     elkaar kunnen worden gezet. */
  function zetStand(z, naar, door, notitie) {
    if (!geldig(STANDEN, naar) || z.stand === naar) return false;
    noteer(z, { wat: 'stand', naar, van: z.stand, door: schoon(door, 60) || 'systeem', notitie: schoon(notitie, 300) || null });
    z.stand = naar;
    return true;
  }

  function stand(id, naar, { door, notitie } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    if (!geldig(STANDEN, naar)) return { status: 400, error: 'Kies een stand: ' + Object.keys(STANDEN).join(', ') + '.' };
    if (!zetStand(z, String(naar), door, notitie)) return { ok: true, zaak: kort(z), let: 'De zaak stond al zo.' };
    save();
    return { ok: true, zaak: kort(z) };
  }

  /* ------------------------------------------------------- de overname ---- */
  /* HET CONTRACT. Zolang ./mens.js zegt dat er voor deze pas een mens bestaat,
     ZET DIT DOOR. Het antwoord vertelt de aanroeper daarnaast of de AI hier nog
     iets tegenover mag zetten (`afwerenMag`), maar dat verandert niets aan de
     doorzetting -- dat is het hele verschil met het oude gedrag. */
  function mensVraag(id, { tier, tekst, ingelogd = true } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    /* WELKE TABEL ER GELDT, LEEST HIJ UIT DE ZAAK. Een zaak of een organisatie
       heeft geen pas, dus `overname(tier)` zegt niets over hem -- hem daar toch
       doorheen halen zou een leverancier met een storing bij de ledenbalie
       neerleggen, waar men over abonnementen gaat. De doelgroep staat al op de
       zaak en is daar door de ROUTE gezet en niet door de client; hem hier als
       parameter meegeven zou een tweede bron zijn die uit de pas kan lopen. */
    const zakelijk = z.doelgroep === 'zaak' || z.doelgroep === 'organisatie';
    const o = zakelijk ? mensLaag.overnameZaak({ ingelogd }) : mensLaag.overname(tier, { ingelogd });
    if (!o.rechtstreeks) {
      noteer(z, { wat: 'mensGeweigerd', waarom: o.waarom });
      save();
      return { status: 200, ok: false, overname: o, let: o.waarom };
    }
    z.mensVerzoeken = (z.mensVerzoeken || 0) + 1;
    noteer(z, { wat: 'mensGevraagd', tekst: schoon(tekst, 500) || null, keer: z.mensVerzoeken, naar: o.team });
    /* De zaak verhuist naar het team dat de mens levert. De Rechterhand is
       uitvoering en geen support; wie er recht op heeft, komt daar uit, en de
       rest komt bij de balie -- allebei een mens, en dat is de belofte. */
    if (z.team !== o.team) {
      noteer(z, { wat: 'team', naar: o.team, van: z.team, waarom: 'De melder vroeg om een mens.' });
      z.team = o.team;
    }
    zetStand(z, 'wachtOpMens', 'melder', 'De melder vroeg om een mens.');
    save();
    melden(z, 'Uw zaak ' + z.id + ' staat klaar voor ' + o.heet + '.');
    return { ok: true, overname: o, zaak: kort(z),
      afwerenMag: mensLaag.afwerenMag(z.mensVerzoeken),
      let: mensLaag.belofte(o) };
  }

  /* ------------------------------------------------- eigenaar en gewicht -- */
  function eigenaar(id, { wie, door } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    const w = schoon(wie, 60);
    if (!w) return { status: 400, error: 'Wie neemt deze zaak op zich?' };
    noteer(z, { wat: 'eigenaar', naar: w, van: z.eigenaar, door: schoon(door, 60) || w });
    z.eigenaar = w;
    save();
    return { ok: true, zaak: kort(z) };
  }

  function weeg(id, { naar, door, reden } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    const p = prioriteit.overschrijf(z.prioriteit, { naar, door, reden });
    if (p.error) return p;
    noteer(z, { wat: 'prioriteit', naar: p.prioriteit, van: z.prioriteit.prioriteit, door: p.wie, reden: p.reden });
    z.prioriteit = p;
    save();
    return { ok: true, zaak: kort(z) };
  }

  /* ------------------------------------------------------- koppelingen ---- */
  /* Waar deze zaak aan vastzit in de laag die de BETEKENIS bezit: een klacht,
     een incident, een conciergeopdracht, een foutsignaal. De koppeling is een
     verwijzing en trekt niets over -- de klacht blijft van de ledenbalie en het
     incident van kern/command. */
  function koppel(id, { soort, code, door } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    const v = verwijzing({ soort, code });
    if (!v) return { status: 400, error: 'Een koppeling is een soort en een code.' };
    if (z.koppelingen.some(k => k.soort === v.soort && k.code === v.code)) return { ok: true, zaak: kort(z), let: 'Al gekoppeld.' };
    z.koppelingen.push(v);
    noteer(z, { wat: 'koppeling', soort: v.soort, code: v.code, door: schoon(door, 60) || 'systeem' });
    save();
    return { ok: true, zaak: kort(z) };
  }

  /* Bericht aan de melder, langs het kanaal dat hij al leest. Faalt dit, dan
     valt de zaak niet om: een melding die niet aankomt is vervelend, een zaak
     die daardoor verdwijnt is erger. Zelfde afweging als in kern/envelop.js --
     de levering gaat voor. */
  function melden(z, tekst) {
    if (typeof notify !== 'function') return;
    try { notify(z.melder, { titel: 'RTG Service · ' + z.id, tekst: String(tekst).slice(0, 300), zaak: z.id }); }
    catch (e) { console.error('[service] melden', e && e.message); }
  }

  return { bericht, stand, mensVraag, eigenaar, weeg, koppel, zetStand, noteer };
};
