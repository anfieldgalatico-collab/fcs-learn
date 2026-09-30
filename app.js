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
let AIQ=[];
async function aiCall(prompt){
  try{
    const r=await fetch("https://text.pollinations.ai/openai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"openai",messages:[{role:"user",content:prompt}]})});
    if(r.ok){const j=await r.json();const t=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;if(t)return t;}
  }catch(e){}
  const r2=await fetch("https://text.pollinations.ai/"+encodeURIComponent(prompt.slice(0,4000))+"?model=openai");
  if(!r2.ok) throw new Error("AI service busy (HTTP "+r2.status+"). Try again.");
  const t2=await r2.text();
  if(!t2) throw new Error("Empty AI reply. Try again.");
  return t2;
}
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve();
  return new Promise(function(res,rej){
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res();};
    s.onerror=function(){rej(new Error("PDF reader failed to load."));};
    document.head.appendChild(s);
  });
}
async function aiGetText(){
  const f=$("aiFile").files[0];
  const pasted=$("aiInput").value.trim();
  if(f){
    if(/\.txt$/i.test(f.name)||f.type.indexOf("text")===0) return await f.text();
    if(/\.pdf$/i.test(f.name)||f.type==="application/pdf"){
      await loadPdfJs();
      const buf=await f.arrayBuffer();
      const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;
      let out="";
      const n=Math.min(pdf.numPages,20);
      for(let i=1;i<=n;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();out+=tc.items.map(function(it){return it.str;}).join(" ")+"\n";}
      return out.trim();
    }
    throw new Error("AI accepts pasted text, .txt or .pdf only.");
  }
  if(pasted) return pasted;
  throw new Error("Paste notes or upload a PDF/TXT first.");
}
function aiBusy(on,msg){$("aiExplainBtn").disabled=on;$("aiGenBtn").disabled=on;$("aiMsg").textContent=on?(msg||"AI is thinking…"):msg||"";}
function aiSolveBusy(on,msg){["aiExplainBtn","aiGenBtn","aiSolveBtn"].forEach(function(id){var b=$(id);if(b)b.disabled=on;});$("aiMsg").textContent=on?(msg||"AI is solving…"):msg||"";}
async function aiSolve(){
  try{
    aiSolveBusy(true,"AI is solving…");
    $("aiResult").hidden=true;
    const text=(await aiGetText()).slice(0,12000);
    const out=await aiCall(AI_STYLE+"You are a study tutor for Nigerian university computer science students. Solve every question in the following assignment step by step. Give the final answer for each numbered question clearly, with short workings where needed. Assignment:\n\n"+text);
    $("aiResult").innerHTML="<h3>Solution</h3><p style='white-space:pre-wrap'>"+esc(aiClean(out))+"</p>";
    $("aiResult").hidden=false;
    aiSolveBusy(false,"");
  }catch(e){aiSolveBusy(false,"");$("aiMsg").textContent="Failed: "+((e&&e.message)||e);}
}
function aiClean(t){
  return String(t).split("\n").map(function(line){
    let s=line.replace(/^#{1,6}\s*/,"").replace(/^\s*[-*]\s+/,"").replace(/\*\*(.*?)\*\*/g,"$1").replace(/__([^_]+)__/g,"$1").replace(/`([^`]*)`/g,"$1").replace(/^\s*>\s?/,"").trim();
    return s;
  }).filter(function(s,i,a){return s!==""||(a[i-1]!==""&&a[i+1]!=="");}).join("\n").replace(/\n{3,}/g,"\n\n").trim();
}
const AI_STYLE="Reply in PLAIN TEXT ONLY. No markdown, no # headings, no * or - bullets, no bold, no code blocks. Use short paragraphs separated by blank lines. Number key points like 1) 2) 3). ";
async function aiExplain(){
  try{
    aiBusy(true,"AI is breaking it down…");
    $("aiResult").hidden=true;
    const text=(await aiGetText()).slice(0,12000);
    const out=await aiCall(AI_STYLE+"You are a study tutor for Nigerian university computer science students. Explain the following lecture notes simply and clearly: key ideas first, then the details, then 3 likely exam takeaways. Notes:\n\n"+text);
    $("aiResult").innerHTML="<h3>Breakdown</h3><p style='white-space:pre-wrap'>"+esc(aiClean(out))+"</p>";
    $("aiResult").hidden=false;
    aiBusy(false,"");
  }catch(e){aiBusy(false,"");$("aiMsg").textContent="Failed: "+((e&&e.message)||e);}
}
function aiTryParse(s){
  try{return JSON.parse(s);}catch(e){}
  try{return JSON.parse(s.replace(/,\s*([}\]])/g,"$1"));}catch(e){}
  let t=s.replace(/,\s*([}\]])/g,"$1");
  for(let k=0;k<20;k++){
    const i=t.lastIndexOf("},");
    if(i<0) break;
    t=t.slice(0,i+1)+"]";
    try{return JSON.parse(t);}catch(e){t=t.slice(0,i)+"]";try{return JSON.parse(t);}catch(e2){}}
  }
  throw new Error("AI reply was not clean JSON. Press Generate again.");
}
function aiParseQuestions(raw){
  let s=raw;
  const fence=s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fence) s=fence[1];
  const arr=s.match(/\[[\s\S]*\]/);
  if(arr) s=arr[0];
  const data=aiTryParse(s);
  if(!Array.isArray(data)||!data.length) throw new Error("AI returned no questions.");
  return data.slice(0,20).map(function(d,i){
    if(!d.q||!Array.isArray(d.options)||d.options.length!==4) throw new Error("Bad question format at #"+(i+1)+".");
    const a=parseInt(d.answer,10);
    if(!(a>=0&&a<=3)) throw new Error("Bad answer index at #"+(i+1)+".");
    return {question:String(d.q),options:d.options.map(String),answer:a,explanation:String(d.explanation||"")};
  });
}
async function aiFetchDraft(materialText,label){
  let last=null;
  for(let a=0;a<2;a++){
    const raw=await aiCall("Write exactly 8 multiple-choice CBT questions from these "+label+". Reply with ONLY a JSON array of 8 items, no other text. Strict valid JSON: double quotes only, no trailing commas, keep each explanation under 15 words. Each item: {\"q\": question, \"options\": [exactly 4 short strings], \"answer\": 0-3 index of correct option, \"explanation\": short}. Materials:\n\n"+materialText);
    try{
      const items=aiParseQuestions(raw);
      if(items.length>=3) return items;
      last=items;
    }catch(e){last=null;}
  }
  if(last&&last.length) return last;
  throw new Error("AI returned too few questions. Try again.");
}
async function aiGenerate(){
  try{
    aiBusy(true,"AI is drafting CBT questions…");
    $("aiQuizBox").hidden=true;
    const text=(await aiGetText()).slice(0,12000);
    AIQ=await aiFetchDraft(text,"lecture notes");
    aiRenderDraft();
    $("aiQuizBox").hidden=false;
    aiBusy(false,"Draft ready. Read, practice, or ask the rep to approve.");
  }catch(e){aiBusy(false,"");$("aiMsg").textContent="Failed: "+((e&&e.message)||e);}
}
function aiRenderDraft(){
  const L=["A","B","C","D"];
  $("aiQuizArea").innerHTML=AIQ.map(function(x,i){return "<div class='card'><p><strong>Q"+(i+1)+":</strong> "+esc(x.question)+"</p>"+x.options.map(function(o,j){return "<div class='opt"+(j===x.answer?" right":"")+"'>"+L[j]+". "+esc(o)+"</div>";}).join("")+(x.explanation?"<p class='muted'>"+esc(x.explanation)+"</p>":"")+"</div>";}).join("");
}
let aiTimer=null,aiPicks=[],aiEnd=0;
function aiPractice(){
  if(!AIQ.length) return;
  aiPicks=new Array(AIQ.length).fill(-1);
  aiEnd=Date.now()+Math.max(1,parseInt($("aiMins").value||"5",10))*60000;
  clearInterval(aiTimer);aiTimer=setInterval(aiTick,1000);
  const L=["A","B","C","D"];
  $("aiQuizArea").innerHTML="<h3>Timed practice — <span class='timer' id='aiTimerEl'></span></h3>"+AIQ.map(function(x,i){return "<div class='card'><p><strong>Q"+(i+1)+":</strong> "+esc(x.question)+"</p>"+x.options.map(function(o,j){return "<label class='opt'><input type='radio' name='aiq"+i+"' onchange=\"aiPick("+i+","+j+")\"> "+L[j]+". "+esc(o)+"</label>";}).join("")+"</div>";}).join("")+"<button class='primary' onclick='aiSubmit()'>Submit</button>";
  aiTick();
}
function aiTick(){
  const left=aiEnd-Date.now();
  if(left<=0){clearInterval(aiTimer);aiSubmit();return;}
  const el=$("aiTimerEl");
  if(el){el.textContent=Math.floor(left/60000)+":"+String(Math.floor((left%60000)/1000)).padStart(2,"0")+" left";}
}
window.aiPick=function(i,j){aiPicks[i]=j;};
window.aiSubmit=function(){
  clearInterval(aiTimer);
  let score=0;const L=["A","B","C","D"];
  const html=AIQ.map(function(x,i){const ok=aiPicks[i]===x.answer;if(ok)score++;return "<div class='card'><p><strong>Q"+(i+1)+":</strong> "+esc(x.question)+" — "+(ok?"Correct":"Wrong, answer "+L[x.answer])+"</p></div>";}).join("");
  $("aiQuizArea").innerHTML="<div class='card'><h3>Score: "+score+" / "+AIQ.length+"</h3><button onclick='aiRenderDraft()'>Back to draft</button></div>"+html;
};
async function aiUploadContext(){
  const d=$("aiUDept").value,l=$("aiULevel").value,s=$("aiUSem").value,c=$("aiUCourse").value.trim().toUpperCase();
  if(!c) throw new Error("Enter a course code first.");
  const list=MATERIALS.filter(function(m){return m.dept===d&&m.level===l&&m.semester===s&&m.course.toUpperCase()===c&&m.url;});
  if(!list.length) throw new Error("No uploaded files for "+c+" in this section yet.");
  const oc=COURSES.find(function(o){return o.course.toUpperCase()===c;});
  let ctx=list.map(function(m){return m.course+" — "+m.title+(m.desc?": "+m.desc:"");}).join("\n");
  if(oc&&(oc.title||oc.body)) ctx+="\nCourse info: "+oc.course+" "+(oc.title||"")+" "+(oc.body||"");
  const chunks=[];let skipped=0;
  for(const m of list.slice(0,4)){
    try{
      if((m.fileType||"").indexOf("pdf")>=0){
        await loadPdfJs();
        const buf=await (await fetch(m.url)).arrayBuffer();
        const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;
        let t="";
        const n=Math.min(pdf.numPages,8);
        for(let i=1;i<=n;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();t+=tc.items.map(function(it){return it.str;}).join(" ")+"\n";}
        if(t.trim()) chunks.push("From "+(m.fileName||m.title)+":\n"+t); else skipped++;
      }else if((m.fileType||"").indexOf("text")===0||/\.txt$/i.test(m.fileName||"")){
        const t=await (await fetch(m.url)).text();
        if(t.trim()) chunks.push("From "+(m.fileName||m.title)+":\n"+t); else skipped++;
      }else skipped++;
    }catch(e){skipped++;}
  }
  return {text:(ctx+"\n"+chunks.join("\n")).slice(0,12000),d:d,l:l,s:s,c:c,files:list.length,skipped:skipped};
}
async function aiUpExplain(){
  try{
    $("aiUpMsg").textContent="Reading uploads…";
    const u=await aiUploadContext();
    $("aiUpMsg").textContent="AI is breaking it down…";
    const out=await aiCall(AI_STYLE+"You are a study tutor for Nigerian university computer science students. From these course materials for "+u.c+": key ideas first, then the details, then 3 likely exam takeaways. Materials:\n\n"+u.text);
    $("aiResult").innerHTML="<h3>Breakdown: "+esc(u.c)+"</h3><p style='white-space:pre-wrap'>"+esc(aiClean(out))+"</p>";
    $("aiResult").hidden=false;
    $("aiUpMsg").textContent="Done — read "+u.files+" file"+(u.files===1?"":"s")+(u.skipped?"; "+u.skipped+" skipped (images/DOC, AI reads text/PDF only)":"")+".";
  }catch(e){$("aiUpMsg").textContent="Failed: "+((e&&e.message)||e);}
}
async function aiUpGen(){
  try{
    $("aiUpMsg").textContent="Reading uploads…";
    const u=await aiUploadContext();
    $("aiUpMsg").textContent="AI is drafting CBT questions…";
    $("aiQuizBox").hidden=true;
    AIQ=await aiFetchDraft(u.text,"course materials for "+u.c);
    $("aiDept").value=u.d;$("aiLevel").value=u.l;$("aiSem").value=u.s;$("aiCourse").value=u.c;
    aiRenderDraft();
    $("aiQuizBox").hidden=false;
    $("aiUpMsg").textContent="Draft ready from "+u.files+" file"+(u.files===1?"":"s")+(u.skipped?"; "+u.skipped+" skipped":"")+". Read, practice, or ask the rep to approve.";
  }catch(e){$("aiUpMsg").textContent="Failed: "+((e&&e.message)||e);}
}
async function aiUpSolve(){
  try{
    $("aiUpMsg").textContent="Reading uploads…";
    const u=await aiUploadContext();
    $("aiUpMsg").textContent="AI is solving…";
    const out=await aiCall(AI_STYLE+"You are a study tutor for Nigerian university computer science students. Solve every question in these course materials for "+u.c+" step by step. Give the final answer for each numbered question clearly, with short workings where needed. Materials:\n\n"+u.text);
    $("aiResult").innerHTML="<h3>Solution: "+esc(u.c)+"</h3><p style='white-space:pre-wrap'>"+esc(aiClean(out))+"</p>";
    $("aiResult").hidden=false;
    $("aiUpMsg").textContent="Done — solved from "+u.files+" file"+(u.files===1?"":"s")+".";
  }catch(e){$("aiUpMsg").textContent="Failed: "+((e&&e.message)||e);}
}
async function aiSave(){
  if(!repUnlocked){$("aiSaveMsg").textContent="Only the signed-in rep can approve to the bank.";return;}  const course=$("aiCourse").value.trim().toUpperCase();
  if(!course||!AIQ.length){$("aiSaveMsg").textContent="Draft questions + course code needed.";return;}
  $("aiSaveMsg").textContent="Saving…";
  try{
    for(const x of AIQ){
      const ins=await sb.from("questions").insert({dept:$("aiDept").value,level:$("aiLevel").value,semester:$("aiSem").value,course:course,question:x.question,options:x.options,answer:x.answer,explanation:x.explanation,created_at:Date.now()});
      if(ins.error) throw ins.error;
    }
    $("aiSaveMsg").textContent="Approved "+AIQ.length+" questions to "+course+". They now show under Past Questions.";
    await refreshAll();
  }catch(e){$("aiSaveMsg").textContent="Save failed: "+((e&&e.message)||e);}
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
  $("aiExplainBtn").addEventListener("click",aiExplain);
  $("aiGenBtn").addEventListener("click",aiGenerate);
  $("aiReadBtn").addEventListener("click",aiRenderDraft);
  $("aiCbtBtn").addEventListener("click",aiPractice);
  $("aiSaveBtn").addEventListener("click",aiSave);
  $("aiUpExplainBtn").addEventListener("click",aiUpExplain);
  $("aiUpGenBtn").addEventListener("click",aiUpGen);
  if($("aiUpSolveBtn"))$("aiUpSolveBtn").addEventListener("click",aiUpSolve);
  if($("aiSolveBtn"))$("aiSolveBtn").addEventListener("click",aiSolve);
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
