/* MENSEN BUITEN HET POTJE -- fase 5a uit SAMENLEVING.md.

   Tot nu toe was een mens een DEELNEMER van campagne X: hij bestond zolang het
   potje bestond en verdween ermee. Alleen zijn loopbaan bleef staan, en die is
   geschiedenis en geen persoon -- wie nooit een baan had, liet niets achter en
   bestond dus nergens.

   Vanaf hier geldt het omgekeerde:

     **Een potje GEBRUIKT een mens tijdelijk. Het BEZIT hem niet.**

   ================== WAT DIT WEL IS, EN WAT NIET ==================

   Dit register draagt de TOESTAND: hoe iemand ervoor stond toen we hem het
   laatst zagen. De GESCHIEDENIS staat in ./loopbaan.js en wordt hier niet
   gekopieerd -- twee registers met hetzelfde feit gaan uit elkaar lopen, en dan
   is de vraag "hoe lang werkte hij daar" op twee plekken beantwoord.

   HET IS GEEN INTENTIE EN GEEN GEDRAG. Er staat nergens wat iemand WIL of wat
   hij gaat DOEN; dat is fase 5b en 5c, en het hoort er pas bij als de toestand
   klopt. De volgorde is met opzet: persoon, dan toestand, dan geschiedenis, dan
   intentie, dan handeling -- en elke stap leunt op de vorige.

   EN HET SCHENKT NIETS. Dezelfde grens als bij ./loopbaan-profiel.js, want het
   is dezelfde grens: geschiedenis maakt deuren zichtbaar en schenkt geen waarde.
   Er staat hier geen bedrag, geen niveau en geen enkel getal waar de economie
   iets mee doet.

   ================== DE EEN VRAAG DIE HIJ WEL BEANTWOORDT ==================

   "Bestaat deze mens, en sinds wanneer?" Dat kon nog niemand zeggen. De
   loopbaan weet het pas als iemand gewerkt heeft; de ondernemerskring pas als
   hij een zaak had; de uitslagen tellen partijen en geen personen. Wie meespeelt
   en niets bijzonders doet, bestond nergens -- en dat is precies de mens die in
   campagne vier ineens leverancier blijkt te zijn.

   ================== WAT ER IN STAAT ==================

     sinds        de eerste campagne waarin we hem zagen
     laatst       de laatste
     campagnes    hoeveel er dat waren
     stand        hoe hij ervoor stond aan het EIND van die laatste campagne:
                  de rol die hij had, bij wie, in welk vak, en of hij een eigen
                  zaak had. Geen bedrag, geen omvang, geen resultaat.
     ondernemer   heeft hij ooit voor zichzelf gewerkt
     werkgever    heeft hij ooit iemand in dienst gehad

   `stand` IS EEN MOMENTOPNAME EN GEEN LOPENDE TOESTAND, en dat verschil is
   wezenlijk. Tussen twee campagnes werkt niemand ergens: de zaak waar hij werkte
   bestaat niet meer, want bedrijven blijven in het potje (VERHAAL.md par. 1).
   Wat blijft is hoe het ERVOOR STOND toen we hem het laatst zagen -- en dat is
   genoeg om te weten dat iemand bedrijfsleider is geweest.

   ================== DE POORT ==================

   Vanaf 16 (`werkMag`), dezelfde als de loopbaan. Een bewaarde persoon is
   bewaarde progressie; onder die grens blijft alles speelbaar en wordt er
   alleen niets van bewaard. */
'use strict';

module.exports = ({ db, save, codenaamVan, mag }) => {
  const alle = () => {
    if (!db.data.personen || typeof db.data.personen !== 'object') db.data.personen = {};
    return db.data.personen;
  };

  /* Wat er van EEN mens bekend is, of niets. Geeft `null` en niet een leeg
     object: het verschil tussen "die kennen we niet" en "die kennen we en er
     is niets gebeurd" is precies wat een scherm moet kunnen zeggen. */
  const van = (codenaam) => alle()[codenaam] || null;

  /* WIE ER IN DEZE STAD RONDLOPEN. Op volgorde van wanneer we ze voor het eerst
     zagen -- oudste eerst, zoals de ondernemerskring -- want dit is een
     geschiedenis en geen ranglijst. */
  const iedereen = () => Object.entries(alle())
    .map(([codenaam, p]) => Object.assign({ codenaam }, p))
    .sort((a, b) => a.volgnummer - b.volgnummer);

  /* HOE IEMAND ERVOOR STOND aan het eind van deze campagne. Uit de staat van het
     potje en niet uit een tweede administratie: het dienstverband en de
     vestiging staan er al, en een eigen kopie zou ernaast gaan lopen. */
  function standIn(potje, h) {
    const st = potje.staat || {};
    const eigen = ((st.vestigingen || {})[h] || []);
    const dienst = (st.diensten || []).find(d => d.werknemer === h && d.status === 'loopt');
    const zaak = dienst
      ? Object.values(st.vestigingen || {}).flat().find(v => v.id === dienst.vestiging)
      : null;
    return {
      /* Een eigen zaak gaat voor: wie onderneemt EN ergens in dienst is, is voor
         de buitenwereld ondernemer. */
      eigenZaken: eigen.length,
      sector: eigen.length ? eigen[0].sector : (zaak ? zaak.sector : null),
      rol: eigen.length ? 'eigenaar' : (dienst ? dienst.rol : null),
      werkgever: dienst ? codenaamVan(dienst.werkgever) : null
    };
  }

  /* NA EEN CAMPAGNE: iedereen die meedeed bestaat, en zijn stand is bijgewerkt.

     IDEMPOTENT via een vlag op het potje, net als ./uitslagen.js en
     ./loopbaan-noteren.js -- een partij kan maar een keer klaar zijn, en een
     tweede telling zou de campagneteller laten oplopen zonder dat er iets
     gebeurd is. */
  function noteerPersonen(potje) {
    if (!potje || potje.status !== 'klaar' || potje.personenGenoteerd) return null;
    potje.personenGenoteerd = true;
    const uit = [];
    for (const h of potje.spelers || []) {
      /* DE POORT PER PERSOON en niet per potje: in dezelfde partij kan de een
         wel en de ander niet bewaard worden. Dezelfde lezing als bij de
         loopbaan, en de enige die klopt. */
      if (!mag(h)) continue;
      const cn = codenaamVan(h);
      const l = alle();
      const p = (l[cn] = l[cn] || { volgnummer: Object.keys(l).length + 1,
        sinds: potje.id, campagnes: 0, ondernemer: false, werkgever: false, stand: null });
      p.laatst = potje.id;
      p.campagnes += 1;
      p.stand = standIn(potje, h);
      if (p.stand.eigenZaken > 0) p.ondernemer = true;
      /* WERKGEVERSCHAP IS EEN FEIT DAT BLIJFT. Ooit iemand in dienst gehad
         hebben zegt iets over een mens dat niet verdwijnt als die ander weggaat
         -- dezelfde asymmetrie als bij de loopbaan. */
      if ((potje.staat.diensten || []).some(d => d.werkgever === h)) p.werkgever = true;
      uit.push(cn);
    }
    save();
    return uit;
  }

  /* WAT ER GEBEURT ALS IEMAND STOPT. Hij verdwijnt, en dat is de hele regel --
     hier staat een PERSOON in en geen samenwerking, dus er is geen kant van een
     ander die zou blijven (vergelijk ./loopbaan.js, waar dat wel zo is). */
  function stoptErmee(codenaam) {
    const l = alle();
    const weg = !!l[codenaam];
    delete l[codenaam];
    save();
    return { weg };
  }

  return { van, iedereen, noteerPersonen, stoptErmee, alle, standIn };
};
