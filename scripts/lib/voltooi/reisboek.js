/* ============================================================================
   VOLTOOIPROEF: REISBOEK (link:reisboek, /apps/reisboek.html) -- de eerste
   KETEN over twee werelden: een vers RTG-lid, een menselijk besluit van het
   kantoor (WorkOS), en daarna de reis in TravelOS.

   De belofte, in de woorden van het scherm: "Uw reisboek" -- een Lifestyle-lid
   legt een reis vast met vluchten, verblijven, documenten en programma, en ziet
   op tijd welk document verloopt. De pas zelf is de poort: Reisboek is een app
   van de Lifestyle Pass (routes/member/rechterhand.js), en die pas ontstaat
   UITSLUITEND na een menselijk besluit (kern/aanmeldingen/besluit.js). Deze
   proef loopt die poort dus niet om maar door: een vers lid schrijft zich in,
   vraagt de pas aan, de gedeelde kantoorcode wordt geweigerd, een herleidbaar
   mens accepteert met een contractbedrag, en pas dan gaat het reisboek open.

   WAT DEZE KETEN MET OPZET NIET BEWEERT. Er wordt niets geboekt: een reis in
   het reisboek is wat het lid zelf vastlegt, geen reservering bij een
   vervoerder of hotel (CLAUDE.md: nooit claimen dat een boeking verwerkt is).
   De reiswacht en de oplosser (/api/reis/wacht, /api/reis/los) lezen mee op
   het scherm, maar hun belofte is een andere en wordt hier niet gelopen.
   ========================================================================== */
'use strict';
const { randomUUID } = require('node:crypto');
const { nieuwLid, inloggen, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');

const BOEK = '/api/member/rechterhand/reisboek';
const ZET = '/api/member/rechterhand/reis/zet';
const WEG = '/api/member/rechterhand/reis/weg';
const ITEM = '/api/member/rechterhand/reis/item';
const ITEM_WEG = '/api/member/rechterhand/reis/item/weg';
const AANVRAAG = '/api/aanmelding/aanvraag';
const BESLIS = '/api/aanmelding/beslis';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const reizen = async (w, T) => { const b = await w.post(BOEK, {}, T); return b.status === 200 && b.data ? b.data.reizen || [] : null; };
const metNaam = (lijst, naam) => (lijst || []).filter((r) => r.naam === naam);

async function loop(w, stap) {
  const merk = 'rb' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'rbk');
  const aanvraagLijf = { idem: randomUUID(), pas: 'lifestyle', naam: 'Reisboeklid ' + merk,
    contact: lid.email, viaUitnodiging: true };
  let T = lid.token, aanvraag = null, reis = null, K = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een vers RTG-lid staat voor een dichte deur: Reisboek hoort bij de Lifestyle Pass, en dat zegt het scherm', async () => {
    const b = await w.post(BOEK, {}, T);
    return { klopt: b.status === 403 && /Lifestyle Pass/.test((b.data && b.data.error) || ''),
      ziet: b.status + ' -- ' + (b.data && b.data.error) };
  });

  await stap('voltooibaar', 'het lid vraagt de Lifestyle Pass aan; de aanvraag landt in behandeling bij het kantoor', async () => {
    const a = await w.post(AANVRAAG, aanvraagLijf, T);
    const id = a.data && a.data.ontvangst && a.data.ontvangst.aanvraagId;
    K = await eigenaarSessie(w);
    const dossier = id ? await w.post('/api/aanmelding/een', { id }, K) : null;
    aanvraag = dossier && dossier.data && dossier.data.aanmelding;
    return { klopt: a.status === 200 && !!dossier && dossier.status === 200 && !!aanvraag && aanvraag.status === 'in behandeling',
      ziet: a.status + ', kantoor ' + (dossier && dossier.status) + ', ' + (aanvraag && aanvraag.status) };
  });

  await stap('voltooibaar', 'de gedeelde kantoorcode kan de pas niet toekennen: dat is geen herleidbaar mens', async () => {
    const o = await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE });
    const tok = o.data && o.data.token;
    const b = tok ? await w.post(BESLIS, { id: aanvraag.id, besluit: 'geaccepteerd', contractEuro: 20000 }, tok) : o;
    const nog = await w.post(BOEK, {}, T);
    return { klopt: !!tok && b.status === 403 && nog.status === 403,
      ziet: 'kantoorcode ' + o.status + ', besluit ' + b.status + ' (' + (b.data && b.data.error || '').slice(0, 60) + '...), reisboek nog ' + nog.status };
  });

  await stap('voltooibaar', 'een herleidbaar mens van het kantoor accepteert met een contractbedrag; het lid ziet de pas na opnieuw inloggen', async () => {
    const b = await w.post(BESLIS, { id: aanvraag.id, besluit: 'geaccepteerd', contractEuro: 20000 }, K);
    T = await inloggen(w, lid);
    const r = await w.post(BOEK, {}, T);
    return { klopt: b.status === 200 && b.data.aanmelding.status === 'geaccepteerd' && r.status === 200 && Array.isArray(r.data.reizen) && r.data.reizen.length === 0,
      ziet: 'besluit ' + b.status + ' (' + (b.data && b.data.aanmelding && b.data.aanmelding.status) + '), reisboek ' + r.status + ' met ' + (r.data && (r.data.reizen || []).length) + ' reizen' };
  });

  await stap('voltooibaar', 'het lid legt een reis vast; het reisboek toont hem als komend', async () => {
    const z = await w.post(ZET, { naam: 'Kyoto ' + merk, bestemming: 'Kyoto', van: dag(30), tot: dag(40) }, T);
    reis = z.data && z.data.reis;
    const l = metNaam(await reizen(w, T), 'Kyoto ' + merk);
    return { klopt: z.status === 200 && !!reis && l.length === 1 && l[0].komend === true && l[0].van === dag(30),
      ziet: 'zet ' + z.status + ', ' + l.length + ' reis in het boek, komend=' + (l[0] && l[0].komend) };
  });

  await stap('voltooibaar', 'een vlucht, een verblijf en een programmapunt staan in de reis, het programma op datum', async () => {
    const a = await w.post(ITEM, { reisId: reis.id, lijst: 'legs', van: 'Amsterdam', naar: 'Osaka', vervoer: 'vlucht', datum: dag(30), tijd: '10:40' }, T);
    const b = await w.post(ITEM, { reisId: reis.id, lijst: 'verblijven', naam: 'Ryokan ' + merk, plaats: 'Kyoto', in: dag(30), uit: dag(40) }, T);
    const c = await w.post(ITEM, { reisId: reis.id, lijst: 'programma', datum: dag(33), tekst: 'Theeceremonie' }, T);
    const d = await w.post(ITEM, { reisId: reis.id, lijst: 'programma', datum: dag(31), tekst: 'Tempelwandeling' }, T);
    const r = metNaam(await reizen(w, T), 'Kyoto ' + merk)[0] || {};
    const prog = (r.programma || []).map((p) => p.tekst);
    return { klopt: [a, b, c, d].every((x) => x.status === 200) && (r.legs || []).length === 1 && (r.verblijven || []).length === 1 && prog.join(',') === 'Tempelwandeling,Theeceremonie',
      ziet: (r.legs || []).length + ' vlucht, ' + (r.verblijven || []).length + ' verblijf, programma: ' + prog.join(' > ') };
  });

  await stap('voltooibaar', 'een paspoort dat binnen negentig dagen verloopt, verschijnt als attentie', async () => {
    const p = await w.post(ITEM, { reisId: reis.id, lijst: 'documenten', soort: 'Paspoort', houder: 'Reisboeklid', geldigTot: dag(45) }, T);
    const b = await w.post(BOEK, {}, T);
    const at = (b.data && b.data.attenties || []).filter((x) => x.reis === 'Kyoto ' + merk);
    return { klopt: p.status === 200 && at.length === 1 && at[0].soort === 'Paspoort' && at[0].verlopen === false,
      ziet: at.length + ' attentie: ' + (at[0] ? at[0].soort + ' geldig tot ' + at[0].geldigTot : '-') };
  });

  await stap('voltooibaar', 'een programmapunt weghalen haalt precies dat punt weg', async () => {
    const r0 = metNaam(await reizen(w, T), 'Kyoto ' + merk)[0];
    const thee = (r0.programma || []).find((p) => p.tekst === 'Theeceremonie');
    const x = await w.post(ITEM_WEG, { reisId: reis.id, lijst: 'programma', itemId: thee && thee.id }, T);
    const r = metNaam(await reizen(w, T), 'Kyoto ' + merk)[0] || {};
    return { klopt: x.status === 200 && (r.programma || []).map((p) => p.tekst).join(',') === 'Tempelwandeling',
      ziet: 'over: ' + (r.programma || []).map((p) => p.tekst).join(', ') };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(metNaam(await reizen(w, T), 'Kyoto ' + merk));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de reis er nog, byte voor byte', async () => {
    const na = JSON.stringify(metNaam(await reizen(w, T), 'Kyoto ' + merk));
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet dezelfde reis, met de pas nog op het account', async () => {
    const C = await inloggen(w, lid);
    const na = JSON.stringify(metNaam(await reizen(w, C), 'Kyoto ' + merk));
    return { klopt: na === voor, ziet: na === voor ? 'nieuwe sessie leest hetzelfde' : 'ANDERS: ' + na.slice(0, 80) };
  });
  await stap('persistent', 'de reis en het verblijf staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const reisPlek = w.vindInOpslag('Kyoto ' + merk);
    const verblijf = w.vindInOpslag('Ryokan ' + merk);
    return { klopt: reisPlek.length >= 1 && verblijf.length >= 1,
      ziet: 'reis in ' + reisPlek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; verblijf in ' + verblijf.length + ' plek(ken)' };
  });
  await stap('persistent', 'het besluit van het kantoor staat in de opslag: de pas is geen sessie-eigenschap', async () => {
    const plek = w.vindInOpslag(aanvraag.id);
    const nogOpen = await w.post(BOEK, {}, T);
    return { klopt: plek.length >= 1 && nogOpen.status === 200, ziet: 'aanmelding ' + aanvraag.id + ' in ' + plek.length + ' plek(ken), reisboek ' + nogOpen.status };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "nieuwe reis": een reis, niet twee', async () => {
    const [a, b] = await w.dubbel(ZET, { naam: 'Lissabon ' + merk, bestemming: 'Lissabon', van: dag(60), tot: dag(64) }, T);
    const n = metNaam(await reizen(w, T), 'Lissabon ' + merk).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' reis(en) in het boek' };
  });

  await stap('herstelbaar', 'dubbeltik op "toevoegen": een verblijf, niet twee', async () => {
    const [a, b] = await w.dubbel(ITEM, { reisId: reis.id, lijst: 'verblijven', naam: 'Machiya ' + merk, plaats: 'Kyoto' }, T);
    const r = metNaam(await reizen(w, T), 'Kyoto ' + merk)[0] || {};
    const n = (r.verblijven || []).filter((v) => v.naam === 'Machiya ' + merk).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' verblijf' };
  });

  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: precies een reis', async () => {
    const lijf = { naam: 'Porto ' + merk, bestemming: 'Porto', van: dag(70), tot: dag(72) };
    const half = await w.afgebroken(ZET, lijf, T);
    const opnieuw = await w.post(ZET, lijf, T);
    const n = metNaam(await reizen(w, T), 'Porto ' + merk).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' reis' };
  });

  await stap('herstelbaar', 'een crash direct na het vastleggen: de reis staat er na de herstart', async () => {
    const z = await w.post(ZET, { naam: 'Sevilla ' + merk, bestemming: 'Sevilla', van: dag(80), tot: dag(83) }, T);
    await w.crash();
    const l = metNaam(await reizen(w, T), 'Sevilla ' + merk);
    return { klopt: z.status === 200 && l.length === 1, ziet: 'zet ' + z.status + ', na SIGKILL ' + l.length + ' reis' };
  });

  await stap('herstelbaar', 'een crash direct na het verwijderen: wat weg heette, blijft weg', async () => {
    const l0 = metNaam(await reizen(w, T), 'Sevilla ' + merk)[0];
    const x = await w.post(WEG, { id: l0 && l0.id }, T);
    await w.crash();
    const l = metNaam(await reizen(w, T), 'Sevilla ' + merk);
    return { klopt: x.status === 200 && l.length === 0 && w.vindInOpslag('Sevilla ' + merk).filter((p) => p.sleutel !== 'audit').length === 0,
      ziet: 'weg ' + x.status + ', na SIGKILL ' + l.length + ' reis, opslag: ' + JSON.stringify(w.vindInOpslag('Sevilla ' + merk)) };
  });
}

module.exports = {
  functie: 'link:reisboek',
  ingang: '/apps/reisboek.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid -- na het menselijke besluit van het kantoor -- legt een reis vast met vluchten, verblijven, documenten en programma, ziet op tijd welk document verloopt, en raakt niets kwijt bij een herstart, een dubbeltik of een crash',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er wordt niets geboekt: een reis in het reisboek is wat het lid vastlegt, geen reservering bij een vervoerder of hotel. De reiswacht en de oplosser (/api/reis/wacht, /api/reis/los) worden niet gelopen. Het besluit van het kantoor neemt het eigenaarsaccount van de testomgeving; de gedeelde kantoorcode wordt geweigerd en dat is een schakel. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
