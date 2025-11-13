
import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';

import { Capsule } from 'three/addons/math/Capsule.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';



const clock = new THREE.Clock();

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x88ccee );
scene.fog = new THREE.Fog( 0x88ccee, 0, 50 );

const camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.rotation.order = 'YXZ';

const fillLight1 = new THREE.HemisphereLight( 0x8dc1de, 0x00668d, 1.5 );
fillLight1.position.set( 2, 1, 1 );
scene.add( fillLight1 );

const directionalLight = new THREE.DirectionalLight( 0xffffff, 2.5 );
directionalLight.position.set( - 5, 25, - 1 );
directionalLight.castShadow = true;
directionalLight.shadow.camera.near = 0.01;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.right = 30;
directionalLight.shadow.camera.left = - 30;
directionalLight.shadow.camera.top	= 30;
directionalLight.shadow.camera.bottom = - 30;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.radius = 4;
directionalLight.shadow.bias = - 0.00006;
scene.add( directionalLight );

const container = document.getElementById( 'gameScreen' );

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild( renderer.domElement );

const stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
container.appendChild( stats.domElement );

const GRAVITY = 40;

const NUM_SPHERES = 100;
const SPHERE_RADIUS = 0.2;

const STEPS_PER_FRAME = 5;

const sphereGeometry = new THREE.IcosahedronGeometry( SPHERE_RADIUS, 5 );
const sphereMaterial = new THREE.MeshLambertMaterial( { color: 0xdede8d } );

const spheres = [];
let sphereIdx = 0;

for ( let i = 0; i < NUM_SPHERES; i ++ ) {

    const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    scene.add( sphere );

    spheres.push( {
        mesh: sphere,
        collider: new THREE.Sphere( new THREE.Vector3( 0, - 100, 0 ), SPHERE_RADIUS ),
        velocity: new THREE.Vector3()
    } );

}

const worldOctree = new Octree();

const playerCollider = new Capsule( new THREE.Vector3( 0, 0.35, 0 ), new THREE.Vector3( 0, 1, 0 ), 0.35 );

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;

const keyStates = {};

const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

document.addEventListener( 'keydown', ( event ) => {
    keyStates[ event.code ] = true;
} );

document.addEventListener( 'keyup', ( event ) => {
    keyStates[ event.code ] = false;
} );

container.addEventListener( 'mousedown', () => {

    document.body.requestPointerLock();

    mouseTime = performance.now();

} );

document.addEventListener( 'mouseup', () => {

    if ( document.pointerLockElement !== null ) throwBall();

} );

document.body.addEventListener( 'mousemove', ( event ) => {

    if ( document.pointerLockElement === document.body ) {

        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;

    }

} );

window.addEventListener( 'resize', onWindowResize );

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function throwBall() {

    const sphere = spheres[ sphereIdx ];

    camera.getWorldDirection( playerDirection );

    sphere.collider.center.copy( playerCollider.end ).addScaledVector( playerDirection, playerCollider.radius * 1.5 );

    // throw the ball with more force if we hold the button longer, and if we move forward

    const impulse = 15 + 30 * ( 1 - Math.exp( ( mouseTime - performance.now() ) * 0.001 ) );

    sphere.velocity.copy( playerDirection ).multiplyScalar( impulse );
    sphere.velocity.addScaledVector( playerVelocity, 2 );

    sphereIdx = ( sphereIdx + 1 ) % spheres.length;

}




function playerCollisions() {

    const result = worldOctree.capsuleIntersect( playerCollider );

    playerOnFloor = false;

    if ( result ) {

        playerOnFloor = result.normal.y > 0;

        if ( ! playerOnFloor ) {

            playerVelocity.addScaledVector( result.normal, - result.normal.dot( playerVelocity ) );

        }

        if ( result.depth >= 1e-10 ) {

            playerCollider.translate( result.normal.multiplyScalar( result.depth ) );

        }

    }

}

function updatePlayer( deltaTime ) {

    let damping = Math.exp( - 4 * deltaTime ) - 1;

    if ( ! playerOnFloor ) {

        playerVelocity.y -= GRAVITY * deltaTime;

        // small air resistance
        damping *= 0.1;

    }

    playerVelocity.addScaledVector( playerVelocity, damping );

    const deltaPosition = playerVelocity.clone().multiplyScalar( deltaTime );
    playerCollider.translate( deltaPosition );

    playerCollisions();

    camera.position.copy( playerCollider.end );

}

function playerSphereCollision( sphere ) {

    const center = vector1.addVectors( playerCollider.start, playerCollider.end ).multiplyScalar( 0.5 );

    const sphere_center = sphere.collider.center;

    const r = playerCollider.radius + sphere.collider.radius;
    const r2 = r * r;

    // approximation: player = 3 spheres

    for ( const point of [ playerCollider.start, playerCollider.end, center ] ) {

        const d2 = point.distanceToSquared( sphere_center );

        if ( d2 < r2 ) {

            const normal = vector1.subVectors( point, sphere_center ).normalize();
            const v1 = vector2.copy( normal ).multiplyScalar( normal.dot( playerVelocity ) );
            const v2 = vector3.copy( normal ).multiplyScalar( normal.dot( sphere.velocity ) );

            playerVelocity.add( v2 ).sub( v1 );
            sphere.velocity.add( v1 ).sub( v2 );

            const d = ( r - Math.sqrt( d2 ) ) / 2;
            sphere_center.addScaledVector( normal, - d );

        }

    }

}

function spheresCollisions() {

    for ( let i = 0, length = spheres.length; i < length; i ++ ) {

        const s1 = spheres[ i ];

        for ( let j = i + 1; j < length; j ++ ) {

            const s2 = spheres[ j ];

            const d2 = s1.collider.center.distanceToSquared( s2.collider.center );
            const r = s1.collider.radius + s2.collider.radius;
            const r2 = r * r;

            if ( d2 < r2 ) {

                const normal = vector1.subVectors( s1.collider.center, s2.collider.center ).normalize();
                const v1 = vector2.copy( normal ).multiplyScalar( normal.dot( s1.velocity ) );
                const v2 = vector3.copy( normal ).multiplyScalar( normal.dot( s2.velocity ) );

                s1.velocity.add( v2 ).sub( v1 );
                s2.velocity.add( v1 ).sub( v2 );

                const d = ( r - Math.sqrt( d2 ) ) / 2;

                s1.collider.center.addScaledVector( normal, d );
                s2.collider.center.addScaledVector( normal, - d );

            }

        }

    }

}

function updateSpheres( deltaTime ) {

    spheres.forEach( sphere => {

        sphere.collider.center.addScaledVector( sphere.velocity, deltaTime );

        const result = worldOctree.sphereIntersect( sphere.collider );

        if ( result ) {

            sphere.velocity.addScaledVector( result.normal, - result.normal.dot( sphere.velocity ) * 1.5 );
            sphere.collider.center.add( result.normal.multiplyScalar( result.depth ) );

        } else {

            sphere.velocity.y -= GRAVITY * deltaTime;

        }

        const damping = Math.exp( - 1.5 * deltaTime ) - 1;
        sphere.velocity.addScaledVector( sphere.velocity, damping );

        playerSphereCollision( sphere );

        // Check collision between this sphere and the red target cube
        if ( ! targetHit && typeof targetBox !== 'undefined' ) {
            if ( sphereIntersectsBox( sphere.collider, targetBox ) ) {
                targetHit = true;
                console.log( 'Target hit by sphere!' );
                // Small delay to allow any sound/visual before redirect
                setTimeout( () => { window.location.href = targetRedirectUrl; }, 50 );
            }
        }

    } );

    spheresCollisions();

    for ( const sphere of spheres ) {

        sphere.mesh.position.copy( sphere.collider.center );

    }

}

function getForwardVector() {

    camera.getWorldDirection( playerDirection );
    playerDirection.y = 0;
    playerDirection.normalize();

    return playerDirection;

}

function getSideVector() {

    camera.getWorldDirection( playerDirection );
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross( camera.up );

    return playerDirection;

}

function controls( deltaTime ) {

    // Increased movement speed
    const speedDelta = deltaTime * ( playerOnFloor ? 25 : 10 );

    if(keyStates['Escape']){
        document.getElementById("PauseScreen").style.display = "block";
    }

    if ( keyStates[ 'KeyW' ] ) {

        playerVelocity.add( getForwardVector().multiplyScalar( speedDelta ) );

    }

    if ( keyStates[ 'KeyS' ] ) {

        playerVelocity.add( getForwardVector().multiplyScalar( - speedDelta ) );

    }

    if ( keyStates[ 'KeyA' ] ) {

        playerVelocity.add( getSideVector().multiplyScalar( - speedDelta ) );

    }

    if ( keyStates[ 'KeyD' ] ) {

        playerVelocity.add( getSideVector().multiplyScalar( speedDelta ) );

    }

    if ( playerOnFloor ) {

        if ( keyStates[ 'Space' ] ) {

            playerVelocity.y = 15;

        }

    }

}

// Cylindrical teleport marker
const markerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 100, 32);
const markerMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    transparent: true,
    opacity: 0.2
});
const teleportMarker = new THREE.Mesh(markerGeometry, markerMaterial);
teleportMarker.position.set(12, -0.45, -20); // Medio hundido en el suelo
scene.add(teleportMarker);

// Cylindrical teleport marker
const markerGeometry1 = new THREE.CylinderGeometry(0.5, 0.5, 100, 32);
const markerMaterial1 = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    transparent: true,
    opacity: 0.2
});
const teleportMarker1 = new THREE.Mesh(markerGeometry1, markerMaterial1);
teleportMarker1.position.set(-1, -0.45, -56); // Medio hundido en el suelo
scene.add(teleportMarker1);

// Cylindrical teleport marker
const markerGeometry2 = new THREE.CylinderGeometry(0.5, 0.5, 20, 32);
const markerMaterial2 = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    transparent: true,
    opacity: 0.2
});
const teleportMarker2 = new THREE.Mesh(markerGeometry2, markerMaterial2);
teleportMarker2.position.set(14, -0.45, -55); // Medio hundido en el suelo
scene.add(teleportMarker2);

// Cylindrical teleport marker
const markerGeometryTP = new THREE.CylinderGeometry(0.5, 0.5, 20, 32);
const markerMaterialTP = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    transparent: true,
    opacity: 0.2
});
const teleportMarkerTP = new THREE.Mesh(markerGeometryTP, markerMaterialTP);
teleportMarkerTP.position.set(4, 31, 4); // Medio hundido en el suelo
scene.add(teleportMarkerTP);



// --- Target cube that player must hit with a thrown ball ---
const targetSize = 0.5; // 0.5 units cube
const targetGeometry = new THREE.BoxGeometry(targetSize, targetSize, targetSize);
const targetMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
// place so its base sits on y=0; user requested (-22,0,-18) -> we'll center it accordingly
targetMesh.position.set(-30, targetSize / 2, -18);
targetMesh.castShadow = true;
targetMesh.receiveShadow = true;
scene.add(targetMesh);

// Box used for collision detection (kept static)
const targetBox = new THREE.Box3().setFromObject(targetMesh);

// Redirect URL when hit (change as needed)
const targetRedirectUrl = 'https://drive.google.com/file/d/12cwNJTiGgbRAKbVfIYpfM4v8l-q8DUFe/view?usp=sharing';
let targetHit = false;

// Helper: test sphere (THREE.Sphere) vs Box3 intersection
function sphereIntersectsBox( sphere, box ) {
    // clamp sphere.center to the box to find closest point
    const closest = new THREE.Vector3();
    box.clampPoint( sphere.center, closest );
    const dist2 = closest.distanceToSquared( sphere.center );
    return dist2 <= ( sphere.radius * sphere.radius );
}






const TRAN1 = new THREE.TextureLoader();
const TEXT1 = TRAN1.load('./src/img/TELE1.png');

const geometry = new THREE.PlaneGeometry( 3, 3 );
const material = new THREE.MeshBasicMaterial( { map: TEXT1, side: THREE.DoubleSide, transparent: true} );
const plane = new THREE.Mesh( geometry, material );
scene.add( plane );
plane.rotation.set(0,(5*Math.PI)/3,0);
plane.position.set(11, 0, -22.5);

const bio = new THREE.TextureLoader();
const bio1 = bio.load('./src/img/bio.png');

const geometry1 = new THREE.PlaneGeometry( 2.5, 2.5 );
const material1 = new THREE.MeshBasicMaterial( { map: bio1, side: THREE.DoubleSide, transparent: true} );
const plane1 = new THREE.Mesh( geometry1, material1 );
scene.add( plane1 );
plane1.rotation.set(0,0,0);
plane1.position.set(3, 0.5, -24.7);


const bioT = bio.load('./src/img/bio2.png');

const geometry2 = new THREE.PlaneGeometry( 2.5, 2.5 );
const material2 = new THREE.MeshBasicMaterial( { map: bioT, side: THREE.DoubleSide, transparent: true} );
const plane2 = new THREE.Mesh( geometry2, material2 );
scene.add( plane2 );
plane2.rotation.set(0,0,0);
plane2.position.set(5.5, 0.5, -24.7);


const bioB = bio.load('./src/img/bienvenida.png');
const geometry3 = new THREE.PlaneGeometry( 3, 1 );
const material3 = new THREE.MeshBasicMaterial( { map: bioB,  transparent: true} );
const plane3 = new THREE.Mesh( geometry3, material3 );
scene.add( plane3 );
plane3.rotation.set(0,0,0);
plane3.position.set(0, 3, -8);

const ED1 = bio.load('./src/img/study1.png');
const geometryED1 = new THREE.PlaneGeometry( 3, 3 );
const materialED1 = new THREE.MeshBasicMaterial( { map: ED1,  transparent: true} );
const planeED1 = new THREE.Mesh( geometryED1, materialED1 );
scene.add( planeED1 );
planeED1.rotation.set(0,Math.PI,0);
planeED1.position.set(-7, 0.5, -41);

const ED2 = bio.load('./src/img/skills1.png');
const geometryED2 = new THREE.PlaneGeometry( 3, 3 );
const materialED2 = new THREE.MeshBasicMaterial( { map: ED2,  transparent: true} );
const planeED2 = new THREE.Mesh( geometryED2, materialED2 );
scene.add( planeED2 );
planeED2.rotation.set(0,(2*Math.PI)/3,0);
planeED2.position.set(-10.5, 0.5, -42.5);

const ED3 = bio.load('./src/img/skills2.png');
const geometryED3 = new THREE.PlaneGeometry( 3, 3 );
const materialED3 = new THREE.MeshBasicMaterial( { map: ED3,  transparent: true} );
const planeED3 = new THREE.Mesh( geometryED3, materialED3 );
scene.add( planeED3 );
planeED3.rotation.set(0,Math.PI/2,0);
planeED3.position.set(-11.5, 0.5, -46.5);

const ED4 = bio.load('./src/img/skills3.png');
const geometryED4 = new THREE.PlaneGeometry( 3, 3 );
const materialED4 = new THREE.MeshBasicMaterial( { map: ED4,  transparent: true} );
const planeED4 = new THREE.Mesh( geometryED4, materialED4 );
scene.add( planeED4 );
planeED4.rotation.set(0,Math.PI/2,0);
planeED4.position.set(-11.5, 0.5, -50);

const ED5 = bio.load('./src/img/skills4.png');
const geometryED5 = new THREE.PlaneGeometry( 3, 3 );
const materialED5 = new THREE.MeshBasicMaterial( { map: ED5,  transparent: true} );
const planeED5 = new THREE.Mesh( geometryED5, materialED5 );
scene.add( planeED5 );
planeED5.rotation.set(0,Math.PI/2,0);
planeED5.position.set(-11.5, 0.5, -53.5);

const C1 = bio.load('./src/img/M1.png');
const geometryC1 = new THREE.PlaneGeometry( 3, 3 );
const materialC1 = new THREE.MeshBasicMaterial( { map: C1,  transparent: true} );
const planeC1 = new THREE.Mesh( geometryC1, materialC1 );
scene.add( planeC1 );
planeC1.rotation.set(0,(Math.PI)/6,0);
planeC1.position.set(-9, 0, -56.5);

const T2 = bio.load('./src/img/TELE2.png');
const geometryT2 = new THREE.PlaneGeometry( 3, 3 );
const materialT2 = new THREE.MeshBasicMaterial( { map: T2,  transparent: true} );
const planeT2 = new THREE.Mesh( geometryT2, materialT2 );
scene.add( planeT2 );
planeT2.rotation.set(0,0,0);
planeT2.position.set(-2.5, 0, -56.5);

const B1 = bio.load('./src/img/BECA.png');
const geometryB1 = new THREE.PlaneGeometry( 3, 3 );
const materialB1 = new THREE.MeshBasicMaterial( { map: B1,  transparent: true} );
const planeB1 = new THREE.Mesh( geometryB1, materialB1 );
scene.add( planeB1 );
planeB1.rotation.set(0,0,0);
planeB1.position.set(-6, 0.56, -56.5);


const V1 = bio.load('./src/img/VID1.png');
const geometryV1 = new THREE.PlaneGeometry( 3, 3 );
const materialV1 = new THREE.MeshBasicMaterial( { map: V1,  transparent: true} );
const planeV1 = new THREE.Mesh( geometryV1, materialV1 );
scene.add( planeV1 );
planeV1.rotation.set(0,-Math.PI / 2,0);
planeV1.position.set(32, 0.56, -50.5);

const FT1 = bio.load('./src/img/FT1.png');
const geometryFT1 = new THREE.PlaneGeometry( 3, 3 );
const materialFT1 = new THREE.MeshBasicMaterial( { map: FT1,  transparent: true} );
const planeFT1 = new THREE.Mesh( geometryFT1, materialFT1 );
scene.add( planeFT1 );
planeFT1.rotation.set(0,-Math.PI,0);
planeFT1.position.set(26, 0.56, -40);

const FT2 = bio.load('./src/img/model1.jpg');
const geometryFT2 = new THREE.PlaneGeometry( 3, 3 );
const materialFT2 = new THREE.MeshBasicMaterial( { map: FT2,  transparent: true} );
const planeFT2 = new THREE.Mesh( geometryFT2, materialFT2 );
scene.add( planeFT2 );
planeFT2.rotation.set(0,-Math.PI,0);
planeFT2.position.set(22, 0.56, -40);

const FT3 = bio.load('./src/img/model2.jpg');
const geometryFT3 = new THREE.PlaneGeometry( 3, 3 );
const materialFT3 = new THREE.MeshBasicMaterial( { map: FT3,  transparent: true} );
const planeFT3 = new THREE.Mesh( geometryFT3, materialFT3 );
scene.add( planeFT3 );
planeFT3.rotation.set(0,-Math.PI,0);
planeFT3.position.set(18, 0.56, -40);

const FT4 = bio.load('./src/img/model3.jpg');
const geometryFT4 = new THREE.PlaneGeometry( 3, 3 );
const materialFT4 = new THREE.MeshBasicMaterial( { map: FT4,  transparent: true} );
const planeFT4 = new THREE.Mesh( geometryFT4, materialFT4 );
scene.add( planeFT4 );
planeFT4.rotation.set(0,0,0);
planeFT4.position.set(26, 0.56, -45);

const FT5 = bio.load('./src/img/model4.jpg');
const geometryFT5 = new THREE.PlaneGeometry( 3, 3 );
const materialFT5 = new THREE.MeshBasicMaterial( { map: FT5,  transparent: true} );
const planeFT5 = new THREE.Mesh( geometryFT5, materialFT5 );
scene.add( planeFT5 );
planeFT5.rotation.set(0,0,0);
planeFT5.position.set(22, 0.56, -45);

const FT6 = bio.load('./src/img/model5.jpg');
const geometryFT6 = new THREE.PlaneGeometry( 3, 3 );
const materialFT6 = new THREE.MeshBasicMaterial( { map: FT6,  transparent: true} );
const planeFT6 = new THREE.Mesh( geometryFT6, materialFT6 );
scene.add( planeFT6 );
planeFT6.rotation.set(0,0,0);
planeFT6.position.set(18, 0.56, -45);

const MODEL3D = bio.load('./src/img/MODEL1.png');
const geometryMODEL3D = new THREE.PlaneGeometry( 3, 3 );
const materialMODEL3D = new THREE.MeshBasicMaterial( { map: MODEL3D,  transparent: true} );
const planeMODEL3D = new THREE.Mesh( geometryMODEL3D, materialMODEL3D );
scene.add( planeMODEL3D );
planeMODEL3D.rotation.set(0,Math.PI/2,0);
planeMODEL3D.position.set(14, 0.25, -53);

const hv = bio.load('./src/img/HV.png');
const geometryhv = new THREE.PlaneGeometry( 3, 3 );
const materialhv = new THREE.MeshBasicMaterial( { map: hv,  transparent: true} );
const planehv = new THREE.Mesh( geometryhv, materialhv );
scene.add( planehv );
planehv.rotation.set(0,0,0);
planehv.position.set(0, 0.25, -19.5);


const HVLET = bio.load('./src/img/HV1.png');
const geometryHVLET = new THREE.PlaneGeometry( 3, 3 );
const materialHVLET = new THREE.MeshBasicMaterial( { map: HVLET,  transparent: true} );
const planeHVLET = new THREE.Mesh( geometryHVLET, materialHVLET );
scene.add( planeHVLET );
planeHVLET.rotation.set(0,Math.PI/2,0);
planeHVLET.position.set(-30, 3, -18);


// --- VIDEO ---
const video = document.createElement('video');
video.src = './src/vids/corto.mp4'; // 👈 pon aquí la ruta o URL del video
video.load();
video.muted = true; // necesario para autoplay
video.loop = true;
video.play();

// --- TEXTURA DEL VIDEO ---
const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.format = THREE.RGBFormat;

// --- MATERIAL Y PLANO ---
const videoMaterial = new THREE.MeshBasicMaterial({
  map: videoTexture,
  side: THREE.DoubleSide
});

// --- GEOMETRÍA Y POSICIÓN ---
const videoGeometry = new THREE.PlaneGeometry(16, 9);
const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);

// Escala para hacerlo más pequeño (ajusta si quieres)
videoMesh.scale.set(0.3, 0.3, 0.3);

// Posición en la escena (cámbiala según donde quieras ponerlo)
videoMesh.position.set(32, 0.5, -45.5);

videoMesh.rotation.set(0, -Math.PI / 2, 0); // Girar para que mire en la dirección correcta

scene.add(videoMesh);




const loader = new GLTFLoader().setPath( './src/models/gltf/' );

loader.load( 'japanese_temple.glb', ( gltf ) => {

    scene.add( gltf.scene );

    worldOctree.fromGraphNode( gltf.scene );

    gltf.scene.traverse( child => {

        if ( child.isMesh ) {

            child.castShadow = true;
            child.receiveShadow = true;

            if ( child.material.map ) {

                child.material.map.anisotropy = 4;

            }

        }

    } );

    const helper = new OctreeHelper( worldOctree );
    helper.visible = false;
    scene.add( helper );

    const gui = new GUI( { width: 200 } );
    gui.add( { debug: false }, 'debug' )
        .onChange( function ( value ) {

            helper.visible = value;

        } );

} );

//cargar segunda copia del templo para otra zona
const loaderword2 = new GLTFLoader().setPath( './src/models/gltf/' );

let shihiro;
loaderword2.load( 'shihiro.glb', ( gltf ) => {
    shihiro = gltf.scene;
    scene.add( shihiro );

    worldOctree.fromGraphNode( shihiro );

    shihiro.scene.traverse( child => {

        if ( child.isMesh ) {

            child.castShadow = true;
            child.receiveShadow = true;

            if ( child.material.map ) {

                child.material.map.anisotropy = 4;

            }

        }
          
        shihiro.position.set(25, 10, -50);
    } );

    const helper = new OctreeHelper( worldOctree );
    helper.visible = false;
    scene.add( helper );

    const gui = new GUI( { width: 200 } );
    gui.add( { debug: false }, 'debug' )
        .onChange( function ( value ) {

            helper.visible = value;

        } );

} );





const loaderp = new GLTFLoader().setPath( './src/models/gltf/' );
let pinguinito;

loaderp.load( 'pinguinito.glb', ( gltf ) => {
    console.log('loaderp: pinguinito.glb loaded');
    pinguinito = gltf.scene;
    // add and enable shadows
    scene.add( pinguinito );
    pinguinito.traverse( child => {
        if ( child.isMesh ) {
            child.castShadow = true;
            child.receiveShadow = true;
            if ( child.material && child.material.map ) child.material.map.anisotropy = 4;
        }
    } );

    pinguinito.position.set(9, -1, -24.5);
    pinguinito.rotation.set(0, Math.PI / 4, 0);

} );

    const loaderp1 = new GLTFLoader().setPath( './src/models/gltf/' );
let pinguinito1;

loaderp1.load( 'pinguinito.glb', ( gltf ) => {
    console.log('loaderp1: pinguinito.glb loaded');
    pinguinito1 = gltf.scene;
    scene.add( pinguinito1 );
    pinguinito1.traverse( child => {
        if ( child.isMesh ) {
            child.castShadow = true;
            child.receiveShadow = true;
            if ( child.material && child.material.map ) child.material.map.anisotropy = 4;
        }
    } );

    pinguinito1.position.set(13.5, -1, -45);
    pinguinito1.rotation.set(0, Math.PI, 0);

} );

    const loaderp2 = new GLTFLoader().setPath( './src/models/gltf/' );
let pinguinito2;

loaderp1.load( 'compu.glb', ( gltf ) => {
    console.log('loaderp1: pinguinito.glb loaded');
    pinguinito2 = gltf.scene;
    scene.add( pinguinito2 );
    pinguinito2.traverse( child => {
        if ( child.isMesh ) {
            child.castShadow = true;
            child.receiveShadow = true;
            if ( child.material && child.material.map ) child.material.map.anisotropy = 4;
        }
    } );

    pinguinito2.position.set(15, -1, -50);
    pinguinito2.rotation.set(0, Math.PI/2, 0);

} );


function teleportPlayerIfOob() {

    if ( camera.position.y <= - 25 ) {

        playerCollider.start.set( 0, 0.35, 0 );
        playerCollider.end.set( 0, 1, 0 );
        playerCollider.radius = 0.35;
        camera.position.copy( playerCollider.end );
        camera.rotation.set( 0, 0, 0 );

    }

}

function teleportPlayer1to2() {
    // Calcula el centro del jugador (no la cámara)
    const playerPosition = playerCollider.end.clone()
        .add(playerCollider.start)
        .multiplyScalar(0.5);

    // Define la zona de activación del teletransporte
    const inZone =
        playerPosition.x >= 11 && playerPosition.x <= 13 &&
        playerPosition.z >= -21 && playerPosition.z <= -19 &&
        playerPosition.y >= -1 && playerPosition.y <= 2;

    if (inZone) {
        // --- DESTINO DEL TELETRANSPORTE ---
        const destination = new THREE.Vector3(-4, 0, -45);

        // --- ACTUALIZAR POSICIÓN DEL COLLIDER Y CÁMARA ---
        playerCollider.start.copy(destination.clone().add(new THREE.Vector3(0, 0.35, 0)));
        playerCollider.end.copy(destination.clone().add(new THREE.Vector3(0, 1, 0)));
        playerCollider.radius = 0.35;
        camera.position.copy(playerCollider.end);
        camera.rotation.set(0, Math.PI/2, 0);
    }
}

function teleportPlayerFrom2to2() {
    // --- Calcular el centro real del jugador ---
    const playerPosition = playerCollider.end.clone()
        .add(playerCollider.start)
        .multiplyScalar(0.5);

    // --- Zona de activación del teletransporte ---
    // Puedes ajustar el rango (por defecto ±1 en X y Z)
    const inZone =
        playerPosition.x >= -2 && playerPosition.x <= 0 &&   // alrededor de X = -1
        playerPosition.y >= -1 && playerPosition.y <= 2 &&   // rango vertical
        playerPosition.z >= -58 && playerPosition.z <= -56;  // alrededor de Z = -57

    if (inZone) {
        // --- DESTINO DEL TELETRANSPORTE ---
        const destination = new THREE.Vector3(28.5, 0, -53);

        // --- ACTUALIZAR POSICIÓN DEL COLLIDER Y CÁMARA ---
        playerCollider.start.copy(destination.clone().add(new THREE.Vector3(0, 0.35, 0)));
        playerCollider.end.copy(destination.clone().add(new THREE.Vector3(0, 1, 0)));
        playerCollider.radius = 0.35;

        camera.position.copy(playerCollider.end);
        camera.rotation.set(0, -Math.PI, 0);
    }
}

function teleportPlayerFrom3to2() {
    // --- Calcular el centro real del jugador ---
    const playerPosition = playerCollider.end.clone()
        .add(playerCollider.start)
        .multiplyScalar(0.5);

    // --- Zona de activación del teletransporte ---
    // Puedes ajustar el rango (por defecto ±1 en X y Z)
    const inZone =
        playerPosition.x >= 13 && playerPosition.x <= 15 &&   // alrededor de X = -1
        playerPosition.y >= -1 && playerPosition.y <= 2 &&   // rango vertical
        playerPosition.z >= -56 && playerPosition.z <= -54;  // alrededor de Z = -57

    if (inZone) {
        // --- DESTINO DEL TELETRANSPORTE ---
        const destination = new THREE.Vector3(0, 35, 0);

        // --- ACTUALIZAR POSICIÓN DEL COLLIDER Y CÁMARA ---
        playerCollider.start.copy(destination.clone().add(new THREE.Vector3(0, 0.35, 0)));
        playerCollider.end.copy(destination.clone().add(new THREE.Vector3(0, 1, 0)));
        playerCollider.radius = 0.35;

        camera.position.copy(playerCollider.end);
        camera.rotation.set(0, 0, 0);
    }
}

function teleportPlayerFrom4to2() {
    // --- Calcular el centro real del jugador ---
    const playerPosition = playerCollider.end.clone()
        .add(playerCollider.start)
        .multiplyScalar(0.5);

    // --- Zona de activación del teletransporte ---
    // Puedes ajustar el rango (por defecto ±1 en X y Z)
    const inZone =
        playerPosition.x >= 3 && playerPosition.x <= 5 &&   // alrededor de X = -1
        playerPosition.y >= 30 && playerPosition.y <= 32 &&   // rango vertical
        playerPosition.z >= 3 && playerPosition.z <= 5;  // alrededor de Z = -57

    if (inZone) {
        // --- DESTINO DEL TELETRANSPORTE ---
        const destination = new THREE.Vector3(0, 0, 0);

        // --- ACTUALIZAR POSICIÓN DEL COLLIDER Y CÁMARA ---
        playerCollider.start.copy(destination.clone().add(new THREE.Vector3(0, 0.35, 0)));
        playerCollider.end.copy(destination.clone().add(new THREE.Vector3(0, 1, 0)));
        playerCollider.radius = 0.35;

        camera.position.copy(playerCollider.end);
        camera.rotation.set(0, 0, 0);
    }
}

function animate() {

    

    const deltaTime = Math.min( 0.05, clock.getDelta() ) / STEPS_PER_FRAME;

    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.

    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {

        controls( deltaTime );

        updatePlayer( deltaTime );

        updateSpheres( deltaTime );

        teleportPlayerIfOob();

        teleportPlayer1to2()
        
        teleportPlayerFrom2to2()

        teleportPlayerFrom3to2()

        teleportPlayerFrom4to2()
    }

    renderer.render( scene, camera );

    stats.update();

}