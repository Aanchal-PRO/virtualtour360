// src/components/HighlightOverlay.jsx
import React from "react";

const HighlightOverlay = ({ hoveredBuilding }) => {
  return (
    hoveredBuilding && (
      <div className="absolute top-4 left-4 bg-white/80 rounded-lg px-4 py-2 shadow-lg">
        <p className="text-gray-800 font-semibold">
          Hovering: Building {hoveredBuilding}
        </p>
      </div>
    )
  );
};

export default HighlightOverlay;
