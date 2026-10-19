/* ============================================================================
   VOLTOOIPROEF: HET KLIMAATFONDS (link:klimaat, /apps/foundation/klimaatfonds.html).

   De belofte van het scherm: wie in de buurt woont, ziet welke
   duurzaamheidsprojecten er lopen en kan erheen geven (via Geven, met het
   project al gekozen); in het Living Lab van zijn stad stelt hij een vraag over
   duurzaamheid, steunt hij een vraag van een ander, en ziet hij welk onderzoek
   er loopt.

   DE WERELD. De stad en een actief duurzaamheidsproject ontstaan langs het
   kantoor (../voltooigezin.js), het Living Lab en een onderzoek erin maakt de
   eigenaar langs /api/lab2/lab/maak en /studie/maak. De ouder van het gezin
   leest de projecten met zijn eigen account; een buur steunt zijn vraag.

   EEN ACCOUNT VOOR DE BUURTDEUREN (besluit 19 oktober 2026, Toegang 0af00824).
   De Living Lab-routes voor bewoners (/api/lab2/bewoner/*) vragen een account
   of een gezinsprofiel onder een ouderaccount, en een stem hangt aan het
   ACCOUNT en niet aan de alias: hetzelfde account met een andere alias telt
   niet nog eens. De ouder en elke buur hebben daarom een eigen GRATIS account
   (scripts/lib/gratisaccount.js).
   ========================================================================== */
'use strict';
const { inloggen } = require('../voltooiwereld');
const { GEZINSWERELD, accountGezin, openStad, actiefProject } = require('../voltooigezin');
const { registreerGratis } = require('../gratisaccount');

const PROJECTEN = '/api/rtfos/gift/projecten';
const LABS = '/api/lab2/bewoner/labs';
const THEMAS = '/api/lab2/bewoner/themas';
const THEMA = '/api/lab2/bewoner/thema';
const STEM = '/api/lab2/bewoner/stem';
const OVERZICHT = '/api/lab2/bewoner/overzicht';
const SOORT = 'duurzaam';

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const stad = await openStad(w, 'Zwolle');
  const zon = await actiefProject(w, stad, 'Zonnedaken De Wilg ' + merk, SOORT);
  const taal = await actiefProject(w, stad, 'Taalcafe ' + merk, 'taal');
  const K = stad.kantoor;
  const lab = ((await w.post('/api/lab2/lab/maak', { stad: 'Zwolle', naam: 'Living Lab Zwolle' }, K)).data || {}).lab;
  if (!lab) throw new Error('het Living Lab maken lukte niet');
  const studie = await w.post('/api/lab2/studie/maak', { labId: lab.id, titel: 'Warmtepomp in rijtjeshuizen ' + merk,
    vraagstuk: 'Hoeveel gas bespaart een hybride warmtepomp in een rijtjeshuis uit de jaren zeventig?', soort: SOORT }, K);
  if (studie.status !== 200) throw new Error('het onderzoek maken lukte niet (' + studie.status + ')');
  const ouder = await accountGezin(w, 'klimaat', { kind: true });
  const VRAAG = 'Kunnen we samen zonnepanelen op het dak van de school zetten? ' + merk;
  const buur = async () => { const g = await registreerGratis(w.basis); if (!g) throw new Error('een gratis account registreren lukte niet'); return g.token; };
  const [buur1, buur2, buur3] = [await buur(), await buur(), await buur()];
  const themas = async () => (((await w.post(THEMAS, { labId: lab.id }, ouder.token)).data || {}).themas || []).filter((t) => t.soort === SOORT);
  const mijnVraag = async () => (await themas()).find((t) => t.vraag === VRAAG) || null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de ouder ziet het lopende duurzaamheidsproject, en Geven kent hetzelfde project om naartoe te geven', async () => {
    const p = (((await w.post(PROJECTEN, { soort: SOORT }, ouder.token)).data) || {}).projecten || [];
    const alles = (((await w.post(PROJECTEN, {}, ouder.token)).data) || {}).projecten || [];
    return { klopt: p.length === 1 && p[0].id === zon.id && p[0].stad === 'Zwolle' && alles.some((x) => x.id === taal.id),
      ziet: p.length + ' duurzaamheidsproject (' + (p[0] && p[0].naam) + '), ' + alles.length + ' in de hele lijst' };
  });

  await stap('voltooibaar', 'het Living Lab van Zwolle staat open, met het lopende onderzoek over duurzaamheid', async () => {
    const l = (((await w.post(LABS, {}, ouder.token)).data) || {}).labs || [];
    const o = (await w.post(OVERZICHT, { labId: lab.id }, ouder.token)).data || {};
    const st = (o.studies || []).filter((s) => s.soort === SOORT);
    return { klopt: l.some((x) => x.id === lab.id) && st.length === 1 && st[0].stap === 'vraagstuk',
      ziet: l.length + ' lab(s), ' + st.length + ' onderzoek in stap ' + (st[0] && st[0].stap) };
  });

  await stap('voltooibaar', 'de ouder stelt een vraag over duurzaamheid, en die staat in het lab zonder stemmen', async () => {
    const r = await w.post(THEMA, { labId: lab.id, vraag: VRAAG, soort: SOORT, door: 'bewoner', idem: 'vraag-' + merk + '-1' }, ouder.token);
    const t = await mijnVraag();
    return { klopt: r.status === 200 && !!t && Number(t.stemmen) === 0, ziet: 'vraag ' + r.status + ', staat erin met ' + (t && t.stemmen) + ' stemmen' };
  });

  await stap('voltooibaar', 'een buur steunt de vraag met zijn gratis account; nog een keer steunen telt niet', async () => {
    const t = await mijnVraag();
    const a = await w.post(STEM, { id: t && t.id, alias: 'Buur De Wilg' }, buur1);
    const b = await w.post(STEM, { id: t && t.id, alias: 'Buur De Wilg' }, buur1);
    const na = await mijnVraag();
    return { klopt: a.status === 200 && b.status === 409 && Number(na && na.stemmen) === 1,
      ziet: 'steunen ' + a.status + ', nog eens ' + b.status + ', ' + (na && na.stemmen) + ' stem' };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: zonder account geen projectenlijst om aan te geven (401)', async () => {
    const r = await w.post(PROJECTEN, { soort: SOORT });
    return { klopt: r.status === 401, ziet: 'projecten zonder account: ' + r.status };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder account geen vraag stellen en niet stemmen (401)', async () => {
    const v = await w.post(THEMA, { labId: lab.id, vraag: 'Anonieme vraag over windmolens in de wijk ' + merk, soort: SOORT });
    const t = await mijnVraag();
    const s = await w.post(STEM, { id: t && t.id, alias: 'Iemand anders ' + merk });
    return { klopt: v.status === 401 && s.status === 401,
      ziet: 'vraag zonder account ' + v.status + ', stem zonder account ' + s.status };
  });

  await stap('voltooibaar', 'bevoegdheid: dezelfde buur onder een andere alias stemt niet nog eens (de stem hangt aan het account)', async () => {
    const t = await mijnVraag();
    const s = await w.post(STEM, { id: t && t.id, alias: 'Heel iemand anders ' + merk }, buur1);
    const na = await mijnVraag();
    return { klopt: s.status === 409 && Number(na && na.stemmen) === 1, ziet: 'andere alias ' + s.status + ', ' + (na && na.stemmen) + ' stem' };
  });

  await stap('voltooibaar', 'bevoegdheid: het kind van het gezin opent de projectenlijst niet met zijn gezinssessie', async () => {
    const r = await w.post(PROJECTEN, { soort: SOORT }, ouder.kind.token);
    const c = await w.post(PROJECTEN, { soort: SOORT, code: ouder.kind.code, token: ouder.kind.token });
    return { klopt: r.status === 401 && c.status === 401, ziet: 'kindertoken ' + r.status + ', code+token ' + c.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de vraag er nog met zijn stem, en het onderzoek ook', async () => {
    const t = await mijnVraag();
    const o = (await w.post(OVERZICHT, { labId: lab.id }, ouder.token)).data || {};
    return { klopt: !!t && Number(t.stemmen) >= 1 && (o.studies || []).some((s) => s.soort === SOORT),
      ziet: 'vraag met ' + (t && t.stemmen) + ' stem(men), ' + (o.studies || []).length + ' onderzoek' };
  });

  await stap('persistent', 'een read-only lezer vindt de vraag in de opslag van het Living Lab', async () => {
    const v = w.vindInOpslag(VRAAG);
    return { klopt: v.length > 0, ziet: 'gevonden in ' + [...new Set(v.map((p) => p.bestand + (p.sleutel ? ':' + p.sleutel : '')))].join(', ') };
  });

  await stap('persistent', 'na de herstart logt de ouder opnieuw in en ziet in een nieuwe sessie hetzelfde project', async () => {
    const tok = await inloggen(w, ouder);
    const p = (((await w.post(PROJECTEN, { soort: SOORT }, tok)).data) || {}).projecten || [];
    return { klopt: p.length === 1 && p[0].id === zon.id, ziet: 'nieuwe sessie: ' + p.length + ' project' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Stuur zet een vraag een keer in het lab', async () => {
    const V = 'Hoe vangen we regenwater op bij de flats aan de rand van de wijk? ' + merk;
    const [a, b] = await w.dubbel(THEMA, { labId: lab.id, vraag: V, soort: SOORT, door: 'bewoner', idem: 'vraag-' + merk + '-dubbel' }, ouder.token);
    const n = (await themas()).filter((t) => t.vraag === V).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' vraag' };
  });

  await stap('herstelbaar', 'een dubbele tik op Steun telt een stem', async () => {
    const t = await mijnVraag();
    const voor = Number(t && t.stemmen);
    const [a, b] = await w.dubbel(STEM, { id: t && t.id, alias: 'Tweede buur' }, buur2);
    const na = Number((await mijnVraag() || {}).stemmen);
    return { klopt: [a.status, b.status].sort().join() === '200,409' && na - voor === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', +' + (na - voor) + ' stem' };
  });

  await stap('herstelbaar', 'een afgebroken vraag en daarna opnieuw: de vraag staat er een keer', async () => {
    const V = 'Kan het buurthuis een deelauto voor de straat beheren? ' + merk;
    const lijf = { labId: lab.id, vraag: V, soort: SOORT, door: 'bewoner', idem: 'vraag-' + merk + '-half' };
    const half = await w.afgebroken(THEMA, lijf, ouder.token);
    const opnieuw = await w.post(THEMA, lijf, ouder.token);
    const n = (await themas()).filter((t) => t.vraag === V).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' vraag' };
  });

  await stap('herstelbaar', 'een crash direct na een stem verliest hem niet', async () => {
    const t = await mijnVraag();
    const voor = Number(t && t.stemmen);
    const s = await w.post(STEM, { id: t && t.id, alias: 'Derde buur' }, buur3);
    await w.crash();
    const na = Number((await mijnVraag() || {}).stemmen);
    return { klopt: s.status === 200 && na - voor === 1, ziet: 'stem ' + s.status + ', na SIGKILL +' + (na - voor) };
  });
}

module.exports = {
  functie: 'link:klimaat',
  ingang: '/apps/foundation/klimaatfonds.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'wie in de buurt woont ziet welke duurzaamheidsprojecten er lopen en kan erheen geven, stelt in het Living Lab van zijn stad een vraag over duurzaamheid, steunt die van een ander en ziet welk onderzoek er loopt',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Geven zelf loopt in ./geven.js; hier alleen dat het project in beide lijsten hetzelfde is. Het Living Lab en het onderzoek maakt de eigenaar langs het kantoor. De bewonersroutes vragen een (gratis) account of een gezinsprofiel, en een stem telt per account. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
