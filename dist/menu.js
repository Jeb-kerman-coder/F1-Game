(() => {
'use strict';
const $=id=>document.getElementById(id),panels=['menu-home','race-setup','settings-panel','multiplayer-panel'];
function show(id){for(const panel of panels)$(panel).hidden=panel!==id;}
function home(){window.Ardenne?.mainMenu();show('menu-home');}
$('menu-time-attack').onclick=()=>window.Ardenne?.openTimeAttack();
$('menu-race').onclick=()=>show('race-setup');$('menu-settings').onclick=()=>show('settings-panel');
$('race-back').onclick=home;$('settings-back').onclick=home;$('menu-button').onclick=home;$('pause-menu').onclick=home;
function values(){const config=RaceGrid.config({aiDifficulty:$('ai-difficulty').value,gridPosition:$('grid-position').value,laps:$('race-laps').value});$('ai-value').textContent=config.aiDifficulty;$('grid-value').textContent='P'+String(config.gridPosition).padStart(2,'0');$('laps-value').textContent=config.laps;return config;}
$('ai-difficulty').oninput=values;$('grid-position').oninput=values;$('race-laps').oninput=values;
$('start-race').onclick=()=>window.Ardenne?.startRace(values());
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('main-menu').hidden){show('menu-home');}});
values();show('menu-home');
})();
