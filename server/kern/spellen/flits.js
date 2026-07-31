/* Spellen (deelmodule): Flitsduel, de rekenrace voor tieners. Iedereen
   krijgt DEZELFDE tien opgaven en werkt ze in eigen tempo af (de zet
   'antwoord' mag buiten de beurt); wie de meeste goed heeft wint, bij
   gelijke stand wie het eerst klaar was. Krijgt de gedeelde context een
   keer bij het opstarten vanuit kern/spellen.js. */
module.exports = (ctx) => {
  const { save, crypto, codenaamVan, nudge } = ctx;
  /* crypto.randomInt eist max > min. Een BEREKENDE bovengrens kan onder de
     ondergrens duiken, en dan gooit hij -- midden in het opzetten van een
     potje, waardoor het hele duel omviel met "Er ging iets mis". Dat gebeurde
     ook echt: zie de plus-som hieronder. Een klemmende R kan dat niet meer.
     Valt de grens samen, dan is er precies een geldige waarde en geven we die. */
  const R = (a, b) => (b <= a ? a : crypto.randomInt(a, b + 1));
  // een opgave op tiener-niveau: plus en min tot 100, tafels tot 12x19 en
  // deelsommen die precies uitkomen; het antwoord blijft op de server
  function opgave() {
    const soort = R(0, 3);
    /* De eerste term loopt tot 88, niet tot 89. Bij a=89 blijft er namelijk
       geen geldige tweede term over (b begint bij 11, en 89+11 is 100), en dan
       vroeg de oude code een getal uit een leeg bereik. Ongeveer drie op de
       honderd potjes vielen daardoor om bij het starten. */
    if (soort === 0) { const a = R(12, 88), b = R(11, 99 - a); return { t: a + ' + ' + b, a: a + b }; }
    if (soort === 1) { const b = R(11, 78), a = R(b + 11, 99); return { t: a + ' - ' + b, a: a - b }; }
    if (soort === 2) { const a = R(3, 12), b = R(4, 19); return { t: a + ' x ' + b, a: a * b }; }
    const b = R(3, 12), u = R(4, 19);
    return { t: (b * u) + ' : ' + b, a: u };
  }
  function flitsInit(potje) {
    const st = { sommen: [], idx: {}, goed: {}, klaarOm: {} };
    for (let i = 0; i < 10; i++) st.sommen.push(opgave());
    for (const sp of potje.spelers) { st.idx[sp] = 0; st.goed[sp] = 0; }
    potje.staat = st;
  }
  function flitsZet(potje, mij, zet) {
    const st = potje.staat;
    if (zet.actie !== 'antwoord') return { status: 400, error: 'Onbekende zet.' };
    if (st.idx[mij] >= st.sommen.length) return { status: 409, error: 'Jij bent al klaar; wacht op de rest.' };
    const som = st.sommen[st.idx[mij]];
    const goedWas = Number(zet.a) === som.a;
    if (goedWas) st.goed[mij] += 1;
    st.idx[mij] += 1;
    if (st.idx[mij] >= st.sommen.length) st.klaarOm[mij] = Date.now();
    // iedereen klaar: de meeste goed wint; gelijke stand valt op wie het
    // eerst binnen was, en pas bij een exacte dubbel is het echt gelijk
    if (potje.spelers.every(sp => st.idx[sp] >= st.sommen.length)) {
      potje.status = 'klaar';
      const beste = Math.max(...potje.spelers.map(sp => st.goed[sp]));
      const kandidaten = potje.spelers.filter(sp => st.goed[sp] === beste);
      kandidaten.sort((x, y) => st.klaarOm[x] - st.klaarOm[y]);
      if (kandidaten.length > 1 && st.klaarOm[kandidaten[0]] === st.klaarOm[kandidaten[1]]) potje.gelijk = true;
      else potje.winnaar = codenaamVan(kandidaten[0]);
    }
    save();
    potje.spelers.filter(sp => sp !== mij).forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, goedWas, juisteA: som.a };
  }
  // de eigen som plus de live tussenstand van iedereen (potje-intern; er
  // wordt niets bewaard buiten dit ene potje)
  const flitsView = (p, st, mij) => ({
    som: st.idx[mij] < st.sommen.length ? st.sommen[st.idx[mij]].t : null,
    nr: st.idx[mij], tot: st.sommen.length, goed: st.goed[mij],
    stand: p.spelers.map(sp => ({ af: st.idx[sp], goed: st.goed[sp] }))
  });
  return { flitsInit, flitsZet, flitsView };
};
