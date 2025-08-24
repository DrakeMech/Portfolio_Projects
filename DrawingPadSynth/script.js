import { parse } from './midi.js';

const canvas = document.getElementById("tabletCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1000;
canvas.height = 600;
ctx.lineWidth = 2;
ctx.strokeStyle = "black";

const pressureVal = document.getElementById('pressureVal');
const pressureBar = document.getElementById('pressureBar');
const xVal = document.getElementById('xVal');
xVal.textContent = '0';
const yVal = document.getElementById('yVal');
yVal.textContent = '0';

// MIDI setup
let midiAccess = null;
let midiOutput = null;

const notes = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 D4 E4 F4 G4 A4 B4 C5

const noteColors = [
    '#FFB300', // C4 - orange
    '#FF5252', // D4 - red
    '#FF4081', // E4 - pink
    '#7C4DFF', // F4 - purple
    '#448AFF', // G4 - blue
    '#00BFAE', // A4 - teal
    '#69F0AE', // B4 - green
    '#C6FF00'  // C5 - lime
];
let lastNote = null;

function sendMIDI(data) {
    if (midiOutput) {
        midiOutput.send(data);
        const parsed = parse(new Uint8Array(data));
        if (parsed) console.log('Parsed MIDI:', parsed);
    }
}

function mapXToNote(x) {
    const col = Math.floor(x / (canvas.width / 8));
    return notes[Math.max(0, Math.min(7, col))];
}

function mapYToPitchBend(y) {
    // MIDI pitch bend is 14-bit: 0 (min) to 16383 (max), center is 8192
    const val = Math.floor((y / canvas.height) * 16383);
    return val;
}

function sendNoteOn(note, velocity = 100, channel = 0) {
    sendMIDI([0x90 + channel, note, velocity]);
}
function sendNoteOff(note, velocity = 0, channel = 0) {
    sendMIDI([0x80 + channel, note, velocity]);
}
function sendCC(cc, value, channel = 0) {
    sendMIDI([0xB0 + channel, cc, value]);
}
function sendPitchBend(value, channel = 0) {
    // value: 0-16383
    console.log(value);
    const lsb = value & 0x7F;
    const msb = (value >> 7) & 0x7F;
    sendMIDI([0xE0 + channel, lsb, msb]);
}

function updateDataViz(x, y, pressure) {
    pressureVal.textContent = pressure.toFixed(2);
    pressureBar.style.width = (pressure * 100) + '%';
    xVal.textContent = x;
    yVal.textContent = y;
}

let isDrawing = false;
let lastX = 0, lastY = 0, lastPressure = 0;

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw colored columns
    const colWidth = canvas.width / 8;
    for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = noteColors[i];
        ctx.fillRect(i * colWidth, 0, colWidth, canvas.height);
        ctx.restore();
    }
    // Draw pressure circle
    if (isDrawing && lastPressure > 0) {
        const col = Math.floor(lastX / colWidth);
        ctx.save();
        ctx.beginPath();
        ctx.arc(lastX, lastY, lastPressure * 10, 0, Math.PI * 2);
        ctx.fillStyle = noteColors[Math.max(0, Math.min(7, col))];
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.restore();
    }
    // Draw crosshair for X/Y
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(lastX - 10, lastY);
    ctx.lineTo(lastX + 10, lastY);
    ctx.moveTo(lastX, lastY - 10);
    ctx.lineTo(lastX, lastY + 10);
    ctx.stroke();
    ctx.restore();
    requestAnimationFrame(draw);
}
// Assign CC1 button event listener
document.getElementById('assignCC1').addEventListener('click', () => {
    sendCC(1, 127);
    setTimeout(() => sendCC(1, 0), 12); // optional: send 0 after for DAWs that require movement
});

// Assign CC2 button event listener
document.getElementById('assignCC2').addEventListener('click', () => {
    sendCC(2, 127);
    setTimeout(() => sendCC(2, 0), 12); // optional: send 0 after for DAWs that require movement
});

draw();

canvas.addEventListener("pointerdown", (e) => {
    isDrawing = true;
    lastX = e.offsetX;
    lastY = e.offsetY;
    lastPressure = e.pressure;
    updateDataViz(lastX, lastY, lastPressure);
    // Send note on
    const note = mapXToNote(lastX);
    sendNoteOn(note, 100);
    lastNote = note;
    // Send CC1 (pressure)
    sendCC(1, Math.floor(lastPressure * 127));
    sendCC(2, Math.floor((lastY / canvas.height) * 127));
});

canvas.addEventListener("pointermove", (e) => {
    if (isDrawing) {
        lastX = e.offsetX;
        lastY = e.offsetY;
        lastPressure = e.pressure;
        updateDataViz(lastX, lastY, lastPressure);
        // Send CC1 (pressure)
        sendCC(1, Math.floor(lastPressure * 127));
        // Send CC2 (Y axis)
        sendCC(2, Math.floor((lastY / canvas.height) * 127));
        // If note changes, send note off for previous, note on for new
        const note = mapXToNote(lastX);
        if (note !== lastNote) {
            sendNoteOff(lastNote);
            sendNoteOn(note, 70);
            lastNote = note;
        }
    }
});

canvas.addEventListener("pointerup", () => {
    isDrawing = false;
    // Send note off
    if (lastNote !== null) sendNoteOff(lastNote);
    lastPressure = 0;
    updateDataViz(lastX, lastY, lastPressure);
});

canvas.addEventListener("pointerleave", () => {
    isDrawing = false;
    // Send note off
    if (lastNote !== null) sendNoteOff(lastNote);
    lastPressure = 0;
    updateDataViz(lastX, lastY, lastPressure);
});

// MIDI access
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then((access) => {
        midiAccess = access;
        // Pick first output
        const outputs = Array.from(midiAccess.outputs.values());
        if (outputs.length > 0) {
            midiOutput = outputs[0];
            console.log('MIDI Output:', midiOutput.name);
        } else {
            console.warn('No MIDI outputs found');
        }
    });
} else {
    alert('Web MIDI API not supported');
}
