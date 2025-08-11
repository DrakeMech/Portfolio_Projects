from pythonosc import dispatcher
from pythonosc import osc_server

def print_handler(address, *args):
    print(f"{address}: {args}")

dispatcher = dispatcher.Dispatcher()
dispatcher.set_default_handler(print_handler)

ip = "0.0.0.0"  # Listen on all network interfaces
port = 9000

server = osc_server.BlockingOSCUDPServer((ip, port), dispatcher)
print(f"Listening on {ip}:{port}...")
server.serve_forever()
