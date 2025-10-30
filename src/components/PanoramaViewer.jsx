import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import projectData from "../APIdata.json";

export default function PanoramaViewer({ panoramas }) {
  const containerRef = useRef(null);
  const textureCache = useRef({});
  const [currentScene, setCurrentScene] = useState(panoramas[0]);
  const [history, setHistory] = useState([]);
  const [isReady, setIsReady] = useState(false);
  // const [loadingProgress, setLoadingProgress] = useState(0); 
  // const [isLoading, setIsLoading] = useState(false); 

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const clickableRef = useRef([]);
  const loaderRef = useRef(new THREE.TextureLoader());

  const panoMesh1Ref = useRef(null);
  const panoMesh2Ref = useRef(null);
  const isTransitioningRef = useRef(false);
  const [usingMesh1, setUsingMesh1] = useState(true);

  const autorotateSpeed = 0.3;
  const autorotateTimeoutRef = useRef(null);


  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const loadPromises = panoramas.map(
      (p) =>
        new Promise((resolve) => {
          if (textureCache.current[p.image]) return resolve();
          loader.load(
            p.image,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              tex.generateMipmaps = true;
              textureCache.current[p.image] = tex;
              resolve();
            },
            undefined,
            () => {
              console.warn("Failed to preload:", p.image);
              resolve();
            }
          );
        })
    );
    Promise.all(loadPromises).then(() => setIsReady(true));
  }, [panoramas]);


  const loadTexture = (url) =>
    new Promise((resolve, reject) => {
      if (textureCache.current[url]) {
        resolve(textureCache.current[url]);
      } else {
        // setIsLoading(true);
        // setLoadingProgress(0);
        loaderRef.current.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;
            textureCache.current[url] = tex;
            // setLoadingProgress(100);
            // setTimeout(() => setIsLoading(false), 400);
            resolve(tex);
          },
          (xhr) => {
            if (xhr.total) {
              // const progress = (xhr.loaded / xhr.total) * 100;
              // setLoadingProgress(progress);
            }
          },
          (err) => {
            // setIsLoading(false);
            reject(err);
          }
        );
      }
    });


const buildHotspots = async (sceneData, unitsData = []) => {
  const scene = sceneRef.current;
  const clickable = clickableRef.current;
  const svgLoader = new SVGLoader();

  // Clear old clickable meshes
  clickable.forEach((obj) => scene.remove(obj));
  clickable.length = 0;

  // Load SVG
  const svgData = await new Promise((resolve, reject) => {
    svgLoader.load(
      "/assets/svg/units.svg",
      (data) => resolve(data),
      undefined,
      (err) => reject(err)
    );
  });

  // Map paths directly by their ID
  const pathsById = {};
  svgData.paths.forEach((path) => {
    const id = path.userData?.node?.id;
    if (id) pathsById[id] = path;
  });

  // 🔒 Locked alignment from your tuned GUI values
  const controls = {
    latitude: 109.3,
    longitude: 62,
    radius: 628,
    rotation: 117.5,
    scale: 0.49,
    offsetX: -140.7,
    offsetY: -640.8,
    offsetZ: 390.2,
    rotationOffsetX: -76.2,
    rotationOffsetY: 60.5,
    rotationOffsetZ: -42,
    opacity: 0.37,
  };

  const group = new THREE.Group();
  scene.add(group);

  // --- Build meshes ---
  const phi = THREE.MathUtils.degToRad(90 - controls.latitude);
  const theta = THREE.MathUtils.degToRad(controls.longitude);
  const position = new THREE.Vector3(
    controls.radius * Math.sin(phi) * Math.cos(theta),
    controls.radius * Math.cos(phi),
    controls.radius * Math.sin(phi) * Math.sin(theta)
  );

  // Apply fine offsets
  position.x += controls.offsetX;
  position.y += controls.offsetY;
  position.z += controls.offsetZ;

  sceneData.buildings.forEach((b) => {
    const unit = unitsData.find((u) => u.building_slug === b.svg);
    if (!unit) return;

    // 🎨 Color logic
    let fillColor = "#cccccc";
    if ((unit.status === 1 || unit.status === 2) && unit.building_type_slug === "type_b")
      fillColor = "#FFEB3B";
    else if ((unit.status === 1 || unit.status === 2) && unit.building_type_slug === "type_a")
      fillColor = "#2196F3";
    else if (unit.status === 3)
      fillColor = "#F44336";

    const path = pathsById[b.svg];
    if (!path) return;

    const shapes = SVGLoader.createShapes(path);
    shapes.forEach((shape) => {
      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(fillColor),
        transparent: true,
        opacity: controls.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(controls.scale, -controls.scale, controls.scale);
      mesh.position.copy(position);
      mesh.lookAt(0, 0, 0);

      // Apply rotation offsets
      mesh.rotation.x = THREE.MathUtils.degToRad(controls.rotationOffsetX);
      mesh.rotation.y = THREE.MathUtils.degToRad(controls.rotationOffsetY);
      mesh.rotation.z = THREE.MathUtils.degToRad(controls.rotation + controls.rotationOffsetZ);

      mesh.renderOrder = 10;
      mesh.userData = {
        buildingSlug: b.svg,
        nextPanorama: b.nextPanorama,
        vr: unit.vr,
      };

      clickable.push(mesh);
      group.add(mesh);
    });
  });

  console.log("✅ SVG overlay loaded with locked alignment coordinates");
};


 
const switchPanorama = async (nextScene, unitsData) => {
  if (!nextScene || isTransitioningRef.current) return;
  isTransitioningRef.current = true;

  // Reset camera
  if (cameraRef.current) {
    cameraRef.current.position.set(0.6, 0.3, 0.1);
    cameraRef.current.updateProjectionMatrix?.();
  }

  if (controlsRef.current) {
    controlsRef.current.enabled = false;
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }

  // Load panorama
  const nextTexture = await loadTexture(nextScene.image).catch(() => null);
  if (!nextTexture) {
    if (controlsRef.current) controlsRef.current.enabled = true;
    isTransitioningRef.current = false;
    return;
  }

  const nextMesh = usingMesh1 ? panoMesh2Ref.current : panoMesh1Ref.current;
  const currentMesh = usingMesh1 ? panoMesh1Ref.current : panoMesh2Ref.current;

  nextMesh.material.map = nextTexture;
  nextMesh.material.opacity = 0;
  nextMesh.material.needsUpdate = true;

  const scene = sceneRef.current;
  const clickable = clickableRef.current;
  const newHotspots = [];

  const svgLoader = new SVGLoader();

  // 🔹 Wait for SVG to load before starting fade
  let svgData = null;
  try {
    svgData = await new Promise((resolve, reject) => {
      svgLoader.load(
        "/assets/svg/newMaskk.svg",
        (data) => resolve(data),
        undefined,
        (err) => reject(err)
      );
    });
  } catch (e) {
    console.warn("SVG load failed:", e);
  }

  if (svgData && nextScene.buildings?.length) {
    const groupedById = {};
    svgData.paths.forEach((path) => {
      const groupId = path.userData?.node?.parentNode?.id;
      if (!groupId) return;
      if (!groupedById[groupId]) groupedById[groupId] = [];
      groupedById[groupId].push(path);
    });

    for (const b of nextScene.buildings) {
      const unit = unitsData.find((u) => u.building_slug === b.svg);
      if (!unit) continue;

      // 🎨 Fill logic
      let fillColor = "#cccccc";
      if ((unit.status === 1 || unit.status === 2) && unit.building_type_slug === "type_b")
        fillColor = "#FFEB3B"; // yellow
      else if ((unit.status === 1 || unit.status === 2) && unit.building_type_slug === "type_a")
        fillColor = "#2196F3"; // blue
      else if (unit.status === 3)
        fillColor = "#F44336"; // red

      const targetGroup = groupedById[b.svg];
      if (!targetGroup) continue;

      targetGroup.forEach((path) => {
        const shapes = SVGLoader.createShapes(path);
        shapes.forEach((shape) => {
          const geometry = new THREE.ShapeGeometry(shape);
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(fillColor),
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

          const mesh = new THREE.Mesh(geometry, material);
          // 🔧 Fixed global SVG alignment
          mesh.scale.set(0.624, -0.624, 0.624);
          mesh.position.set(-329.6, -485.2, 442);
          mesh.lookAt(0, 0, 0);
          mesh.rotation.set(
            THREE.MathUtils.degToRad(-76.8),
            THREE.MathUtils.degToRad(57.5),
            THREE.MathUtils.degToRad(79 - 6)
          );

          mesh.renderOrder = 10;
          mesh.userData = {
            buildingSlug: b.svg,
            nextPanorama: b.nextPanorama,
            vr: unit.vr,
          };

          newHotspots.push(mesh);
          scene.add(mesh);
        });
      });
    }
  }

  // 🟢 Delay fade until all SVGs are ready
  await new Promise((resolve) => requestAnimationFrame(resolve));

  let opacity = 0;
  const speed = 0.02;

  await new Promise((resolve) => {
    const animateFade = () => {
      opacity += speed;
      if (opacity > 1) opacity = 1;

      nextMesh.material.opacity = opacity;
      currentMesh.material.opacity = 1 - opacity;

      clickable.forEach((obj) => {
        obj.material.opacity = 1 - opacity;
        obj.material.needsUpdate = true;
      });
      newHotspots.forEach((obj) => {
        obj.material.opacity = opacity;
        obj.material.needsUpdate = true;
      });

      if (opacity < 1) requestAnimationFrame(animateFade);
      else resolve();
    };
    animateFade();
  });

  // 🧹 Remove old SVGs safely
  clickable.forEach((obj) => {
    if (obj.parent) obj.parent.remove(obj);
  });
  clickable.length = 0;
  clickable.push(...newHotspots);

  setUsingMesh1(!usingMesh1);
  setCurrentScene(nextScene);

  currentMesh.material.opacity = 0;
  nextMesh.material.opacity = 1;

  if (cameraRef.current) cameraRef.current.position.set(0.6, 0.3, 0.1);
  if (controlsRef.current) {
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    controlsRef.current.enabled = true;
  }

  clearTimeout(autorotateTimeoutRef.current);
  autorotateTimeoutRef.current = setTimeout(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = true;
  }, 2000);

  isTransitioningRef.current = false;
};


  useEffect(() => {
    if (!isReady) return;
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const initialTexture = textureCache.current[currentScene.image];
    const panoMesh1 = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: initialTexture,
        transparent: true,
        opacity: 1,
      })
    );
    const panoMesh2 = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
      })
    );

    scene.add(panoMesh1);
    scene.add(panoMesh2);
    panoMesh1Ref.current = panoMesh1;
    panoMesh2Ref.current = panoMesh2;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = -0.3;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = autorotateSpeed;

    camera.position.set(0.6, 0.3, 0.1); 

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    buildHotspots(currentScene,projectData[0].units);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredObject = null;

    const canvas = renderer.domElement;
    canvas.style.cursor = "grab";

    const stopRotation = () => {
      if (controls.autoRotate) controls.autoRotate = false;
      clearTimeout(autorotateTimeoutRef.current);
    };

    const onMouseEnter = () => (canvas.style.cursor = "grab");
    const onMouseLeave = () => (canvas.style.cursor = "default");
    const onMouseDown = () => {
      canvas.style.cursor = "grabbing";
      stopRotation();
    };
    const onMouseUp = () => (canvas.style.cursor = "grab");

const onWheel = (event) => {
  event.preventDefault();
  stopRotation();
  canvas.style.cursor = "grabbing";

  if (camera.fov) {

    const zoomSpeed = 6;
    camera.fov += event.deltaY * 0.01 * zoomSpeed;
    camera.fov = THREE.MathUtils.clamp(camera.fov, 30, 90); 
    camera.updateProjectionMatrix();
  }

  setTimeout(() => (canvas.style.cursor = "grab"), 300);
};


    canvas.addEventListener("mouseenter", onMouseEnter);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel);

    const onMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableRef.current);
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (hoveredObject !== obj) {
          if (hoveredObject) hoveredObject.material.opacity = 0.4;
          hoveredObject = obj;
          hoveredObject.material.opacity = 0.2;
        }
      } else {
        if (hoveredObject) hoveredObject.material.opacity = 0.4;
        hoveredObject = null;
      }
    };
    canvas.addEventListener("mousemove", onMouseMove);

    const onClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableRef.current);
      if (!intersects.length) return;
      const next = panoramas.find(
        (p) => p.id === intersects[0].object.userData.nextPanorama
      );
    if (next) {
  setHistory((h) => [...h, JSON.parse(JSON.stringify(currentScene))]);
  switchPanorama(next, projectData[0].units);
}

    };
    canvas.addEventListener("click", onClick);

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mouseenter", onMouseEnter);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      renderer.dispose();
      container.removeChild(canvas);
    };
  }, [isReady]);

const goBack = async () => {
  if (history.length === 0) return;
  const prev = history[history.length - 1];
  setHistory((h) => h.slice(0, -1));

  await switchPanorama(prev, projectData[0].units);
  buildHotspots(prev, projectData[0].units);
};


  if (!isReady) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: "black" }}
      />

      {/* {!isLoading && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-800">
          <div
            className="h-1 bg-white-500 transition-all duration-100"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      )} */}

      {history.length > 0 && (
        <button
          onClick={goBack}
          className="absolute top-4 left-4 z-10 px-4 py-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md transition-all duration-300"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
