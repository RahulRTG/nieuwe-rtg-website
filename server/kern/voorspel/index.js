/* De voorspeller: RTG leert het ritme van elk lid en elke zaak uit het
   eigen grootboek en zet klaar wat waarschijnlijk komt. Elke transactie in
   het huis (eten, ritten, tickets, care, dates) landt als boeking in RTG
   Pay; daardoor is een bron genoeg om over alle apps heen te leren.

   Het leren is bewust doorzichtig (geen zwarte doos): per gewoonte tellen
   we hoe vaak, het gebruikelijke uur en de gebruikelijke dag, en het
   gemiddelde aantal dagen ertussen. De zekerheid groeit met het aantal
   waarnemingen en met hoe "rijp" het volgende bezoek is. Bij te weinig
   geschiedenis zeggen we dat eerlijk, in plaats van te gokken (liever te
   hard dan een liegbeest). De AI mag deze paden zelf aanroepen via het
   stuur, en de apps tonen de beste verwachting als stille kaart. Dit is de
   orkestrator: de state-gebonden runtime (voorLid/voorZaak/dealkansen) woont
   hier; de pure rekenkern in ./rekenen. */

const { DAGEN, seintjeVoor, ketenUit, gewoontenUit, combinatiesUit } = require('./rekenen');

function maakVoorspel({ db, findSupplier }) {
  const boek = () => Array.isArray(db.data.payBoekingen) ? db.data.payBoekingen : [];
  const naamVan = (code) => { const z = findSupplier(code); return z ? z.name : code; };

  function voorLid(codenaam, key, nu = new Date()) {
    const rek = 'lid:' + codenaam;
    const rijen = boek().filter(r => r.van === rek).slice(0, 400);
    const gewoonten = gewoontenUit(rijen, rek, nu);
    // de vaste boekingen als extra bron: een zekere aankomst gaat voorop
    const keten = key ? ketenUit({
      verblijven: (db.data.verblijven || []).filter(v => (v.customerKey || v.key) === key),
      reserveringen: (db.data.reserveringen || []).filter(r => r.customerKey === key)
    }, nu) : [];
    const verwachtingen = keten.concat(gewoonten.map(g => ({
      soort: 'gewoonte', zaak: naamVan(g.code), code: g.code, zekerheid: g.zekerheid, rijp: g.rijp,
      wat: naamVan(g.code) + ' rond ' + g.uur + ':00' +
        (g.tussenDagen >= 4 ? ', meestal op ' + g.dagNaam : ''),
      waarom: g.n + ' eerdere bezoeken, gemiddeld elke ' +
        (g.tussenDagen < 1 ? 'dag' : Math.round(g.tussenDagen) + ' dagen'),
      vraag: 'Zet mijn gebruikelijke bezoek aan ' + naamVan(g.code) +
        ' klaar, rond ' + g.uur + ':00.'
    }))).slice(0, 3);
    return {
      ok: true, verwachtingen, geleerdUit: rijen.length,
      uitleg: verwachtingen.length ? null :
        'Nog te weinig geschiedenis om eerlijk te voorspellen; RTG leert met elk bezoek.'
    };
  }

  /* de dealvinder: van combinatiegedrag naar een kant-en-klaar
     Synergie-voorstel. De pakketprijs is de som van de gemiddelde
     bestedingen met tien procent pakketvoordeel; de aandelen zijn naar
     rato en tellen exact op tot de prijs (de rest valt bij de eigen
     zaak). Voorstellen doen blijft een menselijke keuze: een knop, geen
     automatische deal. */
  function dealkansenVoor(code, nu = new Date()) {
    const rijen = boek().slice(0, 2000);
    if (!rijen.length) return [];
    const oudste = Math.min(...rijen.map(r => Date.parse(r.at)));
    const weken = Math.max(1, (nu.getTime() - oudste) / (7 * 86400000));
    return combinatiesUit(rijen)
      .filter(p => (p.a === code || p.b === code) && p.n >= 3)
      .slice(0, 3).map(p => {
        const partner = p.a === code ? p.b : p.a;
        const gemMijn = p.a === code ? p.gemA : p.gemB;
        const gemPartner = p.a === code ? p.gemB : p.gemA;
        const prijs = Math.round((gemMijn + gemPartner) * 0.9);
        const partnerDeel = Math.round(prijs * gemPartner / (gemMijn + gemPartner));
        return {
          partner: naamVan(partner), partnerCode: partner, n: p.n,
          perWeek: +(p.n / weken).toFixed(1),
          tekst: 'Gasten combineerden u ' + p.n + ' keer met ' + naamVan(partner) +
            ' binnen een dagdeel (~' + +(p.n / weken).toFixed(1) + ' keer per week).',
          voorstel: {
            naam: naamVan(code) + ' × ' + naamVan(partner),
            prijsCenten: prijs,
            aandelen: [{ code, centen: prijs - partnerDeel }, { code: partner, centen: partnerDeel }]
          }
        };
      });
  }

  function voorZaak(code, nu = new Date()) {
    const rek = 'partner:' + code;
    const rijen = boek().filter(r => r.naar === rek && /^lid:/.test(r.van)).slice(0, 2000);
    if (rijen.length < 5) {
      return { ok: true, morgen: null, vasteGasten: [], dealkansen: dealkansenVoor(code, nu),
        geleerdUit: rijen.length,
        uitleg: 'Nog te weinig geschiedenis om eerlijk te voorspellen; het beeld groeit met elke transactie.' };
    }
    const oudste = Math.min(...rijen.map(r => new Date(r.at).getTime()));
    const weken = Math.max(1, (nu.getTime() - oudste) / (7 * 86400000));
    const morgenDag = (nu.getDay() + 1) % 7;
    const opDag = rijen.filter(r => new Date(r.at).getDay() === morgenDag);
    const perUur = {};
    for (const r of opDag) { const u = new Date(r.at).getHours(); perUur[u] = (perUur[u] || 0) + 1; }
    const drukUren = Object.entries(perUur).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([u, n]) => ({ uur: +u, n }));
    const perGast = {};
    for (const r of rijen) { const c = r.van.slice(4); perGast[c] = (perGast[c] || 0) + 1; }
    const vasteGasten = Object.entries(perGast).filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => ({ codenaam: c, n }));
    const advies = drukUren.length
      ? 'Plan de bezetting rond ' + drukUren.map(u => u.uur + ':00').join(' en ') +
        ' en zet de voorbereiding ruim daarvoor klaar.'
      : 'Nog geen duidelijke piek op deze weekdag; het beeld groeit met elke transactie.';
    const verwachtTransacties = Math.round(opDag.length / weken);
    // de keten tussen zaken: dezelfde verwachting, verwoord voor de inkoop,
    // zodat boer en groothandel stil kunnen vooruitwerken (bestellen blijft
    // altijd een menselijke keuze)
    const bevoorrading = verwachtTransacties > 0
      ? 'Voor de inkoop: reken op ongeveer ' + verwachtTransacties + ' transacties ' +
        DAGEN[morgenDag] + '; geef dit door aan uw boer of groothandel zodat de voorraad erop is ingericht.'
      : null;
    return {
      ok: true, geleerdUit: rijen.length, weken: +weken.toFixed(1),
      morgen: {
        dagNaam: DAGEN[morgenDag],
        verwachtTransacties,
        verwachtCenten: Math.round(opDag.reduce((s, r) => s + r.centen, 0) / weken),
        drukUren, advies, bevoorrading
      },
      vasteGasten,
      dealkansen: dealkansenVoor(code, nu)
    };
  }

  return { voorspel: { voorLid, voorZaak, dealkansenVoor, gewoontenUit, seintjeVoor, ketenUit } };
}

module.exports = { maakVoorspel, gewoontenUit, seintjeVoor, ketenUit, combinatiesUit, DAGEN };
