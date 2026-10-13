"""Source-contract presence check, NOT an Electron/live-provider integration test.
Run with HERMES_SOURCE pointing at a public Hermes v0.21.7 checkout.
"""
import os
from pathlib import Path

root = Path(os.environ['HERMES_SOURCE'])
checks = {
    'apps/desktop/src/sdk/index.ts': ['ROUTES_AREA', 'SIDEBAR_NAV_AREA', 'PALETTE_AREA', 'Codicon', 'connectionId:', 'profile:', 'request: async', 'onEvent: onGatewayEvent'],
    'apps/desktop/src/contrib/plugin.ts': ['onDispose', 'storage'],
    'hermes_cli/web_routers/audio.py': ['/api/audio/speak', '/api/audio/elevenlabs/voices'],
    'hermes_cli/web_routers/config_env.py': ['/api/config', 'ConfigUpdate'],
}
for name, tokens in checks.items():
    content = (root / name).read_text(encoding='utf-8')
    for token in tokens:
        assert token in content, f'{name}: missing {token}'
    print(f'PASS {name}: {len(tokens)} public contract markers')
print('Source presence only: no live host, provider, audio or configuration write exercised.')
