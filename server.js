import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, stat } from 'node:fs/promises';

const run = promisify(execFile);
const PORT = 7891;

const osa = (script) => run('osascript', ['-e', script]).then(({ stdout }) => stdout.trim());

const NOW_PLAYING_SCRIPT = `
tell application "Music"
  if player state is stopped then return "stopped" & "\\t" & (output volume of (get volume settings))
  set t to current track
  return (name of t) & "\\t" & (artist of t) & "\\t" & (album of t) & "\\t" & (player state as text) & "\\t" & (output volume of (get volume settings))
end tell
`;

const LIBRARY_XML = new URL('./Library.xml', import.meta.url);
let libraryCache = null;

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function library() {
  const { mtimeMs } = await stat(LIBRARY_XML);
  if (libraryCache && libraryCache.mtimeMs === mtimeMs) {
    return libraryCache.tracks;
  }
  let xml = await readFile(LIBRARY_XML, 'utf8');
  const start = xml.indexOf('<key>Tracks</key>');
  const end = xml.indexOf('<key>Playlists</key>');
  xml = xml.slice(start, end === -1 ? undefined : end);
  const str = (body, key) => {
    const m = body.match(new RegExp(`<key>${key}</key><string>([^<]*)</string>`));
    return m ? decodeEntities(m[1]) : '';
  };
  const int = (body, key) => {
    const m = body.match(new RegExp(`<key>${key}</key><integer>(\\d+)</integer>`));
    return m ? Number(m[1]) : 0;
  };
  const tracks = [];
  for (const m of xml.matchAll(/<dict>\s*<key>Track ID<\/key><integer>(\d+)<\/integer>([\s\S]*?)<\/dict>/g)) {
    tracks.push({
      id: Number(m[1]),
      name: str(m[2], 'Name'),
      artist: str(m[2], 'Artist'),
      album: str(m[2], 'Album'),
      time: int(m[2], 'Total Time'),
    });
  }
  libraryCache = { mtimeMs, tracks };
  return tracks;
}

async function nowPlaying() {
  const out = await osa(NOW_PLAYING_SCRIPT);
  if (out.startsWith('stopped\t')) {
    return { playing: false, volume: Number(out.split('\t')[1]) };
  }
  const [name, artist, album, state, volume] = out.split('\t');
  return { playing: true, name, artist, album, state, volume: Number(volume) };
}

async function setVolume(value) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  await osa(`set volume output volume ${v}`);
  return v;
}

async function playTrack(databaseId) {
  const id = parseInt(databaseId, 10);
  if (!Number.isFinite(id)) throw new Error('invalid track id');
  await osa(`tell application "Music" to play (first track whose database ID is ${id})`);
}

const AIRPLAY_SCRIPT = `
tell application "Music"
  set out to ""
  repeat with d in AirPlay devices
    set out to out & (name of d) & tab & (kind of d as text) & tab & (available of d as text) & tab & (selected of d as text) & tab & (sound volume of d as text) & linefeed
  end repeat
  return out
end tell
`;

async function airplayDevices() {
  const out = await osa(AIRPLAY_SCRIPT);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, kind, available, selected, volume] = line.split('\t');
      return {
        name,
        kind,
        available: available === 'true',
        selected: selected === 'true',
        volume: Number(volume),
      };
    });
}

const escAS = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

async function selectAirplay(names) {
  const list = names.map((n) => `AirPlay device "${escAS(n)}"`).join(', ');
  await osa(`tell application "Music" to set current AirPlay devices to {${list}}`);
}

async function airplayVolume(name, value) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  await osa(`tell application "Music" to set sound volume of AirPlay device "${escAS(name)}" to ${v}`);
  return v;
}

const ACTIONS = {
  next: 'tell application "Music" to next track',
  previous: 'tell application "Music" to previous track',
  playpause: 'tell application "Music" to playpause',
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const html = await readFile(new URL('./index.html', import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && req.url === '/library') {
      const html = await readFile(new URL('./library.html', import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && req.url === '/library.json') {
      const tracks = await library();
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tracks));
      return;
    }
    if (req.method === 'GET' && req.url === '/airplay') {
      const html = await readFile(new URL('./airplay.html', import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && req.url === '/airplay.json') {
      const devices = await airplayDevices();
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(devices));
      return;
    }
    if (req.method === 'POST' && req.url?.startsWith('/airplay/select')) {
      const url = new URL(req.url, 'http://x');
      const names = url.searchParams.getAll('name').filter(Boolean);
      if (names.length) {
        await selectAirplay(names);
        res.writeHead(204, cors);
        res.end();
        return;
      }
    }
    if (req.method === 'POST' && req.url?.startsWith('/airplay/volume')) {
      const url = new URL(req.url, 'http://x');
      const name = url.searchParams.get('name');
      const value = Number(url.searchParams.get('value'));
      if (name && Number.isFinite(value)) {
        const v = await airplayVolume(name, value);
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ volume: v }));
        return;
      }
    }
    if (req.method === 'GET' && req.url === '/now-playing') {
      const data = await nowPlaying();
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
    if (req.method === 'POST' && req.url?.startsWith('/play-track')) {
      const url = new URL(req.url, 'http://x');
      const id = url.searchParams.get('id');
      if (id) {
        await playTrack(id);
        res.writeHead(204, cors);
        res.end();
        return;
      }
    }
    if (req.method === 'POST' && req.url?.startsWith('/volume')) {
      const url = new URL(req.url, 'http://x');
      const value = Number(url.searchParams.get('value'));
      if (Number.isFinite(value)) {
        const v = await setVolume(value);
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ volume: v }));
        return;
      }
    }
    if (req.method === 'POST' && req.url?.startsWith('/')) {
      const action = req.url.slice(1);
      if (ACTIONS[action]) {
        await osa(ACTIONS[action]);
        res.writeHead(204, cors);
        res.end();
        return;
      }
    }
    res.writeHead(404, cors);
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`musickit control server on http://127.0.0.1:${PORT}`);
});