import React from 'react';
import PanoramaViewer from './components/PanoramaViewer';


const panoramas = [
  {
    id: 'scene1',
    image: './src/assets/7-7.0001.png', // PLACE your real panorama here (or import)
    mask: './src/assets/7-7.0001_Masks.png',
    map: {
      // map "r,g,b" -> building metadata
      // Example values; replace with colors from your mask.
      '235,0,212': { name: 'House 1', nextPanorama: 'scene2' },
      '175,188,132': { name: 'House 2', nextPanorama: 'scene3' },
      // ... add all unique colors used in mask
    },
  },
  {
    id: 'scene2',
    image: './src/assets/7-2.0001.png',
    mask: '',
    map: {
      '10,20,30': { name: 'Other', nextPanorama: 'scene1' },
    },
  },
  {
    id: 'scene3',
    image: './src/assets/7-1.0001.png',
    mask: '',
    map: {
      '10,20,30': { name: 'Other', nextPanorama: 'scene1' },
    },
  },
];

export default function App() {
  return (
    <div className="h-screen bg-gray-900">
      <PanoramaViewer panoramas={panoramas} />
    </div>
  );
}