import { currentSession } from "@ulanzi-lab/broker";
const t0 = Date.now();
let last = "";
let switches = 0;
const iv = setInterval(() => {
  const c = currentSession("claude-code");
  const key = c ? `${c.name}${c.pinned ? "📌" : ""}` : "none";
  if (key !== last) {
    if (last) switches++;
    console.log(`+${Math.round((Date.now() - t0) / 1000)}s  deck -> ${key}`);
    last = key;
  }
  if (Date.now() - t0 > 180000) {
    clearInterval(iv);
    console.log(`DONE: ${switches} switches observed in 3 minutes`);
    process.exit(0);
  }
}, 500);
