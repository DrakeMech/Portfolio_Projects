# Sensor Data from Phone Device to MIDI via WebSocket

This project bridges sensor data received from OSC (Open Sound Control) to MIDI Control Change (CC) signals using WebSockets and the Web MIDI API in the browser.
You can use Sensors2OSC which has is very compact and simple to use for sending that OSC data through your Phone Device. 


## Overview

- A Python server (`sensordata.py`) listens for OSC sensor messages (e.g., touch points, magnetic field, rotation vector) on UDP port `9000`.
- The server broadcasts parsed sensor data to all connected WebSocket clients on port `8765`.
- A browser client (`index.html`) connects to the WebSocket server, receives sensor data, and sends corresponding MIDI CC messages via a selected MIDI output port.
- Virtual MIDI ports (e.g., [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)) allow MIDI routing on Windows.
- MIDI monitoring tools (e.g., [MIDI-OX](https://www.midiox.com/) or [Pocket MIDI](https://www.sonoport.com/pocket-midi)) help verify MIDI messages being sent.

---

## Requirements

- Python 3.7+
- Python packages: `websockets`, `python-osc`
- Modern browser with Web MIDI API support (Chrome, Edge)
- Virtual MIDI port tool (loopMIDI for Windows recommended, srry for Mac Users) (Might be other options too, a little research might help you find it.)
- MIDI monitoring software (optional, for debugging) (MIDI-OX/Pocket MIDI or some other software you might find)

---
## Use

### 1. Install Python dependencies

```bash
pip install websockets python-osc
python sensordata.py
```
### 2. Sensor Data Supported
/touchN — Touch points with id, x, y coordinates.

/magneticfield — Magnetic field vector (x, y, z).

/rotationvector — Quaternion rotation vector (x, y, z, w).

/inclination — Single inclination value.

The Python server parses these OSC messages and sends JSON data to the browser. Hope someone find this usefull. I've been lazy writing the README

### 3. Just Use it
It will make the phone function as a MIDI controler. Maybe you would want to design something usefull out of it or even idk build on top of it... Good luck ;) !
