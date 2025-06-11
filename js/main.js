import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/RGBELoader.js";
import { DRACOLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/DRACOLoader.js";


// Global Default
let swingEnabled = false;
let swingSpeed = 0.5;
let returningToCenter = false;
let swingTime = 0;
let swingAngle = 0;
let currentAntialias = false;
let gridFadeTarget = 1;
let fadeSpeed = 0.05;
let hdrTexture = null;

// Scene setup
const scene = new THREE.Scene();
const clock = new THREE.Clock();
scene.environment = null;

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(5, 4, 5);
camera.lookAt(new THREE.Vector3(0, 2, 0));

let renderer;
let controls;

function initRenderer(antialias = false) {
  const previousTarget = controls?.target?.clone();
  const shadowWasEnabled = renderer?.shadowMap?.enabled ?? false; // simpan status sebelumnya

  if (renderer) {
    renderer.dispose();
    const oldCanvas = renderer.domElement;
    oldCanvas?.remove();
  }

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = shadowWasEnabled; 
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  document.getElementById("container3D").appendChild(renderer.domElement);

  if (controls) {
    controls.dispose();
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minDistance = 5;
  controls.maxDistance = 20;
  controls.enablePan = false;

  if (previousTarget) {
    controls.target.copy(previousTarget);
  }

  updateEnvMap();
  controls.update();
}

initRenderer(false);

// Grid
const gridHelper = new THREE.GridHelper(30, 20);
gridHelper.material.transparent = true;
gridHelper.material.opacity = 1;
gridHelper.position.y = 0;
scene.add(gridHelper);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(512, 512);
directionalLight.shadow.bias = -0.002;
directionalLight.shadow.radius = 4;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 50;

scene.add(directionalLight);

const shadowQualityMap = {
  "Low": 512,
  "Medium": 1024,
  "High": 2048,
  "Ultra": 4096
};

let currentShadowQuality = "Low";


// HDRI environment
const pmremGenerator = new THREE.PMREMGenerator(renderer);
let envMapGlobal = null;

new RGBELoader()
  .setPath('./hdr/')
  .load('paul_lobe_haus_4k.hdr', (texture) => {
    hdrTexture = texture;

    const newPMREM = new THREE.PMREMGenerator(renderer);
    envMapGlobal = newPMREM.fromEquirectangular(hdrTexture).texture;

    // HANYA AKTIFKAN scene.environment jika toggle HDRI aktif
    if (hdriToggle && hdriToggle.checked) {
      scene.environment = envMapGlobal;
    } else {
      scene.environment = null; // pastikan nonaktif
    }

    // Kalau objek sudah ada, perbarui materialnya sesuai toggle
    if (object) {
      applyEnvMapToMaterials(object, hdriToggle && hdriToggle.checked ? envMapGlobal : null);
    }

    hdrTexture.dispose();
    newPMREM.dispose();
  });


// Load model
let object;

function normalizeModel(model, targetSize = 8) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxDim;
  model.scale.setScalar(scale);

  model.position.x -= center.x;
  model.position.z -= center.z;

  const newBox = new THREE.Box3().setFromObject(model);
  model.position.y -= newBox.min.y;
}

function applyEnvMapToMaterials(model, envMap, intensity = 0.3) {
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.envMap = envMap;
      child.material.envMapIntensity = intensity;
      child.material.needsUpdate = true;
    }
  });
}

function applyGlassAndMetalMaterial(child) {
  if (!child.isMesh || !child.material) return;

  const matName = child.material.name?.toLowerCase() || "";
  const isGlass = matName.includes("glass") || matName.includes("kaca");
  const isMetal = matName.includes("metal") || child.material.metalness > 0;

  if (isGlass) {
    child.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0,
      transmission: 1.0,
      ior: 1.52,
      thickness: 0.01,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.15,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      envMap: envMapGlobal,
      envMapIntensity: 1.0,
      depthWrite: false
    });
  } else if (isMetal) {
    child.material.roughness = 0.1;
    child.material.metalness = 1.0;
    child.material.envMapIntensity = 0.3;
    child.material.needsUpdate = true;
  }
}

function setCameraFrontTop(model) {
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 1.0;

  const x = center.x;
  const y = center.y + distance * 0.6;
  const z = center.z + distance;

  camera.position.set(x, y, z);
  camera.lookAt(center);

  controls.target.copy(center);
  controls.update();
}

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/'); 
loader.setDRACOLoader(dracoLoader);

const objToRender = 'Mini Stadium';

window.addEventListener("DOMContentLoaded", () => {
  showLoader(); 

  setTimeout(() => {
    loader.load(`./models/${objToRender}/scene.glb`, (gltf) => {
      object = gltf.scene;
      normalizeModel(object, 9);

      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
        applyGlassAndMetalMaterial(child);
      });

      scene.add(object);
      setCameraFrontTop(object);
      updateMeshDataDisplay(object); 
      
      const useEnvMap = (hdriToggle && hdriToggle.checked) ? envMapGlobal : null;
      applyEnvMapToMaterials(object, useEnvMap);

      directionalLight.target = object;
      scene.add(directionalLight.target);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.ShadowMaterial({ opacity: 0.25 })
      );

      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.01;
      ground.receiveShadow = false;
      scene.add(ground);

      hideLoader(); 
    }, undefined, (error) => {
        console.error("Failed to load default model:", error);
        hideLoader();

        if (!navigator.onLine) {
          showErrorToast("No Internet Connection", "Failed to load the default model. You are currently offline.");
        } else {
          showErrorToast("Default Model Load Failed", "Could not load the default model. Please check if the model exists.");
        }
    });
  }, 10000); 
});


const animationToggle = document.getElementById('animationToggle');
const levelSelector = document.querySelector('.vertical-level-selector');
const vCircles = levelSelector.querySelectorAll('.v-circle');
const vLines = levelSelector.querySelectorAll('.v-line');

// === ANIMASI SWING ===
function swingModel(deltaTime) {
  if (!swingEnabled || !object || returningToCenter) return;

  const angleLimit = Math.PI / 8; // batas kiri-kanan max
  swingTime += deltaTime * swingSpeed;

  const angle = Math.sin(swingTime) * angleLimit;
  object.rotation.y = angle;
}

// Animation
function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  controls.update();
  swingModel(deltaTime);
  returnToCenter();

  if (gridHelper.material.opacity !== gridFadeTarget) {
    const diff = gridFadeTarget - gridHelper.material.opacity;
    const delta = Math.sign(diff) * fadeSpeed;
    gridHelper.material.opacity = THREE.MathUtils.clamp(
      gridHelper.material.opacity + delta,
      0, 1
    );
    if (gridHelper.material.opacity <= 0) {
      gridHelper.visible = false;
    }
  }

  renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// === TOGGLE ANIMASI ===
animationToggle.addEventListener('change', (e) => {
  swingEnabled = e.target.checked;

  if (!swingEnabled && object) {
    returningToCenter = true;
    swingTime = 0; // reset waktu supaya tidak loncat saat diaktifkan ulang
  }
});


// === PILIH LEVEL KECEPATAN ===
vCircles.forEach((circle, index) => {
  circle.addEventListener('click', () => {
    // 1. Set nilai kecepatan
    swingSpeed = parseFloat(circle.dataset.level);

    // 2. Update kelas aktif
    vCircles.forEach(c => c.classList.remove('active-level-speed'));
    circle.classList.add('active-level-speed');

    // 3. Aktifkan garis progress
    vLines.forEach((line, i) => {
      if (i < index) {
        line.style.transform = 'scaleX(1)';
      } else {
        line.style.transform = 'scaleX(0)';
      }
    });
  });

  // Set default saat load
  if (circle.dataset.level === levelSelector.dataset.default) {
    circle.click(); // trigger klik default
  }
});

function returnToCenter() {
  if (!object || !returningToCenter) return;

  const currentY = object.rotation.y;
  const lerpSpeed = 0.05; // kecepatan kembali (semakin kecil = makin halus)
  const newY = THREE.MathUtils.lerp(currentY, 0, lerpSpeed);

  object.rotation.y = newY;

  // Jika sudah sangat dekat ke 0, hentikan
  if (Math.abs(newY) < 0.001) {
    object.rotation.y = 0;
    swingAngle = 0;
    returningToCenter = false;
  }
}

const shadowToggle = document.getElementById('shadowToggle');
shadowToggle.checked = false; // pastikan OFF di awal

shadowToggle.addEventListener('change', (e) => {
  const enabled = e.target.checked;
  renderer.shadowMap.enabled = enabled;
  directionalLight.castShadow = enabled;

  if (enabled) {
    const res = shadowQualityMap[currentShadowQuality];
    directionalLight.shadow.mapSize.set(res, res);
    directionalLight.shadow.map?.dispose();

    directionalLight.shadow.map = null;
    directionalLight.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    renderer.compile(scene, camera);


    object?.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    renderer.shadowMap.needsUpdate = true;
    renderer.compile(scene, camera);
  } else {
    object?.traverse(child => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }
});


const qualityCircles = document.querySelectorAll('.vertical-level-shadow .v-circle-shadow');
const qualityLines = document.querySelectorAll('.vertical-level-shadow .v-line-shadow');

qualityCircles.forEach((circle, index) => {
  circle.addEventListener('click', () => {
    const level = circle.dataset.level;
    currentShadowQuality = level;

    // Update UI (circle dan garis)
    qualityCircles.forEach(c => c.classList.remove('active-level-shadow'));
    circle.classList.add('active-level-shadow');

    qualityLines.forEach((line, i) => {
      line.style.transform = i < index ? 'scaleX(1)' : 'scaleX(0)';
    });

    // Jika shadow sedang aktif, update kualitas
    if (renderer.shadowMap.enabled) {
      const res = shadowQualityMap[level];
      directionalLight.shadow.mapSize.set(res, res);
      directionalLight.shadow.map?.dispose();
      directionalLight.shadow.map = null;
      directionalLight.shadow.camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate = true;
      renderer.compile(scene, camera);
    }
  });

  // Trigger default jika level sesuai data-default
  const wrapper = document.querySelector('.vertical-level-shadow');
  if (circle.dataset.level === wrapper.dataset.default) {
    circle.click();
  }
});

const modelCards = document.querySelectorAll('.card.group-1');
const loaderWrapper = document.querySelector('.loader-wrapper');
let isModelLoading = false;

function showLoader() {
  loaderWrapper.classList.add('active');
}

function hideLoader() {
  loaderWrapper.classList.remove('active');
}

function removeCurrentModel() {
  if (object) {
    scene.remove(object);
    object.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    object = null;
  }
}

function loadNewModel(modelName) {
  isModelLoading = true;
  showLoader();
  removeCurrentModel();

  setTimeout(() => {
    const newLoader = new GLTFLoader();
    const newDracoLoader = new DRACOLoader();
    newDracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
    newLoader.setDRACOLoader(newDracoLoader);

    newLoader.load(`./models/${modelName}/scene.glb`, (gltf) => {
      object = gltf.scene;
      normalizeModel(object, 9);

      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = renderer.shadowMap.enabled;
          child.receiveShadow = renderer.shadowMap.enabled;
          applyGlassAndMetalMaterial(child);
        }
      });

      scene.add(object);
      setCameraFrontTop(object);
      updateMeshDataDisplay(object);
      updateTitleWithAnimation(modelName);

      const useEnvMap = hdriToggle.checked ? envMapGlobal : null;
      applyEnvMapToMaterials(object, useEnvMap);
      
      directionalLight.target = object;
      scene.add(directionalLight.target);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.ShadowMaterial({ opacity: 0.25 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.01;
      ground.receiveShadow = false;
      scene.add(ground);

      // 👇 DIPINDAH KE SINI
      resetSettingsToDefault();
      hideLoader();
      isModelLoading = false;

    }, undefined, (error) => {
      console.error("Failed to load model:", error);
      hideLoader();

      if (!navigator.onLine) {
        showErrorToast("No Internet Connection", "Please check your network and try again.");
      } else {
        showErrorToast("Model Load Failed", `The model "${modelName}" is not available.`);
      }
    });
  }, 5000); 
}

function updateMeshDataDisplay(model) {
  let totalVertices = 0;
  let totalTriangles = 0;
  let meshCount = 0;

  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshCount++;
      const geometry = child.geometry;
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();

      const position = geometry.attributes.position;
      const index = geometry.index;

      if (position) {
        totalVertices += position.count;

        // Gunakan .index jika tersedia untuk menghitung triangle secara akurat
        if (index) {
          totalTriangles += index.count / 3;
        } else {
          totalTriangles += position.count / 3;
        }
      }
    }
  });

  // Update angka di UI
  const totalAll = totalTriangles + totalVertices + meshCount;
  const totalCountEl = document.querySelector('.total-count');
  if (totalCountEl) {
    totalCountEl.textContent = totalAll.toLocaleString();
  }


  const legendItems = document.querySelectorAll('.legend-item');

  if (legendItems.length >= 3) {
    legendItems[0].querySelector('.value').textContent = totalTriangles.toLocaleString();
    legendItems[1].querySelector('.value').textContent = totalVertices.toLocaleString();
    legendItems[2].querySelector('.value').textContent = meshCount.toLocaleString();
  }

  // Hitung lebar progress bar secara relatif
  const maxValue = Math.max(totalTriangles, totalVertices, meshCount);
  const minWidth = 20;

  const calcWidth = (val) => maxValue === 0 ? minWidth : Math.max((val / maxValue) * 100, minWidth);

  document.querySelector('.progress-triangles').style.width = `${calcWidth(totalTriangles)}%`;
  document.querySelector('.progress-vertices').style.width = `${calcWidth(totalVertices)}%`;
  document.querySelector('.progress-meshes').style.width = `${calcWidth(meshCount)}%`;
}

modelCards.forEach(card => {
  card.addEventListener('click', () => {
    if (isModelLoading || card.classList.contains('active-model')) return;

    // Update UI class active
    modelCards.forEach(c => c.classList.remove('active-model'));
    card.classList.add('active-model');

    const modelName = card.dataset.model;
    loadNewModel(modelName);
  });
});

const aaToggle = document.getElementById('antialiasingToggle');
aaToggle.checked = false;

aaToggle.addEventListener('change', (e) => {
  const enabled = e.target.checked;

  currentAntialias = enabled;
  initRenderer(enabled);

});

// === TOGGLE GRID HELPER DENGAN FADE IN/OUT ===
gridHelper.material.transparent = true;
gridHelper.material.opacity = 1;
gridHelper.visible = true;

const gridToggle = document.getElementById('gridToggle');
gridToggle.checked = true; 

gridToggle.addEventListener('change', (e) => {
  const show = e.target.checked;
  gridHelper.visible = true; 
  gridFadeTarget = show ? 1 : 0;
});

const hdriToggle = document.getElementById('hdriToggle');
hdriToggle.checked = false; 

hdriToggle.addEventListener('change', (e) => {
  const enabled = e.target.checked;

  scene.environment = enabled ? envMapGlobal : null;

  if (object) {
    applyEnvMapToMaterials(object, enabled ? envMapGlobal : null, 0.3);
  }

});

function updateEnvMap() {
  if (!hdrTexture || !renderer) return;

  const newPMREM = new THREE.PMREMGenerator(renderer);
  const envMap = newPMREM.fromEquirectangular(hdrTexture).texture;
  envMapGlobal = envMap;

  // Jika toggle aktif, baru apply ke scene dan object
  if (hdriToggle && hdriToggle.checked) {
    scene.environment = envMapGlobal;
    if (object) {
      applyEnvMapToMaterials(object, envMapGlobal);
    }
  }

  hdrTexture.dispose();
  newPMREM.dispose();
}


function resetSettingsToDefault() {
  // Reset Antialiasing
  const aaToggle = document.getElementById('antialiasingToggle');
  aaToggle.checked = false;
  currentAntialias = false;
  initRenderer(false);

  // Reset Shadow
  const shadowToggle = document.getElementById('shadowToggle');
  shadowToggle.checked = false;
  renderer.shadowMap.enabled = false;
  directionalLight.castShadow = false;

  // Reset Shadow Resolution ke "Low"
  currentShadowQuality = "Low";
  const shadowWrapper = document.querySelector('.vertical-level-shadow');
  const defaultShadow = shadowWrapper.dataset.default;
  const allShadowCircles = document.querySelectorAll('.v-circle-shadow');
  const allShadowLines = document.querySelectorAll('.v-line-shadow');

  allShadowCircles.forEach((circle, index) => {
    const level = circle.dataset.level;
    if (level === defaultShadow) {
      circle.classList.add('active-level-shadow');
    } else {
      circle.classList.remove('active-level-shadow');
    }
  });

  // Reset semua garis jadi 0
  allShadowLines.forEach(line => {
    if (line) line.style.transform = 'scaleX(0)';
  });


  // Reset Animation
  const animationToggle = document.getElementById('animationToggle');
  animationToggle.checked = false;
  swingEnabled = false;
  returningToCenter = true;
  swingTime = 0;

  // Reset Animation Speed ke default
  const speedWrapper = document.querySelector('.vertical-level-selector');
  const defaultSpeed = speedWrapper.dataset.default;
  const allSpeedCircles = document.querySelectorAll('.v-circle');
  const allSpeedLines = document.querySelectorAll('.v-line');

  allSpeedCircles.forEach((circle, index) => {
    const level = circle.dataset.level;
    if (level === defaultSpeed) {
      circle.classList.add('active-level-speed');
      swingSpeed = parseFloat(level);
    } else {
      circle.classList.remove('active-level-speed');
    }
  });

  // Reset semua garis jadi 0
  allSpeedLines.forEach(line => {
    if (line) line.style.transform = 'scaleX(0)';
  });


  // Reset HDRI toggle
  const hdriToggle = document.getElementById('hdriToggle');
  hdriToggle.checked = false;
  scene.environment = null;

  // Reset Grid toggle
  const gridToggle = document.getElementById('gridToggle');
  gridToggle.checked = true;
  gridHelper.visible = true;
  gridFadeTarget = 1;

  if (object) applyEnvMapToMaterials(object, null);
}

function showErrorToast(message1 = "Error Message", message2 = "3D model belum tersedia.") {
  const toast = document.getElementById('errorToast');
  const text1 = toast.querySelector('.text-1');
  const text2 = toast.querySelector('.text-2');

  text1.textContent = message1;
  text2.textContent = message2;

  toast.classList.add('active-toast');

  // Sembunyikan otomatis setelah 4 detik
  setTimeout(() => {
    toast.classList.remove('active-toast');
  }, 10000);
}

function updateTitleWithAnimation(newTitle) {
  const titleEl = document.querySelector('.model-title');
  if (!titleEl) return;

  titleEl.style.transition = 'opacity 0.5s';
  titleEl.style.opacity = 0;

  setTimeout(() => {
    titleEl.textContent = newTitle;
    titleEl.style.opacity = 1;
  }, 500);
}
