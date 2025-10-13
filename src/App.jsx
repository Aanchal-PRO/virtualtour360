import React from 'react';
import PanoramaViewer from './components/PanoramaViewer';


const panoramas = [
  {
    id: 'scene1',
    image: '/assets/7-7.0001.webp',       
    mask: '/assets/7-7.0001_Masks.webp',  
    map: {
      '235,0,212': { name: 'House 1', nextPanorama: 'scene2' },
      '175,188,132': { name: 'House 2', nextPanorama: 'scene3' },
    },
  },
  {
    id: 'scene2',
    image: '/assets/7-1.0001.webp',
    mask: '',
    map: {
      '10,20,30': { name: 'Other', nextPanorama: 'scene1' },
    },
  },
  {
    id: 'scene3',
    image: '/assets/7-5.0001.webp',
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