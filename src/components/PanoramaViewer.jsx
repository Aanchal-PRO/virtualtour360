import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function PanoramaViewer({ panoramas }) {
  const mountRef = useRef();
  const [current, setCurrent] = useState(panoramas[0]);
  const [hoverColor, setHoverColor] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);

useEffect(() => {
  let scene, camera, renderer, sphere, raycaster;
  let isUserInteracting = false,
    lon = 0,
    lat = 0,
    phi = 0,
    theta = 0;
  let onPointerDownPointerX = 0,
    onPointerDownPointerY = 0,
    onPointerDownLon = 0,
    onPointerDownLat = 0;

  const mount = mountRef.current;

  // Setup renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  mount.appendChild(renderer.domElement);

  // Scene + camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    mount.clientWidth / mount.clientHeight,
    1,
    1100
  );
  camera.target = new THREE.Vector3(0, 0, 0);

  // Load panorama texture
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(current.image);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  // Create sphere (inverted)
  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // Raycaster + mask setup
  raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d");
  const maskImg = new Image();
  maskImg.crossOrigin = "anonymous";
  maskImg.src = current.mask;
  maskImg.onload = () => {
    maskCanvas.width = maskImg.width;
    maskCanvas.height = maskImg.height;
    maskCtx.drawImage(maskImg, 0, 0);

    // --- Overlay using mask image
    const overlayCanvas = document.createElement("canvas");
    const overlayCtx = overlayCanvas.getContext("2d");
    overlayCanvas.width = maskImg.width;
    overlayCanvas.height = maskImg.height;
    overlayCtx.drawImage(maskImg, 0, 0);

    // Apply semi-transparent tint (light blue example)
    const imageData = overlayCtx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Keep original mask color but add light blue tint
      imageData.data[i] = imageData.data[i] * 0.5 + 135;     // R
      imageData.data[i + 1] = imageData.data[i + 1] * 0.5 + 206; // G
      imageData.data[i + 2] = imageData.data[i + 2] * 0.5 + 250; // B
      imageData.data[i + 3] = 128; // 50% opacity
    }
    overlayCtx.putImageData(imageData, 0, 0);

    const overlayTexture = new THREE.CanvasTexture(overlayCanvas);
    overlayTexture.mapping = THREE.EquirectangularReflectionMapping;
    overlayTexture.colorSpace = THREE.SRGBColorSpace;

    const overlayGeometry = new THREE.SphereGeometry(499.5, 60, 40);
    overlayGeometry.scale(-1, 1, 1);
    const overlayMaterial = new THREE.MeshBasicMaterial({
      map: overlayTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
    scene.add(overlayMesh);
  };

  // --- Event Handlers
  const onPointerDown = (event) => {
    isUserInteracting = true;
    onPointerDownPointerX = event.clientX;
    onPointerDownPointerY = event.clientY;
    onPointerDownLon = lon;
    onPointerDownLat = lat;
  };

  const onPointerMove = (event) => {
    if (isUserInteracting) {
      lon =
        (onPointerDownPointerX - event.clientX) * 0.1 + onPointerDownLon;
      lat = (event.clientY - onPointerDownPointerY) * 0.1 + onPointerDownLat;
    } else {
      // Hover detection
      mouse.x = (event.clientX / mount.clientWidth) * 2 - 1;
      mouse.y = -(event.clientY / mount.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(sphere);
      if (intersects.length > 0 && maskCtx) {
        const uv = intersects[0].uv;
        if (uv) {
          const x = Math.floor(uv.x * maskCanvas.width);
          const y = Math.floor((1 - uv.y) * maskCanvas.height);
          const pixel = maskCtx.getImageData(x, y, 1, 1).data;
          const colorKey = `${pixel[0]},${pixel[1]},${pixel[2]}`;
          if (current.map[colorKey]) {
            setHoverColor(colorKey);
          } else {
            setHoverColor(null);
          }
        }
      } else {
        setHoverColor(null);
      }
    }
  };

  const onPointerUp = () => (isUserInteracting = false);

  const COLOR_TOLERANCE = 5;

function isColorClose(r1, g1, b1, r2, g2, b2, tolerance) {
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance
  );
}

function isBlack(r, g, b) {
  return r <= COLOR_TOLERANCE && g <= COLOR_TOLERANCE && b <= COLOR_TOLERANCE;
}

function isWhite(r, g, b) {
  return (
    255 - r <= COLOR_TOLERANCE &&
    255 - g <= COLOR_TOLERANCE &&
    255 - b <= COLOR_TOLERANCE
  );
}

const onClick = (event) => {
  mouse.x = (event.clientX / mount.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / mount.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(sphere);

  if (intersects.length > 0 && maskCtx) {
    const uv = intersects[0].uv;
    if (uv) {
      const x = Math.floor(uv.x * maskCanvas.width);
      const y = Math.floor((1 - uv.y) * maskCanvas.height);
      const pixel = maskCtx.getImageData(x, y, 1, 1).data;
      const r = pixel[0], g = pixel[1], b = pixel[2];
console.log("Clicked on:", r,g,b);
      if (isBlack(r, g, b) || isWhite(r, g, b)) {
        // Skip black or white pixels
        return;
      }

      // Example: Check if pixel color is close to a target color in current.map keys
      for (const colorKey in current.map) {
        const [cr, cg, cb] = colorKey.split(",").map(Number);
        if (isColorClose(r, g, b, cr, cg, cb, COLOR_TOLERANCE)) {
          setSelectedColor(colorKey);
          const target = current.map[colorKey];

          if (target.nextPanorama) {
            const next = panoramas.find((p) => p.id === target.nextPanorama);
            if (next) setCurrent(next);
            console.log("Switching to panorama:", next);
          }

          
          break;
        }
      }
    }
  }
};





  const onWindowResize = () => {
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  };

  mount.addEventListener("pointerdown", onPointerDown);
  mount.addEventListener("pointermove", onPointerMove);
  mount.addEventListener("pointerup", onPointerUp);
  mount.addEventListener("click", onClick);
  window.addEventListener("resize", onWindowResize);

  // --- Animation Loop
  const animate = () => {
    requestAnimationFrame(animate);
    lat = Math.max(-85, Math.min(85, lat));
    phi = THREE.MathUtils.degToRad(90 - lat);
    theta = THREE.MathUtils.degToRad(lon);

    camera.target.x = 500 * Math.sin(phi) * Math.cos(theta);
    camera.target.y = 500 * Math.cos(phi);
    camera.target.z = 500 * Math.sin(phi) * Math.sin(theta);
    camera.lookAt(camera.target);

    renderer.render(scene, camera);
  };

  animate();

  return () => {
    mount.removeEventListener("pointerdown", onPointerDown);
    mount.removeEventListener("pointermove", onPointerMove);
    mount.removeEventListener("pointerup", onPointerUp);
    mount.removeEventListener("click", onClick);
    window.removeEventListener("resize", onWindowResize);
    renderer.dispose();
    mount.removeChild(renderer.domElement);
  };
}, [current]);

  const [history, setHistory] = useState([]);

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, history.length - 1));
      setCurrent(prev);
    }
  };


  return (
     <div className="relative w-full h-screen bg-black">
      <div ref={mountRef} className="w-full h-full" />

      {/* Back Button */}
      {history.length > 0 && (
        <button
          onClick={goBack}
          className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow"
        >
          Back
        </button>
      )}

      {(hoverColor || selectedColor) && (
        <div className="absolute top-4 left-4 bg-white/80 px-3 py-1 rounded text-sm shadow">
          {hoverColor && !selectedColor && (
            <>
              Hovered:{" "}
              <span className="font-semibold text-blue-500">
                {current.map[hoverColor]?.name}
              </span>
            </>
          )}
          {selectedColor && (
            <>
              Selected:{" "}
              <span className="font-semibold text-blue-600 ">
                {current.map[selectedColor]?.name}
              </span>
             <span
  className="ml-4 text-sm text-blue-600 font-medium cursor-pointer hover:text-blue-800 transition-colors duration-200"
  onClick={() => {
    setSelectedColor(null);
    setCurrent(panoramas[0]);
  }}
>
  Back
</span>
                          </>
          )}
        </div>
      )}
    </div>
  );
}
