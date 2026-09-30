"""Shared helpers for the Black Hole Laboratory Blender pipeline.

Run with Blender 3.6+ / 4.x (bundled Python). Never imported by the web app.
Everything is procedural: no downloads, no external textures.
"""
import math
import os
import sys

import bpy
import bmesh

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "out")
WEB_MODELS = os.path.normpath(os.path.join(ROOT, "..", "public", "assets", "models"))


def reset_scene():
    """Start from an empty scene so every script is self-contained."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def ensure_dirs():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WEB_MODELS, exist_ok=True)


def principled(name, base=(0.8, 0.8, 0.8, 1), rough=0.5, metal=0.0, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emission is not None:
        # Blender 4 renamed "Emission" to "Emission Color"
        key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[key].default_value = emission
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def noise_material(name, color_a, color_b, scale=4.0, detail=6.0, rough=0.6, threshold=0.5):
    """Two-tone procedural material driven by a noise texture + color ramp."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = threshold - 0.02
    ramp.color_ramp.elements[0].color = color_a
    ramp.color_ramp.elements[1].position = threshold + 0.02
    ramp.color_ramp.elements[1].color = color_b
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def bake_to_texture(obj, mat, size=1024, name="baked"):
    """Bake a procedural material to an image so glTF can carry it.

    glTF cannot store Blender node networks; baking keeps the look.
    Uses Cycles; safe to skip with --no-bake for speed.
    """
    if "--no-bake" in sys.argv:
        return None
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    img = bpy.data.images.new(name, size, size)
    nt = mat.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.nodes.active = tex
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if not obj.data.uv_layers:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.uv.smart_project()
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    # Rewire: baked image drives Base Color
    bsdf = nt.nodes.get("Principled BSDF")
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    img.pack()
    return img


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def decimate(obj, ratio):
    mod = obj.modifiers.new("LOD", "DECIMATE")
    mod.ratio = ratio
    return mod


def apply_modifiers(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def make_lods(obj, ratios=(0.5, 0.2)):
    """Duplicate `obj` into decimated LOD copies named NAME_LOD1, NAME_LOD2..."""
    lods = []
    for i, r in enumerate(ratios, start=1):
        dup = obj.copy()
        dup.data = obj.data.copy()
        dup.name = f"{obj.name}_LOD{i}"
        bpy.context.collection.objects.link(dup)
        decimate(dup, r)
        apply_modifiers(dup)
        lods.append(dup)
    return lods


def add_camera_and_light(target=(0, 0, 0), dist=6.0, sun=True):
    """Preview rig so the .blend is presentable. Cameras/lights are not exported."""
    bpy.ops.object.camera_add(location=(dist * 0.7, -dist, dist * 0.35))
    cam = bpy.context.object
    direction = cam.location - __import__("mathutils").Vector(target)
    cam.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    if sun:
        bpy.ops.object.light_add(type="SUN", location=(5, -5, 5))
        bpy.context.object.data.energy = 3.0
    return cam


def export_glb(filename, objects=None, draco=False):
    """Export selected objects (or everything) as an optimized GLB.

    Writes to blender/out/ and copies into public/assets/models/.
    """
    ensure_dirs()
    bpy.ops.object.select_all(action="DESELECT")
    objs = objects or [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in objs:
        o.select_set(True)
    path = os.path.join(OUT_DIR, filename)
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    if draco:
        # Only enable if your web build adds a DRACOLoader (the default app does not).
        kwargs.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
    bpy.ops.export_scene.gltf(**kwargs)
    web_path = os.path.join(WEB_MODELS, filename)
    try:
        import shutil
        shutil.copyfile(path, web_path)
    except OSError as e:
        print(f"[BHL] could not copy to web folder: {e}")
    print(f"[BHL] exported {path}")
    return path
