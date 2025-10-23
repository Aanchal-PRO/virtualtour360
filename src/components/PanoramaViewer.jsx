import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function PanoramaViewer({ panoramas }) {
  const containerRef = useRef(null);
  const textureCache = useRef({});
  const [currentScene, setCurrentScene] = useState(panoramas[0]);
  const [history, setHistory] = useState([]);
  const [isReady, setIsReady] = useState(false); // ✅ ensure preload done before first render

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const panoMeshRef = useRef(null);
  const controlsRef = useRef(null);
  const clickableRef = useRef([]);
  const loaderRef = useRef(new THREE.TextureLoader());

  const autorotateSpeed = 0.5;
  const isMouseOver = useRef(false);

  /** ✅ Preload all panorama textures */
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

  /** ✅ Cached texture loader */
  const loadTexture = (url) =>
    new Promise((resolve, reject) => {
      if (textureCache.current[url]) {
        resolve(textureCache.current[url]);
      } else {
        loaderRef.current.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;
            textureCache.current[url] = tex;
            resolve(tex);
          },
          undefined,
          reject
        );
      }
    });

  /** ✅ Switch panoramas (fade both pano + SVGs) */
  const switchPanorama = async (nextScene) => {
    if (!nextScene) return;

    const clickable = clickableRef.current;

    // Fade out both panorama + SVGs
    let opacity = 1;
    const fadeOut = () =>
      new Promise((resolve) => {
        const fade = () => {
          opacity -= 0.05;
          if (opacity <= 0) opacity = 0;

          if (panoMeshRef.current) {
            panoMeshRef.current.material.opacity = opacity;
            panoMeshRef.current.material.needsUpdate = true;
          }
          clickable.forEach((obj) => {
            if (obj.material) {
              obj.material.opacity = opacity;
              obj.material.needsUpdate = true;
            }
          });

          if (opacity <= 0) {
            resolve();
          } else {
            requestAnimationFrame(fade);
          }
        };
        fade();
      });

    await fadeOut();

    // Load new panorama + SVGs instantly
    try {
      const texture = await loadTexture(nextScene.image);
      if (panoMeshRef.current && texture) {
        panoMeshRef.current.material.map = texture;
        panoMeshRef.current.material.opacity = 1;
        panoMeshRef.current.material.needsUpdate = true;
      }

      // Clear old SVGs and rebuild
      clickable.forEach((obj) => sceneRef.current.remove(obj));
      clickable.length = 0;
      buildHotspots(nextScene);

      setCurrentScene(nextScene);
    } catch (err) {
      console.error("Error loading panorama:", err);
    }
  };

  /** ✅ Build SVG hotspots */
  const buildHotspots = (sceneData) => {
    const scene = sceneRef.current;
    const clickable = clickableRef.current;
    const loader = loaderRef.current;

    sceneData.buildings.forEach((b) => {
      loader.load(
        b.svg,
        (svgTexture) => {
          svgTexture.colorSpace = THREE.SRGBColorSpace;

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
            plane.material.map.image?.width /
              plane.material.map.image?.height || 1;
          plane.geometry.dispose();
          plane.geometry = new THREE.PlaneGeometry(b.size * aspect, b.size);

          plane.userData = { nextPanorama: b.nextPanorama };
          plane.renderOrder = 1;

          scene.add(plane);
          clickable.push(plane);
        },
        undefined,
        (err) => console.error("Error loading SVG:", err)
      );
    });
  };

  /** ✅ Initialize after preloading */
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

    // ✅ Use preloaded texture — ensures first load has full correct color
    const initialTexture = textureCache.current[currentScene.image];
    const material = new THREE.MeshBasicMaterial({
      map: initialTexture,
      transparent: true,
      opacity: 1,
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

    // ✅ Build SVGs after texture fully applied
    buildHotspots(currentScene);

    /** Hover pause (unchanged) */
    const handleMouseEnter = () => (isMouseOver.current = true);
    const handleMouseLeave = () => (isMouseOver.current = false);
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredObject = null;

    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableRef.current);

      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (hoveredObject !== obj) {
          if (hoveredObject) hoveredObject.material.opacity = 1.0;
          hoveredObject = obj;
          hoveredObject.material.opacity = 0.2;
        }
      } else {
        if (hoveredObject) hoveredObject.material.opacity = 1;
        hoveredObject = null;
      }
    };
    renderer.domElement.addEventListener("mousemove", onMouseMove);

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

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    const animate = () => {
      controls.autoRotate = true;
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
  }, [isReady]);

  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    switchPanorama(prev);
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
