/* RTG Festival (deelmodule): DE GROEP. Het lastigste deel van de commerce, en
   niet omdat het technisch moeilijk is.

   Een festival beleef je met mensen. Maar een groep raakt per definitie een
   TWEEDE PERSOON, en daar geldt de regel van dit huis onverkort (LIFE.md par.
   4): samenstellen en klaarzetten mag, bevestigen doet de mens. Alles wat een
   ander bereikt -- een uitnodiging, een bericht, een betaling -- gebeurt nooit
   vanzelf.

   DAARUIT VOLGT DE VORM, EN HET IS EEN ONGEBRUIKELIJKE.

   ER WORDT HIER NIETS VERSTUURD. Geen uitnodigingsmail, geen push, geen
   "Kobalt heeft je toegevoegd". De maker krijgt een CODE en geeft die zelf
   door, op de manier die hij zelf kiest. Dat is geen gemiste functie maar het
   hele punt: RTG hoort niet namens iemand contact te leggen met zijn vrienden.

   EN NIEMAND WORDT TOEGEVOEGD. Er bestaat geen functie waarmee de maker een
   ander in zijn groep zet. Meedoen is een eigen handeling: je hebt de code en
   je gebruikt hem. Wie dat omdraait, maakt van een groep een lijst waar je op
   kunt staan zonder het te weten.

   HET GAT IS EEN FEIT EN GEEN AANSPORING. groepStand() zegt hoeveel leden nog
   geen pas hebben. Meer niet -- geen "nodig ze uit", geen aftelklok, geen
   "nog 2 plekken!". CLAUDE.md verbiedt kunstmatige urgentie, en een groep is
   precies de plek waar die verleiding het grootst is: de druk komt dan van
   vrienden, en dat werkt beter dan welke banner ook. Juist daarom niet.

   ER IS GEEN HOOFD VAN DE GROEP. Elk lid mag de code vernieuwen en elk lid mag
   weg. Een maker met meer rechten dan de rest maakt van een vriendengroep een
   trechter met een eigenaar, en dat is precies wat LIFE.md par. 4 verbiedt. De
   maker staat er alleen als FEIT bij: wie hem begon.

   WAT DE ORGANISATOR HIERVAN ZIET: NIETS. Een groep is tussen gasten. Dat een
   festival groepsgroottes zou willen weten voor de camping is een echte
   behoefte, maar het is ook precies het sociale netwerk van zijn bezoekers; dat
   vraagt dezelfde tweezijdige toestemming als ./partner.js en verdient een
   eigen besluit. Tot dat er is, leest de organisatorkant hier niet mee. */
'use strict';

const LEESBAAR = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_LEDEN = 50;

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind } = ctx;

  const bak = (e) => {
    if (!e.groepen || typeof e.groepen !== 'object') e.groepen = {};
    return e.groepen;
  };
  const nuIso = () => new Date().toISOString();

  /* De code is een TOONDER: wie hem heeft, kan meedoen. Tien tekens, zelfde
     reden als bij de pas -- en hij is te vernieuwen, want een code die je een
     keer te breed hebt gedeeld moet je kunnen intrekken. */
  function nieuweCode(e) {
    for (let poging = 0; poging < 8; poging++) {
      let c = '';
      for (let i = 0; i < 10; i++) c += LEESBAAR[crypto.randomInt(LEESBAAR.length)];
      if (!Object.values(bak(e)).some(g => g.code === c)) return c;
    }
    return null;
  }

  const isLid = (g, codenaam) => (g.leden || []).some(l => l.codenaam === codenaam);

  function groepMaak(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const naam = schoon(d.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de groep een naam.' };
    const maker = schoon(d.maker, 60);
    if (!maker) return { status: 400, error: 'Op wiens codenaam komt deze groep?' };
    if (Object.keys(bak(e)).length >= 5000) return { status: 400, error: 'Er staan te veel groepen op deze editie.' };
    const code = nieuweCode(e);
    if (!code) return { status: 500, error: 'Kon geen vrije groepscode maken.' };

    const g = { id: 'grp' + crypto.randomBytes(5).toString('hex'), naam, code, maker,
      leden: [{ codenaam: maker, sinds: nuIso() }], beeindigd: null, at: nuIso() };
    bak(e)[g.id] = g;
    save();
    return { ok: true, groep: g };
  }

  /* MEEDOEN IS EEN EIGEN HANDELING. De codenaam is die van de aanroeper -- op
     de route komt hij uit de sessie -- en de code is wat iemand zelf heeft
     gekregen. Er is met opzet geen tegenhanger waarmee een ander jou toevoegt. */
  function groepDeelnemen(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const codenaam = schoon(d.codenaam, 60);
    if (!codenaam) return { status: 400, error: 'Wie doet er mee?' };
    const code = String(d.code || '').trim().toUpperCase();
    /* De code wordt BINNEN deze editie gezocht. Een code van vorig jaar hoort
       nergens toe te leiden -- een groep hoort bij de editie waarin hij begon. */
    const g = Object.values(bak(e)).find(x => x.code === code && !x.beeindigd);
    if (!g) return { status: 404, error: 'Deze groepscode klopt niet (meer).' };
    if (isLid(g, codenaam)) return { ok: true, groep: g, al: true };
    if ((g.leden || []).length >= MAX_LEDEN) {
      return { status: 409, error: 'Deze groep zit vol (' + MAX_LEDEN + ').' };
    }
    g.leden.push({ codenaam, sinds: nuIso() });
    save();
    return { ok: true, groep: g };
  }

  /* WEG KAN ALTIJD, en zonder dat iemand het goedkeurt. Vertrekt de laatste,
     dan houdt de groep op te bestaan; een lege groep die blijft staan is een
     lijst met een naam erop en verder niets. */
  function groepVerlaat(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const codenaam = schoon(d.codenaam, 60);
    const g = bak(e)[String(d.id || '')];
    if (!g || g.beeindigd || !isLid(g, codenaam)) return { status: 404, error: 'Deze groep bestaat niet.' };
    g.leden = g.leden.filter(l => l.codenaam !== codenaam);
    if (!g.leden.length) g.beeindigd = nuIso();
    save();
    return { ok: true, groep: g };
  }

  /* ELK LID mag de code vernieuwen. Er is geen hoofd van de groep: een maker
     met meer rechten dan de rest maakt er een trechter met een eigenaar van. */
  function groepCodeVernieuw(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const g = bak(e)[String(d.id || '')];
    const codenaam = schoon(d.codenaam, 60);
    if (!g || g.beeindigd || !isLid(g, codenaam)) return { status: 404, error: 'Deze groep bestaat niet.' };
    const code = nieuweCode(e);
    if (!code) return { status: 500, error: 'Kon geen vrije groepscode maken.' };
    g.code = code;
    save();
    return { ok: true, groep: g };
  }

  /* De stand, en ALLEEN voor een lid. Wie er in een groep zit is niets voor
     buitenstaanders, ook niet voor de organisatie (zie de kop).

     `zonderPas` is een GETAL en geen aansporing. Er komt hier geen tekst bij,
     geen knop en geen klok. */
  function groepStand(fid, eid, id, codenaam) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const g = bak(e)[String(id || '')];
    const wie = schoon(codenaam, 60);
    if (!g || g.beeindigd || !isLid(g, wie)) return { status: 404, error: 'Deze groep bestaat niet.' };
    /* Wie een pas heeft, wordt GETELD uit de passen zelf. Een vlag op het lid
       zou achterlopen zodra er een pas bijkomt of wordt ingetrokken. */
    const passen = Object.values(e.passen || {});
    const leden = g.leden.map(l => ({ codenaam: l.codenaam, sinds: l.sinds,
      heeftPas: passen.some(p => !p.ingetrokken && p.drager === l.codenaam) }));
    return { ok: true, id: g.id, naam: g.naam, code: g.code, maker: g.maker,
      leden, zonderPas: leden.filter(l => !l.heeftPas).length };
  }

  const groepenVan = (e, codenaam) => Object.values((e && e.groepen) || {})
    .filter(g => !g.beeindigd && isLid(g, codenaam));

  return { groepMaak, groepDeelnemen, groepVerlaat, groepCodeVernieuw, groepStand,
    groepenVan, GROEP_MAX: MAX_LEDEN };
};
