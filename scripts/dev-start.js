#!/usr/bin/env node
/**
 * Cross-platform Dev-Launcher fuer Central Control Dashboard.
 *
 * Logik:
 *  1. Pruefe Backend-Port (Default 3001) und Frontend-Port (Default 3000).
 *  2. Falls belegt: ermittle PID und CommandLine.
 *     - Gehoert der Prozess zu DIESEM Workspace -> kill (Zombie-Reste).
 *     - Gehoert er zu einem anderen Programm -> waehle naechsten freien Port.
 *  3. Starte Backend und Frontend mit den ermittelten Ports und
 *     setze REACT_APP_API_URL korrekt, damit das Frontend findet.
 */
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';
const DEFAULT_BACKEND_PORT = parseInt(process.env.PORT || '3001', 10);
const DEFAULT_FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '3000', 10);
const MAX_PORT_SCAN = 20;

function log(...a) { console.log('[dev-start]', ...a); }
function warn(...a) { console.warn('[dev-start]', ...a); }

/** Prueft ob ein TCP-Port lokal belegt ist. */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => resolve(err.code === 'EADDRINUSE'))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port, '127.0.0.1');
  });
}

/** Liefert PIDs, die auf einem Port lauschen (Windows + Unix). */
function getPidsOnPort(port) {
  if (IS_WIN) {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
    if (out.status !== 0) return [];
    const pids = new Set();
    for (const line of out.stdout.split(/\r?\n/)) {
      // Bsp:  TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    12345
      const m = line.match(/\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (m && parseInt(m[1], 10) === port) pids.add(parseInt(m[2], 10));
    }
    return Array.from(pids);
  } else {
    const out = spawnSync('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    if (out.status !== 0) return [];
    return out.stdout.split(/\s+/).filter(Boolean).map(p => parseInt(p, 10));
  }
}

/** Liefert die CommandLine eines Prozesses (Windows: WMIC/CIM, Unix: ps). */
function getProcessCommandLine(pid) {
  if (IS_WIN) {
    const ps = spawnSync('powershell', [
      '-NoProfile', '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`
    ], { encoding: 'utf8' });
    return (ps.stdout || '').trim();
  } else {
    const out = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
    return (out.stdout || '').trim();
  }
}

function killPid(pid) {
  try {
    if (IS_WIN) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
      setTimeout(() => { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }, 1500);
    }
    return true;
  } catch (_) { return false; }
}

/** Pruefe, ob ein Prozess zu unserem Workspace gehoert (anhand Pfad/Hinweisen). */
function isOurProcess(cmdLine) {
  if (!cmdLine) return false;
  const lower = cmdLine.toLowerCase();
  const root = ROOT.toLowerCase().replace(/\\/g, '/');
  const lower2 = lower.replace(/\\/g, '/');
  return (
    lower2.includes(root) ||
    lower2.includes('server/index.js') ||
    lower2.includes('server\\index.js') ||
    lower2.includes('react-scripts start') ||
    lower2.includes('react-scripts/scripts/start')
  );
}

/** Stellt sicher, dass der Port frei ist. Returns: { port, freed }. */
async function ensurePort(label, desiredPort) {
  if (!(await isPortInUse(desiredPort))) {
    return { port: desiredPort, freed: false };
  }
  const pids = getPidsOnPort(desiredPort);
  log(`Port ${desiredPort} (${label}) belegt von PID(s): ${pids.join(', ') || 'unbekannt'}`);
  let allOurs = pids.length > 0;
  for (const pid of pids) {
    const cmd = getProcessCommandLine(pid);
    const ours = isOurProcess(cmd);
    log(`  PID ${pid} -> ${ours ? 'EIGEN' : 'FREMD'}: ${cmd.slice(0, 120)}`);
    if (!ours) { allOurs = false; continue; }
    log(`  -> beende PID ${pid}`);
    killPid(pid);
  }
  // kurze Wartezeit, damit OS den Port freigibt
  await new Promise(r => setTimeout(r, 800));
  if (allOurs && !(await isPortInUse(desiredPort))) {
    return { port: desiredPort, freed: true };
  }
  // Port immer noch belegt (fremd) -> naechsten freien Port suchen
  for (let p = desiredPort + 1; p < desiredPort + MAX_PORT_SCAN; p++) {
    if (!(await isPortInUse(p))) {
      warn(`Port ${desiredPort} fremd belegt. Verwende stattdessen Port ${p} fuer ${label}.`);
      return { port: p, freed: false };
    }
  }
  throw new Error(`Kein freier Port im Bereich ${desiredPort}-${desiredPort + MAX_PORT_SCAN} fuer ${label}`);
}

async function main() {
  log(`Workspace: ${ROOT}`);
  const backend = await ensurePort('Backend',  DEFAULT_BACKEND_PORT);
  const frontend = await ensurePort('Frontend', DEFAULT_FRONTEND_PORT);

  log(`Backend  -> http://localhost:${backend.port}`);
  log(`Frontend -> http://localhost:${frontend.port}`);
  log(`API-URL  -> http://localhost:${backend.port}/api`);

  const env = {
    ...process.env,
    PORT: String(backend.port),
    BROWSER: process.env.BROWSER || 'none',
  };
  // Frontend braucht eigene PORT-Variable -> ueber separate Spawns regeln.
  // Wir starten beides direkt hier statt ueber `npm run dev`,
  // damit wir Frontend-PORT und API-URL gezielt setzen koennen.
  const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';

  const backendProc = spawn(npmCmd, ['run', 'server'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    shell: false,
  });

  const frontendEnv = {
    ...process.env,
    PORT: String(frontend.port),
    BROWSER: process.env.BROWSER || 'none',
    REACT_APP_API_URL: `http://localhost:${backend.port}/api`,
  };

  const frontendProc = spawn(npmCmd, ['start'], {
    cwd: path.join(ROOT, 'frontend'),
    env: frontendEnv,
    stdio: 'inherit',
    shell: false,
  });

  const shutdown = (sig) => {
    log(`Beende (${sig})...`);
    try { backendProc.kill(); } catch (_) {}
    try { frontendProc.kill(); } catch (_) {}
    setTimeout(() => process.exit(0), 500);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  backendProc.on('exit', (code) => {
    log(`Backend beendet (code=${code}). Beende Frontend...`);
    try { frontendProc.kill(); } catch (_) {}
    process.exit(code || 0);
  });
  frontendProc.on('exit', (code) => {
    log(`Frontend beendet (code=${code}). Beende Backend...`);
    try { backendProc.kill(); } catch (_) {}
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('[dev-start] FEHLER:', err.message);
  process.exit(1);
});
