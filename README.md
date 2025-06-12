# MusicKit

A [Streamlit](https://github.com/streamlit/streamlit) application for that provides insights into your personal Apple Music library.

To load your library:
1. Open Apple Music on Mac.
2. Navigate to: **File** > **Library** > **Export Library**
3. Save the library as a .plist file.
4. Upload the exported file into the app's file uploader

The application will then parse the [.plist](https://developer.apple.com/documentation/bundleresources/information-property-list) file using Python’s built-in [plistlib](https://docs.python.org/3/library/plistlib.html) library and load the data into a [pandas](https://github.com/pandas-dev/pandas) data frame.

## Usage

1. Create a virtual environment
```bash
python3 -m venv .venv

source .venv/bin/activate
```

2. Install the required dependencies
```bash
pip install -r requirements.txt
```

3. Run the app:
```bash
streamlit run app.py
```
