import asyncio
import websockets
import json
from pythonosc import dispatcher, osc_server

clients = set()

# This should be runned through the terminal to set off the websocket client where all the python data will be sent to the script.js (e.g. `python sensorData.py` after creating new terminal up in the navbar in VsCode)

async def ws_handler(websocket):
    clients.add(websocket)
    try:
        print(f"WebSocket client connected | total clients: {len(clients)}")
        await websocket.wait_closed()
    finally:
        clients.remove(websocket)
        print(f"WebSocket client disconnected | total clients: {len(clients)}")

async def send_to_clients(data):
    if clients:
        # Simply forward the data as JSON
        await asyncio.gather(
            *(client.send(json.dumps(data)) for client in clients),
            return_exceptions=True,
        )

def create_handler(address):
    def handler(addr, *args):
        # Create a simple data structure that captures all information
        data = {
            "address": addr,
            "args": list(args)  # Pass all arguments as a list
        }
        
        # If it's a touch message, add parsed ID
        if addr.startswith("/touch"):
            try:
                touch_id = int(addr[6:])
                data["id"] = touch_id
            except:
                pass
            
            # Add named x,y coordinates for touch
            if len(args) >= 2:
                data["x"] = args[0]
                data["y"] = args[1]
        
        print(f"OSC {addr} -> {json.dumps(data)}")
        try:
            asyncio.get_running_loop().create_task(send_to_clients(data))
        except RuntimeError:
            asyncio.run(send_to_clients(data))
    return handler

async def main():
    disp = dispatcher.Dispatcher()
    
    # Map all handlers using the generic handler
    disp.map("/rotationvector", create_handler("/rotationvector"))
    disp.map("/inclination", create_handler("/inclination"))
    disp.map("/magneticfield", create_handler("/magneticfield"))
    
    # Map touch handlers
    for i in range(1, 11):
        disp.map(f"/touch{i}", create_handler(f"/touch{i}"))
    
    # Catch-all for everything else
    disp.set_default_handler(create_handler("default"))
    
    server = osc_server.AsyncIOOSCUDPServer(
        ("0.0.0.0", 9000), 
        disp, 
        asyncio.get_event_loop()
    )
    transport, protocol = await server.create_serve_endpoint()
    
    ws_server = await websockets.serve(ws_handler, "0.0.0.0", 8765)
    print("OSC on port 9000 → WebSocket on port 8765")

    await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
