/* ============================================================================
   VOLTOOIPROEF: IK (link:ik, /apps/ik.html) -- Instellingen.

   De belofte: het lid zegt zelf hoe het aangesproken wil worden (voornaamwoord
   en aanhef, vrije tekst -- "een keuzelijst sluit altijd iemand uit") en hoe
   het scherm zich hoort te gedragen (het toegankelijkheidsprofiel uit
   server/kern/toegankelijk.js). Dat profiel geldt op ELK scherm: shared/basis.js
   haalt het op via /api/ik/toegankelijk. Die leesroute is de ONTVANGER: een
   ander scherm dat de keuze moet uitvoeren.

   DE OPSLAG IS DE KLUIS, en dat bepaalt wat schakel 3 van persistent kan
   zeggen. Deze gegevens staan in users.member_state (rtg.db), versleuteld en
   gebonden aan de rij (server/accounts/gebonden.js). De proef ontsleutelt die
   kolom met opzet NIET: dan zou een meetscript de sleutel van de kluis lezen.
   Wat hij wel vaststelt: de versleutelde waarde van precies EEN rij veranderde
   door de handeling, en de klare tekst staat er niet in. Dat de INHOUD klopt,
   bewijzen de schakels via de route na herstart en in een nieuwe sessie.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const IK = '/api/ik';
const ZET = '/api/ik/zet';
const TOEG = '/api/ik/toegankelijk';
const TOEG_ZET = '/api/ik/toegankelijk/zet';

const merk = () => Date.now().toString(36).slice(-5);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'ikk');
  const A = lid.token;
  const VNW = 'hen/die ' + merk();
  const AANHEF = 'Beste ' + merk();
  const kluis = () => new Map(w.opslag('rtg.db', 'SELECT id, member_state FROM users WHERE member_state IS NOT NULL').map((r) => [r.id, String(r.member_state)]));

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een nieuw lid heeft geen voornaamwoord en het standaardprofiel', async () => {
    const r = await w.post(IK, {}, A);
    const t = r.data && r.data.toegankelijk;
    return { klopt: r.status === 200 && r.data.voornaamwoord === '' && !!t && t.tekst === 'normaal' && t.contrast === 'normaal',
      ziet: 'voornaamwoord "' + (r.data && r.data.voornaamwoord) + '", tekst ' + (t && t.tekst) + ', contrast ' + (t && t.contrast) };
  });

  let voorZet = null;
  await stap('voltooibaar', 'het lid zet zijn voornaamwoord en aanhef in eigen woorden', async () => {
    voorZet = kluis();
    const r = await w.post(ZET, { voornaamwoord: VNW, aanhef: AANHEF }, A);
    const ik = await w.post(IK, {}, A);
    return { klopt: r.status === 200 && ik.data.voornaamwoord === VNW && ik.data.aanhef === AANHEF,
      ziet: '"' + (ik.data && ik.data.voornaamwoord) + '", "' + (ik.data && ik.data.aanhef) + '"' };
  });

  await stap('voltooibaar', 'het lid zet groot en hoog contrast; elk ander scherm leest dat via de gedeelde leesroute', async () => {
    const r = await w.post(TOEG_ZET, { tekst: 'groot', contrast: 'hoog' }, A);
    const ander = await w.post(TOEG, {}, A);
    const t = ander.data && ander.data.toegankelijk;
    return { klopt: r.status === 200 && ander.status === 200 && !!t && t.tekst === 'groot' && t.contrast === 'hoog' && t.beweging === 'normaal',
      ziet: 'zet ' + r.status + '; leesroute: tekst ' + (t && t.tekst) + ', contrast ' + (t && t.contrast) + ', beweging ' + (t && t.beweging) };
  });

  /* Een onbekende waarde valt voor DAT veld terug op de standaard (schoonProfiel
     in kern/toegankelijk.js) en niet op wat er stond; het scherm stuurt alleen
     bestaande keuzes. Wat hier beweerd wordt is dus smaller: hij wordt nooit
     opgeslagen, en de andere velden blijven staan. */
  await stap('voltooibaar', 'een onbekende keuze wordt nooit opgeslagen, en de andere instellingen blijven staan', async () => {
    const r = await w.post(TOEG_ZET, { tekst: 'reusachtig' }, A);
    const t = ((await w.post(TOEG, {}, A)).data || {}).toegankelijk;
    return { klopt: geen5xx(r) && !!t && t.tekst !== 'reusachtig' && t.contrast === 'hoog',
      ziet: 'status ' + r.status + ', tekst ' + (t && t.tekst) + ', contrast ' + (t && t.contrast) };
  });

  /* ---------------- persistent ---------------- */
  await w.post(TOEG_ZET, { tekst: 'groter', beweging: 'stil' }, A);
  const voor = JSON.stringify((await w.post(IK, {}, A)).data);
  await w.herstart();

  await stap('persistent', 'na een nette herstart staan voornaamwoord, aanhef en profiel er nog', async () => {
    const na = JSON.stringify((await w.post(IK, {}, A)).data);
    return { klopt: voor !== 'null' && na === voor, ziet: 'beeld ' + (na === voor ? 'byte voor byte gelijk' : 'ANDERS') };
  });
  await stap('persistent', 'een nieuwe sessie (een andere browser) krijgt hetzelfde profiel', async () => {
    const C = await inloggen(w, lid);
    const ik = (await w.post(IK, {}, C)).data || {};
    const t = ik.toegankelijk || {};
    return { klopt: ik.voornaamwoord === VNW && t.tekst === 'groter' && t.beweging === 'stil' && t.contrast === 'hoog',
      ziet: '"' + ik.voornaamwoord + '", tekst ' + t.tekst + ', beweging ' + t.beweging };
  });
  await stap('persistent', 'in de kluis (rtg.db, buiten de server om) veranderde precies een rij, versleuteld en zonder de klare tekst', async () => {
    const na = kluis();
    const anders = [...na.entries()].filter(([id, v]) => voorZet.get(id) !== v);
    const klaar = anders.some(([, v]) => v.includes(VNW) || v.includes(AANHEF));
    return { klopt: anders.length === 1 && !klaar, ziet: anders.length + ' rij(en) veranderd sinds voor de handeling, klare tekst ' + (klaar ? 'ZICHTBAAR' : 'niet te vinden') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbelklik: dezelfde keuze twee keer geeft dezelfde stand', async () => {
    const [a, b] = await Promise.all([w.post(TOEG_ZET, { links: 'streep' }, A), w.post(TOEG_ZET, { links: 'streep' }, A)]);
    const t = ((await w.post(TOEG, {}, A)).data || {}).toegankelijk || {};
    return { klopt: a.status === 200 && b.status === 200 && t.tekst === 'groter' && t.contrast === 'hoog',
      ziet: a.status + '/' + b.status + ', tekst ' + t.tekst + ', links ' + t.links };
  });

  const NIEUW = 'zij/haar ' + merk();
  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: de nieuwe stand, de rest onaangetast', async () => {
    const half = await w.afgebroken(ZET, { voornaamwoord: NIEUW }, A);
    const opnieuw = await w.post(ZET, { voornaamwoord: NIEUW }, A);
    const ik = (await w.post(IK, {}, A)).data || {};
    return { klopt: opnieuw.status === 200 && ik.voornaamwoord === NIEUW && ik.aanhef === AANHEF,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', "' + ik.voornaamwoord + '", aanhef bleef "' + ik.aanhef + '"' };
  });

  await stap('herstelbaar', 'een crash direct na het zetten: de keuze staat er nog', async () => {
    const r = await w.post(TOEG_ZET, { contrast: 'normaal' }, A);
    await w.crash();
    const t = ((await w.post(TOEG, {}, A)).data || {}).toegankelijk || {};
    return { klopt: r.status === 200 && t.contrast === 'normaal' && t.tekst === 'groter', ziet: 'zet ' + r.status + ', na SIGKILL contrast ' + t.contrast + ', tekst ' + t.tekst };
  });
}

/* ---------------- de kruisproef (bewijs 6, scripts/lib/ledenkruis.js) ----------------
   Zaait iets dat ALLEEN van dit lid is, zodat "een ander zag niets" een uitslag
   is en geen leeg experiment. `merktekens` mogen in geen antwoord aan een ander
   staan; `lezers` moeten na alle pogingen van de anderen byte voor byte gelijk
   terugkomen; `handelingen` doen de anderen eerst, en daarna het lid zelf. */
async function zaai(w) {
  const lid = await nieuwLid(w, 'kikk');
  const VNW = 'zij/haar ' + merk() + 'kr', AANHEF = 'Geachte ' + merk() + 'kr';
  await w.post(ZET, { voornaamwoord: VNW, aanhef: AANHEF }, lid.token);
  await w.post(TOEG_ZET, { tekst: 'groot', contrast: 'hoog' }, lid.token);
  return { lid, merktekens: [VNW, AANHEF], lezers: [{ pad: IK }, { pad: TOEG }],
    handelingen: [{ pad: ZET, lijf: { voornaamwoord: 'hen/die ' + merk() + 'kr' } }, { pad: TOEG_ZET, lijf: { beweging: 'stil' } }] };
}

module.exports = {
  functie: 'link:ik',
  ingang: '/apps/ik.html',
  persona: 'lid',
  belofte: 'een lid zegt zelf hoe het aangesproken wil worden en hoe elk scherm zich hoort te gedragen, en dat geldt op elk scherm en op elk toestel -- ook na een herstart of een crash',
  grens: 'De proef loopt over de routes die het scherm aanroept en de gedeelde leesroute van het profiel, niet door het scherm zelf; of shared/basis.js het profiel ook UITVOERT, is niet gemeten. De kluiskolom wordt niet ontsleuteld: dat de waarde klopt, bewijst de route; dat hij op schijf veranderde en versleuteld is, bewijst de opslag. Fase, omgang en geloof zijn niet beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop,
  zaai
};
