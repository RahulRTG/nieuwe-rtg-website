/* DE PRIVE-INVOER VAN EEN REISGENOOT -- wat ieder voor zichzelf opgeeft.

   Dit is stap 1 van het programma "Five People. Five Private Contexts. One
   Shared Outcome" (onderzoek van 12 oktober 2026): voordat RTG een voorstel
   voor een hele groep kan samenstellen, moet ieder lid van die groep iets
   kunnen opgeven dat van HEM is. Tot nu toe kende het reisgezelschap alleen
   berichten op een tijdlijn; een budget of een voorkeur had nergens een plek.

   DRIE DINGEN PER DEELNEMER, en met opzet niet meer:
     plafond      wat iemand per persoon wil uitgeven, in centen
     data         wanneer iemand kan, als periodes
     voorkeuren   wat iemand graag of liever niet heeft, uit een GESLOTEN lijst
   Vrije tekst ontbreekt bewust. Een vrij veld wordt een plek waar iemand zijn
   reden opschrijft ("ik moet sparen voor de scheiding"), en die reden hoort
   niemand te bereiken -- ook Rahul niet als groepsadviseur.

   DE REGEL WAAR DIT BESTAND OM DRAAIT: DE INVOER VAN IEMAND GAAT NIET NAAR
   IEMAND ANDERS. Niet naar de organisator, niet naar een reisgenoot, niet naar
   een meekijker. Er is daarom geen route die de invoer van een ANDER
   teruggeeft. Wat anderen mogen weten is alleen HOEVEEL deelnemers iets hebben
   ingevuld -- niet wie, want "iedereen behalve Remi" wijst al een mens aan. De
   gezamenlijke berekening (./reisgezelschap-opties.js) en de instemming krijgen
   een eigen, smalle weg naar deze gegevens (`voorDeBerekening`, aangesloten in
   ./reisgezelschap-groep.js) en geven alleen een groepsuitkomst vrij.

   EERLIJK OVER WAT DIT NIET IS: de server van RTG ziet deze gegevens, op
   codenaam. Dit is een ontwerp dat bepaalt wat ANDERE DEELNEMERS te zien
   krijgen, geen versleutelde berekening. Dat staat ook in het antwoord aan het
   lid (`wieZiet`), want een belofte die groter klinkt dan hij is, is de fout
   die het RTG Zegel maakte.

   WIE DEELNEMER IS: de eigenaar van de reis en elke AANVAARDE reisgenoot. Een
   meekijker reist niet mee en heeft dus geen budget of data in te brengen. Wie
   uit het gezelschap gaat of wordt gehaald, verliest zijn invoer meteen
   (`wisVoorLid`, aangeroepen vanuit ./reisgezelschap.js): een plafond dat blijft
   staan nadat iemand weg is, telt anders stil mee in een voorstel waar hij
   niet meer bij hoort.

   OPSLAG: een kaart op de sleutel van het LID (`reisOpgaven[key][reisSleutel]`),
   zodat vergeten hem in een keer meeneemt (kern/vergeten/eigen.js). */
'use strict';

/* De gesloten lijst. Wat hier niet staat, kan niet worden opgegeven -- een
   onbekende waarde wordt geweigerd en niet stil weggelaten, zodat het lid weet
   dat zijn keuze niet is aangekomen. */
const VOORKEUREN = Object.freeze([
  'strand', 'stad', 'natuur', 'bergen', 'cultuur', 'eten', 'rust', 'actief',
  'nachtleven', 'kindvriendelijk', 'toegankelijk', 'korte-reistijd'
]);
const MAX_PERIODES = 6;
const MAX_PLAFOND = 10000000;   // € 100.000 per persoon: daarboven is het een typefout
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function reisSleutel(eigenaar, reisId) { return eigenaar + '|' + reisId; }

/* Een invoer is geldig of hij wordt geweigerd MET de reden. Er wordt niets
   gerepareerd: een plafond van -5 wordt geen 0, en een periode met het einde
   voor het begin wordt niet omgedraaid. Wie stil verbetert, legt iets vast dat
   het lid niet heeft gezegd. */
function keur(invoer) {
  const i = invoer || {};
  const uit = { plafond: null, data: [], voorkeuren: [], nietGraag: [] };
  if (i.plafond != null && i.plafond !== '') {
    const p = Number(i.plafond);
    if (!Number.isInteger(p) || p <= 0 || p > MAX_PLAFOND) {
      return { fout: 'Geef uw plafond op als een heel aantal centen per persoon, groter dan nul en hoogstens ' + MAX_PLAFOND + '.' };
    }
    uit.plafond = p;
  }
  if (i.data != null) {
    if (!Array.isArray(i.data) || i.data.length > MAX_PERIODES) {
      return { fout: 'Geef hoogstens ' + MAX_PERIODES + ' periodes op.' };
    }
    for (const d of i.data) {
      const van = String((d || {}).van || ''), tot = String((d || {}).tot || '');
      if (!DATUM.test(van) || !DATUM.test(tot) || isNaN(Date.parse(van)) || isNaN(Date.parse(tot))) {
        return { fout: 'Een periode heeft een begin- en einddatum als JJJJ-MM-DD.' };
      }
      if (tot < van) return { fout: 'Een periode eindigt niet voor ze begint (' + van + ' tot ' + tot + ').' };
      uit.data.push({ van, tot });
    }
  }
  for (const veld of ['voorkeuren', 'nietGraag']) {
    if (i[veld] == null) continue;
    if (!Array.isArray(i[veld])) return { fout: 'Kies ' + veld + ' uit de lijst.' };
    for (const v of i[veld]) {
      if (!VOORKEUREN.includes(v)) return { fout: '"' + String(v).slice(0, 40) + '" staat niet in de lijst. Kies uit: ' + VOORKEUREN.join(', ') + '.' };
      if (!uit[veld].includes(v)) uit[veld].push(v);
    }
  }
  const dubbel = uit.voorkeuren.find(v => uit.nietGraag.includes(v));
  if (dubbel) return { fout: '"' + dubbel + '" kan niet tegelijk graag en liever niet zijn.' };
  return { invoer: uit };
}

const WIE_ZIET = 'Alleen u ziet wat u hier invult. Anderen in het gezelschap zien alleen hoeveel ' +
  'deelnemers iets hebben ingevuld, niet wie en niet wat. De server van RTG verwerkt uw invoer ' +
  'om een groepsvoorstel te kunnen maken; dat is geen versleutelde berekening.';

module.exports.maakGezelschapOpgave = ({ db, save, klok, leden, reisVan }) => {
  const nu = () => klok.datum().toISOString();
  const eigen = require('./eigencollectie')({ db, domein: 'kern/reisgezelschap-opgave', bezit: { reisOpgaven: 'kaart' } });
  const kaart = () => eigen.bak('reisOpgaven');

  /* Wie deze reis als DEELNEMER kent, en van wie hij is. `null` = geen
     deelnemer, en dan bestaat de reis voor deze vraag niet (zelfde vorm als de
     poort: geen 403 met inhoud eromheen). */
  function deelnameVan(key, reisId) {
    if (reisVan(key, reisId)) return { eigenaar: key };
    const rec = leden().find(x => x.reis === reisId && x.lid === key && x.stand === 'aanvaard' && x.rol === 'reisgenoot');
    return rec ? { eigenaar: rec.eigenaar } : null;
  }
  function deelnemers(eigenaar, reisId) {
    return [eigenaar].concat(leden()
      .filter(x => x.reis === reisId && x.eigenaar === eigenaar && x.stand === 'aanvaard' && x.rol === 'reisgenoot')
      .map(x => x.lid));
  }
  const NIET = { status: 404, error: 'U reist niet mee met deze reis.' };

  function mijnOpgave(key, reisId) {
    const d = deelnameVan(key, reisId);
    if (!d) return NIET;
    const rec = (kaart()[key] || {})[reisSleutel(d.eigenaar, reisId)] || null;
    return { status: 200, ok: true, invoer: rec, keuzes: VOORKEUREN, wieZiet: WIE_ZIET };
  }

  /* ZETTEN. Hetzelfde nog eens zetten verandert niets, ook de versie niet: een
     dubbeltik is geen nieuwe opgave. De versie telt alleen echte wijzigingen,
     en stap 2 heeft dat getal nodig om herhaald proberen te herkennen. */
  function zetOpgave(key, reisId, invoer) {
    const d = deelnameVan(key, reisId);
    if (!d) return NIET;
    const k = keur(invoer);
    if (k.fout) return { status: 400, error: k.fout };
    const mijn = kaart()[key] = kaart()[key] || {};
    const sl = reisSleutel(d.eigenaar, reisId);
    const oud = mijn[sl];
    const zelfde = oud && JSON.stringify({ plafond: oud.plafond, data: oud.data, voorkeuren: oud.voorkeuren, nietGraag: oud.nietGraag }) ===
      JSON.stringify(k.invoer);
    if (zelfde) return { status: 200, ok: true, invoer: oud, gewijzigd: false, wieZiet: WIE_ZIET };
    mijn[sl] = Object.assign({}, k.invoer, { versie: oud ? oud.versie + 1 : 1, bijgewerkt: nu() });
    save();
    return { status: 200, ok: true, invoer: mijn[sl], gewijzigd: true, wieZiet: WIE_ZIET };
  }

  function wisOpgave(key, reisId) {
    const d = deelnameVan(key, reisId);
    if (!d) return NIET;
    const mijn = kaart()[key];
    const sl = reisSleutel(d.eigenaar, reisId);
    if (mijn && mijn[sl]) { delete mijn[sl]; if (!Object.keys(mijn).length) delete kaart()[key]; save(); }
    return { status: 200, ok: true, invoer: null };
  }

  /* HOEVEEL, NIET WIE. Elke deelnemer mag het weten, en het is een aantal:
     zodra er staat wie er nog ontbreekt, is "nog niet ingevuld" een eigenschap
     van een mens geworden. */
  function voortgang(key, reisId) {
    const d = deelnameVan(key, reisId);
    if (!d) return NIET;
    const sl = reisSleutel(d.eigenaar, reisId);
    const wie = deelnemers(d.eigenaar, reisId);
    const ingevuld = wie.filter(k => (kaart()[k] || {})[sl]).length;
    return { status: 200, ok: true, deelnemers: wie.length, ingevuld,
      uitleg: 'Een aantal en geen namen: wie nog niets invulde, blijft onzichtbaar voor de rest.' };
  }

  /* Wie uit het gezelschap gaat, neemt zijn invoer mee. */
  function wisVoorLid(lid, eigenaar, reisId) {
    const mijn = kaart()[lid];
    const sl = reisSleutel(eigenaar, reisId);
    if (mijn && mijn[sl]) { delete mijn[sl]; if (!Object.keys(mijn).length) delete kaart()[lid]; return true; }
    return false;
  }

  /* DE ENIGE WEG NAAR DE OPGAVEN VAN ANDEREN, en hij gaat naar de berekening
     (./reisgezelschap-opties.js) en nergens anders heen. Geen route roept hem
     aan; wat de berekening teruggeeft is een groepsuitkomst en per lid alleen
     zijn eigen reden. Een `null` op een plek betekent: deze deelnemer gaf nog
     niets op. */
  function voorDeBerekening(eigenaar, reisId) {
    const sl = reisSleutel(eigenaar, reisId);
    return deelnemers(eigenaar, reisId).map(k => ({ key: k, opgave: (kaart()[k] || {})[sl] || null }));
  }

  return { VOORKEUREN, voortgang, wisVoorLid, deelnameVan, voorDeBerekening,
    routes: { mijnOpgave, zetOpgave, wisOpgave } };
};
module.exports.VOORKEUREN = VOORKEUREN;
module.exports.keur = keur;
