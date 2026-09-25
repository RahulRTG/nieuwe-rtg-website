/* Magnaat World na 1.0: DE SPEELRONDE MET MENSEN. De balans van 1.0 is
   afgestemd op een automatische speler; of dag 97 op normaal goed VOELT, zegt
   alleen een mens. Op drie momenten vraagt het spel daarom hoe het speelt:
   als je je onderneming inschrijft, als je van je bedrijf kunt leven, en als
   een leven voorbij is. Te makkelijk, goed zo of te zwaar, met een regel tekst
   als je wilt, of overslaan.

   Drie grenzen, en ze staan in de vorm van wat er bewaard wordt:
     - ANONIEM. Een oordeel draagt het niveau, het moment, de speldag, de datum
       en wat je vond. Geen sessiesleutel, geen codenaam, geen wereld: wat hier
       staat is niet terug te voeren op een speler, ook niet door het kantoor.
       Of iemand een moment al beantwoordde, weet alleen zijn eigen leven.
     - GEEN RANGLIJST EN GEEN CIJFER OP EEN MENS. Het kantoor ziet tellingen
       per niveau en moment, en de losse regels tekst. Er is geen gemiddelde
       per speler, want er is geen speler.
     - BEGRENSD. Hooguit MAX oordelen; de oudste valt eraf. Een regel tekst is
       hooguit TEKST tekens, zonder stuurtekens. */
'use strict';
const R = require('./regels');
const { meld } = require('./staat');

const OORDELEN = { 'te-makkelijk': 'Te makkelijk', goed: 'Goed zo', 'te-zwaar': 'Te zwaar' };
const MOMENTEN = {
  voorbij: 'dit leven is voorbij',
  zelfstandig: 'je kunt van je eigen bedrijf leven',
  onderneming: 'je hebt je onderneming ingeschreven'
};
const MAX = 2000, TEKST = 280;

/* Het eerste moment dat bereikt is en nog geen antwoord heeft, het zwaarste eerst. */
function oordeelOpen(st) {
  const gedaan = st.oordelen || {};
  const bereikt = { voorbij: !!st.voorbij, zelfstandig: !!st.zelfstandigMag, onderneming: !!st.onderneming };
  return Object.keys(MOMENTEN).find(m => bereikt[m] && !gedaan[m]) || null;
}

function oordeelGeef(st, z, lijst, nu) {
  const moment = oordeelOpen(st);
  if (!moment) return { status: 400, error: 'Er staat nu geen vraag open over hoe het speelt.' };
  if (z.moment !== moment) return { status: 400, error: 'Die vraag staat niet (meer) open.' };
  if (z.oordeel !== 'overslaan' && !Object.prototype.hasOwnProperty.call(OORDELEN, z.oordeel)) {
    return { status: 400, error: 'Kies te makkelijk, goed zo of te zwaar, of sla de vraag over.' };
  }
  /* Een antwoord sluit ook de eerdere momenten die nog openstonden: wie op het
     einde zegt hoe het speelde, krijgt daarna niet alsnog de vraag van de inschrijving. */
  st.oordelen = Object.assign({}, st.oordelen);
  for (let m = moment; m; m = oordeelOpen(st)) st.oordelen[m] = st.dag;
  if (z.oordeel === 'overslaan') return { ok: true };
  const tekst = typeof z.toelichting === 'string'
    ? z.toelichting.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TEKST) : '';
  lijst.push({ moment, moeilijkheid: st.moeilijkheid || 'normaal', dag: st.dag, oordeel: z.oordeel,
    tekst: tekst || null, op: new Date(nu).toISOString().slice(0, 10) });
  if (lijst.length > MAX) lijst.splice(0, lijst.length - MAX);
  meld(st, 'Dank je. Je oordeel is anoniem bewaard: zonder je naam en zonder je codenaam.', 'goed');
  return { ok: true };
}

/* Wat het kantoor ziet: tellingen per niveau en moment, en de laatste regels tekst. */
function oordeelOverzicht(lijst) {
  const leeg = () => Object.fromEntries(Object.keys(OORDELEN).map(o => [o, 0]));
  const perNiveau = {};
  for (const n of Object.keys(R.MOEILIJKHEID)) perNiveau[n] = Object.fromEntries(Object.keys(MOMENTEN).map(m => [m, leeg()]));
  for (const x of lijst) {
    const cel = perNiveau[x.moeilijkheid] && perNiveau[x.moeilijkheid][x.moment];
    if (cel && Object.prototype.hasOwnProperty.call(cel, x.oordeel)) cel[x.oordeel] += 1;
  }
  return {
    totaal: lijst.length, max: MAX, oordelen: OORDELEN, momenten: MOMENTEN, perNiveau,
    regels: lijst.filter(x => x.tekst).slice(-20).reverse()
      .map(x => ({ moeilijkheid: x.moeilijkheid, moment: x.moment, dag: x.dag, oordeel: x.oordeel, tekst: x.tekst, op: x.op })),
    grens: 'Anoniem: geen sessiesleutel, geen codenaam, geen wereld. Tellingen per niveau en moment, nooit per speler.',
    nietGemeten: ['wie een oordeel gaf (met opzet niet bewaard)', 'hoe vaak een vraag werd overgeslagen (overslaan wordt niet geteld)']
  };
}

module.exports = { oordeelOpen, oordeelGeef, oordeelOverzicht, OORDELEN, MOMENTEN, MAX, TEKST };
