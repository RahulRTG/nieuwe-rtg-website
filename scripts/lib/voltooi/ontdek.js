/* ============================================================================
   VOLTOOIPROEF: HET OVERZICHT (link:ontdek, /apps/rtg.html).

   De belofte van het scherm: het huis van LivingOS, in de stand VANDAAG. Het
   lid ziet zijn reisdossier (apps/rtg-dossier.js), wat er op hem wacht en zijn
   dag uit de agenda (apps/rtg-vandaag.js), en maakt het huis het zijne met een
   eigen foto in plaats van het RTG-beeld (shared/interface/personal-images.js
   en personal-image-editor.js, "Foto wijzigen"). Het scherm zelf schrijft
   alleen dat laatste; de afspraak komt uit de agenda, langs de route van dat
   scherm, en het Overzicht moet hem daarna op de juiste dag tonen.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const DOSSIER = '/api/member/huis/dossier';
const LIJN = '/api/sociaal/lijn';
const WERELD = '/api/sociaal/wereld';
const AGENDA = '/api/agenda/mijn-lijst';
const BEELDEN = '/api/ik/beelden';
const ZET = '/api/ik/beelden/zet';
const UPLOAD = '/api/bestanden/upload';
const HAAL = '/api/bestanden/haal';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SLOT = 'living/hoofd';
const uitsnede = (x) => ({ desktop: { x, y: 40, zoom: 1.2 }, mobile: { x: 50, y: 50, zoom: 1 } });
const dagLokaal = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };

async function loop(w, stap) {
  const merk = 'od' + Date.now().toString(36);
  const A = await nieuwLid(w, 'oda');
  const B = await nieuwLid(w, 'odb');
  let foto = null;

  const beelden = async (tok) => { const r = await w.post(BEELDEN, {}, tok); return r.status === 200 ? r.data.images || {} : null; };
  const zet = (tok, x, file) => w.post(ZET, { slot: SLOT, image: Object.assign({ file: file || foto }, uitsnede(x)) }, tok);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een vers lid opent het Overzicht: dossier, wat er wacht, de kring en de agenda antwoorden elk in woorden', async () => {
    const d = await w.post(DOSSIER, {}, A.token);
    const l = await w.post(LIJN, {}, A.token);
    const k = await w.post(WERELD, {}, A.token);
    const a = await w.post(AGENDA, {}, A.token);
    return { klopt: d.status === 200 && d.data.ok === true && !d.data.reis && typeof d.data.tekst === 'string' && d.data.tekst.length > 8 &&
      l.status === 200 && k.status === 200 && a.status === 200 && Array.isArray(a.data.items) && a.data.items.length === 0,
      ziet: 'dossier ' + d.status + ' ("' + String(d.data && d.data.tekst).slice(0, 60) + '"), lijn ' + l.status + ', kring ' + k.status + ', agenda ' + a.status };
  });

  await stap('voltooibaar', 'een afspraak van vandaag staat daarna in de dag van het Overzicht, op de lokale datum', async () => {
    const t = await w.post('/api/agenda/toevoegen', { titel: 'Ontbijt ' + merk, datum: dagLokaal(), tijd: '08:30' }, A.token);
    const a = await w.post(AGENDA, {}, A.token);
    const vandaag = ((a.data && a.data.items) || []).filter((i) => String(i.datum).slice(0, 10) === dagLokaal() && i.titel === 'Ontbijt ' + merk);
    return { klopt: t.status === 200 && vandaag.length === 1 && vandaag[0].tijd === '08:30',
      ziet: 'toevoegen ' + t.status + ', ' + vandaag.length + ' afspraak op ' + dagLokaal() };
  });

  await stap('voltooibaar', 'het lid zet een eigen foto als hoofdbeeld; het huis geeft die foto en die uitsnede terug', async () => {
    const u = await w.post(UPLOAD, { naam: 'Huis ' + merk + '.png', dataUrl: PIXEL }, A.token);
    foto = u.data && u.data.id;
    const z = await zet(A.token, 30);
    const b = await beelden(A.token);
    const h = await w.post(HAAL, { id: foto }, A.token);
    return { klopt: u.status === 200 && !!foto && z.status === 200 && b && b[SLOT] && b[SLOT].file === foto && b[SLOT].desktop.x === 30 &&
      h.status === 200 && h.data.dataUrl === PIXEL,
      ziet: 'upload ' + u.status + ', zet ' + z.status + ', beeld ' + JSON.stringify(b && b[SLOT]) + ', bytes ' + h.status };
  });

  await stap('voltooibaar', '"Herstel RTG-beeld" haalt de eigen keuze weg; daarna kiest het lid hem opnieuw', async () => {
    const weg = await w.post(ZET, { slot: SLOT, image: null }, A.token);
    const leeg = await beelden(A.token);
    const terug = await zet(A.token, 30);
    const b = await beelden(A.token);
    return { klopt: weg.status === 200 && leeg && !leeg[SLOT] && terug.status === 200 && b[SLOT] && b[SLOT].file === foto,
      ziet: 'herstel ' + weg.status + ' (' + JSON.stringify(leeg) + '), opnieuw ' + terug.status + ', daarna ' + JSON.stringify(b && b[SLOT] && b[SLOT].file) };
  });

  await stap('voltooibaar', 'bevoegd: zonder inlog geven het dossier, de beelden, het zetten en de agenda 401', async () => {
    const r = await Promise.all([w.post(DOSSIER, {}), w.post(BEELDEN, {}), w.post(ZET, { slot: SLOT, image: null }), w.post(AGENDA, {})]);
    return { klopt: r.every((x) => x.status === 401), ziet: r.map((x) => x.status).join('/') };
  });

  await stap('voltooibaar', 'bevoegd: een ander lid kan A\'s foto niet als zijn beeld zetten of ophalen, en ziet A\'s keuze en afspraak niet', async () => {
    const z = await zet(B.token, 10, foto);
    const h = await w.post(HAAL, { id: foto }, B.token);
    const b = await beelden(B.token);
    const a = await w.post(AGENDA, {}, B.token);
    const aNog = await beelden(A.token);
    return { klopt: z.status === 404 && h.status >= 400 && h.status < 500 && b && !b[SLOT] &&
      !((a.data && a.data.items) || []).some((i) => i.titel === 'Ontbijt ' + merk) && aNog[SLOT].desktop.x === 30,
      ziet: 'B zet ' + z.status + ' (' + (z.data && z.data.error) + '), B haalt ' + h.status + ', B-beelden ' + JSON.stringify(b) };
  });

  /* Een rol zonder recht speelt hier niet: sinds het besluit van 19 oktober
     heeft iedereen een account, en een gratis account mag zijn eigen Overzicht
     en zijn eigen foto (server.js geenGast). De derde stap is daarom de
     schrijfkant van "een ander lid": een nieuwe versie over A's bestand. */
  await stap('voltooibaar', 'bevoegd: een ander lid kan geen nieuwe versie over A\'s foto zetten; A houdt zijn eigen bytes', async () => {
    const v = await w.post(UPLOAD, { id: foto, dataUrl: PIXEL.replace('AAAADUlEQVR42mNk', 'AAAADUlEQVR42mNz') }, B.token);
    const h = await w.post(HAAL, { id: foto }, A.token);
    return { klopt: v.status >= 400 && v.status < 500 && h.status === 200 && h.data.dataUrl === PIXEL,
      ziet: 'B versie ' + v.status + ' (' + (v.data && v.data.error) + '), A haalt ' + h.status + (h.data && h.data.dataUrl === PIXEL ? ', ongewijzigd' : ', ANDERS') };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het eigen hoofdbeeld er nog, met dezelfde uitsnede en dezelfde bytes', async () => {
    const b = await beelden(A.token);
    const h = await w.post(HAAL, { id: foto }, A.token);
    return { klopt: b && b[SLOT] && b[SLOT].file === foto && b[SLOT].desktop.x === 30 && h.status === 200 && h.data.dataUrl === PIXEL,
      ziet: JSON.stringify(b && b[SLOT]) + ', bytes ' + h.status };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet hetzelfde beeld en dezelfde afspraak van vandaag', async () => {
    const T = await inloggen(w, A);
    const b = await beelden(T);
    const a = await w.post(AGENDA, {}, T);
    return { klopt: b && b[SLOT] && b[SLOT].file === foto && ((a.data && a.data.items) || []).some((i) => i.titel === 'Ontbijt ' + merk),
      ziet: 'nieuwe sessie: beeld ' + (b && b[SLOT] ? 'ja' : 'nee') + ', ' + ((a.data && a.data.items) || []).length + ' afspraak' };
  });
  await stap('persistent', 'de foto en de afspraak staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const f = w.vindInOpslag('Huis ' + merk);
    const a = w.vindInOpslag('Ontbijt ' + merk);
    return { klopt: f.length >= 1 && a.length >= 1,
      ziet: 'foto in ' + f.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; afspraak in ' + a.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Opslaan" (tegelijk) geeft een keuze voor de plek, met die uitsnede', async () => {
    const lijf = { slot: SLOT, image: Object.assign({ file: foto }, uitsnede(60)) };
    const [a, b] = await w.dubbel(ZET, lijf, A.token);
    const beeld = await beelden(A.token);
    return { klopt: a.status === 200 && b.status === 200 && Object.keys(beeld).length === 1 && beeld[SLOT].desktop.x === 60,
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + Object.keys(beeld).length + ' plek(ken), x=' + (beeld[SLOT] && beeld[SLOT].desktop.x) };
  });
  await stap('herstelbaar', 'een afgebroken "Opslaan", daarna opnieuw: de uitsnede van de herhaling staat er', async () => {
    const lijf = { slot: SLOT, image: Object.assign({ file: foto }, uitsnede(70)) };
    const half = await w.afgebroken(ZET, lijf, A.token);
    const opnieuw = await w.post(ZET, lijf, A.token);
    const beeld = await beelden(A.token);
    return { klopt: opnieuw.status === 200 && beeld[SLOT].desktop.x === 70,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', x=' + beeld[SLOT].desktop.x };
  });
  await stap('herstelbaar', 'een crash direct na het opslaan: de nieuwe uitsnede staat er na de herstart', async () => {
    const z = await zet(A.token, 80);
    await w.crash();
    const beeld = await beelden(A.token);
    return { klopt: z.status === 200 && beeld && beeld[SLOT] && beeld[SLOT].desktop.x === 80, ziet: 'zet ' + z.status + ', na SIGKILL x=' + (beeld && beeld[SLOT] && beeld[SLOT].desktop.x) };
  });
  await stap('herstelbaar', 'een crash direct na "Herstel RTG-beeld": de plek blijft hersteld', async () => {
    const x = await w.post(ZET, { slot: SLOT, image: null }, A.token);
    await w.crash();
    const beeld = await beelden(A.token);
    return { klopt: x.status === 200 && beeld && !beeld[SLOT], ziet: 'herstel ' + x.status + ', na SIGKILL ' + JSON.stringify(beeld) };
  });
}

module.exports = {
  functie: 'link:ontdek',
  ingang: '/apps/rtg.html',
  persona: 'lid',
  belofte: 'een lid ziet in zijn Overzicht zijn dossier, wat er wacht en de afspraken van zijn eigen dag, en maakt het huis het zijne met een eigen foto die alleen hij ziet -- zonder inlog of als ander lid kom je er niet aan, en een herstart, dubbele tik, afgebroken verzoek of crash laat de keuze niet half achter',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De afspraak wordt via de agendaroute gezet, niet via dit scherm; of het kompas hem op de lokale dag toont, toetst test/rtg-vandaag-lokaal.test.js in het script zelf. Het reisdossier blijft leeg (geen reis in een verse wereld) en wat er wacht komt uit lege bronnen. De foto is een pixel; de chunked upload en de uitsnede in de browser lopen niet mee. Geen Redis of PostgreSQL in de wereld.',
  loop
};
