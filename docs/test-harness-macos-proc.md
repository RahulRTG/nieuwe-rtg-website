# Test-harnessprobleem: procesidentiteit op macOS

Status: open  
Gevonden: 22 september 2026  
Bereik: alleen de test-harness; geen Connection-productgedrag

## Feitelijke uitkomst

De gerichte Connection Constitution draaide met 88 van 88 groene toetsen en
`npm run check` rondde alle 73 repositorycontroles af. De volledige
`npm test`-ronde is niet groen verklaard: `test/afbouwafloop.test.js` leest in
de proef voor een hergebruikt PID rechtstreeks `/proc/<pid>/stat`. macOS heeft
geen `/proc`, waardoor die proef met `ENOENT` stopt.

De productiemodule heeft al een macOS-pad via `ps`; de toets beproeft dat pad
niet en gebruikt zelf een Linux-specifieke bron. Dit is daarom een gebrek in
de test-harness, geen bewijs voor of tegen Ronde 3 of Ronde 4.

## Reproductie

```sh
node --test test/afbouwafloop.test.js
```

De falende bewering heet:

`een hergebruikt PID wordt niet voor een oud kind aangezien`

## Klaar wanneer

- de proef op Linux de echte `/proc`-identiteit blijft beproeven;
- de proef op macOS dezelfde semantiek via een draagbare testnaad beproeft;
- geen platformtak stil wordt overgeslagen;
- `node --test test/afbouwafloop.test.js` op macOS groen is;
- pas daarna mag een volledige `npm test`-ronde weer als groen bewijs worden
  aangehaald.

