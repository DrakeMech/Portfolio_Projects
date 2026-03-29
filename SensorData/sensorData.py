import asyncio
import websockets
import json
from pythonosc import dispatcher, osc_server

clients = set()
sim_handlers = {}

# This should be runned through the terminal to set off the websocket client where all the python data will be sent to the script.js (e.g. `python sensorData.py` after creating new terminal up in the navbar in VsCode)

async def ws_handler(websocket):
    clients.add(websocket)
    try:
        # Log new connection
        try:
            peer = getattr(websocket, "remote_address", None)
        except Exception:
            peer = None
        print(f"WebSocket client connected: {peer} | total clients: {len(clients)}")
        
        async for message in websocket:
            try:
                data = json.loads(message)
                if "simulate" in data:
                    address = data["simulate"]
                    args = data.get("args", [])
                    if address in sim_handlers:
                        sim_handlers[address](address, *args)
                    elif address.startswith("/touch"):
                        touch_handler(address, *args)
                    else:
                        default_handler(address, *args)
            except json.JSONDecodeError:
                pass  # Ignore invalid JSON
        
        await websocket.wait_closed()
    finally:
        clients.remove(websocket)
        try:
            peer = getattr(websocket, "remote_address", None)
        except Exception:
            peer = None
        print(f"WebSocket client disconnected: {peer} | total clients: {len(clients)}")

async def send_to_clients(data):
    if clients:
        # Send to all clients; don't let one failing client break the rest
        await asyncio.gather(
            *(client.send(json.dumps(data)) for client in clients),
            return_exceptions=True,
        )

def rotation_handler(address, *args):
    data = {
        "address": address,
        "x": args[0] if len(args) > 0 else None,
        "y": args[1] if len(args) > 1 else None,
        "z": args[2] if len(args) > 2 else None,
        "w": args[3] if len(args) > 3 else None,
        "extra": args[4] if len(args) > 4 else None,
    }
    # Log the full payload to the terminal for debugging
    print(
        f"OSC {address} -> x={data['x']} y={data['y']} z={data['z']} w={data['w']} extra={data['extra']}"
    )
    # We're already inside the asyncio event loop (called by AsyncIOOSCUDPServer);
    # schedule the coroutine instead of calling asyncio.run()
    try:
        asyncio.get_running_loop().create_task(send_to_clients(data))
    except RuntimeError:
        # Fallback if somehow not in a running loop
        asyncio.run(send_to_clients(data))

def inclination_handler(address, *args):
    data = {
        "address": address,
        "value": args[0] if len(args) > 0 else None,
        "extra": args[4] if len(args) > 4 else None,
    }
    # Log the full payload to the terminal for debugging
    print(f"OSC {address} -> value={data['value']} extra={data['extra']}")
    # We're already inside the asyncio event loop (called by AsyncIOOSCUDPServer);
    # schedule the coroutine instead of calling asyncio.run()
    try:
        asyncio.get_running_loop().create_task(send_to_clients(data))
    except RuntimeError:
        # Fallback if somehow not in a running loop
        asyncio.run(send_to_clients(data))

def touch_handler(address, *args):
    # Expected: (x, y) in 0..1; address like /touch1, /touch2, ...
    try:
        # Extract numeric suffix if present
        touch_id = None
        if address.startswith("/touch"):
            suffix = address[6:]
            if suffix.isdigit():
                touch_id = int(suffix)
    except Exception:
        touch_id = None

    x = args[0] if len(args) > 0 else None
    y = args[1] if len(args) > 1 else None
    data = {
        "address": address,
        "id": touch_id,
        "x": x,
        "y": y,
        "extra": list(args[2:]) if len(args) > 2 else [],
    }
    print(f"OSC {address} -> id={touch_id} x={x} y={y} extra={data['extra']}")
    try:
        asyncio.get_running_loop().create_task(send_to_clients(data))
    except RuntimeError:
        asyncio.run(send_to_clients(data))

def magneticfield_handler(address, *args):
    # Expected: (x, y, z) microtesla
    data = {
        "address": address,
        "x": args[0] if len(args) > 0 else None,
        "y": args[1] if len(args) > 1 else None,
        "z": args[2] if len(args) > 2 else None,
    }
    print(f"OSC {address} -> x={data['x']} y={data['y']} z={data['z']}")
    try:
        asyncio.get_running_loop().create_task(send_to_clients(data))
    except RuntimeError:
        asyncio.run(send_to_clients(data))

def default_handler(address, *args):
    # Generic logger/forwarder for any OSC message (e.g., multitouch)
    data = {
        "address": address,
        "args": list(args),
    }
    print(f"OSC {address} args={args}")
    try:
        asyncio.get_running_loop().create_task(send_to_clients(data))
    except RuntimeError:
        asyncio.run(send_to_clients(data))

async def main():
    disp = dispatcher.Dispatcher()
    disp.map("/rotationvector", rotation_handler)
    disp.map("/inclination", inclination_handler)
    disp.map("/magneticfield", magneticfield_handler)
    # Map a handful of touch channels explicitly
    for i in range(1, 11):
        disp.map(f"/touch{i}", touch_handler)
    # Catch-all for everything else (e.g., multitouch, tuio, etc.)
    disp.set_default_handler(default_handler)
    
    # Simulation handlers for WebSocket injection
    global sim_handlers
    sim_handlers = {
        "/rotationvector": rotation_handler,
        "/inclination": inclination_handler,
        "/magneticfield": magneticfield_handler,
    }

    # Bind OSC to local machine / all interfaces rather than a specific router IP.
    # Use "127.0.0.1" for local-only, or "0.0.0.0" to accept from any interface.
    osc_bind_host = "0.0.0.0"  # change to "127.0.0.1" if you only need local client on same host
    osc_port = 9000
    server = osc_server.AsyncIOOSCUDPServer((osc_bind_host, osc_port), disp, asyncio.get_event_loop())
    try:
        transport, protocol = await server.create_serve_endpoint()
    except OSError as e:
        print(f"ERROR: Cannot bind OSC port 9000: {e}")
        print("Hint: another sensorData instance is already running, or the port is busy.")
        print("* To fix: stop the other process or use a different port in both sensorData.py and your ESP32 sender.")
        return

    try:
        ws_server = await websockets.serve(ws_handler, "0.0.0.0", 8765)
    except OSError as e:
        print(f"ERROR: Cannot bind WebSocket port 8765: {e}")
        transport.close()
        return

    print("OSC on port 9000 → WebSocket on port 8765")

    await asyncio.Future()  # run forever

asyncio.run(main())
