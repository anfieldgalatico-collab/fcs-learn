const SUPABASE_URL = "https://zupsrmuhgkodjcxfqbfs.supabase.co";
const SUPABASE_KEY = "sb_publishable_bGXjyuaCWesF8ObhkWW43A_ZB9njnbC";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = function(id){return document.getElementById(id);};
const deptCode={csc:"CSC",ifs:"IFS",cys:"CYS"};
const typeName={assignment:"Assignment",note:"Lecture Note","past-question":"Past Question",exam:"Exam",textbook:"Textbook",other:"Other"};
let MATERIALS=[], COURSES=[], QUESTIONS=[];
let repUnlocked=false;
let quizState=null;
let quizTimer=null;
let dbError="";
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function pathLabel(m){return deptCode[m.dept]+" | "+m.level+"L | "+(m.semester==="first"?"First Sem":"Second Sem")+" | "+typeName[m.type];}
function rowM(r){return {id:r.id,dept:r.dept,level:r.level,semester:r.semester,type:r.type,course:r.course,title:r.title,desc:r.descr,year:r.year,fileName:r.file_name,fileType:r.file_type,url:r.url,filePath:r.file_path};}
function rowC(r){return {id:r.id,dept:r.dept,level:r.level,semester:r.semester,course:r.course,title:r.title,body:r.body};}
function rowQ(r){return {id:r.id,dept:r.dept,level:r.level,semester:r.semester,course:r.course,question:r.question,options:r.options,answer:r.answer,explanation:r.explanation};}
async function refreshAll(){
  dbError="";
  try{
    const res = await Promise.all([
      sb.from("materials").select("*").order("created_at",{ascending:false}),
      sb.from("courses").select("*").order("course",{ascending:true}),
      sb.from("questions").select("*").order("created_at",{ascending:false})
    ]);
    const bad = res.find(function(x){return x.error;});
    if(bad) throw bad.error;
    MATERIALS = res[0].data.map(rowM);
    COURSES = res[1].data.map(rowC);
    QUESTIONS = res[2].data.map(rowQ);
  }catch(e){
    const msg = (e&&e.message)||String(e);
    dbError = /relation|table|schema/i.test(msg)
      ? "Tables not found. In Supabase, run the setup SQL (SQL Editor), then reload."
      : "Cannot reach database ("+msg+"). Check connection, then reload.";
  }
  renderBrowse();renderOutlines();renderPastFiles();updateStats();
  if(repUnlocked) renderRepManage();
}
function updateStats(){$("homeStats").innerHTML="<div><strong>"+MATERIALS.length+"</strong> materials</div><div><strong>"+COURSES.length+"</strong> courses</div><div><strong>"+QUESTIONS.length+"</strong> CBT questions</div>";}
function renderBrowse(){
  if(dbError){$("browseList").innerHTML="<div class='card'>"+esc(dbError)+"</div>";$("browsePath").textContent="";return;}
  const d=$("fDept").value,l=$("fLevel").value,s=$("fSem").value,t=$("fType").value;
  const q=$("fSearch").value.trim().toUpperCase();
  const out=MATERIALS.filter(function(m){return (!d||m.dept===d)&&(!l||m.level===l)&&(!s||m.semester===s)&&(!t||m.type===t)&&(!q||(m.course+" "+m.title+" "+(m.desc||"")).toUpperCase().indexOf(q)>=0);});
  let label="Showing "+out.length+" result"+(out.length===1?"":"s");
  const parts=[];if(d)parts.push(deptCode[d]);if(l)parts.push(l+" Level");if(s)parts.push(s==="first"?"First Semester":"Second Semester");if(t)parts.push(typeName[t]);
  if(parts.length)label+=" in "+parts.join(" > ");
  $("browsePath").textContent=label;
  if(!out.length){$("browseList").innerHTML="<div class='card'>Nothing here yet. The rep has not uploaded for this filter.</div>";return;}
  $("browseList").innerHTML=out.map(function(m){
    return "<div class='card'><h4>"+esc(m.course)+" — "+esc(m.title)+"</h4><div class='meta'><span class='badge'>"+esc(pathLabel(m))+"</span><span>"+esc(m.year||"")+"</span>"+(m.fileName?"<span>"+esc(m.fileName)+"</span>":"")+"</div>"+(m.desc?"<p>"+esc(m.desc)+"</p>":"")+"<div class='actions'>"+"<button onclick=\"previewMaterial('"+m.id+"')\">Read</button><button onclick=\"downloadMaterial('"+m.id+"')\">Download</button>"+"</div></div>";
  }).join("");
}
function renderOutlines(){
  if(dbError){$("outlineList").innerHTML="<div class='card'>"+esc(dbError)+"</div>";return;}
  const d=$("cDept").value,l=$("cLevel").value,s=$("cSem").value;
  const q=$("cSearch").value.trim().toUpperCase();
  if(!d||!l||!s){$("outlineList").innerHTML="<div class='card'>Select department, level and semester above to see the courses for that section.</div>";return;}
  const out=COURSES.filter(function(o){return o.dept===d&&o.level===l&&o.semester===s&&(!q||(o.course+" "+(o.title||"")).toUpperCase().indexOf(q)>=0);});
  if(!out.length){$("outlineList").innerHTML="<div class='card'>No courses listed yet. The rep posts them each semester.</div>";return;}
  $("outlineList").innerHTML=out.map(function(o){return "<div class='card'><h4>"+esc(o.course)+(o.title?" — "+esc(o.title):"")+"</h4><div class='meta'><span class='badge'>"+esc(deptCode[o.dept]+" | "+o.level+"L | "+o.semester)+"</span></div>"+(o.body?"<p style='white-space:pre-wrap'>"+esc(o.body)+"</p>":"")+"</div>";}).join("");
}
function renderPastFiles(){
  if(dbError){$("pastFiles").innerHTML="<div class='card'>"+esc(dbError)+"</div>";return;}
  const d=$("qDept").value;
  const c=$("qCourse").value.trim().toUpperCase();
  const out=MATERIALS.filter(function(m){return (m.type==="past-question"||m.type==="exam")&&(!d||m.dept===d)&&(!c||m.course.toUpperCase()===c);});
  if(!out.length){$("pastFiles").innerHTML="<div class='card'>No past-question files for this filter yet.</div>";return;}
  $("pastFiles").innerHTML=out.map(function(m){
    return "<div class='card'><h4>"+esc(m.course)+" — "+esc(m.title)+"</h4><div class='meta'><span class='badge'>"+esc(pathLabel(m))+"</span><span>"+esc(m.year||"")+"</span>"+(m.fileName?"<span>"+esc(m.fileName)+"</span>":"")+"</div><div class='actions'>"+"<button onclick=\"previewMaterial('"+m.id+"')\">Read</button><button onclick=\"downloadMaterial('"+m.id+"')\">Download</button>"+"</div></div>";
  }).join("");
}
function findMaterial(id){return MATERIALS.find(function(x){return String(x.id)===String(id);});}
window.previewMaterial=function(id){
  const m=findMaterial(id);
  if(!m||!m.url)return;
  $("viewerTitle").textContent=m.course+" — "+m.title;
  const body=$("viewerBody");body.innerHTML="";
  if((m.fileType||"").indexOf("pdf")>=0){const f=document.createElement("iframe");f.src=m.url;body.appendChild(f);}
  else if((m.fileType||"").indexOf("image/")===0){const img=document.createElement("img");img.src=m.url;body.appendChild(img);}
  else{const p=document.createElement("p");p.style.padding="16px";p.textContent="Preview not available for "+(m.fileName||"this file")+". Use Download.";body.appendChild(p);}
  $("viewer").hidden=false;
};
window.downloadMaterial=function(id){
  const m=findMaterial(id);
  if(!m||!m.url)return;
  const a=document.createElement("a");a.href=m.url;a.target="_blank";a.rel="noopener";a.download=m.fileName||"download";document.body.appendChild(a);a.click();a.remove();
};
window.deleteMaterial=async function(id){
  if(!repUnlocked)return;
  const m=findMaterial(id);
  try{
    const r1=await sb.from("materials").delete().eq("id",id);
    if(r1.error) throw r1.error;
    if(m&&m.filePath){await sb.storage.from("materials").remove([m.filePath]);}
    await refreshAll();
  }catch(e){$("repSaveMsg").textContent="Delete failed: "+((e&&e.message)||e);}
};
window.deleteOutline=async function(id){
  if(!repUnlocked)return;
  try{const r=await sb.from("courses").delete().eq("id",id);if(r.error)throw r.error;await refreshAll();}
  catch(e){$("repSaveMsg").textContent="Delete failed: "+((e&&e.message)||e);}
};
window.deleteQuestion=async function(id){
  if(!repUnlocked)return;
  try{const r=await sb.from("questions").delete().eq("id",id);if(r.error)throw r.error;await refreshAll();}
  catch(e){$("repSaveMsg").textContent="Delete failed: "+((e&&e.message)||e);}
};
function filteredQuestions(){const d=$("qDept").value;const c=$("qCourse").value.trim().toUpperCase();return QUESTIONS.filter(function(x){return (!d||x.dept===d)&&(!c||x.course.toUpperCase()===c);});}
function startQuiz(){
  const mode=$("qMode").value;
  const count=Math.max(1,parseInt($("qCount").value||"10",10));
  const mins=Math.max(1,parseInt($("qMins").value||"10",10));
  const pool=filteredQuestions();
  if(!pool.length){$("quizArea").innerHTML="<div class='card'>No CBT questions for this filter. The rep adds them.</div>";return;}
  const sh=pool.slice().sort(function(){return Math.random()-0.5;}).slice(0,Math.min(count,pool.length));
  if(mode==="read"){
    $("quizArea").innerHTML="<h3>Read-through ("+sh.length+")</h3>"+sh.map(function(x,i){const L=["A","B","C","D"];return "<div class='card'><p><strong>Q"+(i+1)+" ("+esc(x.course)+"):</strong> "+esc(x.question)+"</p>"+x.options.map(function(o,j){return "<div class='opt"+(j===x.answer?" right":"")+"'>"+L[j]+". "+esc(o)+(j===x.answer?" OK":"")+"</div>";}).join("")+(x.explanation?"<p class='muted'>"+esc(x.explanation)+"</p>":"")+"</div>";}).join("");
    return;
  }
  quizState={items:sh,picks:new Array(sh.length).fill(-1),endAt:Date.now()+mins*60000};
  clearInterval(quizTimer);quizTimer=setInterval(tickTimer,1000);renderCBT();
}
window.startQuiz=startQuiz;
function tickTimer(){
  if(!quizState)return;
  const left=quizState.endAt-Date.now();
  if(left<=0){clearInterval(quizTimer);finishCBT();return;}
  const el=$("cbtTimer");
  if(el){const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);el.textContent=m+":"+String(s).padStart(2,"0")+" left";}
}
function renderCBT(){
  const L=["A","B","C","D"];
  $("quizArea").innerHTML="<h3>CBT — <span class='timer' id='cbtTimer'></span></h3>"+quizState.items.map(function(x,i){return "<div class='card'><p><strong>Q"+(i+1)+" ("+esc(x.course)+"):</strong> "+esc(x.question)+"</p>"+x.options.map(function(o,j){return "<label class='opt'><input type='radio' name='q"+i+"' value='"+j+"'"+(quizState.picks[i]===j?" checked":"")+" onchange=\"pickOpt("+i+","+j+")\"> "+L[j]+". "+esc(o)+"</label>";}).join("")+"</div>";}).join("")+"<button class='primary' onclick='finishCBT()'>Submit</button>";
  tickTimer();
}
window.pickOpt=function(i,j){if(quizState)quizState.picks[i]=j;};
window.finishCBT=function(){
  if(!quizState)return;
  clearInterval(quizTimer);
  let score=0;const L=["A","B","C","D"];
  const html=quizState.items.map(function(x,i){const ok=quizState.picks[i]===x.answer;if(ok)score++;return "<div class='card'><p><strong>Q"+(i+1)+":</strong> "+esc(x.question)+" — "+(ok?"Correct":"Wrong, answer "+L[x.answer])+"</p>"+x.options.map(function(o,j){return "<div class='opt"+(j===x.answer?" right":(quizState.picks[i]===j?" wrong":""))+"'>"+L[j]+". "+esc(o)+"</div>";}).join("")+(x.explanation?"<p class='muted'>"+esc(x.explanation)+"</p>":"")+"</div>";}).join("");
  $("quizArea").innerHTML="<div class='card'><h3>Score: "+score+" / "+quizState.items.length+"</h3><button onclick='startQuiz()'>Retry</button></div>"+html;
  quizState=null;
};
function renderRepManage(){
  if(!repUnlocked)return;
  $("repManage").innerHTML="<p class='muted'>"+MATERIALS.length+" uploads, "+COURSES.length+" courses, "+QUESTIONS.length+" CBT questions.</p>"+MATERIALS.slice(0,30).map(function(m){return "<div class='card'><strong>"+esc(m.course)+"</strong> — "+esc(m.title)+" <span class='muted'>"+esc(pathLabel(m))+"</span> <button onclick=\"deleteMaterial('"+m.id+"')\">Delete</button></div>";}).join("")+"<h4>Courses</h4>"+COURSES.map(function(o){return "<div class='card'>"+esc(o.course)+(o.title?" — "+esc(o.title):"")+" <button onclick=\"deleteOutline('"+o.id+"')\">Delete</button></div>";}).join("")+"<h4>CBT questions</h4>"+QUESTIONS.map(function(x){return "<div class='card'>"+esc(x.course)+": "+esc(x.question)+" <button onclick=\"deleteQuestion('"+x.id+"')\">Delete</button></div>";}).join("");
}
async function doUpload(){
  if(!repUnlocked){$("uploadMsg").textContent="Sign in as rep first.";return;}
  const f=$("uFile").files[0];
  if(!f){$("uploadMsg").textContent="Choose a file first.";return;}
  if(f.size>50*1024*1024){$("uploadMsg").textContent="File too big (max 50MB).";return;}
  const course=$("uCourse").value.trim().toUpperCase();
  const title=$("uTitle").value.trim();
  if(!course||!title){$("uploadMsg").textContent="Course + title needed.";return;}
  $("uploadMsg").textContent="Uploading…";
  try{
    const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=Date.now()+"_"+safe;
    const up=await sb.storage.from("materials").upload(path,f);
    if(up.error) throw up.error;
    const pub=sb.storage.from("materials").getPublicUrl(path);
    const ins=await sb.from("materials").insert({dept:$("uDept").value,level:$("uLevel").value,semester:$("uSem").value,type:$("uType").value,course:course,title:title,descr:$("uDesc").value.trim(),year:parseInt($("uYear").value||"2026",10),file_name:f.name,file_type:f.type||"file",file_size:f.size,url:pub.data.publicUrl,file_path:path,created_at:Date.now()});
    if(ins.error) throw ins.error;
    $("uploadMsg").textContent="Uploaded to "+deptCode[$("uDept").value]+" "+$("uLevel").value+"L "+$("uSem").value+" "+typeName[$("uType").value]+" "+course+".";
    $("uCourse").value="";$("uTitle").value="";$("uDesc").value="";$("uFile").value="";
    await refreshAll();
  }catch(e){$("uploadMsg").textContent="Upload failed: "+((e&&e.message)||e);}
}
function setRepUI(user){
  repUnlocked=!!user;
  $("repArea").hidden=!repUnlocked;
  $("repLockBtn").hidden=!repUnlocked;
  $("loginBox").hidden=repUnlocked;
  $("repMsg").textContent=repUnlocked?("Signed in as "+(user.email||"rep")+"."):"";
  if(repUnlocked) renderRepManage();
  renderBrowse();renderPastFiles();renderOutlines();
}
function init(){
  $("browseList").innerHTML="<div class='card'>Loading…</div>";
  $("outlineList").innerHTML="<div class='card'>Loading…</div>";
  $("pastFiles").innerHTML="<div class='card'>Loading…</div>";
  const tabs=document.querySelectorAll(".tabs button");
  tabs.forEach(function(b){b.addEventListener("click",function(){tabs.forEach(function(x){x.classList.remove("active");});b.classList.add("active");document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});$("tab-"+b.dataset.tab).classList.add("active");});});
  document.querySelectorAll("[data-goto]").forEach(function(b){b.addEventListener("click",function(){document.querySelector(".tabs button[data-tab='"+b.dataset.goto+"']").click();window.scrollTo(0,0);});});
  ["fDept","fLevel","fSem","fType"].forEach(function(id){$(id).addEventListener("change",renderBrowse);});
  $("fSearch").addEventListener("input",renderBrowse);
  ["cDept","cLevel","cSem"].forEach(function(id){$(id).addEventListener("change",renderOutlines);});
  $("cSearch").addEventListener("input",renderOutlines);
  $("qDept").addEventListener("change",renderPastFiles);
  $("qCourse").addEventListener("input",renderPastFiles);
  $("viewerClose").addEventListener("click",function(){$("viewer").hidden=true;$("viewerBody").innerHTML="";});
  $("viewer").addEventListener("click",function(e){if(e.target.id==="viewer"){$("viewer").hidden=true;$("viewerBody").innerHTML="";}});
  $("qStartBtn").addEventListener("click",startQuiz);
  $("uUploadBtn").addEventListener("click",doUpload);
  $("repUnlockBtn").addEventListener("click",async function(){
    const em=$("repEmail").value.trim(),pw=$("repPass").value;
    if(!em||!pw){$("repMsg").textContent="Enter rep email + password.";return;}
    $("repMsg").textContent="Signing in…";
    const r=await sb.auth.signInWithPassword({email:em,password:pw});
    if(r.error){$("repMsg").textContent="Sign-in failed: "+r.error.message;}
  });
  $("repLockBtn").addEventListener("click",async function(){await sb.auth.signOut();});
  $("oSaveBtn").addEventListener("click",async function(){
    if(!repUnlocked)return;
    const course=$("oCourse").value.trim().toUpperCase();
    if(!course){$("repSaveMsg").textContent="Course code needed, e.g. CSC 412.";return;}
    try{
      const q=await sb.from("courses").select("id").eq("course",course).eq("dept",$("oDept").value).eq("level",$("oLevel").value).eq("semester",$("oSem").value).limit(1);
      if(q.error) throw q.error;
      const data={dept:$("oDept").value,level:$("oLevel").value,semester:$("oSem").value,course:course,title:$("oTitle").value.trim(),body:$("oBody").value,updated_at:Date.now()};
      if(q.data.length){const u=await sb.from("courses").update(data).eq("id",q.data[0].id);if(u.error)throw u.error;}
      else{data.created_at=Date.now();const ins=await sb.from("courses").insert(data);if(ins.error)throw ins.error;}
      $("repSaveMsg").textContent="Saved "+course+".";
      $("oCourse").value="";$("oTitle").value="";$("oBody").value="";
      await refreshAll();
    }catch(e){$("repSaveMsg").textContent="Save failed: "+((e&&e.message)||e);}
  });
  $("nSaveBtn").addEventListener("click",async function(){
    if(!repUnlocked)return;
    const course=$("nCourse").value.trim().toUpperCase();
    if(!course||!$("nQ").value.trim()){$("repSaveMsg").textContent="Course + question needed.";return;}
    try{
      const ins=await sb.from("questions").insert({dept:$("nDept").value,level:$("nLevel").value,semester:$("nSem").value,course:course,question:$("nQ").value.trim(),options:[$("nA").value.trim(),$("nB").value.trim(),$("nC").value.trim(),$("nD").value.trim()],answer:parseInt($("nAns").value,10),explanation:$("nExp").value.trim(),created_at:Date.now()});
      if(ins.error) throw ins.error;
      $("repSaveMsg").textContent="Added to "+course+".";
      ["nQ","nA","nB","nC","nD","nExp"].forEach(function(id){$(id).value="";});
      await refreshAll();
    }catch(e){$("repSaveMsg").textContent="Save failed: "+((e&&e.message)||e);}
  });
  sb.auth.onAuthStateChange(function(ev,session){setRepUI(session&&session.user);});
  sb.auth.getSession().then(function(r){setRepUI(r.data.session&&r.data.session.user);});
  refreshAll();
}
document.addEventListener("DOMContentLoaded",init);
