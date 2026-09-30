"""High-detail Earth: displaced continents, ocean, ice caps, cloud shell.

Exports earth.glb (unit radius). The web app wraps it with GLBEarth, which
adds tidal stretching. Usage:
  blender -b --python blender/generate_earth.py [-- --no-bake]
"""
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import bhl_common as C  # noqa: E402


def build():
    C.reset_scene()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1.0)
    earth = bpy.context.object
    earth.name = "Earth"
    C.shade_smooth(earth)

    # Continents as gentle displacement from procedural clouds noise.
    tex = bpy.data.textures.new("ContinentNoise", type="CLOUDS")
    tex.noise_scale = 0.55
    tex.noise_depth = 5
    disp = earth.modifiers.new("Relief", "DISPLACE")
    disp.texture = tex
    disp.strength = 0.018
    disp.mid_level = 0.55

    mat = C.noise_material(
        "EarthSurface",
        color_a=(0.01, 0.04, 0.12, 1),  # ocean
        color_b=(0.12, 0.2, 0.06, 1),   # land
        scale=2.2, detail=8, rough=0.55, threshold=0.52,
    )
    earth.data.materials.append(mat)
    C.apply_modifiers(earth)
    C.bake_to_texture(earth, mat, size=2048, name="EarthAlbedo")

    # Cloud shell
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1.018)
    clouds = bpy.context.object
    clouds.name = "EarthClouds"
    C.shade_smooth(clouds)
    cm = C.principled("Clouds", base=(0.95, 0.95, 0.95, 1), rough=0.9)
    cm.blend_method = "BLEND" if hasattr(cm, "blend_method") else cm.blend_method
    bsdf = cm.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Alpha"].default_value = 0.55
    clouds.data.materials.append(cm)
    clouds.parent = earth

    C.make_lods(earth, ratios=(0.45, 0.18))
    C.add_camera_and_light(dist=4)
    return [earth, clouds]


if __name__ == "__main__":
    objs = build()
    C.export_glb("earth.glb", objects=objs)
