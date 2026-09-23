/* ----------------------------------------------------
   E80 SPARK — Dual Spectrum Wireless Power Link
   3D Simulation & Telemetry System (Three.js)
   ---------------------------------------------------- */

// --- CONFIGURATION & WEATHER DATABASE ---
const WEATHER_DATA = {
    CLEAR: {
        name: 'CLEAR AIR',
        attenuation: '0.233 dB/km',
        laserDC: '16.17',
        microwaveRef: '~6–8',
        autoLink: 'LASER',
        laserOpacity: 0.9,
        laserScatter: 0.1,
        fogDensity: 0.0002,
        fogColor: 0x0f172a,
        rainActive: false
    },
    HAZE: {
        name: 'STRONG HAZE',
        attenuation: '2.37 dB/km',
        laserDC: '6.05',
        microwaveRef: '~6–8',
        autoLink: 'LASER',
        laserOpacity: 0.65,
        laserScatter: 0.45,
        fogDensity: 0.0035,
        fogColor: 0x2d3748,
        rainActive: false
    },
    FOG: {
        name: 'DENSE FOG',
        attenuation: '26 dB/km',
        laserDC: '0.000114',
        microwaveRef: '~5.5–7.5',
        autoLink: 'MICROWAVE',
        laserOpacity: 0.08,
        laserScatter: 0.9,
        fogDensity: 0.015,
        fogColor: 0x64748b,
        rainActive: false
    },
    RAIN: {
        name: 'HEAVY RAIN',
        attenuation: '19.28 dB/km',
        laserDC: '0.00251',
        microwaveRef: '~5–7',
        autoLink: 'MICROWAVE',
        laserOpacity: 0.15,
        laserScatter: 0.7,
        fogDensity: 0.006,
        fogColor: 0x1e293b,
        rainActive: true
    }
};

// --- MICROWAVE APERTURE STUDY SUPPLIED PROJECT TABLE ---
const MICROWAVE_APERTURE_TABLE = {
    1: { diameter: 1.0, area: 0.785, beamwidthDeg: 8.5655, infra: 'Small (Compact 1m Frame)', infraClass: 'size-small', dishScale: 1.0, coneRadiusScale: 3.5 },
    2: { diameter: 2.0, area: 3.142, beamwidthDeg: 4.2827, infra: 'Medium (Standard Field Station)', infraClass: 'size-medium', dishScale: 1.7, coneRadiusScale: 2.1 },
    3: { diameter: 3.0, area: 7.069, beamwidthDeg: 2.8552, infra: 'Large (Heavy Gimbal Frame)', infraClass: 'size-large', dishScale: 2.4, coneRadiusScale: 1.4 },
    4: { diameter: 4.0, area: 12.566, beamwidthDeg: 2.1414, infra: 'Very Large (Fixed Tower Structure)', infraClass: 'size-xlarge', dishScale: 3.1, coneRadiusScale: 1.0 },
    5: { diameter: 5.0, area: 19.635, beamwidthDeg: 1.7131, infra: 'Massive (Heavy Ground Array)', infraClass: 'size-massive', dishScale: 3.8, coneRadiusScale: 0.7 }
};

// --- GLOBAL SIMULATION STATE ---
const state = {
    mode: 'HYBRID',       // 'HYBRID', 'LASER', 'MICROWAVE'
    weather: 'CLEAR',     // 'CLEAR', 'HAZE', 'FOG', 'RAIN'
    activeLink: 'LASER',   // 'LASER', 'MICROWAVE'
    laserFactor: 1.0,     // 0.0 (off) to 1.0 (full beam intensity)
    mwFactor: 0.0,        // 0.0 (off) to 1.0 (full microwave intensity)
    followDrone: false,
    isPaused: false,
    
    // Kinematic positions
    droneTime: 0,
    dronePos: new THREE.Vector3(0, 22, 180),
    txPos: new THREE.Vector3(0, 5, 0),
    txAperturePos: new THREE.Vector3(0, 7.5, 0),
    droneReceiverPos: new THREE.Vector3(0, 21.5, 180),
    droneTrackerPos: new THREE.Vector3(0.6, 21.5, 180.6),

    // Tracking & Envelope Parameters
    trackingLocked: true,
    trackingErrorDeg: 0.08,
    maxTrackingEnvelopeDeg: 12.0, // Max tracking envelope limit in degrees
    geometricCouplingPct: 99.9,
    powerTransferActive: true,
    isTestTrackLossActive: false,
    testTrackLossTimer: 0,

    // Fine-Tuning Sliders
    visibilityKm: 15.0,
    rainDensityPct: 0,

    // Microwave Aperture Study Parameters
    mwStudyApertureM: 1.0,
    mwStudyRfPowerW: 100.0,
    mwStudyRfDcEffPct: 50.0,
    isStudyPanelOpen: false,
    isCompareAnimationActive: false,
    compareTimer: 0
};

// --- THREE.JS GLOBALS ---
let scene, camera, renderer, controls;
let transmitterGroup, azimuthRing, pitchGimbal, laserLensMesh, mwDishMesh;
let droneGroup, rotors = [], receiverGlowMesh, trackerLedMat, targetRingMesh;
let laserBeamMesh, laserScatterMesh, mwConeMesh, mwRingsMesh;
let rainParticles, fogParticles;
let clock = new THREE.Clock();

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initScene();
    createEnvironment();
    createTransmitter();
    createDrone();
    createLaserBeam();
    createMicrowaveBeam();
    createWeatherSystems();
    setupUIEventListeners();
    updateSimulationState();
    updateApertureStudyUI();
    
    // Handle window resizing
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
});

// --- SCENE & SETUP ---
function initScene() {
    const container = document.getElementById('canvas-container');
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.0002);

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 2000);
    camera.position.set(40, 25, -35);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    controls.minDistance = 5;
    controls.maxDistance = 500;
    controls.target.set(0, 15, 60);
    controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 150, -50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 400;
    const d = 100;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x00f2fe, 0x0f172a, 0.3);
    scene.add(hemiLight);
}

// --- ENVIRONMENT & GROUND PLATFORM ---
function createEnvironment() {
    // Ground Mesh
    const groundGeo = new THREE.PlaneGeometry(1000, 1000, 64, 64);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x0e1422,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Tactical Grid Overlay
    const grid = new THREE.GridHelper(1000, 100, 0x00f2fe, 0x1e293b);
    grid.position.y = 0.05;
    scene.add(grid);

    // Transmitter Base Pad
    const padGeo = new THREE.CylinderGeometry(12, 14, 1.5, 32);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 0.75, 0);
    pad.receiveShadow = true;
    pad.castShadow = true;
    scene.add(pad);

    const ringGeo = new THREE.RingGeometry(10, 11.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 1.52, 0);
    scene.add(ring);

    // Distance Marker Pylons along Z (representing 2 km scaling)
    const markers = [
        { z: 50, label: '500m' },
        { z: 100, label: '1000m' },
        { z: 150, label: '1500m' },
        { z: 200, label: '2000m (LINK TARGET)' }
    ];

    markers.forEach(m => {
        const pylonGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
        const pylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.set(25, 2, m.z);
        scene.add(pylon);

        const beaconGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const beaconMat = new THREE.MeshBasicMaterial({ color: m.z === 200 ? 0x00f2fe : 0x64748b });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(25, 4.3, m.z);
        scene.add(beacon);
    });
}

// --- GROUND TRANSMITTER PROCEDURAL MESH ---
function createTransmitter() {
    transmitterGroup = new THREE.Group();
    transmitterGroup.position.copy(state.txPos);

    // Pedestal Base
    const pedestalGeo = new THREE.CylinderGeometry(2.5, 3.5, 4, 16);
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const pedestal = new THREE.Mesh(pedestalGeo, darkMetal);
    pedestal.position.y = 2;
    pedestal.castShadow = true;
    transmitterGroup.add(pedestal);

    // Azimuth Rotating Platform
    azimuthRing = new THREE.Group();
    azimuthRing.position.y = 4;
    transmitterGroup.add(azimuthRing);

    const plateGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.8, 24);
    const plate = new THREE.Mesh(plateGeo, darkMetal);
    azimuthRing.add(plate);

    // Gimbal Support Arms (U-Shape)
    const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    
    const leftArmGeo = new THREE.BoxGeometry(0.6, 3.5, 1.2);
    const leftArm = new THREE.Mesh(leftArmGeo, armMat);
    leftArm.position.set(-1.8, 1.8, 0);
    azimuthRing.add(leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.set(1.8, 1.8, 0);
    azimuthRing.add(rightArm);

    // Pitch Gimbal Housing (Targeting Head)
    pitchGimbal = new THREE.Group();
    pitchGimbal.position.set(0, 3.2, 0);
    azimuthRing.add(pitchGimbal);

    const housingGeo = new THREE.CylinderGeometry(1.4, 1.4, 3, 24);
    housingGeo.rotateZ(Math.PI / 2);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    pitchGimbal.add(housing);

    // 1. LASER TRANSMITTER APERTURE (Center/Left)
    const laserHousingGeo = new THREE.CylinderGeometry(0.6, 0.7, 1.5, 24);
    laserHousingGeo.rotateX(Math.PI / 2);
    const laserHousing = new THREE.Mesh(laserHousingGeo, darkMetal);
    laserHousing.position.set(-0.7, 0, 0.8);
    pitchGimbal.add(laserHousing);

    const lensGeo = new THREE.CircleGeometry(0.5, 24);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide });
    laserLensMesh = new THREE.Mesh(lensGeo, lensMat);
    laserLensMesh.position.set(-0.7, 0, 1.56);
    pitchGimbal.add(laserLensMesh);

    // Glowing Aperture Ring
    const lensRingGeo = new THREE.RingGeometry(0.5, 0.62, 24);
    const lensRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const lensRing = new THREE.Mesh(lensRingGeo, lensRingMat);
    lensRing.position.set(-0.7, 0, 1.57);
    pitchGimbal.add(lensRing);

    // 2. MICROWAVE TRANSMITTER DISH (Right)
    const dishGeo = new THREE.SphereGeometry(1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide });
    mwDishMesh = new THREE.Mesh(dishGeo, dishMat);
    mwDishMesh.rotation.x = Math.PI / 2;
    mwDishMesh.position.set(0.7, 0, 1.0);
    pitchGimbal.add(mwDishMesh);

    // Feed Horn for Dish
    const feedGeo = new THREE.CylinderGeometry(0.1, 0.2, 0.8, 12);
    feedGeo.rotateX(Math.PI / 2);
    const feedMat = new THREE.MeshBasicMaterial({ color: 0xff9f43 });
    const feed = new THREE.Mesh(feedGeo, feedMat);
    feed.position.set(0.7, 0, 1.6);
    pitchGimbal.add(feed);

    scene.add(transmitterGroup);
}

// --- DRONE PROCEDURAL MESH & TRACKER MODULE ---
function createDrone() {
    droneGroup = new THREE.Group();
    droneGroup.position.copy(state.dronePos);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00f2fe, metalness: 0.5, roughness: 0.3 });

    // Center Fuselage Body
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.8, 2.5);
    const body = new THREE.Mesh(bodyGeo, frameMat);
    body.castShadow = true;
    droneGroup.add(body);

    const topCapGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.4, 16);
    const topCap = new THREE.Mesh(topCapGeo, accentMat);
    topCap.position.y = 0.5;
    droneGroup.add(topCap);

    // Quadcopter Arms (X-Configuration)
    const armPositions = [
        { x: 2.2, z: 2.2, angle: Math.PI / 4 },
        { x: -2.2, z: 2.2, angle: -Math.PI / 4 },
        { x: 2.2, z: -2.2, angle: -Math.PI / 4 },
        { x: -2.2, z: -2.2, angle: Math.PI / 4 }
    ];

    armPositions.forEach(pos => {
        const armGeo = new THREE.BoxGeometry(0.3, 0.3, 3.2);
        const arm = new THREE.Mesh(armGeo, frameMat);
        arm.position.set(pos.x / 2, 0, pos.z / 2);
        arm.rotation.y = pos.angle;
        arm.castShadow = true;
        droneGroup.add(arm);

        // Motor Pod
        const motorGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.6, 16);
        const motor = new THREE.Mesh(motorGeo, frameMat);
        motor.position.set(pos.x, 0.3, pos.z);
        droneGroup.add(motor);

        // Spinning Rotor Blade
        const rotorGroup = new THREE.Group();
        rotorGroup.position.set(pos.x, 0.65, pos.z);

        const bladeGeo = new THREE.BoxGeometry(2.6, 0.04, 0.25);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.2, transparent: true, opacity: 0.85 });
        const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
        rotorGroup.add(blade1);

        droneGroup.add(rotorGroup);
        rotors.push(rotorGroup);
    });

    // 1. POWER RECEIVER MODULE (Mounted under fuselage)
    const rxBaseGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 24);
    const rxBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 });
    const rxBase = new THREE.Mesh(rxBaseGeo, rxBaseMat);
    rxBase.position.y = -0.5;
    droneGroup.add(rxBase);

    // Optical PV Aperture Ring (20 cm scaled)
    const pvLensGeo = new THREE.CircleGeometry(1.0, 24);
    const pvLensMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.1, side: THREE.DoubleSide });
    const pvLens = new THREE.Mesh(pvLensGeo, pvLensMat);
    pvLens.rotation.x = Math.PI / 2;
    pvLens.position.y = -0.66;
    droneGroup.add(pvLens);

    // Energy Receiver Transfer Glow Ring
    const glowGeo = new THREE.RingGeometry(0.8, 1.3, 24);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    receiverGlowMesh = new THREE.Mesh(glowGeo, glowMat);
    receiverGlowMesh.rotation.x = Math.PI / 2;
    receiverGlowMesh.position.y = -0.67;
    droneGroup.add(receiverGlowMesh);

    // 2. DRONE TRACKER MODULE (Mounted near receiver)
    const trackerBoxGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
    const trackerBoxMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 }); // Gold/Bronze GPS/Optical Tracker
    const trackerMesh = new THREE.Mesh(trackerBoxGeo, trackerBoxMat);
    trackerMesh.position.set(0.7, -0.6, 0.5);
    droneGroup.add(trackerMesh);

    // Tracker LED Status Beacon
    const trackerLedGeo = new THREE.SphereGeometry(0.12, 12, 12);
    trackerLedMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const trackerLed = new THREE.Mesh(trackerLedGeo, trackerLedMat);
    trackerLed.position.set(0.7, -0.78, 0.5);
    droneGroup.add(trackerLed);

    // 3. TARGETING RETICLE RING AROUND RECEIVER
    const targetRingGeo = new THREE.RingGeometry(1.35, 1.5, 32);
    const targetRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    targetRingMesh = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRingMesh.rotation.x = Math.PI / 2;
    targetRingMesh.position.y = -0.68;
    droneGroup.add(targetRingMesh);

    // Navigation LEDs
    const ledGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const ledGreenMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const ledRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const led1 = new THREE.Mesh(ledGeo, ledGreenMat);
    led1.position.set(2.2, 0, 2.2);
    droneGroup.add(led1);

    const led2 = new THREE.Mesh(ledGeo, ledRedMat);
    led2.position.set(-2.2, 0, 2.2);
    droneGroup.add(led2);

    scene.add(droneGroup);
}

// --- LASER BEAM VISUALIZATION ---
function createLaserBeam() {
    const beamGeo = new THREE.CylinderGeometry(0.15, 0.35, 1, 16, 1, true);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, 0.5);

    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    laserBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    scene.add(laserBeamMesh);

    const scatterGeo = new THREE.CylinderGeometry(0.3, 0.8, 1, 16, 1, true);
    scatterGeo.rotateX(Math.PI / 2);
    scatterGeo.translate(0, 0, 0.5);

    const scatterMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    laserScatterMesh = new THREE.Mesh(scatterGeo, scatterMat);
    scene.add(laserScatterMesh);
}

// --- MICROWAVE BEAM VISUALIZATION ---
function createMicrowaveBeam() {
    const coneGeo = new THREE.CylinderGeometry(0.6, 3.5, 1, 24, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, 0.5);

    const coneMat = new THREE.MeshBasicMaterial({
        color: 0xff9f43,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    mwConeMesh = new THREE.Mesh(coneGeo, coneMat);
    scene.add(mwConeMesh);

    const ringsGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
        const ringGeo = new THREE.RingGeometry(0.5, 0.7, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffb703,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ringsGroup.add(ring);
    }
    mwRingsMesh = ringsGroup;
    scene.add(mwRingsMesh);
}

// --- WEATHER PARTICLE SYSTEMS ---
function createWeatherSystems() {
    const rainCount = 1800;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount * 3; i += 3) {
        rainPositions[i] = (Math.random() - 0.5) * 300;
        rainPositions[i + 1] = Math.random() * 120;
        rainPositions[i + 2] = (Math.random() - 0.5) * 400;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
        color: 0x94a3b8,
        size: 0.8,
        transparent: true,
        opacity: 0.6
    });

    rainParticles = new THREE.Points(rainGeo, rainMat);
    rainParticles.visible = false;
    scene.add(rainParticles);
}

// --- KINEMATICS, ENVELOPE & TRACKING ENGINE ---
function updateKinematics(dt) {
    if (!state.isPaused) {
        state.droneTime += dt * 0.5;

        const t = state.droneTime;

        // Check if Test Track Loss is triggered
        if (state.isTestTrackLossActive) {
            state.testTrackLossTimer += dt;
            // Divert drone far outside normal flight envelope
            state.dronePos.x = 95.0 * Math.sin(state.testTrackLossTimer * 2.0);
            state.dronePos.y = 55.0 + Math.sin(state.testTrackLossTimer * 3.0) * 10;
            state.dronePos.z = 160.0;

            if (state.testTrackLossTimer > 4.5) {
                state.isTestTrackLossActive = false;
                document.getElementById('btn-test-track-loss').classList.remove('active-loss');
            }
        } else {
            // Smooth 3D Drone Flight Path
            state.dronePos.x = Math.sin(t * 0.4) * 35;
            state.dronePos.y = 20 + Math.sin(t * 0.7) * 6;
            state.dronePos.z = 160 + Math.cos(t * 0.3) * 30;
        }

        droneGroup.position.copy(state.dronePos);
        droneGroup.rotation.y = Math.cos(t * 0.4) * 0.2;
        droneGroup.rotation.z = Math.sin(t * 0.4) * 0.1;

        // Spin quadcopter rotors
        rotors.forEach(r => {
            r.rotation.y += dt * 35;
        });
    }

    // 1. Calculate World Positions
    droneGroup.localToWorld(state.droneReceiverPos.set(0, -0.66, 0));
    droneGroup.localToWorld(state.droneTrackerPos.set(0.7, -0.6, 0.5));
    pitchGimbal.getWorldPosition(state.txAperturePos);

    // 2. Dual-Axis Gimbal Real-Time Tracking Mathematics (Targeting Drone Tracker)
    const targetDelta = new THREE.Vector3().subVectors(state.droneTrackerPos, state.txAperturePos);
    
    // Desired Angles
    const desiredYaw = Math.atan2(targetDelta.x, targetDelta.z);
    const horizontalDist = Math.sqrt(targetDelta.x * targetDelta.x + targetDelta.z * targetDelta.z);
    const desiredPitch = -Math.atan2(targetDelta.y, horizontalDist);

    // If locked or acquiring lock, smooth tracking motion
    if (state.trackingLocked || !state.isTestTrackLossActive) {
        azimuthRing.rotation.y += (desiredYaw - azimuthRing.rotation.y) * Math.min(1, dt * 6.0);
        pitchGimbal.rotation.x += (desiredPitch - pitchGimbal.rotation.x) * Math.min(1, dt * 6.0);
    }

    // 3. TRACKING ERROR & ENVELOPE CALCULATION
    const currentPointingDir = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), pitchGimbal.rotation.x)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuthRing.rotation.y);

    const actualTargetDir = targetDelta.clone().normalize();
    const pointingErrorRad = currentPointingDir.angleTo(actualTargetDir);
    state.trackingErrorDeg = THREE.MathUtils.radToDeg(pointingErrorRad);

    // Debounce / Hysteresis Logic for Envelope Lock
    if (state.trackingLocked) {
        if (state.trackingErrorDeg > state.maxTrackingEnvelopeDeg || state.isTestTrackLossActive) {
            state.trackingLocked = false;
        }
    } else {
        if (state.trackingErrorDeg < (state.maxTrackingEnvelopeDeg - 3.5) && !state.isTestTrackLossActive) {
            state.trackingLocked = true;
        }
    }

    // 4. DYNAMIC GEOMETRIC COUPLING CALCULATION
    updateGeometricCoupling(pointingErrorRad);
    state.powerTransferActive = state.trackingLocked;

    // 5. Update Laser & Microwave Beam Geometry
    const linkDistance = state.txAperturePos.distanceTo(state.droneReceiverPos);

    laserBeamMesh.position.copy(state.txAperturePos);
    laserBeamMesh.scale.set(1, 1, linkDistance);
    laserBeamMesh.lookAt(state.droneReceiverPos);

    laserScatterMesh.position.copy(state.txAperturePos);
    laserScatterMesh.scale.set(1, 1, linkDistance);
    laserScatterMesh.lookAt(state.droneReceiverPos);

    const currentApertureInfo = MICROWAVE_APERTURE_TABLE[Math.min(5, Math.max(1, Math.round(state.mwStudyApertureM)))] || { coneRadiusScale: 1.0 };
    const coneRadiusScale = currentApertureInfo.coneRadiusScale;

    mwConeMesh.position.copy(state.txAperturePos);
    mwConeMesh.scale.set(coneRadiusScale, coneRadiusScale, linkDistance);
    mwConeMesh.lookAt(state.droneReceiverPos);

    // Wave Field Rings
    if (mwRingsMesh && state.mwFactor > 0.05 && state.trackingLocked) {
        const ringChildren = mwRingsMesh.children;
        const step = linkDistance / ringChildren.length;
        const dir = targetDelta.clone().normalize();

        ringChildren.forEach((ring, idx) => {
            const waveOffset = ((state.droneTime * 40 + idx * step) % linkDistance);
            const pos = new THREE.Vector3().copy(state.txAperturePos).addScaledVector(dir, waveOffset);
            ring.position.copy(pos);
            ring.lookAt(state.droneReceiverPos);
            
            const scale = 1.0 + (waveOffset / linkDistance) * 2.8;
            ring.scale.set(scale, scale, scale);
            
            ring.material.opacity = state.mwFactor * (1 - waveOffset / linkDistance) * 0.7;
        });
    }

    // 6. Camera Follow Drone Mode
    if (state.followDrone) {
        const offset = new THREE.Vector3(-15, 8, -20);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), droneGroup.rotation.y);
        camera.position.copy(state.dronePos).add(offset);
        controls.target.copy(state.dronePos);
    }
}

// --- MATHEMATICAL MICROWAVE MODEL & APERTURE STUDY CALCULATIONS ---
function calculateMicrowaveStudyMetrics(apertureM) {
    const R = 2000.0; // Link distance = 2000 m
    const rxDiameter = 0.20; // Receiver diameter = 0.20 m
    const rxArea = Math.PI * Math.pow(rxDiameter / 2.0, 2); // 0.0314159 m²

    // Reference table entry or continuous interpolation fallback
    const roundedAperture = Math.min(5, Math.max(1, Math.round(apertureM)));
    const tableInfo = MICROWAVE_APERTURE_TABLE[roundedAperture] || {
        diameter: apertureM,
        area: Math.PI * Math.pow(apertureM / 2.0, 2),
        beamwidthDeg: 8.5655 / apertureM,
        infra: 'Custom Aperture',
        infraClass: 'size-medium',
        dishScale: apertureM * 0.76,
        coneRadiusScale: 3.5 / apertureM
    };

    const apertureArea = Math.PI * Math.pow(apertureM / 2.0, 2);
    const beamwidthDeg = tableInfo.beamwidthDeg;
    const thetaRad = THREE.MathUtils.degToRad(beamwidthDeg);

    // Footprint Diameter: D_beam = 2 * R * tan(theta / 2)
    const beamDiameterM = 2.0 * R * Math.tan(thetaRad / 2.0);

    // Footprint Area: A_beam = PI * (D_beam / 2)^2
    const beamAreaM2 = Math.PI * Math.pow(beamDiameterM / 2.0, 2);

    // Geometric Capture / Coupling: C_geom = min(1, A_receiver / A_beam)
    const cGeom = Math.min(1.0, rxArea / beamAreaM2);
    const couplingPct = cGeom * 100.0;

    return {
        apertureM,
        apertureArea,
        beamwidthDeg,
        beamDiameterM,
        beamAreaM2,
        rxArea,
        cGeom,
        couplingPct,
        infraText: tableInfo.infra,
        infraClass: tableInfo.infraClass,
        dishScale: tableInfo.dishScale,
        coneRadiusScale: tableInfo.coneRadiusScale
    };
}

function updateApertureStudyUI() {
    const metrics = calculateMicrowaveStudyMetrics(state.mwStudyApertureM);

    const elemAperture = document.getElementById('val-study-aperture');
    if (elemAperture) elemAperture.textContent = `${Math.round(metrics.apertureM)} m`;

    const elemBw = document.getElementById('val-study-beamwidth');
    if (elemBw) elemBw.textContent = `${metrics.beamwidthDeg.toFixed(4)}°`;

    const elemCoupling = document.getElementById('val-study-coupling');
    if (elemCoupling) {
        elemCoupling.textContent = `${metrics.couplingPct.toFixed(7)}%`;
    }

    // Sync Slider & Preset Buttons
    const slider = document.getElementById('slider-mw-aperture');
    if (slider) slider.value = state.mwStudyApertureM;

    const apertureButtons = document.querySelectorAll('.btn-aperture-select');
    apertureButtons.forEach(btn => {
        const val = parseInt(btn.getAttribute('data-aperture'));
        btn.classList.toggle('active', val === Math.round(state.mwStudyApertureM));
    });

    // Scale 3D Microwave Dish dynamically in scene
    if (mwDishMesh) {
        mwDishMesh.scale.set(metrics.dishScale, metrics.dishScale, metrics.dishScale);
    }
}

// --- DYNAMIC GEOMETRIC COUPLING CALCULATIONS ---
function calculateLaserGeometricCoupling(pointingErrorRad) {
    if (!state.trackingLocked) return 0.0;
    // 1550 nm Laser: 5 cm TX aperture, 40 µrad divergence -> ~9.34 cm waist at 2 km
    // 20 cm RX diameter -> Under ideal centered tracking, coupling is ~99.8%
    const pointingFactor = Math.max(0, Math.cos(pointingErrorRad * 2.2));
    const coupling = 99.8 * pointingFactor;
    return Math.min(100.0, Math.max(0.0, coupling));
}

function calculateMicrowaveGeometricCoupling(pointingErrorRad) {
    if (!state.trackingLocked) return 0.0;
    
    // Dynamic Microwave Model Coupling based on currently selected aperture
    const metrics = calculateMicrowaveStudyMetrics(
        state.mwStudyApertureM,
        state.mwStudyRfPowerW,
        state.mwStudyRfDcEffPct
    );

    const pointingFactor = Math.max(0, Math.cos(pointingErrorRad * 1.5));
    const coupling = metrics.couplingPct * pointingFactor;
    return coupling;
}

function updateGeometricCoupling(pointingErrorRad) {
    if (!state.trackingLocked) {
        state.geometricCouplingPct = 0.0;
        return;
    }
    if (state.activeLink === 'LASER') {
        state.geometricCouplingPct = calculateLaserGeometricCoupling(pointingErrorRad);
    } else {
        state.geometricCouplingPct = calculateMicrowaveGeometricCoupling(pointingErrorRad);
    }
}

// --- SMOOTH MODE SWITCHING & ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    // 1. Determine Target Factors based on Mode, Weather & Tracking Lock
    let targetLaser = 0.0;
    let targetMW = 0.0;

    const currentData = WEATHER_DATA[state.weather];
    const effectiveActiveLink = (state.mode === 'HYBRID') ? currentData.autoLink : state.mode;
    state.activeLink = effectiveActiveLink;

    if (state.trackingLocked) {
        if (effectiveActiveLink === 'LASER') {
            targetLaser = currentData.laserOpacity * (state.visibilityKm / 15.0);
            targetMW = 0.0;
        } else {
            targetLaser = 0.0;
            targetMW = 0.95;
        }
    } else {
        // LOCK LOST -> BEAM FADES OFF COMPLETELY!
        targetLaser = 0.0;
        targetMW = 0.0;
    }

    // Smooth ~1 second cross-fade transition
    const fadeSpeed = dt * 3.5;
    state.laserFactor += (targetLaser - state.laserFactor) * Math.min(1, fadeSpeed);
    state.mwFactor += (targetMW - state.mwFactor) * Math.min(1, fadeSpeed);

    // Apply Beam Opacities
    laserBeamMesh.material.opacity = state.laserFactor;
    laserScatterMesh.material.opacity = state.laserFactor * currentData.laserScatter;
    mwConeMesh.material.opacity = state.mwFactor * 0.45;

    // Reticle & Receiver Indicator Colors
    if (state.trackingLocked) {
        targetRingMesh.material.color.setHex(0x10b981); // Green ring when locked
        trackerLedMat.color.setHex(0x10b981);
        if (receiverGlowMesh) {
            receiverGlowMesh.material.color.setHex(state.activeLink === 'LASER' ? 0x00f2fe : 0xff9f43);
            receiverGlowMesh.material.opacity = Math.max(state.laserFactor, state.mwFactor) * 0.9;
        }
    } else {
        targetRingMesh.material.color.setHex(0xef4444); // Red ring when lock lost
        trackerLedMat.color.setHex(0xef4444);
        if (receiverGlowMesh) {
            receiverGlowMesh.material.opacity = 0.0; // Energy transfer off when lock lost
        }
    }

    // 2. Weather Rain Particles Update
    if (rainParticles && rainParticles.visible) {
        const positions = rainParticles.geometry.attributes.position.array;
        const fallSpeed = 100 + state.rainDensityPct * 1.5;
        for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= dt * fallSpeed;
            if (positions[i] < 0) positions[i] = 120;
        }
        rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Update Kinematics & Controls
    updateKinematics(dt);
    controls.update();
    renderer.render(scene, camera);

    // 4. Keep UI Telemetry Synchronized
    updateUI();
}

// --- STATE MANAGEMENT & UI SYNC ---
function updateSimulationState() {
    const data = WEATHER_DATA[state.weather];

    // Visibility Fog Density
    const effectiveFogDensity = 0.0002 + (15.0 - state.visibilityKm) * 0.0012 + (data.rainActive ? 0.003 : 0.0);
    scene.fog.density = effectiveFogDensity;
    scene.fog.color.setHex(data.fogColor);
    scene.background.setHex(data.fogColor);

    // Rain Particle Toggle
    rainParticles.visible = data.rainActive || state.rainDensityPct > 5;
}

function updateWeatherControlsState() {
    const sliderVis = document.getElementById('slider-visibility');
    const sliderRain = document.getElementById('slider-rain');
    const sliderVisRow = sliderVis ? sliderVis.closest('.slider-row') : null;
    const sliderRainRow = sliderRain ? sliderRain.closest('.slider-row') : null;

    if (!sliderVisRow || !sliderRainRow) return;

    if (state.weather === 'CLEAR') {
        // CLEAR AIR: Both controls disabled
        sliderVisRow.classList.add('disabled');
        sliderVis.disabled = true;
        sliderRainRow.classList.add('disabled');
        sliderRain.disabled = true;

        state.visibilityKm = 15.0;
        state.rainDensityPct = 0;
    } else if (state.weather === 'HAZE') {
        // STRONG HAZE: Visibility enabled, Rain disabled
        sliderVisRow.classList.remove('disabled');
        sliderVis.disabled = false;
        sliderRainRow.classList.add('disabled');
        sliderRain.disabled = true;

        if (state.visibilityKm > 10.0 || state.visibilityKm < 1.0) state.visibilityKm = 4.0;
        state.rainDensityPct = 0;
    } else if (state.weather === 'FOG') {
        // DENSE FOG: Visibility enabled, Rain disabled
        sliderVisRow.classList.remove('disabled');
        sliderVis.disabled = false;
        sliderRainRow.classList.add('disabled');
        sliderRain.disabled = true;

        if (state.visibilityKm > 2.0) state.visibilityKm = 0.5;
        state.rainDensityPct = 0;
    } else if (state.weather === 'RAIN') {
        // HEAVY RAIN: Visibility disabled, Rain enabled
        sliderVisRow.classList.add('disabled');
        sliderVis.disabled = true;
        sliderRainRow.classList.remove('disabled');
        sliderRain.disabled = false;

        state.visibilityKm = 2.0;
        if (state.rainDensityPct === 0) state.rainDensityPct = 80;
    }

    sliderVis.value = state.visibilityKm;
    document.getElementById('val-visibility-num').textContent = `${state.visibilityKm.toFixed(1)} km`;
    sliderRain.value = state.rainDensityPct;
    document.getElementById('val-rain-num').textContent = `${state.rainDensityPct}%`;
}

function updateUI() {
    const data = WEATHER_DATA[state.weather];

    // Update Side Panel Labels
    document.getElementById('val-weather').textContent = data.name;
    document.getElementById('val-attenuation').textContent = data.attenuation;
    
    // Tracker & Power Transfer Status
    const trackerStatus = document.getElementById('val-tracker-status');
    const powerTransfer = document.getElementById('val-power-transfer');

    if (state.trackingLocked) {
        trackerStatus.className = 'value badge-locked';
        trackerStatus.innerHTML = '<i class="fa-solid fa-lock"></i> LOCKED';

        powerTransfer.className = 'value status-active-text';
        powerTransfer.textContent = 'ACTIVE';
    } else {
        trackerStatus.className = 'value badge-lost';
        trackerStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> LOCK LOST';

        powerTransfer.className = 'value status-off-text';
        powerTransfer.textContent = 'OFF (0 W)';
    }

    // Geometric Coupling (Laser vs Microwave)
    const valCoupling = document.getElementById('val-coupling');
    if (!state.trackingLocked) {
        valCoupling.textContent = '0.0% (Lock Lost)';
    } else if (state.activeLink === 'LASER') {
        valCoupling.textContent = `${state.geometricCouplingPct.toFixed(1)}%`;
    } else {
        const cVal = state.geometricCouplingPct;
        const cStr = cVal < 0.001 ? cVal.toExponential(3) + '%' : cVal.toFixed(6) + '%';
        valCoupling.textContent = `${cStr} (${state.mwStudyApertureM}m Dish)`;
    }

    // Active Link Badges & Output Row
    const valChannel = document.getElementById('val-channel');
    const statusLinkPill = document.getElementById('status-link-pill');
    const laserRow = document.getElementById('laser-output-row');
    const mwRow = document.getElementById('microwave-output-row');
    const flowBeam = document.getElementById('flow-beam');
    const flowOutput = document.getElementById('flow-output');

    const displayedLaserDC = state.trackingLocked ? data.laserDC : '0.00';
    const displayedMWRange = state.trackingLocked ? data.microwaveRef : '0.0';

    if (state.activeLink === 'LASER') {
        valChannel.textContent = 'LASER (1550 nm)';
        valChannel.className = 'value badge-laser';

        statusLinkPill.className = 'status-pill link-laser';
        statusLinkPill.innerHTML = state.trackingLocked ? '<i class="fa-solid fa-laser"></i> LASER ACTIVE' : '<i class="fa-solid fa-ban"></i> LINK UNLOCKED';

        laserRow.className = 'output-row active-output';
        mwRow.className = 'output-row inactive-output';

        flowBeam.textContent = 'LASER';
        flowBeam.className = 'flow-step beam-step laser-bg';
        flowOutput.textContent = state.trackingLocked ? `${displayedLaserDC}W DC` : '0 W (OFF)';
    } else {
        valChannel.textContent = 'MICROWAVE (2.45 GHz)';
        valChannel.className = 'value badge-microwave';

        statusLinkPill.className = 'status-pill link-microwave';
        statusLinkPill.innerHTML = state.trackingLocked ? '<i class="fa-solid fa-wifi"></i> MICROWAVE ACTIVE' : '<i class="fa-solid fa-ban"></i> LINK UNLOCKED';

        laserRow.className = 'output-row inactive-output';
        mwRow.className = 'output-row active-output-mw';

        flowBeam.textContent = 'MICROWAVE';
        flowBeam.className = 'flow-step beam-step mw-bg';
        flowOutput.textContent = state.trackingLocked ? `${displayedMWRange}W REF` : '0 W (OFF)';
    }

    // Output Numbers
    document.getElementById('val-laser-out').textContent = displayedLaserDC;
    document.getElementById('val-microwave-out').textContent = displayedMWRange;

    // Follow Drone HUD Sync
    const followHud = document.getElementById('follow-drone-hud');
    if (state.followDrone) {
        followHud.classList.add('visible');
        const fdTracker = document.getElementById('fd-tracker-val');
        const fdCoupling = document.getElementById('fd-coupling-val');
        const fdPower = document.getElementById('fd-power-val');

        if (state.trackingLocked) {
            fdTracker.className = 'status-locked';
            fdTracker.innerHTML = '<i class="fa-solid fa-lock"></i> LOCKED';
            
            if (state.activeLink === 'LASER') {
                fdCoupling.textContent = `${state.geometricCouplingPct.toFixed(1)}%`;
            } else {
                const cVal = state.geometricCouplingPct;
                const cStr = cVal < 0.001 ? cVal.toExponential(3) + '%' : cVal.toFixed(6) + '%';
                fdCoupling.textContent = `${cStr} (${state.mwStudyApertureM}m)`;
            }
            
            fdPower.className = 'status-active';
            fdPower.textContent = 'ACTIVE';
        } else {
            fdTracker.className = 'status-lost';
            fdTracker.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> LOCK LOST';
            fdCoupling.textContent = '0.0%';
            fdPower.className = 'status-off-text';
            fdPower.textContent = 'OFF (0 W)';
        }
    } else {
        followHud.classList.remove('visible');
    }
}

// --- EVENT LISTENERS & CONTROLS ---
function setupUIEventListeners() {
    const btnApertureStudy = document.getElementById('btn-aperture-study');
    const panelApertureStudy = document.getElementById('aperture-study-panel');
    const btnCloseStudy = document.getElementById('btn-close-study');

    // Mode Buttons
    const modeButtons = document.querySelectorAll('.btn-toggle-group .btn-toggle[data-mode]');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            modeButtons.forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            state.mode = targetBtn.getAttribute('data-mode');

            // Automatically open Microwave Aperture Study card when MICROWAVE ONLY is selected
            if (state.mode === 'MICROWAVE' && panelApertureStudy) {
                state.isStudyPanelOpen = true;
                panelApertureStudy.classList.add('open');
                if (btnApertureStudy) btnApertureStudy.classList.add('active');
                updateApertureStudyUI();
            }

            updateSimulationState();
        });
    });

    // Weather Buttons
    const weatherButtons = document.querySelectorAll('.weather-btn');
    weatherButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            weatherButtons.forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            state.weather = targetBtn.getAttribute('data-weather');
            
            updateWeatherControlsState();
            updateSimulationState();
        });
    });

    // Fine-Tuning Sliders
    const sliderVis = document.getElementById('slider-visibility');
    if (sliderVis) {
        sliderVis.addEventListener('input', (e) => {
            state.visibilityKm = parseFloat(e.target.value);
            document.getElementById('val-visibility-num').textContent = `${state.visibilityKm.toFixed(1)} km`;
            updateSimulationState();
        });
    }

    const sliderRain = document.getElementById('slider-rain');
    if (sliderRain) {
        sliderRain.addEventListener('input', (e) => {
            state.rainDensityPct = parseInt(e.target.value);
            document.getElementById('val-rain-num').textContent = `${state.rainDensityPct}%`;
            updateSimulationState();
        });
    }

    // Initial weather control state
    updateWeatherControlsState();

    // Microwave Aperture Study Toggle Button
    if (btnApertureStudy && panelApertureStudy) {
        btnApertureStudy.addEventListener('click', () => {
            state.isStudyPanelOpen = !state.isStudyPanelOpen;
            panelApertureStudy.classList.toggle('open', state.isStudyPanelOpen);
            btnApertureStudy.classList.toggle('active', state.isStudyPanelOpen);
            if (state.isStudyPanelOpen) {
                updateApertureStudyUI();
            }
        });
    }

    if (btnCloseStudy && panelApertureStudy) {
        btnCloseStudy.addEventListener('click', () => {
            state.isStudyPanelOpen = false;
            panelApertureStudy.classList.remove('open');
            if (btnApertureStudy) btnApertureStudy.classList.remove('active');
        });
    }

    // Aperture Slider
    const sliderMwAperture = document.getElementById('slider-mw-aperture');
    if (sliderMwAperture) {
        sliderMwAperture.addEventListener('input', (e) => {
            state.mwStudyApertureM = parseFloat(e.target.value);
            updateApertureStudyUI();
            updateSimulationState();
        });
    }

    // Aperture Select Buttons (1m, 2m, 3m, 4m, 5m)
    const apertureButtons = document.querySelectorAll('.btn-aperture-select');
    apertureButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = parseFloat(e.currentTarget.getAttribute('data-aperture'));
            state.mwStudyApertureM = val;
            if (sliderMwAperture) sliderMwAperture.value = val;
            updateApertureStudyUI();
            updateSimulationState();
        });
    });

    // Compare 1 m vs 5 m Action Button
    const btnCompare1m5m = document.getElementById('btn-compare-1m-5m');
    if (btnCompare1m5m) {
        btnCompare1m5m.addEventListener('click', () => {
            state.isCompareAnimationActive = !state.isCompareAnimationActive;
            if (state.isCompareAnimationActive) {
                btnCompare1m5m.classList.add('active');
                btnCompare1m5m.innerHTML = '<i class="fa-solid fa-stop"></i> STOP COMPARISON';
                
                let isFiveM = false;
                state.mwStudyApertureM = 1.0;
                if (sliderMwAperture) sliderMwAperture.value = 1.0;
                updateApertureStudyUI();

                state.compareTimer = setInterval(() => {
                    isFiveM = !isFiveM;
                    state.mwStudyApertureM = isFiveM ? 5.0 : 1.0;
                    if (sliderMwAperture) sliderMwAperture.value = state.mwStudyApertureM;
                    updateApertureStudyUI();
                }, 2200);
            } else {
                if (state.compareTimer) clearInterval(state.compareTimer);
                btnCompare1m5m.classList.remove('active');
                btnCompare1m5m.innerHTML = '<i class="fa-solid fa-code-compare"></i> COMPARE 1m vs 5m BEAM';
            }
        });
    }

    // Test Track Loss Button
    const btnTestTrackLoss = document.getElementById('btn-test-track-loss');
    if (btnTestTrackLoss) {
        btnTestTrackLoss.addEventListener('click', () => {
            state.isTestTrackLossActive = true;
            state.testTrackLossTimer = 0;
            btnTestTrackLoss.classList.add('active-loss');
        });
    }

    // Action Buttons
    const btnFollow = document.getElementById('btn-follow-drone');
    if (btnFollow) {
        btnFollow.addEventListener('click', () => {
            state.followDrone = !state.followDrone;
            btnFollow.classList.toggle('active-action', state.followDrone);
            document.getElementById('label-follow').textContent = state.followDrone ? 'UNFOLLOW' : 'FOLLOW DRONE';
            if (!state.followDrone) {
                resetCamera();
            }
        });
    }

    const btnResetCam = document.getElementById('btn-reset-cam');
    if (btnResetCam) btnResetCam.addEventListener('click', resetCamera);

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            state.isPaused = !state.isPaused;
            document.getElementById('label-pause').textContent = state.isPaused ? 'PLAY' : 'PAUSE';
            btnPause.querySelector('i').className = state.isPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
        });
    }

    // Project Info Modal
    const modal = document.getElementById('info-modal');
    const btnInfo = document.getElementById('btn-info');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnModalOk = document.getElementById('btn-modal-ok');

    if (btnInfo && modal) btnInfo.addEventListener('click', () => modal.classList.add('open'));
    if (btnCloseModal && modal) btnCloseModal.addEventListener('click', () => modal.classList.remove('open'));
    if (btnModalOk && modal) btnModalOk.addEventListener('click', () => modal.classList.remove('open'));
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
    }
}

function resetCamera() {
    state.followDrone = false;
    document.getElementById('btn-follow-drone').classList.remove('active-action');
    document.getElementById('label-follow').textContent = 'FOLLOW DRONE';
    camera.position.set(40, 25, -35);
    controls.target.set(0, 15, 60);
    controls.update();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

