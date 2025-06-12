import plistlib
import pandas as pd
import streamlit as st
import datetime
from dataclasses import dataclass

st.set_page_config(page_title="MusicKit", layout="wide")


@dataclass(frozen=True)
class LibraryMetadata:
    total_duration: str
    total_songs: str
    favourite_genre: str
    favourite_artist: str
    updated_at: str


keys = {
    "Name",
    "Artist",
    "Album",
    "Genre",
    "Release Date",
    "Total Time",
}

library = st.file_uploader("Library", type="xml", accept_multiple_files=False)

if library:
    plist = plistlib.loads(library.getvalue())

    tracks: dict = plist["Tracks"]
    tracks: pd.DataFrame = pd.DataFrame(
        [{k: v for k, v in t.items() if k in keys} for t in tracks.values()]
    )

    total_songs = str(len(tracks))
    total_duration = divmod(tracks["Total Time"].sum() // 1000 // 60, 60)
    total_duration = f"{total_duration[0]} h {total_duration[1]} m"

    favourite_genre = tracks["Genre"].value_counts().index[0]
    favourite_artist = tracks["Artist"].value_counts().index[0]

    tracks["Total Time"] = tracks["Total Time"].apply(
        lambda ms: f"{ms // 60000}:{(ms % 60000) // 1000:02}"
    )

    tracks["Release Date"] = pd.to_datetime(tracks["Release Date"]).dt.date

    updated_at: datetime.datetime = plist["Date"]
    updated_at: str = f'Updated at: {updated_at.date().strftime("%d %b %Y")}'

    metadata = LibraryMetadata(
        total_songs=total_songs,
        total_duration=total_duration,
        favourite_genre=favourite_genre,
        favourite_artist=favourite_artist,
        updated_at=updated_at,
    )

    columns = st.columns([1, 2, 3, 3])
    columns[0].metric("Songs", metadata.total_songs)
    columns[1].metric("Total Duration", metadata.total_duration)
    columns[2].metric("Favourite Genre", metadata.favourite_genre)
    columns[3].metric("Favourite Artist", metadata.favourite_artist)

    st.dataframe(tracks, hide_index=True)

    st.divider()

    st.bar_chart(tracks["Genre"].value_counts().head(10), horizontal=True)
    st.bar_chart(tracks["Artist"].value_counts().head(10), horizontal=True)

    st.info(metadata.updated_at)
