```bash
osascript -e 'tell application "Music" to get {name, artist, album} of current track'

osascript -e 'tell application "Music" to next track'      # forward
osascript -e 'tell application "Music" to previous track'  # back
osascript -e 'tell application "Music" to playpause'       # toggle
osascript -e 'tell application "Music" to play'            # play
osascript -e 'tell application "Music" to pause'

osascript -e 'tell application "Music" to get {name, kind, available, selected, sound volume} of every AirPlay device'
```

### References

- https://github.com/mikaelbr/node-osascript
