import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Center } from '@react-three/drei';
import * as THREE from 'three';

const GoatModel = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Медленно вращаем голову по кругу
      groupRef.current.rotation.y += delta * 0.6;
    }
  });

  const goldMat = <meshStandardMaterial color="#f0c674" metalness={0.9} roughness={0.1} emissive="#b8860b" emissiveIntensity={0.2} />;
  const darkMat = <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.5} />;
  const eyeMat = <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} toneMapped={false} />;

  return (
    <group ref={groupRef} scale={1.2}>
      {/* Морда (скелет) */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[1, 1.2, 1]} />
        {darkMat}
      </mesh>
      
      {/* Нос/Пасть (золотая) */}
      <mesh position={[0, -0.7, 0.3]}>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        {goldMat}
      </mesh>

      {/* Левый рог */}
      <mesh position={[-0.4, 0.8, -0.2]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.15, 0.02, 1.2, 8]} />
        {goldMat}
      </mesh>
      
      {/* Правый рог */}
      <mesh position={[0.4, 0.8, -0.2]} rotation={[0, 0, -Math.PI / 4]}>
        <cylinderGeometry args={[0.15, 0.02, 1.2, 8]} />
        {goldMat}
      </mesh>

      {/* Левый глаз (светится) */}
      <mesh position={[-0.3, 0.1, 0.52]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        {eyeMat}
      </mesh>

      {/* Правый глаз (светится) */}
      <mesh position={[0.3, 0.1, 0.52]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        {eyeMat}
      </mesh>

      {/* Борода */}
      <mesh position={[0, -1.2, 0.2]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 4]} />
        {goldMat}
      </mesh>
    </group>
  );
};

export const Goat3D = () => {
  return (
    <div style={{ width: '120px', height: '120px', margin: '0 auto', cursor: 'grab' }}>
      <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <pointLight position={[0, 0, 2]} intensity={2} color="#ffd700" />
        
        <Float speed={2.5} rotationIntensity={0.2} floatIntensity={1.5}>
          <Center>
            <GoatModel />
          </Center>
        </Float>
      </Canvas>
    </div>
  );
};