/* ============================================================================
   VOLTOOIPROEF: WIE BEN IK (link:ik, /apps/ik.html).

   De belofte, in de woorden van routes/ik.js: "wie ben ik voor Rahul". Hoe het
   lid genoemd wil worden, welke toon Rahul aanslaat, welke levensfase, en hoe
   elk scherm van RTG zich gedraagt (tekstgrootte, contrast, beweging). Alles
   optioneel, alles weer weg te halen -- en de grens die de route zelf bewaakt:
   een fase die niet bij de leeftijd past, wordt niet opgeslagen.

   WAAR HET STAAT. Het ledendossier gaat VERSLEUTELD de accountrij in
   (accounts/dossier.js: "Bleef dit platte tekst, dan zou wie de
   accountdatabase in handen krijgt het hele dossier kunnen lezen"). De proef
   meet beide kanten: de rij verandert op schijf, en de aanhef staat er niet
   leesbaar in.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const IK = '/api/ik';
const ZET = '/api/ik/zet';
const TOEGANKELIJK_ZET = '/api/ik/toegankelijk/zet';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'ik' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'ikk');
  const T = lid.token;
  const ander = await nieuwLid(w, 'ikb');
  const B = ander.token;
  const beeld = async (tok) => { const r = await w.post(IK, {}, tok || T); return r.status === 200 ? r.data : null; };
  const rijen = () => Object.fromEntries(w.opslag('rtg.db', 'SELECT id, member_state FROM users').map((r) => [r.id, r.member_state]));

  await stap('voltooibaar', 'een vers lid krijgt de standaard: Rahul als maatje, de fase uit zijn leeftijd, en de keuzes die bij hem passen', async () => {
    const b = await beeld();
    const fases = b ? b.faseKeuzes.map((f) => f.id) : [];
    return { klopt: !!b && b.omgang === 'maatje' && b.leeftijdBekend === true && b.fase === 'volwassen' && !fases.includes('kind') && b.keuzes.omgang.some((o) => o.id === 'plagerig'),
      ziet: b ? 'omgang ' + b.omgang + ', fase ' + b.fase + ', te kiezen: ' + fases.join('/') : '-' };
  });

  let voorRijen = null;
  await stap('voltooibaar', 'het lid kiest een zakelijke Rahul, een aanhef en een voornaamwoord; het beeld zegt het terug', async () => {
    const r = await w.post(ZET, { omgang: 'zakelijk', aanhef: 'Mr. ' + merk, voornaamwoord: 'hij/hem' }, T);
    const b = await beeld();
    return { klopt: r.status === 200 && b.omgang === 'zakelijk' && b.aanhef === 'Mr. ' + merk && b.voornaamwoord === 'hij/hem',
      ziet: 'omgang ' + b.omgang + ', aanhef "' + b.aanhef.split(' ')[0] + ' ...", ' + b.voornaamwoord };
  });

  await stap('bevoegd', 'B ziet en wijzigt uitsluitend zijn eigen profiel; het profiel van A blijft afgeschermd', async () => {
    const bVoor = await beeld(B);
    const zetB = await w.post(ZET, { omgang: 'rustig', aanhef: 'Dr. Ander ' + merk }, B);
    const bNa = await beeld(B);
    const aNa = await beeld(T);
    return { klopt: !!bVoor && bVoor.aanhef !== 'Mr. ' + merk && zetB.status === 200 && !!bNa && bNa.aanhef === 'Dr. Ander ' + merk &&
      !!aNa && aNa.aanhef === 'Mr. ' + merk && aNa.omgang === 'zakelijk',
      ziet: 'B zag A niet, B heeft "' + (bNa && bNa.aanhef) + '", A houdt "' + (aNa && aNa.aanhef) + '"' };
  });
  /* Vanaf hier verandert alleen A nog. Zo bewijst de opslagproef hieronder
     precies A's latere dossiermutaties, zonder B's bewuste isolatieproef mee
     te tellen als een onverwachte tweede accountrij. */
  voorRijen = rijen();

  await stap('voltooibaar', 'een volwassene kan zichzelf geen kind verklaren: die fase wordt niet opgeslagen, een volwassen fase wel', async () => {
    const a = await w.post(ZET, { fase: 'kind' }, T);
    const na1 = (await beeld()).fase;
    const b = await w.post(ZET, { fase: 'senior' }, T);
    const na2 = (await beeld()).fase;
    return { klopt: a.status === 200 && na1 === 'volwassen' && b.status === 200 && na2 === 'senior', ziet: '"kind" -> ' + na1 + ', "senior" -> ' + na2 };
  });

  await stap('voltooibaar', 'groot lettertype en stille beweging: het profiel dat elk scherm uitvoert, en een onbekende waarde valt terug', async () => {
    const r = await w.post(TOEGANKELIJK_ZET, { tekst: 'groot', beweging: 'stil', contrast: 'neon' }, T);
    const b = await beeld();
    const t = b.toegankelijk || {};
    return { klopt: r.status === 200 && r.data.staatAan === true && t.tekst === 'groot' && t.beweging === 'stil' && t.contrast === 'normaal',
      ziet: 'tekst ' + t.tekst + ', beweging ' + t.beweging + ', contrast "neon" -> ' + t.contrast };
  });

  await stap('voltooibaar', 'een nieuwe sessie (een ander toestel) krijgt hetzelfde profiel, zodat elk scherm het meteen uitvoert', async () => {
    const C = await inloggen(w, lid);
    const r = await w.post('/api/ik/toegankelijk', {}, C);
    const b = await beeld(C);
    return { klopt: r.status === 200 && r.data.toegankelijk.tekst === 'groot' && b.omgang === 'zakelijk', ziet: 'ander toestel: tekst ' + (r.data && r.data.toegankelijk.tekst) + ', omgang ' + b.omgang };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await beeld());
  await w.herstart();
  await stap('persistent', 'na een nette herstart is het beeld byte voor byte hetzelfde', async () => {
    const na = JSON.stringify(await beeld());
    return { klopt: na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie na de herstart leest hetzelfde', async () => {
    const na = JSON.stringify(await beeld(await inloggen(w, lid)));
    return { klopt: na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'het dossier staat op schijf in de accountrij, en de aanhef staat er NIET leesbaar in', async () => {
    const na = rijen();
    const veranderd = Object.keys(na).filter((id) => na[id] !== voorRijen[id]);
    const leesbaar = w.vindInOpslag(merk);
    return { klopt: veranderd.length === 1 && leesbaar.length === 0,
      ziet: veranderd.length + ' accountrij veranderd op schijf; aanhef ' + leesbaar.length + ' keer leesbaar' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op opslaan: dezelfde stand, geen fout', async () => {
    const [a, b] = await w.dubbel(ZET, { omgang: 'rustig' }, T);
    const n = await beeld();
    return { klopt: a.status === 200 && geen5xx(b) && n.omgang === 'rustig' && n.aanhef === 'Mr. ' + merk, ziet: 'antwoorden ' + a.status + '/' + b.status + ', omgang ' + n.omgang + ', aanhef bleef' };
  });
  await stap('herstelbaar', 'een afgebroken wijziging en opnieuw: de nieuwe stand, de rest onaangetast', async () => {
    const half = await w.afgebroken(ZET, { voornaamwoord: 'die/hen' }, T);
    const opnieuw = await w.post(ZET, { voornaamwoord: 'die/hen' }, T);
    const n = await beeld();
    return { klopt: opnieuw.status === 200 && n.voornaamwoord === 'die/hen' && n.omgang === 'rustig' && n.fase === 'senior',
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n.voornaamwoord + ', ' + n.omgang + ', ' + n.fase };
  });
  await stap('herstelbaar', 'een crash direct na een wijziging: de nieuwe toon staat er na de herstart', async () => {
    const r = await w.post(ZET, { omgang: 'plagerig' }, T);
    await w.crash();
    const n = await beeld();
    return { klopt: r.status === 200 && n.omgang === 'plagerig', ziet: 'zet ' + r.status + ', na SIGKILL ' + n.omgang };
  });
  await stap('herstelbaar', 'een crash direct na het terugzetten van de toegankelijkheid: normaal blijft normaal', async () => {
    const r = await w.post(TOEGANKELIJK_ZET, { tekst: 'normaal', beweging: 'normaal' }, T);
    await w.crash();
    const t = (await beeld()).toegankelijk || {};
    return { klopt: r.status === 200 && t.tekst === 'normaal' && t.beweging === 'normaal', ziet: 'na SIGKILL tekst ' + t.tekst + ', beweging ' + t.beweging };
  });

  /* De succesvolle profiellus bevatte geen weigering. Laat de bestaande
     profielroute daarom ook zonder sessie antwoorden; menselijkUit controleert
     dat de weigering leesbare woorden en geen stacktrace draagt. */
  await w.post(IK, {});
}

module.exports = {
  functie: 'link:ik',
  ingang: '/apps/ik.html',
  persona: 'lid',
  belofte: 'een lid zegt hoe hij genoemd wil worden, welke toon Rahul aanslaat en hoe elk scherm zich gedraagt -- binnen de grens van zijn leeftijd, en bewaard in zijn versleutelde dossier',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Of Rahul de gekozen toon ook werkelijk aanslaat, vraagt een model en is niet gemeten; ook niet of elk scherm het toegankelijkheidsprofiel uitvoert (dat is shared/basis.js en bewijs 2). Geloof, workspace en de veiligheidskring op dit scherm zijn niet gelopen. De minderjarigenkant van de fasegrens vraagt een minderjarig account en is hier niet beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
