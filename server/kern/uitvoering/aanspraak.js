/* UITVOERENDE MEDIA (deelmodule): DE AANSPRAAK -- wat een lid van een maker
   mag verlangen, en op welke grond.

   HET WOORD IS EEN BESLUIT EN GEEN SYNONIEM. Er stond "capability" in de opzet,
   en dat woord is in dit huis al twee keer bezet: in het lagenmodel van
   PLATFORM.md betekent het een genre-cap, in dat van OS.md een bedrijfsfunctie
   (OS.md par. 4.2 meet het). Een derde betekenis erbij zou de 78ste botsing uit
   SEMANTIEK.json zijn, en dan meteen in een verkoopbelofte aan makers.

   `aanspraak` kwam uit dezelfde meting als volledig vrij (nul treffers in
   server/ en public/, op één stuk lopende tekst in de juridische voorwaarden na
   -- waar het precies dit betekent). Het is ook het enige woord dat de RELATIE
   beschrijft in plaats van een kant ervan:

     capability  wat een systeem KAN
     toestemming wat iemand MAG
     toegang     of een deur opengaat
     abonnement  een betaalvorm
     product     wat er verkocht wordt
     AANSPRAAK   wat deze mens van deze maker mag verlangen, en waarom

   EEN AANSPRAAK HANGT AAN EEN GROND EN NOOIT AAN EEN BOOLEAN. Dat is dezelfde
   regel die WAARDE.md aan uitbetalen stelt: niet `premium = true`, maar een
   HERKOMST (waar komt dit vandaan) plus een BRON (welke gebeurtenis precies).
   Zonder allebei komt er geen aanspraak. Daardoor is van elke aanspraak na te
   gaan waar hij vandaan komt, ook jaren later, en kan hij niet per ongeluk
   ontstaan doordat ergens een vlag op waar sprong.

   DE HERKOMST VERSCHILT; DE UITVOERING HOEFT DAT NIET TE WETEN. Een aanspraak
   uit een aankoop en een aanspraak uit een cadeau of een werkgeversbudget zijn
   voor ./uitvoer.js hetzelfde ding. Dat is het hele punt van de primitief: het
   gratis pad en het betaalde pad delen één deur, dus er is er maar één die
   dicht kan zitten.

   WAT HIER NIET GEBEURT: een lid verleent zichzelf niets. Verlenen doet de
   maker van de partituur (voor zijn eigen werk) of het kantoor; wie dat mag,
   staat in routes/uitvoering.js en niet hier.

   EN HET IS EEN HUISWOORD, GEEN SCHERMWOORD. Een lid ziet "jouw aankopen",
   "jouw cursussen", "jouw kaartjes" -- nooit "mijn aanspraken", net zomin als
   hij hoort te weten dat een montage intern een lijst fragmenten is. */
'use strict';

/* De gesloten lijst, met per herkomst wat een lid erover te horen krijgt. Een
   gesloten lijst en geen vrij tekstveld, om dezelfde reden als de doelen in
   kern/appstore/machtigingen.js: vrije tekst levert "om u beter van dienst te
   zijn" op, en dat is niet te vergelijken, niet te doorzoeken en niet te
   toetsen. Een herkomst erbij is een besluit, geen invulveld. */
const HERKOMSTEN = {
  aankoop:     'gekocht',
  cadeau:      'gekregen',
  werkgever:   'via uw werk',
  kaartje:     'met een kaartje',
  abonnement:  'via uw abonnement',
  promotie:    'uit een actie',
  organisator: 'van de organisator',
  maker:       'van de maker zelf'
};
const MAX_PER_LID = 500;
const CODE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;   // de naam van het aanbod

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const id = () => 'asp' + crypto.randomBytes(4).toString('hex');

  function tabel() {
    if (!db.data.aanspraken || typeof db.data.aanspraken !== 'object') db.data.aanspraken = {};
    return db.data.aanspraken;
  }
  const rijVan = (key) => {
    const t = tabel();
    if (!Array.isArray(t[key])) t[key] = [];
    return t[key];
  };

  /* Geldig wordt bij ELKE vraag opnieuw gerekend en niet als vlag bewaard --
     dezelfde regel als een vakbewijs in kern/vakbewijs.js: een stuk dat
     gisteren geldig was, is dat vandaag misschien niet, en een opgeslagen
     `geldig: true` blijft precies dan staan wanneer hij fout is. */
  function geldig(a, opMoment) {
    if (a.ingetrokken) return { ok: false, reden: 'Deze aanspraak is ingetrokken op ' + a.ingetrokken.slice(0, 10) + '.' };
    if (a.tot && new Date(a.tot).getTime() <= (opMoment || Date.now()))
      return { ok: false, reden: 'Deze aanspraak liep af op ' + String(a.tot).slice(0, 10) + '.' };
    return { ok: true };
  }

  const beeld = (a) => ({
    id: a.id, code: a.code, herkomst: a.herkomst, herkomstNaam: HERKOMSTEN[a.herkomst] || a.herkomst,
    bron: a.bron, at: a.at, tot: a.tot || null,
    geldig: geldig(a).ok, reden: geldig(a).ok ? null : geldig(a).reden
  });

  /* ---- verlenen ----
     `bron` is verplicht en dat is de kern van deze module: het is de
     gebeurtenis waar de aanspraak uit voortkomt (een betaal-id, een
     kaartnummer, een besluit van het kantoor). Zonder bron zou een aanspraak
     precies dat zijn wat we niet willen -- een vlag die aanstaat. */
  function verleen(key, opdracht) {
    const o = opdracht || {};
    const code = String(o.code || '').toLowerCase();
    if (!CODE.test(code)) return { status: 400, error: 'Een aanspraak draagt een code van 3 tot 60 tekens (letters, cijfers, koppeltekens).' };
    if (!HERKOMSTEN[o.herkomst])
      return { status: 400, error: 'Geef een herkomst: ' + Object.keys(HERKOMSTEN).join(', ') + '.' };
    const bron = schoon(o.bron, 120);
    if (!bron) return { status: 400, error: 'Een aanspraak hangt altijd aan een grond. Noem de bron (een betaling, een kaartje, een besluit).' };
    let tot = null;
    if (o.tot != null && o.tot !== '') {
      const d = new Date(o.tot);
      if (isNaN(d.getTime())) return { status: 400, error: 'De einddatum is geen geldige datum.' };
      if (d.getTime() <= Date.now()) return { status: 400, error: 'Een aanspraak die nu al is afgelopen, verlenen we niet.' };
      tot = d.toISOString();
    }
    const rij = rijVan(key);
    if (rij.length >= MAX_PER_LID) return { status: 409, error: 'Dit lid heeft de bovengrens van ' + MAX_PER_LID + ' aanspraken bereikt.' };
    /* Twee keer dezelfde code is geen fout: iemand kan hetzelfde opnieuw kopen
       of er een cadeau bij krijgen. De LANGSTE geldige telt, en de andere blijft
       gewoon staan -- de geschiedenis van waar iets vandaan kwam, wissen we niet. */
    const a = { id: id(), code, herkomst: o.herkomst, bron, at: nu(), tot, ingetrokken: null };
    rij.unshift(a); save();
    return { status: 200, ok: true, aanspraak: beeld(a) };
  }

  /* ---- de vraag die ./uitvoer.js stelt ----
     Geeft de GRONDIGSTE reden terug en niet alleen "nee": een lid dat een
     verlopen aanspraak heeft, hoort iets anders te lezen dan een lid dat er
     nooit een had (LAT.md regel 5). */
  function heeft(key, code) {
    const c = String(code || '').toLowerCase();
    const alle = rijVan(key).filter(a => a.code === c);
    if (!alle.length) return { ok: false, reden: 'Hiervoor is een aanspraak nodig en die heeft u niet.' };
    const goed = alle.map(a => ({ a, g: geldig(a) })).find(x => x.g.ok);
    if (goed) return { ok: true, aanspraak: beeld(goed.a) };
    return { ok: false, reden: alle.map(a => geldig(a).reden).find(Boolean) || 'Deze aanspraak geldt niet meer.' };
  }

  function trekAanspraakIn(key, aanspraakId) {
    const a = rijVan(key).find(x => x.id === String(aanspraakId || ''));
    if (!a) return { status: 404, error: 'Deze aanspraak bestaat niet.' };
    if (a.ingetrokken) return { status: 409, error: 'Deze aanspraak was al ingetrokken.' };
    a.ingetrokken = nu(); save();
    return { status: 200, ok: true, aanspraak: beeld(a) };
  }

  function mijne(key) {
    return { status: 200, aanspraken: rijVan(key).map(beeld), herkomsten: HERKOMSTEN,
      uitleg: 'Elke regel hier komt uit iets dat werkelijk is gebeurd -- een aankoop, een cadeau, een kaartje ' +
        'of een besluit -- en draagt die bron. Er staat niets op deze lijst zonder grond.' };
  }

  return { verleen, heeft, trekAanspraakIn, mijne, HERKOMSTEN };
};
