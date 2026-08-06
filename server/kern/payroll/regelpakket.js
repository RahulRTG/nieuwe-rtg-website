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

const loonheffing = require('./loonheffing');

/* De velden die een pakket moet dragen om bruikbaar te zijn. Bewust met NAMEN
   en niet "alles wat er in staat": een ontbrekend tarief hoort een keuringsfout
   te zijn, geen stille nul. */
const VEREIST = [
  'minimumUurloon',      // per leeftijdsgroep, in centen
  'loonheffing',         // de tabel(len)
  'premies',             // werknemersverzekeringen (werkgeverslasten)
  'zvw',                 // inkomensafhankelijke bijdrage Zvw
  'vakantiegeld'         // opbouwpercentage
];

/* Grenzen waarbinnen een tarief aannemelijk is. Niet om precies te zijn maar om
   het onmogelijke tegen te houden: een loonheffing van 370% of een minimumloon
   van 3 cent is geen tarief maar een fout in de bron of in het inlezen. */
const AANNEMELIJK = {
  /* De ondergrens stond op 500 cent, en dat was fout -- gevonden doordat de
     keuring de eigen meegeleverde jaargang afwees. Het minimumJEUGDloon ligt
     veel lager: een vijftienjarige zit rond de 30% van het volwassen tarief,
     dus rond de 450 cent. Een grens die echte tarieven tegenhoudt is geen
     controle maar een blokkade, en dan zet de eerste de beste hem uit.

     200 cent laat elk werkelijk jeugdloon door en houdt nog steeds tegen wat
     een fout in de bron of in het inlezen is (een tarief van 3 cent, of een
     bedrag dat per ongeluk in euro's in plaats van centen staat). */
  minimumUurloonCenten: [200, 10000],
  percentage: [0, 0.75]
};

const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

function maakRegelpakket({ db, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());

  function bak() {
    if (!db.data.payrollRegels || typeof db.data.payrollRegels !== 'object') db.data.payrollRegels = {};
    return db.data.payrollRegels;
  }
  const lijstVan = (land) => {
    const b = bak();
    const l = String(land || 'NL').toUpperCase();
    if (!Array.isArray(b[l])) b[l] = [];
    return b[l];
  };

  /* ---------- keuren ---------- */
  /* Levert een lijst bezwaren. Leeg = goed. Nooit een boolean: wie een pakket
     afkeurt hoort te kunnen zeggen waarom, anders staat de beheerder met een
     rood kruis en geen richting. */
  function keur(pakket) {
    const bez = [];
    if (!pakket || typeof pakket !== 'object') return ['Geen pakket ontvangen.'];
    if (!/^[A-Z]{2}$/.test(String(pakket.land || ''))) bez.push('Land ontbreekt of is geen landcode van twee letters.');
    if (!isDatum(pakket.geldigVan)) bez.push('geldigVan ontbreekt of is geen datum (JJJJ-MM-DD).');
    if (pakket.geldigTot && !isDatum(pakket.geldigTot)) bez.push('geldigTot is geen datum (JJJJ-MM-DD).');
    if (pakket.geldigTot && pakket.geldigTot < pakket.geldigVan) bez.push('geldigTot ligt voor geldigVan.');
    if (!pakket.versie || typeof pakket.versie !== 'string') bez.push('versie ontbreekt.');

    const r = pakket.regels;
    if (!r || typeof r !== 'object') { bez.push('regels ontbreken.'); return bez; }
    for (const veld of VEREIST) if (r[veld] == null) bez.push('regel "' + veld + '" ontbreekt.');

    // aannemelijkheid: alleen wat er is, en alleen wat een getal hoort te zijn
    const [minL, maxL] = AANNEMELIJK.minimumUurloonCenten;
    if (r.minimumUurloon && typeof r.minimumUurloon === 'object') {
      for (const groep of Object.keys(r.minimumUurloon)) {
        const c = r.minimumUurloon[groep];
        if (typeof c !== 'number' || !Number.isFinite(c)) bez.push('minimumUurloon.' + groep + ' is geen getal.');
        else if (c < minL || c > maxL) bez.push('minimumUurloon.' + groep + ' (' + c + ' cent) is niet aannemelijk.');
      }
    }
    /* De loonheffingstabel keurt zichzelf (./loonheffing.js): schijven die niet
       oplopen, een korting met een onmogelijk deel, een laatste schijf met een
       bovengrens. Die kennis hoort bij de tabel en niet hier -- anders staat er
       op twee plekken wat een geldige tabel is, en dan lopen ze uit elkaar. */
    if (r.loonheffing != null) for (const b of loonheffing.keurTabel(r.loonheffing)) bez.push(b);

    const [minP, maxP] = AANNEMELIJK.percentage;
    for (const veld of ['vakantiegeld', 'zvw']) {
      const p = r[veld];
      if (p == null) continue;
      if (typeof p !== 'number' || !Number.isFinite(p)) bez.push(veld + ' is geen getal.');
      else if (p < minP || p > maxP) bez.push(veld + ' (' + p + ') is niet aannemelijk als deel van 1.');
    }
    return bez;
  }

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
      geldigVan: pakket.geldigVan,
      geldigTot: pakket.geldigTot || null,
      regels: pakket.regels,
      stand: 'ongecontroleerd',
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
  function merkAan(land, versie, door) {
    const p = lijstVan(land).find(x => x.versie === versie);
    if (!p) return { status: 404, error: 'Dit regelpakket kennen we niet.' };
    if (p.stand === 'goedgekeurd') return { ok: true, ongewijzigd: true, versie };
    if (!door) return { status: 400, error: 'Noteer wie dit pakket goedkeurt.' };
    p.stand = 'goedgekeurd'; p.goedgekeurdDoor = door; p.goedgekeurdOp = tijd();
    save();
    return { ok: true, versie, stand: p.stand };
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
    goedgekeurdOp: p.goedgekeurdOp }));

  return { keur, neemOp, merkAan, opDatum, opVersie, alle, VEREIST };
}

module.exports = { maakRegelpakket, VEREIST, AANNEMELIJK };
