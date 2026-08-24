/* ============================================================================
   DE BLAST RADIUS -- laag 6 van de Trust Fabric (VERTROUWEN.md par. 6).

   Een beheerder ziet vandaag RECHTEN. Dat is iets anders dan bereik: "deze
   persoon heeft het recht mens" zegt niet hoeveel mensen dat zijn, in hoeveel
   werkruimtes, en waar hij tegen een muur loopt. De vraag die deze module
   beantwoordt is de enige die er bij een incident toe doet:

     als dit account NU wordt overgenomen, wat kan een aanvaller maximaal raken?

   HET ANTWOORD IS EEN ONDERGRENS VAN WAT HET MODEL WEET, EN GEEN BOVENGRENS VAN
   DE SCHADE. Dat staat in VERTROUWEN.md par. 3.6 en het hoort in het antwoord
   zelf te staan, niet in een voetnoot: langs de paden die wij hebben
   gemodelleerd komt deze actor tot hier. Er kan een pad zijn dat wij niet
   kennen -- een onbekende kwetsbaarheid staat in geen enkele graaf. Vandaar
   `nietGemodelleerd`, naast de `nietGerekend` van de blootstellingsmeter.

   DRIE DINGEN WORDEN GETELD, en alle drie uit de echte opslag:

     waar      in welke werkruimtes heeft deze actor een geldige rol
     wat       welke rechten leveren die rollen samen op
     hoeveel   per handelingssoort: hoe groot mag hij worden voordat de poort
               van laag 3 hem tegenhoudt

   DAT DERDE IS DE KERN. Een aanvaller wordt niet gestopt door een recht maar
   door een DREMPEL, en die is per actor anders omdat hij tegen het eigen
   normale bereik meet. Zonder dit getal is een blast radius een lijst met
   permissies in een ander lettertype.

   DEZE MODULE SCHRIJFT NIETS. Hij telt, en dat is alles.
   ========================================================================== */
'use strict';

const R = require('./register');
const blootstelling = require('./blootstelling');
const gewoonte = require('./gewoonte');
const { datum: klokDatum } = require('../../lib/klok');

const NIET_GEMODELLEERD = [
  { wat: 'onbekende kwetsbaarheden', reden: 'Dit bereik volgt de paden die dit huis kent. Een fout die niemand kent, staat in geen enkele graaf en dus ook niet hier.' },
  { wat: 'fysieke toegang en het apparaat zelf', reden: 'Wie de laptop in handen heeft of meekijkt, komt niet langs een van deze poorten.' },
  { wat: 'de leverancier van de leverancier', reden: 'Wat een koppeling van een klant zelf weer aan derden geeft, is hier niet te zien.' },
  { wat: 'samenloop met een tweede account', reden: 'Dit is het bereik van EEN actor. Twee tegelijk gecompromitteerde accounts kunnen samen meer dan de som; die berekening staat er niet.' }
];

/* Welke werkruimtes kent deze actor, en met welke rollen. `bak` is db.data.

   ALLEEN ROLLEN DIE VANDAAG GELDEN. Een blast radius gaat over NU: een rol die
   vorige maand afliep geeft vandaag niets, en meetellen zou het bereik groter
   voorstellen dan het is -- een alarm bij iets wat al is opgelost. Andersom zou
   een rol die volgende week ingaat het bereik te klein voorstellen, en dat is
   de gevaarlijker fout van de twee. Dezelfde van/tot-regel als
   bedrijf/rollen.js rollenVan(); die staat daar en wordt hier niet overgetypt
   maar nagevolgd, want de rollen reizen als data mee in de werkruimte. */
function ruimtes(bak, actor) {
  const vandaag = klokDatum().toISOString().slice(0, 10);
  const geldig = (r) => (!r.van || r.van <= vandaag) && (!r.tot || r.tot >= vandaag);
  const uit = [];
  for (const [code, w] of Object.entries((bak && bak.werkruimtes) || {})) {
    const l = Object.values(w.leden || {}).find(x => x && (x.id === actor || x.rtgKey === actor));
    if (!l) continue;
    const alle = l.rollen || [];
    uit.push({ code, naam: w.naam || code, lidId: l.id, status: l.status || 'actief',
      rollen: alle.filter(geldig).map(r => r.id),
      buitenVenster: alle.filter(r => !geldig(r)).map(r => r.id) });
  }
  return uit;
}

/* Per handelingssoort: waar loopt hij tegen de poort aan? Het getal komt uit
   dezelfde meter die de poort gebruikt -- niet uit een tweede berekening, want
   twee tellers die hetzelfde moeten vinden lopen uiteen (LAT.md regel 4). */
function grenzen(bak, actor) {
  const uit = [];
  for (const s of R.SOORTEN) {
    const eigen = gewoonte.lees((bak && bak.vertrouwen) || {}, actor, s.id);
    /* Zoek het grootste aantal dat NET niet om een tweede moment vraagt: dat is
       precies hoever een overgenomen sessie ongehinderd komt. Binair, want de
       zwaarte is monotoon in het aantal. */
    let laag = 0, hoog = 1;
    const zwaar = (n) => blootstelling.meet({ soort: s.id, aantal: n }, eigen).zwaarte !== 'licht';
    if (zwaar(0)) { uit.push({ soort: s.id, naam: s.naam, eenheid: s.eenheid, ongehinderd: 0,
      reden: s.waaromMinstens || 'Deze soort vraagt altijd een tweede moment.' }); continue; }
    while (!zwaar(hoog) && hoog < 1e9) { laag = hoog; hoog *= 2; }
    while (laag + 1 < hoog) { const m = Math.floor((laag + hoog) / 2); if (zwaar(m)) hoog = m; else laag = m; }
    uit.push({ soort: s.id, naam: s.naam, eenheid: s.eenheid, ongehinderd: laag,
      daarnaTegengehouden: 'vanaf ' + hoog + ' ' + s.eenheid + ' vraagt de poort een tweede bevestiging' });
  }
  return uit;
}

/* Het bereik van een actor. `rechtenVan` komt van de aanroeper: het rollenmodel
   woont in bedrijf/rollen.js en hoort niet in twee lagen te staan. */
function van(bak, actor, rechtenVan) {
  const w = ruimtes(bak, actor);
  const rechten = new Set();
  for (const r of w) for (const recht of (rechtenVan ? rechtenVan(r) : [])) rechten.add(recht);
  return {
    actor: String(actor || ''),
    werkruimtes: w,
    rechten: [...rechten].sort(),
    grenzen: grenzen(bak, actor),
    nietGemodelleerd: NIET_GEMODELLEERD
  };
}

/* ---------- laag 7: simuleer een compromittering ----------

   Dezelfde graaf, anders bevraagd: niet "wat mag deze mens" maar "wat kan
   iemand die zijn sessie heeft". Het verschil zit in de NEGATIEVE kant -- wat
   een aanvaller NIET kan is het antwoord waar een CIO naar zoekt, en dat is af
   te leiden uit de rechten die deze actor mist.

   HIJ VERANDERT NIETS EN RAAKT PRODUCTIE NIET AAN (VERTROUWEN.md par. 3.4). Er
   is geen save() in dit bestand; hij leest de opslag en rekent. */
function simuleer(bak, actor, { rechtenVan, alleRechten } = {}) {
  const b = van(bak, actor, rechtenVan);
  const heeft = new Set(b.rechten);
  const mist = (alleRechten || []).filter(r => !heeft.has(r));

  /* Een catastrofaal pad is een ONOMKEERBARE handeling die deze actor
     ongehinderd kan doen -- zonder dat de poort van laag 3 ertussen komt. Die
     twee eigenschappen samen, en niet een van de twee: een onomkeerbare
     handeling met een poort ervoor is niet catastrofaal maar bewaakt, en een
     ongehinderde omkeerbare handeling is hooguit vervelend. */
  const catastrofaal = b.grenzen.filter(g => {
    const s = R.soort(g.soort);
    return s && !s.omkeerbaar && g.ongehinderd > 0;
  }).map(g => ({ soort: g.soort, tot: g.ongehinderd + ' ' + g.eenheid }));

  return {
    actor: b.actor,
    werkruimtes: b.werkruimtes,
    kan: b.grenzen.filter(g => g.ongehinderd > 0),
    kanNiet: mist.map(r => ({ recht: r, wat: 'geen enkele rol van deze actor draagt het recht "' + r + '"' })),
    tegengehouden: b.grenzen.filter(g => g.ongehinderd === 0)
      .map(g => ({ soort: g.soort, reden: g.reden || 'de poort vraagt hier altijd een tweede bevestiging' })),
    catastrofaal,
    oordeel: catastrofaal.length
      ? 'Er is een onomkeerbare handeling die deze actor ongehinderd kan doen.'
      : 'Geen catastrofaal pad langs de gemodelleerde routes.',
    nietGemodelleerd: NIET_GEMODELLEERD
  };
}

module.exports = { van, simuleer, ruimtes, grenzen, NIET_GEMODELLEERD };
