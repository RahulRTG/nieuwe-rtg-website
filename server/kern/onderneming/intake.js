/* DE INTAKE: wat we van de persoon en van het idee weten.

   Dit is de invoer waar de kansverkenning, de simulatie en de stress test op
   rusten, en daarom staat hier ook wat er nog ONTBREEKT. Dat is geen
   vriendelijkheid maar lat-regel 3: een simulatie die op halve invoer toch een
   getal geeft, is een meter die niet zakt als zijn invoer wegvalt -- en juist
   dat getal wordt overgeschreven in een ondernemingsplan en aan een bank
   getoond.

   HET VOLUME KOMT VAN DE ONDERNEMER, NIET VAN ONS. `verwachtPerMaand` is
   opzettelijk een vraag en geen berekening. We zouden het kunnen afleiden uit
   uren en dienstduur, en dat zou er wetenschappelijk uitzien, maar het zou een
   verzonnen getal zijn met ons gezag eronder. De opzet is de andere kant op:
   de ondernemer geeft zijn eigen aannames, de simulatie rekent ze door, en de
   stress test valt ze aan. Wie een aanname aanvalt die hij zelf heeft verzonnen,
   speelt toneel.

   De brancelijst komt uit kern/aanmeldingen/bedrijf.js -- dezelfde 31 genres
   waarmee een zaak wordt klaargezet. Overtypen zou betekenen dat een nieuw
   genre hier stil buiten valt (regel 4). */
'use strict';

const { GENRES } = require('../aanmeldingen/bedrijf');

const SAMEN = ['alleen', 'team'];
const VERKOOPMODEL = ['eenmalig', 'herhaling', 'abonnement'];

/* Wat elk onderdeel nodig heeft voordat het mag rekenen. Los benoemd zodat
   een module niet zelf gaat gokken of hij genoeg heeft. */
const NODIG = {
  simulatie: ['idee.prijs', 'idee.kostprijs', 'idee.verwachtPerMaand', 'idee.vasteLasten'],
  kans: ['idee.branche', 'idee.plaats'],
  plan: ['idee.branche', 'idee.wat', 'idee.doelgroep', 'idee.plaats', 'persoon.urenPerWeek']
};

const getal = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
};

module.exports = ({ schoon }) => {
  const scho = (v, n) => schoon(v, n);
  const lijst = (v, n, max) => (Array.isArray(v) ? v.slice(0, max).map(x => scho(x, n)).filter(Boolean) : []);

  /* De intake bijwerken. Alles is optioneel en alles is later te wijzigen:
     een intake is een gesprek en geen formulier dat in één keer af moet. Wat
     er wordt meegegeven wordt gezet, de rest blijft staan. */
  function intakeZet(o, body) {
    const b = body || {};
    const i = o.intake || (o.intake = { persoon: {}, idee: {} });
    const p = b.persoon || {};
    const d = b.idee || {};

    if (p.urenPerWeek !== undefined) i.persoon.urenPerWeek = getal(p.urenPerWeek, 100);
    if (p.ervaringJaren !== undefined) i.persoon.ervaringJaren = getal(p.ervaringJaren, 60);
    if (p.startkapitaal !== undefined) i.persoon.startkapitaal = getal(p.startkapitaal, 1e9);
    if (p.vaardigheden !== undefined) i.persoon.vaardigheden = lijst(p.vaardigheden, 60, 12);
    if (p.samen !== undefined) i.persoon.samen = SAMEN.includes(p.samen) ? p.samen : null;
    if (p.verkoopervaring !== undefined) i.persoon.verkoopervaring = !!p.verkoopervaring;

    if (d.branche !== undefined) i.idee.branche = GENRES.includes(d.branche) ? d.branche : null;
    if (d.wat !== undefined) i.idee.wat = scho(d.wat, 300);
    if (d.doelgroep !== undefined) i.idee.doelgroep = scho(d.doelgroep, 200);
    if (d.plaats !== undefined) i.idee.plaats = scho(d.plaats, 80);
    if (d.onderscheid !== undefined) i.idee.onderscheid = scho(d.onderscheid, 300);
    if (d.verkoopmodel !== undefined) i.idee.verkoopmodel = VERKOOPMODEL.includes(d.verkoopmodel) ? d.verkoopmodel : null;
    if (d.prijs !== undefined) i.idee.prijs = getal(d.prijs, 1e7);
    if (d.kostprijs !== undefined) i.idee.kostprijs = getal(d.kostprijs, 1e7);
    if (d.verwachtPerMaand !== undefined) i.idee.verwachtPerMaand = getal(d.verwachtPerMaand, 1e6);
    if (d.vasteLasten !== undefined) i.idee.vasteLasten = getal(d.vasteLasten, 1e7);
    if (d.grootsteKlantDeel !== undefined) i.idee.grootsteKlantDeel = getal(d.grootsteKlantDeel, 100);

    i.bijgewerkt = new Date().toISOString();
    return i;
  }

  /* Staat dit veld ingevuld? Een 0 telt als ingevuld -- "ik heb geen vaste
     lasten" is een antwoord, en het zou onzichtbaar wegvallen bij een
     waarheidstoets. Dat is dezelfde familie als de index van
     routes/supplier/wensen.js: JavaScript geeft een bruikbaar antwoord op iets
     wat geen invoer is. */
  function heeft(intake, pad) {
    const [deel, veld] = pad.split('.');
    const v = intake && intake[deel] ? intake[deel][veld] : undefined;
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }

  /* Wat er voor een bepaald onderdeel nog ontbreekt. Lege lijst = mag rekenen. */
  function intakeOntbreekt(intake, waarvoor) {
    const nodig = NODIG[waarvoor];
    if (!nodig) return null;
    return nodig.filter(p => !heeft(intake, p));
  }

  function intakeBeeld(o) {
    const i = o.intake || { persoon: {}, idee: {} };
    return {
      persoon: i.persoon || {}, idee: i.idee || {}, bijgewerkt: i.bijgewerkt || null,
      ontbreekt: Object.fromEntries(Object.keys(NODIG).map(k => [k, intakeOntbreekt(i, k)])),
      branches: GENRES.slice(), verkoopmodellen: VERKOOPMODEL.slice()
    };
  }

  return { INTAKE_NODIG: NODIG, intakeZet, intakeOntbreekt, intakeBeeld, intakeHeeft: heeft };
};

module.exports.NODIG = NODIG;
module.exports.GENRES = GENRES;
