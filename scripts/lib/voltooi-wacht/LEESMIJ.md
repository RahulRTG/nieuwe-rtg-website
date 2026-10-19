# Voltooiscenario's die wachten op de infrastructuur

De scenario's hier horen bij apps zonder eigen adres (`tab:` en `os:`). Ze
bereiken de app via een echte navigatiestap in de ledenapp (`/apps/app.html`):
de stand of de os-tegel kiezen. `scripts/voltooiproef.js` en
`test/voltooiproef.test.js` kennen zo'n ingang nog niet; de integrator bouwt
dat centraal (`ingang` + `via` in het contract). Zodra dat er is, verhuizen
deze bestanden naar `scripts/lib/voltooi/` en worden ze geregistreerd in
`SCENARIOS` en `CONTRACT`. Tot dan draaien ze niet mee en tellen ze nergens.
