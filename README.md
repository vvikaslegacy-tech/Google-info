# Premium Google Info Search

A high-performance Manifest V3 Chrome Extension designed for bulk Google business and local place search by keyword, category, location, and postal/zip code with Serper.dev API support, detailed extraction, and CSV export.

## Features

- **Bulk Search Capabilities**: Search across multiple categories, keywords, cities, and zip codes.
- **Side Panel Interface**: Seamless Chrome side panel integration (`sidePanel` API).
- **Export Options**: Export structured results directly to CSV format.
- **Serper.dev & Google Scraper Integration**: Flexible query resolution and multi-source data extraction.
- **Licensing & Validation**: Integrated client license validation mechanism.

## Project Structure

```
Google-info/
├── assets/
│   └── icons/              # Extension icons (16x16, 32x32, 48x48, 128x128)
├── popup/
│   ├── popup.html          # Side panel UI layout
│   ├── popup.css           # Custom UI styles
│   └── popup.js            # Frontend logic & user interaction
├── sample/                 # Sample CSV / input templates
├── src/
│   ├── background.js       # Background service worker (MV3)
│   ├── info-utils.js       # Extraction, parsing & utility helpers
│   ├── license-client.js   # License check & activation client
│   └── machine-id.js       # Machine fingerprinting helper
├── LICENSE_MECHANISM.md    # Documentation for licensing flow
├── manifest.json           # Manifest V3 extension definition
└── README.md
```

## Installation (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/vvikaslegacy-tech/Google-info.git
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked** and select the `Google-info` directory.
5. Open Chrome side panel or click the extension icon to launch the search dashboard.

## License

All rights reserved.
