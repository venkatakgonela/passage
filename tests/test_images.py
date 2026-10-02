import struct
import unittest
import zlib
from unittest.mock import patch
from urllib.parse import urlencode

from server import images
import test_server


class ImageTests(unittest.TestCase):
    setUp = test_server.ServerTests.setUp
    tearDown = test_server.ServerTests.tearDown
    request = test_server.ServerTests.request
    def image(self, relative, metadata=False, headers=None):
        endpoint = '/api/image-info' if metadata else '/api/image'
        return self.request('GET', endpoint + '?' + urlencode({'root': self.identifier, 'path': relative}), headers=headers)

    def png(self, width=100, height=100):
        def chunk(kind, payload):
            return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
        header = struct.pack('>II', width, height) + b'\x08\x02\x00\x00\x00'
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(b'\x00\x00\x00\x00')) + chunk(b'IEND', b'')

    def test_image_boundaries(self):
        (self.root / 'safe.png').write_bytes(self.png())
        (self.outside / 'secret.png').write_bytes(self.png())
        (self.root / 'alias.png').symlink_to(self.outside / 'secret.png')
        (self.root / 'internal.png').symlink_to(self.root / 'safe.png')
        (self.root / '.git').mkdir()
        (self.root / '.git/hidden.png').write_bytes(self.png())
        for metadata in [False, True]:
            self.assertEqual(self.image('safe.png', metadata)[0], 200)
            self.assertEqual(self.response_headers.get('X-Content-Type-Options'), 'nosniff')
            for relative in ['../outside/secret.png', str(self.outside / 'secret.png'), 'alias.png', 'internal.png', '.git/hidden.png', '%2e%2e/secret.png']:
                self.assertEqual(self.image(relative, metadata)[0], 404)
            for headers in [{'Host': 'evil.invalid'}, {'Origin': 'https://evil.invalid'}, {'Origin': None, 'Sec-Fetch-Site': 'cross-site'}]:
                self.assertEqual(self.image('safe.png', metadata, headers)[0], 403)

    def test_image_type_size_and_dimensions(self):
        for name, content in [('bad.png', b'not an image'), ('bad.jpg', self.png()), ('vector.svg', b'<svg/>'), ('text.txt', self.png())]:
            (self.root / name).write_bytes(content)
            self.assertEqual(self.image(name)[0], 415)
        for width, height in [(0, 1), (8193, 1), (4001, 4000)]:
            (self.root / 'large.png').write_bytes(self.png(width, height))
            self.assertEqual(self.image('large.png')[0], 413)
        (self.root / 'safe.png').write_bytes(self.png())
        with patch.object(images, 'MAX_IMAGE_BYTES', 32):
            for metadata in [False, True]:
                self.assertEqual(self.image('safe.png', metadata)[0], 413)
        jpeg = b'\xff\xd8\xff\xc0\x00\x0b\x08' + struct.pack('>HH', 20, 30) + b'\x01\x01\x11\x00\xff\xd9'
        (self.root / 'photo.jpg').write_bytes(jpeg)
        self.assertEqual(self.image('photo.jpg')[0], 200)
        (self.root / 'broken.jpg').write_bytes(jpeg[:8])
        self.assertEqual(self.image('broken.jpg')[0], 415)

    def test_image_headers_methods_and_immutability(self):
        original = self.png()
        (self.root / 'safe.png').write_bytes(original)
        for endpoint in ['/api/image', '/api/image-info']:
            path = endpoint + '?' + urlencode({'root': self.identifier, 'path': 'safe.png'})
            for method in ['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS']:
                for headers in [{'Host': 'evil.invalid'}, {'Origin': 'https://evil.invalid'}]:
                    self.assertEqual(self.request(method, path, headers=headers)[0], 403)
                    self.assertEqual(self.response_headers.get('X-Content-Type-Options'), 'nosniff')
            self.assertEqual(self.request('GET', path)[0], 200)
            self.assertEqual(self.response_headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual((self.root / 'safe.png').read_bytes(), original)
        (self.root / 'corrupt.png').write_bytes(original[:-1] + b'x')
        self.assertEqual(self.image('corrupt.png')[0], 415)
