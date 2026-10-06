/* HET COMMAND-JOURNAAL -- iedere menselijke én automatische handeling, met de
   oude toestand, de nieuwe toestand, de actor, de reden en de gebruikte regel.

   ONVERANDERLIJK, EN NIET ALLEEN OP MIJN WOORD. Elke regel draagt de hash van
   de vorige (`vorig`) en van zichzelf (`zegel`). Wie er middenin iets wijzigt
   of wegknipt, breekt de keten, en `controleer()` wijst de eerste regel aan
   waar het misgaat. Een auditspoor waarvan je alleen kunt HOPEN dat er niets
   uit is gehaald, is geen auditspoor -- dat is de reden dat dit hier zo staat
   en niet als gewone lijst.

   WIE ER HANDELT KOMT NOOIT UIT DE BODY. De actor wordt door de route gezet
   uit de sessie. Een auditspoor dat de beller zelf mag invullen, schrijft de
   naam van een ander onder jouw handeling -- dat is in dit huis al een keer
   echt gebeurd bij de identiteitskluis, en dezelfde fout hoort hier niet nog
   eens gemaakt te worden.

   DE STAART IS BEGRENSD, HET TOTAAL NIET. Het geheugen houdt de laatste
   MAX regels vast; `aantal` blijft het echte totaal tellen, zodat een scherm
   nooit een afgekapte lijst voor het geheel aanziet. */
'use strict';

const { NIVEAUS } = require('../frictie');

const MAX = 5000;

/* HET VAK. Standaard schrijft het journaal in db.data zelf -- dat is het
   RTG-journaal. Een aanroeper mag een ander vak meegeven: een object waarin
   dezelfde sleutels worden bijgehouden. Zo krijgt elke zaak zijn EIGEN keten,
   met zijn eigen zegel, in plaats van dat alle zaken in één lijst schrijven
   waar ze elkaars regels in zouden zien staan.

   Dit is geen tweede journaal: het is dezelfde module, één keer per eigenaar.
   De waarheid "wat is er in zaak X gebeurd" staat daarmee op precies één
   plek -- wat LAT.md regel 4 vraagt. */
function maakJournaal({ db, save, crypto, vak, opslag, auditOpslag }) {
  let werkVak = null;
  const bron = typeof vak === 'function' ? vak : (() => opslag.vak());
  const V = () => werkVak || (auditOpslag ? auditOpslag.view() : bron());
  function lijst() {
    const v = V();
    if (!Array.isArray(v.commandJournaal)) v.commandJournaal = [];
    return v.commandJournaal;
  }
  function tellerLees() { return Number(V().commandJournaalTotaal || 0); }

  function hash(v) {
    return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 32);
  }

  /* Noteren. `voor` en `na` mogen alles zijn wat JSON aankan; ze worden
     samengevat opgeslagen zodat een dossier van 40 kB het journaal niet
     opblaast, maar het VERSCHIL blijft leesbaar -- dat is waarvoor je het
     achteraf openslaat. */
  function beknopt(v) {
    if (v == null) return null;
    if (typeof v !== 'object') return String(v).slice(0, 300);
    const uit = {};
    for (const [k, w] of Object.entries(v)) {
      if (w == null || typeof w === 'object') { uit[k] = Array.isArray(w) ? w.length + ' stuk(s)' : (w ? '{…}' : null); continue; }
      uit[k] = String(w).slice(0, 200);
    }
    return uit;
  }

  function noteer(regel, vast) {
    const rij = auditOpslag && !werkVak ? null : lijst();
    const vorige = rij?.length ? rij[rij.length - 1] : null;
    const kern = {
      id: vast?.id || crypto.randomUUID(),
      /* Een aanroeper mag een GROVERE tijd meegeven (lib/burgerpad.js); nooit
         een tijd die niet van nu is, want de keten gaat over volgorde. */
      at: vast?.at || (typeof regel.at === 'string' && regel.at.slice(0, 10) === new Date().toISOString().slice(0, 10)
        ? regel.at : new Date().toISOString()),
      actor: String(regel.actor || 'onbekend'),
      actie: String(regel.actie || ''),
      objectType: regel.objectType ? String(regel.objectType) : null,
      objectId: regel.objectId != null ? String(regel.objectId) : null,
      niveau: regel.niveau || 'hand',
      risico: regel.risico == null ? null : Number(regel.risico),
      reden: String(regel.reden || ''),
      beleid: regel.beleid ? String(regel.beleid) : null,
      uitslag: String(regel.uitslag || 'gedaan'),
      voor: beknopt(regel.voor),
      na: beknopt(regel.na),
      vorig: vorige ? vorige.zegel : null
    };
    /* Audit P2-7: het verzoek en de release staan IN de regel en dus onder de
       zegel. Alleen wat bekend is; nooit een verzonnen waarde. */
    if (regel.verzoek) kern.verzoek = String(regel.verzoek).slice(0, 40);
    const release = require('../../lib/releaseidentiteit').release();
    if (release) kern.release = release;
    if (auditOpslag && !werkVak) return auditOpslag.append(top => {
      const waarde = { ...kern, vorig: top?.zegel || null }; waarde.zegel = hash(waarde); return waarde;
    });
    kern.zegel = hash(kern);
    rij.push(kern);
    V().commandJournaalTotaal = tellerLees() + 1;
    /* De staart afkappen mag, de teller niet: `aantal` blijft het echte
       totaal. Zo weet een scherm dat het naar een venster kijkt. */
    if (rij.length > MAX) rij.splice(0, rij.length - MAX);
    if (save && !werkVak) save();
    return kern;
  }

  /* EEN ACTOR ONLEESBAAR MAKEN, EN DE HERSCHRIJVING IN DE KETEN ZETTEN.

     Hier botsen twee dingen die allebei waar zijn. Een auditspoor hoort niet
     herschreven te worden -- dat is de hele reden dat elke regel de hash van de
     vorige draagt. En een mens die zijn recht op vergetelheid uitoefent, hoort
     niet als sleutel in een spoor achter te blijven; test/vergeten.test.js veegt
     daarom door de HELE database en rekent af wat er nog van hem in staat.

     De uitweg is niet kiezen maar OPSCHRIJVEN. De actor wordt vervangen door
     "gewist", de keten wordt opnieuw gezegeld, en er komt een regel bij die
     zegt dát er is herschreven, hoeveel regels het betrof, en wat de KOP was
     vóór de wissing. Wie een eerder geexporteerd zegel naast dit spoor legt,
     ziet het verschil dus staan, met de reden erbij -- in plaats van een keten
     die stilletjes klopt over een verleden dat is aangepast.

     Wat blijft: WAT er is gebeurd en WANNEER. Wat weggaat: WIE, en dat is
     precies wat er gevraagd werd. */
  function wisActor(actor, reden, vast) {
    if (auditOpslag && !werkVak) {
      const identiteit = { id: crypto.randomUUID(), at: new Date().toISOString() };
      return auditOpslag.rewrite(waarde => {
        werkVak = waarde;
        try { return wisActor(actor, reden, identiteit); } finally { werkVak = null; }
      });
    }
    const wie = String(actor || '');
    if (!wie) return { geraakt: 0 };
    const rij = lijst();
    const kopVoor = rij.length ? rij[rij.length - 1].zegel : null;
    let geraakt = 0;
    for (const r of rij) if (r.actor === wie) { r.actor = 'gewist'; geraakt++; }
    if (!geraakt) return { geraakt: 0 };
    /* Opnieuw zegelen vanaf het begin van het venster: elke regel krijgt zijn
       nieuwe verwijzing en zijn nieuwe zegel, zodat controleer() weer klopt. */
    let vorig = rij.length ? rij[0].vorig : null;
    for (const r of rij) {
      r.vorig = vorig;
      const { zegel, ...zonder } = r;
      r.zegel = hash(zonder);
      vorig = r.zegel;
    }
    noteer({ actor: 'systeem', actie: 'wissing in het spoor', niveau: NIVEAUS.auto,
      reden: reden || 'recht op vergetelheid (AVG art. 17)',
      uitslag: 'gedaan', voor: { kopVoorWissing: kopVoor }, na: { regelsGewist: geraakt } }, vast);
    return { geraakt, kopVoor };
  }

  /* De keten nalopen. Geeft de eerste breuk terug, of null als hij heel is.
     Let op wat dit WEL en NIET bewijst: het bewijst dat de regels in het
     geheugen onderling kloppen. Het bewijst niet dat er niets vóór het venster
     is verdwenen -- daarvoor is `aantal` er, en die telt onafhankelijk. */
  function controleer() {
    const rij = lijst();
    let vorig = rij.length ? rij[0].vorig : null;
    for (const r of rij) {
      const { zegel, ...zonder } = r;
      if (zonder.vorig !== vorig) return { heel: false, bij: r.id, waarom: 'de verwijzing naar de vorige regel klopt niet' };
      if (hash(zonder) !== zegel) return { heel: false, bij: r.id, waarom: 'de regel is gewijzigd na het noteren' };
      vorig = zegel;
    }
    return { heel: true, regels: rij.length };
  }

  const lezing = require('./journaal-lezing')(lijst, NIVEAUS);
  return { noteer, controleer, ...lezing, wisActor,
    aantal: () => tellerLees(), venster: () => lijst().length, MAX };
}

module.exports = { maakJournaal };
