try:
    from pythonosc import dispatcher, osc_server
except ImportError as error:
    raise RuntimeError(
        "python-osc is required; install it with 'python -m pip install python-osc'."
    ) from error

def print_handler(address, *args):
    print(f"{address}: {args}")

dispatcher = dispatcher.Dispatcher()
dispatcher.set_default_handler(print_handler)

ip = "0.0.0.0"  # Listen on all network interfaces
port = 9000

server = osc_server.BlockingOSCUDPServer((ip, port), dispatcher)
print(f"Listening on {ip}:{port}...")
server.serve_forever()
