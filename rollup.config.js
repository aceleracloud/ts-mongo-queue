import typescript from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default [
  {
    input: './src/index.ts',
    output: {
      file: './lib/index.esm.js',
      format: 'esm',
    },
    plugins: [resolve(), typescript(), commonjs()],
  },
  {
    input: './src/index.ts',
    output: {
      file: './lib/index.js',
      format: 'cjs',
    },
    plugins: [resolve(), typescript(), commonjs()],
  },
]
