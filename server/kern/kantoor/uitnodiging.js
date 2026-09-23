/* DE KANTOORUITNODIGING -- AUTHORITY.md fase 2, gebouwd naast de gedeelde code.

   Besluit van de eigenaar (23 september 2026): bouwen, en daarna dezelfde dag
   de gedeelde code dicht voor nieuwe koppelingen. Tot dan kwam
   iedereen de kantoorrol binnen met EEN code die het hele kantoor kent, en die
   code is daarmee geen bewijs van wie er koppelt. Een uitnodiging is dat wel:

     - OP NAAM: aan een sleutel gebonden, en alleen die sleutel kan hem verzilveren;
     - EENMALIG: na gebruik is hij op;
     - MET EEN VERVALDATUM: zeven dagen, en een verlopen uitnodiging is dicht;
     - ZONDER DE CODE OP TE SLAAN: alleen een hash. De code wordt een keer getoond,
       aan de eigenaar die hem maakt, en verder nergens.

   DE TELLING: elke koppeling telt mee onder de weg waarlangs hij kwam. Sinds
   later op 23 september 2026 koppelt de gedeelde code niet meer (besluit van de
   eigenaar, kern/eenaccount/koppelen.js); `gedeeldeCode` telt de koppelingen van
   daarvoor en `gedeeldeCodeGeweigerd` de pogingen erna.

   Wat hier NIET gebeurt: een recht verlenen. Een verzilverde uitnodiging levert
   precies de kantoorrol die de gedeelde code ook gaf; niet meer. */
'use strict';

const GELDIG_DAGEN = 7;
const DAG = 86400000;
const ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function maakUitnodiging({ db, save, crypto, nu }) {
  const tijd = nu || Date.now;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/kantoor/uitnodiging',
    bezit: { kantoorUitnodigingen: 'lijst', kantoorKoppelwegen: 'kaart' } });
  const lijst = () => eigen.bak('kantoorUitnodigingen');
  const hash = (code) => crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');

  /* Een nieuwe uitnodiging voor een sleutel. Een open uitnodiging voor dezelfde
     sleutel vervalt meteen: twee geldige codes voor een mens is een code te veel. */
  function maak({ voorKey, codenaam, door }) {
    if (!/^user-\d+$/.test(String(voorKey || '')))
      return { status: 400, error: 'Een uitnodiging hangt aan een persoonlijke RTG-inlog.' };
    const bytes = crypto.randomBytes(10);
    let code = '';
    for (const b of bytes) code += ALFABET[b % ALFABET.length];
    const nuT = tijd();
    const l = lijst();
    for (const u of l) if (u.voorKey === voorKey && !u.gebruikt && !u.ingetrokken) u.ingetrokken = new Date(nuT).toISOString();
    l.push({ id: 'uitn_' + crypto.randomBytes(6).toString('hex'), voorKey, codenaam: codenaam || null, door: door || null,
      hash: hash(code), gemaakt: new Date(nuT).toISOString(), verloopt: new Date(nuT + GELDIG_DAGEN * DAG).toISOString(),
      gebruikt: null, ingetrokken: null });
    save();
    return { ok: true, code, verloopt: new Date(nuT + GELDIG_DAGEN * DAG).toISOString(),
      let: 'Deze code wordt maar een keer getoond. Geef hem op een veilige manier aan de medewerker.' };
  }

  /* Verzilveren: alleen door de sleutel waarvoor hij is gemaakt, een keer, en
     binnen de vervaldatum. Een foute poging zegt niet WELKE voorwaarde viel --
     dat zou een raadspel makkelijker maken. */
  function verzilver(key, code, opties) {
    const h = hash(code);
    const u = lijst().find(x => x.hash === h);
    const nuT = tijd();
    if (!u || u.voorKey !== key || u.gebruikt || u.ingetrokken || Date.parse(u.verloopt) < nuT)
      return { status: 401, error: 'Deze uitnodiging is niet geldig voor uw account, al gebruikt of verlopen.' };
    /* Een proef verbruikt niets: de tweede factor komt nog, en een uitnodiging
       die opgaat aan een verkeerd getypte authenticatorcode is een gemene val. */
    if (opties && opties.proef) return { ok: true };
    u.gebruikt = new Date(nuT).toISOString();
    save();
    return { ok: true };
  }

  /* De schaduw van fase 2: langs welke weg de kantoorrol werd gekoppeld. */
  function telWeg(weg) {
    const k = eigen.bak('kantoorKoppelwegen');
    k[weg] = (k[weg] || 0) + 1;
    save();
  }

  function overzicht() {
    const nuT = tijd();
    return {
      uitnodigingen: lijst().slice(-100).reverse().map(u => ({ id: u.id, codenaam: u.codenaam, gemaakt: u.gemaakt,
        verloopt: u.verloopt, stand: u.gebruikt ? 'gebruikt' : u.ingetrokken ? 'ingetrokken'
          : Date.parse(u.verloopt) < nuT ? 'verlopen' : 'open' })),
      koppelwegen: Object.assign({ gedeeldeCode: 0, gedeeldeCodeGeweigerd: 0, uitnodiging: 0 }, eigen.kijk('kantoorKoppelwegen') || {}),
      uitleg: 'Sinds 23 september 2026 koppelt de gedeelde kantoorcode geen kantoorrol meer aan een account (besluit ' +
        'van de eigenaar); gedeeldeCode telt de koppelingen van daarvoor, gedeeldeCodeGeweigerd de pogingen erna.'
    };
  }

  return { maak, verzilver, telWeg, overzicht, GELDIG_DAGEN };
}

module.exports = { maakUitnodiging };
