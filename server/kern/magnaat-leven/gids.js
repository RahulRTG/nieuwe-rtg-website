/* Magnaat V4: JE EERSTE UUR, EN JE VERHAAL.

   GEEN UITLEGSCHERM. Wie Magnaat opent, moet kunnen beginnen zonder iets te
   lezen: de Edge zegt al wat nu zin heeft. De gids is wat je naast je hebt:
   de negen stappen van niets naar je eerste betaalde klant, elk met een regel
   waarom. Hij wordt AFGELEID uit wat je deed, niet bijgehouden -- dus hij kan
   niet uit de pas lopen met het spel -- en verdwijnt als de laatste stap klaar
   is.

   MIJLPALEN zijn de momenten die er later toe doen: je eerste klant, je eerste
   geld, je onderneming, je eerste medewerker, de dag dat je je baan opzegt. Ze
   worden een keer vastgelegd, met de dag, en samen zijn ze het verhaal dat het
   spel je aan het eind laat zien. */
'use strict';
const R = require('./regels');
const { euro } = require('./staat');

const STAPPEN = [
  ['kies', 'Kies wat je gaat maken', 'Met je laptop en telefoon kun je iets voor jezelf beginnen.', (st) => !!st.aanbod],
  ['plan', 'Plan tijd voor je eigen project', 'Een uur kan maar een keer op: aan je project, aan leren, of aan een extra dienst.',
    (st) => st.portfolio > 0 || Object.values(st.agenda).some(l => l.some(x => x.wat === 'project'))],
  ['dag', 'Sluit je eerste dag af', 'Wat je plande, gebeurt aan het eind van de dag.', (st) => st.dag > 1],
  ['kans', 'Laat iemand je werk zien', 'Na zes uur aan je project ziet iemand wat je maakt.', (st) => st.deals.length > 0],
  ['gesprek', 'Praat met je eerste kans', 'Een half uur, en dan weet je wat hij wil en wanneer.', (st) => st.deals.some(d => d.fase !== 'kans')],
  ['afspraak', 'Maak een afspraak', 'Over drie dingen: de prijs, de deadline en hoeveel vooraf.', (st) => st.deals.some(d => d.afspraak)],
  ['lever', 'Lever je eerste werk op', 'Plan je uren tot het af is.', (st) => st.deals.some(d => d.geleverdOp)],
  ['factuur', 'Stuur je eerste factuur', 'Omzet is geen geld: pas als de klant betaalt, staat het op je rekening.', (st) => st.deals.some(d => d.factuur)],
  ['betaald', 'Word betaald', 'De eerste klant betaalt te laat. Wat doe je tot dan?', (st) => st.betaald > 0]
];

function gids(st) {
  const stappen = STAPPEN.map(([id, tekst, uitleg, klaar]) => ({ id, tekst, uitleg, klaar: !!klaar(st) }));
  const nu = stappen.find(s => !s.klaar);
  return nu ? { stappen, nu: nu.id, gedaan: stappen.filter(s => s.klaar).length } : null;
}

/* Een mijlpaal, een keer, met de dag. */
function mijlpaal(st, id, tekst) {
  st.mijlpalen = st.mijlpalen || [];
  if (st.mijlpalen.some(m => m.id === id)) return false;
  st.mijlpalen.push({ id, dag: st.dag, tekst });
  return true;
}

/* Het verhaal: de mijlpalen, en als je van je bedrijf leeft de samenvatting die
   V1 belooft -- je begon met bijna niets, en dit heb jij opgebouwd. */
function verhaal(st, c) {
  const klanten = new Set(st.deals.filter(d => d.fase === 'betaald').map(d => d.klantId)).size;
  return {
    mijlpalen: (st.mijlpalen || []).slice(),
    slot: st.zelfstandig ? {
      tekst: 'Je begon op een maandag met ' + euro(R.niveauVan(st).startKas) + ' en een baan in de keuken. Na ' + st.dag + ' dagen leef je van ' +
        (st.onderneming ? st.onderneming.naam : 'je eigen bedrijf') + '.',
      omzet: c.omzet, resultaat: c.resultaat, klanten, team: (st.team || []).filter(m => !m.weg).length, dagen: st.dag
    } : null
  };
}

module.exports = { gids, mijlpaal, verhaal, STAPPEN };
