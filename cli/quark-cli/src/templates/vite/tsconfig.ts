import {dedent} from "ts-dedent"
export const tsconfig = dedent(`{
  "compilerOptions": {
    /* Language & Runtime */
    "target": "ES2018",
    "lib": ["ES2018", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",

    /* Modules */
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,

    /* Paths */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },

    /* Emit (types only – JS handled by Vite) */
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "outDir": "./dist",
    "declarationDir": "./dist",
    "sourceMap": true,

    /* Interop */
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,

    /* Type Safety */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,

    /* Performance */
    "skipLibCheck": true
  },

  "include": ["src/**/*"],

  "exclude": [
    "node_modules",
    "dist",
    "**/*.stories.*",
    "**/*.test.*",
    "**/*.spec.*"
  ]
}`)