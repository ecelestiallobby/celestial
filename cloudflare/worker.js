const JSON_HEADERS={ "content-type":"application/json; charset=utf-8","cache-control":"no-store" };
const ORIGIN="https://ecelestiallobby.github.io", ITERATIONS=310000;
const ROLES=["OWNER","ADMIN","SALES","CLIENT","CELESTIAL_ARMY"];
const PERMS={OWNER:["*"],ADMIN:["accounts.read","accounts.create","accounts.update","orders.read","orders.update","inventory.read","inventory.update","codes.read","codes.update","audit.read"],SALES:["accounts.read","orders.read","orders.create","orders.update","inventory.read","codes.validate"],CLIENT:["account.self","orders.self","codes.validate"],CELESTIAL_ARMY:["orders.read","orders.update","inventory.read"]};
const json=(v,s=200,h={})=>new Response(JSON.stringify(v),{status:s,headers:{...JSON_HEADERS,...h}});
const err=(m,s=400)=>json({ok:false,error:m},s);
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
const rand=n=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return b};
const tokenText=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function sha(v){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))}
async function passHash(p,s){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(p),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(s),iterations:ITERATIONS,hash:"SHA-256"},k,256))}
const allowed=(u,p)=>u&&(PERMS[u.role]||[]).includes("*")||(u&&(PERMS[u.role]||[]).includes(p));
async function audit(db,u,action,type,id,before=null,after=null){await db.prepare("INSERT INTO audit_logs(actor_id,action,target_type,target_id,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?)").bind(u?.id||null,action,type,id||null,before?JSON.stringify(before):null,after?JSON.stringify(after):null,new Date().toISOString()).run()}
async function current(req,env){const t=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!t)return null;return await env.DB.prepare("SELECT u.id,u.access_id,u.display_name,u.role,u.status,u.must_reset FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='ACTIVE'").bind(await sha(t),new Date().toISOString()).first()}
export default {async fetch(req,env){
 const origin=req.headers.get("origin"),cors=origin===ORIGIN?{"access-control-allow-origin":ORIGIN,"access-control-allow-methods":"GET,POST,PATCH,OPTIONS","access-control-allow-headers":"Content-Type,Authorization","access-control-max-age":"86400","vary":"Origin"}:{};
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(origin&&origin!==ORIGIN)return err("Origin not allowed",403);
 if(!env.DB)return err("D1 binding DB is missing",503);
 const url=new URL(req.url),p=url.pathname.replace(/\/$/,"")||"/";
 try{
 if(p==="/api/health"&&req.method==="GET")return json({ok:true,service:"CELESTIAL LOBBY API",time:new Date().toISOString()},200,cors);
 if(p==="/api/bootstrap"&&req.method==="POST"){
  if(!env.BOOTSTRAP_OWNER_ACCESS_ID||!env.BOOTSTRAP_OWNER_PASSWORD||!env.BOOTSTRAP_OWNER_KEY)return err("Configure the three bootstrap Worker secrets first",503);
  if(await env.DB.prepare("SELECT id FROM users WHERE role='OWNER' LIMIT 1").first())return err("Owner already initialized",409);
  const b=await req.json();if(b.bootstrapKey!==env.BOOTSTRAP_OWNER_KEY)return err("Invalid bootstrap key",403);
  const salt=tokenText(rand(16)),id=crypto.randomUUID(),hash=await passHash(env.BOOTSTRAP_OWNER_PASSWORD,salt),now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO users(id,access_id,display_name,role,password_hash,password_salt,status,must_reset,created_at) VALUES(?,?,?,'OWNER',?,?,'ACTIVE',1,?)").bind(id,env.BOOTSTRAP_OWNER_ACCESS_ID,"CELESTIAL LOBBY OWNER",hash,salt,now).run();
  await audit(env.DB,{id},"OWNER_BOOTSTRAP","user",id);return json({ok:true,message:"Owner initialized. Change the password immediately after first login."},201,cors)
 }
 if(p==="/api/auth/login"&&req.method==="POST"){
  const b=await req.json();if(!b.accessId||!b.password)return err("Access ID and password required");
  const u=await env.DB.prepare("SELECT * FROM users WHERE access_id=?").bind(String(b.accessId).trim()).first();
  if(!u||u.status!=="ACTIVE")return err("Invalid credentials or inactive account",401);
  const recent=await env.DB.prepare("SELECT COUNT(*) n FROM login_attempts WHERE access_id=? AND success=0 AND attempted_at>?").bind(u.access_id,new Date(Date.now()-15*60000).toISOString()).first();
  if(recent.n>=8)return err("Too many attempts. Try again in 15 minutes.",429);
  const ok=(await passHash(String(b.password),u.password_salt))===u.password_hash;
  await env.DB.prepare("INSERT INTO login_attempts(access_id,success,attempted_at) VALUES(?,?,?)").bind(u.access_id,ok?1:0,new Date().toISOString()).run();
  if(!ok)return err("Invalid credentials",401);
  const t=tokenText(rand(32)),exp=new Date(Date.now()+86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),u.id,await sha(t),exp,new Date().toISOString()).run();
  await audit(env.DB,{id:u.id},"LOGIN","session",null);
  return json({ok:true,token:t,expiresAt:exp,user:{id:u.id,accessId:u.access_id,displayName:u.display_name,role:u.role,mustReset:!!u.must_reset}},200,cors)
 }
 const u=await current(req,env);
 if(p==="/api/auth/me"&&req.method==="GET")return u?json({ok:true,user:u},200,cors):err("Unauthorized",401);
 if(p==="/api/auth/logout"&&req.method==="POST"){const t=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(t)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha(t)).run();return json({ok:true},200,cors)}
 if(!u)return err("Unauthorized",401);
 if(u.must_reset&&p!=="/api/auth/password")return err("Change temporary password before continuing",403);
 if(p==="/api/auth/password"&&req.method==="POST"){
  const b=await req.json();if(typeof b.password!=="string"||b.password.length<12)return err("Password must be at least 12 characters");
  const s=tokenText(rand(16)),h=await passHash(b.password,s);await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,must_reset=0,updated_at=? WHERE id=?").bind(h,s,new Date().toISOString(),u.id).run();
  await audit(env.DB,u,"PASSWORD_CHANGED","user",u.id);return json({ok:true},200,cors)
 }
 if(p==="/api/accounts"&&req.method==="GET"){if(!allowed(u,"accounts.read"))return err("Forbidden",403);const r=await env.DB.prepare("SELECT id,access_id,display_name,role,status,must_reset,created_at FROM users ORDER BY created_at DESC LIMIT 500").all();return json({ok:true,accounts:r.results},200,cors)}
 if(p==="/api/accounts"&&req.method==="POST"){
  if(!allowed(u,"accounts.create"))return err("Forbidden",403);const b=await req.json();if(!b.displayName||!ROLES.includes(b.role)||b.role==="OWNER")return err("Valid displayName and non-Owner role required");
  if(u.role!=="OWNER"&&!["CLIENT","SALES"].includes(b.role))return err("Only Owner may issue Admin or Celestial Army accounts",403);
  const aid=b.accessId||"CL-"+b.role.slice(0,3)+"-"+tokenText(rand(7)).toUpperCase(),temp=b.temporaryPassword||tokenText(rand(18));if(temp.length<12)return err("Temporary password must be at least 12 characters");
  const s=tokenText(rand(16)),h=await passHash(temp,s),id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO users(id,access_id,display_name,role,password_hash,password_salt,status,must_reset,created_at) VALUES(?,?,?,?,?,?,'ACTIVE',1,?)").bind(id,aid,b.displayName,b.role,h,s,now).run();
  await audit(env.DB,u,"ACCOUNT_CREATED","user",id,null,{accessId:aid,displayName:b.displayName,role:b.role});
  return json({ok:true,account:{id,accessId:aid,displayName:b.displayName,role:b.role,status:"ACTIVE"},temporaryPassword:temp,notice:"Shown once; deliver privately. Password change required at first login."},201,cors)
 }
 const am=p.match(/^\/api\/accounts\/([\w-]+)$/);
 if(am&&req.method==="PATCH"){if(!allowed(u,"accounts.update"))return err("Forbidden",403);const t=await env.DB.prepare("SELECT id,access_id,display_name,role,status FROM users WHERE id=?").bind(am[1]).first();if(!t)return err("Account not found",404);if(t.role==="OWNER"&&u.role!=="OWNER")return err("Owner-only action",403);const b=await req.json();if(!["ACTIVE","SUSPENDED","DISABLED"].includes(b.status))return err("Invalid status");await env.DB.prepare("UPDATE users SET status=?,updated_at=? WHERE id=?").bind(b.status,new Date().toISOString(),t.id).run();if(b.status!=="ACTIVE")await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(t.id).run();await audit(env.DB,u,"ACCOUNT_STATUS_CHANGED","user",t.id,t,{...t,status:b.status});return json({ok:true},200,cors)}
 if(p==="/api/orders"&&req.method==="POST"){if(!allowed(u,"orders.create")&&!allowed(u,"orders.self"))return err("Forbidden",403);const b=await req.json();if(!Array.isArray(b.items)||!b.items.length)return err("Order items required");const id=crypto.randomUUID(),ref="CL-ORD-"+new Date().getFullYear()+"-"+Date.now().toString().slice(-8),now=new Date().toISOString();await env.DB.prepare("INSERT INTO orders(id,reference,user_id,status,items_json,delivery_json,total_amount,created_at,updated_at) VALUES(?,?,?,'SUBMITTED',?,?,?,?,?)").bind(id,ref,u.id,JSON.stringify(b.items),JSON.stringify(b.delivery||{}),Number(b.totalAmount||0),now,now).run();await audit(env.DB,u,"ORDER_CREATED","order",id,null,{reference:ref,status:"SUBMITTED"});return json({ok:true,order:{id,reference:ref,status:"SUBMITTED"}},201,cors)}
 if(p==="/api/orders"&&req.method==="GET"){if(!allowed(u,"orders.read")&&!allowed(u,"orders.self"))return err("Forbidden",403);const r=u.role==="CLIENT"?await env.DB.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC").bind(u.id).all():await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all();return json({ok:true,orders:r.results},200,cors)}
 const om=p.match(/^\/api\/orders\/([\w-]+)$/);
 if(om&&req.method==="PATCH"){if(!allowed(u,"orders.update"))return err("Forbidden",403);const old=await env.DB.prepare("SELECT id,status FROM orders WHERE id=?").bind(om[1]).first();if(!old)return err("Order not found",404);const b=await req.json(),states=["SUBMITTED","UNDER_REVIEW","APPROVED","REVISION_NEEDED","DECLINED","PROCESSING","IN_TRANSIT","DELIVERED","CANCELLED"];if(!states.includes(b.status))return err("Invalid status");await env.DB.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").bind(b.status,new Date().toISOString(),old.id).run();await audit(env.DB,u,"ORDER_STATUS_CHANGED","order",old.id,old,{status:b.status});return json({ok:true},200,cors)}
 if(p==="/api/inventory"&&req.method==="GET"){if(!allowed(u,"inventory.read"))return err("Forbidden",403);const r=await env.DB.prepare("SELECT * FROM inventory ORDER BY name").all();return json({ok:true,items:r.results},200,cors)}
 if(p==="/api/inventory"&&req.method==="POST"){if(!allowed(u,"inventory.update"))return err("Forbidden",403);const b=await req.json();if(!b.name||!Number.isFinite(Number(b.stock))||Number(b.stock)<0)return err("name and non-negative stock required");const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO inventory(id,sku,name,stock,unit_price,active,updated_at) VALUES(?,?,?,?,?,1,?)").bind(id,b.sku||null,b.name,Number(b.stock),Number(b.unitPrice||0),new Date().toISOString()).run();await audit(env.DB,u,"INVENTORY_CREATED","inventory",id,null,b);return json({ok:true,id},201,cors)}
 if(p==="/api/codes/validate"&&req.method==="POST"){if(!allowed(u,"codes.validate"))return err("Forbidden",403);const b=await req.json(),r=await env.DB.prepare("SELECT * FROM access_codes WHERE code=?").bind(String(b.code||"").trim().toUpperCase()).first(),valid=!!r&&!!r.active&&(!r.expires_at||r.expires_at>new Date().toISOString())&&(r.max_uses===null||r.uses<r.max_uses);if(valid)await env.DB.prepare("UPDATE access_codes SET uses=uses+1 WHERE code=?").bind(r.code).run();return json({ok:true,valid,code:valid?{type:r.type,value:r.value}:null},200,cors)}
 if(p==="/api/audit"&&req.method==="GET"){if(!allowed(u,"audit.read"))return err("Forbidden",403);const r=await env.DB.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300").all();return json({ok:true,logs:r.results},200,cors)}
 return err("Route not found",404)
 }catch(e){return json({ok:false,error:"Request failed",detail:env.ENVIRONMENT==="development"?String(e):undefined},500,cors)}
}};
