"""Builds the batsman and bowler as rigged 3D characters and exports them as GLB files for the game.

Run from the project folder (Blender 4.x / 5.x):
    blender --background --python tools/blender/make_characters.py -- public/models
or open it in Blender's Scripting tab, set OUT_DIR below and press Run.

Each character is one smooth body mesh (Skin + Subdivision modifiers) skinned to a humanoid armature with
Mixamo-style bone names, plus head, face, hair/helmet, pads, gloves and shoes parented to the bones.
The character faces -Y in Blender, which becomes +Z (towards the camera) in the game.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_DIR = os.path.abspath(argv[0] if argv else 'public/models')


# ---------------------------------------------------------------- helpers
def lin(hexcol):
    h = hexcol.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


MATS = {}
def mat(name, col, rough=0.6, metal=0.0, coat=0.0):
    key = (name, col)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = lin(col)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat and 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = coat
    MATS[key] = m
    return m


def obj_from_bm(name, bm, material, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    return ob


def sphere(name, r, loc, material, scale=(1, 1, 1), seg=(32, 16), deform=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=r)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        if deform:
            v.co = deform(v.co)
        v.co += Vector(loc)
    return obj_from_bm(name, bm, material)


def cylinder(name, r, depth, loc, material, rot=(0, 0, 0), seg=16, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    ob = obj_from_bm(name, bm, material)
    ob.rotation_euler = rot
    ob.location = loc
    return ob


def rounded_box(name, size, loc, material, bevel=0.02, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=4, affect='EDGES', profile=0.5)
    ob = obj_from_bm(name, bm, material)
    ob.rotation_euler = rot
    ob.location = loc
    return ob


def torus_arc(name, R, r, loc, material, arc=math.pi, rot=(0, 0, 0), seg=32):
    """partial torus in the XY plane (angles -arc/2..arc/2 around +Y... front), built by hand"""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = -arc / 2 + arc * i / seg
        c = Vector((R * math.sin(a), -R * math.cos(a), 0))
        n = c.normalized()
        ring = [bm.verts.new(c + n * (r * math.cos(b)) + Vector((0, 0, r * math.sin(b)))) for b in [j * 2 * math.pi / 8 for j in range(8)]]
        rings.append(ring)
    for i in range(seg):
        for j in range(8):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % 8], rings[i + 1][(j + 1) % 8], rings[i + 1][j]))
    ob = obj_from_bm(name, bm, material)
    ob.rotation_euler = rot
    ob.location = loc
    return ob


def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------------------------------------------------------------- body
H = 1.0  # all measurements are for a ~1.78 m tall player
J = {  # skeleton points (x, y, z); character faces -Y
    'pelvis': (0, 0, 0.98), 'spine': (0, 0.005, 1.12), 'chest': (0, 0.0, 1.30), 'neck': (0, 0.005, 1.48), 'headbase': (0, 0.0, 1.56),
    'hipL': (0.1, 0, 0.93), 'thighL': (0.104, -0.008, 0.74), 'kneeL': (0.108, -0.012, 0.52), 'calfL': (0.11, 0.012, 0.36),
    'ankleL': (0.11, 0.01, 0.09), 'toeL': (0.115, -0.11, 0.035),
    'shL': (0.2, 0.01, 1.42), 'elbL': (0.235, 0.03, 1.12), 'wrL': (0.25, 0.0, 0.84), 'handL': (0.255, -0.01, 0.75),
}
for k in list(J):
    if k.endswith('L'):
        x, y, z = J[k]
        J[k[:-1] + 'R'] = (-x, y, z)

SKIN_R = {'pelvis': 0.165, 'spine': 0.155, 'chest': 0.185, 'neck': 0.062, 'headbase': 0.055,
          'hip': 0.11, 'thigh': 0.1, 'knee': 0.072, 'calf': 0.072, 'ankle': 0.048, 'toe': 0.042,
          'sh': 0.072, 'elb': 0.056, 'wr': 0.042, 'hand': 0.047}
EDGES = [('pelvis', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'headbase')]
for s in 'LR':
    EDGES += [('pelvis', 'hip' + s), ('hip' + s, 'thigh' + s), ('thigh' + s, 'knee' + s), ('knee' + s, 'calf' + s), ('calf' + s, 'ankle' + s), ('ankle' + s, 'toe' + s),
              ('chest', 'sh' + s), ('sh' + s, 'elb' + s), ('elb' + s, 'wr' + s), ('wr' + s, 'hand' + s)]


def build_body(cfg):
    names = list(J)
    me = bpy.data.meshes.new('Body')
    me.from_pydata([J[n] for n in names], [(names.index(a), names.index(b)) for a, b in EDGES], [])
    ob = bpy.data.objects.new('Body', me)
    bpy.context.collection.objects.link(ob)
    ob.modifiers.new('skin', 'SKIN')
    sv = me.skin_vertices[0].data
    for i, n in enumerate(names):
        key = n.rstrip('LR') if n[-1] in 'LR' and n not in SKIN_R else n
        r = SKIN_R.get(key, 0.05)
        if cfg['pads'] and key in ('hand', 'wr'):
            r *= 1.3                                             # batting gloves
        sv[i].radius = (r, r)
    sv[names.index('pelvis')].use_root = True
    apply_all(ob)
    for v in ob.data.vertices:                                   # oval torso: flatter front to back, broader chest
        x, y, z = v.co
        if 0.86 < z < 1.5 and abs(x) < 0.2:
            t = min(1, (z - 0.86) / 0.2) * min(1, (1.5 - z) / 0.12)
            v.co.y = y * (1 - 0.32 * t)
            if z > 1.2:
                v.co.x = x * (1 + 0.12 * t)
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    apply_all(ob)
    # materials by region
    shirt, pants, skin = mat('Shirt', cfg['shirt'], 0.75), mat('Trousers', cfg['pants'], 0.8), mat('Skin', cfg['skin'], 0.5)
    glove = mat('Glove', '#fbfbf6', 0.6)
    me = ob.data
    for m in (shirt, pants, skin, glove):
        me.materials.append(m)
    for p in me.polygons:
        x, y, z = p.center
        arm = abs(x) > 0.17 and 0.7 < z < 1.48
        if z > 1.47:
            p.material_index = 2
        elif arm:
            if z > cfg['sleeve']:
                p.material_index = 0
            elif cfg['pads'] and z < 0.9:
                p.material_index = 3
            else:
                p.material_index = 2
        elif z > 0.94:
            p.material_index = 0
        else:
            p.material_index = 1
        p.use_smooth = True
    return ob


def build_armature():
    data = bpy.data.armatures.new('Rig')
    rig = bpy.data.objects.new('Armature', data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = data.edit_bones

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        return b
    bone('Hips', J['pelvis'], J['spine'])
    bone('Spine', J['spine'], (0, 0, 1.22), 'Hips')
    bone('Spine1', (0, 0, 1.22), J['chest'], 'Spine')
    bone('Spine2', J['chest'], J['neck'], 'Spine1')
    bone('Neck', J['neck'], J['headbase'], 'Spine2')
    bone('Head', J['headbase'], (0, 0, 1.78), 'Neck')
    for s, side in (('L', 'Left'), ('R', 'Right')):
        bone(side + 'Shoulder', (J['sh' + s][0] * 0.3, 0, 1.4), J['sh' + s], 'Spine2')
        bone(side + 'Arm', J['sh' + s], J['elb' + s], side + 'Shoulder')
        bone(side + 'ForeArm', J['elb' + s], J['wr' + s], side + 'Arm')
        bone(side + 'Hand', J['wr' + s], J['hand' + s], side + 'ForeArm')
        bone(side + 'UpLeg', J['hip' + s], J['knee' + s], 'Hips')
        bone(side + 'Leg', J['knee' + s], J['ankle' + s], side + 'UpLeg')
        bone(side + 'Foot', J['ankle' + s], J['toe' + s], side + 'Leg')
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def attach(ob, rig, bone):
    bpy.context.view_layer.update()                     # matrix_world must include the location just set
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = mw


# ---------------------------------------------------------------- head and face
HC = Vector((0, -0.005, 1.655))   # head centre


def head_shape(co):
    x, y, z = co
    n = co.normalized()
    jaw = 1 - 0.2 * max(0.0, min(1.0, (-n.z - 0.1) / 0.8))     # jaw narrows to the chin
    x *= 0.86 * jaw
    z *= 1.12
    if n.y < 0:                                               # flatter face, eye sockets
        y *= 0.93
    return Vector((x, y, z))


def build_head(cfg, rig):
    skin = mat('Skin', cfg['skin'], 0.5)
    parts = [sphere('HeadMesh', 0.105, HC, skin, seg=(48, 32), deform=head_shape)]
    # ears
    for s in (-1, 1):
        parts.append(sphere('Ear', 0.026, HC + Vector((s * 0.091, 0.004, 0.0)), skin, scale=(0.45, 0.8, 1.15)))
    # nose: bridge + tip + nostril wings
    parts.append(sphere('Nose', 0.016, HC + Vector((0, -0.1, -0.012)), skin, scale=(0.85, 1.1, 1.3)))
    for s in (-1, 1):
        parts.append(sphere('Nostril', 0.009, HC + Vector((s * 0.011, -0.095, -0.025)), skin))
    # eyes
    white, iris, pupil = mat('EyeWhite', '#f2ece3', 0.15, coat=1), mat('Iris', '#5a3418', 0.3, coat=1), mat('Pupil', '#060302', 0.2)
    lid = skin
    brow = mat('Brow', cfg['hair'], 0.8)
    for s in (-1, 1):
        c = HC + Vector((s * 0.037, -0.083, 0.012))
        parts.append(sphere('Eye', 0.0145, c, white, scale=(1.15, 1, 0.92)))
        parts.append(sphere('Iris', 0.0085, c + Vector((0, -0.0105, 0)), iris, scale=(1, 0.42, 1)))
        parts.append(sphere('Pupil', 0.0042, c + Vector((0, -0.0128, 0)), pupil, scale=(1, 0.4, 1)))
        lidob = sphere('Lid', 0.0152, c, lid, scale=(1.17, 1.02, 0.95))
        bm = bmesh.new(); bm.from_mesh(lidob.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < c.z + 0.004], context='VERTS')   # upper eyelid only
        bm.to_mesh(lidob.data); bm.free()
        parts.append(lidob)
        b = cylinder('Brow', 0.0028, 0.03, c + Vector((s * 0.002, -0.005, 0.021)), brow, rot=(0, math.pi / 2 + s * 0.12, 0), seg=8)
        b.scale = (1, 1.4, 1)
        parts.append(b)
    # lips
    lipmat = mat('Lips', '#c27a6a', 0.45)
    parts.append(sphere('LipUpper', 0.016, HC + Vector((0, -0.093, -0.052)), lipmat, scale=(1.4, 0.5, 0.42)))
    parts.append(sphere('LipLower', 0.016, HC + Vector((0, -0.09, -0.06)), lipmat, scale=(1.25, 0.55, 0.5)))
    # hair or helmet
    if cfg['helmet']:
        red = mat('Helmet', cfg['helmet'], 0.28, coat=1)
        metal = mat('Grille', '#c9d0dc', 0.25, metal=0.9)

        def shell(co):
            return Vector((co.x * 0.93, co.y * 1.02, co.z * 1.0))
        hel = sphere('Helmet', 0.128, HC + Vector((0, 0.008, 0.012)), red, seg=(48, 24), deform=shell)
        bm = bmesh.new(); bm.from_mesh(hel.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < HC.z + 0.012 - 0.005 and not (v.co.y > 0.02 and v.co.z > HC.z - 0.06)], context='VERTS')
        bm.to_mesh(hel.data); bm.free()
        parts.append(hel)
        peak = cylinder('Peak', 0.13, 0.008, HC + Vector((0, -0.03, 0.02)), red, rot=(0.12, 0, 0), seg=48)
        bm = bmesh.new(); bm.from_mesh(peak.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -0.06], context='VERTS')
        bm.to_mesh(peak.data); bm.free()
        parts.append(peak)
        for s in (-1, 1):
            parts.append(sphere('EarGuard', 0.03, HC + Vector((s * 0.1, -0.01, -0.02)), red, scale=(0.5, 1, 1.1)))
        for zoff in (-0.035, -0.065):                            # grille bars across the face
            parts.append(torus_arc('Grille', 0.112, 0.0035, HC + Vector((0, 0.0, zoff)), metal, arc=math.pi * 0.62))
        for xoff in (-0.03, 0.0, 0.03):
            parts.append(cylinder('GrilleV', 0.0032, 0.06, HC + Vector((xoff, -0.11 + abs(xoff) * 0.25, -0.05)), metal, seg=8))
    else:
        hairmat = mat('Hair', cfg['hair'], 0.55)

        def tousle(co):
            n = co.normalized()
            bump = 0.01 * noise.noise(n * 6) + 0.006 * math.sin(n.x * 25) * math.cos(n.y * 18)
            return co + n * bump
        hair = sphere('Hair', 0.116, HC + Vector((0, 0.008, 0.016)), hairmat, seg=(48, 24), deform=tousle)
        bm = bmesh.new(); bm.from_mesh(hair.data)
        cz = HC.z + 0.016
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if (v.co.z < cz + 0.02 and v.co.y < -0.02) or v.co.z < cz - 0.075
                                   or (v.co.z < cz - 0.02 and v.co.y < 0.03 and abs(v.co.x) < 0.09)], context='VERTS')
        bm.to_mesh(hair.data); bm.free()
        parts.append(hair)
        parts.append(sphere('Fringe', 0.045, HC + Vector((0.02, -0.075, 0.07)), hairmat, scale=(1.6, 0.6, 0.55)))
    for p in parts:
        attach(p, rig, 'Head')


# ---------------------------------------------------------------- kit
def build_kit(cfg, rig):
    shoe, sole = mat('Shoe', cfg['shoe'], 0.35, coat=0.6), mat('Sole', '#f4f4ee', 0.85)
    for s, side in ((1, 'Left'), (-1, 'Right')):
        a, t = Vector(J['ankle' + ('L' if s > 0 else 'R')]), Vector(J['toe' + ('L' if s > 0 else 'R')])
        c = (a + t) / 2 + Vector((0, 0.005, -0.01))
        attach(rounded_box('Shoe', (0.1, 0.27, 0.085), c + Vector((0, 0, 0.012)), shoe, 0.035), rig, side + 'Foot')
        attach(rounded_box('Sole', (0.106, 0.28, 0.025), c + Vector((0, 0, -0.03)), sole, 0.01), rig, side + 'Foot')
        if cfg['pads']:
            pad = mat('Pad', '#fbfbf6', 0.6)
            k = Vector(J['knee' + ('L' if s > 0 else 'R')])
            attach(rounded_box('Pad', (0.15, 0.06, 0.44), k + Vector((0, -0.095, -0.17)), pad, 0.025), rig, side + 'Leg')
            for xo in (-0.04, 0.0, 0.04):
                attach(cylinder('PadRib', 0.014, 0.38, k + Vector((xo, -0.125, -0.18)), pad, seg=10), rig, side + 'Leg')
            attach(rounded_box('KneeRoll', (0.16, 0.08, 0.08), k + Vector((0, -0.095, 0.07)), pad, 0.03), rig, side + 'UpLeg')
            strap = mat('Strap', cfg['shoe'], 0.4)
            for zo in (-0.08, -0.3):
                attach(rounded_box('Strap', (0.165, 0.07, 0.02), k + Vector((0, -0.092, zo)), strap, 0.006), rig, side + 'Leg')
    # collar and badge on the jersey
    collar = mat('Collar', cfg['collar'], 0.7)
    attach(torus_arc('Collar', 0.065, 0.014, Vector((0, 0.0, 1.47)), collar, arc=math.pi * 2, seg=32), rig, 'Spine2')
    attach(cylinder('Badge', 0.02, 0.004, Vector((0.075, -0.112, 1.3)), mat('Badge', '#ffc928', 0.3, coat=1), rot=(math.pi / 2, 0, 0), seg=24), rig, 'Spine2')
    if cfg.get('ball'):
        ball = sphere('Ball', 0.036, Vector(J['handL']) + Vector((0.0, -0.035, -0.01)), mat('Leather', '#b81c2b', 0.35, coat=0.8))
        ball.name = 'Ball'
        attach(ball, rig, 'LeftHand')


# ---------------------------------------------------------------- build + export
def make(name, cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    body = build_body(cfg)
    rig = build_armature()
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except Exception as e:
        print('automatic weights failed, using envelopes:', e)
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
    build_head(cfg, rig)
    build_kit(cfg, rig)
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name + '.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_animations=False, export_yup=True)
    print('wrote', path)


make('batsman', dict(shirt='#e0362c', pants='#ffffff', skin='#e9b892', hair='#3a2214', shoe='#e0362c', collar='#ffffff',
                     helmet='#d8262a', pads=True, sleeve=0.84))
make('bowler', dict(shirt='#f7f7f2', pants='#ffffff', skin='#e9b892', hair='#5b3418', shoe='#e0362c', collar='#e2e4ea',
                    helmet=None, pads=False, sleeve=1.2, ball=True))
