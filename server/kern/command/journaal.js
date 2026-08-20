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

const MAX = 5000;

/* HET VAK. Standaard schrijft het journaal in db.data zelf -- dat is het
   RTG-journaal. Een aanroeper mag een ander vak meegeven: een object waarin
   dezelfde sleutels worden bijgehouden. Zo krijgt elke zaak zijn EIGEN keten,
   met zijn eigen zegel, in plaats van dat alle zaken in één lijst schrijven
   waar ze elkaars regels in zouden zien staan.

   Dit is geen tweede journaal: het is dezelfde module, één keer per eigenaar.
   De waarheid "wat is er in zaak X gebeurd" staat daarmee op precies één
   plek -- wat LAT.md regel 4 vraagt. */
function maakJournaal({ db, save, crypto, vak }) {
  const V = typeof vak === 'function' ? vak : (() => db.data);
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

  function noteer(regel) {
    const rij = lijst();
    const vorige = rij.length ? rij[rij.length - 1] : null;
    const kern = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
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
    kern.zegel = hash(kern);
    rij.push(kern);
    V().commandJournaalTotaal = tellerLees() + 1;
    /* De staart afkappen mag, de teller niet: `aantal` blijft het echte
       totaal. Zo weet een scherm dat het naar een venster kijkt. */
    if (rij.length > MAX) rij.splice(0, rij.length - MAX);
    if (save) save();
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
  function wisActor(actor, reden) {
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
    noteer({ actor: 'systeem', actie: 'wissing in het spoor', niveau: 'auto',
      reden: reden || 'recht op vergetelheid (AVG art. 17)',
      uitslag: 'gedaan', voor: { kopVoorWissing: kopVoor }, na: { regelsGewist: geraakt } });
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

  function overObject(type, id) {
    const t = String(type), i = String(id);
    return lijst().filter(r => r.objectType === t && r.objectId === i);
  }

  function recent(n, filter) {
    let rij = lijst().slice().reverse();
    if (filter && filter.actor) rij = rij.filter(r => r.actor === filter.actor);
    if (filter && filter.actie) rij = rij.filter(r => r.actie.includes(filter.actie));
    if (filter && filter.niveau) rij = rij.filter(r => r.niveau === filter.niveau);
    return rij.slice(0, n || 50);
  }

  /* FORENSIC REPLAY: reconstrueer wat er tussen twee momenten gebeurde, in
     volgorde, met per stap de toestand ervoor en erna. Dat is precies wat je
     na een incident wilt kunnen doen -- en het is alleen mogelijk omdat `voor`
     en `na` bij het noteren zijn vastgelegd en niet achteraf herleid. */
  function herbeleef(van, tot, opties) {
    const v = String(van || ''), t = String(tot || '￿');
    const alles = lijst().filter(r => r.at >= v && r.at <= t);
    const gefilterd = opties && opties.objectType
      ? alles.filter(r => r.objectType === opties.objectType && (!opties.objectId || r.objectId === String(opties.objectId)))
      : alles;
    return {
      van: v, tot: t, stappen: gefilterd.length,
      actoren: [...new Set(gefilterd.map(r => r.actor))],
      automatisch: gefilterd.filter(r => r.niveau === 'auto').length,
      mislukt: gefilterd.filter(r => r.uitslag !== 'gedaan').length,
      lijn: gefilterd.map(r => ({ at: r.at, actor: r.actor, actie: r.actie, niveau: r.niveau,
        object: r.objectType ? r.objectType + ' ' + r.objectId : null,
        reden: r.reden, uitslag: r.uitslag, voor: r.voor, na: r.na, zegel: r.zegel }))
    };
  }

  return { noteer, controleer, overObject, recent, herbeleef, wisActor,
    aantal: () => tellerLees(), venster: () => lijst().length, MAX };
}

module.exports = { maakJournaal };
