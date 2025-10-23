import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useLoader } from "@react-three/fiber";

export default function PanoramaViewer({ panoramas }) {
  const containerRef = useRef(null);
  const [currentScene, setCurrentScene] = useState(panoramas[0]);
  const [history, setHistory] = useState([]);
  const textureCache = useRef({});
  const panoMeshRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const controlsRef = useRef();
  const clickableRef = useRef([]);
  const autorotateSpeed = 0.2;
  const isMouseOver = useRef(false);

  /** ✅ Preload all panoramas using useLoader (Fiber’s optimized caching) */
  const preloadedTextures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const textures = {};
    panoramas.forEach((p) => {
      const tex = loader.load(p.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      textures[p.image] = tex;
    });
    return textures;
  }, [panoramas]);

  /** ✅ Switch panorama */
  const switchPanorama = async (nextScene) => {
    if (!nextScene) return;

    const texture = preloadedTextures[nextScene.image];
    if (!texture) return;

    // Smooth fade-out
    let opacity = 1;
    await new Promise((resolve) => {
      const fade = () => {
        opacity -= 0.05;
        if (panoMeshRef.current) {
          panoMeshRef.current.material.opacity = Math.max(opacity, 0);
          panoMeshRef.current.material.needsUpdate = true;
        }
        clickableRef.current.forEach((m) => {
          if (m.material)
            m.material.opacity = Math.max(opacity, 0);
        });
        if (opacity <= 0) resolve();
        else requestAnimationFrame(fade);
      };
      fade();
    });

    // Swap texture
    panoMeshRef.current.material.map = texture;
    panoMeshRef.current.material.needsUpdate = true;

    clickableRef.current.forEach((m) => sceneRef.current.remove(m));
    clickableRef.current = [];
    buildHotspots(nextScene);

    // Fade back in
    opacity = 0;
    await new Promise((resolve) => {
      const fadeIn = () => {
        opacity += 0.05;
        if (panoMeshRef.current) {
          panoMeshRef.current.material.opacity = Math.min(opacity, 1);
          panoMeshRef.current.material.needsUpdate = true;
        }
        clickableRef.current.forEach((m) => {
          if (m.material)
            m.material.opacity = Math.min(opacity, 1);
        });
        if (opacity >= 1) resolve();
        else requestAnimationFrame(fadeIn);
      };
      fadeIn();
    });

    setCurrentScene(nextScene);
  };

  /** ✅ Build Hotspots */
  const buildHotspots = (sceneData) => {
    const scene = sceneRef.current;
    const loader = new THREE.TextureLoader();
    const clickable = clickableRef.current;

    clickable.forEach((obj) => scene.remove(obj));
    clickable.length = 0;

    sceneData.buildings.forEach((b) => {
      loader.load(
        b.svg,
        (svgTexture) => {
          svgTexture.colorSpace = THREE.SRGBColorSpace;
          svgTexture.needsUpdate = true;

          const mat = new THREE.MeshBasicMaterial({
            map: svgTexture,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

          const plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), mat);
          const phi = THREE.MathUtils.degToRad(90 - b.latitude);
          const theta = THREE.MathUtils.degToRad(b.longitude);
          plane.position.set(
            b.radius * Math.sin(phi) * Math.cos(theta),
            b.radius * Math.cos(phi),
            b.radius * Math.sin(phi) * Math.sin(theta)
          );
          plane.lookAt(0, 0, 0);
          plane.rotation.z = THREE.MathUtils.degToRad(b.rotation);

          const aspect =
            plane.material.map.image?.width / plane.material.map.image?.height ||
            1;
          plane.geometry.dispose();
          plane.geometry = new THREE.PlaneGeometry(b.size * aspect, b.size);
          plane.userData = { nextPanorama: b.nextPanorama };
          scene.add(plane);
          clickable.push(plane);
        },
        undefined,
        (err) => console.error("Error loading SVG:", err)
      );
    });
  };

  /** ✅ Initialize Three.js Scene */
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

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    // ✅ Use fully loaded texture from cache
    const initialTexture = preloadedTextures[currentScene.image];
    initialTexture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      map: initialTexture,
      transparent: true,
      opacity: 1, // ensure not faded
      depthWrite: false,
    });
    const panoMesh = new THREE.Mesh(geometry, material);
    scene.add(panoMesh);

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
    panoMeshRef.current = panoMesh;
    controlsRef.current = controls;

    buildHotspots(currentScene);

    /** ✅ Mouse hover pause */
    const handleMouseEnter = () => (isMouseOver.current = true);
    const handleMouseLeave = () => (isMouseOver.current = false);
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    /** ✅ Click handling */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableRef.current);
      if (!intersects.length) return;
      const next = panoramas.find(
        (p) => p.id === intersects[0].object.userData.nextPanorama
      );
      if (next) {
        setHistory((h) => [...h, currentScene]);
        switchPanorama(next);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    /** ✅ Resize */
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    /** ✅ Render loop */
    const animate = () => {
      if (!isMouseOver.current) controls.autoRotate = true;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", onClick);
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [preloadedTextures]);

  /** ✅ Go Back */
  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    switchPanorama(prev);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full bg-black" />
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
