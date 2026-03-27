import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameHandle } from '../lib/gameTypes';

interface Vec2 { x: number; y: number; }
interface Rock {
  id: number; pos: Vec2; vel: Vec2; angle: number; angularVel: number;
  size: 'large'|'medium'|'small'; vertices: Vec2[]; radius: number;
}
interface Bullet { id:number; pos:Vec2; vel:Vec2; born:number; }
interface Ufo { pos:Vec2; vel:Vec2; alive:boolean; }

const W=800,H=600;
const BULLET_SPEED=500;
const BULLET_LIFE=2000;
const FIRE_COOLDOWN=90;
const PLAYER_MAX_SPEED=220;
const ACCEL=260;
const FRICTION=0.992;

const RADII={large:46,medium:28,small:14};

let nextId=1;

const rand=(a:number,b:number)=>a+Math.random()*(b-a);

function wrap(p:Vec2):Vec2{
  return {x:(p.x+W)%W,y:(p.y+H)%H};
}

function dist(a:Vec2,b:Vec2){
  return Math.hypot(a.x-b.x,a.y-b.y);
}

function makeRock(size:'large'|'medium'|'small'):Rock{
  const r=RADII[size];
  return{
    id:nextId++,
    pos:{x:rand(0,W),y:rand(0,H)},
    vel:{x:rand(-80,80),y:rand(-80,80)},
    angle:0,
    angularVel:rand(-1,1),
    size,
    radius:r,
    vertices:Array.from({length:8},(_,i)=>{
      const a=i/8*Math.PI*2;
      const rr=r*(0.7+Math.random()*0.4);
      return {x:Math.cos(a)*rr,y:Math.sin(a)*rr};
    })
  };
}

function spawnWave(n:number){
  return Array.from({length:3+n},()=>makeRock('large'));
}

const Debris = forwardRef<GameHandle>((_,ref)=>{
  const canvasRef=useRef<HTMLCanvasElement>(null);

  const player=useRef({pos:{x:W/2,y:H/2},vel:{x:0,y:0},angle:0});
  const rocks=useRef<Rock[]>([]);
  const bullets=useRef<Bullet[]>([]);
  const ufo=useRef<Ufo|null>(null);

  const keys=useRef(new Set<string>());
  const lastFire=useRef(0);
  const lastFrame=useRef(0);

  const wave=useRef(1);
  const phase=useRef<'normal'|'ufo'>('normal');

  useImperativeHandle(ref,()=>({
    getGameScore:()=>({score:0,maxScore:0}),
    onGameEnd:()=>{}
  }));

  function fire(){
    const now=Date.now();
    if(now-lastFire.current<FIRE_COOLDOWN)return;
    lastFire.current=now;

    const a=player.current.angle;
    bullets.current.push({
      id:nextId++,
      pos:{...player.current.pos},
      vel:{
        x:Math.cos(a)*BULLET_SPEED+player.current.vel.x,
        y:Math.sin(a)*BULLET_SPEED+player.current.vel.y
      },
      born:now
    });
  }

  function transitionWave(){
    wave.current++;
    rocks.current=spawnWave(wave.current);
    bullets.current=[];
    ufo.current=null;
    phase.current='normal';
  }

  function update(dt:number){
    const p=player.current;

    if(keys.current.has('ArrowLeft'))p.angle-=3*dt;
    if(keys.current.has('ArrowRight'))p.angle+=3*dt;

    if(keys.current.has('ArrowUp')){
      p.vel.x+=Math.cos(p.angle)*ACCEL*dt;
      p.vel.y+=Math.sin(p.angle)*ACCEL*dt;
    }

    const spd=Math.hypot(p.vel.x,p.vel.y);
    if(spd>PLAYER_MAX_SPEED){
      p.vel.x*=PLAYER_MAX_SPEED/spd;
      p.vel.y*=PLAYER_MAX_SPEED/spd;
    }

    p.vel.x*=FRICTION;
    p.vel.y*=FRICTION;

    p.pos.x+=p.vel.x*dt;
    p.pos.y+=p.vel.y*dt;
    p.pos=wrap(p.pos);

    if(keys.current.has(' '))fire();

    // bullets
    const now=Date.now();
    bullets.current=bullets.current.filter(b=>{
      if(now-b.born>BULLET_LIFE)return false;
      b.pos.x+=b.vel.x*dt;
      b.pos.y+=b.vel.y*dt;
      b.pos=wrap(b.pos);
      return true;
    });

    // rocks
    for(const r of rocks.current){
      r.pos.x+=r.vel.x*dt;
      r.pos.y+=r.vel.y*dt;
      r.pos=wrap(r.pos);
      r.angle+=r.angularVel*dt;
    }

    // collisions
    const newRocks:Rock[]=[];
    for(const r of rocks.current){
      let hit=false;

      for(const b of bullets.current){
        if(dist(r.pos,b.pos)<r.radius){
          hit=true;
          b.born=0;
          break;
        }
      }

      if(!hit)newRocks.push(r);
      else{
        if(r.size==='large'){
          newRocks.push(makeRock('medium'),makeRock('medium'));
        }else if(r.size==='medium'){
          newRocks.push(makeRock('small'),makeRock('small'));
        }
      }
    }
    rocks.current=newRocks;

    // wave clear
    if(rocks.current.length===0){
      transitionWave();
    }
  }

  function draw(){
    const c=canvasRef.current;
    if(!c)return;
    const ctx=c.getContext('2d');
    if(!ctx)return;

    ctx.fillStyle='black';
    ctx.fillRect(0,0,W,H);

    // player
    const p=player.current;
    ctx.save();
    ctx.translate(p.pos.x,p.pos.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle='magenta';
    ctx.beginPath();
    ctx.moveTo(16,0);
    ctx.lineTo(-10,-8);
    ctx.lineTo(-6,0);
    ctx.lineTo(-10,8);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // rocks
    ctx.strokeStyle='cyan';
    for(const r of rocks.current){
      ctx.save();
      ctx.translate(r.pos.x,r.pos.y);
      ctx.rotate(r.angle);
      ctx.beginPath();
      ctx.moveTo(r.vertices[0].x,r.vertices[0].y);
      for(const v of r.vertices)ctx.lineTo(v.x,v.y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // bullets
    ctx.fillStyle='white';
    for(const b of bullets.current){
      ctx.beginPath();
      ctx.arc(b.pos.x,b.pos.y,2,0,Math.PI*2);
      ctx.fill();
    }
  }

  function loop(ts:number){
    const dt=Math.min((ts-(lastFrame.current||ts))/1000,0.05);
    lastFrame.current=ts;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  useEffect(()=>{
    rocks.current=spawnWave(1);

    const down=(e:KeyboardEvent)=>keys.current.add(e.key);
    const up=(e:KeyboardEvent)=>keys.current.delete(e.key);

    window.addEventListener('keydown',down);
    window.addEventListener('keyup',up);

    requestAnimationFrame(loop);

    return()=>{
      window.removeEventListener('keydown',down);
      window.removeEventListener('keyup',up);
    };
  },[]);

  return <canvas ref={canvasRef} width={W} height={H} />;
});

export default Debris;