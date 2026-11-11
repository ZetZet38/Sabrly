import re,sys,os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
src=open('../../../index.html',encoding='utf-8').read()
mock=open('fbmock.js').read()
def strip(s):
    s=re.sub(r'<script src="https://www\.gstatic\.com/[^"]+"></script>\s*','',s)
    return s.replace('<script src="config.js"></script>','')
def inject(s,pre,tests):
    i=s.rfind('<script>');s=s[:i]+'<script>'+pre+mock+'</script>\n'+s[i:]
    j=s.rfind('</body>');return s[:j]+'<script>'+tests+'</script>'+s[j:]
auth='window.__AUTH_START={uid:"u1",email:"z@x.de"};'
open('web_run.html','w').write(inject(strip(src),auth,open('web_tests.js').read()))
open('web_train.html','w').write(inject(strip(src),auth,open('web_train_tests.js').read()))
open('web_shot.html','w').write(inject(strip(src),auth,''))
open('web_auth.html','w').write(inject(strip(src),'',open('web_auth_tests.js').read()))
for t in ['aufgaben','statistik','heute']:
    open('web_nav_'+t+'.html','w').write(inject(strip(src),auth+'window.__WANT="'+t+'";',open('web_nav_tests.js').read()))
j=src.rfind('</body>');open('web_nocfg.html','w').write(src[:j]+'<script>'+open('web_nocfg_tests.js').read()+'</script>'+src[j:])
print('built')
