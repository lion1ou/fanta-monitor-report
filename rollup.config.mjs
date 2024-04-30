// rollup 配置文件
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import rollupTypescript from "rollup-plugin-typescript2";
import babel from "@rollup/plugin-babel";
import json from '@rollup/plugin-json';
import terser from "@rollup/plugin-terser"; 
import serve from 'rollup-plugin-serve';
import { DEFAULT_EXTENSIONS } from "@babel/core";
import pkg from "./package.json" assert { type: 'json' }; // 读取 package.json 配置
import replace from "@rollup/plugin-replace";
const env = process.env.NODE_ENV; // 当前运行环境，可通过 cross-env 命令行设置
const name = "FantaReport"; // 导出的全局变量名称
const config = {
  input: "src/main.ts",
  output: [
    {
      file: pkg.main,
      format: "cjs",
    },
    {
      file: pkg.module,
      format: "es",
    },
    {
      file: pkg.umd,
      format: "umd",
      name,
    },
  ],
  plugins: [
    json(),
     // 解析第三方依赖 
    resolve({ jsnext: true, preferBuiltins: true, browser: true }), 
     // 识别 commonjs 模式第三方依赖 
     commonjs(),
     // rollup 编译 typescript 
    rollupTypescript(), 
     // babel 配置 
    babel({ 
        babelHelpers: 'runtime',
        skipPreflightCheck: true,
         // 只转换源代码，不转换外部依赖 
         exclude: 'node_modules/**', 
         // babel 默认不支持 ts 需要手动添加 
         extensions: [ 
             ...DEFAULT_EXTENSIONS, 
             '.ts', 
         ], 
    }),
  ],
};

// 若打包正式环境，压缩代码 
if (env === 'production') { 
  config.plugins.push(terser({ 
      compress: { 
          pure_getters: true, 
          unsafe: true, 
          unsafe_comps: true, 
          warnings: false 
      } 
  })) 
  config.plugins.push(
    replace({
      '__VERSION__': pkg.version,
      '__BUILDTIME__': new Date().toLocaleString(),
      '__ENV__': 'production'
    })
  ) 
} 

// 测试环境才需要服务
if (env !== 'production') { 
  config.plugins.push(
    serve({
      contentBase: ['example', 'dist'],
      port: 3388,
      open: true,
    })
  ) 
  config.plugins.push(
    replace({
      '__VERSION__': pkg.version,
      '__BUILDTIME__': new Date().toLocaleString(),
      '__ENV__': 'development'
    })
  ) 
} 

export default config;
