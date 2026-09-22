#!/usr/bin/env python3
"""Put every page of a pack on the one house palette.

Library artwork was built for litho: the flat brand areas are Pantone spot
colours -- PANTONE 485 C red, 300 C blue, Yellow C -- carried as Separation
colourspaces. Signs we generate are built to the house hex values sampled from
the catalogue images. Side by side in one pack the difference is plain: the red
panel on a library page renders #DE241B against #C22033 on the page before it.

So this snaps library artwork onto the house palette. It is deliberately narrow,
and rewrites only two things:

  spot separations   the flat brand areas -- the panel, the keyline, the bar
  near-blacks        rich and registration blacks, to the one house black

Everything else is left exactly as drawn. The pedestrian signs carry a cartoon
figure in a hi-vis vest, hard hat and skin tones; those are illustration, not
brand colour, and any tolerance loose enough to catch #DE241B as "red" is also
loose enough to flatten the figure's hat and vest into brand yellow. The
Persimmon logo is the same trap in reverse -- its three greens sit within 35 of
house green in plain RGB distance -- so its CMYK builds are protected by value.

Print note: a spot plate is redefined here, not removed. The separation keeps
its Pantone name, so a RIP still sees one plate; what changes is the alternate
space it converts through. If a job is going to litho against a Pantone book,
say so and leave the spots alone -- matching ink is the printer's job, and
#C22033 is a screen sample of a catalogue image, not an ink spec.
"""

from __future__ import annotations

import re

from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    IndirectObject,
    NameObject,
    NumberObject,
)

# The house palette, from shop/public/images/products -- see the README.
HOUSE = {
    "red": (0xC2, 0x20, 0x33),
    "blue": (0x1E, 0x50, 0x9E),
    "green": (0x0D, 0x76, 0x4A),
    "yellow": (0xFA, 0xDC, 0x05),
    "black": (0x23, 0x1F, 0x20),
}

# Colour operators that take their components inline in the content stream.
_OPS = re.compile(rb"((?:[-\d.]+\s+){1,4})(rg|RG|k|K|g|G)(?=[\s\n\]/])")


def cmyk_to_rgb(c: float, m: float, y: float, k: float) -> tuple[int, int, int]:
    """DeviceCMYK the way a viewer or RIP resolves it, not the naive formula.

    Naive 255*(1-c)*(1-k) puts PANTONE 485 C's neighbours tens of points out and
    made the offending red look like it was not in the content stream at all.
    This is the polynomial pdf.js uses, which is what the proof renders through.
    """
    r = (255 + c * (-4.387332384609988 * c + 54.48615194189176 * m
         + 18.82290502165302 * y + 212.25662451639585 * k - 285.2331026137004)
         + m * (1.7149763477362134 * m - 5.6096736904047315 * y
         - 17.873870861415444 * k - 5.497006427196366)
         + y * (-2.5217340131683033 * y - 21.248923337353073 * k
         + 17.5119270841813)
         + k * (-21.86122147463605 * k - 189.48180835922747))
    g = (255 + c * (8.841041422036149 * c + 60.118027045597366 * m
         + 6.871425592049007 * y + 31.159100130055922 * k - 79.2970844816548)
         + m * (-15.310361306967817 * m + 17.575251261109482 * y
         + 131.35250912493976 * k - 190.9453302588951)
         + y * (4.444339102852739 * y + 9.8632861493405 * k
         - 24.86741582555878)
         + k * (-20.737325471181034 * k - 187.80453709719578))
    b = (255 + c * (0.8842522430003296 * c + 8.078677503112928 * m
         + 30.89978309703729 * y - 0.23883238689178934 * k
         - 14.183576799673286)
         + m * (10.49593273432072 * m + 63.02378494754052 * y
         + 50.606957656360734 * k - 112.23884253719248)
         + y * (0.03296041114873217 * y + 115.60384449646641 * k
         - 193.58209356861505)
         + k * (-22.33816807309886 * k - 180.12613974708367))
    return tuple(max(0, min(255, round(v))) for v in (r, g, b))


def lab_to_rgb(lightness: float, a: float, b: float) -> tuple[int, int, int]:
    """CIE Lab to sRGB, D50 -- the white point PDF Lab spaces default to.

    Spot colours carry their appearance as a Lab tint transform, so this is how
    a Pantone name becomes a colour we can compare against the house palette.
    """
    fy = (lightness + 16.0) / 116.0
    fx, fz = fy + a / 500.0, fy - b / 200.0

    def finv(t: float) -> float:
        return t ** 3 if t > 6.0 / 29.0 else 3.0 * (6.0 / 29.0) ** 2 * (t - 4.0 / 29.0)

    x, y, z = finv(fx) * 0.9642, finv(fy) * 1.0, finv(fz) * 0.8249
    # Bradford-adapted D50 XYZ to sRGB.
    rl = 3.1338561 * x - 1.6168667 * y - 0.4906146 * z
    gl = -0.9787684 * x + 1.9161415 * y + 0.0334540 * z
    bl = 0.0719453 * x - 0.2289914 * y + 1.4052427 * z

    def gamma(u: float) -> int:
        u = max(0.0, min(1.0, u))
        u = 1.055 * u ** (1 / 2.4) - 0.055 if u > 0.0031308 else 12.92 * u
        return max(0, min(255, round(u * 255)))

    return gamma(rl), gamma(gl), gamma(bl)


def _hsv(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = (v / 255.0 for v in rgb)
    hi, lo = max(r, g, b), min(r, g, b)
    span = hi - lo
    if span == 0:
        hue = 0.0
    elif hi == r:
        hue = (60 * ((g - b) / span)) % 360
    elif hi == g:
        hue = 60 * ((b - r) / span) + 120
    else:
        hue = 60 * ((r - g) / span) + 240
    return hue, (span / hi if hi else 0.0), hi


# Hue windows for the four brand colours. Narrow on purpose: the reds stop well
# short of the hi-vis orange at 15 degrees, and the greens stop short of the
# logo's teal. A colour outside every window is left alone rather than guessed.
_HUES = {
    "red": [(345, 360), (0, 10)],
    "yellow": [(45, 65)],
    "green": [(140, 170)],
    "blue": [(200, 240)],
}


def classify(rgb: tuple[int, int, int]) -> str | None:
    """Which house colour this is meant to be, or None to leave it alone."""
    hue, sat, val = _hsv(rgb)
    if val < 0.16 and sat < 0.30:
        return "black"
    if sat < 0.45:                      # greys, tints and skin tones
        return None
    for name, windows in _HUES.items():
        if any(lo <= hue <= hi for lo, hi in windows):
            return name
    return None


def _exp_fn(rgb: tuple[int, int, int]) -> DictionaryObject:
    """A tint transform: 0 is the unprinted sheet, 1 is the house colour."""
    fn = DictionaryObject()
    fn[NameObject("/FunctionType")] = NumberObject(2)
    fn[NameObject("/Domain")] = ArrayObject([NumberObject(0), NumberObject(1)])
    fn[NameObject("/C0")] = ArrayObject([FloatObject(1), FloatObject(1), FloatObject(1)])
    fn[NameObject("/C1")] = ArrayObject([FloatObject(v / 255.0) for v in rgb])
    fn[NameObject("/N")] = NumberObject(1)
    return fn


def _separation_tint1(space: ArrayObject) -> tuple[int, int, int] | None:
    """What this spot looks like at full strength.

    The alternate space is read from the tint transform's own numbers, not from
    its name. Illustrator writes Pantone alternates as an ICCBased Lab profile
    as often as a plain /Lab array, and going by the name missed PANTONE 485 C
    and 300 C while catching Yellow C -- the pack came back with two pages still
    off-palette and nothing in the log to say why. Lab is unmistakable in the
    values themselves: L runs 0-100 and a/b are signed.
    """
    try:
        fn = space[3].get_object()
        c1 = [float(v) for v in fn["/C1"]]
    except Exception:
        return None

    if len(c1) == 4:
        return cmyk_to_rgb(*c1)
    if len(c1) == 3:
        rng = fn.get("/Range")
        looks_lab = (any(v < 0.0 or v > 1.0 for v in c1)
                     or (rng is not None and float(rng[1]) > 1.0))
        if looks_lab:
            return lab_to_rgb(*c1)
        return tuple(round(255 * v) for v in c1)
    if len(c1) == 1:
        return (round(255 * c1[0]),) * 3
    return None


def _normalise_colourspaces(resources, log: list[str]) -> None:
    """Redefine spot separations so full tint lands on the house colour."""
    spaces = resources.get("/ColorSpace")
    if spaces is None:
        return
    for name, ref in spaces.get_object().items():
        space = ref.get_object()
        if not (isinstance(space, (ArrayObject, list)) and space
                and str(space[0]) == "/Separation"):
            continue
        rgb = _separation_tint1(space)
        if rgb is None:
            continue
        target = classify(rgb)
        if target is None or HOUSE[target] == rgb:
            continue
        house = HOUSE[target]
        space[2] = NameObject("/DeviceRGB")
        space[3] = _exp_fn(house)
        log.append(f"spot {str(space[1]).lstrip('/')}: "
                   f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X} -> "
                   f"#{house[0]:02X}{house[1]:02X}{house[2]:02X} ({target})")


def _normalise_stream(data: bytes, log: list[str],
                      flags: list[str]) -> bytes:
    """Snap inline fills -- blacks only, and report the chromatic ones.

    Inline fills are where the illustration lives. On the pedestrian signs the
    figure's jeans are a CMYK blue that classifies as brand blue and its hi-vis
    vest as brand yellow; snapping either would repaint the drawing. Every flat
    brand area measured across the library is a spot separation instead, which
    is handled above and cannot collide with artwork.

    So only near-blacks are snapped here -- nothing illustrative is a near-black
    and rich, registration and flat blacks all want to be the one house black.
    A chromatic fill that looks like a brand colour is recorded as a flag for a
    human to look at rather than changed on a guess.
    """
    seen: set[tuple] = set()

    def sub(match: re.Match) -> bytes:
        nums = [float(x) for x in match.group(1).split()]
        op = match.group(2).decode()
        if op in ("k", "K") and len(nums) == 4:
            rgb = cmyk_to_rgb(*nums)
        elif op in ("rg", "RG") and len(nums) == 3:
            rgb = tuple(round(255 * n) for n in nums)
        elif op in ("g", "G") and len(nums) == 1:
            rgb = (round(255 * nums[0]),) * 3
        else:
            return match.group(0)

        target = classify(rgb)
        if target is None or HOUSE[target] == rgb:
            return match.group(0)
        house = HOUSE[target]
        key = (tuple(nums), op)

        if target != "black":
            note = (f"inline {target} #{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X} "
                    f"left as drawn (illustration, or a flat area not set as a spot)")
            if note not in flags:
                flags.append(note)
            return match.group(0)

        if key not in seen:
            seen.add(key)
            log.append(f"fill {' '.join(str(n) for n in nums)} {op}: "
                       f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X} -> "
                       f"#{house[0]:02X}{house[1]:02X}{house[2]:02X} ({target})")
        comps = " ".join(f"{v / 255.0:.4f}" for v in house)
        return f"{comps} {'rg' if op.islower() else 'RG'} ".encode()

    return _OPS.sub(sub, data)


def _walk_forms(resources, seen: set, log: list[str], flags: list[str],
                depth: int = 0) -> None:
    """Form XObjects carry their own resources and streams. Follow them."""
    if depth > 6 or resources is None:
        return
    forms = resources.get_object().get("/XObject")
    if forms is None:
        return
    for _, ref in forms.get_object().items():
        key = ref.idnum if isinstance(ref, IndirectObject) else id(ref)
        if key in seen:
            continue
        seen.add(key)
        form = ref.get_object()
        if form.get("/Subtype") != "/Form":
            continue
        inner = form.get("/Resources")
        if inner is not None:
            _normalise_colourspaces(inner.get_object(), log)
        try:
            form.set_data(_normalise_stream(form.get_data(), log, flags))
        except Exception:
            pass
        _walk_forms(inner, seen, log, flags, depth + 1)


def normalise_page(page) -> tuple[list[str], list[str]]:
    """Bring one page onto the house palette.

    Returns (changes, flags): what was rewritten, and what looked like a brand
    colour but was left alone for a human to judge.
    """
    log: list[str] = []
    flags: list[str] = []
    resources = page.get("/Resources")
    if resources is not None:
        _normalise_colourspaces(resources.get_object(), log)
        _walk_forms(resources, set(), log, flags)
    raw = page._get_contents_as_bytes()
    if raw is not None:
        rewritten = _normalise_stream(raw, log, flags)
        if rewritten != raw:
            stream = DecodedStreamObject()
            stream.set_data(rewritten)
            page.replace_contents(stream)
    return log, flags
