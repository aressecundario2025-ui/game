let scene;
let camera;
let renderer;
let clock;

let socket = null;

let player = {
    id: null,
    name: "",
    x: 0,
    y: 2,
    z: 5
};

let otherPlayers = {};

const keys = {};

let velocityY = 0;
let canJump = false;

const speed = 0.12;
const gravity = 0.012;
const jumpPower = 0.22;

let yaw = 0;
let pitch = 0;

const blocks = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

document.getElementById("playButton").addEventListener("click", startGame);

function startGame() {

    const usernameInput = document.getElementById("username");

    player.name = usernameInput.value.trim() || "Jugador";

    document.getElementById("menu").classList.add("hidden");
    document.getElementById("gameUI").classList.remove("hidden");

    document.getElementById("playerName").textContent =
        "👤 " + player.name;

    initGame();

    connectServer();

    document.body.requestPointerLock =
        document.body.requestPointerLock ||
        document.body.mozRequestPointerLock;

    document.body.requestPointerLock();
}

function initGame() {

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x87ceeb);

    scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        200
    );

    camera.position.set(
        player.x,
        player.y,
        player.z
    );

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    createLights();

    createWorld();

    window.addEventListener("resize", onResize);

    document.addEventListener(
        "keydown",
        onKeyDown
    );

    document.addEventListener(
        "keyup",
        onKeyUp
    );

    document.addEventListener(
        "mousemove",
        onMouseMove
    );

    document.addEventListener(
        "mousedown",
        onMouseDown
    );

    animate();
}

function createLights() {

    const ambient = new THREE.AmbientLight(
        0xffffff,
        0.7
    );

    scene.add(ambient);

    const sun = new THREE.DirectionalLight(
        0xffffff,
        1
    );

    sun.position.set(
        50,
        80,
        30
    );

    scene.add(sun);
}

function createWorld() {

    const grassMaterial = new THREE.MeshLambertMaterial({
        color: 0x4caf50
    });

    const dirtMaterial = new THREE.MeshLambertMaterial({
        color: 0x8b5a2b
    });

    const stoneMaterial = new THREE.MeshLambertMaterial({
        color: 0x888888
    });

    const size = 30;

    for (let x = -size; x <= size; x++) {

        for (let z = -size; z <= size; z++) {

            createBlock(
                x,
                0,
                z,
                grassMaterial
            );

            createBlock(
                x,
                -1,
                z,
                dirtMaterial
            );

            createBlock(
                x,
                -2,
                z,
                stoneMaterial
            );
        }
    }

    // Algunas montañitas
    for (let i = 0; i < 20; i++) {

        const x =
            Math.floor(Math.random() * 20) - 10;

        const z =
            Math.floor(Math.random() * 20) - 10;

        const h =
            Math.floor(Math.random() * 3) + 1;

        for (let y = 1; y <= h; y++) {

            createBlock(
                x,
                y,
                z,
                grassMaterial
            );
        }
    }
}

function createBlock(
    x,
    y,
    z,
    material
) {

    const geometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );

    const block =
        new THREE.Mesh(
            geometry,
            material
        );

    block.position.set(
        x,
        y,
        z
    );

    block.userData.isBlock = true;

    scene.add(block);

    blocks.push(block);

    return block;
}

function connectServer() {

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    const serverURL =
        protocol +
        "//" +
        location.host;

    socket = new WebSocket(serverURL);

    socket.addEventListener(
        "open",
        () => {

            document.getElementById(
                "connectionStatus"
            ).textContent = "Conectado";

            socket.send(
                JSON.stringify({
                    type: "join",
                    name: player.name
                })
            );
        }
    );

    socket.addEventListener(
        "message",
        event => {

            let data;

            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            handleServerMessage(data);
        }
    );

    socket.addEventListener(
        "close",
        () => {

            document.getElementById(
                "playersOnline"
            ).textContent =
                "Servidor desconectado";
        }
    );
}

function handleServerMessage(data) {

    if (data.type === "welcome") {

        player.id = data.id;

        if (data.players) {

            for (const p of data.players) {

                if (p.id !== player.id) {
                    addOtherPlayer(p);
                }
            }
        }
    }

    if (data.type === "playerJoined") {

        if (data.player.id !== player.id) {
            addOtherPlayer(data.player);
        }
    }

    if (data.type === "playerMoved") {

        if (data.id !== player.id) {

            const other =
                otherPlayers[data.id];

            if (other) {

                other.position.set(
                    data.x,
                    data.y,
                    data.z
                );
            }
        }
    }

    if (data.type === "playerLeft") {

        removeOtherPlayer(data.id);
    }

    if (data.type === "players") {

        document.getElementById(
            "playersOnline"
        ).textContent =
            "Jugadores: " + data.count;
    }
}

function addOtherPlayer(data) {

    if (otherPlayers[data.id]) {
        return;
    }

    const geometry =
        new THREE.BoxGeometry(
            0.8,
            1.8,
            0.8
        );

    const material =
        new THREE.MeshLambertMaterial({
            color: 0x2196f3
        });

    const mesh =
        new THREE.Mesh(
            geometry,
            material
        );

    mesh.position.set(
        data.x || 0,
        data.y || 1,
        data.z || 0
    );

    scene.add(mesh);

    otherPlayers[data.id] = mesh;
}

function removeOtherPlayer(id) {

    const mesh =
        otherPlayers[id];

    if (!mesh) {
        return;
    }

    scene.remove(mesh);

    delete otherPlayers[id];
}

function onKeyDown(event) {

    keys[event.code] = true;

    if (
        event.code === "Space" &&
        canJump
    ) {

        velocityY = jumpPower;

        canJump = false;
    }
}

function onKeyUp(event) {

    keys[event.code] = false;
}

function onMouseMove(event) {

    if (
        document.pointerLockElement !== document.body
    ) {
        return;
    }

    yaw -= event.movementX * 0.002;
    pitch -= event.movementY * 0.002;

    pitch = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, pitch)
    );
}

function onMouseDown(event) {

    if (
        document.pointerLockElement !== document.body
    ) {
        document.body.requestPointerLock();
        return;
    }

    if (event.button === 0) {
        breakBlock();
    }

    if (event.button === 2) {
        placeBlock();
    }
}

document.addEventListener(
    "contextmenu",
    event => event.preventDefault()
);

function breakBlock() {

    raycaster.setFromCamera(
        mouse,
        camera
    );

    const hits =
        raycaster.intersectObjects(
            blocks
        );

    if (!hits.length) {
        return;
    }

    const block = hits[0].object;

    scene.remove(block);

    const index =
        blocks.indexOf(block);

    if (index !== -1) {
        blocks.splice(index, 1);
    }

    block.geometry.dispose();

    if (socket && socket.readyState === WebSocket.OPEN) {

        socket.send(
            JSON.stringify({
                type: "blockBreak",
                x: Math.round(block.position.x),
                y: Math.round(block.position.y),
                z: Math.round(block.position.z)
            })
        );
    }
}

function placeBlock() {

    raycaster.setFromCamera(
        mouse,
        camera
    );

    const hits =
        raycaster.intersectObjects(
            blocks
        );

    if (!hits.length) {
        return;
    }

    const hit = hits[0];

    const normal =
        hit.face.normal.clone();

    const position =
        hit.object.position.clone();

    position.add(normal);

    const material =
        new THREE.MeshLambertMaterial({
            color: 0x8b5a2b
        });

    createBlock(
        Math.round(position.x),
        Math.round(position.y),
        Math.round(position.z),
        material
    );

    if (socket && socket.readyState === WebSocket.OPEN) {

        socket.send(
            JSON.stringify({
                type: "blockPlace",
                x: Math.round(position.x),
                y: Math.round(position.y),
                z: Math.round(position.z)
            })
        );
    }
}

function updatePlayer() {

    const direction =
        new THREE.Vector3();

    if (keys["KeyW"]) {
        direction.z -= 1;
    }

    if (keys["KeyS"]) {
        direction.z += 1;
    }

    if (keys["KeyA"]) {
        direction.x -= 1;
    }

    if (keys["KeyD"]) {
        direction.x += 1;
    }

    if (direction.length() > 0) {

        direction.normalize();

        direction.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw
        );

        player.x +=
            direction.x * speed;

        player.z +=
            direction.z * speed;
    }

    velocityY -= gravity;

    player.y += velocityY;

    if (player.y <= 1.8) {

        player.y = 1.8;

        velocityY = 0;

        canJump = true;
    }

    camera.position.set(
        player.x,
        player.y,
        player.z
    );

    camera.rotation.order = "YXZ";

    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    sendPosition();
}

let lastSend = 0;

function sendPosition() {

    const now = Date.now();

    if (now - lastSend < 50) {
        return;
    }

    lastSend = now;

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify({
                type: "move",
                x: player.x,
                y: player.y,
                z: player.z
            })
        );
    }
}

function animate() {

    requestAnimationFrame(animate);

    updatePlayer();

    renderer.render(
        scene,
        camera
    );
}

function onResize() {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}