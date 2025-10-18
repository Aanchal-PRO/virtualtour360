import React from 'react';
import PanoramaViewer from './components/PanoramaViewer';

const panoramas = [
  {
    id: 'scene1',
    image: '/assets/7-7.0001.webp',
    buildings: [
      
      {
        id: 'house1',
        svg: '/assets/svg/Vector-1.svg',
        nextPanorama: 'scene2',
        latitude: -54.4, 
        longitude: 162, 
        size: 65, 
        rotation: 94.9, 
        radius: 354
        
      },
       {
        id: 'house2',
        svg: '/assets/svg/vector-2.svg',
        nextPanorama: 'scene4',
        latitude: -131.1,
        longitude: -29.79,
        radius:399,
        size:90,
        rotation:118.6
        
      },
      {
        id: 'house3',
        svg: '/assets/svg/location.svg',
        nextPanorama: 'scene3',
        latitude: -166.34, 
        longitude: -0.0999999999999943, 
        size: 30,
         rotation: 89, 
         radius: 470
        
      }
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
