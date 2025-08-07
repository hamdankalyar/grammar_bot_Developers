import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export default {
    input: 'assets/js/grammar_bot.js',
    output: {
        file: 'assets/js/dist/grammar_bot.bundle.js',
        format: 'iife',
        name: 'GrammarBot',
        sourcemap: true, // Always generate source maps
        globals: {
            'jquery': 'jQuery'
        }
    },
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs(),
        ...(isProduction ? [terser()] : [])
    ],
    external: ['jquery'] // Keep jQuery external since WordPress provides it
};