import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";

export default function HighlightOverlay({ panoramas }) {
  const containerRef = useRef(null);
  const [currentScene, setCurrentScene] = useState(panoramas[0]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Core setup
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

    // Panorama background
    const loader = new THREE.TextureLoader();
    const panoTexture = loader.load(currentScene.image);
    panoTexture.colorSpace = THREE.SRGBColorSpace;
    const panoGeometry = new THREE.SphereGeometry(500, 60, 40);
    panoGeometry.scale(-1, 1, 1);
    const panoMaterial = new THREE.MeshBasicMaterial({ map: panoTexture });
    const panoMesh = new THREE.Mesh(panoGeometry, panoMaterial);
    scene.add(panoMesh);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = -0.3;
    camera.position.set(0.6, 0.3, 0.1);

    // Interaction setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickable = [];
    let hoveredObject = null;

    // GUI setup
    const gui = new GUI({ width: 320 });
    const baseRadius = 470;

    // === Helper Function to Position Plane ===
    const updatePlanePosition = (plane, params) => {
      const radius = params.radius;
      const phi = THREE.MathUtils.degToRad(90 - params.latitude);
      const theta = THREE.MathUtils.degToRad(params.longitude);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      plane.position.set(x, y, z);

      // Make plane face the camera
      plane.lookAt(0, 0, 0);

      // Apply rotation
      plane.rotation.z = THREE.MathUtils.degToRad(params.rotation);

      // Update plane size with aspect ratio
      const aspect =
        plane.material.map.image?.width / plane.material.map.image?.height || 1;
      const distanceScale = radius / baseRadius;
      const width = params.size * aspect * distanceScale;
      const height = params.size * distanceScale;
      plane.geometry.dispose();
      plane.geometry = new THREE.PlaneGeometry(width, height);
    };

    // === Load and setup each building ===
    currentScene.buildings.forEach((b, index) => {
      loader.load(
        b.svg,
        (svgTexture) => {
          svgTexture.colorSpace = THREE.SRGBColorSpace;

          // Create plane
          const planeMaterial = new THREE.MeshBasicMaterial({
            map: svgTexture,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
          });

          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            planeMaterial
          );

          // GUI parameters per building
          const params = {
            id: b.id,
            latitude: b.latitude,
            longitude: b.longitude,
            size: 60,
            rotation: 0,
            radius: 470,
            nextPanorama: b.nextPanorama,
            save: () => {
              console.log(`${b.id} values:`, {
                latitude: params.latitude,
                longitude: params.longitude,
                size: params.size,
                rotation: params.rotation,
                radius: params.radius,
              });
            },
          };

          updatePlanePosition(plane, params);
          plane.userData = { params };
          scene.add(plane);
          clickable.push(plane);

          // === Add a GUI folder for this building ===
          const folder = gui.addFolder(`🏠 ${b.id}`);
          folder
            .add(params, "latitude", -180, 180, 0.01)
            .name("Latitude")
            .onChange(() => updatePlanePosition(plane, params));
          folder
            .add(params, "longitude", -180, 180, 0.01)
            .name("Longitude")
            .onChange(() => updatePlanePosition(plane, params));
          folder
            .add(params, "radius", 100, 600, 1)
            .name("Radius")
            .onChange(() => updatePlanePosition(plane, params));
          folder
            .add(params, "size", 10, 200, 1)
            .name("Size")
            .onChange(() => updatePlanePosition(plane, params));
          folder
            .add(params, "rotation", -180, 180, 0.1)
            .name("Rotation")
            .onChange(() => updatePlanePosition(plane, params));
          folder.add(params, "save").name("💾 Save");
        },
        undefined,
        (err) => console.error("Error loading SVG:", err)
      );
    });

    // Hover effect
    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickable);
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (hoveredObject !== obj) {
          if (hoveredObject) hoveredObject.material.opacity = 1.0;
          hoveredObject = obj;
          hoveredObject.material.opacity = 0.3;
        }
      } else {
        if (hoveredObject) hoveredObject.material.opacity = 1.0;
        hoveredObject = null;
      }
    };
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    // Click navigation
    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickable);
      if (intersects.length > 0) {
        const next = intersects[0].object.userData.params.nextPanorama;
        const nextScene = panoramas.find((p) => p.id === next);
        if (nextScene) setCurrentScene(nextScene);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    // Animate
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Resize handling
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      gui.destroy();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [currentScene]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "black" }} />
  );
}
