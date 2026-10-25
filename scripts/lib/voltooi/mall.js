/* ============================================================================
   VOLTOOIPROEF: DE MALL (link:mall, /apps/mall.html).

   De belofte, in de woorden van kern/mall/lijsten.js en kern/mall/bewaard.js:
   een lid vindt aanbod, zet het in een eigen lijst (een reismand, een
   verlanglijst) en bewaart het met een hartje -- en "Bewaard" is een
   systeemlijst en geen tweede opslag, die zichzelf aanmaakt bij het eerste
   hartje en niet weg kan. Geen melding die je opzoekt, geen aftellende klok,
   geen voorspelling. Daarnaast de App-Bibliotheek: installeren is een keuze
   van het lid, de pas dekt de prijs (0), en nog eens installeren is geen
   tweede exemplaar.

   DE ONTVANGER is het lid zelf op een ander toestel: lijsten en de kast zijn
   van het lid en verlaten het account niet.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const ZOEK = '/api/mall/zoek';
const LIJSTEN = '/api/mall/lijsten';
const LIJST_NIEUW = '/api/mall/lijst/nieuw';
const LIJST = '/api/mall/lijst';
const LIJST_WEG = '/api/mall/lijst/weg';
const VOEGTOE = '/api/mall/lijst/voegtoe';
const REGEL_WEG = '/api/mall/lijst/regel-weg';
const BEWAAR = '/api/mall/bewaar';
const BEWAARD = '/api/mall/bewaard';
const APPS = '/api/mall/apps/catalogus';
const INSTALLEER = '/api/mall/apps/installeer';
const APPS_MIJN = '/api/mall/apps/mijn';
const APPS_WEG = '/api/mall/apps/weg';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'ml' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'mal');
  const T = lid.token;
  const lijsten = async (tok) => ((((await w.post(LIJSTEN, {}, tok || T)).data) || {}).lijsten || []);
  const toon = async (id, tok) => (((await w.post(LIJST, { id }, tok || T)).data) || {}).lijst || null;
  const kast = async (tok) => ((((await w.post(APPS_MIJN, {}, tok || T)).data) || {}).apps || []);
  let aanbod = [], lijst = null, app = null;

  await stap('voltooibaar', 'het lid zoekt in de Mall en krijgt aanbod met een id, een titel en een verkoper', async () => {
    const r = await w.post(ZOEK, { q: '' }, T);
    /* Zoals mall.html het leest: `items`, met `totaal` erbij. */
    aanbod = ((r.data && r.data.items) || []).filter((a) => a && a.id && a.titel);
    return { klopt: r.status === 200 && aanbod.length >= 2, ziet: aanbod.length + ' aanbod; bijv. "' + (aanbod[0] && aanbod[0].titel) + '"' };
  });

  await stap('voltooibaar', 'een lijst zonder naam wordt geweigerd; met naam ontstaat hij leeg', async () => {
    const leeg = await w.post(LIJST_NIEUW, { naam: '' }, T);
    const r = await w.post(LIJST_NIEUW, { naam: 'Weekend ' + merk }, T);
    lijst = r.data && r.data.lijst;
    return { klopt: leeg.status === 400 && /naam/.test(leeg.data.error) && r.status === 200 && !!lijst && lijst.regels.length === 0,
      ziet: 'leeg: ' + leeg.status + ' (' + (leeg.data && leeg.data.error) + '); lijst ' + (lijst && lijst.id) };
  });

  await stap('voltooibaar', 'twee dingen in de lijst; hetzelfde ding nog eens wordt geweigerd, en iets wat niet bestaat ook', async () => {
    const a = await w.post(VOEGTOE, { id: lijst.id, aanbodId: aanbod[0].id }, T);
    const b = await w.post(VOEGTOE, { id: lijst.id, aanbodId: aanbod[1].id }, T);
    const dubbel = await w.post(VOEGTOE, { id: lijst.id, aanbodId: aanbod[0].id }, T);
    const spook = await w.post(VOEGTOE, { id: lijst.id, aanbodId: 'bestaat-niet-' + merk }, T);
    const l = await toon(lijst.id);
    return { klopt: a.status === 200 && b.status === 200 && dubbel.status === 409 && spook.status === 404 && !!l && l.regels.length === 2,
      ziet: 'toevoegen ' + a.status + '/' + b.status + ', nog eens ' + dubbel.status + ' (' + (dubbel.data && dubbel.data.error) + '), spook ' + spook.status + '; ' + (l ? l.regels.length : 0) + ' regels' };
  });

  await stap('voltooibaar', 'het hartje: bewaren maakt de vaste lijst "Bewaard" aan, nog eens tikken haalt het eruit, en die lijst kan niet weg', async () => {
    const aan = await w.post(BEWAAR, { aanbodId: aanbod[1].id }, T);
    const b1 = (((await w.post(BEWAARD, {}, T)).data) || {}).lijst;
    const uit = await w.post(BEWAAR, { aanbodId: aanbod[1].id }, T);
    const b2 = (((await w.post(BEWAARD, {}, T)).data) || {}).lijst;
    const weg = b1 ? await w.post(LIJST_WEG, { id: b1.id }, T) : { status: 0 };
    await w.post(BEWAAR, { aanbodId: aanbod[1].id }, T);
    return { klopt: aan.status === 200 && aan.data.bewaard === true && b1 && b1.regels.length === 1 && uit.status === 200 && uit.data.bewaard === false && b2 && b2.regels.length === 0 && weg.status === 409,
      ziet: 'aan: ' + (aan.data && aan.data.bewaard) + ' (' + (b1 ? b1.regels.length : '?') + ' regel); uit: ' + (uit.data && uit.data.bewaard) + '; weghalen van Bewaard: ' + weg.status + ' (' + (weg.data && weg.data.error) + ')' };
  });

  await stap('voltooibaar', 'een app uit de bibliotheek installeren: hij staat in de kast, nog eens installeren geeft geen tweede', async () => {
    const c = await w.post(APPS, { per: 5 }, T);
    app = ((c.data && c.data.items) || [])[0];
    if (!app) return { klopt: false, ziet: 'geen app in de catalogus (' + c.status + ')' };
    const i = await w.post(INSTALLEER, { id: app.id }, T);
    const nogeens = await w.post(INSTALLEER, { id: app.id }, T);
    const k = await kast();
    return { klopt: i.status === 200 && nogeens.status === 200 && nogeens.data.alGeinstalleerd === true && k.filter((x) => x.id === app.id).length === 1,
      ziet: 'installeren ' + i.status + ', nog eens: al geinstalleerd ' + (nogeens.data && nogeens.data.alGeinstalleerd) + ', kast ' + k.length };
  });

  /* ---------------- persistent ---------------- */
  const voorL = JSON.stringify(await toon(lijst.id));
  const voorK = JSON.stringify((await kast()).map((x) => x.id));
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de lijst met zijn regels, Bewaard en de kast er nog, gelijk', async () => {
    const l = JSON.stringify(await toon(lijst.id)), k = JSON.stringify((await kast()).map((x) => x.id));
    const b = (((await w.post(BEWAARD, {}, T)).data) || {}).lijst;
    return { klopt: l === voorL && k === voorK && JSON.parse(l).regels.length === 2 && b && b.regels.length === 1,
      ziet: 'lijst ' + (l === voorL ? 'gelijk' : 'ANDERS') + ', kast ' + (k === voorK ? 'gelijk' : 'ANDERS') + ', Bewaard ' + (b ? b.regels.length : '?') + ' regel' };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest hetzelfde', async () => {
    const C = await inloggen(w, lid);
    const l = await toon(lijst.id, C), k = await kast(C), ls = await lijsten(C);
    return { klopt: !!l && l.regels.length === 2 && k.some((x) => x.id === app.id) && ls.some((x) => x.id === lijst.id),
      ziet: (l ? l.regels.length : 0) + ' regels, ' + k.length + ' app(s), ' + ls.length + ' lijsten' };
  });
  await stap('persistent', 'de lijst staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('Weekend ' + merk);
    return { klopt: plek.length >= 1, ziet: 'in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- bevoegd ---------------- */
  await stap('bevoegd', 'een ander lid ziet of wijzigt de lijst en appkast niet en kan wel een eigen lijst en appkast gebruiken', async () => {
    const ander = await nieuwLid(w, 'mal-ander');
    const B = ander.token;
    const voorB = await lijsten(B);
    const kastVoorB = await kast(B);
    const aanvalToevoegen = await w.post(VOEGTOE, { id: lijst.id, aanbodId: aanbod[0].id }, B);
    const aanvalWeg = await w.post(LIJST_WEG, { id: lijst.id }, B);
    const maakB = await w.post(LIJST_NIEUW, { naam: 'Eigen lijst ' + merk }, B);
    const lijstB = maakB.data && maakB.data.lijst;
    const voegB = await w.post(VOEGTOE, { id: lijstB && lijstB.id, aanbodId: aanbod[0].id }, B);
    const installeerB = await w.post(INSTALLEER, { id: app.id }, B);
    const naA = await lijsten();
    const naB = await lijsten(B);
    const kastNaA = await kast();
    const kastNaB = await kast(B);
    const aBehoudtLijst = naA.some((x) => x.id === lijst.id) && !!(await toon(lijst.id));
    const bZietA = voorB.concat(naB).some((x) => x.id === lijst.id);
    const bZietEigen = !!lijstB && !!(await toon(lijstB.id, B));
    const aZietB = naA.some((x) => x.id === (lijstB && lijstB.id));
    return {
      klopt: geen5xx(aanvalToevoegen) && geen5xx(aanvalWeg) && maakB.status === 200 && voegB.status === 200 &&
        installeerB.status === 200 && aBehoudtLijst && !bZietA && bZietEigen && !aZietB &&
        kastVoorB.length === 0 && kastNaB.some((x) => x.id === app.id) && kastNaA.some((x) => x.id === app.id),
      ziet: 'vreemd toevoegen/weghalen ' + aanvalToevoegen.status + '/' + aanvalWeg.status +
        '; A behoudt lijst=' + aBehoudtLijst + ', B ziet A=' + bZietA + ', B houdt eigen=' + bZietEigen +
        ', A ziet B=' + aZietB + '; kasten A/B=' + kastNaA.length + '/' + kastNaB.length
    };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "nieuwe lijst": een lijst, niet twee', async () => {
    const lijf = { naam: 'Dubbel ' + merk };
    const [a, b] = await w.dubbel(LIJST_NIEUW, lijf, T);
    const n = (await lijsten()).filter((x) => x.naam === lijf.naam).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' lijst(en)' };
  });
  await stap('herstelbaar', 'dubbeltik op "toevoegen": een regel, de tweede tik zegt dat het er al staat of herhaalt het antwoord', async () => {
    const [a, b] = await w.dubbel(VOEGTOE, { id: lijst.id, aanbodId: aanbod.length > 2 ? aanbod[2].id : aanbod[0].id }, T);
    const l = await toon(lijst.id);
    const verwacht = aanbod.length > 2 ? 3 : 2;
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && !!l && l.regels.length === verwacht,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + (l ? l.regels.length : 0) + ' regels' };
  });
  await stap('herstelbaar', 'een crash direct na het hartje: Bewaard staat er na de herstart', async () => {
    const r = await w.post(BEWAAR, { aanbodId: aanbod[0].id }, T);
    await w.crash();
    const b = (((await w.post(BEWAARD, {}, T)).data) || {}).lijst;
    return { klopt: r.status === 200 && r.data.bewaard === true && b && b.regels.some((x) => x.aanbodId === aanbod[0].id),
      ziet: 'hartje ' + r.status + ', na SIGKILL ' + (b ? b.regels.length : '?') + ' bewaard' };
  });
  await stap('herstelbaar', 'een crash direct na het weghalen van een regel, de lijst en de app: weg blijft weg -- ook op schijf', async () => {
    const r1 = await w.post(REGEL_WEG, { id: lijst.id, aanbodId: aanbod[0].id }, T);
    const r2 = await w.post(LIJST_WEG, { id: lijst.id }, T);
    const r3 = await w.post(APPS_WEG, { id: app.id }, T);
    await w.crash();
    const l = await w.post(LIJST, { id: lijst.id }, T);
    const k = await kast();
    const nogeens = await w.post(APPS_WEG, { id: app.id }, T);
    return { klopt: r1.status === 200 && r2.status === 200 && r3.status === 200 && l.status === 404 && !k.some((x) => x.id === app.id) && nogeens.status === 404 && w.vindInOpslag('Weekend ' + merk).length === 0,
      ziet: 'regel ' + r1.status + ', lijst ' + r2.status + ', app ' + r3.status + '; na SIGKILL lijst ' + l.status + ', kast ' + k.length + ', nog eens app weg ' + nogeens.status };
  });
}

module.exports = {
  functie: 'link:mall',
  ingang: '/apps/mall.html',
  persona: 'lid',
  belofte: 'een lid vindt aanbod in de Mall, zet het in een eigen lijst en bewaart het met een hartje in een vaste lijst die niet weg kan, en zet een app uit de bibliotheek in zijn kast -- zonder melding, klok of voorspelling',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Bestellen, boeken en betalen (de deuren van de verkopers, /api/mall/bestel, /api/booking) zijn hier niet gelopen; de prijswijzigingen op een bewaarde regel vragen een verkoper die zijn prijs verandert en zijn niet uitgelokt; de concierge is een modelvraag. Het aanbod is synthetisch uit de seed. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
