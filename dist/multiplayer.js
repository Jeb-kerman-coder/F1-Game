(()=>{'use strict';
const $=id=>document.getElementById(id),mp=window.Multiplayer,race=window.RaceRuntime,game=window.Ardenne;
let token=null,self=null,room=null,events=null,started=false,offset=0,sending=false,lastSend=0,lastLap=null,frames=new Map(),models=new Map(),ai=[],lastPaint=0;
const panels=['menu-home','race-setup','settings-panel','multiplayer-panel'];
function show(id){panels.forEach(p=>$(p).hidden=p!==id);}
function message(s){$('mp-message').textContent=s;}
async function request(action,data={}){const r=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...data})});const j=await r.json();if(!r.ok)throw Error(j.error||'Connection failed');return j;}
function time(v){return v==null?'—':Math.floor(v/60)+':'+(v%60).toFixed(3).padStart(6,'0');}
function row(parent,name,value,you=false){const div=document.createElement('div'),a=document.createElement('span'),b=document.createElement('span');div.className='mp-time'+(you?' you':'');a.textContent=name;b.textContent=value;div.append(a,b);parent.append(div);}
function lobby(){if(!room)return;$('mp-room-code').textContent=room.code;$('mp-room-details').textContent=(room.mode==='race'?`RACE · ${room.laps} LAPS · ${20-room.players.length} AI`:'TIME ATTACK · VALID BEST LAPS')+` · ${room.players.length} / 20 DRIVERS`;$('mp-players').replaceChildren();for(const p of room.players)row($('mp-players'),p.name+(p.id===self?' (YOU)':''),p.id===room.host?'HOST':p.connected?'READY':'CONNECTING',p.id===self);$('mp-start').hidden=room.host!==self;$('mp-start').disabled=room.started;message(room.host===self?'Share the code. Start when your party is ready.':'Waiting for the host to start.');board();}
function board(){if(!room)return;const list=$('mp-board-list');list.replaceChildren();$('mp-board-title').textContent=room.mode==='race'?'PARTY / RACE':'PARTY / BEST LAPS';const players=[...room.players].sort((a,b)=>(a.best??Infinity)-(b.best??Infinity));for(const p of players){const state=frames.get(p.id);row(list,p.name,room.mode==='race'?(state?.finishTime?'FIN '+time(state.finishTime):'LAP '+(Math.max(0,Math.floor((state?.s||0)/7004))+1)):time(p.best),p.id===self);}}
async function connect(host){
 if(location.protocol==='file:'){message('For multiplayer, run START-MULTIPLAYER.cmd and open http://localhost:8765. Friends open the network address shown in that window.');return;}
 try{message('Connecting…');const before=Date.now(),result=await request(host?'host':'join',{name:$('mp-name').value,code:$('mp-code-input').value,mode:$('mp-mode').value,aiDifficulty:$('mp-ai').value,laps:$('mp-laps').value});token=result.token;self=result.id;offset=result.serverTime-(before+Date.now())/2;room=result.room;started=false;$('mp-connect').hidden=true;$('mp-lobby').hidden=false;
 events=new EventSource('/api/events?token='+encodeURIComponent(token));events.addEventListener('room',e=>{room=JSON.parse(e.data);lobby();if(room.started&&!started)launch();});events.addEventListener('frame',e=>{const f=JSON.parse(e.data);for(const p of f.players)frames.set(p.id,{...p,received:performance.now()});ai=f.ai;});events.addEventListener('closed',e=>{const why=JSON.parse(e.data).message;leave(false);game.mainMenu();show('multiplayer-panel');message(why);});events.onerror=()=>{message('Connection interrupted. Reconnecting…');$('mp-live-message').textContent='Connection interrupted — reconnecting';};events.onopen=()=>{$('mp-live-message').textContent='';};lobby();
 }catch(e){message(e.message.includes('JSON')?'Room server unavailable. Run START-MULTIPLAYER.cmd.':e.message);}
}
function cleanup(){mp.active=false;mp.car=null;for(const m of models.values())m.parent?.remove(m);models.clear();frames.clear();ai=[];$('mp-board').hidden=true;}
function leave(notify=true){const old=token;if(notify&&old)fetch('/api/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:old}),keepalive:true}).catch(()=>{});events?.close();events=null;cleanup();token=self=room=null;started=false;$('mp-connect').hidden=false;$('mp-lobby').hidden=true;}
function launch(){started=true;lastLap=null;mp.active=true;lastSend=0;mp.car=null;$('mp-board').hidden=false;
 if(room.mode==='race'){const p=room.players.find(p=>p.id===self);game.startRace({aiDifficulty:room.aiDifficulty,laps:room.laps,gridPosition:p.grid,multiplayer:true,humans:room.players,seed:room.seed,remoteAI:room.host!==self});}
 else{game.openTimeAttack();$('start').click();}
 $('mp-board').hidden=false;mp.active=true;
}
mp.beforeStep=(car)=>{if(room&&Date.now()+offset<room.startAt){car.v=0;car.yaw=0;return false;}};
race.beforeAdvance=dt=>{if(!mp.active||!room)return;const core=race.controller,state=core.state;
 for(const d of state.drivers){if(d.external){const p=frames.get(d.peerId);if(p){d.s=p.s;d.v=p.v;d.offset=p.offset;d.worldPose=p;d.d=0;d.finishTime=p.finishTime;d.completedLaps=Math.max(0,Math.floor(p.s/7004));}}else if(room.host!==self){const remote=ai.find(a=>a.grid===d.grid);if(remote)Object.assign(d,remote);}}
 const elapsed=Math.max(0,(Date.now()+offset-room.startAt)/1000);let remaining=Math.min(20,Math.max(0,elapsed-state.elapsed));while(remaining>1e-6){const step=Math.min(.1,remaining);core.advance(step,race.playerCar||mp.car);remaining-=step;}
};
mp.onFrame=scene=>{
 if(!room||!started)return;const now=performance.now(),diag=window.racingDiagnostics(),data=race.getData();
 if(room.mode==='time-attack')for(const p of room.players){if(p.id===self)continue;const f=frames.get(p.id);if(!f)continue;let m=models.get(p.id);if(!m){m=race.carModel(p.grid||2,'#36becd');models.set(p.id,m);scene.add(m);}const pose=RaceCore.pose(data.track,f.s,f.offset);const blend=1-Math.exp(-Math.min(.1,(now-(m.userData.updated||now-16))/1000)*16);if(!m.userData.updated)m.position.set(f.x,pose.y+.055,f.z);else m.position.lerp(new window.THREE.Vector3(f.x,pose.y+.055,f.z),blend);m.rotation.set(-Math.atan(pose.grade),f.heading,0,'YXZ');m.userData.updated=now;}
 if(now-lastPaint>300){lastPaint=now;board();if(room.mode==='race'&&race.controller.state.player.finished)$('mp-live-message').textContent='Finished · '+time(race.controller.state.player.finishTime)+' · waiting for the party';}
 if(!mp.car||sending||now-lastSend<50)return;lastSend=now;sending=true;const c=mp.car,p=RaceCore.project(data.track,c.x,c.z),local=race.active?race.controller.state.player:null;
 const state={x:c.x,z:c.z,heading:c.heading,v:c.v,s:local?local.s:diag.progress*7004,offset:p.offset,finishTime:local?.finishTime??null};frames.set(self,{id:self,...state});
 const lap=room.mode==='time-attack'&&diag.lastLapResult&&diag.lastLapResult.lap!==lastLap?diag.lastLapResult:null;if(lap)lastLap=lap.lap;
 const bots=room.mode==='race'&&room.host===self?race.controller.state.drivers.filter(d=>!d.external).map(d=>({grid:d.grid,s:d.s,v:d.v,offset:d.offset,finishTime:d.finishTime})):undefined;
 const before=Date.now();request('state',{state,lap,ai:bots}).then(r=>{offset=offset*.9+(r.serverTime-(before+Date.now())/2)*.1;}).catch(e=>{$('mp-live-message').textContent=e.message;}).finally(()=>sending=false);
};
const mainMenu=game.mainMenu,openTA=game.openTimeAttack;
game.mainMenu=()=>{if(token)leave();mainMenu();$('multiplayer-panel').hidden=true;};
game.openTimeAttack=()=>{if(!started&&token)leave();openTA();};
// Multiplayer restarts must never reset the shared race clock or grid.
const restart=race.restart;race.restart=()=>{if(mp.active){$('mp-live-message').textContent='Restart is unavailable in a shared race.';return;}restart();};
addEventListener('keydown',e=>{if(mp.active&&room?.mode==='race'&&e.code==='KeyR'){e.preventDefault();e.stopImmediatePropagation();}},true);
$('menu-multiplayer').onclick=()=>{show('multiplayer-panel');message(location.protocol==='file:'?'Multiplayer needs the room server. Run START-MULTIPLAYER.cmd.':'Host a session or join with a room code.');};
$('mp-back').onclick=()=>{if(token)leave();game.mainMenu();show('menu-home');};$('mp-host-tab').onclick=()=>{$('mp-host-options').hidden=false;$('mp-join-options').hidden=true;};$('mp-join-tab').onclick=()=>{$('mp-host-options').hidden=true;$('mp-join-options').hidden=false;};$('mp-mode').onchange=()=>{$('mp-race-options').hidden=$('mp-mode').value!=='race';};
for(const [id,out]of [['mp-ai','mp-ai-value'],['mp-laps','mp-laps-value']])$(id).oninput=()=>$(out).textContent=$(id).value;
$('mp-create').onclick=()=>connect(true);$('mp-join').onclick=()=>connect(false);$('mp-leave').onclick=()=>{leave();message('Left room.');};$('mp-start').onclick=async()=>{try{await request('start');}catch(e){message(e.message);}};
addEventListener('beforeunload',()=>{if(token)navigator.sendBeacon('/api/leave',new Blob([JSON.stringify({token})],{type:'application/json'}));});
})();
