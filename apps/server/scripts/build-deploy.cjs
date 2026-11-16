// Build a standalone Node.js server without bundling configuration or secrets.
const esbuild=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const serverDir=path.resolve(__dirname,'..');
const outputDir=path.resolve(serverDir,'../../server-dist');
const dependencies={...require('../package.json').dependencies};
delete dependencies['@kozel/game-core']; delete dependencies.tsx;
(async()=>{
  await esbuild.build({entryPoints:[path.join(serverDir,'src/index.ts')],outfile:path.join(outputDir,'index.js'),bundle:true,platform:'node',target:'node22',format:'cjs',external:Object.keys(dependencies),logLevel:'info'});
  fs.writeFileSync(path.join(outputDir,'package.json'),JSON.stringify({name:'kozel-server-deploy',version:'1.0.1',private:true,scripts:{start:'node index.js'},engines:{node:'>=22'},dependencies},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
