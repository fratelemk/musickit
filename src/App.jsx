import { useEffect, useMemo, useState } from 'react';
import plist from 'plist';
import libraryXml from 'bundle-text:../Library.xml';

const SERVER = 'http://127.0.0.1:7891';

const GENRE_PALETTE = [
  'bg-rose-500/15 text-rose-300 ring-rose-400/30',
  'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  'bg-sky-500/15 text-sky-300 ring-sky-400/30',
  'bg-indigo-500/15 text-indigo-300 ring-indigo-400/30',
  'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30',
  'bg-lime-500/15 text-lime-300 ring-lime-400/30',
  'bg-cyan-500/15 text-cyan-300 ring-cyan-400/30',
  'bg-orange-500/15 text-orange-300 ring-orange-400/30',
  'bg-violet-500/15 text-violet-300 ring-violet-400/30',
  'bg-teal-500/15 text-teal-300 ring-teal-400/30',
  'bg-pink-500/15 text-pink-300 ring-pink-400/30',
];

const genreClass = (genre) => {
  let h = 0;
  for (let i = 0; i < genre.length; i++) h = (h * 31 + genre.charCodeAt(i)) >>> 0;
  return GENRE_PALETTE[h % GENRE_PALETTE.length];
};

export function App() {
  const [error, setError] = useState(null);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [sortBy, setSortBy] = useState('Name');

  const parsed = useMemo(() => {
    try {
      const result = plist.parse(libraryXml);
      const firstTrack = result?.Tracks && Object.values(result.Tracks)[0];
      console.log('First track:', firstTrack);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${SERVER}/now-playing`);
        const data = await res.json();
        if (!cancelled) setNowPlaying(data);
      } catch {
        if (!cancelled) setNowPlaying({ error: 'server unreachable' });
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const send = (action) => fetch(`${SERVER}/${action}`, { method: 'POST' }).catch(() => {});

  const tracks = useMemo(() => {
    if (!parsed?.Tracks) return null;
    return Object.values(parsed.Tracks)
      .map(({ Name, Artist, Genre, Year }) => ({ Name, Artist, Genre, Year }))
      .sort((a, b) => {
        const av = a[sortBy];
        const bv = b[sortBy];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (sortBy === 'Year') return Number(av) - Number(bv);
        return String(av).localeCompare(String(bv));
      });
  }, [parsed, sortBy]);

  const panel =
    'rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black ring-1 ring-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] p-6';
  const btn =
    'h-12 w-12 grid place-items-center rounded-full bg-gradient-to-b from-white to-zinc-200 text-black text-xl shadow-[0_2px_10px_rgba(255,255,255,0.15),inset_0_-2px_4px_rgba(0,0,0,0.15)] hover:from-zinc-100 hover:to-white active:translate-y-px transition';

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-zinc-100 antialiased">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          MusicKit
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className={panel}>
            <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Now playing</h2>
            {nowPlaying?.error && <p className="text-red-400 text-sm">{nowPlaying.error}</p>}
            {nowPlaying && !nowPlaying.error && nowPlaying.playing && (
              <div className="mb-6">
                <p className="text-xl font-medium text-white truncate">{nowPlaying.name}</p>
                <p className="text-sm text-zinc-400 truncate">
                  {nowPlaying.artist} <span className="text-zinc-600">· {nowPlaying.state}</span>
                </p>
              </div>
            )}
            {nowPlaying && !nowPlaying.error && !nowPlaying.playing && (
              <p className="text-zinc-500 mb-6">Stopped</p>
            )}

            <div className="flex items-center gap-4">
              <button className={btn} onClick={() => send('previous')} aria-label="Previous">
                ⏮
              </button>
              <button className={btn} onClick={() => send('playpause')} aria-label="Play/Pause">
                ⏯
              </button>
              <button className={btn} onClick={() => send('next')} aria-label="Next">
                ⏭
              </button>
            </div>

            {nowPlaying?.volume != null && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  <span>Volume</span>
                  <span className="text-zinc-300">{nowPlaying.volume}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={nowPlaying.volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setNowPlaying((prev) => ({ ...prev, volume: v }));
                    fetch(`${SERVER}/volume?value=${v}`, { method: 'POST' }).catch(() => {});
                  }}
                  className="w-full accent-white"
                />
              </div>
            )}
          </div>

          <div className={panel}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">Library</h2>
              {parsed?.Date && (
                <span className="text-xs text-zinc-600">
                  {String(parsed.Date instanceof Date ? parsed.Date.toISOString().slice(0, 10) : parsed.Date)}
                </span>
              )}
            </div>

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            {tracks && (
              <>
                <label className="flex items-center gap-3 text-sm mb-4">
                  <span className="text-zinc-400">Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-lg bg-black/60 ring-1 ring-white/10 px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-white/30"
                  >
                    <option value="Name">Name</option>
                    <option value="Artist">Artist</option>
                    <option value="Genre">Genre</option>
                    <option value="Year">Year</option>
                  </select>
                  <span className="ml-auto text-xs text-zinc-600">{tracks.length} tracks</span>
                </label>

                <ul className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                  {tracks.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-gradient-to-b from-zinc-900/80 to-black/80 ring-1 ring-white/5 hover:ring-white/15 hover:from-zinc-800/80 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{t.Name || '—'}</p>
                        <p className="text-xs text-zinc-400 truncate">{t.Artist || 'Unknown artist'}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
                        {t.Genre && (
                          <span className={`px-2 py-0.5 rounded-full ring-1 ${genreClass(t.Genre)}`}>
                            {t.Genre}
                          </span>
                        )}
                        {t.Year && <span className="tabular-nums">{t.Year}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
