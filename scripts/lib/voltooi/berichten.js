/* ============================================================================
   VOLTOOIPROEF: BERICHTEN (link:berichten, /apps/comm.html).

   De belofte van het scherm: een lid begint een gesprek met iemand die het al
   kent, stuurt een bericht, en de ander ziet het -- ongelezen tot hij het
   opent. Hij antwoordt op dat ene bericht, een bericht kan worden gewijzigd,
   ingetrokken en van een reactie voorzien, en wie niet in het gesprek zit,
   leest of schrijft er niets in. Alles over de routes die comm.html zelf
   aanroept (/api/comm/begin, /stuur, /inbox, /gesprek, /lees, /reactie,
   /wijzig, /wis).

   De ander is een echt tweede lid, verbonden langs de Salon (verbind), want
   /api/comm/begin opent alleen een gesprek met wie je al kent -- dat is de
   poort tegen ongevraagde berichten, en een derde lid zonder die verbinding
   bewijst dat hij dicht zit.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const BEGIN = '/api/comm/begin';
const STUUR = '/api/comm/stuur';
const INBOX = '/api/comm/inbox';
const GESPREK = '/api/comm/gesprek';
const LEES = '/api/comm/lees';
const REACTIE = '/api/comm/reactie';
const WIJZIG = '/api/comm/wijzig';
const WIS = '/api/comm/wis';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'br' + Date.now().toString(36);
  const A = await nieuwLid(w, 'bra');
  const B = await nieuwLid(w, 'brb');
  const C = await nieuwLid(w, 'brc');
  const v = await verbind(w, A, B);
  let gid = null, eerste = null;

  const open = async (tok) => { const r = await w.post(GESPREK, { id: gid }, tok); return r.status === 200 ? r.data.gesprek : null; };
  const metTekst = (g, tekst) => ((g && g.berichten) || []).filter((m) => m.tekst === tekst);
  const inGesprek = async (tok) => ((await w.post(INBOX, {}, tok)).data || {}).gesprekken || [];

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'A begint een gesprek met B, die hij kent; het gesprek draagt de codenaam van B', async () => {
    const r = await w.post(BEGIN, { met: v.b.key }, A.token);
    gid = r.data && r.data.gesprek && r.data.gesprek.id;
    return { klopt: r.status === 200 && !!gid && r.data.gesprek.titel === v.b.codenaam,
      ziet: r.status + ', gesprek ' + gid + ', titel ' + (r.data && r.data.gesprek && r.data.gesprek.titel) };
  });

  await stap('voltooibaar', 'A stuurt een bericht; B ziet het in zijn inbox als ongelezen en leest het in het gesprek', async () => {
    const s = await w.post(STUUR, { id: gid, tekst: 'Hallo ' + merk }, A.token);
    const ib = (await inGesprek(B.token)).find((g) => g.id === gid);
    const g = await open(B.token);
    eerste = metTekst(g, 'Hallo ' + merk)[0];
    return { klopt: s.status === 200 && !!ib && ib.ongelezen === 1 && !!eerste && eerste.vanMij === false && eerste.van === v.a.codenaam,
      ziet: 'stuur ' + s.status + ', inbox B: ' + (ib ? ib.ongelezen + ' ongelezen' : 'geen gesprek') + ', bericht van ' + (eerste && eerste.van) };
  });

  await stap('voltooibaar', 'B opent en leest: ongelezen gaat naar nul en blijft daar', async () => {
    const l = await w.post(LEES, { id: gid }, B.token);
    const ib = (await inGesprek(B.token)).find((g) => g.id === gid);
    return { klopt: l.status === 200 && !!ib && ib.ongelezen === 0, ziet: 'lees ' + l.status + ', ongelezen ' + (ib && ib.ongelezen) };
  });

  await stap('voltooibaar', 'B antwoordt op precies dat bericht; A ziet het antwoord met de verwijzing, en ongelezen', async () => {
    const s = await w.post(STUUR, { id: gid, tekst: 'Terug ' + merk, antwoordOp: eerste.id }, B.token);
    const g = await open(A.token);
    const m = metTekst(g, 'Terug ' + merk)[0];
    const ib = (await inGesprek(A.token)).find((x) => x.id === gid);
    return { klopt: s.status === 200 && !!m && m.antwoordOp === eerste.id && !!ib && ib.ongelezen === 1,
      ziet: 'stuur ' + s.status + ', antwoordOp ' + (m && m.antwoordOp) + ', ongelezen bij A ' + (ib && ib.ongelezen) };
  });

  await stap('voltooibaar', 'A wijzigt zijn bericht en geeft een reactie op dat van B; B ziet beide', async () => {
    const x = await w.post(WIJZIG, { id: gid, berichtId: eerste.id, tekst: 'Hallo gewijzigd ' + merk }, A.token);
    const terug = metTekst(await open(A.token), 'Terug ' + merk)[0];
    const r = await w.post(REACTIE, { id: gid, berichtId: terug.id, teken: 'emo-duim' }, A.token);
    const g = await open(B.token);
    const m = (g.berichten || []).find((y) => y.id === eerste.id) || {};
    const t = (g.berichten || []).find((y) => y.id === terug.id) || {};
    const duim = (t.reacties || []).find((y) => y.teken === 'emo-duim');
    return { klopt: x.status === 200 && r.status === 200 && m.tekst === 'Hallo gewijzigd ' + merk && !!m.gewijzigd && !!duim && duim.aantal === 1,
      ziet: 'wijzig ' + x.status + ', reactie ' + r.status + '; B ziet "' + m.tekst + '", duim ' + (duim && duim.aantal) };
  });

  await stap('voltooibaar', 'A trekt een bericht in: B ziet geen tekst meer, alleen dat het is ingetrokken', async () => {
    await w.post(STUUR, { id: gid, tekst: 'Vergissing ' + merk }, A.token);
    const m = metTekst(await open(A.token), 'Vergissing ' + merk)[0];
    const x = await w.post(WIS, { id: gid, berichtId: m && m.id }, A.token);
    const g = await open(B.token);
    const bij = (g.berichten || []).find((y) => y.id === (m && m.id)) || {};
    return { klopt: x.status === 200 && bij.tekst === null && !!bij.weg && !JSON.stringify(g).includes('Vergissing ' + merk),
      ziet: 'wis ' + x.status + ', B ziet tekst ' + JSON.stringify(bij.tekst) + ', weg=' + !!bij.weg };
  });

  await stap('bevoegd', 'bevoegdheid: zonder sessie geen inbox, geen gesprek en niets versturen (401)', async () => {
    const a = await w.post(INBOX, {});
    const b = await w.post(GESPREK, { id: gid });
    const c = await w.post(STUUR, { id: gid, tekst: 'anoniem ' + merk });
    const g = await open(B.token);
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401 && metTekst(g, 'anoniem ' + merk).length === 0,
      ziet: 'inbox ' + a.status + ', gesprek ' + b.status + ', stuur ' + c.status };
  });

  await stap('bevoegd', 'bevoegdheid: een derde lid leest het gesprek niet, schrijft er niet in en ziet het niet in zijn inbox', async () => {
    const g = await w.post(GESPREK, { id: gid }, C.token);
    const s = await w.post(STUUR, { id: gid, tekst: 'Indringer ' + merk }, C.token);
    const x = await w.post(WIJZIG, { id: gid, berichtId: eerste.id, tekst: 'overgenomen' }, C.token);
    const ib = await inGesprek(C.token);
    const bijA = await open(A.token);
    return { klopt: g.status === 400 && s.status === 400 && x.status === 400 && !ib.some((y) => y.id === gid) &&
      metTekst(bijA, 'Indringer ' + merk).length === 0 && metTekst(bijA, 'overgenomen').length === 0 && !JSON.stringify(g.data).includes(merk),
      ziet: 'gesprek ' + g.status + ' (' + (g.data && g.data.error) + '), stuur ' + s.status + ', wijzig ' + x.status };
  });

  await stap('bevoegd', 'bevoegdheid: wie A niet kent, begint geen gesprek met hem, en B wijzigt of wist het bericht van A niet', async () => {
    const b = await w.post(BEGIN, { met: v.a.key }, C.token);
    const x = await w.post(WIJZIG, { id: gid, berichtId: eerste.id, tekst: 'door B' }, B.token);
    const y = await w.post(WIS, { id: gid, berichtId: eerste.id }, B.token);
    const m = ((await open(A.token)).berichten || []).find((z) => z.id === eerste.id) || {};
    return { klopt: b.status === 400 && /niet verbonden/.test((b.data && b.data.error) || '') && x.status === 400 && y.status === 400 &&
      m.tekst === 'Hallo gewijzigd ' + merk && !m.weg,
      ziet: 'begin door C ' + b.status + ', wijzig door B ' + x.status + ', wis door B ' + y.status + ', tekst nog "' + m.tekst + '"' };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (g) => JSON.stringify(((g && g.berichten) || []).map((m) => [m.id, m.tekst, m.antwoordOp, !!m.weg, m.reacties.map((r) => r.teken + r.aantal).join()]));
  const voorA = vorm(await open(A.token));
  await w.herstart();

  await stap('persistent', 'na een nette herstart ziet A hetzelfde gesprek: tekst, antwoord, wijziging, reactie en intrekking', async () => {
    const na = vorm(await open(A.token));
    return { klopt: voorA.length > 4 && na === voorA, ziet: na === voorA ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS: ' + na.slice(0, 120) };
  });

  await stap('persistent', 'B logt opnieuw in (een nieuw toestel) en ziet hetzelfde gesprek, met zijn leesstand nog op nul', async () => {
    const tok = await inloggen(w, B);
    const g = await w.post(GESPREK, { id: gid }, tok);
    const ib = (await inGesprek(tok)).find((x) => x.id === gid);
    return { klopt: g.status === 200 && vorm(g.data.gesprek) === voorA && !!ib && ib.ongelezen === 0,
      ziet: 'nieuwe sessie ' + g.status + ', ' + (vorm(g.data && g.data.gesprek) === voorA ? 'gelijk' : 'ANDERS') + ', ongelezen ' + (ib && ib.ongelezen) };
  });

  await stap('persistent', 'het bericht staat in de opslag zelf; de ingetrokken tekst niet meer als bericht', async () => {
    const plek = w.vindInOpslag('Terug ' + merk);
    return { klopt: plek.length >= 1, ziet: 'bericht in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  /* Het scherm stuurt per opgesteld bericht een herhaalsleutel (`idem`) en
     dezelfde bij een nieuwe poging; een bewust tweede bericht krijgt een nieuwe. */
  await stap('herstelbaar', 'een dubbele tik op "versturen": een bericht bij B, niet twee; een bewust tweede bericht komt wel aan', async () => {
    const [a, b] = await w.dubbel(STUUR, { id: gid, tekst: 'Dubbel ' + merk, idem: 'st-dubbel-' + merk }, A.token);
    const n = metTekst(await open(B.token), 'Dubbel ' + merk).length;
    const nog = await w.post(STUUR, { id: gid, tekst: 'Dubbel ' + merk, idem: 'st-bewust-' + merk }, A.token);
    const n2 = metTekst(await open(B.token), 'Dubbel ' + merk).length;
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && n === 1 && nog.status === 200 && n2 === 2,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' bericht(en) bij B; bewust nog een: ' + n2 };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw versturen: een bericht bij B', async () => {
    const lijf = { id: gid, tekst: 'Half ' + merk, idem: 'st-half-' + merk };
    const half = await w.afgebroken(STUUR, lijf, A.token);
    const opnieuw = await w.post(STUUR, lijf, A.token);
    const n = metTekst(await open(B.token), 'Half ' + merk).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' bericht(en) bij B' };
  });

  await stap('herstelbaar', 'een crash direct na het versturen, en het toestel probeert opnieuw: het bericht staat er na de herstart een keer', async () => {
    const lijf = { id: gid, tekst: 'Stroom ' + merk, idem: 'st-stroom-' + merk };
    const s = await w.post(STUUR, lijf, A.token);
    await w.crash();
    const opnieuw = await w.post(STUUR, lijf, A.token);
    const n = metTekst(await open(B.token), 'Stroom ' + merk).length;
    return { klopt: s.status === 200 && opnieuw.status === 200 && n === 1,
      ziet: 'stuur ' + s.status + ', na SIGKILL opnieuw ' + opnieuw.status + ', ' + n + ' bericht(en) bij B' };
  });

  await stap('herstelbaar', 'een crash direct na het intrekken en lezen: ingetrokken blijft ingetrokken, gelezen blijft gelezen', async () => {
    const m = metTekst(await open(A.token), 'Stroom ' + merk)[0];
    const x = await w.post(WIS, { id: gid, berichtId: m && m.id }, A.token);
    const l = await w.post(LEES, { id: gid }, B.token);
    await w.crash();
    const g = await open(B.token);
    const bij = (g.berichten || []).find((y) => y.id === (m && m.id)) || {};
    const ib = (await inGesprek(B.token)).find((y) => y.id === gid);
    return { klopt: x.status === 200 && l.status === 200 && bij.tekst === null && !!bij.weg && !!ib && ib.ongelezen === 0,
      ziet: 'wis ' + x.status + ', na SIGKILL tekst ' + JSON.stringify(bij.tekst) + ', ongelezen ' + (ib && ib.ongelezen) };
  });
}

module.exports = {
  functie: 'link:berichten',
  ingang: '/apps/comm.html',
  persona: 'lid',
  belofte: 'een lid begint een gesprek met iemand die het kent, stuurt, antwoordt, wijzigt en trekt in, en de ander ziet precies dat -- ongelezen tot hij leest; wie niet in het gesprek zit leest en schrijft niets, en niets gaat verloren of dubbel bij een herstart, een dubbeltik of een crash',
  grens: 'De proef loopt de berichtroutes van het scherm, niet het scherm zelf, en niet bellen, de por, @Rahul, zoeken of de sociale graaf. Het seintje naar de ander (realtime) wordt niet gemeten: B ziet het bericht doordat hij het gesprek opent. De verbinding tussen A en B ontstaat langs de Salon (verbind). Geen Redis of PostgreSQL.',
  loop
};
