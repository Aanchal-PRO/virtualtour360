import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function PanoramaViewer({ panoramas }) {
  const containerRef = useRef(null);
  const [currentScene, setCurrentScene] = useState(panoramas[0]);
  const [history, setHistory] = useState([]);
  const textureCache = useRef({});
  const fadeDuration = 1000; // 🔥 1 second fade duration
const materialRef = useRef(null);
const sceneRef = useRef(null);
const cameraRef = useRef(null);
const rendererRef = useRef(null);
const clickableRef = useRef([]);
const loaderRef = useRef(null);

  // Preload all panoramas
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    panoramas.forEach((p) => {
      if (!textureCache.current[p.image]) {
        textureCache.current[p.image] = loader.load(p.image);
      }
    });
  }, [panoramas]);

  // ⬆️ Place this outside of useEffect (within component scope)
const switchPanoramaWithFade = ({
  next,
  material,
  loader,
  clickable,
  scene,
  camera,
  renderer,
  setCurrentScene,
}) => {
  if (!next || !next.image) {
    console.error("Invalid 'next' panorama passed to switchPanoramaWithFade:", next);
    return;
  }
console.log("added animation");
  const start = performance.now();

  const fadeOut = (time) => {
    const progress = (time - start) / fadeDuration;
    material.opacity = Math.max(1 - progress, 0);
    clickable.forEach(plane => {
      if (plane.material) {
        plane.material.opacity = Math.max(1 - progress, 0);
      }
    });

    renderer.render(scene, camera);

    if (progress < 1) {
      requestAnimationFrame(fadeOut);
    } else {
      // Load next texture
      const nextTexture =
        textureCache.current[next.image] || loader.load(next.image);
      nextTexture.colorSpace = THREE.SRGBColorSpace;

      // Set new texture
      material.map = nextTexture;
      setCurrentScene(next); // 🔁 MOVE THIS BEFORE fade-in to trigger re-render or updates

      const fadeInStart = performance.now();
      const fadeIn = (t) => {
        const prog = (t - fadeInStart) / fadeDuration;
        material.opacity = Math.min(prog, 1);
        renderer.render(scene, camera);
        if (prog < 1) requestAnimationFrame(fadeIn);
      };
      requestAnimationFrame(fadeIn);
    }
  };

  requestAnimationFrame(fadeOut);
};



  useEffect(() => {
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

    // Load texture (from cache if available)
    const loader = new THREE.TextureLoader();
    loaderRef.current = loader;
    const panoTexture =
      textureCache.current[currentScene.image] ||
      loader.load(currentScene.image);
    panoTexture.colorSpace = THREE.SRGBColorSpace;

    // Create main panorama mesh
    const geometry = new THREE.SphereGeometry(500, 40, 30);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: panoTexture,
      transparent: true,
      opacity: 1,
      depthWrite: false,   // prevent hiding overlays
    });

    materialRef.current = material;
sceneRef.current = scene;
cameraRef.current = camera;
rendererRef.current = renderer;

    const panoMesh = new THREE.Mesh(geometry, material);
    scene.add(panoMesh);

    // 🔥 Store reference for fade transition
    let fadeMesh = null;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = -0.3;
    camera.position.set(0.6, 0.3, 0.1);

    // Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickable = [];
    let hoveredObject = null;
clickableRef.current = clickable;

    const updatePlanePosition = (plane, b) => {
      const phi = THREE.MathUtils.degToRad(90 - b.latitude);
      const theta = THREE.MathUtils.degToRad(b.longitude);
      const x = b.radius * Math.sin(phi) * Math.cos(theta);
      const y = b.radius * Math.cos(phi);
      const z = b.radius * Math.sin(phi) * Math.sin(theta);

      plane.position.set(x, y, z);
      plane.lookAt(0, 0, 0);
      plane.rotation.z = THREE.MathUtils.degToRad(b.rotation);

      const aspect =
        plane.material.map.image?.width / plane.material.map.image?.height || 1;
      const width = b.size * aspect;
      const height = b.size;
      plane.geometry.dispose();
      plane.geometry = new THREE.PlaneGeometry(width, height);
    };

    // Add SVG markers
    currentScene.buildings.forEach((b) => {
      loader.load(
        b.svg,
        (svgTexture) => {
          svgTexture.colorSpace = THREE.SRGBColorSpace;
          svgTexture.needsUpdate = true;
          svgTexture.generateMipmaps = true;

       
          const mat = new THREE.MeshBasicMaterial({
            map: svgTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,      
            alphaTest: 0.01,       
          });



          const plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), mat);
          plane.renderOrder = 1;
          updatePlanePosition(plane, b);
          plane.userData = { nextPanorama: b.nextPanorama };
          scene.add(plane);
          clickable.push(plane);
        },
        undefined,
        (err) => console.error("Error loading SVG:", err)
      );
    });


    // Hover animation
    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickable);
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (hoveredObject !== obj) {
          if (hoveredObject) hoveredObject.material.opacity = 1;
          hoveredObject = obj;
          hoveredObject.material.opacity = 0.3;
        }
      } else if (hoveredObject) {
        hoveredObject.material.opacity = 1;
        hoveredObject = null;
      }
    };
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickable);
      if (intersects.length === 0) return;

      const clicked = intersects[0];
      const next = panoramas.find(
        (p) => p.id === clicked.object.userData.nextPanorama
      );
      if (!next) return;

switchPanoramaWithFade({
  next,
  material: materialRef.current,
  loader: loaderRef.current,
  clickable: clickableRef.current,
  scene: sceneRef.current,
  camera: cameraRef.current,
  renderer: rendererRef.current,
  setCurrentScene,
});


     setHistory(prev => [...prev, currentScene]);
    }
    renderer.domElement.addEventListener("click", onClick);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [currentScene]);


const goBack = () => {
  if (history.length === 0) return;

  const prev = history[history.length - 1];
  if (!prev || !prev.image) {
    console.error("Invalid panorama in history:", prev);
    return;
  }

  setHistory((h) => h.slice(0, -1));

  switchPanoramaWithFade({
    next: prev,
    material: materialRef.current,
    loader: loaderRef.current,
    clickable: clickableRef.current,
    scene: sceneRef.current,
    camera: cameraRef.current,
    renderer: rendererRef.current,
    setCurrentScene,
  });
};



  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: "black" }}
      />

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
