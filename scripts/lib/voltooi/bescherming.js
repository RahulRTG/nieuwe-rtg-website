/* ============================================================================
   VOLTOOIPROEF: BESCHERMING (link:bescherming, /apps/mijn-isolatie.html).

   De belofte, in de woorden van kern/isolatie/zetten.js (SEC-LOCK-001):
   verstrengen kent geen ceremonie -- software mag beveiliging automatisch
   verhogen -- en er is geen weg naar beneden dan een voltooide
   ontsluitceremonie. Een lid zet zijn eigen lagen (identiteit, sessie)
   strenger; dezelfde stand nog eens zetten laat geen spoor na; verlagen via
   dezelfde weg wordt geweigerd; en de ceremonie vraagt een concrete reden en
   de stappen die het stappenregister voor die laag eist. Zonder passkey is
   het een noodontsluiting, en dat staat erbij in plaats van dat de eis stil
   wegvalt.

   DE ONTVANGER is het lid zelf op een ander toestel: de stand op zijn
   identiteit geldt over al zijn inlogs heen, de stand op een sessie alleen
   voor die inlog.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const MIJN = '/api/isolatie/mijn';
const ZET = '/api/isolatie/mijn/zet';
const ONTSLUITING = '/api/isolatie/mijn/ontsluiting';
const STAP = '/api/isolatie/mijn/ontsluiting/stap';
const STAP_OPTIES = '/api/isolatie/mijn/ontsluiting/stap/opties';
const COMMIT = '/api/isolatie/mijn/ontsluiting/commit';
const AFBREKEN = '/api/isolatie/mijn/ontsluiting/afbreken';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'bs' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'bsc');
  const T = lid.token;
  const mijn = async (tok) => ((await w.post(MIJN, {}, tok || T)).data) || {};
  let verzoek = null;

  await stap('voltooibaar', 'een vers lid staat op alle eigen lagen op normaal, en het scherm zegt eerlijk waar de stand wordt afgedwongen', async () => {
    const m = await mijn();
    return { klopt: !!m.mijn && m.mijn.identiteit === 'normaal' && m.mijn.sessie === 'normaal' && m.effectief !== undefined && m.afgedwongen && typeof m.afgedwongen.http === 'boolean',
      ziet: 'identiteit ' + (m.mijn && m.mijn.identiteit) + ', sessie ' + (m.mijn && m.mijn.sessie) + ', effectief ' + m.effectief + ', http afgedwongen: ' + (m.afgedwongen && m.afgedwongen.http) };
  });

  await stap('voltooibaar', 'verstrengen zonder ceremonie: identiteit naar beschermd; een onbekende stand en een vreemde laag worden geweigerd', async () => {
    const r = await w.post(ZET, { drager: 'identiteit', naar: 'beschermd', reden: 'telefoon kwijt ' + merk }, T);
    const onbekend = await w.post(ZET, { drager: 'identiteit', naar: 'superveilig' }, T);
    const vreemd = await w.post(ZET, { drager: 'huis', naar: 'beschermd' }, T);
    const m = await mijn();
    return { klopt: r.status === 200 && r.data.uit.richting === 'verstrengd' && onbekend.status === 400 && (vreemd.status === 400 || vreemd.status === 403) && m.mijn.identiteit === 'beschermd',
      ziet: 'zetten ' + r.status + ' (' + (r.data && r.data.uit && r.data.uit.richting) + '), onbekend ' + onbekend.status + ', huis ' + vreemd.status + '; identiteit nu ' + m.mijn.identiteit };
  });

  await stap('voltooibaar', 'dezelfde stand nog eens zetten laat geen spoor na, en verlagen via dezelfde weg wordt geweigerd met de verwijzing naar de ceremonie', async () => {
    const nogeens = await w.post(ZET, { drager: 'identiteit', naar: 'beschermd' }, T);
    const omlaag = await w.post(ZET, { drager: 'identiteit', naar: 'normaal' }, T);
    return { klopt: nogeens.status === 200 && nogeens.data.uit.richting === 'ongewijzigd' && omlaag.status === 409 && /ceremonie/.test(omlaag.data.error),
      ziet: 'nog eens: ' + (nogeens.data && nogeens.data.uit && nogeens.data.uit.richting) + '; omlaag: ' + omlaag.status + ' (' + (omlaag.data && omlaag.data.error || '').slice(0, 70) + ')' };
  });

  await stap('voltooibaar', 'de ceremonie op de sessie: zonder reden geweigerd; met reden een open verzoek met de stappen die deze laag eist, zonder passkey als noodontsluiting', async () => {
    const z = await w.post(ZET, { drager: 'sessie', naar: 'beschermd', reden: 'proef ' + merk }, T);
    const zonder = await w.post(ONTSLUITING, { drager: 'sessie', naar: 'normaal', reden: 'kort' }, T);
    const r = await w.post(ONTSLUITING, { drager: 'sessie', naar: 'normaal', reden: 'de telefoon is terecht ' + merk }, T);
    verzoek = r.data && r.data.verzoek;
    const m = await mijn();
    return { klopt: z.status === 200 && zonder.status === 400 && r.status === 200 && !!verzoek && verzoek.status === 'open' && Array.isArray(verzoek.vereisten) && !verzoek.vereisten.includes('passkey') && (m.open || []).some((v) => v.id === verzoek.id),
      ziet: 'zonder reden ' + zonder.status + '; verzoek ' + (verzoek && verzoek.id) + ' met stappen ' + (verzoek && verzoek.vereisten.join(',')) + ', open volgens het scherm: ' + (m.open || []).length };
  });

  await stap('voltooibaar', 'een stap die de ceremonie niet vraagt wordt geweigerd; te vroeg afronden ook, met wat er ontbreekt', async () => {
    const vreemd = await w.post(STAP, { id: verzoek.id, soort: 'tweedePaarOgen' }, T);
    const teVroeg = await w.post(COMMIT, { id: verzoek.id }, T);
    const ontbreekt = verzoek.vereisten.filter((s) => s !== 'reden');
    return { klopt: vreemd.status === 400 && (ontbreekt.length === 0 || (teVroeg.status === 409 && /ontbreekt/.test(teVroeg.data.error))),
      ziet: 'vreemde stap ' + vreemd.status + ', te vroeg ' + teVroeg.status + ' (' + (teVroeg.data && teVroeg.data.error || 'rond').slice(0, 80) + ')' };
  });

  await stap('voltooibaar', 'de resterende stappen aftekenen en afronden: de sessie staat weer op normaal, en het verzoek is niet meer open', async () => {
    const uit = [];
    for (const soort of verzoek.vereisten.filter((s) => s !== 'reden' && s !== 'wachttijd')) {
      uit.push(soort + ':' + (await w.post(STAP, { id: verzoek.id, soort }, T)).status);
    }
    const c = await w.post(COMMIT, { id: verzoek.id }, T);
    const m = await mijn();
    const nogeens = await w.post(COMMIT, { id: verzoek.id }, T);
    return { klopt: c.status === 200 && m.mijn.sessie === 'normaal' && !(m.open || []).some((v) => v.id === verzoek.id) && nogeens.status === 409,
      ziet: 'stappen ' + uit.join(' ') + '; afronden ' + c.status + ', sessie nu ' + m.mijn.sessie + ', nog eens afronden ' + nogeens.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de identiteit nog op beschermd en de sessie op normaal', async () => {
    const m = await mijn();
    return { klopt: m.mijn.identiteit === 'beschermd' && m.mijn.sessie === 'normaal', ziet: 'identiteit ' + m.mijn.identiteit + ', sessie ' + m.mijn.sessie };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) draagt dezelfde beschermde identiteit en een eigen, normale sessielaag', async () => {
    const C = await inloggen(w, lid);
    const m = await mijn(C);
    return { klopt: m.mijn.identiteit === 'beschermd' && m.mijn.sessie === 'normaal', ziet: 'identiteit ' + m.mijn.identiteit + ', sessie ' + m.mijn.sessie };
  });
  await stap('persistent', 'de stand en de reden staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('telefoon kwijt ' + merk);
    return { klopt: plek.length >= 1, ziet: 'in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "verstrengen" van de sessie: een keer verstrengd, en de tweede tik zet niets opnieuw', async () => {
    const [a, b] = await w.dubbel(ZET, { drager: 'sessie', naar: 'beschermd', reden: 'dubbel ' + merk }, T);
    const m = await mijn();
    const richtingen = [a, b].map((r) => r.data && r.data.uit && r.data.uit.richting);
    return { klopt: a.status === 200 && geen5xx(b) && m.mijn.sessie === 'beschermd' && richtingen.filter((x) => x === 'verstrengd').length <= 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ' (' + richtingen.join(',') + '), sessie ' + m.mijn.sessie };
  });
  await stap('herstelbaar', 'een crash direct na het verstrengen: de stand staat er na de herstart', async () => {
    const C = await inloggen(w, lid);
    const r = await w.post(ZET, { drager: 'sessie', naar: 'beschermd', reden: 'crash ' + merk }, C);
    await w.crash();
    const m = await mijn(C);
    return { klopt: r.status === 200 && m.mijn.sessie === 'beschermd', ziet: 'zetten ' + r.status + ', na SIGKILL sessie ' + m.mijn.sessie };
  });
  await stap('herstelbaar', 'een crash direct na het afbreken van een ontsluiting: het verzoek blijft afgebroken en de stand blijft streng', async () => {
    const r = await w.post(ONTSLUITING, { drager: 'sessie', naar: 'normaal', reden: 'toch maar niet ' + merk }, T);
    const id = r.data && r.data.verzoek && r.data.verzoek.id;
    const af = await w.post(AFBREKEN, { id, reden: 'vergissing' }, T);
    await w.crash();
    const m = await mijn();
    const commit = await w.post(COMMIT, { id }, T);
    return { klopt: r.status === 200 && af.status === 200 && m.mijn.sessie === 'beschermd' && !(m.open || []).some((v) => v.id === id) && commit.status === 409,
      ziet: 'afbreken ' + af.status + ', na SIGKILL sessie ' + m.mijn.sessie + ', open ' + (m.open || []).length + ', afronden van het afgebroken verzoek ' + commit.status };
  });
  await stap('herstelbaar', 'een crash direct na het afronden van een ceremonie: de sessie blijft op normaal', async () => {
    const r = await w.post(ONTSLUITING, { drager: 'sessie', naar: 'normaal', reden: 'alles is weer in orde ' + merk }, T);
    const v = r.data && r.data.verzoek;
    for (const soort of (v ? v.vereisten : []).filter((s) => s !== 'reden' && s !== 'wachttijd')) await w.post(STAP, { id: v.id, soort }, T);
    const c = v ? await w.post(COMMIT, { id: v.id }, T) : { status: 0 };
    await w.crash();
    const m = await mijn();
    return { klopt: c.status === 200 && m.mijn.sessie === 'normaal' && m.mijn.identiteit === 'beschermd', ziet: 'afronden ' + c.status + ', na SIGKILL sessie ' + m.mijn.sessie + ', identiteit ' + m.mijn.identiteit };
  });
}

module.exports = {
  functie: 'link:bescherming',
  ingang: '/apps/mijn-isolatie.html',
  persona: 'lid',
  belofte: 'een lid zet zijn eigen beveiliging zonder drempel strenger, krijgt hem alleen via een ceremonie met reden en stappen weer omlaag, en ziet eerlijk waar de stand wordt afgedwongen',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De ceremonie is op de sessielaag gelopen (geen wachttijd); de identiteitslaag vraagt een afkoelperiode van tien minuten en is alleen verstrengd en niet ontsloten. Zonder passkey is elke ontsluiting een noodontsluiting; de passkeystap (WebAuthn) is niet gelopen. Wat een beschermde stand voor een HTTP-verzoek afdwingt, meet het scherm zelf (afgedwongen.http) en deze proef niet. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
