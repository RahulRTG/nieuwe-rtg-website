/* ============================================================================
   HET BEWAARBLOK VAN EEN VOLTOOIPROEF -- persistent en herstelbaar voor een
   app die een eigen lijst van het lid bijhoudt (een kelder, een gastenlijst,
   een dossier).

   WAAROM EEN GEDEELD BLOK. De vragen van bewijs 5 en 7 zijn voor zo'n app
   dezelfde, en ze verschillen alleen in de route en de vorm van de rij:
     persistent   staat het er na een nette herstart nog, byte voor byte; ziet
                  een nieuwe sessie hetzelfde; en staat het in de OPSLAG zelf
                  (gelezen buiten de server om, ./voltooiwereld.js vindInOpslag);
     herstelbaar  een dubbeltik maakt er een en niet twee; een verzoek dat de
                  client opgaf en daarna opnieuw stuurde, ook; een crash direct
                  na het toevoegen laat het staan; een crash direct na het
                  weghalen laat het weg -- ook op schijf.
   Vier kopieen van die tien stappen zouden na de eerste reparatie uiteenlopen.

   WAT HET BLOK NIET IS: de belofte van de app. Voltooibaar schrijft elk
   scenario zelf, met de handelingen die zijn app belooft (inschenken telt af,
   een document verloopt, een gast krijgt een dieet). En de ROUTES staan in het
   scenario, letterlijk: daarop meet scripts/lib/bewijsbron.js de koppeling met
   het scherm. Dit blok krijgt ze als parameter en noemt er zelf geen.

   De vorm van `o`:
     T            het token van het lid
     lid          { email, wachtwoord } -- voor de nieuwe sessie
     merk         een uniek merkteken; elke naam die het blok maakt draagt het
     alle(T)      -> de rijen zoals het scherm ze leest (array), of null
     naamVan(r)   -> de naam van een rij
     maak(naam)   -> { pad, lijf } om een rij met die naam te maken
     weg(rij)     -> { pad, lijf } om die rij weg te halen
     wat          een woord voor de rij in de uitslag ("fles", "gelegenheid")
   ========================================================================== */
'use strict';
const { randomUUID } = require('node:crypto');
const { inloggen, lifestyleLid } = require('./voltooiwereld');

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function bewaarblok(w, stap, o) {
  const met = async (T, naam) => ((await o.alle(T)) || []).filter((r) => o.naamVan(r) === naam);
  const eigen = async (T) => ((await o.alle(T)) || []).filter((r) => String(o.naamVan(r)).includes(o.merk));

  /* Deze elf dossier-apps delen dezelfde eigendomsgrens: de lijst en haar
     mutaties horen bij het ingelogde Lifestyle-lid. Bewijs die grens hier een
     keer volledig, naast de gedeelde opslag- en herstelproeven. Alleen een
     afwijzing is onvoldoende: de tweede bevoegde actor moet zijn eigen rij
     kunnen maken, terwijl beide dossiers voor en na de aanval gescheiden
     blijven. */
  await stap('bevoegd', 'een ander Lifestyle-lid leest, verwijdert of vermengt dit dossier niet en houdt een eigen dossier', async () => {
    const ander = await lifestyleLid(w, 'iso-' + o.wat);
    const voorA = (await o.alle(o.T)) || [];
    const doel = voorA.find((r) => String(o.naamVan(r)).includes(o.merk));
    if (!doel) return { klopt: false, ziet: 'geen eigen ' + o.wat + ' om de eigendomsgrens mee te toetsen' };

    const voorB = (await o.alle(ander.token)) || [];
    const aanval = o.weg(doel);
    const geweigerd = await w.post(aanval.pad, aanval.lijf, ander.token);
    const naamB = 'Eigen ' + o.wat + ' ' + randomUUID();
    const maakB = o.maak(naamB);
    const gemaakt = await w.post(maakB.pad, maakB.lijf, ander.token);
    const naA = (await o.alle(o.T)) || [];
    const naB = (await o.alle(ander.token)) || [];
    const aBehoudtDoel = naA.some((r) => o.naamVan(r) === o.naamVan(doel));
    const aZietB = naA.some((r) => o.naamVan(r) === naamB);
    const bZietA = voorB.concat(naB).some((r) => String(o.naamVan(r)).includes(o.merk));
    const bZietEigen = naB.filter((r) => o.naamVan(r) === naamB).length === 1;
    return {
      klopt: geen5xx(geweigerd) && gemaakt.status === 200 && aBehoudtDoel && !aZietB && !bZietA && bZietEigen,
      ziet: 'vreemd verwijderen ' + geweigerd.status + ' (zonder effect); A behoudt eigen=' + aBehoudtDoel + ', ziet B=' + aZietB + '; B ziet A=' + bZietA + ', eigen=' + bZietEigen
    };
  });

  const voor = JSON.stringify(await eigen(o.T));
  const plekVoor = w.vindInOpslag(o.merk);
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat elke ' + o.wat + ' van het lid er nog, byte voor byte', async () => {
    const na = JSON.stringify(await eigen(o.T));
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk (' + JSON.parse(na).length + ' ' + o.wat + ', ' + na.length + ' tekens)' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest exact hetzelfde', async () => {
    const C = await inloggen(w, o.lid);
    const na = JSON.stringify(await eigen(C));
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'nieuwe sessie leest hetzelfde' : 'ANDERS: ' + na.slice(0, 80) };
  });
  await stap('persistent', 'het staat in de opslag zelf (gelezen buiten de server om), voor en na de herstart', async () => {
    const na = w.vindInOpslag(o.merk);
    return { klopt: plekVoor.length >= 1 && na.length >= 1,
      ziet: 'voor: ' + plekVoor.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; na: ' + na.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  await stap('herstelbaar', 'dubbeltik op toevoegen: een ' + o.wat + ', niet twee', async () => {
    const naam = 'Dubbel ' + o.merk;
    const m = o.maak(naam);
    const [a, b] = await w.dubbel(m.pad, m.lijf, o.T);
    const n = (await met(o.T, naam)).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' ' + o.wat };
  });
  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: precies een ' + o.wat, async () => {
    const naam = 'Afgebroken ' + o.merk;
    const m = o.maak(naam);
    const half = await w.afgebroken(m.pad, m.lijf, o.T);
    const opnieuw = await w.post(m.pad, m.lijf, o.T);
    const n = (await met(o.T, naam)).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' ' + o.wat };
  });
  await stap('herstelbaar', 'een crash direct na het toevoegen: de ' + o.wat + ' staat er na de herstart', async () => {
    const naam = 'Crash ' + o.merk;
    const m = o.maak(naam);
    const r = await w.post(m.pad, m.lijf, o.T);
    await w.crash();
    const n = (await met(o.T, naam)).length;
    return { klopt: r.status === 200 && n === 1, ziet: 'toevoegen ' + r.status + ', na SIGKILL ' + n + ' ' + o.wat };
  });
  await stap('herstelbaar', 'een crash direct na het weghalen: wat weg heette, blijft weg -- ook op schijf', async () => {
    const naam = 'Crash ' + o.merk;
    const rij = (await met(o.T, naam))[0];
    const x = rij ? o.weg(rij) : null;
    const r = x ? await w.post(x.pad, x.lijf, o.T) : { status: 0 };
    await w.crash();
    const n = (await met(o.T, naam)).length;
    const opSchijf = w.vindInOpslag(naam);
    return { klopt: r.status === 200 && n === 0 && opSchijf.length === 0,
      ziet: 'weghalen ' + r.status + ', na SIGKILL ' + n + ' ' + o.wat + ', op schijf ' + opSchijf.length + ' plek(ken)' };
  });
}

module.exports = { bewaarblok, geen5xx };
