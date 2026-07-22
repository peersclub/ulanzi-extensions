import { currentSession, listSessions } from "@ulanzi-lab/broker";
const cur = currentSession("claude-code");
console.log("current ->", cur.name, "| status:", cur.status, "| ctx:", cur.contextPct+"%", "| live:", cur.liveCount);
console.log("expected: ulanzi-lab (A interacted; B only did a background tool tick)");
