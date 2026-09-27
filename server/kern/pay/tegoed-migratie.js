/* DE OUDE BONNEN (kern/pay/tegoed-migratie.js): van `payTegoed` naar
   `payTegoedBon`, zonder dat er een cent verdwijnt.

   Tot 27 september 2026 stond een bon als rij in de LIJST `payTegoed`, met
   zijn kale code van 96 bits erin. Die code is waarde: de houder heeft hem
   op zijn telefoon of op papier, en zolang de bon open staat, is dat zijn
   geld. Deze migratie gooit daarom niets weg en maakt niets ongeldig:

     - de code wordt op zijn plek GEHASHT (dezelfde normalisatie als bij het
       zoeken), dus de houder verzilvert met exact wat hij al had;
     - de stand blijft wat hij was, en 'bezig' -- een slot dat alleen in het
       geheugen hoorde te staan maar via een andere save op schijf kon
       belanden -- wordt BESLIST uit het grootboek: staat er een boeking uit de
       escrow met deze bon als ref, dan is hij afgerond; anders staat hij open;
     - de rij krijgt `legacy96: true`. Een oude code houdt zijn 96 bits tot de
       koper roteert of de bon afloopt (hoogstens een jaar na uitgifte). Dat
       is een bewuste keuze van waardebehoud boven vervroegd ongeldig maken, en
       hij staat in CODECREDENTIALS.json bij de deur.

   Drie stappen, elk herhaalbaar: lees de oude rijen onder hun eigen slot,
   schrijf wat ontbreekt in de nieuwe collectie (op id, dus een tweede ronde
   schrijft niets), en haal pas DAARNA de overgezette rijen uit de oude lijst.
   Valt het proces tussen stap 2 en 3, dan staat de code nog kaal in de oude
   lijst en ruimt de volgende aanroep hem op; er is geen stand waarin een bon
   in geen van beide staat. */
'use strict';

module.exports = ({ d, save, bon, bewerkCollectie, grootboek, nu }) => {
  const { transactie, codeHash, iso, REK_TEGOED, VERVAL_MS, DOEL, SCOPE } = bon;
  const OUD = 'payTegoed';
  const isoVan = ms => new Date(Number(ms) || nu()).toISOString();

  const heeftOud = () => Array.isArray(d()[OUD]) && d()[OUD].some(r => r && r.id);

  function oud(werk) {
    if (typeof bewerkCollectie === 'function') return bewerkCollectie(OUD, werk);
    const rijen = Array.isArray(d()[OUD]) ? d()[OUD] : [];
    const r = werk(rijen);
    save();
    return r;
  }

  /* 'bezig' wordt uit het grootboek beslist en nooit geraden. */
  function stand(t) {
    if (t.status !== 'bezig') return { status: t.status };
    const b = (grootboek() || []).find(r => r && r.van === REK_TEGOED && r.ref === t.id);
    if (!b) return { status: 'open' };
    const koper = (t.vanSoort === 'zaak' ? 'partner:' : 'lid:') + t.van;
    return b.naar === koper
      ? { status: 'terug', terugAt: b.at }
      : { status: 'verzilverd', verzilverdDoor: String(b.naar).replace(/^lid:/, ''), verzilverdAt: b.at };
  }

  function nieuw(t) {
    const s = stand(t);
    const vervalt = Number(t.vervalt) || (Number(t.at) || nu()) + VERVAL_MS;
    const status = s.status;
    const verzilverdAt = t.verzilverdAt || s.verzilverdAt || null;
    const terugAt = t.terugAt || s.terugAt || null;
    return {
      id: t.id, van: t.van, vanSoort: t.vanSoort === 'zaak' ? 'zaak' : 'lid', aan: t.aan || null,
      centen: t.centen, oms: t.oms, status, at: Number(t.at) || nu(), boeking: t.boeking || null,
      verzilverdDoor: t.verzilverdDoor || s.verzilverdDoor || null, verzilverdAt, terugAt,
      claim: null, legacy96: true, gemigreerdAt: iso(),
      toegang: {
        code_hash: codeHash(t.code), issuer: (t.vanSoort === 'zaak' ? 'zaak:' : 'lid:') + t.van,
        doel: DOEL, scope: [...SCOPE], onderwerp: { soort: 'tegoedbon', id: t.id },
        issued_at: isoVan(t.at), expires_at: isoVan(vervalt), max_gebruik: 1,
        gebruik: status === 'verzilverd' ? 1 : 0,
        laatst_gebruikt_at: status === 'verzilverd' ? isoVan(verzilverdAt) : null,
        ingetrokken_at: status === 'terug' ? isoVan(terugAt) : null,
        ingetrokken_door: status === 'terug' ? 'legacy-migratie' : null,
        intrekreden: status === 'terug' ? 'verlopen tegoed terug' : null, rotatie: 1
      }
    };
  }

  async function migreer() {
    const rijen = await oud(lijst => Array.isArray(lijst)
      ? JSON.parse(JSON.stringify(lijst.filter(r => r && r.id))) : []);
    if (!rijen.length) return { gemigreerd: 0 };
    const over = await transactie(bron => {
      let n = 0;
      for (const t of rijen) if (!bron[t.id]) { bron[t.id] = nieuw(t); n++; }
      return { n, ids: rijen.filter(t => bron[t.id]).map(t => t.id) };
    });
    const weg = new Set(over.ids);
    await oud(lijst => {
      if (!Array.isArray(lijst)) return;
      for (let i = lijst.length - 1; i >= 0; i--) if (lijst[i] && weg.has(lijst[i].id)) lijst.splice(i, 1);
    });
    return { gemigreerd: over.n };
  }

  /* Goedkoop genoeg voor elke aanroep: zolang de oude lijst leeg is, gebeurt
     er niets. Een oude instance die tijdens een uitrol nog een rij schrijft,
     wordt bij de eerstvolgende aanroep alsnog overgezet. */
  const zorg = () => (heeftOud() ? migreer() : Promise.resolve({ gemigreerd: 0 }));

  return { migreer, zorg };
};
