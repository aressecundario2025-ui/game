let scene;
let camera;
let renderer;

let socket = null;

const player = {
    id: null,
    name: "",
    x: 0,
    y: 3,
    z: 5
};

const keys = {};

let velocityY = 0;
let canJump = false;

const speed = 0.12;
const gravity = 0.012;
const jumpPower = 0.23;

let yaw = 0;
let pitch = 0;

let selectedBlock = 0;

const blockTypes = [
    {
        name: "Tierra",
        color: 0x8b5a2b
    },
    {
        name: "Piedra",
        color: 0x777777
    },
    {
        name: "Madera",
        color: 0x9b5a2e
    },
    {
        name: "Hierba",
        color: 0x4caf50
    },
    {
        name: "Cristal",
        color: 0x9eeaff,
        transparent: true
    }
];

const blocks = [];
const otherPlayers = {};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

let lastSend = 0;

document
    .getElementById("playButton")
    .addEventListener("click", startGame);

function startGame() {

    const input =
        document.getElementById("username");

    player.name =
        input.value.trim() || "Jugador";

    document
        .getElementById("menu")
        .classList.add("hidden");

    document
        .getElementById("gameUI")
        .classList.remove("hidden");

    document
        .getElementById("playerName")
        .textContent =
        "👤 " + player.name;

    initGame();

    connectServer();

    document.body.requestPointerLock();
}

function initGame() {

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x87ceeb);

    scene.fog =
        new THREE.Fog(
            0x87ceeb,
            20,
            100
        );

    camera =
        new THREE.PerspectiveCamera(
            75,
            window.innerWidth /
            window.innerHeight,
            0.1,
            200
        );

    camera.position.set(
        player.x,
        player.y,
        player.z
    );

    renderer =
        new THREE.WebGLRenderer({
            antialias: true
        });

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            2
        )
    );

    document.body.appendChild(
        renderer.domElement
    );

    createLights();

    createWorld();

    window.addEventListener(
        "resize",
        onResize
    );

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

    document.addEventListener(
        "contextmenu",
        e => e.preventDefault()
    );

    updateHotbar();

    animate();
}

function createLights() {

    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            0.7
        );

    scene.add(ambient);

    const sun =
        new THREE.DirectionalLight(
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

    for (let x = -30; x <= 30; x++) {

        for (let z = -30; z <= 30; z++) {

            createBlock(
                x,
                0,
                z,
                3,
                false
            );

            createBlock(
                x,
                -1,
                z,
                0,
                false
            );

            createBlock(
                x,
                -2,
                z,
                1,
                false
            );
        }
    }

    // Árboles sencillos
    for (let i = 0; i < 10; i++) {

        const x =
            Math.floor(
                Math.random() * 20
            ) - 10;

        const z =
            Math.floor(
                Math.random() * 20
            ) - 10;

        for (let y = 1; y <= 3; y++) {

            createBlock(
                x,
                y,
                z,
                2,
                false
            );
        }

        for (
            let xx = x - 1;
            xx <= x + 1;
            xx++
        ) {

            for (
                let zz = z - 1;
                zz <= z + 1;
                zz++
            ) {

                createBlock(
                    xx,
                    4,
                    zz,
                    3,
                    false
                );
            }
        }
    }
}

function createBlock(
    x,
    y,
    z,
    type,
    notifyServer = true
) {

    if (
        getBlockAt(
            Math.round(x),
            Math.round(y),
            Math.round(z)
        )
    ) {
        return null;
    }

    const geometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );

    const info =
        blockTypes[type] ||
        blockTypes[0];

    const material =
        new THREE.MeshLambertMaterial({
            color: info.color,
            transparent:
                !!info.transparent,
            opacity:
                info.transparent
                    ? 0.55
                    : 1
        });

    const mesh =
        new THREE.Mesh(
            geometry,
            material
        );

    mesh.position.set(
        Math.round(x),
        Math.round(y),
        Math.round(z)
    );

    mesh.userData.isBlock = true;
    mesh.userData.type = type;

    scene.add(mesh);
    blocks.push(mesh);

    if (
        notifyServer &&
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify({
                type: "blockPlace",
                x: mesh.position.x,
                y: mesh.position.y,
                z: mesh.position.z,
                blockType: type
            })
        );
    }

    return mesh;
}

function removeBlock(
    block,
    notifyServer = true
) {

    scene.remove(block);

    const index =
        blocks.indexOf(block);

    if (index !== -1) {
        blocks.splice(index, 1);
    }

    block.geometry.dispose();

    block.material.dispose();

    if (
        notifyServer &&
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify({
                type: "blockBreak",
                x: block.position.x,
                y: block.position.y,
                z: block.position.z
            })
        );
    }
}

function getBlockAt(x, y, z) {

    return blocks.find(
        block =>
            Math.round(block.position.x) === x &&
            Math.round(block.position.y) === y &&
            Math.round(block.position.z) === z
    );
}

function connectServer() {

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    socket =
        new WebSocket(
            protocol +
            "//" +
            location.host
        );

    socket.addEventListener(
        "open",
        () => {

            document
                .getElementById(
                    "connectionStatus"
                )
                .textContent =
                "Conectado";

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
                data =
                    JSON.parse(
                        event.data
                    );
            } catch {
                return;
            }

            handleServerMessage(data);
        }
    );

    socket.addEventListener(
        "close",
        () => {

            document
                .getElementById(
                    "playersOnline"
                )
                .textContent =
                "Servidor desconectado";
        }
    );
}

function handleServerMessage(data) {

    if (data.type === "welcome") {

        player.id = data.id;

        if (data.players) {

            data.players.forEach(
                addOtherPlayer
            );
        }

        if (data.blocks) {

            data.blocks.forEach(
                block => {

                    createBlock(
                        block.x,
                        block.y,
                        block.z,
                        block.type,
                        false
                    );
                }
            );
        }
    }

    if (data.type === "playerJoined") {

        if (
            data.player.id !==
            player.id
        ) {

            addOtherPlayer(
                data.player
            );
        }
    }

    if (data.type === "playerMoved") {

        if (
            data.id ===
            player.id
        ) {
            return;
        }

        const other =
            otherPlayers[data.id];

        if (other) {

            other.position.set(
                data.x,
                data.y - 0.9,
                data.z
            );
        }
    }

    if (data.type === "playerLeft") {

        removeOtherPlayer(
            data.id
        );
    }

    if (data.type === "players") {

        document
            .getElementById(
                "playersOnline"
            )
            .textContent =
            "Jugadores: " +
            data.count;
    }

    if (data.type === "blockPlace") {

        createBlock(
            data.x,
            data.y,
            data.z,
            data.blockType ?? 0,
            false
        );
    }

    if (data.type === "blockBreak") {

        const block =
            getBlockAt(
                data.x,
                data.y,
                data.z
            );

        if (block) {
            removeBlock(
                block,
                false
            );
        }
    }
}

function addOtherPlayer(data) {

    if (
        otherPlayers[data.id]
    ) {
        return;
    }

    const group =
        new THREE.Group();

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.8,
                1.8,
                0.8
            ),
            new THREE.MeshLambertMaterial({
                color: 0x2196f3
            })
        );

    body.position.y = 0.9;

    group.add(body);

    group.position.set(
        data.x || 0,
        data.y - 0.9 || 1,
        data.z || 0
    );

    scene.add(group);

    otherPlayers[data.id] =
        group;
}

function removeOtherPlayer(id) {

    const playerMesh =
        otherPlayers[id];

    if (!playerMesh) {
        return;
    }

    scene.remove(
        playerMesh
    );

    delete otherPlayers[id];
}

function onKeyDown(event) {

    keys[event.code] = true;

    // Cambiar bloque con 1-5
    if (
        event.code.startsWith("Digit")
    ) {

        const number =
            Number(
                event.code.replace(
                    "Digit",
                    ""
                )
            );

        if (
            number >= 1 &&
            number <= 5
        ) {

            selectedBlock =
                number - 1;

            updateHotbar();
        }
    }

    if (
        event.code === "Space" &&
        canJump
    ) {

        velocityY =
            jumpPower;

        canJump = false;
    }
}

function onKeyUp(event) {

    keys[event.code] = false;
}

function onMouseMove(event) {

    if (
        document.pointerLockElement !==
        document.body
    ) {
        return;
    }

    yaw -=
        event.movementX *
        0.002;

    pitch -=
        event.movementY *
        0.002;

    pitch =
        Math.max(
            -Math.PI / 2,
            Math.min(
                Math.PI / 2,
                pitch
            )
        );
}

function onMouseDown(event) {

    if (
        document.pointerLockElement !==
        document.body
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

    const block =
        hits[0].object;

    // No romper el suelo directamente debajo
    if (
        block.position.y < -2
    ) {
        return;
    }

    removeBlock(
        block,
        true
    );
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

    const hit =
        hits[0];

    const normal =
        hit.face.normal
            .clone();

    const position =
        hit.object.position
            .clone()
            .add(normal);

    const x =
        Math.round(position.x);

    const y =
        Math.round(position.y);

    const z =
        Math.round(position.z);

    // No colocar dentro del jugador
    if (
        playerIntersectsBlock(
            x,
            y,
            z
        )
    ) {
        return;
    }

    createBlock(
        x,
        y,
        z,
        selectedBlock,
        true
    );
}

function playerIntersectsBlock(
    x,
    y,
    z
) {

    const playerMinX =
        player.x - 0.35;

    const playerMaxX =
        player.x + 0.35;

    const playerMinY =
        player.y - 1.7;

    const playerMaxY =
        player.y + 0.1;

    const playerMinZ =
        player.z - 0.35;

    const playerMaxZ =
        player.z + 0.35;

    const blockMinX =
        x - 0.5;

    const blockMaxX =
        x + 0.5;

    const blockMinY =
        y - 0.5;

    const blockMaxY =
        y + 0.5;

    const blockMinZ =
        z - 0.5;

    const blockMaxZ =
        z + 0.5;

    return (
        playerMaxX > blockMinX &&
        playerMinX < blockMaxX &&
        playerMaxY > blockMinY &&
        playerMinY < blockMaxY &&
        playerMaxZ > blockMinZ &&
        playerMinZ < blockMaxZ
    );
}

function collidesAt(
    x,
    y,
    z
) {

    const minX =
        x - 0.35;

    const maxX =
        x + 0.35;

    const minY =
        y - 1.7;

    const maxY =
        y + 0.1;

    const minZ =
        z - 0.35;

    const maxZ =
        z + 0.35;

    for (const block of blocks) {

        const bx =
            block.position.x;

        const by =
            block.position.y;

        const bz =
            block.position.z;

        const blockMinX =
            bx - 0.5;

        const blockMaxX =
            bx + 0.5;

        const blockMinY =
            by - 0.5;

        const blockMaxY =
            by + 0.5;

        const blockMinZ =
            bz - 0.5;

        const blockMaxZ =
            bz + 0.5;

        if (
            maxX > blockMinX &&
            minX < blockMaxX &&
            maxY > blockMinY &&
            minY < blockMaxY &&
            maxZ > blockMinZ &&
            minZ < blockMaxZ
        ) {
            return true;
        }
    }

    return false;
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

    if (
        direction.length() > 0
    ) {

        direction.normalize();

        direction.applyAxisAngle(
            new THREE.Vector3(
                0,
                1,
                0
            ),
            yaw
        );

        const nextX =
            player.x +
            direction.x *
            speed;

        const nextZ =
            player.z +
            direction.z *
            speed;

        // Colisión horizontal
        if (
            !collidesAt(
                nextX,
                player.y,
                player.z
            )
        ) {
            player.x =
                nextX;
        }

        if (
            !collidesAt(
                player.x,
                player.y,
                nextZ
            )
        ) {
            player.z =
                nextZ;
        }
    }

    const oldY =
        player.y;

    velocityY -= gravity;

    const nextY =
        player.y +
        velocityY;

    if (
        !collidesAt(
            player.x,
            nextY,
            player.z
        )
    ) {

        player.y =
            nextY;

        canJump = false;

    } else {

        if (
            velocityY < 0
        ) {
            canJump = true;
        }

        velocityY = 0;
    }

    camera.position.set(
        player.x,
        player.y,
        player.z
    );

    camera.rotation.order =
        "YXZ";

    camera.rotation.y =
        yaw;

    camera.rotation.x =
        pitch;

    sendPosition();
}

function sendPosition() {

    const now =
        Date.now();

    if (
        now - lastSend < 50
    ) {
        return;
    }

    lastSend = now;

    if (
        socket &&
        socket.readyState ===
        WebSocket.OPEN
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

function updateHotbar() {

    const slots =
        document.querySelectorAll(
            ".slot"
        );

    slots.forEach(
        (slot, index) => {

            slot.classList.toggle(
                "selected",
                index ===
                selectedBlock
            );
        }
    );
}

function animate() {

    requestAnimationFrame(
        animate
    );

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