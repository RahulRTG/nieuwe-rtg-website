/* ============================================================================
   VOLTOOIPROEF: RTG VEILIG (link:veilig, /apps/veilig.html).

   De belofte, in de woorden van kern/veiligheid/: als het misgaat, krijgen de
   mensen die het lid ZELF koos bericht -- en alleen wat hij per persoon toestond
   (de plek of niet). Een kringlid moet een bestaande connectie zijn; een proef-
   alarm met een lege kring faalt, "want een proefalarm bestaat om te bewijzen
   dat de keten werkt". En eerlijk: RTG is geen alarmcentrale.

   TWEE ACTOREN, EN DE ONTVANGER IS HET PUNT. Lid A zet lid B (verbonden via de
   Salon) bij CODENAAM in zijn kring -- zoals het scherm het vraagt; de eerste
   versie van deze proef stuurde de interne sleutel en zag daardoor niet dat het
   scherm nooit werkte (18 oktober 2026) -- en een e-mailadres. A slaat alarm; B ziet het bij zich,
   met de plek; de mail ligt in de postvanger. A zet de plek voor B uit; het
   volgende alarm komt zonder plek. A sluit af; B ziet dat het voorbij is.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const BEELD = '/api/veiligheid';
const KRING = '/api/veiligheid/kring';
const TOEVOEGEN = '/api/veiligheid/kring/toevoegen';
const AANPASSEN = '/api/veiligheid/kring/aanpassen';
const VERWIJDEREN = '/api/veiligheid/kring/verwijderen';
const MAIL = '/api/veiligheid/kring/mail';
const PLEK = '/api/veiligheid/plek';
const ALARM = '/api/veiligheid/alarm';
const AFSLUITEN = '/api/veiligheid/alarm/afsluiten';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const ADRES = 'noodcontact@voorbeeld.nl';

async function loop(w, stap) {
  const A = await nieuwLid(w, 'vla');
  const B = await nieuwLid(w, 'vlb');
  const voorB = async (tok) => (((await w.post(BEELD, {}, tok || B.token)).data || {}).voorMij || []);
  const kring = async (tok) => (((await w.post(KRING, {}, tok || A.token)).data || {}).kring || {});
  let handleB = null, codenaamB = null, eerste = null;

  await stap('voltooibaar', 'met een lege kring wordt zelfs een proefalarm geweigerd, met de reden', async () => {
    const r = await w.post(ALARM, { proef: true }, A.token);
    return { klopt: r.status === 400 && /kring is leeg/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* Het scherm vraagt "Codenaam of sleutel" en stuurt wat het lid intypt als
     `handle` (public/shared/veiligheid.js). De proef typt dus de CODENAAM. */
  await stap('bevoegd', 'iemand met wie A niet verbonden is, kan niet in de kring -- ook niet bij codenaam', async () => {
    const cb = (await w.post('/api/member/connections', {}, B.token)).data;
    handleB = cb.me; codenaamB = cb.codename;
    const r = await w.post(TOEVOEGEN, { handle: codenaamB }, A.token);
    return { klopt: r.status === 403 && /nog niet verbonden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error || '').slice(0, 60) + '...)' };
  });

  await stap('voltooibaar', 'na een verbinding in de Salon zet A B in zijn kring door de codenaam in te typen, met een e-mailadres erbij', async () => {
    await verbind(w, A, B);
    const a = await w.post(TOEVOEGEN, { handle: codenaamB, locatie: true }, A.token);
    const m = await w.post(MAIL, { adres: ADRES }, A.token);
    const k = await kring();
    return { klopt: a.status === 200 && m.status === 200 && k.contacten.length === 1 && k.contacten[0].locatie === true && k.mails.includes(ADRES) && k.compleet,
      ziet: k.contacten.map((c) => c.codenaam + ' (plek ' + (c.locatie ? 'aan' : 'uit') + ')').join(', ') + ' + ' + k.mails.length + ' adres' };
  });

  await stap('voltooibaar', 'buiten een alarm wordt de plek NIET bewaard', async () => {
    const r = await w.post(PLEK, { lat: 52.37, lon: 4.89 }, A.token);
    return { klopt: r.status === 200 && r.data.bewaard === false, ziet: 'plek gemeld, bewaard=' + (r.data && r.data.bewaard) };
  });

  await stap('voltooibaar', 'A slaat alarm: B ziet het bij zich met de plek, en de mail aan het noodadres ligt klaar', async () => {
    const r = await w.post(ALARM, { notitie: 'Voltooiproef' }, A.token);
    eerste = r.data && r.data.id;
    await w.post(PLEK, { lat: 52.3702, lon: 4.8952 }, A.token);
    const b = (await voorB()).find((x) => x.id === eerste);
    const post = w.berichten().filter((x) => /RTG alarm/.test(x.onderwerp || ''));
    return { klopt: r.status === 200 && r.data.naar === 1 && r.data.mails === 1 && !!b && b.soort === 'knop' && !!b.plek && b.afgesloten === false && post.length === 1,
      ziet: 'alarm naar ' + (r.data && r.data.naar) + ' lid + ' + (r.data && r.data.mails) + ' adres; B ziet ' + (b ? b.soort + (b.plek ? ' met plek' : ' ZONDER plek') : 'NIETS') + '; ' + post.length + ' mail in de postvanger' };
  });

  await stap('voltooibaar', 'A zet de plek voor B uit: B ziet het lopende alarm nog, maar niet meer waar A is', async () => {
    const r = await w.post(AANPASSEN, { handle: handleB, locatie: false }, A.token);
    const b = (await voorB()).find((x) => x.id === eerste);
    return { klopt: r.status === 200 && !!b && b.plek === null, ziet: 'aanpassen ' + r.status + ', B ziet plek: ' + (b && b.plek ? 'JA' : 'nee') };
  });

  await stap('voltooibaar', 'A sluit het alarm af: B ziet dat het voorbij is', async () => {
    const r = await w.post(AFSLUITEN, { id: eerste, hoe: 'loos alarm' }, A.token);
    const b = (await voorB()).find((x) => x.id === eerste);
    return { klopt: r.status === 200 && !!b && b.afgesloten === true && b.plek === null, ziet: 'afsluiten ' + r.status + ', B ziet afgesloten=' + (b && b.afgesloten) };
  });

  /* ---------------- persistent ---------------- */
  const kringVoor = JSON.stringify(await kring());
  const voorBTekst = JSON.stringify(await voorB());
  await w.herstart();
  await stap('persistent', 'na een nette herstart is de kring van A dezelfde, met de plek-keuze per persoon', async () => {
    const na = JSON.stringify(await kring());
    return { klopt: na === kringVoor && JSON.parse(na).contacten[0].locatie === false, ziet: na === kringVoor ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'B ziet na de herstart, in een nieuwe sessie, hetzelfde afgesloten alarm', async () => {
    const na = JSON.stringify(await voorB(await inloggen(w, B)));
    return { klopt: na === voorBTekst && na.includes(eerste), ziet: na === voorBTekst ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'het alarm staat in de opslag zelf', async () => {
    const plek = w.vindInOpslag(eerste);
    return { klopt: plek.length >= 1, ziet: 'alarm ' + eerste + ' in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op toevoegen: B staat er een keer in, de tweede is een nette weigering', async () => {
    await w.post(VERWIJDEREN, { handle: handleB }, A.token);
    const [a, b] = await w.dubbel(TOEVOEGEN, { handle: codenaamB }, A.token);
    const k = await kring();
    return { klopt: [a, b].some((x) => x.status === 200) && geen5xx(a) && geen5xx(b) && k.contacten.filter((c) => c.handle === handleB).length === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', B ' + k.contacten.filter((c) => c.handle === handleB).length + 'x in de kring' };
  });
  await stap('herstelbaar', 'dubbeltik op de alarmknop: de kring krijgt een alarm, niet twee', async () => {
    const voor = (await voorB()).length;
    const [a, b] = await w.dubbel(ALARM, { notitie: 'dubbel' }, A.token);
    const na = await voorB();
    const nieuw = na.length - voor;
    for (const x of na.filter((y) => !y.afgesloten)) await w.post(AFSLUITEN, { id: x.id, hoe: 'proef' }, A.token);
    return { klopt: a.status === 200 && geen5xx(b) && nieuw === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', B kreeg ' + nieuw + ' alarm(en)' };
  });
  await stap('herstelbaar', 'een crash direct na een alarm: B ziet het na de herstart', async () => {
    const r = await w.post(ALARM, { proef: true }, A.token);
    await w.crash();
    const b = (await voorB(await inloggen(w, B))).find((x) => x.id === (r.data && r.data.id));
    return { klopt: r.status === 200 && !!b && b.proef === true, ziet: 'alarm ' + r.status + ', na SIGKILL ziet B ' + (b ? 'het proefalarm' : 'NIETS') };
  });
  await stap('herstelbaar', 'een crash direct na het verwijderen uit de kring: B krijgt geen alarm meer', async () => {
    const x = await w.post(VERWIJDEREN, { handle: handleB }, A.token);
    await w.crash();
    await w.post(MAIL, { adres: ADRES, weg: true }, A.token);
    const r = await w.post(ALARM, { proef: true }, A.token);
    return { klopt: x.status === 200 && r.status === 400 && (await kring()).contacten.length === 0, ziet: 'verwijderen ' + x.status + ', na SIGKILL: alarm ' + r.status + ' (' + (r.data && r.data.error) + ')' };
  });
}

module.exports = {
  functie: 'link:veilig',
  ingang: '/apps/veilig.html',
  persona: 'lid',
  belofte: 'als het misgaat krijgen de mensen die het lid zelf koos bericht, met alleen wat hij per persoon toestond, en een lege kring wordt eerlijk geweigerd',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Of een pushmelding op het toestel van B aankomt is niet gemeten (B leest het in zijn eigen beeld); de mail ligt in de postvanger en is niet bezorgd. De thuiswacht, het codewoord en de rustoptie op dit scherm zijn niet gelopen. RTG is geen alarmcentrale en de proef beweert dat ook niet. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
