import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

THREE.Cache.enabled = true;

const coll    = document.getElementById('coll');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let SIZE = 440;

let renderer = null;
function getRenderer() {
if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
}
return renderer;
}

const PEARL = 0xfff8ec;
const fillMat = new THREE.MeshStandardMaterial({
color: PEARL, transparent: true, opacity: 0.55, roughness: 0.22, metalness: 0.05,
emissive: PEARL, emissiveIntensity: 0.2,
side: THREE.DoubleSide, depthWrite: true, flatShading: true,
polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
});
const solidMat = new THREE.MeshStandardMaterial({
color: PEARL, roughness: 0.18, metalness: 0.05,
emissive: PEARL, emissiveIntensity: 0.2,
side: THREE.DoubleSide, flatShading: true,
polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
});
const LIGHT_HABITS = new Set(['aciculare','botroidale','geodico','lamellare','fibroso','dendritico','massiccio']);
const habitName = u => (u || '').split('/').pop().split('?')[0].replace(/\.stl$/i, '').toLowerCase();
const isHabit   = u => LIGHT_HABITS.has(habitName(u));
const INK_TARGET = 26;
const LIGHTNESS  = 0.75;
function makeEdges(geometry, url) {
const name = (url || '').split('/').pop().split('?')[0].replace(/\.stl$/i, '').toLowerCase();
const light = LIGHT_HABITS.has(name);
const lines = new THREE.EdgesGeometry(geometry, light ? 20 : 1);
let opacity = 1;
if (light) {
    const p = lines.attributes.position;
    let len = 0;
    for (let i = 0; i < p.count; i += 2) {
    len += Math.hypot(p.getX(i) - p.getX(i + 1), p.getY(i) - p.getY(i + 1), p.getZ(i) - p.getZ(i + 1));
    }
    geometry.computeBoundingSphere();
    const ink = len / (geometry.boundingSphere.radius || 1);
    opacity = Math.min(1, Math.max(0.08, Math.pow(INK_TARGET / Math.max(ink, 1e-6), LIGHTNESS)));
}
const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false, depthTest: true });
return new THREE.LineSegments(lines, mat);
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/assets/js/jsm/libs/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
const tiles  = [];

let _scrollUntil = 0;
window.addEventListener('scroll', () => { _scrollUntil = performance.now() + 120; }, { passive: true });

function buildScene(tile, geometry) {
geometry.computeVertexNormals();
geometry.center();
geometry.computeBoundingSphere();
const k = 1.8 / (geometry.boundingSphere.radius || 1);
geometry.scale(k, k, k);

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.5);
dir.position.set(5, 5, 5);
scene.add(dir);

const isMacro = isHabit(tile.el.dataset.model);
const baseMat = isMacro ? solidMat : fillMat;
const mat = baseMat.clone();
mat.userData = { baseEmissive: mat.emissiveIntensity, baseOpacity: mat.opacity, isTransparent: mat.transparent };

const mesh = new THREE.Mesh(geometry, mat);
mesh.renderOrder = 0;
scene.add(mesh);

const edges = makeEdges(geometry, tile.el.dataset.model);
edges.renderOrder = 1;
scene.add(edges);

tile.fillMat = mat;

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1.6, 6.8);
camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6);

const controls = new OrbitControls(camera, tile.canvas);
controls.enableDamping = true;
controls.enableZoom = false;
controls.enablePan = false;
controls.autoRotate = !reduced;
controls.autoRotateSpeed = 1.2;
controls.addEventListener('change', () => { tile.needs = true; });
tile.canvas.style.touchAction = 'pan-y';

tile.el.addEventListener('pointerenter', () => {
    controls.autoRotateSpeed = 4;
    if (tile.fillMat) {
    tile.fillMat.emissiveIntensity = Math.min(0.7, tile.fillMat.userData.baseEmissive + 0.4);
    tile.fillMat.opacity = Math.min(0.95, tile.fillMat.userData.baseOpacity + 0.1);
    tile.needs = true;
    }
});
tile.el.addEventListener('pointerleave', () => {
    controls.autoRotateSpeed = 1.2;
    if (tile.fillMat) {
    tile.fillMat.emissiveIntensity = tile.fillMat.userData.baseEmissive;
    tile.fillMat.opacity = tile.fillMat.userData.baseOpacity;
    tile.needs = true;
    }
});

Object.assign(tile, { scene, camera, controls, needs: true });
tile.el.parentElement.classList.add('is-ready');
}

function loadTile(tile) {
  if (tile.loading) return;
  tile.loading = true;
  
  loader.load(tile.el.dataset.model,
    (gltf) => {
      // GLTF loads a whole scene. We need to find the mesh and extract its geometry.
      let geometry = null;
      gltf.scene.traverse((child) => {
        if (child.isMesh && !geometry) geometry = child.geometry;
      });
      
      if (geometry) buildScene(tile, geometry);
    },
    undefined,
    () => {
      io.unobserve(tile.el);
      window.dispatchEvent(new CustomEvent('model-missing', { detail: tile.el.closest('.model-card') }));
    });
}

const io = new IntersectionObserver(entries => {
entries.forEach(en => {
    const tile = en.target._tile;
    tile.visible = en.isIntersecting;
    if (tile.visible) loadTile(tile);
});
}, { rootMargin: '200px' });

let _rendererFailed = false;

function frame(now) {
requestAnimationFrame(frame);
if (coll.dataset.view !== 'models' || document.hidden) return;
if (now < _scrollUntil) return;
if (_rendererFailed) return;
let r;
try { r = getRenderer(); }
catch (e) { _rendererFailed = true; console.error('[collection] WebGL unavailable, models view disabled:', e); return; }
for (const t of tiles) {
    if (!t.visible || !t.scene) continue;
    if (reduced && !t.needs) continue;
    t.needs = false;
    t.controls.update();
    r.render(t.scene, t.camera);
    t.ctx.clearRect(0, 0, SIZE, SIZE);
    t.ctx.drawImage(r.domElement, 0, 0);
}
}

window.initModels3D = function () {
if (coll.dataset.modelsInit === 'true') return;
coll.dataset.modelsInit = 'true';
const first = document.querySelector('.models-grid .model-thumb');
const w = Math.max(first ? first.clientWidth : 0, 260);
SIZE = Math.min(512, Math.round(w * (window.devicePixelRatio || 1)));
document.querySelectorAll('.models-grid .comp-3d').forEach(el => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    el.appendChild(canvas);
    const tile = { el, canvas, ctx: canvas.getContext('2d'), visible: false, loading: false, scene: null };
    el._tile = tile;
    tiles.push(tile);
    io.observe(el);
});
requestAnimationFrame(frame);
};