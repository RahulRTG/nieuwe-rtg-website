/* Payroll OS: HET REGELPAKKET -- loonregels en tarieven als jaargangen.

   DE REGEL DIE ALLES DRAAGT. Een oude loonstrook mag na een regelwijziging
   nooit stilletjes veranderen. Dat lukt alleen als een berekening niet naar
   "de tarieven" kijkt maar naar EEN VERSIE ervan, en die versie op de run
   gestempeld staat. Daarom is een tarief hier nooit een constante in de code
   maar een jaargang met een eigen versie-id, een geldigheidsperiode en een
   herkomst. De loonmotor vraagt om het pakket dat gold OP DE DATUM van de
   periode die hij draait, en schrijft dat versie-id in de run. Komt er daarna
   een nieuwe jaargang binnen, dan raakt die de oude run niet aan -- hij kan er
   niet eens bij.

   AUTOMATISCH BIJWERKEN, EN WAAROM DAT IN DRIE STAPPEN GAAT. De tarieven
   veranderen elk jaar en soms halverwege; ze met de hand nabouwen is precies
   hoe een loonmotor stilletjes fout gaat. Binnenhalen gaat daarom vanzelf. Maar
   "vanzelf" mag hier niet betekenen "ongezien in gebruik":

     1. OPHALEN. Een bron levert een pakket aan (een URL, een bestand, een
        koppeling met de Belastingdienst). De bron is inwisselbaar; deze module
        weet niets van waar het vandaan komt, alleen wat er binnenkomt.
     2. KEUREN. Vorm, volledigheid en aannemelijkheid. Een pakket dat de keuring
        niet haalt komt niet binnen -- en een pakket dat er wel in komt draagt de
        stand `ongecontroleerd` tot een mens het aanmerkt.
     3. INGAAN. Een pakket geldt vanaf zijn eigen ingangsdatum, geen dag eerder.
        Een jaargang 2027 die in november binnenkomt ligt tot 1 januari klaar
        zonder iets te doen.

   DE KEURING IS GEEN FORMALITEIT. Een loonmotor die met verzonnen tarieven
   groen draait is gevaarlijker dan een die nog niet draait: het verschil merk
   je pas bij de aangifte, of bij de werknemer. Daarom mag een DEFINITIEVE run
   alleen op een goedgekeurd pakket; een proefrun mag op een ongecontroleerd
   pakket, en zegt dat er dan luid bij.

   WAT ER NIET IN DEZE CODE STAAT: bedragen. Ook niet "even" als terugval. Zie
   ./jaargangen/ voor de meegeleverde pakketten en hun stand. */
'use strict';

/* De keuring woont in ./regelpakket-keuring.js; zie daar waarom. */
const { keur, VEREIST, AANNEMELIJK } = require('./regelpakket-keuring');

const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

function maakRegelpakket({ opslag, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());

  const bak = () => opslag.bak('payrollRegels');
  const lijstVan = (land) => {
    const b = bak();
    const l = String(land || 'NL').toUpperCase();
    if (!Array.isArray(b[l])) b[l] = [];
    return b[l];
  };

  /* De keuring staat in ./regelpakket-keuring.js: een eigen onderwerp (WANNEER
     is iets een geldig pakket) naast dit bestand (hoe bewaar en vind je er
     een), en dit bestand ging over de 10 KB. */

  /* ---------- binnenhalen ---------- */
  /* Een pakket toevoegen. Komt het door de keuring, dan komt het binnen met de
     stand 'ongecontroleerd' -- ook als de bron een koppeling met de
     Belastingdienst is. Een mens merkt het aan; tot dan mag er geen definitieve
     run op draaien.

     Dezelfde versie twee keer binnenhalen doet niets. Dat is geen luxe: een
     bijwerkronde die elk uur draait zou anders elke keer een nieuw pakket
     stapelen, en dan is "welke versie gold er" weer onbeantwoordbaar. */
  function neemOp(pakket, bron) {
    const bez = keur(pakket);
    if (bez.length) return { status: 422, error: 'Dit regelpakket is afgekeurd.', bezwaren: bez };
    const lijst = lijstVan(pakket.land);
    const bestaand = lijst.find(p => p.versie === pakket.versie);
    if (bestaand) return { ok: true, ongewijzigd: true, versie: bestaand.versie, stand: bestaand.stand };

    const opgenomen = {
      land: String(pakket.land).toUpperCase(),
      versie: String(pakket.versie),
      valuta: pakket.valuta ? String(pakket.valuta).toUpperCase() : null,
      geldigVan: pakket.geldigVan,
      geldigTot: pakket.geldigTot || null,
      regels: pakket.regels,
      stand: 'ongecontroleerd',
      /* DE ZELFVERKLARING VAN HET PAKKET, machinaal bewaard. De meegeleverde
         jaargang zegt in `_let_op` dat de cijfers niet tegen het Handboek zijn
         gelegd en niet geschikt zijn voor een definitieve loonrun. Dat stond
         alleen in het bestand, dus alleen wie het bestand opende wist het -- en
         aanmerken kon gewoon (LAT.md regel 6: een belofte in tekst is een
         belofte in code). Hij reist nu mee, tot in de run die erop draait. */
      waarschuwing: typeof pakket._let_op === 'string' ? pakket._let_op.slice(0, 600) : null,
      bron: {
        soort: (bron && bron.soort) || 'handmatig',
        naam: (bron && bron.naam) || null,
        url: (bron && bron.url) || null,
        opgehaaldOp: tijd()
      },
      goedgekeurdDoor: null, goedgekeurdOp: null,
      opgenomenOp: tijd()
    };
    lijst.push(opgenomen);
    lijst.sort((a, b) => (a.geldigVan < b.geldigVan ? -1 : a.geldigVan > b.geldigVan ? 1 : 0));
    save();
    return { ok: true, versie: opgenomen.versie, stand: opgenomen.stand, geldigVan: opgenomen.geldigVan };
  }

  /* Aanmerken door een mens. Wie dat doet en wanneer komt erbij te staan; dat
     is de tweede helft van "welke regel en versie zijn gebruikt". */
  function merkAan(land, versie, door, opties) {
    const p = lijstVan(land).find(x => x.versie === versie);
    if (!p) return { status: 404, error: 'Dit regelpakket kennen we niet.' };
    if (p.stand === 'goedgekeurd') return { ok: true, ongewijzigd: true, versie };
    if (!door) return { status: 400, error: 'Noteer wie dit pakket goedkeurt.' };
    /* EEN PAKKET DAT ZEGT DAT HET NIET DEUGT, GAAT NIET ZOMAAR AAN. Aanmerken
       betekent "ik heb deze tarieven tegen de bron gelegd"; bij een pakket dat
       zelf meldt dat dat NIET is gebeurd, is dat een zwaardere uitspraak. Hij
       kan nog steeds -- er moet mee te werken zijn, en de mens beslist -- maar
       dan met zoveel woorden en met een reden die blijft staan. Wat erop draait
       weet daarna dat het op zulke tabellen draait. */
    const o = opties || {};
    if (p.waarschuwing && o.ondanks !== true)
      return { status: 409, error: 'Dit pakket meldt zelf dat het ongecontroleerd is; aanmerken kan alleen uitdrukkelijk.',
        waarschuwing: p.waarschuwing, versie };
    if (p.waarschuwing && !String(o.reden || '').trim())
      return { status: 400, error: 'Noteer waarom dit ongecontroleerde pakket toch wordt aangemerkt.' };
    p.stand = 'goedgekeurd'; p.goedgekeurdDoor = door; p.goedgekeurdOp = tijd();
    if (p.waarschuwing) { p.ondanksWaarschuwing = String(o.reden).trim().slice(0, 300); p.opDemoTabellen = true; }
    save();
    return { ok: true, versie, stand: p.stand, opDemoTabellen: !!p.opDemoTabellen };
  }

  /* ---------- opzoeken ---------- */
  /* Het pakket dat gold op een datum. Niet "het nieuwste": een run over juni
     hoort op de regels van juni te draaien, ook als hij in september wordt
     gedraaid of overgedaan. Daar zit het hele verschil tussen een herhaalbare
     en een driftende berekening. */
  function opDatum(land, datum) {
    const d = String(datum || '').slice(0, 10);
    if (!isDatum(d)) return null;
    const kandidaten = lijstVan(land).filter(p => p.geldigVan <= d && (!p.geldigTot || p.geldigTot >= d));
    if (!kandidaten.length) return null;
    // de laatst ingegane wint; bij een tussentijdse wijziging is dat de juiste
    return kandidaten[kandidaten.length - 1];
  }

  /* Een pakket op zijn versie, voor het overdoen van een oude run. */
  const opVersie = (land, versie) => lijstVan(land).find(p => p.versie === versie) || null;
  const alle = (land) => lijstVan(land).map(p => ({ versie: p.versie, geldigVan: p.geldigVan,
    geldigTot: p.geldigTot, stand: p.stand, bron: p.bron, goedgekeurdDoor: p.goedgekeurdDoor,
    goedgekeurdOp: p.goedgekeurdOp, valuta: p.valuta || null,
    waarschuwing: p.waarschuwing || null, opDemoTabellen: !!p.opDemoTabellen,
    ondanksWaarschuwing: p.ondanksWaarschuwing || null }));

  return { keur, neemOp, merkAan, opDatum, opVersie, alle, VEREIST };
}

module.exports = { maakRegelpakket, VEREIST, AANNEMELIJK };
