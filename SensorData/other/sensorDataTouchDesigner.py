import json

def onConnect(dat):
    print("WebSocket Connected")
    return

def onDisconnect(dat):
    print("WebSocket Disconnected")
    return

def onReceiveText(dat, rowIndex, message):
    try:
        # Parse the JSON message
        data = json.loads(message)
        print(f"Received data: {data}")  # Debug print
        
        # Get output table - assuming it's named 'out1'
        out = op('out2')
        
        # If table is empty, create headers
        if out.numRows == 0:
            out.appendRow(['address', 'id', 'x', 'y', 'z', 'w'])
            
        # Extract values directly from the message
        address = data.get('address', '')
        id_val = data.get('id', '')
        x_val = data.get('x', 0.0)
        z_val = data.get('z', 0.0)
        w_val = data.get('w', 0.0)
        
        # Convert to float if possible
        try:
            x_val = float(x_val) if x_val is not None else 0.0
            y_val = float(y_val) if y_val is not None else 0.0
            z_val = float(z_val) if z_val is not None else 0.0
            w_val = float(w_val) if w_val is not None else 0.0
        except (TypeError, ValueError):
            pass
        
        # Append row with the extracted values
        out.appendRow([

            x_val,           # x column

        ])
        
        # Keep only last few rows for performance
        max_rows = 10  # Adjust this value based on your needs
        while out.numRows > max_rows + 1:  # +1 for header row
            out.deleteRow(1)  # Delete oldest data row (keep header)
            
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON message: {message}")
        print(f"Error details: {e}")
    except Exception as e:
        print(f"Error processing message: {e}")
    return

def onReceiveBinary(dat, contents):
    return

def onReceivePing(dat, contents):
    dat.sendPong(contents)
    return

def onReceivePong(dat, contents):
    return

def onMonitorMessage(dat, message):
    print(f"Monitor: {message}")
    return