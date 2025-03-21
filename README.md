# MusicKit

A [Streamlit](https://github.com/streamlit/streamlit) application that provides insights into your personal Apple Music library by converting it into a [pandas](https://github.com/pandas-dev/pandas) DataFrame.

To load your library:

1. Open Apple Music on Mac.
2. Navigate to: **File** > **Library** > **Export Library**
3. Save the library as a .plist file.
4. Upload the exported file to the app.
   
The application will then parse the [.plist](https://developer.apple.com/documentation/bundleresources/information-property-list) file using Python’s built-in [plistlib](https://docs.python.org/3/library/plistlib.html) library.

## Requirements

- **Python 3.x**
- **Streamlit** 

You can install the required Python libraries with:

```bash
pip install streamlit
```


## Usage

```bash
streamlit run app.py
```

