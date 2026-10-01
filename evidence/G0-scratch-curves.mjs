// SCRATCH, not game code and not a balance result. A crude 4v4 auto-fight (basic attack plus one 200% skill every 3rd turn,
// no statuses, no healing, focus on lowest-HP front unit) used only to check that DESIGN.md's curves do not break at either end.
// Run: node evidence/G0-scratch-curves.mjs   (fixed seed, deterministic)
const mulbp=(x,bp)=>Math.floor(x*bp/10000);
const hs=(s1,L)=>s1+Math.floor(s1*9*(L-1)/49);
const es=(p,L,k)=>p+Math.floor(p*k*(L-1)/49);
function mit(def,atkL){const K=40+12*atkL;return Math.min(8000,Math.floor(def*10000/(def+K)));}
// mulberry-ish rng
let st=12345;const r=()=>{st=(st+0x6D2B79F5)>>>0;let t=st;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)};
const rng=n=>r()%n;
function mk(side,i,s,L,name){return {side,id:(side?4:0)+i,L,hp:s.VIG*5,max:s.VIG*5,...s,cd:0,name,row:i<2?0:1};}
function fight(heroes,enemies,pow){
 const u=[...heroes,...enemies];let round=0;
 while(round<40){round++;
  const order=u.filter(x=>x.hp>0).sort((a,b)=>b.SPD-a.SPD||a.id-b.id);
  for(const a of order){ if(a.hp<=0)continue;
   const foes=u.filter(x=>x.side!==a.side&&x.hp>0); if(!foes.length)return{round,win:a.side===0};
   const front=foes.filter(x=>x.row===0); const pool=front.length?front:foes;
   const t=pool.reduce((m,x)=>x.hp<m.hp?x:m,pool[0]);
   let p=10000; if(a.cd<=0){p=pow;a.cd=3;}else a.cd--;
   const stat=a.MIT>=a.ARC?a.MIT:a.ARC; const def=a.MIT>=a.ARC?t.GRD:t.WRD;
   let d=mulbp(stat,p); d=mulbp(d,10000-mit(def,a.L)); d=mulbp(d,9000+rng(2001)); d=Math.max(1,d);
   t.hp-=d; }
  if(!u.filter(x=>x.side===1&&x.hp>0).length)return{round,win:true};
  if(!u.filter(x=>x.side===0&&x.hp>0).length)return{round,win:false};
 } return{round,win:false};
}
for(const L of [1,10,25,50]){
 for(const [tier,tm] of [["nogear",0],["plain",10000],["fine",11500],["runed",13000],["runed+5star",16250]]){
  const res=[];
  for(let n=0;n<200;n++){
   const g=x=>mulbp(x*L,tm);
   const H=[ // s1 profiles
    {VIG:22,MIT:12,ARC:6,GRD:20,WRD:12,SPD:8},{VIG:18,MIT:20,ARC:6,GRD:12,WRD:8,SPD:10},
    {VIG:14,MIT:6,ARC:22,GRD:8,WRD:16,SPD:11},{VIG:15,MIT:6,ARC:18,GRD:9,WRD:18,SPD:9}].map((p,i)=>{
     const s={VIG:hs(p.VIG,L)+g(5),MIT:hs(p.MIT,L)+(i===1?g(6):0),ARC:hs(p.ARC,L)+(i>=2?g(6):0),GRD:hs(p.GRD,L)+g(4),WRD:hs(p.WRD,L)+g(3),SPD:hs(p.SPD,L)+g(1)};
     return mk(0,i,s,L,'h'+i);});
   const K=22;
   const E=[{VIG:14,MIT:16,ARC:2,GRD:14,WRD:8,SPD:9},{VIG:12,MIT:18,ARC:2,GRD:10,WRD:6,SPD:11},{VIG:9,MIT:2,ARC:18,GRD:6,WRD:12,SPD:10},{VIG:10,MIT:2,ARC:16,GRD:7,WRD:14,SPD:8}].map((p,i)=>
     mk(1,i,{VIG:es(p.VIG,L,K),MIT:es(p.MIT,L,K),ARC:es(p.ARC,L,K),GRD:es(p.GRD,L,K),WRD:es(p.WRD,L,K),SPD:es(p.SPD,L,9)},L,'e'+i));
   res.push(fight(H,E,20000));
  }
  const w=res.filter(x=>x.win).length/res.length, ar=res.reduce((s,x)=>s+x.round,0)/res.length;
  console.log(`L${L} ${tier}: win ${(w*100).toFixed(0)}%  avg rounds ${ar.toFixed(1)}`);
 }}
