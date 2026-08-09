/* Fiscaal (deelmodule): DE TELLING waar de btw-aangifte op staat.

   Afgesplitst van ./btwaangifte.js, dat over de 10 kB-lat ging -- en het is de
   natuurlijke naad: hier wordt geteld, daar wordt een aangifte opgemaakt,
   ingediend en gecorrigeerd. Wat een periode betekent en hoe het factuurregister
   wordt gelezen staat hier, en nergens anders.

   De regel die dit bestand draagt: er wordt GEEN btw uitgerekend die niet al op
   de factuur staat. Elke regel draagt zijn eigen tarief sinds
   kern/facturatie/motor.js hem boekte; hier wordt dat tarief alleen toegepast om
   het bedrag exclusief btw terug te vinden, met exact dezelfde afronding als de
   motor gebruikte. Anders staan er twee btw-motoren in huis. */
'use strict';

/* De rubrieken van de Nederlandse aangifte omzetbelasting, op tarief. Alleen
   voor NL: een zaak in Belgie of Spanje heeft andere tarieven en een ander
   formulier, en daar een Nederlands rubrieknummer op plakken zou een bewering
   zijn die niet waar is. Daar blijft het bij het tarief zelf. */
const RUBRIEK_NL = { 21: '1a', 9: '1b', 0: '1e' };
const KWARTAAL = /^(\d{4})K([1-4])$/;
const MAAND = /^(\d{4})-(0[1-9]|1[0-2])$/;

/* Een periode is een gesloten vak met een eerste en een laatste dag. Puur, en
   met opzet de enige plek waar staat wat "2026K3" betekent. */
function periodeVak(periode) {
  const p = String(periode || '').trim().toUpperCase();
  const k = KWARTAAL.exec(p);
  if (k) {
    const eerste = (Number(k[2]) - 1) * 3 + 1;
    const laatsteMaand = eerste + 2;
    const dag = new Date(Date.UTC(Number(k[1]), laatsteMaand, 0)).getUTCDate();
    return { soort: 'kwartaal', periode: p, jaar: Number(k[1]),
      van: k[1] + '-' + String(eerste).padStart(2, '0') + '-01',
      tot: k[1] + '-' + String(laatsteMaand).padStart(2, '0') + '-' + dag };
  }
  const m = MAAND.exec(p);
  if (m) {
    const dag = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
    return { soort: 'maand', periode: p, jaar: Number(m[1]), van: p + '-01', tot: p + '-' + dag };
  }
  return null;
}

function maakBtwTelling({ db }) {
  const cent = (n) => Math.round((Number(n) || 0) * 100);

  /* De btw op EEN regel, en met opzet de enige plek waar die som staat. Hij
     wordt door twee lezers gebruikt -- de aangifte van de ondernemer
     (telFacturen) en het toezicht van de inspecteur (telPerZaak) -- en juist
     daar hoort geen tweede som te staan: een inspecteur die anders rekent dan
     de aangever heeft altijd een verschil, en dan weet niemand meer of dat
     verschil ergens over gaat. */
  function regelBtwCenten(r) {
    const inclC = cent(r.incl);
    const tarief = Number(r.btw) || 0;
    return { inclC, btwC: inclC - Math.round(inclC / (1 + tarief / 100)), tarief };
  }

  /* De optelling over het factuurregister. Per REGEL, want daar zit het tarief;
     een factuur als geheel heeft geen tarief zodra er 9% en 21% op staat.

     Geeft naast de potten ook de `koppen` terug: de btw zoals de facturatiemotor
     hem zelf op de factuur zette. Dat is de tweede weg naar hetzelfde getal, en
     die vergelijking maakt btwaangifte.maak(). */
  function telFacturen(code, vak) {
    const zaak = String(code || '').toUpperCase();
    const alle = Array.isArray(db.data.facturen) ? db.data.facturen : [];
    const uit = { verkoop: {}, verkoopKoppen: 0, verkoopAantal: 0, verkoopSom: 0,
      voorbelasting: 0, inkoopKoppen: 0, inkoopAantal: 0, zonderRegels: [] };
    for (const f of alle) {
      const datum = String(f.datum || String(f.at || '').slice(0, 10));
      if (datum < vak.van || datum > vak.tot) continue;
      const verkocht = !!(f.verkoper && String(f.verkoper.code || '').toUpperCase() === zaak);
      const gekocht = !!(f.koper && String(f.koper.supplierCode || '').toUpperCase() === zaak);
      if (!verkocht && !gekocht) continue;
      const regels = Array.isArray(f.regels) ? f.regels : [];
      /* Een factuur zonder regels valt niet aan een tarief toe te wijzen. Hem
         als nul meetellen zou de aangifte stilletjes te laag maken; hij wordt
         daarom bij nummer gemeld, en maak() weigert erop. */
      if (!regels.length) { uit.zonderRegels.push(f.nummer || f.id); continue; }
      for (const r of regels) {
        const { inclC, btwC, tarief } = regelBtwCenten(r);
        if (verkocht) {
          const pot = uit.verkoop[tarief] || (uit.verkoop[tarief] = { tarief, omzetCenten: 0, btwCenten: 0 });
          pot.omzetCenten += inclC - btwC; pot.btwCenten += btwC; uit.verkoopSom += btwC;
        } else {
          uit.voorbelasting += btwC;
        }
      }
      if (verkocht) { uit.verkoopAantal += 1; uit.verkoopKoppen += cent(f.btwBedrag); }
      else { uit.inkoopAantal += 1; uit.inkoopKoppen += cent(f.btwBedrag); }
    }
    return uit;
  }

  /* DEZELFDE TELLING, MAAR OVER ALLE ZAKEN IN EEN KEER -- voor de inspecteur.

     telFacturen() loopt het register af voor EEN zaak. Het Belastingkantoor wil
     het beeld over allemaal, en dat honderd keer los tellen is honderd keer het
     hele register lezen. Hier gebeurt het in een pas, met precies dezelfde som
     per regel (regelBtwCenten hierboven) -- want een toezichthouder die anders
     rekent dan de aangever vindt altijd een verschil.

     Alleen de VERKOOPKANT: de uitgaande btw is wat een zaak aangeeft. De
     voorbelasting van een zaak staat op de facturen van zijn leveranciers, en
     die zijn per zaak op te halen met telFacturen; hem hier meenemen zou de
     inspecteur een saldo geven dat hij niet uit dit ene overzicht kan navragen. */
  function telPerZaak(vak) {
    const alle = Array.isArray(db.data.facturen) ? db.data.facturen : [];
    const perZaak = new Map();
    for (const f of alle) {
      const datum = String(f.datum || String(f.at || '').slice(0, 10));
      if (datum < vak.van || datum > vak.tot) continue;
      const code = f.verkoper && String(f.verkoper.code || '').toUpperCase();
      if (!code) continue;
      const regels = Array.isArray(f.regels) ? f.regels : [];
      const p = perZaak.get(code) || { code, naam: (f.verkoper && f.verkoper.naam) || code,
        facturen: 0, grondslagCenten: 0, btwCenten: 0, zonderRegels: 0 };
      if (!regels.length) { p.zonderRegels += 1; perZaak.set(code, p); continue; }
      for (const r of regels) {
        const { inclC, btwC } = regelBtwCenten(r);
        p.grondslagCenten += inclC - btwC; p.btwCenten += btwC;
      }
      p.facturen += 1;
      perZaak.set(code, p);
    }
    return perZaak;
  }

  /* De potten als een geordende lijst, hoogste tarief eerst, met het
     rubrieknummer erbij zodra de zaak in Nederland zit. */
  const tarievenPerTarief = (potten, land) => Object.values(potten)
    .sort((a, b) => b.tarief - a.tarief)
    .map(p => ({ tarief: p.tarief, rubriek: land === 'NL' ? (RUBRIEK_NL[p.tarief] || null) : null,
      omzetCenten: p.omzetCenten, btwCenten: p.btwCenten }));

  /* DE CONTROLE DIE ERTOE DOET, en hij hoort hier omdat hij over dit register
     gaat. De btw uit de regels moet exact de btw zijn die de facturatiemotor op
     de factuur zelf zette. Beide komen uit hetzelfde register maar langs een
     andere weg -- regel versus factuurkop -- dus dit hoort altijd te kloppen, en
     juist daarom is het een goede controle: gaat hij ooit af, dan is er aan de
     facturatiemotor iets veranderd waar de aangifte niets van weet.

     Weigert, en waarschuwt niet: een aangifte op cijfers die zichzelf
     tegenspreken is erger dan geen aangifte. Geeft null als alles klopt. */
  function controleerRegister(t) {
    if (t.zonderRegels.length) return { status: 422,
      error: 'Deze facturen hebben geen regels en zijn dus niet aan een btw-tarief toe te wijzen: ' +
        t.zonderRegels.slice(0, 5).join(', ') +
        (t.zonderRegels.length > 5 ? ' (en ' + (t.zonderRegels.length - 5) + ' meer)' : '') + '.' };
    if (t.verkoopSom !== t.verkoopKoppen) return { status: 422,
      error: 'De btw uit de factuurregels (' + t.verkoopSom + ' cent) wijkt af van de btw op de facturen zelf (' +
        t.verkoopKoppen + ' cent). Er klopt iets niet in het factuurregister.' };
    if (t.voorbelasting !== t.inkoopKoppen) return { status: 422,
      error: 'De voorbelasting uit de factuurregels (' + t.voorbelasting + ' cent) wijkt af van de btw op de inkoopfacturen zelf (' +
        t.inkoopKoppen + ' cent). Er klopt iets niet in het factuurregister.' };
    return null;
  }

  return { telFacturen, telPerZaak, tarievenPerTarief, controleerRegister };
}

module.exports = { maakBtwTelling, periodeVak, RUBRIEK_NL };
