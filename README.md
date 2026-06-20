# BigQuery Release Notes Radar 🚀

BigQuery Release Notes Radar is a modern, responsive web application built with a **Python Flask** backend and a **vanilla HTML/JS/CSS** frontend. It aggregates, parses, and formats the official Google Cloud BigQuery release notes into an interactive dashboard timeline and provides a customizable social sharing tool for posting updates on X (formerly Twitter).

---

## 🌟 Key Features

* **Atom Feed Segmentation**: Fetches the official GCP BigQuery release Atom feed and intelligently splits daily entry lists into individual updates using HTML traversal.
* **Modern Dark Theme**: Premium UI styled with linear gradients, background glow decorations, glassmorphism card layouts, and custom scrollbars.
* **Local In-Memory Cache**: Automatically caches parsed feed data for 10 minutes to maintain fast load times and avoid network limits.
* **Instant Feed Sync**: Bypasses the cache and queries fresh feed updates directly from Google with a single click.
* **Responsive Dashboard Filters**:
  - Live search filtering by query string.
  - Interactive top-level summary cards (Features, Announcements, Issues, Deprecations) that filter logs.
  - Dynamic category pills with counts.
  - Date bounds selector (7 days, 30 days, or all time).
* **Tweet Composer Helper**:
  - Select any release note item to load it into the sidebar panel.
  - Format the tweet text instantly using 4 tone presets: *Tech Alert*, *Summary*, *Hype*, and *Minimal*.
  - Circle progress ring character counter (280 characters standard limit).
  - Quick hashtag selector library.
  - One-click share via Twitter Web Intent.

---

## 📁 Project Structure

```bash
bq-releases-notes/
├── app.py              # Flask server routes & XML/HTML feed parser
├── templates/
│   └── index.html      # Main dashboard HTML template
├── static/
│   ├── css/
│   │   └── style.css   # Custom CSS styling (Dark mode, glassmorphism, animations)
│   └── js/
│       └── main.js     # JavaScript controller (DOM binder, local filters, composer math)
├── .gitignore          # standard python file exclusions
└── README.md           # Project documentation
```

---

## 🛠️ Getting Started

### Prerequisites

Ensure you have **Python 3.8+** installed on your system.

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd bq-releases-notes
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **Windows (CMD)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   * **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. Install the required dependencies:
   ```bash
   pip install flask beautifulsoup4
   ```

---

## 🚀 Running the Web Application

To launch the local web server:

```bash
python app.py
```

* The server will run in debug mode.
* Open your browser and navigate to **`http://127.0.0.1:5000`**.

---

## 🔧 REST API

The backend exposes a single endpoint to retrieve parsed JSON data:

* **Endpoint**: `/api/releases`
* **Method**: `GET`
* **Query Parameters**:
  - `refresh=true` (bypasses memory cache and forces a fetch from Google's feed)
* **Response**: A structured JSON object containing statistics, parsed categorizations, and timeline updates.
