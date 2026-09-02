/* ============================================================================
   APPARATUUR BUITEN HET LAB -- uitlenen aan een school of een buurtinitiatief,
   met een keten die niemand kan herschrijven.

   HET VERSCHIL MET ./apparatuurgebruik.js. Daar staat het gebruik BINNEN het
   lab: reserveren voor een studie, uitgeven aan een medewerker die erop bevoegd
   is. Hier gaat het apparaat de deur uit naar iemand die niet van het lab is --
   en dan verandert de vraag. Niet "mag jij dit bedienen", maar: wie is
   verantwoordelijk, waarvoor is het, tot wanneer, en in welke staat ging het
   mee.

   DE KETEN IS HET PRODUCT. Elke stap wordt achteraan toegevoegd en niets wordt
   ooit aangepast: aanvraag, besluit, meegegeven, terug, herijkt. Blijkt later
   dat een sensor ondeugde, dan is exact terug te vinden wie hem wanneer had --
   en welke metingen eraan hingen (./instrument.js bevriest dezelfde
   kalibratiestand in elke meting).

   TWEE POORTEN DIE DICHTGAAN, EN ALLEBEI FAIL-CLOSED:

     een open storing      een apparaat waarvan bekend is dat het iets mankeert,
                           gaat niet de deur uit. Wie het toch meegeeft, geeft
                           metingen mee waarvan niemand weet wat ze waard zijn.
     een verlopen ijking   hetzelfde, maar erger: een verlopen kalibratie ziet er
                           precies zo uit als een geldige. De stand wordt daarom
                           bij het meegeven BEVROREN in de keten.

   WAT ER MET OPZET NIET IS: een boete, een borg of een aansprakelijkheidsregel.
   Dat is een afspraak tussen het lab en de lener, en een bedrag in software
   suggereert dat het systeem hem kan innen. Wat er wel staat is de STAAT waarin
   het apparaat terugkwam, in woorden van de mens die het aannam.
   ========================================================================== */
'use strict';

const STANDEN = ['aangevraagd', 'toegekend', 'afgewezen', 'meegegeven', 'terug', 'afgerond'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, vindLab, save, apparatuur } = ctx;
  const { vind, kalibratieStand } = apparatuur;

  const L = () => { const s = S(); if (!Array.isArray(s.uitleen)) s.uitleen = []; return s.uitleen; };
  const vindU = (id) => L().find(u => u.id === String(id || '')) || null;
  const dag = (d) => { const t = String(d || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };
  const stap = (u, wat, door, detail) => u.keten.push({ wat, door: schoon(door, 80) || 'lab', detail: detail || null, at: nu() });

  /* WAT EEN SCHOOL ZIET. Alleen wat er te lenen valt, met de eisen erbij -- geen
     storingsteksten en geen namen van medewerkers. Een apparaat dat nu uit is,
     staat er wel bij: "niet beschikbaar" is een antwoord, weglaten niet. */
  function catalogus(labId) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    /* Ook de apparaten die NIET actief zijn staan erin: een apparaat weglaten
       omdat het stuk is, ziet er van buiten hetzelfde uit als een apparaat dat
       niet bestaat. Wat er niet in staat, is wat het lab heeft opgeruimd. */
    const rijen = S().apparatuur.filter(a => a.labId === lab.id).map(a => {
      const k = kalibratieStand(a, nu().slice(0, 10));
      /* Een open storing heet in het register `open` en zet `actief` op false
         (./apparatuur.js). Beide lezen zou twee waarheden geven; hier wordt de
         MELDING gelezen, want die draagt ook de reden. */
      const storing = (a.onderhoud || []).some(o => o.soort === 'storing' && o.open);
      const uit = !!a.uit || L().some(u => u.apparaatId === a.id && u.stand === 'meegegeven');
      return { id: a.id, naam: a.naam, soort: a.soort,
        kalibratie: k.nvt ? { nvt: true } : { geldig: k.geldig, tot: k.tot },
        bevoegdheidNodig: (a.bevoegd || []).length > 0,
        beschikbaar: !storing && !uit && (k.nvt || k.geldig),
        waaromNiet: storing ? 'Dit apparaat heeft een openstaande storing.'
          : uit ? 'Dit apparaat is op dit moment uit.'
          : (!k.nvt && !k.geldig) ? 'De ijking van dit apparaat is verlopen; het gaat pas weer mee als het opnieuw is gekalibreerd.'
          : null };
    });
    return { ok: true, lab: { naam: lab.naam, stad: lab.stad }, apparatuur: rijen,
      let: 'Een apparaat dat niet beschikbaar is, staat er met de reden bij. Weglaten zou lijken alsof het niet bestaat.' };
  }

  /* ---------- de aanvraag: van buiten het lab ---------- */
  function aanvraag(b) {
    b = b || {};
    const a = vind(b.apparaatId); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    const organisatie = schoon(b.organisatie, 120);
    const contact = schoon(b.contact, 120);
    const doel = schoon(b.doel, 600);
    const van = dag(b.van), tot = dag(b.tot);
    if (organisatie.length < 2) return { status: 400, error: 'Namens welke school, vereniging of organisatie vraagt u dit aan?' };
    if (contact.length < 5) return { status: 400, error: 'Wie is de verantwoordelijke die wij kunnen bereiken?' };
    if (doel.length < 20) return { status: 400, error: 'Waarvoor gaat u dit gebruiken? Dat is geen formaliteit: het lab beoordeelt of het apparaat daarvoor geschikt is.' };
    if (!van || !tot) return { status: 400, error: 'Van wanneer tot wanneer? Beide datums als jjjj-mm-dd.' };
    if (tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };
    if (L().filter(u => u.labId === a.labId && u.stand === 'aangevraagd').length >= 500) {
      return { status: 400, error: 'Er staan te veel openstaande aanvragen bij dit lab.' };
    }
    const u = { id: rid(), labId: a.labId, apparaatId: a.id, apparaatNaam: a.naam,
      organisatie, contact, doel, van, tot, stand: 'aangevraagd', keten: [], at: nu() };
    stap(u, 'aangevraagd', organisatie, doel.slice(0, 80));
    L().unshift(u);
    audit(a.labId, 'uitleen.aanvraag', organisatie, a.id, doel.slice(0, 60));
    save();
    return { ok: true, uitleen: publiek(u),
      let: 'Uw aanvraag staat bij het lab. Een mens kijkt ernaar; u hoort het via het contactadres dat u opgaf.' };
  }

  /* ---------- het besluit van het lab ---------- */
  function besluit(id, b, wie) {
    const u = vindU(id); if (!u) return { status: 404, error: 'Deze aanvraag bestaat niet.' };
    if (u.stand !== 'aangevraagd') return { status: 409, error: 'Over deze aanvraag is al besloten (' + u.stand + ').' };
    b = b || {};
    const keuze = ['toegekend', 'afgewezen'].includes(b.besluit) ? b.besluit : null;
    if (!keuze) return { status: 400, error: 'Een besluit is toegekend of afgewezen.' };
    const door = schoon(b.door, 80);
    if (!door) return { status: 400, error: 'Zet uw naam erbij: uitlenen is een besluit van een mens.' };
    const reden = schoon(b.reden, 400);
    if (keuze === 'afgewezen' && reden.length < 10) {
      return { status: 400, error: 'Een afwijzing draagt een reden; die leest de aanvrager.' };
    }
    u.stand = keuze;
    u.besluit = { door, reden: reden || null, at: nu() };
    stap(u, keuze, door, reden || null);
    audit(u.labId, 'uitleen.besluit', wie, u.apparaatId, keuze);
    save();
    return { ok: true, uitleen: publiek(u) };
  }

  /* Wat er naar buiten gaat. De keten volledig -- dat is het punt -- maar zonder
     de namen van medewerkers aan de leenkant te vermengen met die van het lab:
     wie wat deed staat per stap, en dat is precies genoeg. */
  function publiek(u) {
    return { id: u.id, labId: u.labId, apparaat: { id: u.apparaatId, naam: u.apparaatNaam },
      organisatie: u.organisatie, doel: u.doel, van: u.van, tot: u.tot, stand: u.stand,
      besluit: u.besluit || null,
      meegegeven: u.meegegeven ? { at: u.meegegeven.at, kalibratie: u.meegegeven.kalibratie } : null,
      terug: u.terug || null, keten: u.keten, at: u.at };
  }

  function lijst(labId, { stand } = {}) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    let rijen = L().filter(u => u.labId === lab.id);
    if (stand && STANDEN.includes(String(stand))) rijen = rijen.filter(u => u.stand === String(stand));
    return { ok: true, uitleningen: rijen.slice(0, 300).map(publiek),
      perStand: STANDEN.reduce((o, st) => { o[st] = L().filter(u => u.labId === lab.id && u.stand === st).length; return o; }, {}) };
  }

  /* De fysieke keten (meegeven, terugnemen, herijken) staat in
     ./uitleenketen.js en komt hier als EEN geheel naar buiten: de routes kennen
     `uitleen` en hoeven niet te weten in welk van de twee bestanden een functie
     is beland -- dezelfde samenvoeging als ethiek + waarborg in ./index.js. */
  const keten = require('./uitleenketen')(ctx, { vindU, stap, publiek });

  return Object.assign({ catalogus, aanvraag, besluit, lijst, publiek, STANDEN }, keten);
};

module.exports.STANDEN = STANDEN;
