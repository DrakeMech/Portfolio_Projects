from pythonosc import dispatcher
from pythonosc import osc_server
import sys

max_pressure = 0.0

def data_handler(address, *args):
    global max_pressure
    if len(args) == 4:
        h, m, s, fsr_raw = args
        pressure_pct = (fsr_raw / 1680) * 100
        time_str = f"{h:02d}:{m:02d}:{s:02d}"

        # The Magic Line: \r moves the cursor back to the start of the line
        # We use a single string so the whole "block" updates at once
        output = f"\r[LOCKED] Time: {time_str} | FSR Raw: {fsr_raw:4} | Pressure: {pressure_pct:5.1f}%"
        
        sys.stdout.write(output)
        sys.stdout.flush() # Forces the terminal to show the change immediately
        max_pressure = max(max_pressure, pressure_pct)  # Ensure max_pressure is at least 100 to avoid division issues
        print(f" | Max Pressure: {max_pressure:.1f}%", end='')  # Show max pressure on the same line

# Setup dispatcher
dispatch = dispatcher.Dispatcher()
dispatch.map("/esp32/time", data_handler)

# Server setup
ip = "0.0.0.0" 
port = 9000
server = osc_server.BlockingOSCUDPServer((ip, port), dispatch)

print(f"Server started on {ip}:{port}")
print("Display locked. Receiving live data...")
print("-" * 60)
server.serve_forever()