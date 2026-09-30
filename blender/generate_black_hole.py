"""Debris field + accretion-flow shards for close-ups (debris.glb).

The black hole itself stays a real-time ray tracer in the browser: a mesh
cannot bend light. This script produces physical 'stuff' near it: rocky
fragments, glowing plasma knots and a thin torus reference ring.
  blender -b --python blender/generate_black_hole.py
"""
import math
import os
import random
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import bhl_common as C  # noqa: E402

random.seed(42)


def rock(name, size, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=size)
    r = bpy.context.object
    r.name = name
    tex = bpy.data.textures.new(name + "_n", type="VORONOI")
    tex.noise_scale = 0.4
    d = r.modifiers.new("Rough", "DISPLACE")
    d.texture = tex
    d.strength = size * 0.35
    r.scale = (1, random.uniform(0.5, 0.9), random.uniform(0.6, 1.0))
    r.data.materials.append(mat)
    C.apply_modifiers(r)
    C.shade_smooth(r)
    return r


def build():
    C.reset_scene()
    stone = C.principled("Debris", base=(0.18, 0.16, 0.14, 1), rough=0.9)
    hot = C.principled("HotRim", base=(0.3, 0.1, 0.02, 1), rough=0.6, emission=(1.0, 0.45, 0.12, 1), strength=6)
    objs = []
    for i in range(24):
        r = rock(f"Shard_{i:02d}", random.uniform(0.05, 0.22), stone if i % 3 else hot)
        ang = random.uniform(0, math.tau)
        rad = random.uniform(3.2, 9.0)
        r.location = (math.cos(ang) * rad, random.gauss(0, 0.08) * rad, math.sin(ang) * rad)
        r.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)
        objs.append(r)
    # ISCO reference ring (3 rs for a = 0), thin and emissive
    bpy.ops.mesh.primitive_torus_add(major_radius=3.0, minor_radius=0.008, major_segments=256, minor_segments=6)
    ring = bpy.context.object
    ring.name = "ISCO_Ring"
    ring.data.materials.append(C.principled("RingGlow", base=(1, 0.8, 0.5, 1), emission=(1, 0.8, 0.5, 1), strength=4))
    objs.append(ring)
    C.add_camera_and_light(dist=14)
    return objs


if __name__ == "__main__":
    C.export_glb("debris.glb", objects=build())
