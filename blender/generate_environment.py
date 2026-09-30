"""Distant orbital laboratory station (station.glb): the 'lab' you observe from.

The app places it far from the hole (see Engine.updateVisuals) when enabled.
  blender -b --python blender/generate_environment.py
"""
import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import bhl_common as C  # noqa: E402


def build():
    C.reset_scene()
    metal = C.principled("StationHull", base=(0.42, 0.41, 0.4, 1), rough=0.4, metal=0.9)
    dark = C.principled("StationDark", base=(0.05, 0.05, 0.06, 1), rough=0.5, metal=0.5)
    lights = C.principled("Windows", base=(1, 0.8, 0.55, 1), emission=(1, 0.78, 0.5, 1), strength=8)
    objs = []
    bpy.ops.mesh.primitive_torus_add(major_radius=4.0, minor_radius=0.35, major_segments=96, minor_segments=16)
    ring = bpy.context.object
    ring.name = "Station"
    ring.data.materials.append(metal)
    objs.append(ring)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.6, depth=3.0, rotation=(math.pi / 2, 0, 0))
    hub = bpy.context.object
    hub.name = "Hub"
    hub.data.materials.append(dark)
    hub.parent = ring
    objs.append(hub)
    for i in range(6):
        a = i / 6 * math.tau
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 2.1, 0, math.sin(a) * 2.1), scale=(1.9, 0.08, 0.08))
        s = bpy.context.object
        s.rotation_euler = (0, -a, 0)
        s.data.materials.append(metal)
        s.parent = ring
        objs.append(s)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 4.0, 0.36, math.sin(a) * 4.0), scale=(0.3, 0.02, 0.12))
        w = bpy.context.object
        w.rotation_euler = (0, -a, 0)
        w.data.materials.append(lights)
        w.parent = ring
        objs.append(w)
    for o in objs:
        C.shade_smooth(o)
    C.make_lods(ring, ratios=(0.4,))
    C.add_camera_and_light(dist=14)
    return objs


if __name__ == "__main__":
    C.export_glb("station.glb", objects=build())
