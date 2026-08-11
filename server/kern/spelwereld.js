/* DE SPELWERELD -- de echte software, op spelgegevens.

   VERHAAL.md stap 3. De opdracht is dat je in Magnaat de ECHTE RTG-software
   gebruikt en niet een nagebouwd personeelsscherm: wie in het spel
   bedrijfsleider wordt, hoort het echte rooster, de echte loonstrook en het
   echte dossier te leren kennen. Het spel is dan geen etalage van het platform
   maar de oefenruimte ervan.

   DIT BESTAND BESTAAT OMDAT DE ZANDBAK ZIJN EIGEN TEKORTKOMING OPSCHREEF.
   kern/command/zandbak.js zegt letterlijk: "Alleen de motoren van Command
   draaien erop. De gewone app-routes praten met de echte database, dus je
   proeft hier processen en geen schermen." Dat is precies het gat, en het is er
   EEN. De motoren zijn al op een ander datavak te bouwen -- kern/concern wordt
   letterlijk samengesteld met { db, save, crypto, ... } -- alleen kwam er nooit
   iets anders binnen dan de productiedatabase.

   TWEE MECHANISMEN, ALLEBEI AL IN HUIS, EN GEEN VAN BEIDE NIEUW:

   1. HET VENSTER, van ./command/zandbak.js. Een wereld krijgt een eigen vak en
      de motoren krijgen `{ data: vak.data }`. Ze kunnen niet bij productie --
      niet omdat er gefilterd wordt maar omdat het object dat zij zien die
      collecties NIET HEEFT. Dat is de structurele scheiding die VERHAAL.md
      grens 2 eist: een spelfeit is nooit een juridisch feit, en dat mag niet aan
      een vlag hangen.

   2. DE GOOIENDE DOORKIJK, van ../opzet/domeingrens.js. Daar leerde dit huis
      dat een grens die `undefined` teruggeeft geen grens is: `motor &&
      motor.doeIets()` slaat er stil overheen en de route antwoordt vriendelijk
      het verkeerde. Hier geldt hetzelfde, en het gaf een grens die nog nergens
      stond -- zie hieronder.

   DE GRENS DIE ERBIJ KWAM: EEN SPELHANDELING LAAT GEEN ECHTE BEL RINKELEN.
   routes/member/werk.js vraagt eenentwintig namen uit de kern, en zes daarvan
   gaan naar BUITEN: meldWerkgever, notifySupplier, sseToSupplier, sseToOffice,
   chatStuur, commWerk. Wie in een spelwereld een sollicitatie afwijst, hoort
   geen melding te sturen naar een echte leverancier en geen echt kantoorscherm
   te laten piepen. Die namen zijn hier dus niet uitgeschakeld maar AFWEZIG, en
   wie ze aanraakt krijgt een fout met de naam erin.

   Dat is ook zelfhandhavend, en dat is de reden dat het zo moet: de lijst wordt
   compleet doordat hij ergens knelt, niet doordat iemand hem goed heeft geraden.
   Precies de redenering uit de kop van ../opzet/domeingrens.js.

   WAT HIJ NIET IS: een tweede installatie. Er draait EEN proces en EEN
   database; een spelwereld is een vak daarin. En hij is met opzet EINDIG --
   werelden vervallen, want een rij oude werelden is een rij die niemand meer
   vertrouwt (dezelfde reden als bij de zandbakken). */
'use strict';

const MAX_WERELDEN = 20;
const STANDAARD_DAGEN = 30;
const DAG = 86400000;

/* De grenzen -- welke namen een wereld nooit mag aanraken -- staan in
   ./spelwereld-grens.js. Daar de grens, hier het vak. */
const G = require('./spelwereld-grens');
const { gaatNaarBuiten, buitenFout, leesAccounts } = G;

const schoon = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  .replace(/-+/g, '-').slice(0, 40);

module.exports = function maakSpelwereld({ db, save, zaai, nu }) {
  const klok = nu || (() => Date.now());

  function alle() {
    if (!db.data.spelwerelden || typeof db.data.spelwerelden !== 'object') db.data.spelwerelden = {};
    return db.data.spelwerelden;
  }

  const kaart = (w) => ({ id: w.id, gemaakt: w.gemaakt, door: w.door, vervalt: w.vervalt,
    potje: w.potje || null, waarvoor: w.waarvoor,
    uitleg: 'Dit is een spelwereld. De schermen en de motoren zijn de echte; de gegevens niet. '
      + 'Er staat niets in wat uit de productiedatabase komt, en er kan niets uit terug.' });

  /* EEN WERELD MAKEN. De inhoud komt uit de ZAAISET en nooit uit db.data, en dat
     is geen afspraak maar de bouw -- zou een wereld "de echte gegevens, maar dan
     een kopie" zijn, dan staan er persoonsgegevens in een omgeving waar mensen
     juist dingen mogen proberen, en dan is de spelwereld zelf het datalek.
     Woordelijk dezelfde redenering als bij ../command/zandbak.js. */
  function maak(naam, opties) {
    const o = opties || {};
    const id = schoon(naam);
    if (!id) return { status: 400, error: 'Een spelwereld heeft een naam nodig.' };
    const lijst = alle();
    if (lijst[id]) return { status: 409, error: 'Er is al een spelwereld met die naam.' };
    if (Object.keys(lijst).length >= MAX_WERELDEN)
      return { status: 409, error: 'Er staan al ' + MAX_WERELDEN + ' spelwerelden. Ruim er een op.' };
    const dagen = Math.max(1, Math.min(Number(o.dagen || STANDAARD_DAGEN), 365));
    lijst[id] = { id, gemaakt: new Date(klok()).toISOString(),
      door: String(o.door || 'onbekend'), potje: o.potje ? String(o.potje) : null,
      waarvoor: String(o.waarvoor || '').slice(0, 200),
      vervalt: new Date(klok() + dagen * DAG).toISOString(),
      data: zaai() };
    save();
    return { status: 200, ok: true, wereld: kaart(lijst[id]) };
  }

  function weg(naam) {
    const id = schoon(naam);
    if (!alle()[id]) return { status: 404, error: 'Die spelwereld bestaat niet.' };
    delete alle()[id];
    save();
    return { status: 200, ok: true, id };
  }

  /* Verlopen werelden opruimen. Een wereld zonder eind blijft liggen tot iemand
     hem voor productie aanziet. */
  function veeg() {
    const weggehaald = [];
    for (const [id, w] of Object.entries(alle()))
      if (Date.parse(w.vervalt || '') < klok()) { delete alle()[id]; weggehaald.push(id); }
    if (weggehaald.length) save();
    return weggehaald;
  }

  const lijst = () => Object.values(alle()).map(kaart);

  /* HET VENSTER van een wereld: het enige wat de motoren erin zien. Een gewoon
     object met precies EEN veld, en daar zit alle scheiding in. */
  function venster(naam) {
    const w = alle()[schoon(naam)];
    return w ? { data: w.data } : null;
  }

  /* DE KERN VAN EEN WERELD: dezelfde kern, met het venster in plaats van de
     database, en zonder de kanalen die naar buiten gaan.

     HET IS EEN PROXY EN GEEN KOPIE, om exact de reden die
     ../opzet/domeingrens.js opschrijft: de kern doet LATE BINDING -- sommige
     routers noemen een naam die er bij het ophangen nog niet is. Een kopie op
     mountmoment bevriest dat en levert undefined. */
  function kernVoor(kern, naam, eigen) {
    const id = schoon(naam);
    const v = venster(id);
    if (!v) return null;
    const erover = eigen || {};
    return new Proxy(kern, {
      get(doel, sleutel) {
        if (typeof sleutel !== 'string') return doel[sleutel];
        if (sleutel === 'db') return v;
        if (sleutel === 'spelwereldId') return id;
        /* DE MOTOREN VAN DEZE WERELD GAAN VOOR, en dat is geen voorkeur maar een
           noodzaak die makkelijk te missen is: een `db` verwisselen is niet
           genoeg. De kern draagt AL GEBOUWDE functies (concernNieuw,
           entiteitVind, ...) en die sluiten de productiedatabase in hun
           closure. Wie alleen `db` vervangt, krijgt een wereld waarin het
           SCHERM naar het vak kijkt en de MOTOR naar productie schrijft -- de
           gevaarlijkste helft van een grens die er is.

           Wie een wereld maakt, bouwt de motoren die hij nodig heeft dus
           opnieuw op het venster en geeft ze hier mee. Zie
           ./spelwereld-mount.js. */
        if (Object.prototype.hasOwnProperty.call(erover, sleutel)) return erover[sleutel];
        /* DE IDENTITEIT: lezen mag, veranderen niet, en de kluis blijft dicht.
           Zie de uitleg bij IDENTITEIT_MAG hierboven. */
        if (sleutel === 'accounts') return leesAccounts(doel.accounts, id);
        /* Wat er niet in de kern zit kan ook geen overtreding zijn: dan is het
           een typefout of een optionele naam, en die hoort zijn eigen undefined
           te krijgen. Dezelfde regel als bij de domeingrens. */
        if (!(sleutel in doel)) return undefined;
        if (gaatNaarBuiten(sleutel)) throw buitenFout(id, sleutel);
        return doel[sleutel];
      },
      set(doel, sleutel, waarde) { doel[sleutel] = waarde; return true; }
    });
  }

  return { MAX_WERELDEN, STANDAARD_DAGEN, alle, maak, weg, veeg, lijst, kaart,
    venster, kernVoor, gaatNaarBuiten };
};

module.exports.NAAR_BUITEN = G.NAAR_BUITEN;
module.exports.NAAR_BUITEN_VOLUIT = G.NAAR_BUITEN_VOLUIT;
module.exports.MAX_WERELDEN = MAX_WERELDEN;
module.exports.IDENTITEIT_MAG = G.IDENTITEIT_MAG;
