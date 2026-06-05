// @ts-nocheck
/* eslint-disable react/no-unknown-property */
// 3D draggable lanyard — based on ReactBits (https://reactbits.dev, MIT),
// adapted to (1) load assets from /public, and (2) render an XtraPoint
// "ambassador badge" (built from the favicon) on the card face.
import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, Lightformer } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";

const CARD_URL = "/assets/lanyard/card.glb";
const BAND_URL = "/assets/lanyard/lanyard.png";

extend({ MeshLineGeometry, MeshLineMaterial });

interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
}

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative z-0 flex h-full w-full items-center justify-center">
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)
        }
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

/** Build the card-face texture: an XtraPoint ambassador badge using the favicon. */
function useBadgeTexture() {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    // The GLB texture is a 1678x1677 atlas. From the card mesh UVs:
    //   FRONT face (toward camera) → UV 0–0.5 × 0–0.755  → px (0,0)-(839,1267)
    //   BACK face                  → UV 0.5–1 × 0–0.755  → px (839,0)-(1678,1267)
    // We composite onto a copy of the atlas (preserving edge shading) and paint
    // the full ambassador badge into both faces.
    const W = 1678;
    const H = 1677;
    const FRONT = { x: 0, y: 0, w: 839, h: 1267 };
    const BACK = { x: 839, y: 0, w: 839, h: 1267 };

    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const drawFace = (R: { x: number; y: number; w: number; h: number }, fav: HTMLImageElement | null) => {
      // navy body — fills the full face
      const g = ctx.createLinearGradient(R.x, R.y, R.x, R.y + R.h);
      g.addColorStop(0, "#03116d");
      g.addColorStop(1, "#000946");
      ctx.fillStyle = g;
      ctx.fillRect(R.x, R.y, R.w, R.h);

      ctx.textAlign = "center";

      // lime header bar
      ctx.fillStyle = "#aaf10a";
      ctx.fillRect(R.x, R.y, R.w, 196);
      ctx.fillStyle = "#03116d";
      ctx.textBaseline = "middle";
      ctx.font = "800 96px Inter, system-ui, sans-serif";
      ctx.fillText("AMBASSADOR", R.x + R.w / 2, R.y + 102);

      // favicon (XP cube)
      const fs = R.w * 0.5;
      if (fav) ctx.drawImage(fav, R.x + (R.w - fs) / 2, R.y + R.h * 0.27, fs, fs);

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 104px Inter, system-ui, sans-serif";
      ctx.fillText("Jordan Rivera", R.x + R.w / 2, R.y + R.h * 0.78);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "600 56px Inter, system-ui, sans-serif";
      ctx.fillText("Student Ambassador", R.x + R.w / 2, R.y + R.h * 0.835);
      ctx.fillStyle = "#aaf10a";
      ctx.font = "700 40px monospace";
      ctx.fillText("CLASS OF '26 · GREEK LIFE", R.x + R.w / 2, R.y + R.h * 0.9);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "700 34px monospace";
      ctx.fillText("AMBASSADOR PROGRAM", R.x + R.w / 2, R.y + R.h * 0.955);
    };

    const finish = () => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false; // glTF UV convention
      t.anisotropy = 16;
      t.needsUpdate = true;
      setTex(t);
    };

    const atlas = new Image();
    atlas.onload = () => {
      ctx.drawImage(atlas, 0, 0, W, H); // keep white card body + edges
      const fav = new Image();
      fav.onload = () => {
        drawFace(FRONT, fav);
        drawFace(BACK, fav);
        finish();
      };
      fav.onerror = () => {
        drawFace(FRONT, null);
        drawFace(BACK, null);
        finish();
      };
      fav.src = "/favicon.svg";
    };
    atlas.onerror = () => {
      drawFace(FRONT, null);
      finish();
    };
    atlas.src = "/assets/lanyard/card-tex.png";
  }, []);
  return tex;
}

function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false }) {
  const band = useRef(null);
  const fixed = useRef(null);
  const j1 = useRef(null);
  const j2 = useRef(null);
  const j3 = useRef(null);
  const card = useRef(null);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const segmentProps = {
    type: "dynamic",
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4,
  };

  const { nodes, materials } = useGLTF(CARD_URL) as any;
  const texture = useTexture(BAND_URL);
  const badge = useBadgeTexture();

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => {
        document.body.style.cursor = "auto";
      };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && typeof dragged !== "boolean") {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }
    if (fixed.current) {
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped)
          ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(
          0.1,
          Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())),
        );
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)),
        );
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  curve.curveType = "chordal";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              e.target.releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e) => {
              e.target.setPointerCapture(e.pointerId);
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={badge ?? materials.base.map}
                map-anisotropy={16}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
              />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band} frustumCulled={false}>
        <meshLineGeometry />
        <meshLineMaterial
          color="#aaf10a"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={texture}
          repeat={[-4, 1]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}

useGLTF.preload(CARD_URL);
