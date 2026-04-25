import { useEffect, useMemo, useRef, useState } from 'react';
import plist from 'plist';
import libraryXml from 'bundle-text:../Library.xml';

const SERVER = 'http://127.0.0.1:7891';
const PLAYLIST_KEY = 'musickit.playlist';

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
  const [playlist, setPlaylist] = useState(() => {
    try {
      const raw = localStorage.getItem(PLAYLIST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const parsed = useMemo(() => {
    try {
      return plist.parse(libraryXml);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const allTracks = useMemo(() => {
    if (!parsed?.Tracks) return [];
    return Object.entries(parsed.Tracks).map(([id, t]) => ({
      id,
      Name: t.Name,
      Artist: t.Artist,
      Album: t.Album,
      Genre: t.Genre,
      Year: t.Year,
    }));
  }, [parsed]);

  const allGenres = useMemo(
    () => [...new Set(allTracks.map((t) => t.Genre).filter(Boolean))].sort(),
    [allTracks],
  );

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

  useEffect(() => {
    if (playlist) localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist));
    else localStorage.removeItem(PLAYLIST_KEY);
  }, [playlist]);

  const send = (action) => fetch(`${SERVER}/${action}`, { method: 'POST' }).catch(() => {});
  const playTrackId = (id) =>
    fetch(`${SERVER}/play-track?id=${encodeURIComponent(id)}`, { method: 'POST' }).catch(() => {});

  const playlistIds = useMemo(() => new Set(playlist?.trackIds ?? []), [playlist]);
  const excludedGenres = useMemo(() => new Set(playlist?.excludedGenres ?? []), [playlist]);

  const sortTracks = (list) =>
    [...list].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sortBy === 'Year') return Number(av) - Number(bv);
      return String(av).localeCompare(String(bv));
    });

  const libraryTracks = useMemo(
    () => sortTracks(allTracks.filter((t) => !t.Genre || !excludedGenres.has(t.Genre))),
    [allTracks, excludedGenres, sortBy],
  );

  const playlistTracks = useMemo(
    () => sortTracks(allTracks.filter((t) => playlistIds.has(t.id))),
    [allTracks, playlistIds, sortBy],
  );

  const currentTrack = useMemo(() => {
    if (!nowPlaying?.playing) return null;
    return allTracks.find(
      (t) => t.Name === nowPlaying.name && t.Artist === nowPlaying.artist && t.Album === nowPlaying.album,
    );
  }, [nowPlaying, allTracks]);

  const currentInPlaylist = currentTrack && playlistIds.has(currentTrack.id);

  const approveCurrent = () => {
    if (!playlist || !currentTrack) return;
    setPlaylist((prev) => {
      const ids = new Set(prev.trackIds);
      ids.add(currentTrack.id);
      return { ...prev, trackIds: [...ids] };
    });
  };

  const rejectCurrent = () => {
    if (!playlist || !currentTrack) return;
    setPlaylist((prev) => {
      const ids = new Set(prev.trackIds);
      ids.delete(currentTrack.id);
      return { ...prev, trackIds: [...ids] };
    });
  };

  const panel =
    'rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black ring-1 ring-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] p-6';
  const btn =
    'h-12 w-12 grid place-items-center rounded-full bg-gradient-to-b from-white to-zinc-200 text-black text-xl shadow-[0_2px_10px_rgba(255,255,255,0.15),inset_0_-2px_4px_rgba(0,0,0,0.15)] hover:from-zinc-100 hover:to-white active:translate-y-px transition';
  const ghostBtn =
    'px-3 py-1.5 rounded-lg ring-1 ring-white/10 bg-white/5 text-zinc-200 text-sm hover:bg-white/10 hover:ring-white/20 transition';

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-zinc-100 antialiased">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
          MusicKit
        </h1>

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

          <div className="flex flex-wrap items-center gap-6">
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

            {playlist && currentTrack && (
              <div className="flex items-center gap-3">
                <button
                  onClick={rejectCurrent}
                  disabled={!currentInPlaylist}
                  className="px-4 py-2.5 rounded-xl ring-1 ring-rose-400/30 bg-rose-500/10 text-rose-200 font-medium hover:bg-rose-500/20 hover:ring-rose-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Reject
                </button>
                <button
                  onClick={approveCurrent}
                  disabled={currentInPlaylist}
                  className="px-4 py-2.5 rounded-xl ring-1 ring-emerald-400/30 bg-emerald-500/10 text-emerald-200 font-medium hover:bg-emerald-500/20 hover:ring-emerald-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Approve
                </button>
              </div>
            )}

            {nowPlaying?.volume != null && (
              <div className="flex-1 min-w-[180px]">
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
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-3 text-sm">
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
          </label>
          <div className="ml-auto flex items-center gap-2">
            {playlist ? (
              <button onClick={() => setPlaylist(null)} className={ghostBtn}>
                Clear playlist
              </button>
            ) : (
              <button onClick={() => setDialogOpen(true)} className={ghostBtn}>
                New playlist
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="grid gap-6 md:grid-cols-2">
          <TrackList title="Library" tracks={libraryTracks} onPlay={playTrackId} panel={panel} />
          <TrackList
            title="Playlist"
            subtitle={playlist?.name}
            tracks={playlistTracks}
            onPlay={playTrackId}
            panel={panel}
            empty={
              playlist ? 'No tracks added yet — hit Approve while a song is playing.' : 'No playlist yet.'
            }
          />
        </div>
      </div>

      {dialogOpen && (
        <NewPlaylistDialog
          allGenres={allGenres}
          allTracks={allTracks}
          onClose={() => setDialogOpen(false)}
          onCreate={(p) => {
            setPlaylist(p);
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TrackList({ title, subtitle, tracks, onPlay, panel, empty }) {
  return (
    <div className={panel}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">{title}</h2>
          {subtitle && <p className="text-sm font-medium text-white truncate mt-1">{subtitle}</p>}
        </div>
        <span className="text-xs text-zinc-600 shrink-0">{tracks.length} tracks</span>
      </div>

      {tracks.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty || 'No tracks.'}</p>
      ) : (
        <ul className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {tracks.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onPlay(t.id)}
                className="w-full flex items-center gap-4 px-4 py-2.5 rounded-xl bg-gradient-to-b from-zinc-900/80 to-black/80 ring-1 ring-white/5 hover:ring-white/15 hover:from-zinc-800/80 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] text-left"
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
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewPlaylistDialog({ allGenres, allTracks, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [excluded, setExcluded] = useState(() => new Set());
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const toggleGenre = (g) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), excludedGenres: [...excluded], trackIds: [] });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] p-6 space-y-5"
      >
        <h3 className="text-lg font-semibold text-white">New playlist</h3>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Name</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My playlist"
            className="mt-2 w-full rounded-lg bg-black/60 ring-1 ring-white/10 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-white/30"
          />
        </label>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Excluded genres</p>
          <div className="max-h-56 overflow-auto rounded-lg ring-1 ring-white/10 bg-black/40 p-3 flex flex-wrap gap-2">
            {allGenres.map((g) => {
              const on = excluded.has(g);
              return (
                <button
                  type="button"
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-2.5 py-1 rounded-full text-xs ring-1 transition ${
                    on
                      ? 'bg-white text-black ring-white'
                      : `${genreClass(g)} hover:brightness-125`
                  }`}
                >
                  {g}
                </button>
              );
            })}
            {allGenres.length === 0 && <p className="text-xs text-zinc-500">No genres found.</p>}
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Library will show {allTracks.filter((t) => !t.Genre || !excluded.has(t.Genre)).length} tracks
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-zinc-300 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-gradient-to-b from-white to-zinc-200 text-black font-medium shadow-[inset_0_-2px_4px_rgba(0,0,0,0.15)] hover:from-zinc-100 hover:to-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
