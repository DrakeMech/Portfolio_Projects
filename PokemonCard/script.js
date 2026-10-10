const card = document.getElementById('gradientButton');
const statusText = document.getElementById('statusText');

let orientationBaseline = null;
let motionEnabled = false;
let spinAngle = 0;
let spinVelocity = 0;
let spinFrame = 0;
let lastSpinFrame = null;
let spinHoldUntil = 0;
let spinStabilizeTimer = 0;

const SPIN_THRESHOLD_DEG_PER_SEC = 360;
const MAX_SPIN_DEG_PER_SEC = 1080;
const SPIN_STABILIZE_DELAY_MS = 5000;
const SPIN_STABILIZE_DURATION_MS = 900;

card.style.setProperty('--spin-stabilize-duration', `${SPIN_STABILIZE_DURATION_MS}ms`);

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

function getAngularSpeed(rotationRate) {
    if (!rotationRate) {
        return 0;
    }

    const alpha = rotationRate.alpha ?? 0;
    const beta = rotationRate.beta ?? 0;
    const gamma = rotationRate.gamma ?? 0;
    return Math.sqrt(alpha ** 2 + beta ** 2 + gamma ** 2);
}

function getAccelerationMagnitude(acceleration, accelerationIncludingGravity) {
    for (const reading of [acceleration, accelerationIncludingGravity]) {
        if (reading && [reading.x, reading.y, reading.z].every(Number.isFinite)) {
            return Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2);
        }
    }

    return null;
}

function animateSpin(timestamp) {
    if (timestamp > spinHoldUntil || Math.abs(spinVelocity) < 1) {
        spinVelocity = 0;
        spinFrame = 0;
        lastSpinFrame = null;
        card.classList.remove('is-spinning');
        return;
    }

    const elapsed = lastSpinFrame === null ? 0 : Math.min(timestamp - lastSpinFrame, 50);
    lastSpinFrame = timestamp;
    spinAngle = (spinAngle + spinVelocity * elapsed / 1000) % 360;
    card.style.setProperty('--spin-y', `${spinAngle}deg`);
    card.classList.add('is-spinning');
    spinFrame = requestAnimationFrame(animateSpin);
}

function stabilizeCard() {
    spinVelocity = 0;
    spinAngle = 0;
    card.classList.remove('is-spinning');
    card.classList.add('is-stabilizing');
    card.style.setProperty('--spin-y', '0deg');
    setTilt(0, 0, 50, 50);
    window.setTimeout(() => card.classList.remove('is-stabilizing'), SPIN_STABILIZE_DURATION_MS);
}

function setSpinFromRate(rotationRate, holdMs = 150) {
    const alpha = rotationRate?.alpha ?? 0;
    const beta = rotationRate?.beta ?? 0;
    const gamma = rotationRate?.gamma ?? 0;
    const angularSpeed = getAngularSpeed(rotationRate);
    const spinSpeed = angularSpeed > SPIN_THRESHOLD_DEG_PER_SEC
        ? Math.min((angularSpeed - SPIN_THRESHOLD_DEG_PER_SEC) * 2, MAX_SPIN_DEG_PER_SEC)
        : 0;

    const dominantRate = [alpha, beta, gamma].reduce((largest, rate) =>
        Math.abs(rate) > Math.abs(largest) ? rate : largest, 0);
    spinVelocity = Math.sign(dominantRate || 1) * spinSpeed;

    if (spinSpeed > 0) {
        window.clearTimeout(spinStabilizeTimer);
        card.classList.remove('is-stabilizing');
        spinStabilizeTimer = window.setTimeout(stabilizeCard, SPIN_STABILIZE_DELAY_MS);
        spinHoldUntil = performance.now() + holdMs;
        if (!spinFrame) {
            spinFrame = requestAnimationFrame(animateSpin);
        }
    } else {
        spinVelocity = 0;
    }

    return angularSpeed;
}

function handleMotion(event) {
    const accelerationMagnitude = getAccelerationMagnitude(event.acceleration, event.accelerationIncludingGravity);
    const angularSpeed = setSpinFromRate(event.rotationRate);
    const accelerationText = accelerationMagnitude === null ? 'n/a' : `${accelerationMagnitude.toFixed(1)} m/s²`;

    statusText.textContent = `Motion active · acceleration ${accelerationText} · rotation ${angularSpeed.toFixed(0)}°/s`;
}

function debugMotion({
    beta = 20,
    gamma = 20,
    alpha = 180,
    acceleration = { x: 0, y: 0, z: 12 },
    rotationRate = { alpha: 0, beta: 0, gamma: 720 },
    duration = 2000
} = {}) {
    handleOrientation({ beta, gamma, alpha });
    const accelerationMagnitude = getAccelerationMagnitude(acceleration);
    handleMotion({ acceleration, rotationRate });
    if (getAngularSpeed(rotationRate) > SPIN_THRESHOLD_DEG_PER_SEC) {
        spinHoldUntil = performance.now() + Math.max(0, duration);
    }
    const accelerationText = accelerationMagnitude === null ? 'n/a' : `${accelerationMagnitude.toFixed(1)} m/s²`;
    statusText.textContent = `DEBUG · acceleration ${accelerationText} · rotation ${getAngularSpeed(rotationRate).toFixed(0)}°/s`;
}

window.debugMotion = debugMotion;

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
            const permissionRequests = [DeviceOrientationEvent.requestPermission()];
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                permissionRequests.push(DeviceMotionEvent.requestPermission());
            }
            const permissions = await Promise.all(permissionRequests);
            if (permissions.some(permission => permission !== 'granted')) {
                statusText.textContent = 'Motion permission not granted';
                return;
            }
        }

        window.addEventListener('deviceorientation', handleOrientation, true);
        window.addEventListener('devicemotion', handleMotion, true);
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