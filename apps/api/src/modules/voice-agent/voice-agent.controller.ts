import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { VoiceAgentService } from "./voice-agent.service";

@Controller("voice-agent")
export class VoiceAgentController {
  constructor(private readonly svc: VoiceAgentService) {}

  // ── PUBLIC ROUTES (embedded widget calls these — no auth) ──

  @Get("config/:embedKey")
  @Public()
  getConfig(@Param("embedKey") embedKey: string) {
    return this.svc.getConfigByEmbedKey(embedKey);
  }

  @Post("session")
  @Public()
  async createSession(
    @Body()
    body: {
      embedKey: string;
      channel?: string;
      visitorInfo?: { name?: string; phone?: string; email?: string };
    },
  ) {
    const config = await this.svc.getConfigByEmbedKey(body.embedKey);
    return this.svc.createSession(
      config.tenantId,
      body.channel ?? "WEB_WIDGET",
      body.visitorInfo,
    );
  }

  @Post("chat")
  @Public()
  async chat(
    @Body()
    body: {
      sessionToken: string;
      embedKey: string;
      message: string;
    },
  ) {
    const config = await this.svc.getConfigByEmbedKey(body.embedKey);
    return this.svc.chat(body.sessionToken, body.message, config.tenantId);
  }

  @Get("session/:sessionToken")
  @Public()
  async getSession(
    @Param("sessionToken") token: string,
    @Query("embedKey") embedKey: string,
  ) {
    const config = await this.svc.getConfigByEmbedKey(embedKey);
    return this.svc.getSessionHistory(token, config.tenantId);
  }

  // ── Serve embeddable JS widget ──
  @Get("embed.js")
  @Public()
  serveWidget(@Query("key") embedKey: string, @Res() res: Response) {
    const script = generateWidgetScript(embedKey);
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(script);
  }

  // ── ADMIN ROUTES (require JWT) ──

  @Get("widget-config")
  @UseGuards(JwtAuthGuard, TenantGuard)
  getWidgetConfig(@TenantId() tenantId: string) {
    return this.svc.getWidgetConfig(tenantId);
  }

  @Post("widget-config")
  @UseGuards(JwtAuthGuard, TenantGuard)
  saveWidgetConfig(
    @Body() body: Record<string, unknown>,
    @TenantId() tenantId: string,
  ) {
    return this.svc.saveWidgetConfig(tenantId, body);
  }

  @Post("widget-config/publish")
  @UseGuards(JwtAuthGuard, TenantGuard)
  publishWidget(@TenantId() tenantId: string) {
    return this.svc.publishWidget(tenantId);
  }

  @Get("analytics")
  @UseGuards(JwtAuthGuard, TenantGuard)
  analytics(@TenantId() tenantId: string) {
    return this.svc.getAgentAnalytics(tenantId);
  }
}

// ── Inline widget JS (served as /voice-agent/embed.js?key=EMBED_KEY) ──
function generateWidgetScript(embedKey: string): string {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  return `(function(){
'use strict';
var EK='${embedKey}',AB='${apiBase}',SK='delvion_s_'+EK;
var st=document.createElement('style');
st.textContent=\`
#dv-btn{position:fixed;bottom:24px;right:24px;z-index:9999;width:60px;height:60px;border-radius:50%;
background:linear-gradient(135deg,#0d7377,#14a085);border:none;cursor:pointer;
box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;
transition:transform .2s;color:#fff;font-size:24px}
#dv-btn:hover{transform:scale(1.1)}
#dv-panel{position:fixed;bottom:96px;right:24px;z-index:9999;width:380px;height:560px;
border-radius:20px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.2);
display:none;flex-direction:column;overflow:hidden;font-family:'Inter',system-ui,sans-serif}
#dv-panel.open{display:flex}
.dv-hdr{padding:16px 20px;background:linear-gradient(135deg,#0d4f52,#0d7377);color:#fff;
display:flex;align-items:center;gap:10px}
.dv-av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);
display:flex;align-items:center;justify-content:center;font-size:18px}
.dv-ht h4{font-weight:700;font-size:14px;margin:0}
.dv-ht p{font-size:11px;opacity:.8;margin:0}
.dv-cl{margin-left:auto;background:0;border:0;color:#fff;cursor:pointer;font-size:20px;opacity:.8}
.dv-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.dv-m{max-width:80%;padding:10px 14px;border-radius:18px;font-size:13px;line-height:1.5}
.dv-m.a{background:#f3f4f6;color:#111;align-self:flex-start;border-bottom-left-radius:4px}
.dv-m.u{background:linear-gradient(135deg,#0d7377,#14a085);color:#fff;
align-self:flex-end;border-bottom-right-radius:4px}
.dv-tp{display:flex;gap:4px;padding:10px 14px;background:#f3f4f6;border-radius:18px;width:fit-content}
.dv-tp span{width:6px;height:6px;background:#9ca3af;border-radius:50%;animation:dvb 1.2s infinite}
.dv-tp span:nth-child(2){animation-delay:.2s}.dv-tp span:nth-child(3){animation-delay:.4s}
@keyframes dvb{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
.dv-ch{padding:0 16px 8px;display:flex;flex-wrap:wrap;gap:6px}
.dv-cp{padding:6px 12px;border:1px solid #0d7377;border-radius:20px;font-size:12px;
color:#0d7377;cursor:pointer;background:#f0fdfd;transition:all .15s}
.dv-cp:hover{background:#0d7377;color:#fff}
.dv-ia{padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;align-items:center;gap:8px}
.dv-in{flex:1;border:1px solid #e5e7eb;border-radius:24px;padding:8px 16px;font-size:13px;outline:0}
.dv-in:focus{border-color:#0d7377}
.dv-sb{width:36px;height:36px;border-radius:50%;background:#0d7377;border:0;cursor:pointer;
color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center}
.dv-vb{width:36px;height:36px;border-radius:50%;background:#f3f4f6;border:0;cursor:pointer;
font-size:16px;display:flex;align-items:center;justify-content:center}
.dv-vb.rec{background:#fee2e2;animation:dvp 1s infinite}
@keyframes dvp{0%,100%{opacity:1}50%{opacity:.6}}
\`;document.head.appendChild(st);
var sT=localStorage.getItem(SK),cfg=null;
fetch(AB+'/voice-agent/config/'+EK).then(function(r){return r.json()}).then(function(d){
cfg=d.data||d;bw()}).catch(function(){bw()});
function bw(){
var b=document.createElement('button');b.id='dv-btn';b.innerHTML='\\u{1F9EC}';b.title='Lab Assistant';
document.body.appendChild(b);
var p=document.createElement('div');p.id='dv-panel';
p.innerHTML='<div class="dv-hdr"><div class="dv-av">\\u{1F9EC}</div><div class="dv-ht"><h4>'
+(cfg&&cfg.labName||'Lab Assistant')+'</h4><p>Online \\u00B7 Replies instantly</p></div>'
+'<button class="dv-cl">\\u00D7</button></div>'
+'<div class="dv-msgs" id="dv-ms"></div><div class="dv-ch" id="dv-cs"></div>'
+'<div class="dv-ia"><button class="dv-vb" id="dv-vc" title="Voice">\\u{1F3A4}</button>'
+'<input class="dv-in" id="dv-ip" placeholder="Type your question..." />'
+'<button class="dv-sb" id="dv-sd">\\u27A4</button></div>';
document.body.appendChild(p);
b.onclick=function(){p.classList.toggle('open');if(p.classList.contains('open')&&!sT)is()};
p.querySelector('.dv-cl').onclick=function(){p.classList.remove('open')};
var ip=document.getElementById('dv-ip');
ip.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sm()}};
document.getElementById('dv-sd').onclick=sm;
document.getElementById('dv-vc').onclick=tv;
if(cfg&&cfg.greetingMessage){setTimeout(function(){am('a',cfg.greetingMessage)},300);
sc(['Book appointment','Check test prices','Report status','Symptoms'])}}
function is(){fetch(AB+'/voice-agent/session',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({embedKey:EK,channel:'WEB_WIDGET'})}).then(function(r){return r.json()})
.then(function(d){sT=(d.data||d).sessionToken;localStorage.setItem(SK,sT)})}
function sm(t){var ip=document.getElementById('dv-ip');var msg=t||ip.value.trim();if(!msg)return;
if(!t)ip.value='';am('u',msg);sc([]);st2();if(!sT){is();setTimeout(function(){dc(msg)},800)}else dc(msg)}
function dc(msg){fetch(AB+'/voice-agent/chat',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({embedKey:EK,sessionToken:sT,message:msg})}).then(function(r){return r.json()})
.then(function(d){ht();var r=d.data||d;am('a',r.reply);if(r.suggestions&&r.suggestions.length)sc(r.suggestions);
if(cfg&&cfg.enableVoice&&window.speechSynthesis){var u=new SpeechSynthesisUtterance(r.reply);u.rate=1;
window.speechSynthesis.speak(u)}}).catch(function(){ht();am('a','Sorry, connection issue. Please try again.')})}
function am(r,t){var ms=document.getElementById('dv-ms');var d=document.createElement('div');
d.className='dv-m '+r;d.textContent=t;ms.appendChild(d);ms.scrollTop=ms.scrollHeight}
var te=null;function st2(){var ms=document.getElementById('dv-ms');te=document.createElement('div');
te.className='dv-tp';te.innerHTML='<span></span><span></span><span></span>';ms.appendChild(te);
ms.scrollTop=ms.scrollHeight}function ht(){if(te){te.remove();te=null}}
function sc(cs){var el=document.getElementById('dv-cs');el.innerHTML='';
cs.forEach(function(c){var b=document.createElement('button');b.className='dv-cp';b.textContent=c;
b.onclick=function(){sm(c)};el.appendChild(b)})}
var mr=null,ac=[],ir=false;
function tv(){if(!navigator.mediaDevices){if(window.SpeechRecognition||window.webkitSpeechRecognition){
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;var sr=new SR();sr.lang='en-IN';
sr.onresult=function(e){sm(e.results[0][0].transcript)};sr.start();
var vb=document.getElementById('dv-vc');vb.classList.add('rec');vb.textContent='\\u23F9';ir=true;
sr.onend=function(){vb.classList.remove('rec');vb.textContent='\\u{1F3A4}';ir=false}}return}
var vb=document.getElementById('dv-vc');
if(ir){mr.stop();vb.classList.remove('rec');vb.textContent='\\u{1F3A4}';ir=false}else{
navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){ac=[];
mr=new MediaRecorder(s);mr.ondataavailable=function(e){ac.push(e.data)};
mr.onstop=function(){var bl=new Blob(ac,{type:'audio/webm'});
if(window.SpeechRecognition||window.webkitSpeechRecognition){var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
var sr=new SR();sr.lang='en-IN';sr.onresult=function(e){sm(e.results[0][0].transcript)};sr.start()}
s.getTracks().forEach(function(t){t.stop()})};mr.start();
vb.classList.add('rec');vb.textContent='\\u23F9';ir=true}).catch(function(){
if(window.SpeechRecognition||window.webkitSpeechRecognition){var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
var sr=new SR();sr.lang='en-IN';sr.onresult=function(e){sm(e.results[0][0].transcript)};sr.start();
vb.classList.add('rec');vb.textContent='\\u23F9';ir=true;
sr.onend=function(){vb.classList.remove('rec');vb.textContent='\\u{1F3A4}';ir=false}}})}}
})();`;
}
