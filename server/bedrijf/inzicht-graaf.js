/* Werkruimte-inzicht, deelbestand "graaf": de VORM van het geheel.

   ./inzicht.js gaat over ZOEKEN en over het DOSSIER van een object: geef me
   alles wat bij dit ding hoort. Dit bestand kijkt een niveau hoger -- niet naar
   een object maar naar de verhoudingen tussen de soorten.

   TWEE ANTWOORDEN, EN HET VERSCHIL ERTUSSEN IS DE HELE WINST:

     samenhang  de kaart. Welke soorten er zijn en welke naar elkaar verwijzen.
     wandel     wat ligt er twee stappen verderop -- de vraag die een mens
                stelt en die geen enkele zoekopdracht beantwoordt.

   NIET GEMETEN IS IETS ANDERS DAN GEEN SAMENHANG, en dat is de regel die deze
   laag eerlijk houdt. Onder de meetgrens staan soorten ZONDER randen in de
   kaart, met die woorden erbij. Een randenkaart die bij drie rijen al lijnen
   trekt, verkoopt toeval als structuur.

   Krijgt dezelfde sctx als ./inzicht.js. */
'use strict';

module.exports = (sctx, { laagVoor, zoeklaag, MEETGRENS }) => {
  const { app, schoon, werkPoort } = sctx;

  /* laagVoor, zoeklaag en de meetgrens komen van ./inzicht.js MEE. Ze hier
     opnieuw opbouwen zou een tweede lezing van dezelfde laag maken, en
     check.js weigert dat terecht: een deelbestand dat in de top-level van
     een zuster grijpt, is geen deelbestand maar een tak.
     (MEETGRENS: onder dit aantal rijen MAG een verwijzing niet gemeten
     worden -- zie de kop.) */

  /* ---------- de samenhang: de vorm van het geheel ---------- */
  app.post('/api/bedrijf/samenhang', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { register, graaf, kwaliteit } = laagVoor(g);
    const vorm = graaf.vorm();
    const klein = vorm.knopen.filter(k => k.aantal > 0 && k.aantal < MEETGRENS).map(k => k.type);
    res.json({ ok: true, vorm,
      kwaliteit: kwaliteit.meet(),
      nietGemeten: klein,
      let: klein.length
        ? 'Van ' + klein.join(', ') + ' zijn er te weinig rijen om een verwijzing te MOGEN meten. Die soorten staan daarom zonder randen in de kaart: niet gemeten, en dat is iets anders dan geen samenhang.'
        : 'De randen zijn gemeten uit de gegevens. Een soort zonder randen staat in "losse" en dat is een uitslag, geen fout.',
      soorten: zoeklaag.bereik(register) });
  });

  /* ---------- wandelen: wat ligt er twee stappen verderop ---------- */
  app.post('/api/bedrijf/wandel', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const { graaf } = laagVoor(g);
    const type = schoon(req.body.type, 30);
    const id = schoon(req.body.id, 64);
    if (!type || !id) return res.status(400).json({ error: 'Waarvandaan: geef een soort en een id.' });
    const uit = graaf.wandel(type, id, req.body.diepte);
    if (uit.error) return res.status(uit.status || 404).json({ error: uit.error });
    res.json(Object.assign({ ok: true }, uit, {
      let: 'De wandeling loopt alleen door soorten waar u recht op heeft. Een pad dat via een gesloten module loopt, is hier niet onzichtbaar afgesneden -- het bestaat in dit register niet.'
    }));
  });

};
