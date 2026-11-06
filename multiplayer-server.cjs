// No dependencies: HTTP game hosting, room API and Server-Sent Events.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
function createRoomServer(){
 const rooms=new Map(),sessions=new Map(),root=path.join(__dirname,'dist');
 const random=()=>crypto.randomBytes(18).toString('hex');
 function view(room){return{code:room.code,host:room.host,mode:room.mode,aiDifficulty:room.aiDifficulty,laps:room.laps,started:room.started,startAt:room.startAt,seed:room.seed,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,grid:p.grid,best:p.best,connected:!!p.stream,finish:p.finish}))};}
 function emit(p,type,data){if(p.stream?.writableLength>262144){p.stream.end();p.stream=null;p.seen=Date.now();return;}p.stream?.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);}
 function broadcast(room,type,data){for(const p of room.players.values())emit(p,type,data);}
 function leave(p){const room=p.room;p.stream?.end();room.players.delete(p.id);sessions.delete(p.token);if(p.id===room.host){broadcast(room,'closed',{message:'The host left the room.'});for(const q of room.players.values()){q.stream?.end();sessions.delete(q.token);}rooms.delete(room.code);}else broadcast(room,'room',view(room));}
 const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(u.pathname==='/api/events'){
    const p=sessions.get(u.searchParams.get('token'));if(!p)return reply(401,{error:'Room connection expired. Join again.'});
    p.stream?.end();res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');p.stream=res;p.seen=Date.now();broadcast(p.room,'room',view(p.room));req.on('close',()=>{if(p.stream===res){p.stream=null;p.seen=Date.now();broadcast(p.room,'room',view(p.room));}});return;
   }
   if(u.pathname.startsWith('/api/')){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return reply(403,{error:'Origin not allowed'});
    if(req.method!=='POST')return reply(405,{error:'POST required'});
    let body='';for await(const b of req){body+=b;if(body.length>40000){return reply(413,{error:'Message too large'});}}const m=JSON.parse(body||'{}');
    if(u.pathname==='/api/host'||u.pathname==='/api/join'){
     let room;
     if(u.pathname==='/api/host'){
      if(rooms.size>=200)return reply(503,{error:'Server full'});let code;do{code=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
      room={code,host:null,mode:m.mode==='race'?'race':'time-attack',aiDifficulty:Math.max(1,Math.min(100,Math.round(+m.aiDifficulty||50))),laps:Math.max(2,Math.min(15,Math.round(+m.laps||3))),players:new Map(),started:false,ai:[],seed:crypto.randomBytes(4).readUInt32LE()};rooms.set(code,room);
     }else{room=rooms.get(String(m.code||'').trim().toUpperCase());if(!room)return reply(404,{error:'Room not found. Check the code.'});if(room.started)return reply(409,{error:'This session has already started.'});if(room.players.size>=20)return reply(409,{error:'Room full (20 players).'});}
     const id=crypto.randomBytes(6).toString('hex'),token=random(),p={id,token,room,name:String(m.name||`Driver ${room.players.size+1}`).replace(/[\x00-\x1f]/g,'').trim().slice(0,24)||'Driver',best:null,finish:null,grid:null,seen:Date.now(),stream:null,state:null};room.players.set(id,p);sessions.set(token,p);if(!room.host)room.host=id;broadcast(room,'room',view(room));return reply(200,{token,id,room:view(room),serverTime:Date.now()});
    }
    const p=sessions.get(m.token);if(!p)return reply(401,{error:'Room connection expired.'});p.seen=Date.now();const room=p.room;
    if(u.pathname==='/api/leave'){leave(p);return reply(200,{ok:true});}
    if(u.pathname==='/api/start'){
     if(p.id!==room.host)return reply(403,{error:'Only the host can start.'});if(room.started)return reply(409,{error:'Already started'});
     const grids=Array.from({length:20},(_,i)=>i+1);for(let i=19;i>0;i--){const j=crypto.randomInt(i+1);[grids[i],grids[j]]=[grids[j],grids[i]];}let i=0;for(const q of room.players.values())q.grid=grids[i++];room.started=true;room.startAt=Date.now()+1200;broadcast(room,'room',view(room));return reply(200,{ok:true});
    }
    if(u.pathname==='/api/state'){
     if(!room.started)return reply(409,{error:'Session not started'});
     const s=m.state;if(s&&['x','z','heading','v','s','offset'].every(k=>Number.isFinite(s[k])&&Math.abs(s[k])<1e7)){p.state={x:s.x,z:s.z,heading:s.heading,v:Math.max(0,Math.min(90,s.v)),s:s.s,offset:s.offset,finishTime:Number.isFinite(s.finishTime)&&s.finishTime>0?s.finishTime:null};if(p.state.finishTime)p.finish=p.state.finishTime;}
     if(p.id===room.host&&Array.isArray(m.ai)){room.ai=m.ai.slice(0,19).filter(a=>Number.isInteger(a.grid)&&a.grid>=1&&a.grid<=20&&['s','v','offset'].every(k=>Number.isFinite(a[k]))).map(a=>({grid:a.grid,s:a.s,v:a.v,offset:a.offset,finishTime:Number.isFinite(a.finishTime)?a.finishTime:null,completedLaps:Math.max(0,Math.floor(a.s/7004)),offsetVelocity:0}));}
     if(room.mode==='time-attack'&&m.lap?.valid===true&&Number.isInteger(m.lap.lap)&&m.lap.lap!==p.lastLap&&Number.isFinite(m.lap.time)&&m.lap.time>30){p.lastLap=m.lap.lap;p.best=p.best===null?m.lap.time:Math.min(p.best,m.lap.time);broadcast(room,'room',view(room));}
     return reply(200,{serverTime:Date.now()});
    }
    return reply(404,{error:'Unknown endpoint'});
   }
   const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return reply(403,{error:'Forbidden'});
   fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.geojson':'application/json'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(b);});
  }catch(e){if(!res.headersSent)reply(400,{error:'Invalid request'});else res.end();}
 });
 const tick=setInterval(()=>{for(const room of rooms.values()){if(room.started)broadcast(room,'frame',{serverTime:Date.now(),players:[...room.players.values()].filter(p=>p.state).map(p=>({id:p.id,...p.state})),ai:room.ai});for(const p of [...room.players.values()]){if(!p.stream&&Date.now()-p.seen>45000)leave(p);}}},50);tick.unref();server.on('close',()=>{clearInterval(tick);for(const p of sessions.values())p.stream?.end();});server.rooms=rooms;return server;
}
module.exports={createRoomServer};
if(require.main===module){const port=Number(process.env.PORT)||8765;createRoomServer().listen(port,'0.0.0.0',()=>{console.log(`ARDENNE multiplayer: http://localhost:${port}`);for(const list of Object.values(os.networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal)console.log(`Friends on your network: http://${n.address}:${port}`);console.log('Keep this window open. Internet play requires a reachable server URL.');});}
