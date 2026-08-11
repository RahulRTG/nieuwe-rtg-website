/* DE HERKOMST -- waar komt een gegeven vandaan, en wie hangt ervan af.

   DIT IS DE DERDE VRAAG OP DEZELFDE METING. ./kwaliteit.js meet welk veld in de
   praktijk naar welke soort verwijst; daar komen de wezen uit, bij ./graaf.js de
   randen, en hier de afhankelijkheden. Eén meting, drie vragen -- en dus geen
   drie schema's die elkaar kunnen tegenspreken.

   ELK ANTWOORD DRAAGT ZIJN AARD, en dat is de kern van deze module. Een
   lineage-scherm dat gemeten, aangegeven en afgeleid door elkaar toont, geeft
   het geheel de betrouwbaarheid van het zwakste deel en niemand kan zien welk
   deel dat is. Hier staat het er per stuk bij:

     gemeten     uit de gegevens zelf (de verwijzingen, en wat het journaal
                 werkelijk heeft zien gebeuren)
     aangegeven  uit een tabel die een mens heeft geschreven (de runbooks, het
                 bewaarbeleid) -- waar dan ook staat WELKE tabel
     afgeleid    gerekend uit de twee bovenstaande (wat er wees wordt als deze
                 soort verdwijnt)

   EN DE BLINDE VLEK STAAT IN DE UITSLAG. Het journaal ziet alleen wat via RTG
   Command is gegaan. Een bestelling die een leverancier zelf afrondt, staat hier
   niet als schrijver -- niet omdat er niets gebeurde maar omdat die weg niet
   door deze laag loopt. Een herkomstscherm dat die stilte als "niemand schrijft
   hierin" toont, is erger dan geen herkomstscherm: het nodigt uit om iets weg te
   gooien waar wel degelijk aan wordt geschreven.

   HIJ ERFT DE SCOPE VAN ZIJN REGISTER, net als de graaf. Krijgt hij het
   register van één zaak, dan bestaat de rest van het platform niet voor hem. */
'use strict';

const { s } = require('./register');

function maakHerkomst({ db, register, graaf, journaal, runbooks, bewaarbeleid }) {
  const BELEID = Array.isArray(bewaarbeleid) ? bewaarbeleid : [];

  /* Het journaal in één doorloop, gegroepeerd per soort en actie. Dit is de
     GEMETEN schrijfkant: niet wie erin mag schrijven, maar wie het heeft
     gedaan. */
  function uitJournaal() {
    const per = new Map();
    const regels = journaal ? journaal.recent(100000) : [];
    for (const r of regels) {
      if (!r.objectType) continue;
      if (!per.has(r.objectType)) per.set(r.objectType, new Map());
      const m = per.get(r.objectType);
      const k = r.actie || '(zonder naam)';
      if (!m.has(k)) m.set(k, { actie: k, aantal: 0, laatste: null, niveaus: new Set(), actoren: new Set() });
      const v = m.get(k);
      v.aantal++;
      if (!v.laatste || r.at > v.laatste) v.laatste = r.at;
      v.niveaus.add(r.niveau || 'hand');
      v.actoren.add(r.actor);
    }
    return per;
  }

  const bewarenVoor = (soort) => {
    const b = BELEID.find(x => x.tak === soort.collectie);
    if (!b) {
      return { aard: 'aangegeven', bron: 'server/bewaarbeleid.js', termijn: null,
        uitleg: 'deze collectie staat niet in het bewaarbeleid; er is dus geen termijn waarop hij verloopt' };
    }
    return { aard: 'aangegeven', bron: 'server/bewaarbeleid.js', termijn: b.dagen,
      grond: b.grond, datumVeld: b.datum, label: b.label,
      uitleg: b.waarom };
  };

  /* Het beeld over alle soorten. Eén aanroep van graaf.randen(), want die doet
     de meting; hem hier overdoen zou een tweede antwoord op dezelfde vraag
     opleveren. */
  function kaart() {
    const randen = graaf.randen();
    const perSoort = uitJournaal();

    const soorten = register.SOORTEN.map(so => {
      const heen = randen.filter(r => r.van === so.type)
        .map(r => ({ veld: r.veld, naar: r.naar, deel: r.deel, aard: 'gemeten' }));
      const terug = randen.filter(r => r.naar === so.type)
        .map(r => ({ van: r.van, veld: r.veld, deel: r.deel, aard: 'gemeten' }));

      const mag = (runbooks && runbooks.RUNBOOKS ? runbooks.RUNBOOKS : [])
        .filter(rb => rb.type === so.type)
        .map(rb => ({ id: rb.id, naam: rb.naam, veld: rb.veld, actie: rb.actie, aard: 'aangegeven' }));

      const deed = [...(perSoort.get(so.type) || new Map()).values()]
        .sort((a, b) => b.aantal - a.aantal)
        .slice(0, 8)
        .map(v => ({ actie: v.actie, aantal: v.aantal, laatste: v.laatste,
          niveaus: [...v.niveaus], actoren: v.actoren.size, aard: 'gemeten' }));

      return {
        type: so.type, label: so.label, meervoud: so.meervoud, domein: so.domein,
        collectie: so.collectie, sleutel: so.sleutel,
        aantal: register.rijen(db, so).length,
        heen, terug, magSchrijven: mag, heeftGeschreven: deed,
        bewaren: bewarenVoor(so),
        /* AFGELEID: hoeveel rijen elders wijzen naar deze soort. Dat is wat er
           wees wordt als hij verdwijnt, en het is de enige zin waarin "wat
           hangt hiervan af" een getal heeft. */
        afhankelijk: { aard: 'afgeleid', soorten: terug.length,
          uitleg: terug.length
            ? terug.map(t => t.van).join(', ') + ' wijst hiernaar; die rijen worden wees als deze soort verdwijnt'
            : 'geen enkele gemeten verwijzing komt hier aan' }
      };
    });

    return {
      soorten,
      zonderTermijn: soorten.filter(x => !x.bewaren.termijn).map(x => x.type),
      zonderSchrijver: soorten.filter(x => !x.magSchrijven.length && !x.heeftGeschreven.length).map(x => x.type),
      aard: {
        gemeten: 'de verwijzingen komen uit de gegevens (dezelfde meting als de kwaliteitslaag en de kennisgraaf); ' +
          'de schrijvers onder "heeft geschreven" komen uit het journaal',
        aangegeven: 'wie MAG schrijven komt uit de runbookcatalogus, de bewaartermijn uit server/bewaarbeleid.js',
        afgeleid: 'wat er wees wordt is gerekend uit de gemeten verwijzingen'
      },
      blindeVlek: 'het journaal ziet alleen wat via RTG Command is gegaan. Een soort zonder schrijver hier ' +
        'betekent NIET dat er niemand in schrijft: de gewone app-routes en de leverancierskant lopen er niet ' +
        'doorheen. Gebruik deze lijst om te vragen waar iets vandaan komt, niet om te besluiten dat het weg kan.'
    };
  }

  /* Het spoor van één object: waar het naartoe wijst, wie ernaar wijst, wat er
     met dit exemplaar is gebeurd en wanneer het verloopt. */
  function spoor(type, id) {
    const so = register.OP_TYPE.get(String(type));
    if (!so) return { error: 'Onbekende soort: ' + type, status: 404 };
    const rij = register.vindRij(db, String(type), String(id));
    if (!rij) return { error: 'Niet gevonden: ' + type + ' ' + id, status: 404 };

    const buren = graaf.buren(String(type), String(id), rij);
    const b = bewarenVoor(so);
    let vervalt = null;
    if (b.termijn && b.datumVeld && rij[b.datumVeld]) {
      const t = Date.parse(rij[b.datumVeld]);
      if (!isNaN(t)) vervalt = new Date(t + b.termijn * 86400000).toISOString();
    }

    return {
      object: Object.assign({ type: String(type), id: s(rij[so.sleutel]) }, register.kort(so, rij)),
      wijstNaar: buren.filter(x => x.richting === 'naar'),
      wordtGenoemdDoor: buren.filter(x => x.richting === 'van'),
      journaal: journaal ? journaal.overObject(String(type), String(id)).slice(-20) : [],
      bewaren: Object.assign({}, b, { vervalt,
        let: b.termijn && !vervalt
          ? 'deze rij draagt geen bruikbare datum in het veld "' + b.datumVeld + '", dus de termijn kan er niet op worden toegepast'
          : null }),
      blindeVlek: 'het journaal hieronder bevat alleen wat via RTG Command is gegaan'
    };
  }

  return { kaart, spoor };
}

module.exports = { maakHerkomst };
