// src/pages/InteractiveMap.jsx
import React, { useState } from "react";
import PanoramaScene from "../components/PanoramaViewer";
import HighlightOverlay from "../components/HighlightOverlay";

const InteractiveMap = () => {
  const [hoveredBuilding, setHoveredBuilding] = useState(null);

  const handleBuildingClick = (id) => {
    alert(`Building ${id} clicked!`);
  };

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <PanoramaScene
        imageUrl="./src/assets/7-7.0001.png"
        onBuildingHover={setHoveredBuilding}
        onBuildingClick={handleBuildingClick}
      />
      <HighlightOverlay hoveredBuilding={hoveredBuilding} />
    </div>
  );
};

export default InteractiveMap;
