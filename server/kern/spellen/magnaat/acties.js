/* Magnaat: DE ACTIES -- wat een speler in de economie kan DOEN.

   Afgesplitst van ./economie.js op de naad die daar al lag. Dat bestand gaat
   over de WERELD: de klok, hoe een maand gerekend wordt, hoe een campagne
   eindigt. Dat verandert niet meer. Deze lijst verandert juist bij elke fase --
   contracten, veilingen, aandelen, leningen komen hier bij (GAMEHALL.md 12.9)
   -- en twee dingen met zo'n verschillend tempo horen niet in een bestand.

   TWEE SOORTEN ACTIE, en het onderscheid is de mechaniek waar Long Play op
   staat of valt (GAMEHALL.md 12.3):

     GROOT (open, uitbreiden, sluiten) hoort bij je beurt. Het verandert de
     kaart en het is nieuws voor de tafel.
     VRIJ (beleid) mag altijd. Prijs, personeel, marketing en onderhoud zijn
     jouw huishouding en gaan niemand aan.

   Zonder dat onderscheid staat een partij van zes met 24 uur per beurt zes
   dagen stil tussen twee van jouw handelingen. De descriptor draagt het via
   `buitenBeurt`; deze lijst is waar het waargemaakt wordt. */
const { SECTOREN } = require('./sectoren');
const { PRIJSSTANDEN, KOSTENSTAND } = require('./prijsstand');
const { afkoopsom } = require('./handel');
const { personeelNodig } = require('./stap');
const O = require('./onderzoek');

module.exports = ({ K, mijnVestiging, vrijKavel, rond }) => {
  /* Bij OPENEN is er nog geen vestiging om de techniek aan te hangen, dus geldt
     wat de speler ergens al heeft uitgerold. Een bouwmethode die je nergens
     toepast, verlaagt ook geen bouwsom. */
  const bouwkorting = (st, h) => {
    const alle = new Set((st.vestigingen[h] || []).flatMap(v => v.tech || []));
    return O.factor([...alle], 'bouw');
  };
  /* ---------- de acties ---------- */
  const ACTIES = {
    /* GROOT: een vestiging openen. Kost de bouwsom plus de eerste huur, en het
       kavel is daarna van jou zolang de partij loopt. */
    open(potje, h, zet) {
      const st = potje.staat, k = K(st);
      const kavelId = String(zet.kavel || '');
      if (!vrijKavel(st, kavelId, h))
        return { status: 400, error: 'Dat kavel is er niet, is al bezet, of er rust een bouwrecht van een ander op.' };
      const sector = String(zet.sector || '');
      if (!SECTOREN[sector]) return { status: 400, error: 'Die sector bestaat niet.' };
      const omvang = Math.max(4, Math.min(120, Math.floor(Number(zet.omvang) || 20)));
      const s = SECTOREN[sector];
      const kavel = k.kavel.get(kavelId);
      /* KOSTENSTAND ook op de BOUWSOM, en dat is de post die het langst is
         blijven liggen: een duur pand is kleiner voor dezelfde omzet, dus was
         het ook goedkoper te bouwen -- en dan verdient duur zich in vijf
         maanden terug en goedkoop in eenentwintig. Wie witte tafellakens wil,
         bouwt duurder per stoel. Zie ./sectoren.js. */
      const stand = PRIJSSTANDEN.includes(String(zet.prijs)) ? String(zet.prijs) : 'midden';
      // nieuwe bouwmethodes werken op wat je NOG gaat bouwen; zie ./onderzoek.js
      const bouwsom = Math.round(omvang * s.bouw * KOSTENSTAND[stand] * bouwkorting(st, h));
      const huur = rond(kavel.eigenschappen.huur * omvang * 0.55);
      if (st.geld[h] < bouwsom) return { status: 400, error: 'Openen kost ' + bouwsom + '; dat heb je niet.' };
      st.geld[h] -= bouwsom;
      const v = {
        id: 'v' + (++st.teller || (st.teller = 1)), kavel: kavelId, sector,
        naam: String(zet.naam || s.naam).slice(0, 40),
        // de startbezetting is precies wat er nodig is, uitgerekend door de
        // motor zelf (./stap.js) en niet nog een keer hier
        omvang, personeel: personeelNodig({ sector, omvang, prijs: stand, tech: [] }, 0),
        prijs: stand, marketing: 0, onderhoudBudget: rond(omvang * s.vast * KOSTENSTAND[stand] * 0.35),
        onderhoud: 100, reputatie: 50, huur, gebouwdVoor: bouwsom, maanden: 0
      };
      st.vestigingen[h].push(v);
      st.kavelBezet[kavelId] = h;
      // het bouwrecht is opgebruikt zodra er iets staat
      if (st.kavelRecht) delete st.kavelRecht[kavelId];
      return { status: 200, ok: true, id: v.id };
    },
    /* GROOT: uitbreiden. Zelfde prijs per eenheid als bouwen. */
    uitbreiden(potje, h, zet) {
      const st = potje.staat;
      const v = mijnVestiging(st, h, String(zet.id || ''));
      if (!v) return { status: 404, error: 'Die vestiging is niet van jou.' };
      const erbij = Math.max(1, Math.min(60, Math.floor(Number(zet.erbij) || 0)));
      if (v.omvang + erbij > 200) return { status: 400, error: 'Groter dan dit kan deze plek niet aan.' };
      const kosten = Math.round(erbij * SECTOREN[v.sector].bouw * KOSTENSTAND[v.prijs] * O.factor(v.tech, 'bouw'));
      if (st.geld[h] < kosten) return { status: 400, error: 'Uitbreiden kost ' + kosten + '; dat heb je niet.' };
      st.geld[h] -= kosten;
      v.omvang += erbij;
      v.gebouwdVoor += kosten;
      v.huur = rond(v.huur * (1 + erbij / (v.omvang - erbij)));
      return { status: 200, ok: true, omvang: v.omvang };
    },
    /* GROOT: sluiten. Levert de halve bouwsom op en geeft het kavel vrij.

       EEN ZAAK MET CONTRACTEN SLUIT JE NIET GRATIS. Wie een vestiging weghaalt
       waarop verplichtingen rusten, koopt ze op datzelfde moment af tegen de
       gewone afkoopsom -- naar de wederpartij, precies zoals bij opzeggen. Zo
       is sluiten geen achterdeur uit een contract, en blijft er nooit een
       verplichting achter die aan een vestiging hangt die niet meer bestaat.
       Dat laatste is geen nettigheid: een levering van een verdwenen zaak zou
       elke maand een boete opleveren zonder dat iemand er nog iets aan kan
       doen, en dat is een val en geen keuze. */
    sluiten(potje, h, zet) {
      const st = potje.staat;
      const v = mijnVestiging(st, h, String(zet.id || ''));
      if (!v) return { status: 404, error: 'Die vestiging is niet van jou.' };
      const raakt = (st.contracten || []).filter(c => c.status === 'loopt'
        && (c.leverancierId === v.id || c.afnemerId === v.id));
      const afkoop = raakt.reduce((n, c) => n + afkoopsom(c, st.maand), 0);
      const opbrengst = rond(v.gebouwdVoor * 0.5);
      if (st.geld[h] + opbrengst < afkoop)
        return { status: 400, error: 'Er lopen contracten op deze vestiging; afkopen kost ' + afkoop + '.' };
      st.geld[h] += opbrengst;
      for (const c of raakt) {
        const som = afkoopsom(c, st.maand);
        const tegen = c.leverancier === h ? c.afnemer : c.leverancier;
        st.geld[h] -= som;
        st.geld[tegen] += som;
        c.status = 'afgekocht';
        c.eindMaand = st.maand;
        c.afkoop = som;
      }
      st.vestigingen[h] = st.vestigingen[h].filter(x => x !== v);
      delete st.kavelBezet[v.kavel];
      return { status: 200, ok: true, afgekocht: raakt.length, afkoop };
    },
    /* VRIJ: de knoppen waar je altijd aan mag draaien. Ze staan in EEN actie
       omdat ze allemaal hetzelfde doen -- een getal op een vestiging zetten --
       en vier bijna gelijke acties zijn vier plekken om een grens te vergeten. */
    beleid(potje, h, zet) {
      const st = potje.staat;
      const v = mijnVestiging(st, h, String(zet.id || ''));
      if (!v) return { status: 404, error: 'Die vestiging is niet van jou.' };
      const s = SECTOREN[v.sector];
      if (zet.prijs !== undefined) {
        if (!PRIJSSTANDEN.includes(String(zet.prijs))) return { status: 400, error: 'Onbekende prijsstand.' };
        v.prijs = String(zet.prijs);
      }
      if (zet.personeel !== undefined) {
        const n = Math.max(0, Math.min(400, Math.floor(Number(zet.personeel) || 0)));
        /* Aannemen kost meteen een maandloon aan werving; ontslaan kost een
           maandloon aan afvloeiing. Zonder die drempel is personeel een
           schuifbalk die je elke maand heen en weer zet. */
        const verschil = Math.abs(n - v.personeel);
        const kosten = verschil * s.loon;
        if (st.geld[h] < kosten) return { status: 400, error: 'Die wijziging kost ' + kosten + ' aan werving of afvloeiing.' };
        st.geld[h] -= kosten;
        v.personeel = n;
      }
      if (zet.marketing !== undefined) v.marketing = Math.max(0, Math.min(200000, Math.floor(Number(zet.marketing) || 0)));
      if (zet.onderhoud !== undefined) v.onderhoudBudget = Math.max(0, Math.min(200000, Math.floor(Number(zet.onderhoud) || 0)));
      if (zet.naam !== undefined) v.naam = String(zet.naam).slice(0, 40);
      return { status: 200, ok: true };
    }
  };
  const VRIJE_ACTIES = ['beleid'];

  return { ACTIES, VRIJE_ACTIES };
};
