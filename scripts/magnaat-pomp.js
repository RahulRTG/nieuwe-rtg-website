#!/usr/bin/env node
/* DE GELDPOMP-KEURING: kan een speler waarde maken uit niets?

   Dit is de derde meter naast `magnaat-balans.js` (verdient een sector zichzelf
   terug) en `magnaat-strateeg.js` (domineert er een stijl). Hij stelt EEN
   vraag, en het is een vraag die de andere twee per definitie niet stellen:

     KAN EEN SPELER EEN MECHANIEK UITBUITEN DOOR GELD ROND TE POMPEN
     ZONDER ENIGE ECONOMISCHE WAARDE TE SCHEPPEN?

   HIJ BESTAAT OMDAT DIE FOUT ER AL EEN KEER IN ZAT, en hij is met opzet
   gebouwd voordat de lagen komen waar hij het hardst nodig is. In fase B bleek
   dat de contractomzet van speler A bij speler B meetelde in de omzet van de
   STAD -- en die omzet voedt de Foundation-pot. Twee spelers hadden elkaar dus
   miljoenen kunnen factureren om samen een bibliotheek af te dwingen die
   niemand had verdiend. Geen toets zag dat; geen sectorbalans zag dat; het
   toernooi zag het niet, want beide spelers wonnen er evenveel bij.

   DE KLASSE KOMT TERUG. Elke laag die geld VERPLAATST in plaats van te
   VERDIENEN is een nieuwe kans op dezelfde fout: leningen (rente die ergens
   verdwijnt of uit het niets komt), deelnemingen (dezelfde euro bij twee
   mensen), verzekeringen (een uitkering zonder premie), interne concerns
   (jezelf betalen) en straks R&D-subsidies. Vandaar dat dit een METER is en
   geen losse toets: er komt een scenario bij zodra er een laag bij komt.

   HOE HIJ MEET, en dit is de hele truc: TWEE IDENTIEKE WERELDEN. Dezelfde
   stad, dezelfde kavels, dezelfde bedrijven, dezelfde maanden. In de ene doen
   de spelers niets bijzonders; in de andere pompen ze zo hard als de regels
   toelaten. Daarna wordt het TOTALE vermogen aan tafel vergeleken, plus de
   Foundation-pot -- want die is ook een uitgang.

   Een pomp die niets oplevert geeft twee gelijke getallen. Elke afwijking
   boven de meetruis is per definitie waarde die uit het niets kwam of stilletjes
   verdween, en allebei is fout: geld dat verdwijnt is net zo goed een bug, want
   dan straft een mechaniek je voor iets wat hij niet zou moeten kosten.

   WAT HIJ NIET IS: een bewijs dat er geen exploits zijn. Hij toetst de
   scenario's die erin staan. Een pomp die niemand heeft bedacht staat er niet
   in, en dat is de eerlijke grens van deze meter.

   Gebruik: node scripts/magnaat-pomp.js */
'use strict';
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});

/* De wereld waarin gepompt wordt: drie spelers, drie bedrijven die op elkaar
   passen (een vervoerder, een winkel en een restaurant), en ruim geld. Ruim,
   want een pomp die stukloopt op een lege kas meet niets. */
function wereld() {
  const m = maakMagnaat();
  const spelers = ['a', 'b', 'c'];
  const potje = { id: 'p', soort: 'magnaat', spelers, teams: [0, 1, 2], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' } };
  m.spel.init(potje);
  const st = potje.staat;
  const k = kaart(st.stad);
  const kavel = (zone, n) => k.kavels.filter(x => x.zone === zone && !st.kavelBezet[x.id])[n || 0];
  for (const h of spelers) st.geld[h] = 20000000;
  m.spel.zet(potje, 'a', { actie: 'open', kavel: kavel('terrein').id, sector: 'logistiek', omvang: 20, naam: 'Atlas' });
  m.spel.zet(potje, 'b', { actie: 'open', kavel: kavel('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  m.spel.zet(potje, 'c', { actie: 'open', kavel: kavel('centrum').id, sector: 'retail', omvang: 40, naam: 'Winkel' });
  return { m, potje, st, spelers,
    A: st.vestigingen.a[0], B: st.vestigingen.b[0], C: st.vestigingen.c[0] };
}

const maand = (w, n) => {
  for (let i = 0; i < n; i++) {
    w.st.gerekendTot -= w.st.maandMs;
    for (const verslag of w.m.eco.bijrekenen(w.potje)) {
      /* WAT DE WERELD VERLAAT, per soort. Rente gaat naar een bank, premie naar
         een verzekeraar, en schade is domweg vernietigd -- geen van drieen komt
         bij een speler terecht. Een uitkering staat er NIET bij: die herstelt
         alleen, en hij is al van de schadepost afgetrokken (../server/kern/
         spellen/magnaat/maand.js). */
      w.rente = (w.rente || 0) + (verslag.rentelast || 0)
        + (verslag.premielast || 0) + (verslag.schadelast || 0) + (verslag.onderzoeklast || 0);
    }
  }
};

/* Wat er aan tafel IS. Alles bij elkaar: de kassen, de bedrijven, en de
   Foundation-pot -- die laatste hoort erbij omdat hij een uitgang is en niet
   een decoratie. Zou hij er niet in zitten, dan is "geld naar de Foundation
   pompen" geen pomp maar een verdwijntruc die deze meter niet ziet. */
function totaal(w) {
  const { PROJECTEN } = require('../server/kern/spellen/magnaat/foundation');
  const stand = w.m.eco.eindstand(w.potje);
  const vermogen = stand.reduce((n, x) => n + x.vermogen, 0);
  /* De pot EN wat er al uit gebouwd is. Zonder dat tweede lekt deze meter zelf:
     geld dat de Foundation uitgeeft verdwijnt dan uit het totaal, en elk
     scenario dat de pot voedt lijkt waarde te vernietigen. Dat was de eerste
     fout van deze meter, en hij kwam er meteen bij de eerste ronde uit. */
  const gebouwd = w.st.foundation.gedaan.reduce((n, g) =>
    n + ((PROJECTEN.find(x => x.id === g.id) || {}).kosten || 0), 0);
  const pot = w.st.foundation.lokaal + w.st.foundation.centraal + gebouwd;
  return { vermogen: Math.round(vermogen), pot: Math.round(pot), samen: Math.round(vermogen + pot) };
}

/* ---------- de scenario's ----------
   Elk scenario krijgt een verse wereld en mag erin doen wat het wil. De
   `rust`-variant doet niets; het verschil tussen die twee IS de meting. */
const SCENARIOS = {
  rust: { naam: 'niets bijzonders doen (de nulmeting)', doe() {} },

  /* Twee spelers factureren elkaar een absurd bedrag over en weer. Netto
     verandert er niets aan hun onderlinge positie -- maar als een van die
     bedragen ergens meetelt als bedrijvigheid, groeit de wereld ervan. */
  wederzijdseFacturen: {
    verwacht: 'neutraal', naam: 'elkaar over en weer miljoenen factureren',
    doe(w) {
      // b koopt vervoer van a, a koopt goederen van c, c koopt vervoer van a
      teken(w, 'b', w.B.id, w.A.id, 'vervoer', { eenheden: 200, bedrag: 2000000 });
      teken(w, 'a', w.A.id, w.C.id, 'goederen', { eenheden: 500, bedrag: 2000000 });
      teken(w, 'c', w.C.id, w.A.id, 'vervoer', { eenheden: 200, bedrag: 2000000 });
    }
  },

  /* Een belang heen en weer verkopen tegen een absurde prijs. Als de waarde van
     een deelneming bij BEIDE partijen meetelt, groeit het totaal bij elke
     ronde -- en dat is de klassieke fout in een laag die waarde verplaatst. */
  belangenCarrousel: {
    verwacht: 'neutraal', naam: 'een belang heen en weer verkopen',
    doe(w) {
      for (const [van, naar, ves] of [['b', 'a', w.A.id], ['c', 'b', w.B.id], ['a', 'c', w.C.id]]) {
        const r = w.m.spel.zet(w.potje, van, { actie: 'belang-voorstel', vestiging: ves, deel: 45, prijs: 3000000 });
        if (r.ok) w.m.spel.zet(w.potje, naar, { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' });
      }
    }
  },

  /* Een zaak veilen aan een medespeler voor een absurd bedrag. Het geld gaat
     van de een naar de ander en de zaak de andere kant op; het totaal hoort
     gelijk te blijven. Zo niet, dan is de waardering van een verkochte zaak
     ergens dubbel geteld. */
  veilingcarrousel: {
    verwacht: 'neutraal', naam: 'een bedrijf onderling doorverkopen voor een fantasieprijs',
    doe(w) {
      const v = w.m.spel.zet(w.potje, 'a', { actie: 'veiling-start', soort: 'vestiging', vestiging: w.A.id, duur: 'kort' });
      if (v.ok) w.m.spel.zet(w.potje, 'b', { actie: 'veiling-bod', id: v.id, bedrag: 5000000 });
    }
  },

  /* Grond kopen van jezelf: de inzetter van een kavelveiling mag er niets aan
     verdienen, en de opbrengst gaat naar de Foundation. Wie op zijn eigen
     inzet biedt en wint, hoort dus gewoon armer te zijn. */
  eigenGrond: {
    verwacht: 'kostend', naam: 'op je eigen kavelveiling bieden',
    doe(w) {
      const k = kaart(w.st.stad).kavels.find(x => !w.st.kavelBezet[x.id]);
      const v = w.m.spel.zet(w.potje, 'a', { actie: 'veiling-start', soort: 'kavel', kavel: k.id, duur: 'kort' });
      if (v.ok) w.m.spel.zet(w.potje, 'a', { actie: 'veiling-bod', id: v.id, bedrag: 4000000 });
    }
  },

  /* LENEN EN NIETS DOEN. Het geld komt binnen, de rente loopt, en verder
     gebeurt er niets. Het totaal HOORT te zakken -- precies met de rente die
     betaald is en met niets anders. Dat is de scherpste toets die er op een
     financieringslaag te doen valt: geen geld uit het niets bij het opnemen,
     en geen geld dat zoekraakt bij het aflossen. */
  lenenEnStilzitten: {
    verwacht: 'lekkend', naam: 'lenen en het geld laten staan',
    doe(w) {
      for (const h of ['a', 'b', 'c'])
        w.m.spel.zet(w.potje, h, { actie: 'krediet-opnemen', soort: 'investering',
          bedrag: 300000, looptijd: 48 });
    }
  },

  /* Lenen en meteen aflossen, in een lus. Als opnemen en aflossen niet exact
     tegen elkaar wegvallen, is dit een machine -- en het is precies het soort
     lus dat een speler binnen een uur vindt. */
  leenCarrousel: {
    verwacht: 'lekkend', naam: 'lenen en meteen weer aflossen, keer op keer',
    doe(w) {
      for (let i = 0; i < 5; i++) {
        const r = w.m.spel.zet(w.potje, 'a', { actie: 'krediet-opnemen', soort: 'werkkapitaal',
          bedrag: 200000, looptijd: 6 });
        if (!r.ok) break;
        w.m.spel.zet(w.potje, 'a', { actie: 'krediet-aflossen', id: r.id, bedrag: 200000 });
      }
    }
  },

  /* ONDERLINGE FINANCIERING. Twee spelers lenen allebei bij de bank en kopen
     met dat geld een belang in elkaars zaak. Er stroomt geld rond tussen twee
     spelers EN er komt schuld bij; als een van beide kanten ergens dubbel telt,
     blaast dit het systeem op. */
  kruisfinanciering: {
    verwacht: 'lekkend', naam: 'lenen en met dat geld een belang in elkaar kopen',
    doe(w) {
      for (const h of ['a', 'b'])
        w.m.spel.zet(w.potje, h, { actie: 'krediet-opnemen', soort: 'investering',
          bedrag: 250000, looptijd: 48 });
      for (const [koper, doel] of [['a', w.B.id], ['b', w.A.id]]) {
        const r = w.m.spel.zet(w.potje, koper, { actie: 'belang-voorstel', vestiging: doel,
          deel: 40, prijs: 250000 });
        if (r.ok) {
          const d = w.st.deelnemingen.find(x => x.id === r.id);
          w.m.spel.zet(w.potje, d.eigenaar, { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' });
        }
      }
    }
  },

  /* HERFINANCIEREN. Een lopende lening herzien verlengt hem en maakt hem duurder;
     het nettovermogen hoort daar geen cent van te merken op het moment zelf. */
  herfinanciering: {
    verwacht: 'lekkend', naam: 'een lening herzien',
    doe(w) {
      const r = w.m.spel.zet(w.potje, 'a', { actie: 'krediet-opnemen', soort: 'investering',
        bedrag: 400000, looptijd: 36 });
      if (r.ok) w.m.spel.zet(w.potje, 'a', { actie: 'krediet-herzien', id: r.id, maanden: 24 });
    }
  },

  /* DE ONDERPANDSPIRAAL. Leen tegen een pand, en kijk of je daarmee tegen
     datzelfde pand MEER kunt lenen. Als die lus niet begrensd is, financiert een
     speler zichzelf omhoog zonder ooit iets te verkopen.

     LET OP DE VORM VAN DEZE TOETS. Hij vergelijkt GEEN totalen, en dat is een
     correctie: de eerste versie liet de speler het geleende geld ook uitgeven,
     en dan bouwt hij echte panden die echt geld verdienen -- dan meet je of
     lenen werkt en niet of het lekt. Wat hier gemeten wordt is de LEENRUIMTE
     zelf: die mag niet groeien van het lenen. */
  onderpandspiraal: {
    verwacht: 'economisch', naam: 'lenen tegen een pand en kijken of je ruimte groeit',
    doe(w) {
      const zaak = w.m.eco.zicht(w.potje, w.st, 'a').vestigingen[0];
      w.ruimteVoor = zaak.waarde;
      const r = w.m.spel.zet(w.potje, 'a', { actie: 'krediet-opnemen', soort: 'vastgoed',
        bedrag: Math.floor(zaak.waarde * 0.5), looptijd: 120, vestiging: zaak.id });
      w.geleend = r.ok;
      w.zaakId = zaak.id;
    },
    keur(w) {
      if (!w.geleend) return 'er kon niets geleend worden; deze toets meet dan niets';
      const zaak = w.m.eco.zicht(w.potje, w.st, 'a').vestigingen.find(v => v.id === w.zaakId);
      if (!zaak) return null;
      /* De waarde van het pand mag stijgen doordat het GELD VERDIENT -- dat is
         de economie. Wat niet mag is dat hij stijgt door de lening zelf. Dus:
         meteen na het opnemen, zonder dat er een maand voorbij is. */
      if (zaak.waarde > w.ruimteVoor)
        return 'lenen tegen een pand maakte datzelfde pand meer waard: ' +
          w.ruimteVoor + ' -> ' + zaak.waarde;
      return null;
    }
  },

  /* DE HEFBOOMLADDER: lenen, bouwen, en met de hogere waardering opnieuw lenen.
     Ook hier geen totalenvergelijking maar een BEGRENZING -- wie leent en
     bouwt, bouwt echte bedrijven die echt geld verdienen, en dat hoort te
     lonen. Wat niet mag is dat het KREDIETPLAFOND wegloopt: dan is de ladder
     oneindig en is lenen geen keuze meer maar de enige zet. */
  hefboomladder: {
    verwacht: 'economisch', naam: 'lenen, bouwen, en met de hogere waardering opnieuw lenen',
    doe(w) {
      const k = kaart(w.st.stad);
      w.hefbomen = [];
      for (let ronde = 0; ronde < 8; ronde++) {
        const beeld = w.m.eco.zicht(w.potje, w.st, 'a');
        const o = beeld.financiering.offertes.find(x => x.soort === 'investering');
        if (!o || o.max < 50000) break;
        if (!w.m.spel.zet(w.potje, 'a', { actie: 'krediet-opnemen', soort: 'investering',
          bedrag: o.max, looptijd: 96 }).ok) break;
        const vrij = k.kavels.find(x => !w.st.kavelBezet[x.id] && x.zone === 'boulevard');
        if (!vrij) break;
        w.m.spel.zet(w.potje, 'a', { actie: 'open', kavel: vrij.id, sector: 'horeca', omvang: 40 });
        w.st.gerekendTot -= w.st.maandMs;
        for (const v of w.m.eco.bijrekenen(w.potje))
          w.rente = (w.rente || 0) + (v.rentelast || 0) + (v.premielast || 0)
            + (v.schadelast || 0) + (v.onderzoeklast || 0);
        const na = w.m.eco.eindstand(w.potje).find(x => x.codenaam === 'a');
        w.hefbomen.push(na.schuld / Math.max(1, na.geld + na.waarde));
      }
    },
    keur(w) {
      if (!w.hefbomen || !w.hefbomen.length) return 'er is niets geleend; deze toets meet dan niets';
      const hoogste = Math.max(...w.hefbomen);
      /* Drie keer je bezittingen aan schuld is al veel; een weggelopen plafond
         levert een veelvoud daarvan op en is zo herkenbaar zonder dat deze
         grens een balansknop wordt. */
      if (hoogste > 3) return 'de schuld liep op tot ' + hoogste.toFixed(1) +
        ' keer de bezittingen; het kredietplafond loopt weg';
      return null;
    }
  },

  /* OVERVERZEKEREN. De speler koopt de duurste dekking die er te koop is op
     alles wat hij heeft. Dat HOORT geld te kosten -- premie draagt een opslag
     boven de verwachte schade -- en het mag onder geen beding winstgevend zijn.

     Dit is de pomproute die er bij een verzekeringslaag als eerste in zit: een
     uitkering die boven de aantoonbare schade uitkomt, is geld uit het niets, en
     dan is een brand een verdienmodel. */
  oververzekeren: {
    verwacht: 'lekkend', naam: 'alles maximaal verzekeren',
    doe(w) {
      const R = require('../server/kern/spellen/magnaat/risico');
      for (const h of ['a', 'b', 'c'])
        for (const v of w.st.vestigingen[h])
          for (const risico of R.RISICOLIJST)
            w.m.spel.zet(w.potje, h, { actie: 'polis-sluiten', vestiging: v.id, risico,
              dekking: 1, eigenRisico: 0, maximum: 20000000 });
    }
  },

  /* VERZEKEREN EN METEEN OPZEGGEN, in een lus. Als opzeggen ergens een premie
     terugdraait die al geboekt was, is dit een machine. */
  poliscarrousel: {
    verwacht: 'lekkend', naam: 'polissen sluiten en meteen weer opzeggen',
    doe(w) {
      const R = require('../server/kern/spellen/magnaat/risico');
      for (let i = 0; i < 4; i++)
        for (const risico of R.RISICOLIJST) {
          const r = w.m.spel.zet(w.potje, 'a', { actie: 'polis-sluiten',
            vestiging: w.A.id, risico, dekking: 1, eigenRisico: 0, maximum: 20000000 });
          if (r.ok) w.m.spel.zet(w.potje, 'a', { actie: 'polis-opzeggen', id: r.id });
        }
    }
  },

  /* ONDERZOEK DOEN EN NIETS UITROLLEN. Het geld is weg en er komt niets voor
     terug -- kennis die je niet toepast, verandert geen enkel getal. Dat hoort
     precies de investering te kosten en geen cent minder. */
  onderzoekZonderUitrol: {
    verwacht: 'lekkend', naam: 'onderzoeken en het nooit toepassen',
    doe(w) {
      for (const h of ['a', 'b', 'c'])
        w.m.spel.zet(w.potje, h, { actie: 'onderzoek-starten', sleutel: 'meten', budget: 8000 });
    }
  },

  /* DE SUBSIDIE. Geld uit de Foundation-pot naar een onderzoek: een OVERDRACHT
     en geen schepping. Dat is precies wat "een subsidie is een externe injectie
     en geen bedrijfsprestatie" betekent zodra je het meet in plaats van
     opschrijft.

     HIJ VERGELIJKT GEEN TOTALEN OVER TWEE JAAR, en dat is een correctie. Een
     pot met minder geld bouwt een ANDER project, en dan meet je welke
     bibliotheek er is gekomen in plaats van of de subsidie klopt. De bewering
     gaat over het moment zelf: wat de pot verlaat, komt aan bij het onderzoek --
     en wat er van over is, gaat terug. */
  subsidiestroom: {
    verwacht: 'economisch', naam: 'onderzoek laten meebetalen door de Foundation',
    doe(w) {
      w.potVoor = w.st.foundation.lokaal;
      w.kasVoor = w.st.geld.a;
      const r = w.m.spel.zet(w.potje, 'a', { actie: 'onderzoek-starten', sleutel: 'meten', budget: 4000 });
      if (!r.ok) return;
      w.gekregen = w.m.spel.zet(w.potje, 'a', { actie: 'onderzoek-subsidie', id: r.id });
      w.onderzoekId = r.id;
    },
    keur(w) {
      if (!w.gekregen || !w.gekregen.ok) return 'er is geen subsidie verleend; deze toets meet dan niets';
      const o = (w.st.onderzoek || []).find(x => x.id === w.onderzoekId);
      const uitPot = w.potVoor - w.st.foundation.lokaal;
      /* Zolang het onderzoek loopt: wat de pot verliet zit in de subsidiepot van
         dit onderzoek en nergens anders. De kas van de speler is er GEEN cent
         van gegroeid -- een subsidie is geen uitkering. */
      if (o.status === 'loopt') {
        if (Math.abs(uitPot - (o.subsidieToegekend || 0)) > 1)
          return 'de pot verloor ' + Math.round(uitPot) + ' en het onderzoek kreeg ' + o.subsidieToegekend;
        if (w.st.geld.a > w.kasVoor)
          return 'de subsidie kwam in de KAS van de speler terecht; dat is een uitkering en geen subsidie';
      } else {
        /* En als het klaar is: alles wat niet aan onderzoek is opgegaan, is
           teruggegaan naar de pot. Geoormerkt geld dat blijft liggen mag niet
           verdampen -- dat is net zo goed een fout als geld dat erbij komt. */
        const opgegaan = o.subsidie || 0, terug = o.subsidieTerug || 0;
        if (Math.abs((o.subsidieToegekend || 0) - opgegaan - terug) > 1)
          return 'van ' + o.subsidieToegekend + ' subsidie is ' + Math.round(opgegaan) +
            ' besteed en ' + Math.round(terug) + ' teruggegaan; de rest is verdampt';
      }
      return null;
    }
  },

  /* Bouwen en meteen weer sluiten, in een lus. Sluiten levert de halve bouwsom
     op, dus dit HOORT geld te kosten -- maar als de waardering van een pand
     ergens boven de bouwsom uitkomt, is dit een machine. */
  bouwenEnSluiten: {
    verwacht: 'kostend', naam: 'bouwen en meteen weer sluiten',
    doe(w) {
      const k = kaart(w.st.stad);
      for (let i = 0; i < 6; i++) {
        const vrij = k.kavels.find(x => !w.st.kavelBezet[x.id] && x.zone === 'boulevard');
        if (!vrij) break;
        const r = w.m.spel.zet(w.potje, 'a', { actie: 'open', kavel: vrij.id, sector: 'horeca', omvang: 20 });
        if (r.ok) w.m.spel.zet(w.potje, 'a', { actie: 'sluiten', id: r.id });
      }
    }
  }
};

/* Een contract tekenen zonder erover te doen: dit script meet geen
   onderhandeling maar geldstromen. */
function teken(w, van, mijn, hun, soort, x) {
  const r = w.m.spel.zet(w.potje, van, Object.assign({ actie: 'contract-voorstel', mijn, hun, soort,
    looptijd: 24, eis: 0, boete: 1, vooraf: 0, exclusief: false }, x));
  if (!r.ok) return null;
  const eigenaar = w.st.contracten.find(c => c.id === r.id);
  const ander = eigenaar.leverancier === van ? eigenaar.afnemer : eigenaar.leverancier;
  w.m.spel.zet(w.potje, ander, { actie: 'contract-antwoord', id: r.id, antwoord: 'ja' });
  return eigenaar;
}

/* De meting: hetzelfde aantal maanden, dezelfde wereld, een keer met en een
   keer zonder de pomp. */
function meet(sleutel, maanden = 24) {
  const uit = {};
  let klacht = null;
  for (const naam of ['rust', sleutel]) {
    const w = wereld();
    maand(w, 2);                 // eerst wat echte economie, zodat er cijfers zijn
    SCENARIOS[naam].doe(w);
    /* De EIGEN keuring van een scenario draait meteen na de handeling, want
       sommige beweringen gaan over het moment zelf ("lenen mag je pand niet
       meer waard maken") en niet over de eindstand. */
    if (naam === sleutel && SCENARIOS[naam].keur) klacht = SCENARIOS[naam].keur(w);
    maand(w, maanden);
    if (naam === sleutel && !klacht && SCENARIOS[naam].keur) klacht = SCENARIOS[naam].keur(w);
    uit[naam === 'rust' ? 'rust' : 'pomp'] = totaal(w);
    uit[(naam === 'rust' ? 'rust' : 'pomp') + 'Rente'] = w.rente || 0;
  }
  /* Bij een LEKKENDE laag wordt het verschil gecorrigeerd met wat er aan rente
     de wereld verliet. Wat overblijft hoort nul te zijn: dan is er geen euro
     bijgekomen en geen euro zoekgeraakt buiten het lek dat we kennen. */
  const lek = (uit.pompRente || 0) - (uit.rustRente || 0);
  const ruw = uit.pomp.samen - uit.rust.samen;
  const verschil = SCENARIOS[sleutel].verwacht === 'lekkend' ? ruw + lek : ruw;
  return { naam: SCENARIOS[sleutel].naam, rust: uit.rust, pomp: uit.pomp, ruw, lek, verschil, klacht,
    relatief: uit.rust.samen ? verschil / uit.rust.samen : 0 };
}

/* HOEVEEL AFWIJKING IS RUIS? Niet nul: een contract verlegt echte capaciteit,
   dus de economie loopt werkelijk anders en dat MAG. Wat niet mag is dat er
   waarde bijkomt in de orde van de bedragen die er rondgepompt worden. De
   grens staat op een half procent van het totaal aan tafel -- ruim genoeg voor
   het effect van een verlegde levering, veel te krap voor een pomp van
   miljoenen. */
const RUIS = 0.005;
/* BIJ EEN LEKKENDE LAAG IS DE EIS SCHERPER, en dat is met opzet: daar is er
   geen ruis om achter te schuilen. Rente verlaat de wereld met een exact
   bedrag, en dat bedrag is bekend -- dus na aftrek hoort er NUL over te blijven,
   niet "iets binnen een half procent". Wat er nog wel in mag zitten is
   afrondingsruis over een paar honderd geboekte regels, en dat is een handvol
   euro's en geen bedrag dat een speler kan gebruiken. */
const EXACT = 25;

/* TWEE SOORTEN SCENARIO, en het onderscheid is nodig omdat "het totaal
   verandert" niet altijd fout is.

     NEUTRAAL -- een pure overdracht. Er gaat geld van A naar B en verder
     gebeurt er niets. Hier is ELKE afwijking fout, omhoog en omlaag: omhoog is
     waarde uit het niets, omlaag is geld dat onderweg verdwijnt.
     KOSTEND  -- een handeling die met opzet waarde vernietigt (een pand slopen,
     grond kopen die je al kon gebruiken). Zakken mag; STIJGEN nooit.
     LEKKEND  -- een laag waar geld de WERELD verlaat en niet bij een speler
     landt. Rente is daar de eerste van: die gaat naar een bank die geen speler
     is en komt nooit terug. Zonder deze categorie keurt de meter financiering
     af omdát hij werkt, en dan meet hij zijn eigen blinde vlek. Wat hier
     getoetst wordt is dat het lek PRECIES de rentelast is -- geen euro meer en
     geen euro minder, want dat zou betekenen dat er onderweg iets bij komt of
     verdwijnt dat niemand heeft geboekt. */

function keur() {
  const klachten = [];
  const rijen = [];
  for (const sleutel of Object.keys(SCENARIOS)) {
    if (sleutel === 'rust') continue;
    const r = meet(sleutel);
    rijen.push(Object.assign({ sleutel }, r));
    const soort = SCENARIOS[sleutel].verwacht || 'neutraal';
    if (r.klacht) { klachten.push(sleutel + ': ' + r.klacht); continue; }
    /* ECONOMISCH: het scenario doet echte dingen (bouwen, uitbreiden) en de
       totalen zijn dus niet vergelijkbaar -- lenen om te bouwen HOORT waarde op
       te leveren, anders is lenen zinloos. Zo'n scenario draagt zijn eigen
       bewering in `keur` en wordt hier overgeslagen. */
    if (soort === 'economisch') continue;
    // een kostend scenario mag zakken; een neutraal en een lekkend scenario niet
    const fout = soort === 'kostend' ? r.relatief > RUIS
      : soort === 'lekkend' ? Math.abs(r.verschil) > EXACT
      : Math.abs(r.relatief) > RUIS;
    if (fout)
      klachten.push(sleutel + ': ' + r.naam + ' verandert het totaal met ' +
        (r.relatief * 100).toFixed(2) + '% (' + Math.round(r.verschil) + ')' +
        (soort === 'kostend' ? ' -- omlaag mag hier, omhoog niet'
          : soort === 'lekkend' ? ' -- de rentelast is er al af gerekend, dus dit hoort nul te zijn' : ''));
  }
  return { rijen, klachten };
}

if (require.main === module) {
  console.log('Magnaat-geldpomp: kan een speler waarde maken uit niets?\n');
  const { rijen, klachten } = keur();
  console.log('scenario              | soort    | totaal in rust | met de pomp |   verschil |  %');
  for (const r of rijen)
    console.log(r.sleutel.padEnd(21) + ' | ' + (SCENARIOS[r.sleutel].verwacht || 'neutraal').padEnd(8) +
      ' | ' + String(r.rust.samen).padStart(14) + ' | ' +
      String(r.pomp.samen).padStart(11) + ' | ' + String(Math.round(r.verschil)).padStart(10) + ' | ' +
      ((SCENARIOS[r.sleutel].verwacht === 'economisch') ? '     -' : (r.relatief * 100).toFixed(2).padStart(6)));
  console.log('\n' + (klachten.length
    ? 'AFGEKEURD -- hier komt waarde uit het niets:\n  ' + klachten.join('\n  ')
    : 'geen enkel scenario maakt waarde uit het niets\n  neutraal en kostend: marge ' +
      (RUIS * 100) + '%   lekkend: op ' + EXACT + ' euro afrondingsruis na exact nul'));
  if (klachten.length) process.exitCode = 1;
}

module.exports = { SCENARIOS, meet, keur, wereld, totaal, RUIS, EXACT };
