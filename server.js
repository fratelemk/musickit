import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

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