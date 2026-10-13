"""Actual isolated SDK/RPC source contracts; no live synthesis."""
import ast, os, builtins
from pathlib import Path
from types import SimpleNamespace
root=Path(os.environ['HERMES_SOURCE'])
sdk=(root/'apps/desktop/src/sdk/index.ts').read_text(encoding='utf-8')
for token in ['ROUTES_AREA','SIDEBAR_NAV_AREA','PALETTE_AREA','Codicon','connectionId:','profile:','request: async','onEvent: onGatewayEvent','gateway.request<T>(method, params)']:
    assert token in sdk, token
print('PASS SDK public surface and active gateway routing')
tree=ast.parse((root/'tui_gateway/methods_config.py').read_text(encoding='utf-8'))
getters=next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='_CONFIG_GETTERS' for t in n.targets))
full=next(v for k,v in zip(getters.keys,getters.values) if isinstance(k,ast.Constant) and k.value=='full')
fixture={'tts':{'provider':'elevenlabs'}}
getter=eval(compile(ast.Expression(full),'<actual getter>','eval'),{'_load_cfg':lambda:fixture})
assert getter({'key':'full','profile':'fixture'})=={'config':fixture}
print('PASS actual config.get full wrapper')
tree=ast.parse((root/'tui_gateway/methods_voice.py').read_text(encoding='utf-8'))
handler=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and any(isinstance(d,ast.Call) and isinstance(d.func,ast.Name) and d.func.id=='method' and d.args and isinstance(d.args[0],ast.Constant) and d.args[0].value=='voice.tts' for d in n.decorator_list))
handler.decorator_list=[]
threads=[]
class Thread:
    def __init__(self,**kwargs): threads.append(kwargs)
    def start(self): pass
def isolated_import(name,*args,**kwargs):
    assert name=='hermes_cli.voice',name
    return SimpleNamespace(voice=SimpleNamespace())
safe=dict(vars(builtins));safe['__import__']=isolated_import
ns={'__builtins__':safe,'threading':SimpleNamespace(Thread=Thread),'_speak_text_with_barge':object(),'_ok':lambda rid,result:result,'_err':lambda rid,code,msg:{'error':{'code':code}}}
exec(compile(ast.Module(body=[handler],type_ignores=[]),'<actual voice.tts>','exec'),ns)
assert ns['_'](1,{'text':'  My words!  ','profile':'fixture'})=={'status':'speaking'}
assert threads[0]['args']==('  My words!  ',) and threads[0]['daemon'] is True
assert ns['_'](2,{'text':''})['error']['code']==4020
print('PASS actual voice.tts exact text, asynchronous backend acknowledgement; no URL/completion/cancel handle')
print('Isolated source execution only; AAC profile parameter is not backend playback attestation.')
