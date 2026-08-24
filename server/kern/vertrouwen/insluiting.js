/* ============================================================================
   BEVOEGDHEID GROEIT NOOIT -- laag 4 van de Trust Fabric (VERTROUWEN.md par. 6).

       gedelegeerde    subset van  delegator
       AI-agent        subset van  wie hem stuurt
       benedenstrooms  subset van  waar het verzoek begon

   WAAR DIE REGEL IN DIT HUIS ECHT KAN SNEUVELEN, en dat is een kortere lijst
   dan het bovenstaande suggereert. Rollen uitdelen kan alleen met het
   beheer-token, en dat heeft alle rechten -- daar kan een kind zijn ouder dus
   niet overtreffen. De identiteitsbrug wijst alleen naar rollen die al bestaan.
   Wat overblijft is de plek waar een recht wordt OMGEZET in een handeling: de
   werkwoordentabel van de commandobalk (bedrijf/handeling-lijst.js).

   DAAR ZIT DE ECHTE VAL. Elk werkwoord noemt een `recht` en zegt in `raakt()`
   welke soorten objecten het aanraakt. Die twee kunnen uit elkaar lopen zonder
   dat iemand het merkt: een werkwoord dat `recht: 'kennis'` declareert maar een
   TAAK aanmaakt, geeft iedereen met alleen `kennis` opeens projectrechten. De
   rechtencontrole in handeling.js is dan nog steeds correct -- hij controleert
   keurig het verkeerde recht.

   DIT IS EEN CONTROLE OP EEN CONSTANTE TABEL, dus hij hoort bij het OPSTARTEN
   en niet bij elk verzoek: een tabel die bij de start deugt, deugt de hele dag.
   handeling.js roept hem aan bij het ophangen van de routes en gooit als er
   iets niet klopt -- een server die met een amplificatiepad start, is erger dan
   een server die niet start.

   WAT DEZE LAAG NIET DEKT, en dat hoort in de bon te blijven staan tot het wel
   zo is: dit controleert de TABEL en niet de uitvoerder. Een werkwoord dat het
   juiste recht noemt en in zijn uitvoering stiekem iets anders aanraakt dan
   `raakt()` zegt, komt hier niet uit. Daarvoor zou de uitvoerder zelf moeten
   worden nagelopen, en dat is statische analyse van code en geen tabelvergelijk.
   ========================================================================== */
'use strict';

/* Welk recht bezit welke soort object. DATA, en met opzet kort: elke soort die
   een werkwoord kan aanraken hoort hier te staan, en een soort die hier ontbreekt
   levert een fout en geen stilzwijgende doorlaat. */
const SOORT_RECHT = {
  taak: 'project',
  project: 'project',
  ticket: 'service',
  artikel: 'kennis',
  lid: 'mens',
  besluit: 'besluit',
  contract: 'recht',
  factuur: 'geld'
};

/* De kale insluitingsvraag: krijgt het kind iets wat de ouder niet had? */
function groeit(ouder, kind) {
  const had = new Set(ouder || []);
  const erbij = [...new Set(kind || [])].filter(r => !had.has(r));
  return { groeit: erbij.length > 0, erbij };
}

/* Een werkwoord uit de commandobalk. `raakt` is de lijst die het werkwoord zelf
   teruggeeft; wij lezen er alleen de soorten uit. */
function keurHandeling(id, h) {
  const soorten = [...new Set((typeof h.raakt === 'function' ? h.raakt({}) : (h.raakt || []))
    .map(r => String(r && r.soort || '')))].filter(Boolean);
  const onbekend = soorten.filter(s => !SOORT_RECHT[s]);
  const buiten = soorten.filter(s => SOORT_RECHT[s] && SOORT_RECHT[s] !== h.recht);
  if (onbekend.length) return { ok: false, id,
    reden: 'Het werkwoord "' + id + '" raakt de soort(en) ' + onbekend.join(', ') +
      ', en die staan niet in SOORT_RECHT. Zolang niemand heeft opgeschreven onder welk recht die soort valt, is niet te zeggen of dit werkwoord bevoegdheid uitbreidt.' };
  if (buiten.length) return { ok: false, id,
    reden: 'Het werkwoord "' + id + '" vraagt het recht "' + h.recht + '" maar raakt ' +
      buiten.map(s => s + ' (recht "' + SOORT_RECHT[s] + '")').join(' en ') +
      '. Wie alleen "' + h.recht + '" heeft, krijgt daarmee iets erbij.' };
  return { ok: true, id };
}

/* De hele tabel. Levert een lijst klachten; leeg is goed. */
function keurTabel(handelingen) {
  const uit = [];
  for (const [id, h] of Object.entries(handelingen || {})) {
    const u = keurHandeling(id, h || {});
    if (!u.ok) uit.push(u);
  }
  return uit;
}

/* Bij het opstarten. Gooit met alle klachten tegelijk -- een voor een repareren
   terwijl de server steeds opnieuw valt, is de traagste manier. */
function eisTabel(handelingen) {
  const klachten = keurTabel(handelingen);
  if (klachten.length) throw new Error('Bevoegdheid zou kunnen groeien (VERTROUWEN.md laag 4):\n  ' +
    klachten.map(k => k.reden).join('\n  '));
  return true;
}

/* Een rol die een recht noemt dat niet bestaat, geeft niets -- maar hij liegt
   wel op elk scherm dat de rechten van een rol toont. */
function keurRollen(rollen, rechten) {
  const bekend = new Set(rechten || []);
  return (rollen || []).map(r => ({ id: r.id, onbekend: (r.rechten || []).filter(x => !bekend.has(x)) }))
    .filter(r => r.onbekend.length);
}

module.exports = { SOORT_RECHT, groeit, keurHandeling, keurTabel, eisTabel, keurRollen };
