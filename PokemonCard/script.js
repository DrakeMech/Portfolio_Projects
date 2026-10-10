const card = document.getElementById('gradientButton');
const statusText = document.getElementById('statusText');

let orientationBaseline = null;
let motionEnabled = false;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalize(value, min, max) {
    return clamp((value - min) / (max - min), 0, 1);
}

function setTilt(tiltX, tiltY, shineX, shineY) {
    card.style.setProperty('--tilt-x', `${tiltX}deg`);
    card.style.setProperty('--tilt-y', `${tiltY}deg`);
    card.style.setProperty('--shear', `${tiltY * 0.30}deg`);
    card.style.setProperty('--shine-x', `${shineX}%`);
    card.style.setProperty('--shine-y', `${shineY}%`);
    card.style.setProperty('--shine-angle', `${120 + (shineX - 50) * 0.9 - (shineY - 50) * 0.4}deg`);
}

function updateGradient(beta, gamma, alpha) {
    const red = Math.round(normalize(beta, -90, 90) * 255);
    const green = Math.round(normalize(gamma, -90, 90) * 255);
    const blue = Math.round(normalize(alpha, 0, 360) * 255);

    card.style.setProperty('--card-gradient', `linear-gradient(45deg,
        rgb(${red}, ${255 - red}, ${Math.round(blue / 2)}),
        rgb(${255 - green}, ${green}, ${Math.round(red / 2)}),
        rgb(${blue}, ${255 - blue}, ${Math.round(green / 2)}))`);
}

function handleOrientation(event) {
    if (event.beta === null || event.gamma === null) {
        return;
    }

    if (!orientationBaseline) {
        orientationBaseline = { beta: event.beta, gamma: event.gamma };
    }

    const betaDelta = clamp(event.beta - orientationBaseline.beta, -45, 45);
    const gammaDelta = clamp(event.gamma - orientationBaseline.gamma, -45, 45);
    const alpha = event.alpha ?? 180;
    const tiltX = clamp(betaDelta * -0.35, -16, 16);
    const tiltY = clamp(gammaDelta * 0.35, -16, 16);

    setTilt(tiltX, tiltY, 50 + gammaDelta, 50 - betaDelta);
    updateGradient(event.beta, event.gamma, alpha);
}

function handlePointerMove(event) {
    if (motionEnabled || event.pointerType !== 'mouse') {
        return;
    }

    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const tiltX = (0.5 - y) * 24;
    const tiltY = (x - 0.5) * 24;

    setTilt(tiltX, tiltY, x * 100, y * 100);
}

function resetPointerTilt() {
    if (!motionEnabled) {
        setTilt(0, 0, 50, 50);
    }
}

async function enableMotion() {
    if (motionEnabled) {
        return;
    }

    if (!('DeviceOrientationEvent' in window)) {
        statusText.textContent = 'Gyro unavailable · move pointer';
        return;
    }

    try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                statusText.textContent = 'Motion permission not granted';
                return;
            }
        }

        window.addEventListener('deviceorientation', handleOrientation, true);
        motionEnabled = true;
        card.setAttribute('aria-pressed', 'true');
        statusText.textContent = 'Motion active · tilt your phone';
    } catch (error) {
        console.error('Could not enable device orientation:', error);
        statusText.textContent = 'Motion unavailable · move pointer';
    }
}

card.addEventListener('click', enableMotion);
card.addEventListener('pointermove', handlePointerMove);
card.addEventListener('pointerleave', resetPointerTilt);