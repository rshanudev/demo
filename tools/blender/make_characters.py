"""Builds the batsman and bowler as cute cartoon 3D kids (big round heads, big glossy eyes, rosy cheeks, chunky bodies)
and exports them as rigged GLB files for the game.

Run from the project folder (Blender 4.x / 5.x):
    blender --background --python tools/blender/make_characters.py -- public/models
or open it in Blender's Scripting tab and press Run.   (make_realistic_characters.py builds real-proportioned players.)

Each character is one smooth body mesh (Skin + Subdivision modifiers) skinned to a humanoid armature with
Mixamo-style bone names, plus head, face, hair/helmet, pads, gloves and shoes parented to the bones.
Units match the game's cartoon player (feet at 0, shoulders at 1.52, arm reach 0.86); the character faces -Y,
which becomes +Z (towards the camera) in the game. The armature carries bodyStyle='toon' and gameHeight custom
properties, so the game uses the matching batting poses and keeps this exact size.
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
def mat(name, col, rough=0.6, metal=0.0, coat=0.0, emit=0.0):
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
    if emit:
        b.inputs['Emission Color'].default_value = lin(col)
        b.inputs['Emission Strength'].default_value = emit
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


def sphere(name, r, loc, material, scale=(1, 1, 1), seg=(32, 16), deform=None, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=r)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        if deform:
            v.co = deform(v.co)
    ob = obj_from_bm(name, bm, material)
    if rot:
        ob.rotation_euler = rot
    ob.location = loc
    return ob


def cut(ob, keep):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co)], context='VERTS')
    bm.to_mesh(ob.data); bm.free()
    return ob


def cylinder(name, r, depth, loc, material, rot=(0, 0, 0), seg=16, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    ob = obj_from_bm(name, bm, material)
    ob.rotation_euler = rot
    ob.location = loc
    return ob


def rounded_box(name, size, loc, material, bevel=0.04, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=4, affect='EDGES', profile=0.5)
    ob = obj_from_bm(name, bm, material)
    ob.rotation_euler = rot
    ob.location = loc
    return ob


def tube(name, pts, r, material, seg=10):
    """smooth tube through points (brows, lash lines, grille bars, collar)"""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
        t = (b - a).normalized()
        u = t.cross(Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))).normalized()
        w = t.cross(u)
        ri = r[i] if isinstance(r, (list, tuple)) else r          # a list of radii tapers the tube
        rings.append([bm.verts.new(p + (u * math.cos(k * 2 * math.pi / seg) + w * math.sin(k * 2 * math.pi / seg)) * ri) for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    return obj_from_bm(name, bm, material)


def arc(c, R, a0, a1, n, plane='xz', depth=0.0):
    pts = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        if plane == 'xz':
            pts.append(c + Vector((R * math.sin(a), depth, R * math.cos(a))))
        else:  # 'xy': ring around a vertical axis, front is -Y
            pts.append(c + Vector((R * math.sin(a), -R * math.cos(a), 0)))
    return pts


def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------------------------------------------------------------- body (cartoon proportions)
J = {
    'pelvis': (0, 0, 0.95), 'spine': (0, 0, 1.13), 'chest': (0, 0, 1.36), 'neck': (0, 0, 1.6), 'headbase': (0, 0, 1.7),
    'hipL': (0.19, 0, 0.9), 'kneeL': (0.2, -0.01, 0.5), 'ankleL': (0.2, 0.01, 0.13), 'toeL': (0.2, -0.17, 0.07),
    'shL': (0.44, 0.0, 1.52), 'elbL': (0.47, 0.03, 1.1), 'wrL': (0.48, 0.0, 0.68), 'handL': (0.48, -0.01, 0.6),
}
for k in list(J):
    if k.endswith('L'):
        x, y, z = J[k]
        J[k[:-1] + 'R'] = (-x, y, z)

SKIN_R = {'pelvis': 0.31, 'spine': 0.32, 'chest': 0.34, 'neck': 0.13, 'headbase': 0.13,
          'hip': 0.17, 'knee': 0.15, 'ankle': 0.115, 'toe': 0.1,
          'sh': 0.15, 'elb': 0.12, 'wr': 0.105, 'hand': 0.12}
EDGES = [('pelvis', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'headbase')]
for s in 'LR':
    EDGES += [('pelvis', 'hip' + s), ('hip' + s, 'knee' + s), ('knee' + s, 'ankle' + s), ('ankle' + s, 'toe' + s),
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
        key = n[:-1] if n[-1] in 'LR' and n[:-1] in SKIN_R else n
        r = SKIN_R.get(key, 0.12)
        if cfg['pads'] and key in ('hand', 'wr'):
            r *= 1.25                                            # padded batting gloves
        elif key == 'hand':
            r = 0.072                                            # bare hand: a slim palm, the fingers are added in build_kit
        elif key == 'wr':
            r = 0.08
        sv[i].radius = (r, r)
    sv[names.index('pelvis')].use_root = True
    apply_all(ob)
    for v in ob.data.vertices:                                   # rounder, slightly flattened cartoon tummy
        x, y, z = v.co
        if 0.75 < z < 1.62 and abs(x) < 0.4:
            t = min(1, (z - 0.75) / 0.2) * min(1, (1.62 - z) / 0.15)
            v.co.y = y * (1 - 0.18 * t)
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    apply_all(ob)
    shirt, pants, skin = mat('Shirt', cfg['shirt'], 0.7), mat('Trousers', cfg['pants'], 0.75), mat('Skin', cfg['skin'], 0.5)
    glove = mat('Glove', '#fbfbf6', 0.6)
    for m in (shirt, pants, skin, glove):
        ob.data.materials.append(m)
    for p in ob.data.polygons:
        x, y, z = p.center
        arm = abs(x) > 0.36 and 0.45 < z < 1.6
        if z > 1.58:
            p.material_index = 2
        elif arm:
            if z > cfg['sleeve']:
                p.material_index = 0
            elif cfg['pads'] and z < 0.76:
                p.material_index = 3
            else:
                p.material_index = 2
        elif z > 0.93:
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
        return b
    bone('Hips', J['pelvis'], J['spine'])
    bone('Spine', J['spine'], (0, 0, 1.25), 'Hips')
    bone('Spine1', (0, 0, 1.25), J['chest'], 'Spine')
    bone('Spine2', J['chest'], J['neck'], 'Spine1')
    bone('Neck', J['neck'], J['headbase'], 'Spine2')
    bone('Head', J['headbase'], (0, 0, 2.6), 'Neck')
    for s, side in (('L', 'Left'), ('R', 'Right')):
        bone(side + 'Shoulder', (J['sh' + s][0] * 0.35, 0, 1.5), J['sh' + s], 'Spine2')
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


# ---------------------------------------------------------------- big cartoon head
HC = Vector((0, 0, 2.12))   # head centre
HR = 0.5                    # head radius (modelled at this size, then scaled by HEAD_K about the neck)
HEAD_K = 0.76               # Pixar-style kid proportions: head about a third of the height
NECK_TOP = Vector((0, 0, 1.67))


def finish_head(parts, rig):
    for p in parts:                                              # scale the whole head about the top of the neck
        p.scale = p.scale * HEAD_K
        p.location = NECK_TOP + (p.location - NECK_TOP) * HEAD_K
        attach(p, rig, 'Head')


def build_pro_face(cfg, skin):
    """A realistic adult sportsman's face on the same head: sculpted cheekbones, brow ridge, nose, lips, chin and jaw,
    almond eyes under heavy lids, tapered brows, painted lips and a light shaving shadow. Focused, calm expression."""
    def feat(n, d, amp, w):
        return amp * math.exp(-(n.angle(Vector(d).normalized()) / w) ** 2)

    def ridge(n, x, z0, z1, amp0, amp1, w, steps=8):             # a row of bumps down the centre line (nose bridge)
        return sum(feat(n, (x, -1, z0 + (z1 - z0) * i / steps), amp0 + (amp1 - amp0) * i / steps, w) for i in range(steps + 1)) / 2.2

    def shape(co):
        n = co.normalized()
        x, y, z = co.x * 0.9, co.y * 0.9, co.z * (0.97 if co.z > 0 else 0.96)                # longer, narrower adult face
        b = sum(feat(n, (s * 0.58, -0.62, -0.1), 0.03, 0.22) for s in (-1, 1))             # cheekbones
        b += sum(feat(n, (s * 0.46, -0.72, -0.42), -0.016, 0.17) for s in (-1, 1))         # hollow under them
        b += sum(feat(n, (s * 0.33, -0.9, 0.0), -0.045, 0.17) for s in (-1, 1))            # eye sockets
        b += sum(feat(n, (s * 0.3, -0.87, 0.19), 0.026, 0.15) for s in (-1, 1))            # brow ridge
        b += feat(n, (0, -0.95, 0.16), 0.012, 0.14)
        b += ridge(n, 0, 0.06, -0.24, 0.016, 0.08, 0.07)                                    # nose bridge to tip
        b += feat(n, (0, -0.96, -0.26), 0.045, 0.075)                                       # nose tip
        b += sum(feat(n, (s * 0.1, -0.96, -0.28), 0.03, 0.06) for s in (-1, 1))            # nostril wings
        b += feat(n, (0, -0.94, -0.36), -0.008, 0.05)                                       # philtrum
        b += sum(feat(n, (s * 0.05, -0.92, -0.43), 0.017, 0.09) for s in (-1, 1))          # upper lip
        b += feat(n, (0, -0.9, -0.51), 0.022, 0.1)                                          # lower lip
        b += feat(n, (0, -0.83, -0.6), -0.012, 0.08)                                        # crease under the lip
        b += feat(n, (0, -0.68, -0.74), 0.045, 0.2)                                         # chin
        b += sum(feat(n, (s * 0.5, -0.5, -0.66), 0.028, 0.28) for s in (-1, 1))            # square jaw
        return Vector((x, y, z)) + n * b

    head = sphere('HeadMesh', HR, HC, skin, seg=(192, 128), deform=shape)

    def on(x, z, out=0.0):                                       # a point on the face (x, z as fractions of the head radius)
        n = Vector((x, -math.sqrt(max(0.0, 1 - x * x - z * z)), z))
        p = shape(n * HR)
        return HC + p + p.normalized() * out

    # paint: rosy lips, warm cheeks and nose, a faint shaving shadow on the jaw and upper lip
    skin_c = Vector(lin(cfg['skin'])[:3])
    def ratio(hexcol):
        c = lin(hexcol)
        return Vector((c[0] / skin_c.x, c[1] / skin_c.y, c[2] / skin_c.z))
    lip_r, warm_r, shadow_r = ratio('#c27c6c'), ratio('#e9a585'), ratio('#b49482')
    me = head.data
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in me.vertices:
        n = v.co.normalized()
        g = lambda d, w: math.exp(-(n.angle(Vector(d).normalized()) / w) ** 2)
        lips = max(g((s * 0.05, -0.92, -0.43), 0.075) for s in (-1, 1)) * 0.9
        lips = max(lips, g((0, -0.9, -0.51), 0.08) * 0.85)
        warm = max(max(g((s * 0.56, -0.66, -0.2), 0.22) for s in (-1, 1)) * 0.45, g((0, -0.96, -0.24), 0.1) * 0.4)
        jaw = 1.0 if n.z < -0.35 and n.y < -0.2 else 0.0
        shadow = max(jaw * min(1.0, (-0.35 - n.z) * 4) * (1 - g((0, -0.9, -0.47), 0.14)) * 0.35, g((0, -0.93, -0.37), 0.06) * 0.25 * (1 - lips))
        t = Vector((1, 1, 1)).lerp(warm_r, warm).lerp(shadow_r, shadow).lerp(lip_r, lips)
        col.data[v.index].color = (min(t.x, 1.4), min(t.y, 1.4), min(t.z, 1.4), 1)
    me.color_attributes.active_color = col
    parts = [head]

    # almond eyes set in the sockets, upper lid low over the iris (focused), lower lid, lash line and lid crease
    white, iris, pupil = mat('EyeWhite', '#f3eee7', 0.15, coat=1), mat('IrisPro', '#55341c', 0.3, coat=1), mat('Pupil', '#0a0503', 0.2, coat=1)
    lash, crease = mat('Lash', '#24140a', 0.6), mat('LidCrease', '#c98f76', 0.6)
    spark = mat('Catchlight', '#ffffff', 0.2, emit=0.8)
    for s in (-1, 1):
        c = on(s * 0.33, 0.0, -0.072)
        E = 0.08                                                 # eyeball radius
        parts.append(sphere('Eye', E, c, white, scale=(1.0, 1.0, 0.95)))
        parts.append(sphere('Iris', E * 0.5, c + Vector((0, -E * 0.94, -E * 0.06)), iris, scale=(1, 0.3, 1)))
        parts.append(sphere('Pupil', E * 0.235, c + Vector((0, -E * 1.09, -E * 0.06)), pupil, scale=(1, 0.25, 1)))
        parts.append(sphere('Catchlight', E * 0.09, c + Vector((s * E * 0.18, -E * 1.13, E * 0.15)), spark))
        parts.append(cut(sphere('Lid', E * 1.07, c, skin, seg=(48, 32)), lambda co: co.z > E * (0.235 - 0.45 * (co.x / E) ** 2) and co.y < 0.03))
        parts.append(cut(sphere('LowerLid', E * 1.04, c, skin, seg=(48, 32)), lambda co: co.z < E * (-0.44 + 0.3 * (co.x / E) ** 2) and co.y < 0.03))
        lid = lambda a, h, d: c + Vector((E * 1.04 * math.sin(a), -E * 1.04 * math.cos(a) * 0.85 - d, E * (h - 0.45 * (1.04 * math.sin(a)) ** 2)))
        angs = [-1.15 + 2.3 * i / 16 for i in range(17)]
        parts.append(tube('Lash', [lid(a, 0.28, E * 0.24) for a in angs], E * 0.095, lash, seg=8))
        parts.append(tube('LidCrease', [lid(a * 0.95, 0.62, E * 0.06) for a in angs], E * 0.06, crease, seg=6))
        # tapered brow: thick at the inner end, thin at the tail, slightly lowered towards the nose
        bp = [on(s * x, z, 0.008) for x, z in ((0.12, 0.18), (0.21, 0.21), (0.31, 0.23), (0.41, 0.22), (0.5, 0.18))]
        parts.append(tube('Brow', bp, [0.02, 0.019, 0.016, 0.012, 0.007], mat('Brow', cfg['brow'], 0.85)))
        parts.append(tube('Brow2', [p + Vector((0, 0, 0.008)) for p in bp[:3]], [0.014, 0.012, 0.008], mat('Brow', cfg['brow'], 0.85)))
        parts.append(sphere('Nostril', 0.011, on(s * 0.06, -0.305, -0.004), mat('Nostril', '#4a2620', 0.8), scale=(1.4, 1.0, 0.55)))
        parts.append(sphere('Ear', 0.1, HC + Vector((s * 0.44, 0.03, -0.05)), skin, scale=(0.45, 0.75, 1.15)))
    # closed mouth: a soft line between the lips, corners level
    parts.append(tube('MouthLine', [on(x, -0.47 - 0.25 * x * x, 0.002) for x in [-0.12 + 0.24 * i / 20 for i in range(21)]],
                      [0.003 + 0.004 * math.sin(math.pi * i / 20) for i in range(21)], mat('MouthLine', '#6e3328', 0.6), seg=8))
    return parts


def build_head(cfg, rig):
    skin = mat('Skin', cfg['skin'], 0.5)
    if cfg.get('face') == 'pro':
        parts = build_pro_face(cfg, skin)
        build_headgear(cfg, parts)
        finish_head(parts, rig)
        return
    skin_c = Vector(lin(cfg['skin'])[:3])
    blush_c = Vector(lin('#ff9c8e')[:3])
    lip_c = Vector(lin('#f0a090')[:3])

    def feat(n, d, amp, w):
        return amp * math.exp(-(n.angle(Vector(d).normalized()) / w) ** 2)

    def kid_head(co):                                            # chubby cheeks, soft chin, slight eye sockets, round forehead
        n = co.normalized()
        x, y, z = co.x, co.y * 0.93, co.z * (0.97 if co.z > 0 else 0.9)
        b = sum(feat(n, (s * 0.55, -0.62, -0.45), 0.045, 0.42) for s in (-1, 1))
        b += sum(feat(n, (s * 0.36, -0.86, 0.02), -0.028, 0.2) for s in (-1, 1))
        b += feat(n, (0, -0.55, -0.83), 0.012, 0.3) + feat(n, (0, -0.9, -0.42), 0.012, 0.25) + feat(n, (0, -0.4, 0.9), 0.015, 0.6)
        return Vector((x, y, z)) + n * b
    head = sphere('HeadMesh', HR, HC, skin, seg=(96, 64), deform=kid_head)
    # soft painted blush on the cheeks (vertex colours tint the skin; no stuck-on discs)
    me = head.data
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for v in me.vertices:
        n = v.co.normalized()
        k = max(math.exp(-(n.angle(Vector((s * 0.6, -0.66, -0.42)).normalized()) / 0.2) ** 2) for s in (-1, 1)) * 0.75
        tint = Vector((1, 1, 1)).lerp(Vector((blush_c.x / skin_c.x, blush_c.y / skin_c.y, blush_c.z / skin_c.z)), k)
        col.data[v.index].color = (min(tint.x, 1), min(tint.y, 1), min(tint.z, 1), 1)
    me.color_attributes.active_color = col
    parts = [head]
    for s in (-1, 1):                                            # ears
        parts.append(sphere('Ear', 0.09, HC + Vector((s * 0.49, 0.02, -0.02)), skin, scale=(0.55, 0.8, 1.05)))
        parts.append(sphere('EarIn', 0.055, HC + Vector((s * 0.52, 0.0, -0.02)), mat('EarIn', '#f2a98e', 0.6), scale=(0.4, 0.7, 0.9)))
    # big glossy eyes set into the face: dark iris, two sparkles, a skin upper eyelid with lash line, a soft lower lid
    white, iris, pupil = mat('EyeWhite', '#ffffff', 0.12, coat=1), mat('Iris', '#6a3a1a', 0.25, coat=1), mat('Pupil', '#0a0503', 0.2, coat=1)
    spark = mat('Sparkle', '#ffffff', 0.2, emit=1.5)
    lash = mat('Lash', '#24140a', 0.6)
    for s in (-1, 1):
        c = HC + Vector((s * 0.175, -0.39, 0.0))
        parts.append(sphere('Eye', 0.115, c, white, scale=(0.85, 0.55, 1.1)))
        parts.append(sphere('Iris', 0.1, c + Vector((0, -0.036, -0.004)), iris, scale=(0.85, 0.42, 1.06)))
        parts.append(sphere('Pupil', 0.055, c + Vector((0, -0.068, -0.004)), pupil, scale=(0.85, 0.35, 1.05)))
        parts.append(sphere('Sparkle', 0.028, c + Vector((0.03, -0.084, 0.04)), spark, scale=(1, 0.35, 1)))       # flat catchlights on the iris
        parts.append(sphere('Sparkle2', 0.013, c + Vector((-0.03, -0.082, -0.046)), spark, scale=(1, 0.35, 1)))
        parts.append(cut(sphere('Lid', 0.118, c, skin, scale=(0.9, 0.62, 1.12), seg=(40, 24)), lambda co: co.z > 0.075))
        parts.append(tube('Lash', arc(c + Vector((0, -0.06, 0.066)), 0.093, -1.2, 1.2, 18), 0.014, lash))
        parts.append(tube('LowerLid', [c + Vector((0.098 * math.sin(a), -0.052, -0.118 * math.cos(a))) for a in [-1.0 + 2.0 * i / 14 for i in range(15)]], 0.011, skin))
        bc = c + Vector((0, -0.03, 0.19))                        # arched brow above the eye
        parts.append(tube('Brow', [bc + Vector((-0.075, 0.0, -0.012)), bc + Vector((-0.025, -0.006, 0.012)), bc + Vector((0.04, 0.0, 0.012)), bc + Vector((0.085, 0.012, -0.014))], 0.021, mat('Brow', cfg['brow'], 0.8)))
    parts.append(sphere('Nose', 0.036, HC + Vector((0, -0.475, -0.085)), skin, scale=(1.25, 0.7, 0.8)))
    # sweet closed-mouth smile: a curved smile line with the corners turned up, a soft rosy lower lip, dimples
    mc = HC + Vector((0, -0.455, -0.2))
    smile = lambda x, lift: mc + Vector((x, 0.55 * x * x, lift + 1.9 * x * x))     # follows the face's curve, corners rise
    xs = [-0.13 + 0.26 * i / 24 for i in range(25)]
    parts.append(tube('Smile', [smile(x, 0.0) for x in xs], 0.011, mat('SmileLine', '#7a2a20', 0.6)))
    lipmat = mat('Lip', '#f2a596', 0.45)
    parts.append(tube('LowerLip', [smile(x * 0.6, -0.028 + 0.9 * (x * 0.6) ** 2) + Vector((0, -0.006, 0)) for x in xs], 0.016, lipmat))
    for s in (-1, 1):
        parts.append(tube('Dimple', [smile(s * 0.13, 0.0) + Vector((s * 0.008, 0.004, 0.0)), smile(s * 0.142, 0.0) + Vector((s * 0.01, 0.01, -0.03))], 0.006, mat('Crease', '#e9a88f', 0.6)))
    build_headgear(cfg, parts)
    finish_head(parts, rig)


def build_headgear(cfg, parts):
    """helmet with grille (and the hair showing under it), or a swept-up quiff"""
    def hair_shell(r, loc, material, cover):
        """hair as a smooth shell: where cover(co) < 0 it sinks under the scalp, so the hairline is soft, not stepped"""
        def shape(co):
            n = co.normalized()
            t = max(0.0, min(1.0, (cover(co) + 0.035) / 0.07))
            t = t * t * (3 - 2 * t)
            return n * (HR * 0.86 + (r - HR * 0.86 + 0.035 * noise.noise(n * 3.5) + 0.02) * t)
        return sphere('Hair', r, loc, material, seg=(128, 64), deform=shape)
    if cfg['helmet']:
        red = mat('Helmet', cfg['helmet'], 0.22, coat=1)
        metal = mat('Grille', '#c9d0dc', 0.25, metal=0.9)
        up = Vector((0, 0, 0.16))                                # sits high enough to show the brows and a fringe
        parts.append(cut(sphere('Helmet', HR * 1.1, HC + up + Vector((0, 0.02, 0.04)), red, seg=(64, 32)),
                         lambda co: co.z > 0.1 or (co.y > 0.1 and co.z > -0.25)))
        parts.append(tube('Rim', arc(HC + up + Vector((0, 0.02, 0.14)), HR * 1.08, -math.pi, math.pi, 64, plane='xy'), 0.025, red))
        parts.append(cut(cylinder('Peak', HR * 1.12, 0.03, HC + up + Vector((0, -0.06, 0.15)), red, rot=(-0.15, 0, 0), seg=64),
                         lambda co: co.y < -0.35))
        parts.append(tube('Stripe', arc(HC + up + Vector((0, 0.02, 0.04)), HR * 1.1 + 0.005, -1.3, 1.6, 32, plane='xz'), 0.02, mat('Stripe', '#ffffff', 0.4)))
        for s in (-1, 1):
            parts.append(sphere('EarGuard', 0.1, HC + Vector((s * 0.52, -0.02, -0.02)), red, scale=(0.45, 1, 1.05)))
        for z in (-0.24, -0.36):                                 # grille across the chin, the face stays clear
            parts.append(tube('Grille', [HC + Vector((-0.44 * math.sin(a), -0.6 * math.cos(a), z)) for a in [-1.2 + 2.4 * i / 24 for i in range(25)]], 0.012, metal))
        for x in (-0.15, 0.0, 0.15):
            parts.append(tube('GrilleV', [HC + Vector((x, -0.6 + abs(x) * 0.25, -0.22)), HC + Vector((x, -0.59 + abs(x) * 0.25, -0.42))], 0.012, metal))
        # dark hair under the helmet: a band at the sides and back, a few fringe locks on the forehead
        hairmat = mat('Hair', cfg['hair'], 0.5, coat=0.2)
        parts.append(hair_shell(HR * 1.03, HC + Vector((0, 0.02, 0.0)), hairmat,
                                lambda co: min(co.z + 0.06 - 0.3 * max(0.0, -co.y / HR), max(co.y + 0.3, co.z - 0.24))))
        for x, rz in ((-0.2, 0.5), (-0.05, 0.15), (0.12, -0.25), (0.26, -0.55)):
            parts.append(sphere('Fringe', 0.085, HC + Vector((x, -0.43 + abs(x) * 0.3, 0.265)), hairmat, scale=(1.3, 0.5, 0.6), rot=(0.5, 0, rz)))
        for s in (-1, 1):                                        # side locks falling past the temples, in front of the ear guards
            parts.append(sphere('SideLock', 0.075, HC + Vector((s * 0.42, -0.2, 0.06)), hairmat, scale=(0.45, 0.8, 1.6), rot=(0, s * 0.15, 0)))
            parts.append(sphere('SideLock', 0.06, HC + Vector((s * 0.44, -0.08, -0.06)), hairmat, scale=(0.45, 0.9, 1.5)))
    else:
        hairmat = mat('Hair', cfg['hair'], 0.5, coat=0.2)
        parts.append(hair_shell(HR * 1.04, HC + Vector((0, 0.03, 0.03)), hairmat,
                                lambda co: max(min(co.z - 0.12, co.y + 0.43), min(co.y - 0.05, co.z + 0.3), min(co.z + 0.05, abs(co.x) - 0.42, co.y + 0.25))))
        # swept-up quiff: locks rising from the hairline and brushed back to one side
        parts.append(sphere('Quiff', 0.22, HC + Vector((0.04, -0.27, 0.4)), hairmat, scale=(1.45, 0.85, 0.62), rot=(-0.45, 0, -0.18)))
        parts.append(sphere('Quiff2', 0.17, HC + Vector((-0.2, -0.24, 0.36)), hairmat, scale=(1.3, 0.85, 0.6), rot=(-0.4, 0, 0.45)))
        parts.append(sphere('Quiff3', 0.16, HC + Vector((0.25, -0.2, 0.36)), hairmat, scale=(1.2, 0.85, 0.6), rot=(-0.3, 0, -0.6)))


# ---------------------------------------------------------------- kit
def build_kit(cfg, rig):
    shoe, sole = mat('Shoe', cfg['shoe'], 0.3, coat=0.7), mat('Sole', '#f6f6f0', 0.85)
    lace = mat('Lace', '#ffffff', 0.5)
    for s, side in ((1, 'Left'), (-1, 'Right')):
        k = 'L' if s > 0 else 'R'
        a, t = Vector(J['ankle' + k]), Vector(J['toe' + k])
        c = Vector((a.x, (a.y + t.y) / 2 - 0.02, 0.09))
        attach(rounded_box('Shoe', (0.25, 0.42, 0.17), c, shoe, 0.07), rig, side + 'Foot')
        attach(rounded_box('Sole', (0.26, 0.44, 0.05), c + Vector((0, 0, -0.07)), sole, 0.02), rig, side + 'Foot')
        for i in range(3):
            attach(cylinder('Lace', 0.012, 0.11, c + Vector((0, -0.1 + i * 0.05, 0.088 - i * 0.008)), lace, rot=(0, math.pi / 2, 0), seg=8), rig, side + 'Foot')
        if cfg['pads']:
            pad = mat('Pad', '#fbfbf6', 0.6)
            kn = Vector(J['knee' + k])
            attach(rounded_box('Pad', (0.33, 0.12, 0.6), kn + Vector((0, -0.17, -0.18)), pad, 0.05), rig, side + 'Leg')
            for xo in (-0.09, 0.0, 0.09):
                attach(cylinder('PadRib', 0.03, 0.5, kn + Vector((xo, -0.23, -0.2)), pad, seg=12), rig, side + 'Leg')
            attach(rounded_box('KneeRoll', (0.34, 0.14, 0.13), kn + Vector((0, -0.17, 0.14)), pad, 0.06), rig, side + 'UpLeg')
            strap = mat('Strap', cfg['shoe'], 0.35)
            for zo in (-0.02, -0.34):
                attach(rounded_box('Strap', (0.36, 0.13, 0.045), kn + Vector((0, -0.17, zo)), strap, 0.015), rig, side + 'Leg')
    collar = mat('Collar', cfg['collar'], 0.7)
    attach(tube('Collar', arc(Vector((0, 0.0, 1.62)), 0.19, -math.pi, math.pi, 40, plane='xy'), 0.045, collar), rig, 'Spine2')
    if cfg.get('trim'):
        attach(tube('Trim', arc(Vector((0, 0.0, 1.62)), 0.226, -math.pi, math.pi, 40, plane='xy'), 0.016, mat('Trim', cfg['trim'], 0.5)), rig, 'Spine2')
    for s in (-1, 1):
        attach(rounded_box('CollarTip', (0.12, 0.04, 0.1), Vector((s * 0.08, -0.17, 1.6)), collar, 0.015, rot=(0.5, 0, s * 0.45)), rig, 'Spine2')
    attach(rounded_box('Placket', (0.07, 0.02, 0.16), Vector((0, -0.3, 1.47)), collar, 0.008, rot=(-0.3, 0, 0)), rig, 'Spine2')
    attach(cylinder('Badge', 0.055, 0.015, Vector((-0.15, -0.31, 1.36)), mat('Badge', '#ffc928', 0.3, coat=1), rot=(math.pi / 2, 0, 0), seg=24), rig, 'Spine2')
    if not cfg['pads']:                                          # bare hands: palm, four fingers and a thumb
        skin = mat('Skin', cfg['skin'], 0.5)
        for s, side in ((1, 'Left'), (-1, 'Right')):
            hx = J['handL'][0] * s
            grip = s > 0 and cfg.get('ball')                     # the ball hand wraps its fingers around the ball
            attach(sphere('Palm', 0.06, Vector((hx, -0.02, 0.6)), skin, scale=(0.75, 0.85, 1.05)), rig, side + 'Hand')
            for i, dx in enumerate((-0.042, -0.014, 0.014, 0.042)):
                ln = (0.92, 1.0, 0.97, 0.82)[i]                   # middle finger longest, little finger shortest
                if grip:
                    pts = [(0, -0.03, 0.585), (0, -0.07, 0.53), (0, -0.13, 0.49), (0, -0.18, 0.505)]
                else:
                    pts = [(0, -0.02, 0.575), (0, -0.03, 0.52), (0, -0.05, 0.48), (0, -0.07, 0.465)]
                base = Vector((hx + s * dx, 0, 0))
                p = [base + Vector((0, y * ln, 0.6 + (z - 0.6) * ln)) for _, y, z in pts]
                attach(tube('Finger', p, 0.019 - i * 0.0008, skin, seg=10), rig, side + 'Hand')
                attach(sphere('Fingertip', 0.019, p[-1], skin), rig, side + 'Hand')
            tx = hx - s * 0.058                                  # thumb on the inner side of the hand
            tp = [Vector((tx, -0.02, 0.625)), Vector((tx - s * 0.012, -0.075, 0.6)), Vector((tx - s * 0.005, -0.13, 0.575 if grip else 0.585))]
            attach(tube('Thumb', tp, 0.022, skin, seg=10), rig, side + 'Hand')
            attach(sphere('ThumbTip', 0.022, tp[-1], skin), rig, side + 'Hand')
    if cfg.get('ball'):
        ball = sphere('Ball', 0.1, Vector(J['handL']) + Vector((0.0, -0.11, -0.03)), mat('Leather', '#c3202e', 0.35, coat=0.8))
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
    bpy.context.view_layer.update()
    top = max((o.matrix_world @ Vector(c)).z for o in bpy.data.objects if o.type == 'MESH' for c in o.bound_box)
    rig['bodyStyle'] = 'toon'                                   # read by the game: cartoon batting poses
    rig['gameHeight'] = round(top, 3)                            # and keep this exact size
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name + '.glb')
    bpy.ops.object.select_all(action='SELECT')
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_animations=False, export_yup=True, export_extras=True, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_animations=False, export_yup=True, export_extras=True, export_colors=True)
    print('wrote', path, 'height', round(top, 3))


make('batsman', dict(shirt='#e0362c', pants='#ffffff', skin='#f8cfae', hair='#5a3219', brow='#4a2814', shoe='#e0362c',
                     collar='#ffffff', helmet='#e02a2a', pads=True, sleeve=0.76))
make('bowler', dict(shirt='#f7f7f2', pants='#ffffff', skin='#ffdcc2', hair='#6b3a1c', brow='#5b3418', shoe='#e0362c',
                    collar='#ffffff', trim='#e0362c', helmet=None, pads=False, sleeve=1.26, ball=True))
