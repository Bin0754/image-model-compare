import pathlib
d=pathlib.Path(__file__).parent
h=(d/'head.html').read_text()
js=(d/'app1.js').read_text()+'\n'+(d/'app2.js').read_text()+'\n'+(d/'app3.js').read_text()
out=h.replace('/*CSS*/',(d/'style.css').read_text()).replace('/*JS*/',js)
(d.parent/'index.html').write_text(out)
print(len(out))
