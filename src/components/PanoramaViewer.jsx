import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function PanoramaViewer({ panoramas }) {
  const containerRef = useRef(null);
  const [currentScene, setCurrentScene] = useState(panoramas[0]);
  const [history, setHistory] = useState([]);
  const textureCache = useRef({});

  // Preload all panoramas for fast switching
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    panoramas.forEach((p) => {
      if (!textureCache.current[p.image]) {
        textureCache.current[p.image] = loader.load(p.image);
      }
    });
  }, [panoramas]);

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
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Load panorama texture (from cache if available)
    const loader = new THREE.TextureLoader();
    const panoTexture =
      textureCache.current[currentScene.image] ||
      loader.load(currentScene.image);
    panoTexture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.SphereGeometry(500, 40, 30);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ map: panoTexture });
    const panoMesh = new THREE.Mesh(geometry, material);
    scene.add(panoMesh);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = -0.3;
    camera.position.set(0.6, 0.3, 0.1);

    // Raycasting setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickable = [];
    let hoveredObject = null;

    // Helper to position SVG markers
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
          const mat = new THREE.MeshBasicMaterial({
            map: svgTexture,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), mat);
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

    // Click to switch panorama instantly
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

      setHistory((prev) => [...prev, currentScene]);
      setCurrentScene(next); // Instant switch
    };
    renderer.domElement.addEventListener("click", onClick);

    // Animation loop
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Handle resize
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

  // Back button
  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setCurrentScene(prev);
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
