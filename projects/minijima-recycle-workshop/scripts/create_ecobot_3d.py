import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "characters", "ecobot_3d")
os.makedirs(OUT_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, metallic=0.0, roughness=0.32, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.8
    return mat


MATS = {
    "red": material("RubyRed", (1.0, 0.09, 0.17), 0.18, 0.24),
    "orange": material("SunnyOrange", (1.0, 0.36, 0.05), 0.18, 0.24),
    "yellow": material("LemonGold", (1.0, 0.77, 0.05), 0.18, 0.24),
    "green": material("LeafGreen", (0.08, 0.75, 0.30), 0.18, 0.24),
    "blue": material("OceanBlue", (0.04, 0.42, 0.92), 0.18, 0.24),
    "purple": material("MagicPurple", (0.45, 0.18, 0.86), 0.18, 0.24),
    "white": material("PearlFace", (0.94, 0.96, 0.94), 0.05, 0.2),
    "dark": material("EyeDark", (0.025, 0.02, 0.055), 0.05, 0.12),
    "iris": material("IrisViolet", (0.25, 0.08, 0.42), 0.12, 0.1),
    "shine": material("EyeSparkle", (1.0, 1.0, 1.0), 0.0, 0.05, (1.0, 1.0, 1.0)),
    "pink": material("HappyPink", (1.0, 0.17, 0.39), 0.0, 0.25),
    "metal": material("SoftMetal", (0.22, 0.27, 0.32), 0.72, 0.2),
    "cyan": material("EcoCyan", (0.02, 0.76, 0.90), 0.25, 0.2),
}


def smooth(obj):
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def uv_sphere(name, location, scale, mat, segments=48, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return smooth(obj)


def rounded_cube(name, location, scale, mat, bevel=0.24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("SoftEdges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 5
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return smooth(obj)


def star_petal(name, angle, mat):
    # Front-view petal polygon, extruded along Y. Five petals meet beneath the face.
    inner_radius = 1.35
    shoulder_radius = 2.85
    tip_radius = 4.35
    width = math.radians(34)
    tip_width = math.radians(8)
    points = [
        (0.0, 0.0),
        (math.cos(angle - width) * shoulder_radius, math.sin(angle - width) * shoulder_radius),
        (math.cos(angle - tip_width) * tip_radius, math.sin(angle - tip_width) * tip_radius),
        (math.cos(angle + tip_width) * tip_radius, math.sin(angle + tip_width) * tip_radius),
        (math.cos(angle + width) * shoulder_radius, math.sin(angle + width) * shoulder_radius),
        (math.cos(angle) * inner_radius, math.sin(angle) * inner_radius),
    ]
    depth = 0.78
    verts = []
    for y in (-depth, depth):
        verts.extend([(x, y, z + 4.8) for x, z in points])
    n = len(points)
    faces = [tuple(range(n)), tuple(range(n, n * 2))[::-1]]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("RoundedArmor", "BEVEL")
    bevel.width = 0.52
    bevel.segments = 8
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)
    return smooth(obj)


def cylinder_between(name, start, end, radius, mat):
    midpoint = (Vector(start) + Vector(end)) / 2
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=direction.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Rounded", "BEVEL")
    bevel.width = radius * 0.28
    bevel.segments = 4
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return smooth(obj)


# Five thick, rounded rainbow armor petals.
petal_mats = [MATS["red"], MATS["orange"], MATS["green"], MATS["blue"], MATS["purple"]]
for i in range(5):
    star_petal(f"StarArmor_{i+1}", math.radians(90 - i * 72), petal_mats[i])

# Rounded central body and inset face.
uv_sphere("BodyCore", (0, 0.0, 4.55), (2.95, 1.12, 2.72), MATS["blue"])
uv_sphere("FacePlate", (0, -1.08, 5.20), (2.28, 0.34, 1.92), MATS["white"])

# Eyes with separate glassy iris and highlights.
for side, x in (("L", -0.90), ("R", 0.90)):
    uv_sphere(f"Eye_{side}", (x, -1.48, 5.55), (0.66, 0.23, 0.84), MATS["dark"])
    uv_sphere(f"Iris_{side}", (x, -1.69, 5.46), (0.41, 0.12, 0.54), MATS["iris"])
    uv_sphere(f"EyeShineBig_{side}", (x - 0.17, -1.82, 5.82), (0.18, 0.08, 0.23), MATS["shine"], 32, 20)
    uv_sphere(f"EyeShineSmall_{side}", (x + 0.19, -1.82, 5.28), (0.10, 0.06, 0.13), MATS["shine"], 24, 16)
    uv_sphere(f"Cheek_{side}", (x * 1.52, -1.46, 4.72), (0.29, 0.10, 0.16), MATS["pink"], 32, 18)

uv_sphere("Smile", (0, -1.48, 4.58), (0.53, 0.12, 0.36), MATS["pink"], 40, 24)
uv_sphere("SmileCut", (0, -1.59, 4.76), (0.45, 0.10, 0.30), MATS["white"], 40, 24)

# Arms, cuffs, mitten hands and fingers.
for side, sign in (("Left", -1), ("Right", 1)):
    arm_mat = MATS["cyan"] if sign < 0 else MATS["green"]
    cuff_mat = MATS["orange"] if sign < 0 else MATS["yellow"]
    cylinder_between(f"{side}UpperArm", (sign * 2.95, 0, 4.1), (sign * 3.85, -0.05, 3.45), 0.61, arm_mat)
    uv_sphere(f"{side}Cuff", (sign * 3.95, -0.06, 3.34), (0.78, 0.74, 0.66), cuff_mat)
    hand = uv_sphere(f"{side}Hand", (sign * 4.30, -0.08, 2.75), (0.88, 0.73, 0.88), MATS["cyan"])
    for finger in range(3):
        uv_sphere(f"{side}Finger_{finger+1}", (sign * (4.62 + finger * 0.12), -0.18, 2.42 + finger * 0.27), (0.28, 0.24, 0.43), MATS["cyan"], 32, 20)

# Boots and metallic soles.
for side, sign, boot_mat in (("Left", -1, MATS["orange"]), ("Right", 1, MATS["purple"])):
    uv_sphere(f"{side}Boot", (sign * 1.55, -0.02, 0.25), (1.28, 1.18, 1.12), boot_mat)
    rounded_cube(f"{side}Sole", (sign * 1.55, -0.08, -0.57), (1.34, 1.14, 0.28), MATS["metal"], 0.24)
    rounded_cube(f"{side}ToePanel", (sign * 1.55, -1.01, 0.29), (0.65, 0.14, 0.45), MATS["yellow"] if sign < 0 else MATS["red"], 0.12)

# Chest recycling badge (three simplified raised arrows).
uv_sphere("BadgeDisk", (0, -1.27, 2.95), (1.18, 0.16, 1.02), MATS["blue"])
for i in range(3):
    angle = math.radians(90 - i * 120)
    x = math.cos(angle) * 0.46
    z = 2.95 + math.sin(angle) * 0.42
    arrow = rounded_cube(f"RecycleArrow_{i+1}", (x, -1.48, z), (0.20, 0.10, 0.48), MATS["white"], 0.10, (0, angle, 0))
    arrow.rotation_euler[1] = -angle

# Armor seams and rivets provide the polished toy construction seen in the reference.
for i in range(10):
    angle = math.radians(i * 36)
    x = math.cos(angle) * 2.75
    z = 4.65 + math.sin(angle) * 2.55
    uv_sphere(f"Rivet_{i+1}", (x, -1.16, z), (0.10, 0.07, 0.10), MATS["metal"], 20, 12)

# Ground, lighting and camera for review render (ground is excluded from export).
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -1.2))
ground = bpy.context.object
ground.name = "RENDER_GROUND"
ground.data.materials.append(material("WarmGround", (0.92, 0.87, 0.72), 0.0, 0.7))

bpy.ops.object.light_add(type="AREA", location=(-6, -8, 12))
key = bpy.context.object
key.data.energy = 1300
key.data.shape = "DISK"
key.data.size = 7
bpy.ops.object.light_add(type="AREA", location=(7, -3, 7))
fill = bpy.context.object
fill.data.energy = 900
fill.data.size = 6
bpy.ops.object.light_add(type="AREA", location=(0, 5, 10))
rim = bpy.context.object
rim.data.energy = 1100
rim.data.size = 5

bpy.ops.object.camera_add(location=(0, -23, 5.0))
camera = bpy.context.object
direction = Vector((0, 0, 4.0)) - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
camera.data.lens = 58
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(OUT_DIR, "ecobot-front-preview-v2.png")
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("EcoBotPreviewWorld")
scene.world.color = (0.035, 0.055, 0.085)
scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "ecobot-rainbow-star-v2.blend"))
bpy.ops.render.render(write_still=True)

# Export character meshes only; lights, camera and review floor stay out.
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    if obj.type == "MESH" and obj.name != "RENDER_GROUND":
        obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT_DIR, "ecobot-rainbow-star-v2.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
)
print("ECOBOT_EXPORT_COMPLETE", OUT_DIR)
