// Reports from visitors' browsers when the site's own JavaScript fails. Older phones can
// fail without anyone seeing why, so a tiny script sends the error text to the server,
// where it is written to the logs. It sends no cookies, names, phone numbers or
// anything typed by the visitor: only the error text, the page path and the browser name.

export interface ClientErrorReport {
  kind: string;
  message: string;
  source: string;
  line: number;
  col: number;
  page: string;
  ua: string;
}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max) : "";

const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 0), 1_000_000) : 0;

/** Keeps only the known fields, cut to a safe length. Returns null when there is nothing useful. */
export function parseClientError(input: unknown): ClientErrorReport | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const kind = text(value.kind, 12);
  const message = text(value.message, 300);
  if (!["error", "promise", "resource"].includes(kind) || !message) return null;
  return {
    kind, message, source: text(value.source, 200), line: count(value.line), col: count(value.col),
    page: text(value.page, 120), ua: text(value.ua, 220),
  };
}

// Plain old JavaScript (no arrow functions, let, const or template strings) so it runs on
// any phone, including the ones it is meant to report about. Sends at most three reports
// per page view.
export const clientErrorScript = `(function(){
var sent=0;
function send(kind,message,source,line,col){
if(sent>=3)return;
sent++;
try{
var x=new XMLHttpRequest();
x.open("POST","/api/client-error",true);
x.setRequestHeader("Content-Type","application/json");
x.send(JSON.stringify({kind:kind,message:String(message),source:String(source||""),line:line||0,col:col||0,page:location.pathname,ua:navigator.userAgent}));
}catch(e){}
}
window.addEventListener("error",function(e){
var t=e&&e.target;
if(t&&t!==window&&(t.src||t.href)){send("resource","failed to load "+(t.src||t.href),"",0,0);return;}
send("error",(e&&e.message)||"unknown error",e&&e.filename,e&&e.lineno,e&&e.colno);
},true);
window.addEventListener("unhandledrejection",function(e){
var r=e&&e.reason;
send("promise",(r&&r.message)?r.message:String(r),"",0,0);
});
})();`;
