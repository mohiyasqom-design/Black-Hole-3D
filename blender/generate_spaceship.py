"""Observation probe / spacecraft used by the 'Drop probe' experiment.

Exports spacecraft.glb. Nose points along +X (matches the procedural probe).
  blender -b --python blender/generate_spaceship.py
"""
import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import bhl_common as C  # noqa: E402


def build():
    C.reset_scene()
    hull = C.principled("Hull", base=(0.55, 0.53, 0.5, 1), rough=0.35, metal=0.85)
    panel = C.principled("SolarPanel", base=(0.03, 0.05, 0.12, 1), rough=0.2, metal=0.3)
    gold = C.principled("MLI_Foil", base=(0.9, 0.62, 0.2, 1), rough=0.25, metal=1.0)
    beacon = C.principled("Beacon", base=(1, 0.8, 0.5, 1), emission=(1, 0.75, 0.45, 1), strength=12)

    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.25, depth=0.9, rotation=(0, math.pi / 2, 0))
    body = bpy.context.object
    body.name = "Probe"
    body.data.materials.append(gold)
    bev = body.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.02
    bev.segments = 2
    parts.append(body)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, side * 0.95), scale=(0.55, 0.01, 0.6))
        wing = bpy.context.object
        wing.name = f"Panel_{'L' if side < 0 else 'R'}"
        wing.data.materials.append(panel)
        wing.parent = body
        parts.append(wing)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.02, depth=0.5, location=(0, 0, side * 0.42))
        strut = bpy.context.object
        strut.data.materials.append(hull)
        strut.parent = body
        parts.append(strut)

    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.35, radius2=0.05, depth=0.18, location=(0.55, 0, 0), rotation=(0, -math.pi / 2, 0))
    dish = bpy.context.object
    dish.name = "Antenna"
    dish.data.materials.append(hull)
    dish.parent = body
    parts.append(dish)

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.05, location=(-0.5, 0, 0))
    b = bpy.context.object
    b.name = "Beacon"
    b.data.materials.append(beacon)
    b.parent = body
    parts.append(b)

    for p in parts:
        if p.type == "MESH":
            C.shade_smooth(p)
    C.apply_modifiers(body)
    C.add_camera_and_light(dist=3)
    return parts


if __name__ == "__main__":
    C.export_glb("spacecraft.glb", objects=build())
