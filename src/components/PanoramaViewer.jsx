import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function PanoramaViewer({ panoramas }) {
  const containerRef = useRef(null);
  const textureCache = useRef({});
  const [currentScene, setCurrentScene] = useState(panoramas[0]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Utility: load texture efficiently
  const loadPanoramaTexture = (url, onLoad) => {
    const loader = new THREE.TextureLoader();
    if (textureCache.current[url]) {
      onLoad(textureCache.current[url]);
      return;
    }
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.current[url] = texture;
      onLoad(texture);
    });
  };

  // Switch panorama with blurred preview and loading spinner
  const switchPanorama = (nextScene) => {
    if (!nextScene) return;
    setIsLoading(true);
    const material = materialRef.current;
    const loader = loaderRef.current;

    // Apply blurred temporary preview
    const blurShader = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
          vec4 texelColor = texture2D(map, vUv);
          vec4 blurredColor = vec4(0.0);
          for (float i = -2.5; i <= 2.5; i++) {
            for (float j = -2.5; j <= 2.5; j++) {
              blurredColor += texture2D(map, vUv + vec2(i, j) / 1024.0) * 0.04;
            }
          }
          diffuseColor *= blurredColor;
        `
      );
    };

    material.onBeforeCompile = blurShader;
    material.needsUpdate = true;

    // Show low-res immediately
    loadPanoramaTexture(nextScene.thumbnail || nextScene.image, (lowRes) => {
      material.map = lowRes;
      material.needsUpdate = true;
    });

    // Load high-res asynchronously
    loader.load(
      nextScene.image,
      (fullTex) => {
        fullTex.colorSpace = THREE.SRGBColorSpace;
        fullTex.minFilter = THREE.LinearMipmapLinearFilter;
        fullTex.generateMipmaps = true;
        fullTex.needsUpdate = true;

        // Apply sharp texture
        material.map = fullTex;
        material.onBeforeCompile = null;
        material.needsUpdate = true;

        setCurrentScene(nextScene);
        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.error("Error loading next panorama:", err);
        setIsLoading(false);
      }
    );
  };

  // Main setup
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

    loaderRef.current = new THREE.TextureLoader();
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // current texture
    const panoTexture =
      textureCache.current[currentScene.image] ||
      loaderRef.current.load(currentScene.image);
    panoTexture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: panoTexture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    materialRef.current = material;

    const panoMesh = new THREE.Mesh(geometry, material);
    scene.add(panoMesh);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.zoomSpeed = 1.2;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = -0.3;
    controls.enablePan = false;
    camera.position.set(0.6, 0.3, 0.1);

    // custom FOV zoom
    container.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) e.preventDefault();
        const zoomSpeed = 0.3;
        camera.fov += e.deltaY * zoomSpeed * 0.05;
        camera.fov = Math.min(Math.max(camera.fov, 30), 100);
        camera.updateProjectionMatrix();
      },
      { passive: false }
    );

    // clickable setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickable = [];
    clickableRef.current = clickable;
    let hoveredObject = null;

    const updatePlanePosition = (plane, b) => {
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
        plane.material.map.image?.width / plane.material.map.image?.height || 1;
      plane.geometry.dispose();
      plane.geometry = new THREE.PlaneGeometry(b.size * aspect, b.size);
    };

    // add markers
    currentScene.buildings.forEach((b) => {
      loaderRef.current.load(
        b.svg,
        (svgTexture) => {
          svgTexture.colorSpace = THREE.SRGBColorSpace;
          const mat = new THREE.MeshBasicMaterial({
            map: svgTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
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

    // hover
    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickable);
      if (intersects.length > 0) {
        renderer.domElement.style.cursor = "pointer";
        const obj = intersects[0].object;
        if (hoveredObject !== obj) {
          if (hoveredObject) hoveredObject.material.opacity = 1.0;
          hoveredObject = obj;
          hoveredObject.material.opacity = 0.6;
        }
      } else {
        renderer.domElement.style.cursor = "grab";
        if (hoveredObject) hoveredObject.material.opacity = 1;
        hoveredObject = null;
      }
    };
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    // click switch
    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickable);
      if (intersects.length === 0) return;
      const next = panoramas.find(
        (p) => p.id === intersects[0].object.userData.nextPanorama
      );
      if (next) {
        setHistory((prev) => [...prev, currentScene]);
        switchPanorama(next);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    // animation
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // resize
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

  // go back function
  const goBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    if (!prev || !prev.image) return;
    setHistory((h) => h.slice(0, -1));
    switchPanorama(prev);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ background: "black" }} />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="loader border-4 border-gray-400 border-t-white w-10 h-10 rounded-full animate-spin" />
        </div>
      )}

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
