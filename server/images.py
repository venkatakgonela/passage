import struct
import zlib
from pathlib import Path

from .policy import Rejected, SKIP, within

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 16_000_000
MAX_DIMENSION = 8192


def dimensions(content, suffix):
    if suffix == '.png':
        if len(content) < 33 or content[:8] != b'\x89PNG\r\n\x1a\n' or content[8:16] != b'\x00\x00\x00\rIHDR':
            raise Rejected('invalid PNG', 415)
        width, height = struct.unpack('>II', content[16:24])
        position = 8
        kinds = []
        while position + 12 <= len(content):
            length = int.from_bytes(content[position:position + 4], 'big')
            end = position + 12 + length
            if end > len(content):
                raise Rejected('truncated PNG', 415)
            kind = content[position + 4:position + 8]
            payload = content[position + 8:end - 4]
            expected = int.from_bytes(content[end - 4:end], 'big')
            if zlib.crc32(kind + payload) != expected or (kind == b'IHDR' and kinds):
                raise Rejected('invalid PNG structure', 415)
            kinds.append(kind)
            position = end
            if kind == b'IEND':
                break
        if b'IDAT' not in kinds or kinds[-1:] != [b'IEND'] or position != len(content):
            raise Rejected('incomplete PNG', 415)
        mime = 'image/png'
    else:
        if content[:2] != b'\xff\xd8' or content[-2:] != b'\xff\xd9':
            raise Rejected('invalid JPEG', 415)
        position = 2
        width = height = 0
        while position + 4 <= min(len(content), 65536):
            if content[position] != 255:
                raise Rejected('invalid JPEG marker', 415)
            marker = content[position + 1]
            position += 2
            if marker in {0xDA, 0xD9}:
                break
            length = int.from_bytes(content[position:position + 2], 'big')
            if length < 2 or position + length > len(content):
                raise Rejected('truncated JPEG', 415)
            if marker in {0xC0, 0xC2}:
                if length < 8:
                    raise Rejected('invalid JPEG dimensions', 415)
                height, width = struct.unpack('>HH', content[position + 3:position + 7])
                break
            position += length
        if not width or not height:
            raise Rejected('unsupported JPEG header', 415)
        mime = 'image/jpeg'
    if not width or not height or width > MAX_DIMENSION or height > MAX_DIMENSION or width * height > MAX_PIXELS:
        raise Rejected('image dimensions too large', 413)
    return {'width': width, 'height': height, 'type': mime}


def read_image(root, relative):
    path = Path(relative)
    if path.is_absolute() or '..' in path.parts or SKIP.intersection(path.parts):
        raise Rejected()
    target = root / path
    if any(part.is_symlink() for part in [target, *target.parents] if part != root and within(part, root)):
        raise Rejected()
    target = target.resolve()
    if not within(target, root) or not target.is_file():
        raise Rejected()
    suffix = target.suffix.lower()
    if suffix not in {'.png', '.jpg', '.jpeg'}:
        raise Rejected('image type not supported', 415)
    with target.open('rb') as stream:
        content = stream.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise Rejected('image too large', 413)
    return content, dimensions(content, suffix)
