"""Run the real React/jsdom suite and optionally install to the authorized default profile."""
from pathlib import Path
import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
HOME = Path(os.environ.get('HERMES_HOME') or (Path(os.environ.get('LOCALAPPDATA', Path.home()/'AppData/Local'))/'hermes' if os.name=='nt' else Path.home()/'.hermes'))
SOURCE = Path(os.environ.get('HERMES_SOURCE', HOME/'hermes-agent'))
TARGET = HOME/'desktop-plugins/hermes-aac/plugin.js'

def create_archive(root, target):
    files = ['desktop/plugin.js', 'plugin.yaml', 'LICENSE', 'README.md', 'package.json', 'package-lock.json',
             'tests/aac.test.mjs', 'tests/dependencies.mjs', 'tests/test_verify.py', 'scripts/verify.py', 'scripts/render-harness.mjs', 'scripts/check-hermes-contract.py',
             'evidence/cockpit-1366.png', 'evidence/studio-1366.png', 'evidence/focus-1366.png']
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            source = root / name
            if source.exists():
                archive.write(source, 'hermes-aac/' + name)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() or archive.read('hermes-aac/desktop/plugin.js') != (root / 'desktop/plugin.js').read_bytes():
            raise RuntimeError('ZIP readback failed.')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--package', action='store_true')
    parser.add_argument('--target', type=Path, default=TARGET, help='Authorized plugin installation file (default active HERMES_HOME)')
    args = parser.parse_args()
    # HERMES_SOURCE is optional; npm ci provides local development dependencies.
    scratch=Path(os.environ.get('AAC_TEST_SCRATCH', ROOT/'.test-scratch'))
    scratch.mkdir(parents=True,exist_ok=True)
    os.environ['AAC_TEST_SCRATCH']=str(scratch)
    node = shutil.which('node.exe') or shutil.which('node')
    if not node:
        raise SystemExit('Node executable not found; no plugin installed.')
    source = (ROOT / 'desktop/plugin.js').read_text(encoding='utf-8')
    imports = re.findall(r'from\s+[\"\x27]([^\"\x27]+)', source)
    if set(imports) - {'react', 'react/jsx-runtime', '@hermes/plugin-sdk'}:
        raise SystemExit('Forbidden runtime import; no plugin installed.')
    check = subprocess.run([node, '--check', str(ROOT / 'desktop/plugin.js')], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if check.returncode:
        print(check.stderr)
        return check.returncode
    command = [node, '--experimental-vm-modules', '--disable-warning=ExperimentalWarning', '--test', 'tests/aac.test.mjs']
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    output = result.stdout + result.stderr
    (ROOT / 'TEST-RESULTS.txt').write_text('COMMAND: ' + subprocess.list2cmdline(['node'] + command[1:]) + '\n' + output + f'\nEXIT CODE: {result.returncode}\n', encoding='utf-8')
    print(output)
    if result.returncode:
        return result.returncode
    print('Syntax and import allowlist verified.')
    packaging_tests = subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_verify.py'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    print(packaging_tests.stdout + packaging_tests.stderr)
    with (ROOT / 'TEST-RESULTS.txt').open('a', encoding='utf-8') as report:
        report.write('\nPACKAGING TESTS:\n' + packaging_tests.stdout + packaging_tests.stderr)
    if packaging_tests.returncode:
        return packaging_tests.returncode
    if args.install:
        args.target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / 'desktop/plugin.js', args.target)
        installed = args.target.read_bytes()
        if installed != (ROOT / 'desktop/plugin.js').read_bytes():
            raise SystemExit('Installed copy differs from tested source.')
        print(f'Installed and read back: {args.target}')
        print(f'SHA256: {hashlib.sha256(installed).hexdigest()}')
    if args.package:
        archive = ROOT / 'hermes-aac-plugin.zip'
        create_archive(ROOT, archive)
        print(f'ZIP created and exact plugin bytes verified: {archive}')
        print(f'ZIP SHA256: {hashlib.sha256(archive.read_bytes()).hexdigest()}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
