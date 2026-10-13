import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('aac_verify', ROOT / 'scripts/verify.py')
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

class PackageTests(unittest.TestCase):
    def test_archive_contains_exact_current_source_and_no_old_screenshots(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get('AAC_TEST_SCRATCH', verify.ROOT/'.test-scratch')) as temp:
            target = Path(temp) / 'plugin.zip'
            verify.create_archive(ROOT, target)
            with zipfile.ZipFile(target) as archive:
                self.assertEqual(archive.read('hermes-aac/desktop/plugin.js'), (ROOT/'desktop/plugin.js').read_bytes())
                self.assertIn('hermes-aac/tests/aac.test.mjs', archive.namelist())
                self.assertIn('hermes-aac/LICENSE', archive.namelist())
                self.assertNotIn('hermes-aac/DESKTOP-VERIFICATION.png', archive.namelist())
                self.assertIsNone(archive.testzip())

    def test_installed_cleaner_and_provider_function_preserve_allowlisted_tags(self):
        # Execute actual installed pure cleaner and isolated installed provider body.
        # SDK boundary is a controlled fixture: no keys/config/network/audio generation.
        import ast
        from types import SimpleNamespace
        if not os.environ.get('HERMES_SOURCE'):
            self.skipTest('Optional Hermes provider source fixture: set HERMES_SOURCE to a public checkout')
        core = verify.SOURCE
        spec = importlib.util.spec_from_file_location('installed_tts_cleaner', core/'tools/tts_text_normalize.py')
        cleaner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cleaner)
        for tag in ['happy','sad','excited','angry','thoughtful','surprised','whispers','laughs','sighs']:
            value = f'[{tag}] I need help'
            self.assertEqual(cleaner.prepare_spoken_text(value, max_chars=None), value)
        captured = []
        def convert(**kwargs):
            captured.append(kwargs)
            return [b'controlled SDK fixture, not provider audio']
        tree = ast.parse((core/'tools/tts_tool_providers.py').read_text(encoding='utf-8'))
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_generate_elevenlabs')
        namespace = {'__builtins__': __builtins__, 'str': str, 'dict': dict, 'Any': object,
                     '_require_key': lambda *args: 'non-secret test fixture',
                     '_origin': lambda: SimpleNamespace(_import_elevenlabs=lambda: lambda **kw: SimpleNamespace(text_to_speech=SimpleNamespace(convert=convert))),
                     '_elevenlabs_environment_kwargs': lambda config: {},
                     'DEFAULT_ELEVENLABS_VOICE_ID': 'default', 'DEFAULT_ELEVENLABS_MODEL_ID': 'default'}
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(core/'tools/tts_tool_providers.py'), 'exec'), namespace)
        value = '[happy] [whispers] [sighs] I need help'
        with tempfile.TemporaryDirectory(dir=os.environ.get('AAC_TEST_SCRATCH', verify.ROOT/'.test-scratch')) as temp:
            namespace['_generate_elevenlabs'](cleaner.prepare_spoken_text(value, max_chars=None), str(Path(temp)/'fixture.mp3'), {'elevenlabs': {'voice_id':'configured-voice','model_id':'eleven_v3'}})
        self.assertEqual(captured[0]['text'], value)
        self.assertEqual(captured[0]['model_id'], 'eleven_v3')
        self.assertEqual(captured[0]['voice_id'], 'configured-voice')

if __name__ == '__main__':
    unittest.main()
