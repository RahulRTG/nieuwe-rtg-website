/* VRIJHEID: DE NEDERLANDSE REKENREGEL VOOR VAKANTIEDAGEN -- een BEREKENING in
   WorkOS, en nog geen recht.

   Besluit van de eigenaar (11 oktober 2026, B1): er komt een juridisch
   gevalideerde Nederlandse rekenregel, WorkOS voert hem uit en controleert de
   brongegevens, en tot de juridische toets is afgerond blijft de productiepoort
   GESLOTEN. Dit bestand is de regel; de poort staat in ./vakantiepoort.js en
   de aansluiting op de bronnen in ./saldobron.js.

   WAT DE REGEL VOLGT (VRIJHEID.md par. 6a -- GEEN juridisch oordeel):

     art. 7:634 lid 1 BW  per jaar met recht op loon over de volle
                          overeengekomen arbeidsduur: ten minste VIERMAAL de
                          overeengekomen arbeidsduur per week. De factor komt
                          als laag LEGAL_BASELINE in het beleid
                          (`WETTELIJKE_LAAG`), zodat een cao of contract hem
                          nooit stil kan verlagen (./beleid.js, de conflictregel).
     art. 7:634 lid 2 BW  over een deel van het jaar: naar rato. Hier per
                          kalenderdag, over het deel van het jaar waarin het
                          dienstverband loopt.
     wisselende duur      naar rato PER PERIODE: elke contractversie
                          (kern/payroll/contracten.js) geldt vanaf haar `vanaf`,
                          en elke dag telt met de arbeidsduur van de versie die
                          OP DIE DAG geldt -- dezelfde vraag die de loonrun
                          stelt (`opDatum`).
     art. 7:635 BW        opbouw over een tijdvak zonder loon. Tijdens ZIEKTE
                          loopt de opbouw door; dat is het artikel dat hier
                          gelezen wordt. Het verzuimregister
                          (kern/payroll/verzuim.js) is de bron van die tijdvakken.

   Per verzuimsoort staat in `OPBOUW` wat de regel doet en op welke grond. Een
   soort waarvan de regel het niet zeker weet (ouderschaps- en zorgverlof:
   gedeeltelijk loon) is OPEN: dan rekent hij niet, met de reden -- nooit een
   geraden aftrek.

   BRONCONTROLE. Ontbrekend dienstverband, geen contractversie op een dag van
   het dienstverband, een contract zonder vaste arbeidsduur, of een vaste soort
   zonder `urenPerWeek`: dan is de uitkomst `null` met de reden, nooit nul. Een
   recht van nul uur is een UITSPRAAK, en die doet deze regel alleen als de
   bronnen hem dragen.

   WAT HIJ NIET DOET: bovenwettelijk verlof (het contract heeft er geen veld
   voor; ./saldobron.js zegt dat), een contract zonder vaste omvang (oproep,
   nuluren, uitzend, freelance: dan hangt het recht aan gewerkte uren en die regel is niet
   gegeven), en wat er OPGENOMEN is -- dat is het saldo en niet het recht.

   PUUR: geen opslag, geen klok. Dezelfde invoer geeft altijd hetzelfde getal,
   zodat de jurist de uitkomst kan narekenen met de invoer erbij. */
'use strict';
const crypto = require('crypto');
const { heeftVasteOmvang, VASTE_OMVANG } = require('../payroll/samenstellen-rekenhulp');

const REGEL = 'verlof.wettelijkWekenPerJaar';

const ARTIKELEN = Object.freeze([
  Object.freeze({ artikel: 'art. 7:634 lid 1 BW', wat: 'ten minste viermaal de overeengekomen arbeidsduur per week, per jaar met recht op loon' }),
  Object.freeze({ artikel: 'art. 7:634 lid 2 BW', wat: 'naar rato over een deel van het jaar' }),
  Object.freeze({ artikel: 'art. 7:635 BW', wat: 'opbouw over tijdvakken zonder loon; tijdens ziekte loopt de opbouw door' })
]);

/* De wettelijke laag, voor wie Nederlands arbeidsrecht volgt. Wat er staat is
   de tekst van de wet en geen keuze; of hij voor deze laag goed is toegepast,
   toetst de jurist (./vakantiepoort.js). */
const WETTELIJKE_LAAG = Object.freeze({
  LEGAL_BASELINE: Object.freeze({ [REGEL]: Object.freeze({ waarde: 4, bron: 'art. 7:634 lid 1 BW' }) })
});

/* Per soort uit het verzuimregister: loopt de opbouw door, of niet, of is het
   open. Elke soort uit kern/payroll/verzuim.js staat hier -- een soort die er
   niet staat, is OPEN (test/vrijheid-vakantieregel.test.js houdt dat vast). */
const OPBOUW = Object.freeze({
  vakantie:     { opbouw: 'loopt-door', grond: 'art. 7:634 lid 1 BW: tijdens vakantie bestaat recht op loon' },
  rtgdag:       { opbouw: 'loopt-door', grond: 'art. 7:634 lid 1 BW: een RTG Day is volledig betaald' },
  verjaardag:   { opbouw: 'loopt-door', grond: 'art. 7:634 lid 1 BW: de verjaardag is volledig betaald' },
  bijzonder:    { opbouw: 'loopt-door', grond: 'art. 7:634 lid 1 BW: bijzonder verlof is volledig betaald' },
  geboorte:     { opbouw: 'loopt-door', grond: 'art. 7:634 lid 1 BW: geboorteverlof is volledig betaald' },
  ziek:         { opbouw: 'loopt-door', grond: 'art. 7:635 BW: tijdens ziekte loopt de opbouw door' },
  zwangerschap: { opbouw: 'loopt-door', grond: 'art. 7:635 BW: zwangerschaps- en bevallingsverlof' },
  onbetaald:    { opbouw: 'geen',       grond: 'art. 7:634 lid 1 en 7:635 BW: over een tijdvak zonder recht op loon en zonder uitzondering geen opbouw' },
  ouderschap:   { opbouw: 'open',       grond: 'gedeeltelijk loon; hoe art. 7:635 BW deze soort raakt, is niet vastgesteld' },
  zorg:         { opbouw: 'open',       grond: 'gedeeltelijk loon; hoe art. 7:635 BW deze soort raakt, is niet vastgesteld' }
});

/* De versie van de regel: een hash over wat hij volgt. Een juridische toets op
   versie A is geen toets op versie B -- ./vakantiepoort.js gaat vanzelf dicht
   als deze verandert. */
const REGELVERSIE = 'vr1-' + crypto.createHash('sha256')
  .update(JSON.stringify([ARTIKELEN, WETTELIJKE_LAAG, OPBOUW, VASTE_OMVANG])).digest('hex').slice(0, 12);

const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const dag = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const DAG = 86400000;

/* De versie die op een dag geldt -- exact de vraag van contracten.opDatum. */
function versieOp(versies, d) {
  const geldig = versies.filter(v => v.vanaf <= d && (!v.tot || v.tot >= d));
  return geldig.length ? geldig[geldig.length - 1] : null;
}

/* jaar, dienstverband { van, tot }, versies [{ vanaf, tot, soort, urenPerWeek }]
   (een contract, alle versies), verzuim [{ van, tot, soort }], weken (uit het
   beleid). Geeft { uren, perioden, zonderOpbouw, open } -- `uren` is null zodra
   `open` iets bevat. */
function reken({ jaar, dienstverband, versies, verzuim, weken }) {
  const j = String(jaar);
  const open = [];
  const jaarVan = j + '-01-01', jaarTot = j + '-12-31';
  const dagenInJaar = (dag(jaarTot) - dag(jaarVan)) / DAG + 1;
  if (!(typeof weken === 'number' && weken > 0)) open.push('De wettelijke factor (' + REGEL + ') is niet gegeven.');
  if (!dienstverband || !isDatum(dienstverband.van)) open.push('Het dienstverband heeft geen ingangsdatum; zonder ingang is er niets te rekenen.');
  if (open.length) return { uren: null, perioden: [], zonderOpbouw: [], open };

  const van = dienstverband.van > jaarVan ? dienstverband.van : jaarVan;
  const tot = dienstverband.tot && dienstverband.tot < jaarTot ? dienstverband.tot : jaarTot;
  if (van > tot) return { uren: null, perioden: [], zonderOpbouw: [], open: ['Het dienstverband loopt niet in ' + j + '.'] };

  const vs = (versies || []).slice().sort((a, b) => (a.vanaf < b.vanaf ? -1 : a.vanaf > b.vanaf ? 1 : 0));
  const vz = (verzuim || []).filter(m => m && isDatum(m.van));
  const perioden = []; const zonderOpbouw = [];
  let zonderContract = null; const meldOpen = new Set();
  let totaal = 0;

  for (let t = dag(van); t <= dag(tot); t += DAG) {
    const d = iso(t);
    const v = versieOp(vs, d);
    if (!v) { if (!zonderContract) zonderContract = { van: d, tot: d }; else zonderContract.tot = d; continue; }
    if (!heeftVasteOmvang(v)) {
      meldOpen.add(VASTE_OMVANG.includes(v.soort)
        ? 'De contractversie vanaf ' + v.vanaf + ' (' + v.soort + ') noemt geen arbeidsduur per week; die ontbreekt in de bron en is geen nul.'
        : 'De contractversie vanaf ' + v.vanaf + ' is een ' + v.soort + '-contract zonder vaste arbeidsduur per week; dan hangt het recht aan de gewerkte uren, en die regel is niet gegeven.');
      continue;
    }
    const m = vz.find(x => x.van <= d && (!x.tot || x.tot >= d));
    const o = m ? (OPBOUW[m.soort] || { opbouw: 'open', grond: 'onbekende verzuimsoort ' + m.soort }) : null;
    if (o && o.opbouw === 'open') { meldOpen.add('Verzuim (' + m.soort + ') vanaf ' + m.van + ': ' + o.grond + '.'); continue; }
    const per = weken * v.urenPerWeek / dagenInJaar;
    const sleutel = v.vanaf + '|' + v.urenPerWeek;
    if (o && o.opbouw === 'geen') {
      const laatst = zonderOpbouw[zonderOpbouw.length - 1];
      if (laatst && laatst.soort === m.soort && iso(dag(laatst.tot) + DAG) === d) { laatst.tot = d; laatst.dagen++; laatst.uren += per; }
      else zonderOpbouw.push({ van: d, tot: d, dagen: 1, soort: m.soort, grond: o.grond, uren: per });
      continue;
    }
    totaal += per;
    const p = perioden[perioden.length - 1];
    if (p && p.sleutel === sleutel && iso(dag(p.tot) + DAG) === d) { p.tot = d; p.dagen++; p.uren += per; }
    else perioden.push({ sleutel, van: d, tot: d, dagen: 1, urenPerWeek: v.urenPerWeek, soort: v.soort, uren: per });
  }
  if (zonderContract) open.push('Van ' + zonderContract.van + ' tot en met ' + zonderContract.tot + ' loopt het dienstverband zonder contractversie; de arbeidsduur is daar onbekend.');
  for (const r of meldOpen) open.push(r);

  const rond = (x) => Math.round(x * 100) / 100;
  return {
    uren: open.length ? null : rond(totaal),
    perioden: perioden.map(({ sleutel, ...p }) => ({ ...p, uren: rond(p.uren) })),
    zonderOpbouw: zonderOpbouw.map(z => ({ ...z, uren: rond(z.uren) })),
    open,
    dagenInJaar
  };
}

module.exports = { REGEL, ARTIKELEN, WETTELIJKE_LAAG, OPBOUW, REGELVERSIE, reken };
