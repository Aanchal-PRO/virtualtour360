// src/components/BuildingMarker.jsx
import React from "react";

const BuildingMarker = ({ id, isActive }) => {
  return (
    <div
      className={`absolute rounded-full w-4 h-4 ${
        isActive ? "bg-orange-500" : "bg-white"
      } border border-gray-700 cursor-pointer transition`}
      title={`Building ${id}`}
    />
  );
};

export default BuildingMarker;
