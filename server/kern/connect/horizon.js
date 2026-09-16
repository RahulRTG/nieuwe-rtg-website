/* ============================================================================
   DE HORIZON -- hoeveel onbekends wil deze mens vandaag, en wie bepaalt dat.

   Geen filterbubbel, maar ook geen systeem dat zelf besluit hoe breed iemands
   wereld is. Een schuif van `vertrouwd` naar `ontdekken`, door de mens zelf
   gezet, en ./mixer.js verdeelt zijn plekken erop. Dat is het verschil tussen
   personalisatie die IETS van je weet en personalisatie die je BESTUURT.

   VIJF VRIJWILLIGE SIGNALEN ERNAAST, en dat is de hele voeding van deze laag:
   meer hiervan, minder hiervan, dit ken ik al, dit interesseert me niet, en
   verras me. Ze staan hier omdat ze de goedkope vorm van personalisatie zijn --
   genoeg weten om te helpen, niet alles hoeven weten. Wat er NIET in mag, staat
   verderop in `GEEN_SIGNAAL`: kijktijd, scrollsnelheid, tijdstip, en alles wat
   iemand niet heeft gezegd maar wel heeft gedaan. Dat zijn precies de
   variabelen waarmee een aandachtsmachine wordt gebouwd, en ze zijn hier niet
   vergeten -- ze zijn geweigerd.

   DE SCHUIF STAAT NIET OP NUL EN NIET OP HONDERD. Standaard 40: iets meer
   vertrouwd dan onbekend. Op 0 zou de laag een bubbel zijn met een
   instellingsknop eromheen, en op 100 een willekeurigheidsgenerator. Allebei
   zijn ze eerlijker dan een verborgen keuze, en allebei zijn ze slechter dan
   een mens die schuift.

   ER STAAT GEEN GEVOELIG GEGEVEN IN. Geen leeftijd, geen geloof, geen
   gezondheid, geen postcode -- ook niet afgeleid. Wat hier staat is wat iemand
   heeft aangeklikt over ONDERWERPEN. `zet()` weigert een onderwerp dat op een
   contactgegeven lijkt, net zoals kern/envelop.js dat bij zijn actor doet: een
   voorkeur die "mijn dokter is X" heet, is geen voorkeur.
   ========================================================================== */
'use strict';

const STANDAARD = 40;

const SIGNALEN = [
  { id: 'meer',      naam: 'Meer hiervan',        richting: 1,  grond: 'Dit onderwerp mag vaker terugkomen.' },
  { id: 'minder',    naam: 'Minder hiervan',      richting: -1, grond: 'Minder, maar niet weg -- een onderwerp verdwijnt hier nooit helemaal, want dan is de schuif een filter geworden.' },
  { id: 'ken',       naam: 'Dit ken ik al',       richting: -1, grond: 'Niet minder interessant maar minder nieuw. Telt in de mixer anders dan "minder": het onderwerp blijft, de beginnersuitleg gaat weg.' },
  { id: 'nietVoorMij', naam: 'Niet voor mij',     richting: -2, grond: 'Het sterkste signaal dat een mens kan geven, en nog steeds geen blokkade: de brug-motor mag dit onderwerp nog via een ANDER onderwerp aanbieden.' },
  { id: 'verras',    naam: 'Verras me',           richting: 0,  grond: 'Eenmalig: zet de horizon voor DIT verzoek op ontdekken, zonder de schuif te verzetten. Een knop die je instelling verandert zonder het te zeggen, is een val.' }
];

/* Wat er nooit een signaal wordt, met de reden. De lijst staat in de code en
   niet in een document, zodat hij meeleest met wie hier iets toevoegt. */
const GEEN_SIGNAAL = {
  kijktijd:     'Hoe lang iemand keek is geen voorkeur maar een aandachtsmeting, en daarop optimaliseren is het patroon dat CLAUDE.md verbiedt.',
  scrollsnelheid: 'Zie kijktijd. Bovendien meet het vooral hoe goed iemands verbinding is.',
  tijdstip:     'Wanneer iemand kijkt zegt iets over zijn leven en niets over zijn nieuwsgierigheid.',
  leeftijd:     'De leeftijd stuurt wel de VEILIGHEID (kern/connect/kring.js, foundation/gezinshulp.js) en nooit de smaak. Een kind van negen krijgt hier geen ander ONDERWERP, hooguit een andere uitleg.',
  locatie:      'De lokale motor krijgt een plaats als de mens die zelf opgeeft; hij wordt niet uit het verzoek afgeleid en niet bewaard als voorkeur.'
};

/* Ziet dit eruit als een contactgegeven in plaats van een onderwerp? Dezelfde
   vorm als de actor-weigering in kern/envelop.js -- ruim, want de kosten van
   een onterecht geweigerd onderwerp zijn laag en die van een opgeslagen
   e-mailadres hoog. */
const VERDACHT = /[@]|\+?\d[\d\s.-]{6,}|\b\d{4}\s?[A-Za-z]{2}\b/;

module.exports = ({ opslag, save }) => {
  /* TWEE LEZERS, EN DAT IS GEEN DUBBELING. `van` maakt de rij aan omdat er zo
     meteen in geschreven wordt; `peil` kijkt alleen. Hier stond alleen de
     eerste, en daarmee SCHREEF elke leesroute in db.data -- zonder save(), dus
     onzichtbaar tot een andere handeling toevallig opsloeg. Het onderscheid
     woont sinds die vondst in ./opslag.js, zodat het voor alle drie de
     collecties op EEN plek staat in plaats van drie keer overgetypt. */
  const van = (sleutel) => {
    const b = opslag.bak('horizon'), k = String(sleutel || '');
    if (!k) return null;
    if (!b[k]) b[k] = { schuif: STANDAARD, onderwerpen: {} };
    if (typeof b[k].schuif !== 'number') b[k].schuif = STANDAARD;
    if (!b[k].onderwerpen) b[k].onderwerpen = {};
    return b[k];
  };
  const peil = (sleutel) => {
    const k = String(sleutel || '');
    const rij = k ? (opslag.peil('horizon') || {})[k] : null;
    return rij ? { schuif: typeof rij.schuif === 'number' ? rij.schuif : STANDAARD,
      onderwerpen: rij.onderwerpen || {} } : null;
  };

  function lees(sleutel) {
    const h = peil(sleutel) || { schuif: STANDAARD, onderwerpen: {} };
    return {
      schuif: h.schuif,
      /* Gesorteerd op NAAM en niet op gewicht. Een lijst van je eigen
         interesses op volgorde van sterkte is een ranglijst van jezelf, en zo
         leest hij ook. */
      onderwerpen: Object.entries(h.onderwerpen).sort((a, b) => a[0].localeCompare(b[0]))
        .map(([onderwerp, gewicht]) => ({ onderwerp, gewicht })),
      signalen: SIGNALEN, standaard: STANDAARD,
      uitleg: 'Deze schuif bepaalt hoeveel onbekende onderwerpen u krijgt voorgeschoteld. ' +
        'Hij staat op ' + h.schuif + ' van 100 en verandert alleen als u hem verzet.'
    };
  }

  function schuifNaar(sleutel, waarde) {
    const h = van(sleutel);
    if (!h) return { ok: false, reden: 'Een horizon hangt aan een codenaam; die ontbreekt.' };
    const n = Number(waarde);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, reden: 'De schuif loopt van 0 (vertrouwd) tot 100 (ontdekken).' };
    h.schuif = Math.round(n);
    if (save) save();
    return { ok: true, schuif: h.schuif };
  }

  /* EEN SIGNAAL. `verras` verzet de schuif NIET -- hij komt terug als
     `eenmalig` en de aanroeper geeft hem door aan de mixer. Een knop die
     stilletjes je instelling verandert, is precies de manipulatie waar deze
     laag tegen is. */
  function signaal(sleutel, onderwerp, welk) {
    const h = van(sleutel);
    const s = SIGNALEN.find(x => x.id === String(welk || ''));
    if (!h) return { ok: false, reden: 'Een horizon hangt aan een codenaam; die ontbreekt.' };
    if (!s) return { ok: false, reden: 'Dat signaal bestaat niet. Kies uit: ' + SIGNALEN.map(x => x.id).join(', ') + '.' };
    if (s.id === 'verras') return { ok: true, eenmalig: true, schuif: 100, bewaard: false };

    const o = String(onderwerp || '').trim().slice(0, 80);
    if (!o) return { ok: false, reden: 'Een signaal gaat over een onderwerp.' };
    if (VERDACHT.test(o)) return { ok: false,
      reden: 'Dit lijkt geen onderwerp maar een contactgegeven. Voorkeuren gaan hier over onderwerpen; ' +
        'persoonsgegevens horen in de kluis en niet in een smaakprofiel.' };

    /* De grenzen -3 en +3 zijn er zodat honderd keer drukken niet iets anders
       betekent dan drie keer. Een voorkeur die onbeperkt kan groeien, wordt
       vanzelf de enige. */
    const nu = Number(h.onderwerpen[o] || 0);
    const na = Math.max(-3, Math.min(3, nu + s.richting));
    if (na === 0) delete h.onderwerpen[o]; else h.onderwerpen[o] = na;
    if (save) save();
    return { ok: true, eenmalig: false, onderwerp: o, gewicht: na, bewaard: true };
  }

  return { lees, schuifNaar, signaal, SIGNALEN, GEEN_SIGNAAL, STANDAARD };
};
