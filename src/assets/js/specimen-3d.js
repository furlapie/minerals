import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

THREE.Cache.enabled = true;

const LIGHT_HABITS = new Set(['aciculare', 'botroidale', 'geodico', 'lamellare', 'fibroso', 'dendritico', 'massiccio']);
const habitName = url => (url || '').split('/').pop().split('?')[0].replace(/\.(stl|glb)$/i, '').toLowerCase();
const isHabit = url => LIGHT_HABITS.has(habitName(url));
const INK_TARGET = 26;
const LIGHTNESS = 0.75;

function makeEdges(geometry, url) {
  const light = isHabit(url);
  const lines = new THREE.EdgesGeometry(geometry, light ? 20 : 1);
  let opacity = 1;

  if (light) {
    const positions = lines.attributes.position;
    let length = 0;
    for (let i = 0; i < positions.count; i += 2) {
      length += Math.hypot(
        positions.getX(i) - positions.getX(i + 1),
        positions.getY(i) - positions.getY(i + 1),
        positions.getZ(i) - positions.getZ(i + 1)
      );
    }
    geometry.computeBoundingSphere();
    const ink = length / (geometry.boundingSphere.radius || 1);
    opacity = Math.min(1, Math.max(0.08, Math.pow(INK_TARGET / Math.max(ink, 1e-6), LIGHTNESS)));
  }

  return new THREE.LineSegments(lines, new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true
  }));
}

function init3D(container, geometry, url) {
  const hexColor = container.dataset.color || '#ffffff';
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 2;
  controls.enableZoom = false;

  geometry.computeVertexNormals();
  geometry.center();
  const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  geometry.scale(3 / maxDim, 3 / maxDim, 3 / maxDim);

  const minLightness = 0.55;
  const colors = (container.dataset.colors || hexColor).split('|').filter(Boolean).map(value => {
    const color = new THREE.Color(value);
    const hsl = {};
    color.getHSL(hsl);
    if (hsl.l < minLightness) color.setHSL(hsl.h, hsl.s, minLightness);
    return color;
  });
  if (!colors.length) colors.push(new THREE.Color(hexColor));

  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const positions = geometry.attributes.position;
  const colorBuffer = new Float32Array(positions.count * 3);
  const tempColor = new THREE.Color();

  function bandColor(t) {
    const count = colors.length;
    if (count === 1) return tempColor.copy(colors[0]);
    const segment = t * count;
    const index = Math.min(count - 1, Math.floor(segment));
    const fraction = segment - index;
    if (index < count - 1 && fraction > 0.75) {
      return tempColor.copy(colors[index]).lerp(colors[index + 1], (fraction - 0.75) / 0.25);
    }
    return tempColor.copy(colors[index]);
  }

  for (let i = 0; i < positions.count; i++) {
    bandColor((positions.getY(i) - min.y) / ((max.y - min.y) || 1));
    colorBuffer.set([tempColor.r, tempColor.g, tempColor.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colorBuffer, 3));

  const averageColor = colors.reduce((sum, color) => sum.add(color), new THREE.Color(0, 0, 0))
    .multiplyScalar(1 / colors.length);
  const solid = isHabit(url);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: !solid,
    opacity: solid ? 1 : 0.65,
    roughness: 0.22,
    metalness: 0.05,
    emissive: averageColor,
    emissiveIntensity: solid ? 0.12 : 0.2,
    side: THREE.DoubleSide,
    depthWrite: true,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  scene.add(new THREE.Mesh(geometry, material));
  const edges = makeEdges(geometry, url);
  edges.renderOrder = 1;
  scene.add(edges);

  let visible = !('IntersectionObserver' in window);
  let animationFrame = 0;

  function render() {
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(render);
  }

  function setVisible(nextVisible) {
    if (visible === nextVisible) return;
    visible = nextVisible;
    if (visible) {
      if (!animationFrame) render();
    } else if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        setVisible(entry.isIntersecting && entry.intersectionRatio > 0);
      }
    }, { threshold: 0.01 });
    visibilityObserver.observe(container);
  } else {
    render();
  }

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (visible && !animationFrame) render();
  });
  resizeObserver.observe(container);
}

const stlLoader = new STLLoader();

function loadSlide(slide) {
  if (slide.dataset.modelLoadStarted === 'true') return;
  slide.dataset.modelLoadStarted = 'true';

  const container = slide.querySelector('.comp-3d');
  if (!container) return;

  const urlSpecific = container.dataset.modelSpecific;
  const urlGeneric = container.dataset.modelGeneric;
  const visualBlock = container.closest('.comp-visual');
  const container3d = visualBlock?.querySelector('.comp-3d-container');
  const containerSvg = visualBlock?.querySelector('.comp-svg-container');
  if (!visualBlock || !container3d || !containerSvg) return;

  stlLoader.load(urlSpecific, (geometry) => {
    visualBlock.classList.add('solo-3d');
    containerSvg.style.display = 'none';
    container3d.style.display = 'block';
    init3D(container, geometry, urlSpecific);
  }, undefined, () => {
    stlLoader.load(urlGeneric, (geometry) => {
      containerSvg.style.display = 'block';
      container3d.style.display = 'block';
      init3D(container, geometry, urlGeneric);
    }, undefined, () => {
      container3d.style.display = 'none';
      containerSvg.style.display = 'block';
    });
  });
}

function bootModels() {
  const slides = document.querySelectorAll('#detail .comp-slide');
  if (!slides.length) return;

  if ('IntersectionObserver' in window) {
    const slideObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !entry.target.hidden) {
          loadSlide(entry.target);
          slideObserver.unobserve(entry.target);
        }
      }
    }, { threshold: 0.01 });

    slides.forEach(slide => {
      if (!slide.hidden) slideObserver.observe(slide);
    });

    const carousel = document.querySelector('#detail .composition');
    if (carousel) {
      const visibilityObserver = new MutationObserver(() => {
        slides.forEach(slide => {
          if (!slide.hidden && slide.dataset.modelLoadStarted !== 'true') {
            slideObserver.observe(slide);
          }
        });
      });
      visibilityObserver.observe(carousel, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    }
  } else {
    slides.forEach(loadSlide);
  }
}

if ('requestIdleCallback' in window) requestIdleCallback(bootModels, { timeout: 300 });
else setTimeout(bootModels, 0);