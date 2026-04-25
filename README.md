```bash
osascript -e 'tell application "Music" to get {name, artist, album} of current track'

osascript -e 'tell application "Music" to next track'      # forward                                                                                                       
osascript -e 'tell application "Music" to previous track'  # back                                                                                                          
osascript -e 'tell application "Music" to playpause'       # toggle                                                                                                        
osascript -e 'tell application "Music" to play'                                                                                                                            
osascript -e 'tell application "Music" to pause'
```

### References

- https://github.com/mikaelbr/node-osascript
