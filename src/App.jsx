import React from 'react';
import PanoramaViewer from './components/PanoramaViewer';

const panoramas = [
  {
    id: 'scene1',
    image: '/assets/7-7.0001.webp',
  buildings: [
  { id: "house1", svg: "b_847D73", nextPanorama: "scene2" },
  { id: "house2", svg: "b_778B5F", nextPanorama: "scene3" },
  { id: "house3", svg: "b_465B3B", nextPanorama: "scene2" },
  { id: "house4", svg: "b_936878", nextPanorama: "scene2" },
  { id: "house5", svg: "b_601728", nextPanorama: "scene2" },
  { id: "house6", svg: "b_353C67", nextPanorama: "scene2" },
  { id: "house7", svg: "b_266F8C", nextPanorama: "scene2" },
  { id: "house8", svg: "b_7C8951", nextPanorama: "scene2" },
  { id: "house9", svg: "b_16406E", nextPanorama: "scene3" },
  { id: "house10", svg: "b_67406D", nextPanorama: "scene3" },
  { id: "house11", svg: "b_739594", nextPanorama: "scene3" },
  { id: "house12", svg: "b_396365", nextPanorama: "scene3" },
  { id: "house13", svg: "b_836A7D", nextPanorama: "scene3" },
  { id: "house14", svg: "b_4A7C6F", nextPanorama: "scene3" },
  { id: "house15", svg: "b_898B5C", nextPanorama: "scene3" },
  { id: "house16", svg: "b_90764B", nextPanorama: "scene3" },
  { id: "house17", svg: "b_496F8C", nextPanorama: "scene3" },
  { id: "house18", svg: "b_8E938D", nextPanorama: "scene3" },
  { id: "house19", svg: "b_8E9592", nextPanorama: "scene3" },
  { id: "house20", svg: "b_81907A", nextPanorama: "scene3" }
],

  },
  {
    id: 'scene2',
    image: '/assets/7-1.0001.webp',
    buildings: [],
  },
   {
    id: 'scene3',
    image: '/assets/7-4.0001.webp',
    buildings: [],
  },
    {
    id: 'scene4',
    image: '/assets/7-6.0000.webp',
    buildings: [],
  },
];

export default function App() {
  return (
    <div className="h-screen bg-gray-900">
      <PanoramaViewer panoramas={panoramas} />
    </div>
  );
}
