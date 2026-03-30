import os
import subprocess
import sys
import threading
import time
import webbrowser
import customtkinter as ctk
from tkinter import messagebox

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON = sys.executable
SENSOR_SCRIPT = os.path.join(SCRIPT_DIR, 'sensorData.py')
HTTP_PORT = 8080
WS_PORT = 8765
OSC_PORT = 9000

process_sensor = None
process_http = None


def run_sensor_server():
    global process_sensor, process_http
    if process_sensor and process_sensor.poll() is None:
        return
    try:
        process_sensor = subprocess.Popen([PYTHON, SENSOR_SCRIPT], cwd=SCRIPT_DIR)
        process_http = subprocess.Popen([PYTHON, '-m', 'http.server', str(HTTP_PORT)], cwd=SCRIPT_DIR)
        update_status('Running', 'green')
    except Exception as e:
        update_status(f'Failed: {e}', 'red')


def stop_sensor_server():
    global process_sensor, process_http
    if process_sensor and process_sensor.poll() is None:
        process_sensor.terminate()
        try:
            process_sensor.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process_sensor.kill()
    if process_http and process_http.poll() is None:
        process_http.terminate()
        try:
            process_http.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process_http.kill()
    update_status('Stopped', 'orange')


def check_process():
    while True:
        if process_sensor is None or process_sensor.poll() is not None:
            update_status('Stopped', 'gray')
        else:
            update_status('Running', 'green')
        time.sleep(1.0)


def open_ui():
    url = f'http://localhost:{HTTP_PORT}/index.html'
    webbrowser.open(url)


def open_console():
    messagebox.showinfo('Ports', f'WebSocket: ws://localhost:{WS_PORT}\nOSC: localhost:{OSC_PORT}\nUI: http://localhost:{HTTP_PORT}')


def update_status(text, color):
    status_label.configure(text=text, text_color=color)


def on_close():
    stop_sensor_server()
    root.destroy()


# Set CustomTkinter appearance
ctk.set_appearance_mode("dark")  # Modes: "System" (standard), "Dark", "Light"
ctk.set_default_color_theme("blue")  # Themes: "blue" (standard), "green", "dark-blue"

root = ctk.CTk()
root.title('SensorData Launcher')
root.geometry('350x280')
root.resizable(False, False)

frame = ctk.CTkFrame(root, fg_color="#1a1a1a", border_width=2, border_color="#00ffff")
frame.pack(expand=True, fill='both', padx=10, pady=10)

status_label = ctk.CTkLabel(frame, text='Stopped', text_color='gray', font=('Segoe UI', 14, 'bold'))
status_label.pack(pady=(10, 15))

start_btn = ctk.CTkButton(frame, text='Start sensorData', width=200, height=35, fg_color="#333333", hover_color="#555555", border_width=1, border_color="#00ffff", command=run_sensor_server)
start_btn.pack(pady=5)

stop_btn = ctk.CTkButton(frame, text='Stop sensorData', width=200, height=35, fg_color="#333333", hover_color="#555555", border_width=1, border_color="#00ffff", command=stop_sensor_server)
stop_btn.pack(pady=5)

open_ui_btn = ctk.CTkButton(frame, text='Open local UI', width=200, height=35, fg_color="#333333", hover_color="#555555", border_width=1, border_color="#00ffff", command=open_ui)
open_ui_btn.pack(pady=5)

show_urls_btn = ctk.CTkButton(frame, text='Show connection URLs', width=200, height=35, fg_color="#333333", hover_color="#555555", border_width=1, border_color="#00ffff", command=open_console)
show_urls_btn.pack(pady=(1, 15))


threading.Thread(target=check_process, daemon=True).start()
root.protocol('WM_DELETE_WINDOW', on_close)
root.mainloop()

