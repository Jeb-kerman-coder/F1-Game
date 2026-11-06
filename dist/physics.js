(function(root){
  const P={MAX:324/3.6,ACCEL:(240/3.6)/6.8,BRAKE:(240/3.6)/2.9};
  function speed(v,throttle,brake,dt,offroad=false){
    const a=brake? -P.BRAKE*brake:throttle?P.ACCEL*throttle:-(0.32+0.00018*v*v);
    return Math.max(0,Math.min(P.MAX,v+(a-(offroad?1.8+v*.07:0))*dt));
  }
  function step(s,input,dt){
    s.v=speed(s.v,input.throttle,input.brake,dt,s.offroad);
    if(Number.isFinite(input.speedLimit))s.v=Math.min(s.v,input.speedLimit);
    s.steer+=(input.steer-s.steer)*Math.min(1,dt*6);
    const delta=s.steer*(0.37/(1+s.v*.024));
    const desired=-s.v/3.6*Math.tan(delta);
    const grip=(s.offroad?0.8:1.7)*9.81+(s.offroad?0:0.0032*s.v*s.v);
    const yawLimit=grip/Math.max(1,s.v);
    const target=Math.max(-yawLimit,Math.min(yawLimit,desired));
    s.yaw+=(target-s.yaw)*Math.min(1,dt*7);
    s.heading+=s.yaw*dt;
    const excess=Math.max(0,Math.abs(desired)-yawLimit);
    s.slip+=(Math.sign(desired)*Math.min(.32,excess*.22)-s.slip)*Math.min(1,dt*3);
    s.x+=Math.sin(s.heading-s.slip)*s.v*dt;
    s.z+=Math.cos(s.heading-s.slip)*s.v*dt;
    s.g=s.v*s.yaw/9.81;
    return s;
  }
  const api={...P,speed,step};
  if(typeof module!=='undefined')module.exports=api;else root.Physics=api;
})(typeof window==='undefined'?globalThis:window);
